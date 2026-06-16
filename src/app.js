import { startCamera } from "./capture.js";
import { createGestureEngine, LANDMARK } from "./gestureEngine.js";
import { createScene } from "./scene.js";

const video = document.getElementById("video");
const canvas = document.getElementById("stage");
const statusEl = document.getElementById("status");

// preload.js 通过 contextBridge 注入 window.jarvis;
// 在普通浏览器(非Electron)里调试时这个对象不存在,代码要能兼容两种环境
const hasJarvisBridge = typeof window.jarvis !== "undefined";

const CLICK_GESTURES = new Set(["Closed_Fist", "Pointing_Up"]);

async function main() {
  statusEl.textContent = "正在加载手势识别模型...";
  const engine = await createGestureEngine();

  statusEl.textContent = "正在请求摄像头权限...";
  await startCamera(video);

  const scene3d = createScene(canvas);
  statusEl.textContent = "运行中";

  let lastGesture = "None";

  function loop() {
    if (video.readyState >= 2) {
      const hands = engine.detect(video, performance.now());

      if (hands.length > 0) {
        const hand = hands[0];
        const indexTip = hand.landmarks[LANDMARK.INDEX_TIP];

        // 镜像 + 映射到 [-1, 1] 的NDC坐标驱动3D物体
        const ndcX = -(indexTip.x * 2 - 1);
        const ndcY = -(indexTip.y * 2 - 1);
        scene3d.setHandTarget(ndcX, ndcY);

        const isClickGesture = CLICK_GESTURES.has(hand.gesture);
        scene3d.setActive(isClickGesture);

        if (hasJarvisBridge) {
          window.jarvis.sendGesture({
            x: indexTip.x, // 0-1归一化,主进程里再换算成实际屏幕像素
            y: indexTip.y,
            gesture: hand.gesture,
            click: isClickGesture && hand.gesture !== lastGesture,
          });
        }

        lastGesture = hand.gesture;
        statusEl.textContent = `手势: ${hand.gesture} (${hand.handedness}) score:${hand.gestureScore.toFixed(2)}`;
      } else {
        lastGesture = "None";
        statusEl.textContent = "未检测到手";
      }
    }

    scene3d.render();
    requestAnimationFrame(loop);
  }

  loop();
}

main().catch((err) => {
  statusEl.textContent = "初始化失败: " + err.message;
  console.error(err);
});
