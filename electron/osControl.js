const { mouse, Point } = require("@nut-tree-fork/nut-js");

// setPosition 直接跳转到目标坐标,不受 mouseSpeed 限制。
// 平滑感由 gestureEngine.js 中的 EMA 滤波保证;此处保留配置供后续 mouse.move 调用备用。
mouse.config.mouseSpeed = 2000;

async function moveTo(x, y) {
  await mouse.setPosition(new Point(x, y));
}

async function click() {
  await mouse.leftClick();
}

module.exports = { moveTo, click };
