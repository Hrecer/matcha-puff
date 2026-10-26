#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod conf;
mod db;
mod focus;
mod ipc;
mod search;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::tray::{MouseButton, TrayIconBuilder};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

pub fn inject_script(label: &str, labels: &[String]) -> String {
    let windows_json = serde_json::to_string(labels).unwrap_or_else(|_| "[]".into());
    include_str!("inject.js")
        .replace("__WINDOW_LABEL__", label)
        .replace("__WINDOWS_JSON__", &windows_json)
}

pub fn webview_data_dir() -> std::path::PathBuf {
    db::data_dir().join("EBWebView")
}

/// 透明托盘窗在部分 Windows 环境下首次显示仍会带原生标题栏，
/// Tauri 的 decorations(false) 对它会失效。这里直接剥掉 Win32 边框样式，
/// 让客户区等于窗口尺寸（否则 160×112 的窗客户区只剩 218×112 物理，第三行被挤掉）。
#[cfg(target_os = "windows")]
fn strip_native_frame(w: &tauri::WebviewWindow) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_STYLE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_BORDER, WS_CAPTION,
        WS_MAXIMIZEBOX, WS_MINIMIZEBOX, WS_SYSMENU, WS_THICKFRAME,
    };
    let Ok(hwnd) = w.hwnd() else {
        return;
    };
    let hwnd = hwnd.0 as *mut core::ffi::c_void;
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let mask = WS_CAPTION
            | WS_THICKFRAME
            | WS_MINIMIZEBOX
            | WS_MAXIMIZEBOX
            | WS_SYSMENU
            | WS_BORDER;
        SetWindowLongPtrW(hwnd, GWL_STYLE, (style & !mask) as isize);
        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

/// 托盘右键菜单（自绘浮窗）。原生 Win32 菜单无法定制：无圆角、白边框、

/// 尺寸 160×212：最多六行等高（32px） + 两条分隔线 + 双层 4px 内边距。
/// 休息态（运行或暂停）是六行：显示窗口、暂停/继续休息、跳过休息、停止休息、挂件开关、退出；
/// 其他状态少一行「跳过休息」，剩余高度会均分给各行，视觉上只差几像素。
fn create_tray_menu_window(app: &tauri::AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let w = WebviewWindowBuilder::new(app, "traymenu", WebviewUrl::App("next/tray.html".into()))
        .title("")
        .inner_size(160.0, 212.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .maximizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .data_directory(webview_data_dir())
        .initialization_script(inject_script("traymenu", &["traymenu".to_string()]))
        .build()?;
    // 见 strip_native_frame：仅靠 decorations(false) 不够，必须再剥一次 Win32 边框。
    let _ = w.set_decorations(false);
    #[cfg(target_os = "windows")]
    strip_native_frame(&w);
    Ok(w)
}

/// 在托盘图标上方弹出菜单浮窗：以光标为锚，水平居中、底边距光标 8px，
/// 并夹回所在监视器范围内。position 是托盘事件给的光标物理坐标。
fn show_tray_menu(app: &tauri::AppHandle, cursor: tauri::PhysicalPosition<f64>) {
    let Some(w) = app.get_webview_window("traymenu") else {
        return;
    };
    let Ok(outer) = w.outer_size() else {
        return;
    };
    let pw = outer.width as f64;
    let ph = outer.height as f64;
    let mut x = cursor.x - pw / 2.0;
    let mut y = cursor.y - ph - 8.0;
    let mon = w
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| w.primary_monitor().ok().flatten());
    if let Some(mon) = mon {
        let (mp, ms) = (mon.position(), mon.size());
        x = x.clamp(mp.x as f64, mp.x as f64 + ms.width as f64 - pw);
        y = y.max(mp.y as f64);
    }
    let _ = w.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
    let _ = w.show();
    let _ = w.set_focus();
    // 菜单收起时页面被挂起，可能漏掉专注相位变化；弹出来后先对一次真状态
    if let Some(state) = app.try_state::<ipc::AppState>() {
        ipc::broadcast_focus_snapshot(app, state.inner());
    }
}

/// 桌面专注挂件：无边框、置顶、不占任务栏的小浮窗，显示当前计时。
fn create_focus_widget(app: &tauri::AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let w = WebviewWindowBuilder::new(app, "widget", WebviewUrl::App("next/widget.html".into()))
        .title("专注挂件")
        .inner_size(272.0, WIDGET_CARD_H + WIDGET_PAD_TOP + WIDGET_PAD_BOTTOM)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        // 浮窗不抢焦点：显示它不能打断用户正在操作的窗口
        .focused(false)
        .data_directory(webview_data_dir())
        .initialization_script(inject_script("widget", &["widget".to_string()]))
        .build()?;
    let _ = w.set_decorations(false);
    #[cfg(target_os = "windows")]
    strip_native_frame(&w);
    Ok(w)
}

/// 挂件落点：固定在主屏上方居中。
///
/// 只在从隐藏变为显示时摆一次；显示之后位置归用户，拖动过就停在用户放下的地方。
fn place_focus_widget(app: &tauri::AppHandle) {
    let Some(w) = app.get_webview_window("widget") else {
        return;
    };
    let Ok(outer) = w.outer_size() else {
        return;
    };
    let Some(mon) = w.primary_monitor().ok().flatten() else {
        return;
    };
    let (mp, ms) = (mon.position(), mon.size());
    let x = mp.x + (ms.width as i32 - outer.width as i32) / 2;
    // 卡片外围是画阴影 / 画提示的透明留白，摆位时扣掉，让看得见的边缘正好离 GAP
    let scale = w.scale_factor().unwrap_or(1.0);
    let pad_top = (WIDGET_PAD_TOP * scale).round() as i32;
    let y = mp.y + WIDGET_EDGE_GAP - pad_top;
    let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
}

/// 挂件与屏幕上边缘的间距（留出顶部呼吸空间）
const WIDGET_EDGE_GAP: i32 = 72;
/// 卡片本身的固定高度，与前端 h-[52px] 一致
const WIDGET_CARD_H: f64 = 52.0;
/// 卡片底部画阴影的透明留白，与前端 PAD_BOTTOM 一致
const WIDGET_PAD_BOTTOM: f64 = 16.0;
/// 顶部额外留白：提示浮层画在卡片上方，留白不够会被窗口上沿削掉；
/// 与前端 PAD_TOP 一致，按两行提示预留
const WIDGET_PAD_TOP: f64 = 56.0;

/// 拖动期间挂起的尺寸请求（CSS 像素）。拖动时窗口几何归光标跟踪循环，
/// 这时再按帧改尺寸/位置会和它打架，画面就会闪；等松手后一次性应用。
static PENDING_WIDGET_SIZE: Mutex<Option<(f64, f64)>> = Mutex::new(None);
static WIDGET_SIZE_APPLIER_RUNNING: AtomicBool = AtomicBool::new(false);

/// 同一时间只允许一个拖动循环
static WIDGET_DRAG_ACTIVE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
fn primary_button_down() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    // VK_LBUTTON
    unsafe { (GetAsyncKeyState(0x01) as u16 & 0x8000) != 0 }
}

#[cfg(not(target_os = "windows"))]
fn primary_button_down() -> bool {
    false
}

#[cfg(target_os = "windows")]
fn cursor_pos() -> Option<(i32, i32)> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
    let mut point = POINT { x: 0, y: 0 };
    (unsafe { GetCursorPos(&mut point) } != 0).then_some((point.x, point.y))
}

#[cfg(not(target_os = "windows"))]
fn cursor_pos() -> Option<(i32, i32)> {
    None
}

/// 尺寸跟着卡片内容走：前端量完回传（CSS 像素），这里换算成物理像素后重设。
///
/// 宽度变化时保持水平中心不动；高度变化时贴住"靠屏幕那一边"——
/// 下半屏固定下沿、上半屏固定上沿，免得长高时把卡片顶出屏幕。
pub fn resize_focus_widget(app: &tauri::AppHandle, width: f64, height: f64) {
    // 正在拖动：窗口位置由光标跟踪循环负责，先记下目标尺寸，松手再说
    if primary_button_down() {
        *PENDING_WIDGET_SIZE.lock().unwrap() = Some((width, height));
        spawn_deferred_widget_resize(app.clone());
        return;
    }
    apply_focus_widget_size(app, width, height);
}

fn apply_focus_widget_size(app: &tauri::AppHandle, width: f64, height: f64) {
    let Some(w) = app.get_webview_window("widget") else {
        return;
    };
    let Ok(size) = w.outer_size() else {
        return;
    };
    // 前端给的是 CSS 像素；窗口尺寸是物理像素，必须乘缩放比，否则高 DPI 下会算窄
    let scale = w.scale_factor().unwrap_or(1.0);
    let target_w = (width.clamp(150.0, 560.0) * scale).round() as u32;
    let target_h = (height.clamp(70.0, 220.0) * scale).round() as u32;
    if target_w == size.width && target_h == size.height {
        return;
    }
    let Ok(pos) = w.outer_position() else {
        return;
    };
    let center = pos.x + size.width as i32 / 2;
    // 判断贴着哪一边：窗口中线在屏幕中线之下就以下沿为锚点
    let middle = w
        .current_monitor()
        .ok()
        .flatten()
        .map(|m| m.position().y + m.size().height as i32 / 2)
        .unwrap_or(pos.y);
    let anchor_bottom = pos.y + size.height as i32 / 2 > middle;
    let new_y = if anchor_bottom {
        pos.y + size.height as i32 - target_h as i32
    } else {
        pos.y
    };
    let _ = w.set_size(tauri::PhysicalSize::new(target_w, target_h));
    let _ = w.set_position(tauri::PhysicalPosition::new(
        center - target_w as i32 / 2,
        new_y,
    ));
}

/// 拖动结束后把挂起的最后一次尺寸请求应用到窗口。
/// 只允许一个等待线程：尺寸动画逐帧回传，没必要每帧起一个。
fn spawn_deferred_widget_resize(app: tauri::AppHandle) {
    if WIDGET_SIZE_APPLIER_RUNNING.swap(true, Ordering::AcqRel) {
        return;
    }
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(40));
        // 拖动可能持续很久：只要还按着就继续等
        if primary_button_down() {
            continue;
        }
        if let Some((width, height)) = PENDING_WIDGET_SIZE.lock().unwrap().take() {
            let handle = app.clone();
            let inner = handle.clone();
            let _ = handle.run_on_main_thread(move || {
                // 排队期间可能又按下了：重新挂起，别在拖动中改几何
                if primary_button_down() {
                    *PENDING_WIDGET_SIZE.lock().unwrap() = Some((width, height));
                    spawn_deferred_widget_resize(inner.clone());
                    return;
                }
                apply_focus_widget_size(&inner, width, height);
            });
        }
        WIDGET_SIZE_APPLIER_RUNNING.store(false, Ordering::Release);
        // 松手瞬间最后一帧的请求可能刚好插进来：有就再跑一轮
        if PENDING_WIDGET_SIZE.lock().unwrap().is_some()
            && !WIDGET_SIZE_APPLIER_RUNNING.swap(true, Ordering::AcqRel)
        {
            continue;
        }
        break;
    });
}

/// 拖动挂件：前端在卡片空白处按下左键时调用。
///
/// 不用系统原生拖动循环：它会把整窗约束在屏幕内，卡片顶部会被 56px 的
/// 提示留白顶住，松手前像有弹性一样弹回去。这里按全局光标位移直接移动
/// 窗口，位置完全由用户决定；左键松开即结束。
pub fn drag_focus_widget(app: &tauri::AppHandle) {
    let Some(w) = app.get_webview_window("widget") else {
        return;
    };
    if WIDGET_DRAG_ACTIVE.swap(true, Ordering::AcqRel) {
        return;
    }
    let Some((start_cx, start_cy)) = cursor_pos() else {
        WIDGET_DRAG_ACTIVE.store(false, Ordering::Release);
        return;
    };
    let Ok(start_pos) = w.outer_position() else {
        WIDGET_DRAG_ACTIVE.store(false, Ordering::Release);
        return;
    };
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(10));
            let Some(w) = app.get_webview_window("widget") else {
                break;
            };
            // 先按当前光标落位，再判断是否松手：松手这一刻的位置不会少最后一帧
            let Some((cx, cy)) = cursor_pos() else {
                break;
            };
            let _ = w.set_position(tauri::PhysicalPosition::new(
                start_pos.x + (cx - start_cx),
                start_pos.y + (cy - start_cy),
            ));
            if !primary_button_down() {
                break;
            }
        }
        WIDGET_DRAG_ACTIVE.store(false, Ordering::Release);
    });
}

pub fn show_focus_widget(app: &tauri::AppHandle) {
    if app.get_webview_window("widget").is_none() {
        let _ = create_focus_widget(app);
    }
    let Some(w) = app.get_webview_window("widget") else {
        return;
    };
    // 已经显示就别再摆位：用户可能刚把它拖到顺手的位置
    if w.is_visible().unwrap_or(false) {
        return;
    }
    place_focus_widget(app);
    let _ = w.show();
    // 挂件不抢焦点，收不到窗口 focus 兜底；隐藏期间漏掉的相位在这里补齐
    if let Some(state) = app.try_state::<ipc::AppState>() {
        ipc::broadcast_focus_snapshot(app, state.inner());
    }
}

/// 挂件是否正在显示。可见性不落盘，重启后一律从隐藏开始。
pub fn focus_widget_visible(app: &tauri::AppHandle) -> bool {
    app.get_webview_window("widget")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

pub fn hide_focus_widget(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("widget") {
        let _ = w.hide();
    }
}

pub fn shell_open(url: &str) {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    let op: Vec<u16> = "open\0".encode_utf16().collect();
    let u: Vec<u16> = format!("{url}\0").encode_utf16().collect();
    unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            op.as_ptr(),
            u.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        );
    }
}

/// 构建主窗口。setup 时创建一次；窗口被销毁后（如用户关闭）托盘再唤起时重建。
fn create_main_window(app: &tauri::AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let w = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("next/index.html".into()))
        .title("抹茶泡芙")
        .inner_size(1180.0, 780.0)
        .min_inner_size(960.0, 620.0)
        // 关掉原生标题栏：界面由前端沉浸式标题栏承载（拖拽区 + 窗口按钮）。
        // 此前没关 decorations，原生标题栏与自定义页头同时存在，就是「双层导航栏」。
        .decorations(false)
        // 透明窗 + 前端 CSS 圆角（26px，与侧栏大面板一致）：窗口四角露出桌面，
        // 圆角幅度与 --radius-glass 对齐；最大化时由前端把圆角归零。
        .transparent(true)
        // 系统阴影按矩形窗画，会在 CSS 圆角四角漏出方角痕迹；外阴影由前端画。
        .shadow(false)
        .data_directory(webview_data_dir())
        .initialization_script(inject_script("main", &["main".to_string()]))
        .build()?;
    Ok(w)
}

/// 主窗口显示：不存在则重建；存在则恢复并聚焦。
///
/// 覆盖两种情况：窗口已被销毁（重建后显示）和被最小化或压在别的普通窗口后面（恢复并聚焦）。
pub fn show_main(app: &tauri::AppHandle) {
    let Some(w) = app.get_webview_window("main") else {
        // 窗口已销毁：重建后再聚焦
        eprintln!("[tray] main window missing, recreating");
        if let Ok(w) = create_main_window(app) {
            let _ = w.show();
            let _ = w.set_focus();
        }
        return;
    };
    let _ = w.unminimize();
    let _ = w.show();
    // 只到普通层就够：show / 聚焦本来就会把主窗拉到最前。
    // 不能临时置顶 —— 挂件是常驻顶层的（设计如此），主窗一旦进顶层就会把
    // 挂件压到身后，等置顶撤销才弹回来。挂件之上永远不该有本应用的主窗。
    let _ = w.set_focus();
}

fn main() {
    // 通知归属：Windows 靠 AppUserModelID 判断「这条通知是谁发的」。
    // 进程没有显式身份时系统会回退到 PowerShell 宿主，通知就显示成
    // 「Windows PowerShell」外加 PowerShell 图标。这里用与 tauri identifier 同一个 id，
    // 正式安装包的快捷方式也带这个 AUMID，通知才能正确归到抹茶泡芙名下。
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
        let app_id: Vec<u16> = "com.matchapuff.desktop\0".encode_utf16().collect();
        unsafe {
            let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
        }
    }

    // DPI：保持 Tauri 默认 PerMonitor 感知（文字原生分辨率渲染，不再位图拉伸发虚），
    // 详见上方 DPI 口径注释。

    tauri::Builder::default()
        // 单实例必须最先注册：第二次启动时直接把已有窗口唤到前面，然后退出。
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![ipc::v1_ipc])
        .setup(|app| {
            // 先定数据目录，再开库、建窗：安装版的数据必须落在用户目录，
            // 不能跟着安装目录走（否则卸载/覆盖安装会把数据一起删掉）。
            db::init_app_data_dir(app.handle());
            let conn = db::init().map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(ipc::AppState::new(conn));

            // 计时内核在 Rust 线程里走：窗口隐藏/最小化也不会被 WebView2 节流。
            focus::spawn_ticker(app.handle().clone());

            // 【界面切换】主窗口指向 React 版产物（../frontend/next/）。
            // 根目录另有一套页面，工具窗口的 /tool/<url> 由它接住。
            // 独立搜索浮窗已删除：搜索能力并入工作台。
            let main_win = create_main_window(app.handle())?;

            // ── 托盘右键菜单（自绘浮窗，替代原生 Win32 菜单）────────────
            let tray_menu = create_tray_menu_window(app.handle())?;
            {
                let w = tray_menu.clone();
                tray_menu.on_window_event(move |event| {
                    // 点击别处（失焦）即收起，与原生菜单行为一致
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = w.hide();
                    }
                });
            }

            // ── 桌面专注挂件：先建好（隐藏），由专注页 / 芯片 / 托盘打开 ────
            let widget = create_focus_widget(app.handle())?;
            {
                let w = widget.clone();
                widget.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            // 关闭一律隐藏：这是托盘常驻应用的语义。销毁窗口会让托盘的
            // 「显示窗口 / 左键唤起」变成死状态（窗口拿不回来）。退出走托盘菜单。
            {
                let w = main_win.clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });
            }

            // 菜单交给自绘浮窗：左键唤主窗，右键弹菜单（顺序：显示窗口 → 搜索工具 → 退出）
            TrayIconBuilder::with_id("tray")
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../resources/tray.png"
                ))?)
                .tooltip("抹茶泡芙")
                // 左键点击托盘：直接唤出主窗口。
                // Click 在部分平台/版本于按下即触发，这里不区分 Up/Down，加 500ms 防抖。
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button,
                        position,
                        ..
                    } = event
                    {
                        match button {
                            MouseButton::Left => {
                                use std::sync::atomic::{AtomicU64, Ordering};
                                static LAST_MS: AtomicU64 = AtomicU64::new(0);
                                let now = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_millis() as u64)
                                    .unwrap_or(0);
                                let last = LAST_MS.load(Ordering::Relaxed);
                                if now.saturating_sub(last) < 500 {
                                    return;
                                }
                                LAST_MS.store(now, Ordering::Relaxed);
                                eprintln!("[tray] left click -> show_main");
                                show_main(tray.app_handle());
                            }
                            MouseButton::Right => {
                                eprintln!("[tray] right click -> menu");
                                show_tray_menu(tray.app_handle(), position);
                            }
                            _ => {}
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
