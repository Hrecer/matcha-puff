// 宿主协议注入层：向前端暴露 v1_ipc 协议（命令 / 模块调用 / 回调 / 事件）
// 为还原前端提供 v1 风格运行时全局；所有消息汇入后端 v1_ipc 单通道。
(function () {
  var LABEL = "__WINDOW_LABEL__";
  var WINDOWS = __WINDOWS_JSON__;

  window.__TAURI_METADATA__ = {
    __windows: WINDOWS.map(function (l) {
      return { label: l };
    }),
    __currentWindow: { label: LABEL },
  };

  window.__TAURI__ = window.__TAURI__ || {};
  window.__TAURI__.convertFileSrc = function (path, protocol) {
    return window.__TAURI_INTERNALS__.convertFileSrc(path, protocol || "asset");
  };

  window.__TAURI_IPC__ = function (message) {
    if (message) {
      message.__callerLabel = LABEL;
    }
    return window.__TAURI_INTERNALS__.invoke("v1_ipc", { message: message }).then(
      function (res) {
        if (message.callback != null && window["_" + message.callback]) {
          window["_" + message.callback](res);
        }
      },
      function (err) {
        if (message.error != null && window["_" + message.error]) {
          window["_" + message.error](String(err));
        }
      }
    );
  };

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    console.error("[host] unhandled rejection:", String((r && (r.stack || r.message)) || r));
  });
})();
