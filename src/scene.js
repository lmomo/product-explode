import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DIM } from './model.js';

/**
 * 渲染器 / 相机 / 光照 / 地面环境
 * 全部使用本地依赖，不加载任何外部 CDN 资源。
 */
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a11);
  scene.fog = new THREE.Fog(0x070a11, 3.4, 9.5);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
  camera.position.set(4.0, 2.7, 4.8);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.target.set(0.7, 1.15, 0);
  controls.minDistance = 0.6;
  controls.maxDistance = 9.5;
  controls.maxPolarAngle = Math.PI * 0.92;

  /* ---------- 环境光照（IBL，使用本地 addons） ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.4;

  /* ---------- 自然光 ---------- */
  const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x0c1018, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
  key.position.set(2.6, 4.2, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.bottom = -2.2;
  key.shadow.bias = -0.0009;
  key.shadow.normalBias = 0.014;
  key.shadow.radius = 2;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x5a8cff, 1.0);
  rim.position.set(-3.2, 1.8, -2.6);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x9be8ff, 0.32);
  fill.position.set(-1.0, 0.6, 3.2);
  scene.add(fill);

  /* ---------- 地面 / 展示台 ---------- */
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5.2, 80),
    new THREE.MeshStandardMaterial({ color: 0x0c1119, roughness: 0.92, metalness: 0.12 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = DIM.groundY;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(10, 40, 0x1d5f8a, 0x14202e);
  grid.position.y = DIM.groundY + 0.001;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  scene.add(grid);

  /* 安装平台（工装底座，非拆解部件） */
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.58, 0.34, 64),
    new THREE.MeshStandardMaterial({ color: 0x121a24, roughness: 0.55, metalness: 0.6 })
  );
  pad.position.y = DIM.platformTop - 0.17;
  pad.receiveShadow = true;
  pad.castShadow = true;
  scene.add(pad);

  const padRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.47, 0.008, 10, 96),
    new THREE.MeshStandardMaterial({
      color: 0x2e9fd6, emissive: 0x1c6f96, emissiveIntensity: 1.6,
      roughness: 0.35, metalness: 0.7,
    })
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = DIM.platformTop + 0.004;
  scene.add(padRing);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.007, 10, 96),
    new THREE.MeshStandardMaterial({
      color: 0x2e9fd6, emissive: 0x1c6f96, emissiveIntensity: 1.5,
      roughness: 0.35, metalness: 0.7,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = DIM.groundY + 0.018;
  scene.add(ring);

  /* ---------- 尺寸自适应 ---------- */
  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, controls, resize };
}
