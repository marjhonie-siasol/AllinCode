pub struct PruningMetrics {
    pub raw_tokens: usize,
    pub pruned_tokens: usize,
    pub tokens_saved: usize,
    pub reduction_percentage: f64,
}

pub fn calculate_pruning_metrics(code: &str, tool_count: usize) -> PruningMetrics {
    // Standard MCP tools average ~300 tokens per full JSON Schema specification
    let raw_tokens = if tool_count > 0 {
        tool_count * 300
    } else {
        116 * 300 // default 116 tools = 34,800 tokens
    };

    // Code mode transmits minimal TS definitions + the synthesized JavaScript code
    // ~4 chars per token average
    let code_tokens = (code.trim().len() / 4).max(10);
    // Base TS interface declarations for referenced tools ~120 tokens
    let pruned_tokens = code_tokens + 120;

    let tokens_saved = if raw_tokens > pruned_tokens {
        raw_tokens - pruned_tokens
    } else {
        0
    };

    let reduction_percentage = if raw_tokens > 0 {
        (tokens_saved as f64 / raw_tokens as f64) * 100.0
    } else {
        0.0
    };

    PruningMetrics {
        raw_tokens,
        pruned_tokens,
        tokens_saved,
        reduction_percentage,
    }
}
