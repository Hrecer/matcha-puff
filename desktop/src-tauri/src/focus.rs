//! 专注计时内核：只负责「时间」，不负责「意义」。
//!
//! - 权威状态是 deadline（绝对时间），不是 tick 累加，休眠/挂起后仍然准确；
//! - 前端只渲染 tick，不参与计时；
//! - 到点后把一次「会话结算」写入 pending，等 TS 侧幂等入账；
//! - 业务规则（任务计数、统计、归档、自动下一个）全部留给 TS。

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

use crate::ipc::{broadcast, AppState};

/// 距上次完成超过 4 小时视为新的一段（与 TS core 的 NEW_SITTING_GAP_MS 一致）
const NEW_SITTING_GAP_MS: i64 = 4 * 60 * 60 * 1000;
const TICK_MS: u64 = 250;
const PERSIST_EVERY_MS: i64 = 5_000;

static SESSION_SEQ: AtomicU64 = AtomicU64::new(1);

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Idle,
    Focus,
    Rest,
    Paused,
    /// 专注刚走完、还等着用户确认：不自动进休息，也不开始下一段。
    /// 这是「响铃」态，只有用户动手才会离开。
    Awaiting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivePhase {
    Focus,
    Rest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RestKind {
    Short,
    Long,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRef {
    pub id: String,
    pub name: String,
    pub desc: String,
    #[serde(rename = "type")]
    pub kind: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cycle {
    pub completed: i64,
    pub last_completed_at: Option<i64>,
}

impl Default for Cycle {
    fn default() -> Self {
        Self {
            completed: 0,
            last_completed_at: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Policy {
    pub rest_minutes: i64,
    pub long_rest_minutes: i64,
    pub long_rest_interval: i64,
    pub auto_rest: bool,
    pub disable_rest: bool,
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            rest_minutes: 5,
            long_rest_minutes: 15,
            long_rest_interval: 4,
            auto_rest: false,
            disable_rest: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingFinish {
    pub session_id: String,
    pub phase: ActivePhase,
    pub task: Option<TaskRef>,
    pub seconds: i64,
    pub completed: bool,
    pub rest_kind: Option<RestKind>,
    pub at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusState {
    pub phase: Phase,
    pub paused_from: Option<ActivePhase>,
    pub rest_kind: Option<RestKind>,
    pub task: Option<TaskRef>,
    pub session_id: Option<String>,
    pub duration_ms: i64,
    pub deadline: i64,
    pub accumulated_ms: i64,
    /// 暂停时保存的剩余毫秒
    pub remaining_ms: i64,
    pub cycle: Cycle,
    pub policy: Policy,
    pub pending: Option<PendingFinish>,
    #[serde(skip)]
    last_emit_second: i64,
    #[serde(skip)]
    last_save_ms: i64,
}

impl Default for FocusState {
    fn default() -> Self {
        Self {
            phase: Phase::Idle,
            paused_from: None,
            rest_kind: None,
            task: None,
            session_id: None,
            duration_ms: 25 * 60_000,
            deadline: 0,
            accumulated_ms: 0,
            remaining_ms: 0,
            cycle: Cycle::default(),
            policy: Policy::default(),
            pending: None,
            last_emit_second: -1,
            last_save_ms: 0,
        }
    }
}

fn next_session_id(now: i64) -> String {
    let seq = SESSION_SEQ.fetch_add(1, Ordering::Relaxed);
    format!("focus-{now}-{seq}")
}

fn rest_kind(completed: i64, interval: i64) -> RestKind {
    if completed <= 0 || interval <= 0 {
        return RestKind::Short;
    }
    if completed % interval == 0 {
        RestKind::Long
    } else {
        RestKind::Short
    }
}

impl FocusState {
    fn reset_cycle_if_stale(&mut self, now: i64) {
        if let Some(last) = self.cycle.last_completed_at {
            if now - last > NEW_SITTING_GAP_MS {
                self.cycle = Cycle::default();
            }
        }
    }

    pub fn start(&mut self, minutes: i64, task: TaskRef, policy: Policy, now: i64) {
        self.reset_cycle_if_stale(now);
        let minutes = minutes.clamp(1, 600);
        self.policy = policy;
        self.phase = Phase::Focus;
        self.paused_from = None;
        self.rest_kind = None;
        self.task = Some(task);
        self.session_id = Some(next_session_id(now));
        self.duration_ms = minutes * 60_000;
        self.deadline = now + self.duration_ms;
        self.accumulated_ms = 0;
        self.remaining_ms = 0;
        self.last_emit_second = -1;
        self.last_save_ms = 0;
    }

    pub fn pause(&mut self, now: i64) {
        let from = match self.phase {
            Phase::Focus => ActivePhase::Focus,
            Phase::Rest => ActivePhase::Rest,
            _ => return,
        };
        let remaining = (self.deadline - now).max(0);
        self.paused_from = Some(from);
        self.remaining_ms = remaining;
        self.accumulated_ms = (self.duration_ms - remaining).max(0);
        self.phase = Phase::Paused;
    }

    pub fn resume(&mut self, now: i64) {
        if self.phase != Phase::Paused {
            return;
        }
        let Some(from) = self.paused_from.take() else {
            self.phase = Phase::Idle;
            return;
        };
        self.deadline = now + self.remaining_ms;
        self.phase = match from {
            ActivePhase::Focus => Phase::Focus,
            ActivePhase::Rest => Phase::Rest,
        };
    }

    pub fn stop(&mut self, now: i64) {
        match self.phase {
            Phase::Focus => {
                let seconds = (self.accumulated_ms / 1000).max(0);
                if seconds > 0 {
                    self.pending = Some(PendingFinish {
                        session_id: self.session_id.clone().unwrap_or_else(|| next_session_id(now)),
                        phase: ActivePhase::Focus,
                        task: self.task.clone(),
                        seconds,
                        completed: false,
                        rest_kind: None,
                        at: now,
                    });
                }
            }
            Phase::Paused if self.paused_from == Some(ActivePhase::Focus) => {
                let seconds = (self.accumulated_ms / 1000).max(0);
                if seconds > 0 {
                    self.pending = Some(PendingFinish {
                        session_id: self.session_id.clone().unwrap_or_else(|| next_session_id(now)),
                        phase: ActivePhase::Focus,
                        task: self.task.clone(),
                        seconds,
                        completed: false,
                        rest_kind: None,
                        at: now,
                    });
                }
            }
            _ => {}
        }
        self.phase = Phase::Idle;
        self.paused_from = None;
        self.rest_kind = None;
        self.remaining_ms = 0;
        self.accumulated_ms = 0;
        self.deadline = 0;
        self.release_task();
    }

    /// 跳过休息：下一段专注由 TS 决定
    pub fn skip_rest(&mut self, now: i64) {
        let from_rest = self.phase == Phase::Rest
            || (self.phase == Phase::Paused && self.paused_from == Some(ActivePhase::Rest));
        if !from_rest {
            return;
        }
        let kind = self.rest_kind;
        if kind == Some(RestKind::Long) {
            self.cycle.completed = 0;
        }
        self.pending = Some(PendingFinish {
            session_id: self.session_id.clone().unwrap_or_else(|| next_session_id(now)),
            phase: ActivePhase::Rest,
            task: self.task.clone(),
            seconds: 0,
            completed: true,
            rest_kind: kind,
            at: now,
        });
        self.phase = Phase::Idle;
        self.paused_from = None;
        self.rest_kind = None;
        self.remaining_ms = 0;
        self.accumulated_ms = 0;
        self.deadline = 0;
        self.release_task();
    }

    pub fn clear_pending(&mut self) {
        self.pending = None;
    }

    /// 一段计时彻底结束：任务上下文随这一段一起释放。
    ///
    /// 空闲态再挂着上一段的任务/习惯，计时页就会继续把它当成当前任务显示，
    /// 下一次「开始」也会直接沿用；自动下一个要续的任务由 pending.task 携带。
    fn release_task(&mut self) {
        self.task = None;
        self.session_id = None;
    }

    /// 手动开始休息：时长与短/长种类由 TS 判定（业务语义在 TS），Rust 只负责计时。
    /// 休息期间 task 仍然保留（挂件能显示、自动下一个要续它），
    /// 休息结束结算时释放；要续的任务由 pending.task 带回 TS。
    pub fn start_rest(&mut self, minutes: i64, kind: RestKind, now: i64) {
        let minutes = minutes.clamp(1, 600);
        self.phase = Phase::Rest;
        self.paused_from = None;
        self.rest_kind = Some(kind);
        self.session_id = Some(next_session_id(now));
        self.duration_ms = minutes * 60_000;
        self.deadline = now + self.duration_ms;
        self.accumulated_ms = 0;
        self.remaining_ms = 0;
        self.last_emit_second = -1;
        self.last_save_ms = 0;
    }

    pub fn snapshot(&self, now: i64, with_pending: bool) -> Value {        let remain = match self.phase {
            Phase::Focus | Phase::Rest => (self.deadline - now).max(0),
            Phase::Paused => self.remaining_ms.max(0),
            Phase::Idle | Phase::Awaiting => 0,
        };
        let elapsed = (self.duration_ms - remain).max(0);
        let progress = if self.duration_ms > 0 {
            (elapsed as f64 / self.duration_ms as f64 * 100.0).clamp(0.0, 100.0)
        } else {
            100.0
        };
        json!({
            "phase": self.phase,
            "pausedFrom": self.paused_from,
            "restKind": self.rest_kind,
            "task": self.task,
            "durationMs": self.duration_ms,
            "remainMs": remain,
            "progress": progress,
            "cycleCompleted": self.cycle.completed,
            "paused": self.phase == Phase::Paused,
            "pending": if with_pending { json!(self.pending) } else { Value::Null },
        })
    }

    fn finish(&mut self, now: i64) -> Option<PendingFinish> {
        match self.phase {
            Phase::Focus => {
                let seconds = (self.duration_ms / 1000).max(0);
                self.cycle.completed += 1;
                self.cycle.last_completed_at = Some(now);

                let pending = PendingFinish {
                    session_id: self.session_id.clone().unwrap_or_else(|| next_session_id(now)),
                    phase: ActivePhase::Focus,
                    task: self.task.clone(),
                    seconds,
                    completed: true,
                    rest_kind: None,
                    at: now,
                };
                // 必须落到状态里：崩溃/重启后 TS 还能补结算。
                self.pending = Some(pending.clone());

                // 不再自动流转：专注走完就停在「时间到」，等用户点开始休息或结束。
                // 这样人不在座位上时，休息时间不会被白白走掉。
                if self.policy.disable_rest {
                    self.phase = Phase::Idle;
                    self.rest_kind = None;
                    // 这一段直接收尾，空闲态不再挂着它；自动下一个从 pending 里取任务
                    self.release_task();
                } else {
                    self.phase = Phase::Awaiting;
                    self.rest_kind = Some(rest_kind(
                        self.cycle.completed,
                        self.policy.long_rest_interval,
                    ));
                }
                self.deadline = 0;
                self.accumulated_ms = 0;
                self.remaining_ms = 0;
                self.last_emit_second = -1;

                Some(pending)
            }
            Phase::Rest => {
                let kind = self.rest_kind;
                if kind == Some(RestKind::Long) {
                    self.cycle.completed = 0;
                }
                let pending = PendingFinish {
                    session_id: self.session_id.clone().unwrap_or_else(|| next_session_id(now)),
                    phase: ActivePhase::Rest,
                    task: self.task.clone(),
                    seconds: 0,
                    completed: true,
                    rest_kind: kind,
                    at: now,
                };
                self.pending = Some(pending.clone());
                self.phase = Phase::Idle;
                self.rest_kind = None;
                self.deadline = 0;
                self.accumulated_ms = 0;
                self.remaining_ms = 0;
                // 休息走完 = 这一轮彻底结束；任务上下文不留在空闲态
                self.release_task();
                Some(pending)
            }
            _ => None,
        }
    }
}

pub struct TickOutcome {
    pub emit_tick: bool,
    pub finished: Option<PendingFinish>,
    pub save: bool,
}

/// 推进计时。返回是否需要广播 tick / 结算 / 落盘。
pub fn tick(state: &mut FocusState, now: i64) -> TickOutcome {
    match state.phase {
        Phase::Idle | Phase::Paused | Phase::Awaiting => TickOutcome {
            emit_tick: false,
            finished: None,
            save: false,
        },
        Phase::Focus | Phase::Rest => {
            let remain = state.deadline - now;
            if remain <= 0 {
                let finished = state.finish(now);
                return TickOutcome {
                    emit_tick: false,
                    finished,
                    save: true,
                };
            }
            state.accumulated_ms = (state.duration_ms - remain).max(0);
            let second = now / 1000;
            let emit_tick = second != state.last_emit_second;
            if emit_tick {
                state.last_emit_second = second;
            }
            let save = now - state.last_save_ms >= PERSIST_EVERY_MS;
            if save {
                state.last_save_ms = now;
            }
            TickOutcome {
                emit_tick,
                finished: None,
                save,
            }
        }
    }
}

pub fn load(conn: &Connection) -> Option<FocusState> {
    let raw: String = conn
        .query_row("SELECT state FROM pomodoro_focus WHERE id = 1", [], |row| {
            row.get(0)
        })
        .ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save(conn: &Connection, state: &FocusState) -> Result<(), String> {
    let raw = serde_json::to_string(state).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO pomodoro_focus (id, state, updated_at) VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at",
        params![raw, now_ms()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 启动时恢复：已过点就按「已累计秒数」结算，不把停机时间算成专注。
pub fn restore(mut state: FocusState, now: i64) -> (FocusState, bool) {
    let mut changed = false;
    match state.phase {
        Phase::Focus if state.deadline <= now => {
            let seconds = (state.accumulated_ms / 1000).max(0);
            if seconds > 0 {
                state.pending = Some(PendingFinish {
                    session_id: state.session_id.clone().unwrap_or_else(|| next_session_id(now)),
                    phase: ActivePhase::Focus,
                    task: state.task.clone(),
                    seconds,
                    completed: false,
                    rest_kind: None,
                    at: now,
                });
            }
            state.phase = Phase::Idle;
            state.deadline = 0;
            state.accumulated_ms = 0;
            state.remaining_ms = 0;
            state.release_task();
            changed = true;
        }
        Phase::Rest if state.deadline <= now => {
            state.pending = Some(PendingFinish {
                session_id: state.session_id.clone().unwrap_or_else(|| next_session_id(now)),
                phase: ActivePhase::Rest,
                task: state.task.clone(),
                seconds: 0,
                completed: true,
                rest_kind: state.rest_kind,
                at: now,
            });
            state.phase = Phase::Idle;
            state.deadline = 0;
            state.accumulated_ms = 0;
            state.remaining_ms = 0;
            state.release_task();
            changed = true;
        }
        Phase::Idle => {
            // 旧版本把休息结束后的任务留在了空闲态：启动时顺手清掉
            if state.task.is_some() || state.session_id.is_some() {
                state.release_task();
                changed = true;
            }
        }
        _ => {}
    }
    (state, changed)
}

pub fn spawn_ticker(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(TICK_MS));
            let now = now_ms();
            let state = app.state::<AppState>();

            let (tick_payload, finished_payload, save_state) = {
                let mut focus = state.focus.lock().unwrap();
                let outcome = tick(&mut focus, now);
                let tick_payload = outcome.emit_tick.then(|| focus.snapshot(now, false));
                let finished_payload = outcome.finished.as_ref().map(|pending| {
                    json!({
                        "sessionId": pending.session_id,
                        "phase": pending.phase,
                        "task": pending.task,
                        "seconds": pending.seconds,
                        "completed": pending.completed,
                        "restKind": pending.rest_kind,
                        "at": pending.at,
                    })
                });
                let save_state = outcome
                    .save
                    .then(|| focus.clone())
                    .or_else(|| outcome.finished.is_some().then(|| focus.clone()));
                (tick_payload, finished_payload, save_state)
            };

            if let Some(snapshot) = save_state {
                if let Ok(conn) = state.db.lock() {
                    let _ = save(&conn, &snapshot);
                }
            }
            if let Some(payload) = tick_payload {
                broadcast(&app, &state, "focus:tick", &payload);
            }
            if let Some(payload) = finished_payload {
                broadcast(&app, &state, "focus:finished", &payload);
                let snapshot = state.focus.lock().unwrap().snapshot(now, false);
                broadcast(&app, &state, "focus:phase", &snapshot);
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task() -> TaskRef {
        TaskRef {
            id: "t1".into(),
            name: "测试任务".into(),
            desc: String::new(),
            kind: 2,
        }
    }

    fn policy(auto_rest: bool) -> Policy {
        Policy {
            rest_minutes: 5,
            long_rest_minutes: 15,
            long_rest_interval: 4,
            auto_rest,
            disable_rest: false,
        }
    }

    fn no_rest_policy() -> Policy {
        Policy {
            disable_rest: true,
            ..policy(false)
        }
    }

    #[test]
    fn start_sets_deadline_and_progress() {
        let mut state = FocusState::default();
        state.start(25, task(), policy(false), 1_000);
        assert_eq!(state.phase, Phase::Focus);
        assert_eq!(state.deadline, 1_000 + 25 * 60_000);
        let snap = state.snapshot(1_000, true);
        assert_eq!(snap["remainMs"], 25 * 60_000);
        assert_eq!(snap["progress"], 0.0);
    }

    #[test]
    fn tick_emits_once_per_second_and_finishes() {
        let mut state = FocusState::default();
        state.start(1, task(), policy(false), 0);

        let first = tick(&mut state, 500);
        assert!(first.emit_tick);
        assert!(first.finished.is_none());

        let same_second = tick(&mut state, 900);
        assert!(!same_second.emit_tick);

        let finished = tick(&mut state, 60_000);
        let pending = finished.finished.expect("应当结算");
        assert_eq!(pending.seconds, 60);
        assert!(pending.completed);
        assert!(state.pending.is_some(), "结算必须留在状态里供前端补账");
        // 走完不再自动流转，停在「时间到」等用户确认
        assert_eq!(state.phase, Phase::Awaiting);
        assert_eq!(state.rest_kind, Some(RestKind::Short));
    }

    /// 「时间到」必须等人动手：开始休息 / 知道了是唯二离开方式。
    #[test]
    fn awaiting_only_leaves_on_user_action() {
        let mut a = FocusState::default();
        a.start(1, task(), policy(true), 0);
        let _ = tick(&mut a, 60_000);
        assert_eq!(a.phase, Phase::Awaiting);
        a.start_rest(5, RestKind::Short, 60_000);
        assert_eq!(a.phase, Phase::Rest, "点「开始休息」才进休息");
        assert_eq!(a.duration_ms, 300_000);

        let mut b = FocusState::default();
        b.start(1, task(), policy(true), 0);
        let _ = tick(&mut b, 60_000);
        assert_eq!(b.phase, Phase::Awaiting);
        b.stop(60_000);
        assert_eq!(b.phase, Phase::Idle, "点「知道了」才回到空闲");
    }

    #[test]
    fn pause_keeps_remaining_and_resume_recomputes_deadline() {
        let mut state = FocusState::default();
        state.start(10, task(), policy(false), 0);
        tick(&mut state, 60_000);

        state.pause(60_000);
        assert_eq!(state.phase, Phase::Paused);
        assert_eq!(state.remaining_ms, 9 * 60_000);

        state.resume(600_000);
        assert_eq!(state.phase, Phase::Focus);
        assert_eq!(state.deadline, 600_000 + 9 * 60_000);

        let finished = tick(&mut state, 600_000 + 9 * 60_000);
        assert!(finished.finished.is_some());
        assert_eq!(finished.finished.unwrap().seconds, 600);
    }

    #[test]
    fn awaiting_holds_until_user_confirms() {
        let mut state = FocusState::default();
        state.start(1, task(), policy(true), 0);
        tick(&mut state, 60_000);
        assert_eq!(state.phase, Phase::Awaiting);
        assert_eq!(state.snapshot(60_000, true)["remainMs"], 0);

        // 待确认态不推进：再 tick 也不会自己进休息或自己结束
        let idle = tick(&mut state, 600_000);
        assert!(idle.finished.is_none());
        assert!(!idle.emit_tick);
        assert_eq!(state.phase, Phase::Awaiting);

        // 用户点「开始休息」才真正进入休息计时
        state.start_rest(5, RestKind::Short, 600_000);
        assert_eq!(state.phase, Phase::Rest);
        assert_eq!(state.deadline, 600_000 + 5 * 60_000);
    }

    #[test]
    fn long_rest_kind_after_every_fourth_focus() {
        let mut state = FocusState::default();
        let mut now = 0;
        for round in 1..=4 {
            state.start(1, task(), policy(true), now);
            tick(&mut state, now + 60_000);
            let expect = if round < 4 { RestKind::Short } else { RestKind::Long };
            assert_eq!(state.rest_kind, Some(expect), "第 {round} 次的待休息类型");
            // 模拟用户点「知道了」：回空闲，本轮计数保留
            state.stop(now + 60_000);
            assert_eq!(state.phase, Phase::Idle);
            now += 61_000;
        }
        assert_eq!(state.cycle.completed, 4);
    }

    #[test]
    fn stop_credits_elapsed_without_completion() {
        let mut state = FocusState::default();
        state.start(25, task(), policy(false), 0);
        tick(&mut state, 60_000);
        state.stop(60_000);
        let pending = state.pending.expect("停止应留下结算");
        assert_eq!(pending.seconds, 60);
        assert!(!pending.completed);
        assert_eq!(state.phase, Phase::Idle);
        assert!(state.task.is_none(), "停止后不再挂着这一段的任务");
    }

    #[test]
    fn awaiting_keeps_task_but_rest_end_releases_it() {
        let mut state = FocusState::default();
        state.start(1, task(), policy(false), 0);
        tick(&mut state, 60_000);
        assert_eq!(state.phase, Phase::Awaiting);
        assert_eq!(state.task.as_ref().map(|item| item.id.as_str()), Some("t1"));

        state.start_rest(1, RestKind::Short, 60_000);
        assert_eq!(
            state.task.as_ref().map(|item| item.id.as_str()),
            Some("t1"),
            "休息期间仍带着本次任务，供自动下一个续上"
        );

        let out = tick(&mut state, 120_000);
        let pending = out.finished.expect("休息结束应结算");
        assert_eq!(
            pending.task.as_ref().map(|item| item.id.as_str()),
            Some("t1"),
            "待结算记录保留任务，自动下一个仍能续上"
        );
        assert_eq!(state.phase, Phase::Idle);
        assert!(state.task.is_none(), "休息结束后释放任务上下文");
        assert!(state.session_id.is_none(), "休息结束后释放会话");
    }

    #[test]
    fn skip_rest_releases_task_but_pending_keeps_it() {
        let mut state = FocusState::default();
        state.start(1, task(), policy(false), 0);
        tick(&mut state, 60_000);
        state.start_rest(5, RestKind::Short, 60_000);

        state.skip_rest(90_000);
        let pending = state.pending.clone().expect("跳过休息应留下结算");
        assert_eq!(pending.phase, ActivePhase::Rest);
        assert_eq!(
            pending.task.as_ref().map(|item| item.id.as_str()),
            Some("t1")
        );
        assert_eq!(state.phase, Phase::Idle);
        assert!(state.task.is_none(), "跳过休息后不再挂着上一段的任务");
    }

    #[test]
    fn disabling_rest_ends_session_without_task() {
        let mut state = FocusState::default();
        state.start(1, task(), no_rest_policy(), 0);
        let out = tick(&mut state, 60_000);
        assert!(out.finished.is_some());
        assert_eq!(state.phase, Phase::Idle);
        assert!(state.pending.is_some(), "结算仍然保留");
        assert!(state.task.is_none(), "禁用休息直接收尾，不保留任务");
    }

    #[test]
    fn restore_clears_stale_idle_task() {
        let mut state = FocusState::default();
        state.task = Some(task());
        state.session_id = Some("s1".into());

        let (restored, changed) = restore(state, 5_000);
        assert!(changed);
        assert_eq!(restored.phase, Phase::Idle);
        assert!(restored.task.is_none());
        assert!(restored.session_id.is_none());
    }

    #[test]
    fn restore_expired_rest_releases_task() {
        let mut state = FocusState::default();
        state.phase = Phase::Rest;
        state.task = Some(task());
        state.session_id = Some("s1".into());
        state.rest_kind = Some(RestKind::Short);
        state.duration_ms = 300_000;
        state.deadline = 1_000;

        let (restored, changed) = restore(state, 5_000);
        assert!(changed);
        assert_eq!(restored.phase, Phase::Idle);
        let pending = restored.pending.clone().expect("应补结算");
        assert!(pending.task.is_some(), "补结算仍带着任务");
        assert!(restored.task.is_none(), "恢复后不再挂着任务");
    }

    #[test]
    fn restore_expired_focus_credits_accumulated_only() {
        let mut state = FocusState::default();
        state.phase = Phase::Focus;
        state.task = Some(task());
        state.duration_ms = 25 * 60_000;
        state.deadline = 1_000;
        state.accumulated_ms = 10 * 60_000;

        let (restored, changed) = restore(state, 5_000);
        assert!(changed);
        assert_eq!(restored.phase, Phase::Idle);
        let pending = restored.pending.clone().expect("应补结算");
        assert_eq!(pending.seconds, 600);
        assert!(!pending.completed);
        assert!(restored.task.is_none(), "恢复后不再挂着任务");
    }

    #[test]
    fn snapshot_roundtrip_through_sqlite() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE pomodoro_focus (id INTEGER PRIMARY KEY CHECK (id = 1), state TEXT NOT NULL, updated_at INTEGER NOT NULL);",
        )
        .unwrap();

        let mut state = FocusState::default();
        state.start(25, task(), policy(false), 1_000);
        save(&conn, &state).unwrap();

        let loaded = load(&conn).expect("应能读回");
        assert_eq!(loaded.phase, Phase::Focus);
        assert_eq!(loaded.deadline, state.deadline);
        assert_eq!(loaded.task.unwrap().name, "测试任务");
    }

    #[test]
    fn stale_cycle_resets_after_four_hours() {
        let mut state = FocusState::default();
        state.cycle = Cycle {
            completed: 3,
            last_completed_at: Some(1_000),
        };
        state.start(1, task(), policy(false), 1_000 + NEW_SITTING_GAP_MS + 1);
        assert_eq!(state.cycle.completed, 0);
    }
}
