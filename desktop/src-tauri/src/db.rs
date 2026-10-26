use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

/**
 * 出厂种子：表结构 + 默认搜索源。
 *
 * 用 SQL 文本维护（resources/seed.sql），编译期 include_str! 进可执行程序，
 * 首次运行时执行它建库。工具目录在 packages/tools 的 manifest 里，不在这里。
 */
const SEED_SQL: &str = include_str!("../resources/seed.sql");

static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

fn fallback_dir() -> PathBuf {
    let dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("data")))
        .unwrap_or_else(|| PathBuf::from("data"));
    outside_workspace(dir)
}

/**
 * 数据目录绝不允许落在工作区 / 构建目录里。
 *
 * dev 下 Tauri 有时会把 `app_local_data_dir()` 解析到 `src-tauri/resources/<随机名>`，
 * 那个数据库会被顺手提交进版本库（历史上真的发生过一次，见 .gitignore 里那条）。
 * 凡是解析出这种路径，一律改写到系统临时目录下的固定名字，并打印一行提示。
 *
 * 只认构建期才有的标记（src-tauri / target），安装版的数据目录（%LOCALAPPDATA%\...）永远不受影响。
 */
fn outside_workspace(dir: PathBuf) -> PathBuf {
    let text = dir.to_string_lossy().to_lowercase();
    let is_build_dir =
        text.contains("src-tauri") || text.contains("\\target\\") || text.contains("/target/");
    if !is_build_dir {
        return dir;
    }
    let tmp = std::env::temp_dir().join("matcha-puff-data");
    eprintln!(
        "[data] 数据目录落在源码/构建目录内（{}），改用 {}",
        dir.display(),
        tmp.display()
    );
    tmp
}

/// 安装版数据目录：%LOCALAPPDATA%\com.matchapuff.desktop
///
/// 必须在任何 `db::` / `conf::` 调用之前执行一次（见 main.rs 的 setup）。
/// 数据不能放在 exe 旁边：卸载或覆盖安装会连 `data/` 一起删掉，所以放这里。
pub fn init_app_data_dir(app: &AppHandle) -> PathBuf {
    let dir = outside_workspace(
        app.path()
            .app_local_data_dir()
            .unwrap_or_else(|_| fallback_dir()),
    );
    let _ = fs::create_dir_all(&dir);
    let _ = APP_DATA_DIR.set(dir.clone());
    eprintln!("[data] 数据目录：{}", dir.display());
    dir
}

pub fn data_dir() -> PathBuf {
    APP_DATA_DIR.get().cloned().unwrap_or_else(fallback_dir)
}

/** 用种子 SQL 建一个全新的库文件（已存在就先删掉） */
fn create_from_seed(db_path: &Path) -> Result<(), String> {
    let _ = fs::remove_file(db_path);
    let seed = Connection::open(db_path).map_err(|e| format!("创建数据库失败: {e}"))?;
    seed.execute_batch(SEED_SQL)
        .map_err(|e| format!("写入种子数据出错: {e}"))?;
    Ok(())
}

pub fn init() -> Result<Connection, String> {
    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("创建目录过程中出错: {e}"))?;
    let db_path = dir.join("matcha.db");

    if !db_path.exists() {
        create_from_seed(&db_path)?;
    }

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // 外部工具建的空库（没有种子表）无法补救：备份后重建，不让应用卡死在启动页。
    if !has_table(&conn, "commands") {
        eprintln!("[db] 库缺少种子表，按坏库重建");
        drop(conn);
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let _ = fs::rename(&db_path, dir.join(format!("matcha.db.broken-{stamp}")));
        create_from_seed(&db_path)?;
        return Connection::open(&db_path).map_err(|e| e.to_string());
    }

    Ok(conn)
}

fn has_table(conn: &Connection, name: &str) -> bool {
    conn.query_row(
        "select count(*) from sqlite_master where type = 'table' and name = ?",
        params![name],
        |row| row.get::<_, i64>(0),
    )
    .map(|count| count > 0)
    .unwrap_or(false)
}

pub(crate) fn col(row: &rusqlite::Row<'_>, i: usize) -> rusqlite::Result<Value> {
    use rusqlite::types::Value as V;
    Ok(match row.get::<_, V>(i)? {
        V::Null => Value::Null,
        V::Integer(n) => json!(n),
        V::Real(f) => json!(f),
        V::Text(s) => json!(s),
        V::Blob(b) => json!(b),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 种子 SQL 是建库的唯一来源，必须能一次跑通且建出全部表。
    #[test]
    fn seed_sql_builds_expected_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SEED_SQL).expect("种子 SQL 执行失败");
        for name in ["commands", "pomodoro_docs", "pomodoro_focus"] {
            assert!(has_table(&conn, name), "种子库缺少表 {name}");
        }
    }

    /// 出厂搜索源：一律是「把输入塞进 URL」的类型，且必须带占位符，
    /// 否则工作台点下去只会打开一个死链接。
    #[test]
    fn seed_search_sources_are_url_templates() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SEED_SQL).unwrap();
        let total: i64 = conn
            .query_row("select count(*) from commands", [], |row| row.get(0))
            .unwrap();
        assert!(total >= 5, "搜索源数量异常：{total}");
        let bad: i64 = conn
            .query_row(
                "select count(*) from commands where type_id != 2 or command not like '%${query}%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(bad, 0, "存在不合规的搜索源（type 必须为 2 且带占位符）");
    }

    /// 外部工具建的空库没有种子表，init 会据此判定为坏库并重建。
    #[test]
    fn empty_db_has_no_seed_tables() {
        let conn = Connection::open_in_memory().unwrap();
        assert!(!has_table(&conn, "commands"));
    }
}
