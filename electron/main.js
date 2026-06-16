const { app, BrowserWindow, ipcMain, screen, systemPreferences, session } = require("electron");
const path = require("node:path");
const { moveTo, click } = require("./osControl");

// 设为 true 后食指坐标会实时驱动系统鼠标;握拳/比1触发左键点击
const ENABLE_OS_CONTROL = true;

let mainWindow;
// 运行时确认辅助功能权限已授予;macOS 上 nut-js 依赖此权限操作鼠标
let accessibilityGranted = false;

function toScreenPoint(normalizedX, normalizedY) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.round(normalizedX * width),
    y: Math.round(normalizedY * height),
  };
}

async function requestCameraPermission() {
  if (process.platform !== "darwin") return;
  const status = systemPreferences.getMediaAccessStatus("camera");
  if (status !== "granted") {
    const granted = await systemPreferences.askForMediaAccess("camera");
    if (!granted) console.warn("[main] 摄像头权限被拒绝");
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // HUD是全屏透明覆盖层,必须让鼠标事件穿透到下层窗口;
  // forward:true 保证自身仍能收到 mousemove 用于内部逻辑
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // 允许渲染进程调用 getUserMedia 获取摄像头
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === "media") return callback(true);
      callback(false);
    }
  );

  // 开发阶段连接 vite dev server;打包发布时改成:
  // mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(async () => {
  await requestCameraPermission();

  if (process.platform === "darwin" && ENABLE_OS_CONTROL) {
    // prompt=true 会弹出系统"辅助功能"权限请求对话框
    accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(true);
    if (!accessibilityGranted) {
      console.warn(
        "[main] 辅助功能权限未授予 — 请在 系统设置 > 隐私与安全 > 辅助功能 中添加本应用后重启"
      );
    }
  } else {
    accessibilityGranted = true;
  }

  createWindow();

  ipcMain.on("gesture-event", async (_event, payload) => {
    const { x, y, gesture, click: isClick } = payload;
    const point = toScreenPoint(x, y);

    console.log("[gesture]", gesture, point, isClick ? "CLICK" : "");

    if (!ENABLE_OS_CONTROL || !accessibilityGranted) return;

    try {
      await moveTo(point.x, point.y);
      if (isClick) await click();
    } catch (err) {
      console.error("[osControl error]", err);
    }
  });

  // ── voice-command IPC ────────────────────────────────────────────────────────
  // 占位通道,留给后续语音识别 + LLM大脑模块接入。
  // 预期 payload: { command: string, context?: object }
  ipcMain.on("voice-command", (_event, payload) => {
    console.log("[voice-command]", payload);
    // TODO: 接入语音识别转文字 → LLM推理 → 动作派发
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
