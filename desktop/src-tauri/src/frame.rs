//! 窗口贴靠态：自绘圆角在贴靠/最大化时要收成直角。
//!
//! Aero Snap（Win+方向键、拖到屏幕边缘）只改窗口矩形，`WindowState` 仍是 Normal，
//! 所以只能按几何判：整格高并贴左/右 = 侧贴，整格宽并贴上/下 = 上下贴；
//! 角格要求「列宽属于布局族 × 半高」。侧贴不校验宽度是否正好半屏——
//! 窗口最小尺寸比半屏宽时，系统会把贴靠夹到最小宽度，那仍然是一次贴靠。
//! 宽高也不能各自独立取分数：列类布局高度必定整格，行类布局宽度必定整格，
//! 否则窗口在贴靠位附近挪动时会被反复判成「又贴靠了」，圆角一帧方一帧圆。
//!
//! 判定时机同样重要：只在拖动/缩放循环之外、几何提交之后发状态；循环里只许「脱开」
//! 不许「贴上」——拖离贴靠位要立刻恢复圆角，拖进贴靠位的预览矩形不能当真。

use serde_json::Value;

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct FrameState {
    pub maximized: bool,
    pub tiled: bool,
}

impl FrameState {
    pub fn to_json(self) -> Value {
        serde_json::json!({ "maximized": self.maximized, "tiled": self.tiled })
    }
}

/// 纯几何判定（物理像素）：给定窗口外框与显示器工作区，是否正好填满一个平铺格。
///
/// 贴边按**覆盖**判：最大化时窗口矩形会被系统按缩放边向外膨胀一圈，
/// 写「恰好相等」会在那一帧判不出来；容差 4px 兜住 DPI 取整。
pub(crate) fn is_tiled_rect(wr: Rect, work: Rect) -> bool {
    let (w, h) = (wr.width(), wr.height());
    let (ww, wh) = (work.width(), work.height());
    if ww <= 0.0 || wh <= 0.0 {
        return false;
    }

    const TOL: f64 = 4.0;
    let near = |value: f64, target: f64| (value - target).abs() <= TOL;

    let column_width = |value: f64| {
        near(value, ww / 4.0)
            || near(value, ww / 3.0)
            || near(value, ww * 0.3)
            || near(value, ww * 0.4)
            || near(value, ww / 2.0)
            || near(value, ww * 0.6)
            || near(value, ww * 2.0 / 3.0)
            || near(value, ww * 0.7)
            || near(value, ww * 3.0 / 4.0)
    };
    let left = wr.left as f64 <= work.left as f64 + TOL;
    let right = wr.right as f64 >= work.right as f64 - TOL;
    let top = wr.top as f64 <= work.top as f64 + TOL;
    let bottom = wr.bottom as f64 >= work.bottom as f64 - TOL;
    let full_w = w >= ww - TOL;
    let full_h = h >= wh - TOL;

    if full_w && full_h {
        return true; // 满工作区
    }
    // 侧贴 / 上下贴：整格高并贴左/右（或整格宽并贴上/下）。
    // 不要求宽度正好是半屏——窗口最小尺寸比半屏宽时，系统会把贴靠夹到最小宽度，
    // 仍然是一次贴靠，圆角必须收掉。
    if full_h && (left || right) {
        return true;
    }
    if full_w && (top || bottom) {
        return true;
    }
    (left || right) && (top || bottom) && column_width(w) && near(h, wh / 2.0) // 角格
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl Rect {
    fn width(self) -> f64 {
        (self.right - self.left) as f64
    }

    fn height(self) -> f64 {
        (self.bottom - self.top) as f64
    }
}

#[cfg(target_os = "windows")]
pub use imp::{install, query};

#[cfg(not(target_os = "windows"))]
pub fn install(_window: &tauri::WebviewWindow) {}

#[cfg(not(target_os = "windows"))]
pub fn query(_window: &tauri::WebviewWindow) -> Option<FrameState> {
    None
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{is_tiled_rect, FrameState, Rect};
    use tauri::{AppHandle, Manager, WebviewWindow};
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromRect, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetWindowRect, IsIconic, IsZoomed};

    const WM_ENTERSIZEMOVE: u32 = 0x0231;
    const WM_EXITSIZEMOVE: u32 = 0x0232;
    const WM_WINDOWPOSCHANGED: u32 = 0x0047;
    const WM_NCDESTROY: u32 = 0x0082;
    const SUBCLASS_ID: usize = 0x4D50_4652; // "MPFR"

    struct Watch {
        app: AppHandle,
        label: String,
        in_size_move: bool,
        last: Option<FrameState>,
    }

    impl Watch {
        /// 几何提交后完整重判（循环外）。
        fn publish(&mut self, hwnd: HWND) {
            let Some(next) = read_state(hwnd) else { return };
            if self.last == Some(next) {
                return;
            }
            self.last = Some(next);
            self.emit(next);
        }

        /// 拖动/缩放循环里只许脱开：从贴靠位拖走要立刻恢复圆角；
        /// 跟着预览矩形贴上会让角一帧方一帧圆，贴上一律等松手后的最终矩形。
        fn detach_only(&mut self, hwnd: HWND) {
            if !self.last.is_some_and(|state| state.tiled) {
                return;
            }
            let Some(next) = read_state(hwnd) else { return };
            if next.tiled || self.last == Some(next) {
                return;
            }
            self.last = Some(next);
            self.emit(next);
        }

        fn emit(&self, state: FrameState) {
            let Some(app_state) = self.app.try_state::<crate::ipc::AppState>() else {
                return;
            };
            crate::ipc::broadcast_to(
                &self.app,
                app_state.inner(),
                "frame:state",
                &self.label,
                &state.to_json(),
            );
        }
    }

    pub fn install(window: &WebviewWindow) {
        // SetWindowSubclass 必须由窗口所属线程调用；工具子窗是在 IPC 线程建的。
        let w = window.clone();
        let _ = window.run_on_main_thread(move || install_now(&w));
    }

    fn install_now(window: &WebviewWindow) {
        let Ok(hwnd) = window.hwnd() else { return };
        let raw = hwnd.0 as HWND;
        let watch = Box::new(Watch {
            app: window.app_handle().clone(),
            label: window.label().to_string(),
            in_size_move: false,
            last: query(window),
        });
        let refdata = Box::into_raw(watch) as usize;
        let ok = unsafe { SetWindowSubclass(raw, Some(wndproc), SUBCLASS_ID, refdata) };
        if ok == 0 {
            unsafe { drop(Box::from_raw(refdata as *mut Watch)) };
        }
    }

    pub fn query(window: &WebviewWindow) -> Option<FrameState> {
        let hwnd = window.hwnd().ok()?;
        read_state(hwnd.0 as HWND)
    }

    unsafe extern "system" fn wndproc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        refdata: usize,
    ) -> LRESULT {
        if msg == WM_NCDESTROY {
            RemoveWindowSubclass(hwnd, Some(wndproc), SUBCLASS_ID);
            let result = DefSubclassProc(hwnd, msg, wparam, lparam);
            drop(Box::from_raw(refdata as *mut Watch));
            return result;
        }

        let watch = &mut *(refdata as *mut Watch);
        match msg {
            WM_ENTERSIZEMOVE => watch.in_size_move = true,
            WM_EXITSIZEMOVE => {
                watch.in_size_move = false;
                watch.publish(hwnd);
            }
            WM_WINDOWPOSCHANGED => {
                if watch.in_size_move {
                    watch.detach_only(hwnd);
                } else {
                    watch.publish(hwnd);
                }
            }
            _ => {}
        }
        DefSubclassProc(hwnd, msg, wparam, lparam)
    }

    fn read_state(hwnd: HWND) -> Option<FrameState> {
        // 最小化时窗口矩形是 (-32000,-32000)，不代表真实几何；保持原状态，还原后重判
        if unsafe { IsIconic(hwnd) } != 0 {
            return None;
        }
        let mut wr: RECT = unsafe { std::mem::zeroed() };
        if unsafe { GetWindowRect(hwnd, &mut wr) } == 0 {
            return None;
        }
        let maximized = unsafe { IsZoomed(hwnd) } != 0;
        let rect = Rect {
            left: wr.left,
            top: wr.top,
            right: wr.right,
            bottom: wr.bottom,
        };
        let monitor = unsafe { MonitorFromRect(&wr, MONITOR_DEFAULTTONEAREST) };
        if monitor.is_null() {
            return Some(FrameState {
                maximized,
                tiled: maximized,
            });
        }
        let mut info: MONITORINFO = unsafe { std::mem::zeroed() };
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if unsafe { GetMonitorInfoW(monitor, &mut info) } == 0 {
            return Some(FrameState {
                maximized,
                tiled: maximized,
            });
        }
        let work = Rect {
            left: info.rcWork.left,
            top: info.rcWork.top,
            right: info.rcWork.right,
            bottom: info.rcWork.bottom,
        };
        Some(FrameState {
            maximized,
            tiled: maximized || is_tiled_rect(rect, work),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{is_tiled_rect, Rect};

    fn work() -> Rect {
        Rect {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1040,
        }
    }

    fn rect(left: i32, top: i32, right: i32, bottom: i32) -> Rect {
        Rect {
            left,
            top,
            right,
            bottom,
        }
    }

    #[test]
    fn left_half_is_tiled() {
        assert!(is_tiled_rect(rect(0, 0, 960, 1040), work()));
    }

    #[test]
    fn right_half_is_tiled() {
        assert!(is_tiled_rect(rect(960, 0, 1920, 1040), work()));
    }

    #[test]
    fn top_and_bottom_halves_are_tiled() {
        assert!(is_tiled_rect(rect(0, 0, 1920, 520), work()));
        assert!(is_tiled_rect(rect(0, 520, 1920, 1040), work()));
    }

    #[test]
    fn quarters_are_tiled() {
        assert!(is_tiled_rect(rect(0, 0, 960, 520), work()));
        assert!(is_tiled_rect(rect(960, 520, 1920, 1040), work()));
    }

    #[test]
    fn thirds_and_seventies_are_tiled() {
        assert!(is_tiled_rect(rect(0, 0, 640, 1040), work()));
        assert!(is_tiled_rect(rect(0, 0, 1280, 1040), work()));
        assert!(is_tiled_rect(rect(0, 0, 1344, 1040), work()));
    }

    #[test]
    fn maximized_inflated_rect_is_tiled() {
        // 最大化时系统会把窗口矩形按不可见缩放边向外膨胀
        assert!(is_tiled_rect(rect(-8, -8, 1928, 1048), work()));
    }

    #[test]
    fn floating_window_is_not_tiled() {
        assert!(!is_tiled_rect(rect(120, 80, 1010, 700), work()));
    }

    #[test]
    fn flush_edge_with_arbitrary_size_is_not_tiled() {
        assert!(!is_tiled_rect(rect(0, 100, 800, 900), work()));
        assert!(!is_tiled_rect(rect(100, 0, 1800, 700), work()));
    }

    #[test]
    fn clamped_side_snap_is_tiled() {
        // 2560 宽工作区半屏 1280，小于最小窗口宽 1440：系统把贴靠夹到 1440；
        // 整格高 + 贴边仍然是一次贴靠，不能因为宽度不是 1/2 就留着圆角缺角
        let work = Rect {
            left: 0,
            top: 0,
            right: 2560,
            bottom: 1540,
        };
        assert!(is_tiled_rect(rect(1120, 0, 2560, 1540), work));
        assert!(is_tiled_rect(rect(0, 0, 1440, 1540), work));
    }

    #[test]
    fn full_height_flush_side_is_tiled_at_any_width() {
        assert!(is_tiled_rect(rect(0, 0, 800, 1040), work()));
        assert!(is_tiled_rect(rect(1300, 0, 1920, 1040), work()));
    }

    #[test]
    fn clamped_vertical_snap_is_tiled() {
        // 1540 高工作区半高 770，小于最小窗口高 930：贴顶被夹到 930
        let work = Rect {
            left: 0,
            top: 0,
            right: 2560,
            bottom: 1540,
        };
        assert!(is_tiled_rect(rect(0, 0, 2560, 930), work));
    }

    #[test]
    fn half_width_but_not_full_height_is_not_tiled() {
        // 从贴靠位往下拖上边缘时，高度会扫过 3/4、2/3、0.6…，这些都不算贴靠
        assert!(!is_tiled_rect(rect(0, 0, 960, 624), work()));
        assert!(!is_tiled_rect(rect(0, 0, 960, 780), work()));
    }

    #[test]
    fn near_tolerance_is_accepted_but_beyond_is_not() {
        assert!(is_tiled_rect(rect(1, 0, 961, 1040), work()));
        assert!(!is_tiled_rect(rect(12, 0, 972, 1040), work()));
    }

    #[test]
    fn negative_monitor_coordinates_are_tiled() {
        let second = Rect {
            left: -1920,
            top: 0,
            right: 0,
            bottom: 1040,
        };
        assert!(is_tiled_rect(rect(-1920, 0, -960, 1040), second));
    }

    #[test]
    fn degenerate_work_area_is_not_tiled() {
        assert!(!is_tiled_rect(
            rect(0, 0, 0, 0),
            Rect {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            }
        ));
    }
}
