import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

// wasm资源和模型文件版本要对应,已核实安装的npm包版本为0.10.35
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

// 关键点索引参考(MediaPipe标准21点手部模型)
export const LANDMARK = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
};

// EMA平滑因子: 0=完全平滑(滞后大), 1=无平滑(原始抖动)。0.35在响应性和稳定性之间取得平衡
const EMA_ALPHA = 0.35;

// 按手势分类(Left/Right)缓存上一帧平滑后的21个关键点坐标
const _smoothed = new Map();

function applyEMA(handKey, rawLandmarks) {
  if (!_smoothed.has(handKey)) {
    // 首帧:直接用原始值初始化,不引入任何滞后
    _smoothed.set(handKey, rawLandmarks.map((l) => ({ x: l.x, y: l.y, z: l.z })));
    return _smoothed.get(handKey);
  }
  const prev = _smoothed.get(handKey);
  const next = rawLandmarks.map((l, i) => ({
    x: EMA_ALPHA * l.x + (1 - EMA_ALPHA) * prev[i].x,
    y: EMA_ALPHA * l.y + (1 - EMA_ALPHA) * prev[i].y,
    z: EMA_ALPHA * l.z + (1 - EMA_ALPHA) * prev[i].z,
  }));
  _smoothed.set(handKey, next);
  return next;
}

export async function createGestureEngine({ numHands = 2, delegate = "GPU" } = {}) {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  const recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate,
    },
    runningMode: "VIDEO",
    numHands,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  return {
    /**
     * @param {HTMLVideoElement} videoEl
     * @param {number} timestampMs 必须单调递增,通常用 performance.now()
     */
    detect(videoEl, timestampMs) {
      const result = recognizer.recognizeForVideo(videoEl, timestampMs);
      return normalize(result);
    },
    close() {
      recognizer.close();
    },
  };
}

function normalize(result) {
  // 清理本帧消失的手的缓存,防止下次该手再出现时使用过时位置做EMA起点
  const activeKeys = new Set(
    result.handedness.map((h) => h[0]?.categoryName ?? "Unknown")
  );
  for (const key of _smoothed.keys()) {
    if (!activeKeys.has(key)) _smoothed.delete(key);
  }

  return result.landmarks.map((landmarks, i) => {
    const handedness = result.handedness[i]?.[0]?.categoryName ?? "Unknown";
    return {
      // 21个点经EMA平滑后的坐标,x/y为0-1归一化
      landmarks: applyEMA(handedness, landmarks),
      handedness,
      gesture: result.gestures[i]?.[0]?.categoryName ?? "None",
      gestureScore: result.gestures[i]?.[0]?.score ?? 0,
    };
  });
}
