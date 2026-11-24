use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRequest {
    pub code: String,
    pub prompt: Option<String>,
    pub context: Option<serde_json::Value>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutationDetail {
    pub tool: String,
    pub action: String,
    pub target: String,
    pub risk_level: String, // "CRITICAL", "HIGH", "MEDIUM"
    pub blocked: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStage {
    pub name: String,
    pub latency_ms: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceRecord {
    pub id: String,
    pub timestamp: String,
    pub prompt: String,
    pub mode: String, // "Code mode", "Mutation gate", "Bypass"
    pub total_latency_ms: f64,
    pub tokens_saved: usize,
    pub tools_called: Vec<String>,
    pub stages: Vec<PipelineStage>,
    pub observation: serde_json::Value,
    pub mutation_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub output: serde_json::Value,
    pub logs: Vec<String>,
    pub latency_ms: f64,
    pub memory_mb: f64,
    pub tokens_saved: usize,
    pub raw_tokens: usize,
    pub pruned_tokens: usize,
    pub mutation_detected: bool,
    pub mutation_details: Option<MutationDetail>,
    pub trace: TraceRecord,
}
