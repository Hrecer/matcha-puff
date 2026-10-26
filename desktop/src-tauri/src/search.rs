use rusqlite::Connection;
use serde_json::Value;

fn get_s(msg: &Value, key: &str) -> Option<String> {
    msg.get(key).and_then(Value::as_str).map(|s| s.to_string())
}

fn get_i64(msg: &Value, key: &str) -> Option<i64> {
    msg.get(key).and_then(Value::as_i64)
}

pub fn add_search(conn: &Connection, msg: &Value) -> Result<(), String> {
    conn.execute(
        "insert into commands ( name, description,icon, color, type_id, command, always_show, state, weight) values (?,'',?,?,?,?,1,1, (select max(weight) from commands) + 1)",
        rusqlite::params![
            get_s(msg, "name").unwrap_or_default(),
            get_s(msg, "icon").unwrap_or_default(),
            get_s(msg, "color").unwrap_or_default(),
            get_i64(msg, "typeId"),
            get_s(msg, "command").unwrap_or_default(),
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_search_state_by_code(conn: &Connection, msg: &Value) -> Result<(), String> {
    conn.execute(
        "update commands set state = ? where id = ?",
        rusqlite::params![get_i64(msg, "state"), get_i64(msg, "id")],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_command_sort(conn: &Connection, msg: &Value) -> Result<(), String> {
    conn.execute(
        "update commands set weight = ? where id = ?",
        rusqlite::params![get_i64(msg, "weight"), get_i64(msg, "id")],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_command_by_id(conn: &Connection, msg: &Value) -> Result<(), String> {
    conn.execute(
        "delete from commands where id = ?",
        rusqlite::params![get_i64(msg, "id")],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn rows_to_array(
    stmt: &mut rusqlite::Statement<'_>,
    params: impl rusqlite::Params,
    map: impl Fn(&rusqlite::Row<'_>) -> rusqlite::Result<Value> + Copy,
) -> Result<Value, String> {
    let rows = stmt.query_map(params, map).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(Value::Array(out))
}

const COMMAND_COLUMNS: &str =
    "id, type_id, icon, name, description, command, color, version, state, always_show, created_at";

pub fn find_search_by_type(conn: &Connection, search_type: i64) -> Result<Value, String> {
    let (sql, params): (String, Vec<i64>) = if search_type == 0 {
        (
            format!("select {COMMAND_COLUMNS} from commands where state = 1 order by weight asc"),
            vec![],
        )
    } else {
        (
            format!("select {COMMAND_COLUMNS} from commands where type_id = ? order by weight asc"),
            vec![search_type],
        )
    };
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    rows_to_array(&mut stmt, rusqlite::params_from_iter(params), command_row)
}

fn command_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(serde_json::json!({
        "id": crate::db::col(r, 0)?,
        "type_id": crate::db::col(r, 1)?,
        "icon": crate::db::col(r, 2)?,
        "name": crate::db::col(r, 3)?,
        "description": crate::db::col(r, 4)?,
        "command": crate::db::col(r, 5)?,
        "color": crate::db::col(r, 6)?,
        "version": crate::db::col(r, 7)?,
        "state": crate::db::col(r, 8)?,
        "always_show": crate::db::col(r, 9)?,
        "created_at": crate::db::col(r, 10)?,
    }))
}

pub fn search_command_by_code(conn: &Connection, code: &str) -> Result<Value, String> {
    if code.is_empty() {
        let mut stmt = conn
            .prepare(&format!(
                "select {COMMAND_COLUMNS} from commands where state = 1 and always_show = 1 order by weight asc"
            ))
            .map_err(|e| e.to_string())?;
        return rows_to_array(&mut stmt, [], command_row);
    }

    let like = format!("%{code}%");
    let mut stmt = conn
        .prepare(&format!(
            "select {COMMAND_COLUMNS} from commands where state = 1 and (name like ? or description like ?) order by weight asc"
        ))
        .map_err(|e| e.to_string())?;
    rows_to_array(&mut stmt, rusqlite::params![like, like], command_row)
}
