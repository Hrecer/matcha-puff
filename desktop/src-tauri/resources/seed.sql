-- 抹茶泡芙 · 出厂种子数据
--
-- 只保留运行期真正需要的表：默认搜索源 + 专注文档/计时快照。
-- 工具目录来自 packages/tools 的 manifest，分类来自 src/data/categories.json，
-- 不再写进数据库。
--
-- 编译期由 db.rs 用 include_str! 读进来，首次运行（或坏库重建）时执行，
-- 生成 %LOCALAPPDATA%\com.matchapuff.desktop\matcha.db。

BEGIN TRANSACTION;

CREATE TABLE "commands"
(
    id          integer
        primary key autoincrement,
    type_id     integer,
    icon        text not null,
    name        text not null,
    description text not null,
    color       text,
    command     text,
    always_show integer   default 0,
    version     integer   default 1,
    state       integer   default 1,
    created_at  timestamp default current_timestamp
, weight integer default 0);
INSERT INTO "commands" VALUES(10,2,'ri-baidu-fill','用 百度 搜索','使用百度搜索当前内容','#38A1DB','https://www.baidu.com/s?wd=${query}',1,1,1,'2023-12-27 15:51:51',10);
INSERT INTO "commands" VALUES(16,2,'ri-zhihu-fill','用 知乎 搜索','使用知乎搜索当前内容','#0095D9','https://www.zhihu.com/search?type=content&q=${query}',1,1,1,'2023-12-27 15:51:51',16);
INSERT INTO "commands" VALUES(18,2,'ri-bilibili-fill','用 BiliBili 搜索','使用BiliBili搜索当前内容','#2792C3','https://search.bilibili.com/all?keyword=${query}',1,1,1,'2023-12-27 15:51:51',9);
INSERT INTO "commands" VALUES(19,2,'ri-windows-fill','用 Bing 搜索','使用Bing搜索当前内容','#0094C8','https://cn.bing.com/search?q=${query}',1,1,1,'2023-12-27 15:51:51',8);
INSERT INTO "commands" VALUES(22,2,'ri-google-fill','用 Google 搜索','使用Google搜索当前内容','#EA5506','https://www.google.com/search?q=${query}',1,1,1,'2023-12-27 15:51:51',12);
INSERT INTO "commands" VALUES(23,2,'ri-github-fill','用 Github 搜索','使用Github搜索当前内容','#595857','https://github.com/search?q=${query}&type=Repositories',1,1,1,'2023-12-27 15:51:51',13);
INSERT INTO "commands" VALUES(24,2,'ri-npmjs-fill','用 Npm 搜索','使用Npm搜索模块','#f52443','https://www.npmjs.com/search?q=${query}',1,1,1,'2023-12-27 15:51:51',18);
INSERT INTO "commands" VALUES(33,2,'ri-search-line','Google 翻译','','#A8D4AD','https://translate.google.com/?sl=auto&tl=auto&text=${query}&op=translate',1,1,1,'2024-01-23 02:18:50',20);

CREATE TABLE pomodoro_docs (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE pomodoro_focus (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    state      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

COMMIT;
