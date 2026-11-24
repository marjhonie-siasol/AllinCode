use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;

use allincode_core::{ExecutionRequest, ExecutionResult, Sandbox, TraceRecord};

#[derive(Clone, Serialize, Deserialize)]
pub struct AppStateData {
    pub detected_app: String,
    pub active_model: String,
    pub available_models: Vec<String>,
    pub isolate_ready: bool,
    pub federated_tools_count: usize,
    pub traces: Vec<TraceRecord>,
}

pub struct ServerState {
    pub data: Mutex<AppStateData>,
    pub sandbox: Sandbox,
    pub tx: broadcast::Sender<String>,
}

#[derive(Deserialize)]
pub struct SetModelPayload {
    pub model: String,
}

#[derive(Deserialize)]
pub struct ApproveMutationPayload {
    pub trace_id: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let initial_data = AppStateData {
        detected_app: "Antigravity IDE".to_string(),
        active_model: "Gemini 3.5 Flash (Medium)".to_string(),
        available_models: vec![
            "Gemini 3.5 Flash (Medium)".to_string(),
            "Gemini 3.5 Pro (Deep)".to_string(),
            "Gemini 3.0 Flash".to_string(),
            "Claude 3.7 Sonnet".to_string(),
            "GPT-4.5 Preview".to_string(),
        ],
        isolate_ready: true,
        federated_tools_count: 116,
        traces: vec![],
    };

    let (tx, _rx) = broadcast::channel(100);

    let state = Arc::new(ServerState {
        data: Mutex::new(initial_data),
        sandbox: Sandbox::new(),
        tx,
    });

    let app = Router::new()
        .route("/api/status", get(get_status))
        .route("/api/set-model", post(set_model))
        .route("/api/execute", post(execute_code))
        .route("/api/approve-mutation", post(approve_mutation))
        .route("/api/traces", get(get_traces))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let port = 4000;
    let addr = format!("0.0.0.0:{}", port);
    println!("AllInCode Native Engine listening on http://127.0.0.1:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn get_status(State(state): State<Arc<ServerState>>) -> Json<AppStateData> {
    let data = state.data.lock().unwrap().clone();
    Json(data)
}

async fn set_model(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<SetModelPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut data = state.data.lock().unwrap();
    data.active_model = payload.model.clone();

    // Broadcast model change over WS
    let msg = serde_json::json!({
        "type": "MODEL_CHANGED",
        "model": payload.model
    }).to_string();
    let _ = state.tx.send(msg);

    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "ok", "active_model": data.active_model })),
    )
}

async fn get_traces(State(state): State<Arc<ServerState>>) -> Json<Vec<TraceRecord>> {
    let data = state.data.lock().unwrap();
    Json(data.traces.clone())
}

async fn execute_code(
    State(state): State<Arc<ServerState>>,
    Json(req): Json<ExecutionRequest>,
) -> (StatusCode, Json<serde_json::Value>) {
    match state.sandbox.execute(req) {
        Ok(result) => {
            // Save trace to state
            {
                let mut data = state.data.lock().unwrap();
                data.traces.insert(0, result.trace.clone());
                if data.traces.len() > 50 {
                    data.traces.truncate(50);
                }
            }

            // Broadcast trace over WS
            let ws_msg = serde_json::json!({
                "type": "TRACE_RECORD",
                "trace": result.trace
            }).to_string();
            let _ = state.tx.send(ws_msg);

            (StatusCode::OK, Json(serde_json::to_value(&result).unwrap()))
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "error": err
            })),
        ),
    }
}

async fn approve_mutation(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<ApproveMutationPayload>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut data = state.data.lock().unwrap();
    for trace in &mut data.traces {
        if trace.id == payload.trace_id {
            trace.mutation_status = Some("Approved".to_string());
            trace.mode = "Code mode (Approved)".to_string();
        }
    }

    let ws_msg = serde_json::json!({
        "type": "MUTATION_APPROVED",
        "trace_id": payload.trace_id
    }).to_string();
    let _ = state.tx.send(ws_msg);

    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "ok", "trace_id": payload.trace_id })),
    )
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<ServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<ServerState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    // Send initial greeting with current status
    let initial_status = {
        let data = state.data.lock().unwrap().clone();
        serde_json::json!({
            "type": "INITIAL_STATE",
            "data": data
        }).to_string()
    };
    let _ = sender.send(Message::Text(initial_status.into())).await;

    // Task to forward broadcast messages to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Task to receive messages from client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                println!("Received WS message from client: {}", text);
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}
