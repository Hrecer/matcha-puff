//! 护眼遮罩：给每个显示器铺一层琥珀色半透明置顶层。
//!
//! 用原生分层窗口而不是再开一个 WebView 窗：每多一个 WebView 实例就多一份渲染进程，
//! 多屏还要翻倍；纯 Win32 窗口零额外开销，和系统合成器直接对接。
//!
//! 窗口归一个专用线程所有（窗口有线程亲和性），那个线程自己抽消息，
//! 否则窗口收不到 WM_PAINT / WM_ERASEBKGND，客户区就不会被背景刷填色。
//! 主线程只改共享配置，再敲一下通道让渲染线程立刻重算，不用等下一次轮询。

use serde::{Deserialize, Serialize};
use std::sync::mpsc::Sender;
use std::sync::Mutex;
use std::time::Duration;

/// 遮罩色：琥珀 RGB(255,184,92)。COLORREF 是 0x00BBGGRR，所以字节序要倒着写。
const OVERLAY_COLOR: u32 = 0x005C_B8FF;

/// 渲染线程的轮询周期。定时时段的边界最多晚这么久生效，代价可以忽略。
const TICK: Duration = Duration::from_millis(1000);

const DEFAULT: EyeCareConf = EyeCareConf {
    enabled: false,
    strength: 2,
    mode: Mode::Always,
    start_minute: 1080,
    end_minute: 360,
};

static CONF: Mutex<EyeCareConf> = Mutex::new(DEFAULT);
static WAKE: Mutex<Option<Sender<()>>> = Mutex::new(None);

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// 一直生效
    Always,
    /// 只在设定时段内生效
    Scheduled,
}

impl Default for Mode {
    fn default() -> Self {
        Mode::Always
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct EyeCareConf {
    /// 是否开启遮罩
    pub enabled: bool,
    /// 浓度档位 1..=5
    pub strength: i32,
    /// 持续开启 / 定时开启
    pub mode: Mode,
    /// 定时开始（当天第几分钟）
    pub start_minute: i32,
    /// 定时结束（当天第几分钟，可小于开始时间表示跨午夜）
    pub end_minute: i32,
}

impl Default for EyeCareConf {
    fn default() -> Self {
        DEFAULT
    }
}

impl EyeCareConf {
    pub fn normalize(&mut self) {
        self.strength = self.strength.clamp(1, 5);
        self.start_minute = clamp_minute(self.start_minute, DEFAULT.start_minute);
        self.end_minute = clamp_minute(self.end_minute, DEFAULT.end_minute);
    }
}

fn clamp_minute(value: i32, fallback: i32) -> i32 {
    if (0..1440).contains(&value) {
        value
    } else {
        fallback
    }
}

/// 档位 → 不透明度（0..=255）。数值偏小是刻意的：遮罩只做轻微的暖色偏移，
/// 压太高会明显发黄，反而更累眼。
pub fn alpha_of(strength: i32) -> u8 {
    match strength {
        1 => 8,
        2 => 13,
        3 => 18,
        4 => 23,
        5 => 28,
        _ => 13,
    }
}

/// 某一时刻是否落在时段内。开始晚于结束时表示跨午夜，两侧各算一段。
pub fn active_at(minute: i32, start: i32, end: i32) -> bool {
    if start <= end {
        minute >= start && minute < end
    } else {
        minute >= start || minute < end
    }
}

/// 当前配置下这一刻该不该铺遮罩。
pub fn should_show(conf: &EyeCareConf, minute: i32) -> bool {
    if !conf.enabled {
        return false;
    }
    match conf.mode {
        Mode::Always => true,
        Mode::Scheduled => active_at(minute, conf.start_minute, conf.end_minute),
    }
}

fn conf_path() -> std::path::PathBuf {
    crate::db::data_dir().join("eyecare.json")
}

pub fn load() -> EyeCareConf {
    let mut conf = std::fs::read_to_string(conf_path())
        .ok()
        .and_then(|s| serde_json::from_str::<EyeCareConf>(&s).ok())
        .unwrap_or_default();
    conf.normalize();
    conf
}

fn save(conf: &EyeCareConf) -> Result<(), String> {
    let text = serde_json::to_string_pretty(conf).map_err(|e| e.to_string())?;
    std::fs::write(conf_path(), text).map_err(|e| e.to_string())
}

pub fn state() -> EyeCareConf {
    let mut conf = CONF.lock().map(|c| c.clone()).unwrap_or_default();
    conf.normalize();
    conf
}

/// 只接受已知字段的增量更新：前端点一下开关只会送 `{ enabled }`，
/// 其余字段保持原样，避免旧页面把新值覆盖回去。
pub fn update(patch: &serde_json::Value) -> Result<EyeCareConf, String> {
    let mut merged = serde_json::to_value(state()).map_err(|e| e.to_string())?;
    if let (Some(dst), Some(src)) = (merged.as_object_mut(), patch.as_object()) {
        for (key, value) in src {
            if dst.contains_key(key) {
                dst.insert(key.clone(), value.clone());
            }
        }
    }
    let mut next: EyeCareConf = serde_json::from_value(merged).map_err(|e| e.to_string())?;
    next.normalize();
    save(&next)?;
    if let Ok(mut slot) = CONF.lock() {
        *slot = next.clone();
    }
    wake();
    Ok(next)
}

/// 回到出厂状态：清空用户数据时连遮罩配置一起复位。
pub fn reset() -> Result<(), String> {
    let next = EyeCareConf::default();
    save(&next)?;
    if let Ok(mut slot) = CONF.lock() {
        *slot = next;
    }
    wake();
    Ok(())
}

fn wake() {
    if let Ok(slot) = WAKE.lock() {
        if let Some(tx) = slot.as_ref() {
            let _ = tx.send(());
        }
    }
}

/// 启动渲染线程。重复调用是安全的，只有第一次真正起线程。
pub fn init() {
    let conf = load();
    if let Ok(mut slot) = CONF.lock() {
        *slot = conf;
    }
    engine::spawn();
}

#[cfg(not(target_os = "windows"))]
mod engine {
    pub fn spawn() {}
}

#[cfg(target_os = "windows")]
mod engine {
    use super::{alpha_of, should_show, state, OVERLAY_COLOR, TICK};
    use std::mem::size_of;
    use std::ptr::{null, null_mut};
    use std::sync::mpsc::RecvTimeoutError;
    use windows_sys::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, SYSTEMTIME, TRUE, WPARAM};
    use windows_sys::Win32::Graphics::Gdi::{
        CreateSolidBrush, EnumDisplayMonitors, GetMonitorInfoW, HBRUSH, HDC, HMONITOR, MONITORINFO,
    };
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::SystemInformation::GetLocalTime;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, IsWindow, PeekMessageW,
        RegisterClassW, SetLayeredWindowAttributes, SetWindowPos, ShowWindow, TranslateMessage,
        HWND_TOPMOST, LWA_ALPHA, MSG, PM_REMOVE, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        SWP_SHOWWINDOW, SW_SHOWNOACTIVATE, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
    };

    const CLASS_NAME: &str = "MatchaPuffEyeCare";

    struct Overlay {
        hwnd: HWND,
        rect: RECT,
    }

    pub fn spawn() {
        let (tx, rx) = std::sync::mpsc::channel::<()>();
        if let Ok(mut slot) = super::WAKE.lock() {
            *slot = Some(tx);
        }
        std::thread::Builder::new()
            .name("eyecare".into())
            .spawn(move || run(rx))
            .ok();
    }

    fn run(rx: std::sync::mpsc::Receiver<()>) {
        unsafe { register_class() };
        let mut overlays: Vec<Overlay> = Vec::new();
        let mut shown_alpha = 0u8;
        loop {
            unsafe { pump() };

            let conf = state();
            let want = should_show(&conf, local_minute());

            if want {
                let monitors = unsafe { monitor_rects() };
                let alpha = alpha_of(conf.strength);
                let same_geometry = overlays.len() == monitors.len()
                    && overlays
                        .iter()
                        .zip(monitors.iter())
                        .all(|(o, r)| same_rect(o.rect, *r));
                if !same_geometry {
                    destroy_all(&mut overlays);
                    for rect in monitors {
                        if let Some(hwnd) = unsafe { create_overlay(rect, alpha) } {
                            overlays.push(Overlay { hwnd, rect });
                        }
                    }
                    shown_alpha = alpha;
                } else if alpha != shown_alpha {
                    for o in &overlays {
                        unsafe {
                            SetLayeredWindowAttributes(o.hwnd, 0, alpha, LWA_ALPHA);
                        }
                    }
                    shown_alpha = alpha;
                }
            } else {
                destroy_all(&mut overlays);
                shown_alpha = 0;
            }

            match rx.recv_timeout(TICK) {
                Ok(()) | Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    }

    /// 抽干本线程消息队列：窗口的擦背景/重绘全靠它，不抽就只剩一块没刷过的客户区。
    unsafe fn pump() {
        let mut msg = std::mem::zeroed::<MSG>();
        while PeekMessageW(&mut msg, null_mut(), 0, 0, PM_REMOVE) != 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    unsafe fn register_class() {
        let name = wide(CLASS_NAME);
        let brush: HBRUSH = CreateSolidBrush(OVERLAY_COLOR as COLORREF);
        let wc = WNDCLASSW {
            style: 0,
            lpfnWndProc: Some(wndproc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: GetModuleHandleW(null()),
            hIcon: null_mut(),
            hCursor: null_mut(),
            hbrBackground: brush,
            lpszMenuName: null(),
            lpszClassName: name.as_ptr(),
        };
        // 已经注册过会返回 0，属于正常情况，不必处理。
        RegisterClassW(&wc);
    }

    unsafe fn create_overlay(rect: RECT, alpha: u8) -> Option<HWND> {
        let name = wide(CLASS_NAME);
        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            name.as_ptr(),
            null(),
            WS_POPUP,
            rect.left,
            rect.top,
            rect.right - rect.left,
            rect.bottom - rect.top,
            null_mut(),
            null_mut(),
            GetModuleHandleW(null()),
            null(),
        );
        if hwnd.is_null() {
            return None;
        }
        // 先设透明度再显示：窗口还没上屏，不存在"先以不透明闪一下"的竞态。
        SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
        Some(hwnd)
    }

    fn destroy_all(overlays: &mut Vec<Overlay>) {
        for o in overlays.drain(..) {
            unsafe {
                if IsWindow(o.hwnd) != 0 {
                    DestroyWindow(o.hwnd);
                }
            }
        }
    }

    unsafe fn monitor_rects() -> Vec<RECT> {
        let mut out: Vec<RECT> = Vec::new();
        EnumDisplayMonitors(
            null_mut(),
            null(),
            Some(collect_monitor),
            &mut out as *mut Vec<RECT> as LPARAM,
        );
        out
    }

    unsafe extern "system" fn collect_monitor(
        monitor: HMONITOR,
        _hdc: HDC,
        _clip: *mut RECT,
        data: LPARAM,
    ) -> windows_sys::Win32::Foundation::BOOL {
        let out = &mut *(data as *mut Vec<RECT>);
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut info) != 0 {
            // rcMonitor 是整块屏幕（含任务栏），和遮罩要盖满的意图一致。
            out.push(info.rcMonitor);
        }
        TRUE
    }

    /// 本地时间换算成"当天第几分钟"。
    fn local_minute() -> i32 {
        unsafe {
            let mut st: SYSTEMTIME = std::mem::zeroed();
            GetLocalTime(&mut st);
            st.wHour as i32 * 60 + st.wMinute as i32
        }
    }

    fn same_rect(a: RECT, b: RECT) -> bool {
        a.left == b.left && a.top == b.top && a.right == b.right && a.bottom == b.bottom
    }

    unsafe extern "system" fn wndproc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alpha_rises_with_strength() {
        let values: Vec<u8> = (1..=5).map(alpha_of).collect();
        assert_eq!(values, vec![8, 13, 18, 23, 28]);
        assert!(values.windows(2).all(|w| w[0] < w[1]));
    }

    #[test]
    fn alpha_falls_back_for_unknown_strength() {
        assert_eq!(alpha_of(0), 13);
        assert_eq!(alpha_of(9), 13);
    }

    #[test]
    fn normalize_clamps_strength() {
        let mut conf = EyeCareConf {
            strength: 0,
            ..Default::default()
        };
        conf.normalize();
        assert_eq!(conf.strength, 1);

        conf.strength = 42;
        conf.normalize();
        assert_eq!(conf.strength, 5);
    }

    #[test]
    fn normalize_restores_bad_minutes() {
        let mut conf = EyeCareConf {
            start_minute: -5,
            end_minute: 1440,
            ..Default::default()
        };
        conf.normalize();
        assert_eq!(conf.start_minute, 1080);
        assert_eq!(conf.end_minute, 360);
    }

    #[test]
    fn active_window_same_day() {
        assert!(active_at(600, 480, 1080));
        assert!(active_at(480, 480, 1080));
        assert!(!active_at(1080, 480, 1080));
        assert!(!active_at(479, 480, 1080));
    }

    #[test]
    fn active_window_crosses_midnight() {
        // 18:00 - 次日 06:00
        assert!(active_at(1080, 1080, 360));
        assert!(active_at(1439, 1080, 360));
        assert!(active_at(0, 1080, 360));
        assert!(active_at(359, 1080, 360));
        assert!(!active_at(360, 1080, 360));
        assert!(!active_at(720, 1080, 360));
    }

    #[test]
    fn disabled_never_shows() {
        let conf = EyeCareConf {
            enabled: false,
            mode: Mode::Always,
            ..Default::default()
        };
        assert!(!should_show(&conf, 600));
    }

    #[test]
    fn always_mode_ignores_time() {
        let conf = EyeCareConf {
            enabled: true,
            mode: Mode::Always,
            ..Default::default()
        };
        assert!(should_show(&conf, 0));
        assert!(should_show(&conf, 720));
    }

    #[test]
    fn scheduled_mode_respects_window() {
        let conf = EyeCareConf {
            enabled: true,
            mode: Mode::Scheduled,
            start_minute: 480,
            end_minute: 1080,
            ..Default::default()
        };
        assert!(should_show(&conf, 600));
        assert!(!should_show(&conf, 1200));
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let conf: EyeCareConf = serde_json::from_str(r#"{"enabled":true}"#).unwrap();
        assert!(conf.enabled);
        assert_eq!(conf.strength, 2);
        assert_eq!(conf.mode, Mode::Always);
        assert_eq!(conf.start_minute, 1080);
        assert_eq!(conf.end_minute, 360);
    }

    #[test]
    fn mode_serializes_as_lowercase() {
        let conf = EyeCareConf {
            mode: Mode::Scheduled,
            ..Default::default()
        };
        let text = serde_json::to_string(&conf).unwrap();
        assert!(text.contains("\"scheduled\""));
        let back: EyeCareConf = serde_json::from_str(&text).unwrap();
        assert_eq!(back.mode, Mode::Scheduled);
    }
}
