# Rust Style Guide - Clockwork Menubar

## General

- Follow standard `rustfmt` formatting (run `cargo fmt` before commits)
- Use `clippy` with default lints enabled (`cargo clippy`)
- Prefer safe Rust; avoid `unsafe` unless absolutely necessary
- Edition: 2021 or later

## Naming Conventions

| Entity | Convention | Example |
| --- | --- | --- |
| Variables / Functions | snake_case | `get_active_timer`, `worklog_list` |
| Types / Structs / Enums | PascalCase | `TimerResponse`, `WorklogEntry` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRY` |
| Modules | snake_case | `timer_service`, `system_tray` |
| Traits | PascalCase | `TimerProvider`, `Cacheable` |

## Error Handling

- Use `Result<T, E>` for fallible operations
- Define custom error types with `thiserror`
- Use `anyhow` for application-level error propagation
- Avoid `.unwrap()` in production code; use `.expect("reason")` only when invariant is guaranteed

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Failed to fetch timer data: {0}")]
    FetchError(#[from] reqwest::Error),
    #[error("JWT token expired")]
    TokenExpired,
}
```

## Structs and Serialization

- Use `serde` for JSON serialization/deserialization
- Derive `Debug` on all public types
- Use `#[serde(rename_all = "camelCase")]` for API compatibility

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Timer {
    pub id: u64,
    pub started_at: String,
    pub issue: Issue,
    pub till_now: u64,
}
```

## Tauri Commands

- Keep Tauri commands thin - delegate to service modules
- Use `#[tauri::command]` with explicit error types
- Return `Result<T, String>` for commands (Tauri requirement)

```rust
#[tauri::command]
async fn get_active_timers(state: State<'_, AppState>) -> Result<Vec<Timer>, String> {
    timer_service::fetch_active(state.inner())
        .await
        .map_err(|e| e.to_string())
}
```

## Dependencies

- Minimize dependency count
- Prefer well-maintained crates from the Rust ecosystem
- Key crates: `tauri`, `serde`, `reqwest`, `tokio`, `thiserror`, `anyhow`

## Documentation

- Add doc comments (`///`) for public APIs
- Use `//` for implementation notes only when logic is non-obvious
- Keep comments up to date with code changes
