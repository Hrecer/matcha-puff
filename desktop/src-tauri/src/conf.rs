use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct AppConf {
    pub theme: String,
    pub startup: bool,
    /// 启动后主窗口落到的页面：index / favorites / focus
    pub home_page: String,
}

impl Default for AppConf {
    fn default() -> Self {
        Self {
            theme: "auto".into(),
            startup: false,
            home_page: "index".into(),
        }
    }
}

fn conf_path() -> std::path::PathBuf {
    crate::db::data_dir().join("matcha.conf.json")
}

pub fn load() -> AppConf {
    fs::read_to_string(conf_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(conf: &AppConf) -> Result<(), String> {
    let s = serde_json::to_string_pretty(conf).map_err(|e| e.to_string())?;
    fs::write(conf_path(), s).map_err(|e| e.to_string())
}
