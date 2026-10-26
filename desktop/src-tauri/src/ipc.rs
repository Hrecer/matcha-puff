use rusqlite::OptionalExtension;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub struct HttpState {
    pub next: u32,
    pub clients: HashMap<u32, reqwest::Client>,
}

pub struct EventListener {
    pub event: String,
    pub label: String,
    pub handler: u64,
}

pub struct EventsState {
    pub next_id: u64,
    pub listeners: HashMap<u64, EventListener>,
}

pub struct ChildHandle {
    pub child: std::sync::Arc<Mutex<std::process::Child>>,
    pub stdin: std::sync::Arc<Mutex<Option<std::process::ChildStdin>>>,
}

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
    pub http: Mutex<HttpState>,
    pub events: Mutex<EventsState>,
    pub children: std::sync::Arc<Mutex<HashMap<u32, ChildHandle>>>,
    /// 专注计时内核（Rust 持有权威时间，TS 只读快照）
    pub focus: Mutex<crate::focus::FocusState>,
}

impl AppState {
    pub fn new(conn: rusqlite::Connection) -> Self {
        let restored = crate::focus::restore(
            crate::focus::load(&conn).unwrap_or_default(),
            crate::focus::now_ms(),
        );
        if restored.1 {
            let _ = crate::focus::save(&conn, &restored.0);
        }
        Self {
            db: Mutex::new(conn),
            http: Mutex::new(HttpState {
                next: 1,
                clients: HashMap::new(),
            }),
            events: Mutex::new(EventsState {
                next_id: 1,
                listeners: HashMap::new(),
            }),
            children: std::sync::Arc::new(Mutex::new(HashMap::new())),
            focus: Mutex::new(restored.0),
        }
    }
}

#[tauri::command]
pub async fn v1_ipc(
    app: AppHandle,
    state: State<'_, AppState>,
    message: Value,
) -> Result<Value, String> {
    let cmd = message
        .get("cmd")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    if cmd == "tauri" {
        let module = message
            .get("__tauriModule")
            .and_then(Value::as_str)
            .unwrap_or("");
        let inner = message.get("message").cloned().unwrap_or(Value::Null);
        if module == "Http" {
            return http_module(&state, &inner).await;
        }
        if module == "Event" {
            return event_module(&app, &state, &inner);
        }
        if module == "Shell" {
            return shell_module(&app, &state, &inner);
        }
        if module == "Dialog" {
            return dialog_module(&inner).await;
        }
        return dispatch_module(&app, module, &inner);
    }

    dispatch_command(&app, &state, &cmd, &message).await
}

fn event_module(
    app: &AppHandle,
    state: &State<'_, AppState>,
    msg: &Value,
) -> Result<Value, String> {
    let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or("");
    let event = msg.get("event").and_then(Value::as_str).unwrap_or("").to_string();
    match cmd {
        "listen" => {
            let label = msg
                .get("windowLabel")
                .and_then(Value::as_str)
                .unwrap_or("main")
                .to_string();
            let handler = msg.get("handler").and_then(Value::as_u64).unwrap_or(0);
            let mut st = state.events.lock().unwrap();
            let id = st.next_id;
            st.next_id += 1;
            st.listeners.insert(
                id,
                EventListener {
                    event: event.clone(),
                    label: label.clone(),
                    handler,
                },
            );
            eprintln!("[event] listen '{event}' win={label} handler={handler} id={id}");
            Ok(json!(id))
        }
        "unlisten" => {
            let id = msg.get("eventId").and_then(Value::as_u64).unwrap_or(0);
            state.events.lock().unwrap().listeners.remove(&id);
            Ok(Value::Null)
        }
        "emit" => {
            let payload = msg.get("payload").cloned().unwrap_or(Value::Null);
            broadcast(app, state, &event, &payload);
            Ok(Value::Null)
        }
        other => Err(format!("[Event] not implemented: {other}")),
    }
}

/// 向后端注册过该事件的窗口广播（复刻原 emit 行为）。
///
/// 计时线程也走这里：Rust 每秒推送 focus:tick，前端只渲染。
pub fn broadcast(app: &AppHandle, state: &AppState, event: &str, payload: &Value) -> usize {
    let targets: Vec<(String, u64)> = {
        let st = state.events.lock().unwrap();
        st.listeners
            .values()
            .filter(|listener| listener.event == event)
            .map(|listener| (listener.label.clone(), listener.handler))
            .collect()
    };
    for (label, handler) in &targets {
        if let Some(win) = app.get_webview_window(label) {
            let payload_js = serde_json::to_string(payload).unwrap_or_else(|_| "null".into());
            let js = format!("window[\"_{handler}\"] && window[\"_{handler}\"]({payload_js});");
            let _ = win.eval(&js);
        }
    }
    targets.len()
}

/// 挂件可见性变化后广播给已订阅的窗口，页面 / 芯片 / 托盘共用一份状态。
fn notify_widget_visibility(app: &AppHandle, state: &AppState) -> bool {
    let visible = crate::focus_widget_visible(app);
    broadcast(app, state, "focus:widget", &json!({ "visible": visible }));
    visible
}

/// 窗口从隐藏状态重新露出时补发一次真实快照。
///
/// 隐藏期间 WebView 会挂起、收不到 focus:phase（比如托盘菜单收起时停止了专注），
/// 再次打开若不补这一下，按钮会停在「暂停/停止」可点的旧相位。
pub fn broadcast_focus_snapshot(app: &AppHandle, state: &AppState) {
    let snapshot = state
        .focus
        .lock()
        .map(|focus| focus.snapshot(crate::focus::now_ms(), true))
        .ok();
    if let Some(snapshot) = snapshot {
        broadcast(app, state, "focus:phase", &snapshot);
    }
}

fn dispatch_module(app: &AppHandle, module: &str, msg: &Value) -> Result<Value, String> {
    match module {
        "App" => match msg.get("cmd").and_then(Value::as_str) {
            // 版本只有一个来源：Cargo.toml。改版本时只改那一处。
            Some("getAppVersion") => Ok(json!(env!("CARGO_PKG_VERSION"))),
            Some(c) => Err(format!("[App] not implemented: {c}")),
            None => Err("bad App message".into()),
        },
        "Os" => Ok(json!("win32")),
        "Path" => {
            let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or("");
            match cmd {
                "join" => {
                    let parts: Vec<String> = msg
                        .get("paths")
                        .and_then(Value::as_array)
                        .map(|a| {
                            a.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();
                    Ok(json!(parts.join("\\")))
                }
                _ => Err(format!("[Path] not implemented: {cmd}")),
            }
        }
        "Window" => window_manage(app, msg),
        "Fs" => match msg.get("cmd").and_then(Value::as_str) {
            Some("writeFile") => {
                let path = msg.get("path").and_then(Value::as_str).unwrap_or("");
                let bytes: Vec<u8> = msg
                    .get("contents")
                    .and_then(Value::as_array)
                    .map(|a| a.iter().filter_map(|v| v.as_u64().map(|b| b as u8)).collect())
                    .unwrap_or_default();
                std::fs::write(path, bytes).map_err(|e| e.to_string())?;
                Ok(Value::Null)
            }
            Some("exists") => {
                let path = msg.get("path").and_then(Value::as_str).unwrap_or("");
                Ok(json!(std::path::Path::new(path).exists()))
            }
            Some("createDir") => {
                let path = msg.get("path").and_then(Value::as_str).unwrap_or("");
                std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
                Ok(Value::Null)
            }
            Some("readFile") => {
                let path = msg.get("path").and_then(Value::as_str).unwrap_or("");
                let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
                use base64::Engine;
                Ok(json!(base64::engine::general_purpose::STANDARD.encode(&bytes)))
            }
            other => Err(format!("[Fs] not implemented: {other:?}")),
        },
        "Clipboard" => {
            // 优先取 message 内的 cmd，取不到再退回顶层：
            // { cmd: "Clipboard", message: { cmd: "readText" } } 与 { cmd: "readText" } 两种信封都支持。
            let inner = msg.get("message").unwrap_or(msg);
            match inner.get("cmd").and_then(Value::as_str) {
                Some("readText") | Some("read_text") => {
                    let text = arboard::Clipboard::new()
                        .and_then(|mut c| c.get_text())
                        .ok();
                    Ok(text.map(|t| json!(t)).unwrap_or(Value::Null))
                }
                Some("writeText") | Some("write_text") => {
                    let data = inner
                        .get("data")
                        .and_then(Value::as_str)
                        .or_else(|| msg.get("data").and_then(Value::as_str))
                        .unwrap_or("");
                    arboard::Clipboard::new()
                        .and_then(|mut c| c.set_text(data.to_string()))
                        .map_err(|e| e.to_string())?;
                    Ok(Value::Null)
                }
                other => Err(format!("[Clipboard] not implemented: {other:?}")),
            }
        }
        // 直连读剪贴板：给工具页 / 粘贴类操作使用
        "read_clipboard" => {
            let text = arboard::Clipboard::new().and_then(|mut c| c.get_text()).ok();
            Ok(text.map(|t| json!(t)).unwrap_or(Value::Null))
        }
        other => Err(format!("[module {other}] not implemented")),
    }
}

async fn http_module(state: &State<'_, AppState>, msg: &Value) -> Result<Value, String> {
    let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or("");
    match cmd {
        "createClient" => {
            let options = msg.get("options").cloned().unwrap_or(json!({}));
            let mut builder = reqwest::Client::builder();
            if let Some(n) = options.get("maxRedirections").and_then(Value::as_u64) {
                builder = builder.redirect(reqwest::redirect::Policy::limited(n as usize));
            }
            if let Some(ms) = options.get("connectTimeout").and_then(Value::as_u64) {
                builder = builder.connect_timeout(std::time::Duration::from_millis(ms));
            }
            if let Some(hs) = options.get("headers").and_then(Value::as_object) {
                let mut h = reqwest::header::HeaderMap::new();
                for (k, v) in hs {
                    let name = reqwest::header::HeaderName::from_bytes(k.as_bytes());
                    let val = reqwest::header::HeaderValue::from_str(v.as_str().unwrap_or(""));
                    if let (Ok(name), Ok(val)) = (name, val) {
                        h.insert(name, val);
                    }
                }
                builder = builder.default_headers(h);
            }
            let client = builder.build().map_err(|e| e.to_string())?;
            let mut st = state.http.lock().unwrap();
            let id = st.next;
            st.next += 1;
            st.clients.insert(id, client);
            Ok(json!(id))
        }
        "dropClient" => {
            let id = msg.get("client").and_then(Value::as_u64).unwrap_or(u64::MAX) as u32;
            state.http.lock().unwrap().clients.remove(&id);
            Ok(Value::Null)
        }
        "httpRequest" => {
            let client_id = msg.get("client").and_then(Value::as_u64).unwrap_or(0) as u32;
            let opts = msg.get("options").cloned().unwrap_or(json!({}));
            let client = {
                let st = state.http.lock().unwrap();
                st.clients
                    .get(&client_id)
                    .cloned()
                    .ok_or_else(|| format!("http client not found: {client_id}"))?
            };

            let method = opts.get("method").and_then(Value::as_str).unwrap_or("GET");
            let url = opts.get("url").and_then(Value::as_str).unwrap_or("");
            let mut req = client.request(
                reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?,
                url,
            );
            if let Some(hs) = opts.get("headers").and_then(Value::as_object) {
                for (k, v) in hs {
                    if let Some(vs) = v.as_str() {
                        req = req.header(k, vs);
                    }
                }
            }
            if let Some(q) = opts.get("query").and_then(Value::as_object) {
                let pairs: Vec<(String, String)> = q
                    .iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect();
                req = req.query(&pairs);
            }
            if let Some(body) = opts.get("body") {
                let ty = body.get("type").and_then(Value::as_str).unwrap_or("");
                let payload = body.get("payload").cloned().unwrap_or(Value::Null);
                match ty {
                    "Text" => {
                        req = req.body(payload.as_str().unwrap_or("").to_string());
                    }
                    "Json" => {
                        let text = serde_json::to_string(&payload).unwrap_or_default();
                        req = req
                            .header("content-type", "application/json")
                            .body(text);
                    }
                    "Bytes" => {
                        let bytes: Vec<u8> = payload
                            .as_array()
                            .map(|a| {
                                a.iter()
                                    .filter_map(|v| v.as_u64().map(|b| b as u8))
                                    .collect()
                            })
                            .unwrap_or_default();
                        req = req.body(bytes);
                    }
                    other => return Err(format!("[Http] body type not implemented: {other}")),
                }
            }

            let resp = req.send().await.map_err(|e| e.to_string())?;
            let status = resp.status().as_u16();
            let final_url = resp.url().to_string();
            let mut headers_map = serde_json::Map::new();
            let mut raw = Vec::new();
            for (k, v) in resp.headers().iter() {
                let name = k.as_str().to_string();
                let val = v.to_str().unwrap_or("").to_string();
                headers_map.insert(name.clone(), json!(val));
                raw.push(json!([name, val]));
            }

            let response_type = opts.get("responseType").and_then(Value::as_u64).unwrap_or(2);
            let data = if response_type == 3 {
                let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
                json!(bytes.iter().map(|b| *b as u64).collect::<Vec<_>>())
            } else {
                let text = resp.text().await.map_err(|e| e.to_string())?;
                json!(text)
            };

            Ok(json!({
                "url": final_url,
                "status": status,
                "headers": headers_map,
                "rawHeaders": raw,
                "data": data
            }))
        }
        other => Err(format!("[Http] not implemented: {other}")),
    }
}

fn size_of(cmd: &Value) -> Option<(String, f64, f64)> {
    for holder in [cmd.get("data"), cmd.get("payload"), Some(cmd)]
        .into_iter()
        .flatten()
    {
        let ty = holder.get("type").and_then(Value::as_str);
        let w = holder.get("width").and_then(Value::as_f64);
        let h = holder.get("height").and_then(Value::as_f64);
        if let (Some(ty), Some(w), Some(h)) = (ty, w, h) {
            if ty == "Logical" || ty == "Physical" {
                return Some((ty.to_string(), w, h));
            }
        }
        if let Some(inner) = holder.get("size") {
            if let (Some(ty), Some(w), Some(h)) = (
                inner.get("type").and_then(Value::as_str),
                inner.get("width").and_then(Value::as_f64),
                inner.get("height").and_then(Value::as_f64),
            ) {
                return Some((ty.to_string(), w, h));
            }
        }
    }
    None
}

fn window_manage(app: &AppHandle, msg: &Value) -> Result<Value, String> {
    let data = msg.get("data").cloned().unwrap_or(Value::Null);
    let label = data
        .get("label")
        .and_then(Value::as_str)
        .unwrap_or("main")
        .to_string();
    let cmd = data.get("cmd").cloned().unwrap_or(Value::Null);
    let cmd_type = cmd.get("type").and_then(Value::as_str).unwrap_or("");

    let win: WebviewWindow = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("window not found: {label}"))?;

    match cmd_type {
        "scaleFactor" => Ok(json!(win.scale_factor().map_err(|e| e.to_string())?)),
        "innerSize" => {
            let s = win.inner_size().map_err(|e| e.to_string())?;
            Ok(json!({"width": s.width, "height": s.height}))
        }
        "outerSize" => {
            let s = win.outer_size().map_err(|e| e.to_string())?;
            Ok(json!({"width": s.width, "height": s.height}))
        }
        "innerPosition" => {
            let p = win.inner_position().map_err(|e| e.to_string())?;
            Ok(json!({"x": p.x, "y": p.y}))
        }
        "outerPosition" => {
            let p = win.outer_position().map_err(|e| e.to_string())?;
            Ok(json!({"x": p.x, "y": p.y}))
        }
        "isMaximized" => Ok(json!(win.is_maximized().map_err(|e| e.to_string())?)),
        "isMinimized" => Ok(json!(win.is_minimized().map_err(|e| e.to_string())?)),
        "isVisible" => Ok(json!(win.is_visible().map_err(|e| e.to_string())?)),
        "isDecorated" => Ok(json!(win.is_decorated().map_err(|e| e.to_string())?)),
        "isResizable" => Ok(json!(win.is_resizable().map_err(|e| e.to_string())?)),
        "title" => Ok(json!(win.title().map_err(|e| e.to_string())?)),
        "minimize" => {
            win.minimize().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "maximize" => {
            win.maximize().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "unmaximize" => {
            win.unmaximize().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "toggleMaximize" => {
            if win.is_maximized().map_err(|e| e.to_string())? {
                win.unmaximize().map_err(|e| e.to_string())?;
            } else {
                win.maximize().map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        "hide" => {
            win.hide().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "show" => {
            win.show().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "close" => {
            win.close().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "destroy" => {
            win.destroy().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "setFocus" => {
            win.set_focus().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "startDragging" => {
            win.start_dragging().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "startResizeDragging" => {
            let dir = cmd
                .get("direction")
                .and_then(Value::as_str)
                .unwrap_or("");
            let direction = match dir {
                "n" => tauri_runtime::ResizeDirection::North,
                "s" => tauri_runtime::ResizeDirection::South,
                "e" => tauri_runtime::ResizeDirection::East,
                "w" => tauri_runtime::ResizeDirection::West,
                "ne" => tauri_runtime::ResizeDirection::NorthEast,
                "nw" => tauri_runtime::ResizeDirection::NorthWest,
                "se" => tauri_runtime::ResizeDirection::SouthEast,
                "sw" => tauri_runtime::ResizeDirection::SouthWest,
                _ => return Err(format!("startResizeDragging: bad direction {dir}")),
            };
            win.as_ref().window().start_resize_dragging(direction)
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "setAlwaysOnTop" => {
            let v = cmd
                .get("data")
                .and_then(|d| d.get("alwaysOnTop"))
                .or_else(|| cmd.get("payload").and_then(|d| d.get("alwaysOnTop")))
                .and_then(Value::as_bool)
                .unwrap_or(false);
            win.set_always_on_top(v).map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "setSize" => {
            let (ty, w, h) = size_of(&cmd).ok_or_else(|| "setSize: bad size".to_string())?;
            if ty == "Physical" {
                win.set_size(tauri::PhysicalSize::new(w as u32, h as u32))
                    .map_err(|e| e.to_string())?;
            } else {
                win.set_size(tauri::LogicalSize::new(w, h))
                    .map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        other => Err(format!("[Window.manage] not implemented: {other}")),
    }
}

/// 番茄钟文档表读写：一个 key 一份 JSON。
fn pomo_doc_command(
    state: &State<'_, AppState>,
    cmd: &str,
    message: &Value,
) -> Result<Value, String> {
    const MAX_KEY: usize = 64;
    const MAX_BYTES: usize = 4 * 1024 * 1024;

    let key = message
        .get("key")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|key| !key.is_empty() && key.len() <= MAX_KEY)
        .ok_or_else(|| "pomo_doc: key 无效".to_string())?;

    let conn = state.db.lock().map_err(|e| e.to_string())?;

    if cmd == "pomo_doc_get" {
        let raw: Option<String> = conn
            .query_row(
                "SELECT value FROM pomodoro_docs WHERE key = ?1",
                [key],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        return Ok(raw
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .unwrap_or(Value::Null));
    }

    let value = message.get("value").cloned().unwrap_or(Value::Null);
    let raw = serde_json::to_string(&value).map_err(|e| e.to_string())?;
    if raw.len() > MAX_BYTES {
        return Err("pomo_doc: 文档过大".into());
    }
    conn.execute(
        "INSERT INTO pomodoro_docs (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        rusqlite::params![key, raw, crate::focus::now_ms()],
    )
    .map_err(|e| e.to_string())?;
    Ok(Value::Null)
}

fn persist_focus(state: &AppState) {
    let snapshot = state.focus.lock().unwrap().clone();
    if let Ok(conn) = state.db.lock() {
        if let Err(err) = crate::focus::save(&conn, &snapshot) {
            eprintln!("[focus] 保存会话失败：{err}");
        }
    }
}

/// 专注计时命令：只操作 Rust 状态，业务入账交给 TS。
fn focus_command(
    app: &AppHandle,
    state: &State<'_, AppState>,
    cmd: &str,
    message: &Value,
) -> Result<Value, String> {
    let now = crate::focus::now_ms();
    let read_only = cmd == "focus_state";

    let snapshot = {
        let mut focus = state.focus.lock().unwrap();
        match cmd {
            "focus_start" => {
                let minutes = message
                    .get("minutes")
                    .and_then(Value::as_i64)
                    .unwrap_or(25);
                let task_value = message
                    .get("task")
                    .cloned()
                    .ok_or_else(|| "focus_start 缺少 task".to_string())?;
                let task: crate::focus::TaskRef = serde_json::from_value(task_value)
                    .map_err(|e| format!("task 格式错误：{e}"))?;
                if task.id.len() > 64 || task.name.len() > 200 || task.desc.len() > 2000 {
                    return Err("task 字段过长".into());
                }
                let policy: crate::focus::Policy = match message.get("policy") {
                    Some(value) => serde_json::from_value(value.clone())
                        .map_err(|e| format!("policy 格式错误：{e}"))?,
                    None => crate::focus::Policy::default(),
                };
                focus.start(minutes, task, policy, now);
            }
            "focus_pause" => focus.pause(now),
            "focus_resume" => focus.resume(now),
            "focus_stop" => focus.stop(now),
            "focus_skip_rest" => focus.skip_rest(now),
            "focus_start_rest" => {
                let minutes = message.get("minutes").and_then(Value::as_i64).unwrap_or(5);
                let kind = match message.get("restKind").and_then(Value::as_str) {
                    Some("long") => crate::focus::RestKind::Long,
                    _ => crate::focus::RestKind::Short,
                };
                focus.start_rest(minutes, kind, now);
            }
            "focus_ack" => focus.clear_pending(),
            _ => {}
        }
        focus.snapshot(now, true)
    };

    if !read_only {
        persist_focus(state);
        broadcast(app, state, "focus:phase", &snapshot);
    }
    Ok(snapshot)
}

/**
 * 工具开关设置文件。
 *
 * 路径固定为 `~/.matcha-puff/settings.json`，可用 MATCHA_PUFF_SETTINGS 覆盖。
 */
fn tool_settings_path() -> std::path::PathBuf {
    if let Ok(custom) = std::env::var("MATCHA_PUFF_SETTINGS") {
        if !custom.trim().is_empty() {
            return std::path::PathBuf::from(custom);
        }
    }
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    std::path::PathBuf::from(home)
        .join(".matcha-puff")
        .join("settings.json")
}

/** 原子写文本：临时文件 + rename，避免掉电时写坏 */
fn write_text_atomic(path: &std::path::Path, text: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败：{e}"))?;
    }
    let tmp = path.with_extension(format!("{}.tmp", std::process::id()));
    std::fs::write(&tmp, text).map_err(|e| format!("写入设置失败：{e}"))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("替换设置文件失败：{e}"))?;
    Ok(())
}

async fn dispatch_command(
    app: &AppHandle,
    state: &State<'_, AppState>,
    cmd: &str,
    message: &Value,
) -> Result<Value, String> {
    match cmd {
        "focus_state" | "focus_start" | "focus_pause" | "focus_resume" | "focus_stop"
        | "focus_skip_rest" | "focus_start_rest" | "focus_ack" => {
            focus_command(app, state, cmd, message)
        }
        "pomo_doc_get" | "pomo_doc_set" => pomo_doc_command(state, cmd, message),
        // ---- 工具开关设置 ----
        "tool_settings_read" => match std::fs::read_to_string(tool_settings_path()) {
            Ok(text) if !text.trim().is_empty() => Ok(json!(text)),
            _ => Ok(Value::Null),
        },
        "tool_settings_write" => {
            let data = message
                .get("data")
                .and_then(Value::as_str)
                .ok_or_else(|| "tool_settings_write 缺少 data".to_string())?;
            // 必须是 JSON 对象，写坏了启动时就读不出来
            match serde_json::from_str::<Value>(data) {
                Ok(Value::Object(_)) => {}
                _ => return Err("工具设置必须是 JSON 对象".into()),
            }
            write_text_atomic(&tool_settings_path(), data)?;
            Ok(Value::Null)
        }
        "clear_user_data" => {
            {
                let mut focus = state.focus.lock().map_err(|e| e.to_string())?;
                focus.stop(crate::focus::now_ms());
                focus.clear_pending();
            }
            {
                let conn = state.db.lock().map_err(|e| e.to_string())?;
                conn.execute_batch(
                    "DELETE FROM pomodoro_docs;
                     DELETE FROM pomodoro_focus;
                     DELETE FROM commands WHERE type_id = 4;",
                )
                .map_err(|e| e.to_string())?;
            }
            crate::conf::save(&crate::conf::AppConf::default())?;
            let snapshot = state
                .focus
                .lock()
                .map_err(|e| e.to_string())?
                .snapshot(crate::focus::now_ms(), true);
            broadcast(app, state, "focus:phase", &snapshot);
            Ok(Value::Null)
        }
        "notify" => {
            use tauri_plugin_notification::NotificationExt;
            let title = message
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("抹茶泡芙");
            let body = message.get("body").and_then(Value::as_str).unwrap_or("");
            app.notification()
                .builder()
                .title(title)
                .body(body)
                .show()
                .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "read_clipboard" => {
            let text = arboard::Clipboard::new()
                .and_then(|mut c| c.get_text())
                .ok();
            Ok(text.map(|t| json!(t)).unwrap_or(Value::Null))
        }
        "get_app_conf" => serde_json::to_value(crate::conf::load()).map_err(|e| e.to_string()),
        "set_app_conf" => {
            let data = message.get("data").cloned().unwrap_or(Value::Null);
            let conf: crate::conf::AppConf =
                serde_json::from_value(data).map_err(|e| e.to_string())?;
            crate::conf::save(&conf)?;
            serde_json::to_value(&conf).map_err(|e| e.to_string())
        }
        "find_search_by_type" => {
            let search_type = message
                .get("searchType")
                .and_then(Value::as_i64)
                .unwrap_or(0);
            let conn = state.db.lock().unwrap();
            crate::search::find_search_by_type(&conn, search_type)
        }
        "search_command_by_code" => {
            let code = message
                .get("code")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let conn = state.db.lock().unwrap();
            crate::search::search_command_by_code(&conn, &code)
        }
        "get_local_ip" => get_local_ip().await,
        // 托盘自绘菜单的两个动作（菜单浮窗经 v1_ipc 调用）
        "show_main_window" => {
            crate::show_main(app);
            Ok(Value::Null)
        }
        "quit_app" => {
            eprintln!("[tray] quit requested from menu");
            app.exit(0);
            Ok(Value::Null)
        }
        // 桌面专注挂件：可见性只存在运行时，重启后默认隐藏
        "focus_widget_visible" => Ok(json!(crate::focus_widget_visible(app))),
        "focus_widget_show" => {
            crate::show_focus_widget(app);
            Ok(json!(notify_widget_visibility(app, state)))
        }
        "focus_widget_hide" => {
            crate::hide_focus_widget(app);
            Ok(json!(notify_widget_visibility(app, state)))
        }
        "focus_widget_toggle" => {
            if crate::focus_widget_visible(app) {
                crate::hide_focus_widget(app);
            } else {
                crate::show_focus_widget(app);
            }
            Ok(json!(notify_widget_visibility(app, state)))
        }
        // 挂件尺寸随内容变化：前端量出卡片宽高回传
        "focus_widget_resize" => {
            let width = message.get("width").and_then(Value::as_f64).unwrap_or(272.0);
            let height = message.get("height").and_then(Value::as_f64).unwrap_or(80.0);
            crate::resize_focus_widget(app, width, height);
            Ok(Value::Null)
        }
        // 挂件拖动：卡片空白处按下左键时由前端触发
        "focus_widget_drag" => {
            crate::drag_focus_widget(app);
            Ok(Value::Null)
        }
        "plugin:autostart|enable" => {
            use tauri_plugin_autostart::ManagerExt;
            app.autolaunch().enable().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "plugin:autostart|disable" => {
            use tauri_plugin_autostart::ManagerExt;
            app.autolaunch().disable().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "plugin:autostart|is_enabled" => {
            use tauri_plugin_autostart::ManagerExt;
            Ok(json!(app.autolaunch().is_enabled().unwrap_or(false)))
        }
        "plugin:clipboard|read_image" => {
            let s = tauri::async_runtime::spawn_blocking(|| -> Result<String, String> {
                let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
                match cb.get_image() {
                    Ok(img) => {
                        let mut png_bytes: Vec<u8> = Vec::new();
                        {
                            let mut encoder = png::Encoder::new(
                                &mut png_bytes,
                                img.width as u32,
                                img.height as u32,
                            );
                            encoder.set_color(png::ColorType::Rgba);
                            encoder.set_depth(png::BitDepth::Eight);
                            let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
                            writer
                                .write_image_data(&img.bytes)
                                .map_err(|e| e.to_string())?;
                        }
                        use base64::Engine;
                        Ok(base64::engine::general_purpose::STANDARD.encode(&png_bytes))
                    }
                    Err(_) => Ok(String::new()),
                }
            })
            .await
            .map_err(|e| e.to_string())??;
            Ok(json!(s))
        }
        "plugin:clipboard|write_image" => {
            let b64 = message
                .get("base64Image")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
                use base64::Engine;
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(b64.trim())
                    .map_err(|e| e.to_string())?;
                let decoder = png::Decoder::new(std::io::Cursor::new(&bytes));
                let mut reader = decoder.read_info().map_err(|e| e.to_string())?;
                let mut buf = vec![0u8; reader.output_buffer_size()];
                let info = reader.next_frame(&mut buf).map_err(|e| e.to_string())?;
                let rgba: Vec<u8> = match info.color_type {
                    png::ColorType::Rgba => buf[..info.buffer_size()].to_vec(),
                    png::ColorType::Rgb => buf[..info.buffer_size()]
                        .chunks(3)
                        .flat_map(|c| [c[0], c[1], c[2], 255])
                        .collect(),
                    _ => return Err("unsupported png color type".into()),
                };
                let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
                cb.set_image(arboard::ImageData {
                    width: info.width as usize,
                    height: info.height as usize,
                    bytes: rgba.into(),
                })
                .map_err(|e| e.to_string())?;
                Ok(())
            })
            .await
            .map_err(|e| e.to_string())??;
            Ok(Value::Null)
        }
        "open_plugin_tool" => open_plugin_tool_window(app, message),
        "add_search" | "set_search_state_by_code" | "update_command_sort"
        | "delete_command_by_id" => {
            let conn = state.db.lock().unwrap();
            let r = match cmd {
                "add_search" => crate::search::add_search(&conn, message),
                "set_search_state_by_code" => crate::search::set_search_state_by_code(&conn, message),
                "update_command_sort" => crate::search::update_command_sort(&conn, message),
                "delete_command_by_id" => crate::search::delete_command_by_id(&conn, message),
                _ => unreachable!(),
            };
            r.map(|_| json!(true))
        }
        other => {
            let m = format!("command {other} not found");
            eprintln!("[v1_ipc] {m}");
            Err(m)
        }
    }
}

/// 插件工具子窗口：统一加载 next/tool.html，插件 ID 由初始化脚本注入。
///
/// 无原生边框、透明，圆角由前端 .window-shell 绘制，尺寸按插件单独设计；
/// 窗口可拉伸，最小尺寸兜底。
///
/// 外形尺寸额外加 SHADOW_ROOM×2：前端 .window-stage 用这圈透明留白画外阴影，
/// 保证插件设计尺寸仍完整留给界面，叠窗时阴影也能压在下一层窗口上。
const TOOL_WINDOW_SHADOW_ROOM: f64 = 16.0;

fn open_plugin_tool_window(app: &AppHandle, message: &Value) -> Result<Value, String> {
    let tool_id = message
        .get("toolId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if tool_id.is_empty()
        || tool_id.len() > 64
        || !tool_id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err("invalid tool id".into());
    }
    let width = message
        .get("width")
        .and_then(Value::as_f64)
        .unwrap_or(720.0)
        .clamp(380.0, 1600.0);
    let height = message
        .get("height")
        .and_then(Value::as_f64)
        .unwrap_or(560.0)
        .clamp(320.0, 1200.0);
    let title = message
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("工具")
        .to_string();
    let label = format!("plugin_{tool_id}");

    // 同一工具只留一个窗口：重复点击时把已有窗口拉到前面
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(Value::Null);
    }

    let mut labels: Vec<String> = app.webview_windows().keys().cloned().collect();
    labels.push(label.clone());
    let mut inject = crate::inject_script(&label, &labels);
    let id_json = serde_json::to_string(&tool_id).map_err(|e| e.to_string())?;
    inject.push_str(&format!("\nwindow.__MATCHA_TOOL_ID__ = {id_json};"));

    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("next/tool.html".into()))
        .title(title)
        .inner_size(
            width + TOOL_WINDOW_SHADOW_ROOM * 2.0,
            height + TOOL_WINDOW_SHADOW_ROOM * 2.0,
        )
        .min_inner_size(
            420.0 + TOOL_WINDOW_SHADOW_ROOM * 2.0,
            360.0 + TOOL_WINDOW_SHADOW_ROOM * 2.0,
        )
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(true)
        .minimizable(true)
        .maximizable(true)
        .center()
        .data_directory(crate::webview_data_dir())
        .initialization_script(inject)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(Value::Null)
}

async fn get_local_ip() -> Result<Value, String> {
    let list = tauri::async_runtime::spawn_blocking(enum_local_ips)
        .await
        .map_err(|e| e.to_string())?;
    let s = serde_json::to_string(&list).map_err(|e| e.to_string())?;
    Ok(json!(s))
}

fn enum_local_ips() -> Vec<Value> {
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        GetAdaptersAddresses, IP_ADAPTER_ADDRESSES_LH,
    };
    use windows_sys::Win32::Networking::WinSock::{AF_INET, AF_INET6, AF_UNSPEC, SOCKADDR_IN, SOCKADDR_IN6};

    fn wide_to_string(p: *const u16) -> String {
        if p.is_null() {
            return String::new();
        }
        let mut len = 0usize;
        unsafe {
            while *p.add(len) != 0 {
                len += 1;
            }
            String::from_utf16_lossy(std::slice::from_raw_parts(p, len))
        }
    }

    let mut out: Vec<Value> = Vec::new();
    unsafe {
        let mut size: u32 = 16 * 1024;
        let mut buf: Vec<u8>;
        loop {
            buf = vec![0u8; size as usize];
            let ret = GetAdaptersAddresses(
                AF_UNSPEC as u32,
                0,
                std::ptr::null(),
                buf.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH,
                &mut size,
            );
            if ret == 0 {
                break;
            }
            if ret == 111 {
                continue;
            }
            return out;
        }
        let mut cur = buf.as_ptr() as *const IP_ADAPTER_ADDRESSES_LH;
        while !cur.is_null() {
            let name = wide_to_string((*cur).FriendlyName);
            let mut ua = (*cur).FirstUnicastAddress;
            while !ua.is_null() {
                let sa_ptr = (*ua).Address.lpSockaddr;
                if !sa_ptr.is_null() {
                    let family = (*sa_ptr).sa_family;
                    if family == AF_INET {
                        let sa = sa_ptr as *const SOCKADDR_IN;
                        let b = (*sa).sin_addr.S_un.S_addr.to_le_bytes();
                        let ip = std::net::Ipv4Addr::new(b[0], b[1], b[2], b[3]);
                        out.push(json!([name.clone(), ip.to_string()]));
                    } else if family == AF_INET6 {
                        let sa = sa_ptr as *const SOCKADDR_IN6;
                        let ip = std::net::Ipv6Addr::from((*sa).sin6_addr.u.Byte);
                        out.push(json!([name.clone(), ip.to_string()]));
                    }
                }
                ua = (*ua).Next;
            }
            cur = (*cur).Next;
        }
    }
    out
}

fn shell_module(
    app: &AppHandle,
    state: &State<'_, AppState>,
    msg: &Value,
) -> Result<Value, String> {
    let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or("");
    match cmd {
        "execute" => {
            let program = msg.get("program").and_then(Value::as_str).unwrap_or("");
            let args: Vec<String> = msg
                .get("args")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();
            let options = msg.get("options").cloned().unwrap_or(json!({}));
            let on_event = msg.get("onEventFn").and_then(Value::as_u64);
            let caller = msg
                .get("__callerLabel")
                .and_then(Value::as_str)
                .unwrap_or("main")
                .to_string();

            let mut command = if program.is_empty() {
                let mut c = std::process::Command::new(args.first().cloned().unwrap_or_default());
                c.args(args.iter().skip(1));
                c
            } else {
                let mut c = std::process::Command::new(program);
                c.args(&args);
                c
            };
            if let Some(cwd) = options.get("cwd").and_then(Value::as_str) {
                command.current_dir(cwd);
            }
            if let Some(envs) = options.get("env").and_then(Value::as_object) {
                for (k, v) in envs {
                    if let Some(s) = v.as_str() {
                        command.env(k, s);
                    }
                }
            }
            command
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped());
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            if options.get("wait").and_then(Value::as_bool).unwrap_or(false) {
                let output = command.output().map_err(|e| e.to_string())?;
                return Ok(json!({
                    "status": output.status.code(),
                    "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
                    "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
                }));
            }
            let mut child = command.spawn().map_err(|e| e.to_string())?;
            let pid = child.id();
            let stdin = child.stdin.take();
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let emit: std::sync::Arc<dyn Fn(&str, Value) + Send + Sync> = {
                let app = app.clone();
                let caller = caller.clone();
                std::sync::Arc::new(move |event: &str, payload: Value| {
                    if let Some(id) = on_event {
                        if let Some(w) = app.get_webview_window(&caller) {
                            let js = format!(
                                "window[\"_{id}\"] && window[\"_{id}\"]({})",
                                json!({"event": event, "payload": payload})
                            );
                            let _ = w.eval(&js);
                        }
                    }
                })
            };
            if let Some(mut s) = stdout {
                let emit = emit.clone();
                std::thread::spawn(move || {
                    use std::io::Read;
                    let mut buf = [0u8; 8192];
                    loop {
                        match s.read(&mut buf) {
                            Ok(0) | Err(_) => break,
                            Ok(n) => emit(
                                "Stdout",
                                json!(String::from_utf8_lossy(&buf[..n]).to_string()),
                            ),
                        }
                    }
                });
            }
            if let Some(mut s) = stderr {
                let emit = emit.clone();
                std::thread::spawn(move || {
                    use std::io::Read;
                    let mut buf = [0u8; 8192];
                    loop {
                        match s.read(&mut buf) {
                            Ok(0) | Err(_) => break,
                            Ok(n) => emit(
                                "Stderr",
                                json!(String::from_utf8_lossy(&buf[..n]).to_string()),
                            ),
                        }
                    }
                });
            }
            let child_arc = std::sync::Arc::new(Mutex::new(child));
            state.children.lock().unwrap().insert(
                pid,
                ChildHandle {
                    child: child_arc.clone(),
                    stdin: std::sync::Arc::new(Mutex::new(stdin)),
                },
            );
            let children = state.children.clone();
            let emit_end = emit.clone();
            std::thread::spawn(move || loop {
                let status = {
                    let mut ch = child_arc.lock().unwrap();
                    ch.try_wait()
                };
                match status {
                    Ok(Some(st)) => {
                        emit_end("Terminated", json!({"code": st.code(), "signal": Value::Null}));
                        children.lock().unwrap().remove(&pid);
                        break;
                    }
                    Ok(None) => std::thread::sleep(std::time::Duration::from_millis(80)),
                    Err(_) => {
                        children.lock().unwrap().remove(&pid);
                        break;
                    }
                }
            });
            Ok(json!(pid))
        }
        "killChild" => {
            let pid = msg.get("pid").and_then(Value::as_u64).unwrap_or(0) as u32;
            if let Some(h) = state.children.lock().unwrap().get(&pid) {
                let _ = h.child.lock().unwrap().kill();
            }
            Ok(Value::Null)
        }
        "stdinWrite" => {
            let pid = msg.get("pid").and_then(Value::as_u64).unwrap_or(0) as u32;
            let buffer = msg.get("buffer");
            if let Some(h) = state.children.lock().unwrap().get(&pid) {
                use std::io::Write;
                let bytes: Vec<u8> = match buffer {
                    Some(Value::String(s)) => s.as_bytes().to_vec(),
                    Some(Value::Array(a)) => {
                        a.iter().filter_map(|v| v.as_u64().map(|b| b as u8)).collect()
                    }
                    _ => vec![],
                };
                if let Some(stdin) = h.stdin.lock().unwrap().as_mut() {
                    let _ = stdin.write_all(&bytes);
                }
            }
            Ok(Value::Null)
        }
        "open" => {
            let path = msg.get("path").and_then(Value::as_str).unwrap_or("");
            crate::shell_open(path);
            Ok(Value::Null)
        }
        other => Err(format!("[Shell] not implemented: {other}")),
    }
}

async fn dialog_module(msg: &Value) -> Result<Value, String> {
    let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or("").to_string();
    let options = msg.get("options").cloned().unwrap_or(json!({}));
    tauri::async_runtime::spawn_blocking(move || -> Result<Value, String> {
        let mut dialog = rfd::FileDialog::new();
        if let Some(title) = options.get("title").and_then(Value::as_str) {
            dialog = dialog.set_title(title);
        }
        if let Some(filters) = options.get("filters").and_then(Value::as_array) {
            for f in filters {
                let name = f.get("name").and_then(Value::as_str).unwrap_or("filter");
                let exts: Vec<&str> = f
                    .get("extensions")
                    .and_then(Value::as_array)
                    .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
                    .unwrap_or_default();
                dialog = dialog.add_filter(name, &exts);
            }
        }
        if let Some(dp) = options.get("defaultPath").and_then(Value::as_str) {
            let p = std::path::Path::new(dp);
            if let Some(parent) = p.parent() {
                dialog = dialog.set_directory(parent);
            }
            if let Some(name) = p.file_name() {
                dialog = dialog.set_file_name(name.to_string_lossy().to_string());
            }
        }
        match cmd.as_str() {
            "openDialog" => {
                let directory = options
                    .get("directory")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                let multiple = options
                    .get("multiple")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                if directory {
                    Ok(dialog
                        .pick_folder()
                        .map(|p| json!(p.to_string_lossy()))
                        .unwrap_or(Value::Null))
                } else if multiple {
                    match dialog.pick_files() {
                        Some(paths) => Ok(json!(paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect::<Vec<_>>())),
                        None => Ok(Value::Null),
                    }
                } else {
                    Ok(dialog
                        .pick_file()
                        .map(|p| json!(p.to_string_lossy()))
                        .unwrap_or(Value::Null))
                }
            }
            "saveDialog" => Ok(dialog
                .save_file()
                .map(|p| json!(p.to_string_lossy()))
                .unwrap_or(Value::Null)),
            other => Err(format!("[Dialog] not implemented: {other}")),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
