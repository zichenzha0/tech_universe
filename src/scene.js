import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.z = 6;

  const geometry = new THREE.IcosahedronGeometry(1.2, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x4fd1c5, wireframe: true });
  const core = new THREE.Mesh(geometry, material);
  scene.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.8, 0.015, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x4fd1c5, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.1, // strength
    0.4, // radius
    0.15 // threshold
  );
  composer.addPass(bloom);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // ndcX, ndcY 取值范围大约 [-1, 1],对应屏幕水平/垂直方向
  function setHandTarget(ndcX, ndcY) {
    core.position.x = ndcX * 3;
    core.position.y = ndcY * 2;
    ring.position.x = core.position.x;
    ring.position.y = core.position.y;
  }

  function setActive(active) {
    const color = active ? 0xff5a5f : 0x4fd1c5;
    material.color.set(color);
    ring.material.color.set(color);
  }

  function render() {
    core.rotation.y += 0.01;
    core.rotation.x += 0.004;
    ring.rotation.z += 0.006;
    composer.render();
  }

  return { render, setHandTarget, setActive };
}
