import * as THREE from 'three';
import './styles.css';
import { createScene } from './scene.js';
import { buildArm } from './model.js';
import { LabelLayer } from './labels.js';
import { buildPartList, buildDetail } from './ui.js';

const canvas = document.getElementById('scene');
const fatal = document.getElementById('fatal');

function showFatal(title, detail) {
  if (!fatal) return;
  fatal.hidden = false;
  fatal.querySelector('.fatal-title').textContent = title;
  fatal.querySelector('.fatal-detail').textContent = detail || '';
  const ld = document.getElementById('loading');
  if (ld) ld.classList.add('done');
}

let app = null;
try {
  app = start();
} catch (err) {
  console.error(err);
  showFatal('初始化失败', (err && err.message) || String(err));
}

function start() {
  /* ---------------- 场景 ---------------- */
  const { renderer, scene, camera, controls } = createScene(canvas);

  /* ---------------- 模型 ---------------- */
  const { root, parts } = buildArm();
  scene.add(root);
  const byId = new Map(parts.map((p) => [p.id, p]));

  const N = parts.length;
  const STEP = 1 / N;              // 每个部件占据的进度区间
  const STAGE_LABELS = parts.map((p) => p.name);

  /* ---------------- 标签 ---------------- */
  const labelLayer = new LabelLayer(parts, document.getElementById('label-layer'), document.getElementById('leader-layer'));

  /* ---------------- 状态 ---------------- */
  const state = {
    p: 0,            // 当前拆解进度 0~1
    from: 0,
    to: 0,
    t0: 0,
    dur: 0,
    tween: false,
    selected: null,
    hovered: null,
    allHighlight: false,
    spin: false,
  };

  /* ---------------- 高亮 ---------------- */
  function applyHighlight(part, strength) {
    const c = new THREE.Color(part.color);
    part.object.traverse((o) => {
      if (!o.isMesh) return;
      if (strength > 0) {
        o.material.emissive.copy(c);
        o.material.emissiveIntensity = strength;
      } else {
        o.material.emissive.copy(o.userData.baseEmissive);
        o.material.emissiveIntensity = o.userData.baseEmissiveIntensity;
      }
    });
  }

  function refreshHighlights() {
    for (const part of parts) {
      let s = 0;
      if (state.selected === part.id) s = 0.55;
      else if (state.allHighlight) s = 0.3;
      else if (state.hovered === part.id) s = 0.28;
      applyHighlight(part, s);
    }
  }

  /* ---------------- 左侧清单 + 右侧详情 ---------------- */
  const list = buildPartList(parts, document.getElementById('part-list'), document.getElementById('part-count'), {
    onSelect: (id) => selectPart(state.selected === id ? null : id, true),
    onHover: (id) => {
      state.hovered = id;
      refreshHighlights();
    },
  });

  const detail = buildDetail(document.getElementById('detail'));
  const dHint = document.getElementById('d-hint');

  /* ---------------- 选中 / 聚焦 ---------------- */
  const focus = { active: false, target: new THREE.Vector3(0, 0.85, 0), distance: 1.9 };

  function selectPart(id, focusIt) {
    state.selected = id;
    list.setActive(id);
    refreshHighlights();
    if (id) {
      const part = byId.get(id);
      const p = new THREE.Vector3();
      part.anchor.getWorldPosition(p);
      focus.target.copy(p);
      focus.distance = 1.5;
      focus.active = !!focusIt;
      autoFrame = false;
      list.scrollTo(id);
      detail.show(part);
      dHint.textContent = `第 ${part.index + 1} / ${N} 件`;
    } else {
      focus.active = false;
      detail.show(null);
      dHint.textContent = '未选中';
    }
  }

  /* ---------------- 进度控制 ---------------- */
  const slider = document.getElementById('progress');
  const cbValue = document.getElementById('cb-value');
  const cbStageText = document.getElementById('cb-stage-text');
  const btnExplode = document.getElementById('btn-explode');
  const btnAssemble = document.getElementById('btn-assemble');
  const btnNext = document.getElementById('btn-next');
  const btnPrev = document.getElementById('btn-prev');
  const stState = document.getElementById('st-state');
  const stProgress = document.getElementById('st-progress');
  const stBar = document.getElementById('st-progress-bar');
  const stCount = document.getElementById('st-count');
  stCount.textContent = `${N} 个`;

  // 阶段指示点
  const stagesHost = document.getElementById('cb-stages');
  const stageEls = STAGE_LABELS.map((label, i) => {
    const el = document.createElement('button');
    el.className = 'stage-dot';
    el.title = label;
    el.innerHTML = `<i></i><span>${String(i + 1).padStart(2, '0')}</span>`;
    el.addEventListener('click', () => {
      setProgress((i + 1) * STEP);
      selectPart(parts[i].id, false);
    });
    stagesHost.appendChild(el);
    return el;
  });

  const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  function setProgress(target, dur = 0.9) {
    const to = Math.min(1, Math.max(0, target));
    state.from = state.p;
    state.to = to;
    state.dur = dur;
    state.t0 = performance.now();
    state.tween = true;
  }

  function currentStage(p) {
    return Math.min(N, Math.floor(p / STEP + 1e-6));
  }

  function refreshProgressUI(p) {
    const pct = Math.round(p * 100);
    stProgress.textContent = `${pct}%`;
    stBar.style.width = `${pct}%`;
    cbValue.textContent = `${pct}%`;
    if (document.activeElement !== slider) slider.value = String(pct);

    const stage = currentStage(p);
    stageEls.forEach((el, i) => el.classList.toggle('done', i < stage));

    if (p <= 0.001) {
      stState.textContent = '组装态';
      cbStageText.textContent = `阶段 0 / ${N} · 组装态`;
    } else if (p >= 0.999) {
      stState.textContent = '完全拆解';
      cbStageText.textContent = `阶段 ${N} / ${N} · 完全拆解`;
    } else {
      stState.textContent = '拆解中';
      cbStageText.textContent = `阶段 ${stage} / ${N} · ${STAGE_LABELS[Math.min(stage, N - 1)]}已分离`;
    }

    btnExplode.disabled = p >= 0.999;
    btnAssemble.disabled = p <= 0.001;
    btnNext.disabled = p >= 0.999 - 1e-6;
    btnPrev.disabled = p <= 0.001 + 1e-6;
  }

  slider.addEventListener('input', () => {
    setProgress(Number(slider.value) / 100, 0.35);
  });

  btnExplode.addEventListener('click', () => setProgress(1, 1.6));
  btnAssemble.addEventListener('click', () => setProgress(0, 1.6));

  btnNext.addEventListener('click', () => {
    const stage = currentStage(state.p);
    const next = stage >= N ? 1 : stage + 1;
    setProgress(next * STEP, 0.8);
    const idx = Math.min(next, N) - 1;
    if (idx >= 0) selectPart(parts[idx].id, false);
  });

  btnPrev.addEventListener('click', () => {
    const stage = currentStage(state.p);
    const prev = stage <= 1 ? 0 : stage - 1;
    setProgress(prev * STEP, 0.8);
    if (prev === 0) selectPart(null, false);
    else selectPart(parts[prev - 1].id, false);
  });

  document.getElementById('btn-spin').addEventListener('click', (e) => {
    state.spin = !state.spin;
    controls.autoRotate = state.spin;
    controls.autoRotateSpeed = 1.2;
    e.currentTarget.classList.toggle('active', state.spin);
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    state.spin = false;
    controls.autoRotate = false;
    document.getElementById('btn-spin').classList.remove('active');
    selectPart(null);
    autoFrame = true;
    frameContent(1);
  });

  document.getElementById('btn-select-all').addEventListener('click', (e) => {
    state.allHighlight = !state.allHighlight;
    e.currentTarget.classList.toggle('active', state.allHighlight);
    e.currentTarget.textContent = state.allHighlight ? '取消全部高亮' : '高亮全部部件';
    refreshHighlights();
  });

  /* ---------------- 拾取 ---------------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos = null;

  canvas.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(root.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.partId) o = o.parent;
      if (o && o.userData.partId) {
        selectPart(o.userData.partId, true);
        return;
      }
    }
    selectPart(null);
  });

  /* ---------------- 拆解位移计算 ---------------- */
  const tmpVec = new THREE.Vector3();
  function applyProgress(p) {
    for (const part of parts) {
      const local = Math.min(1, Math.max(0, (p - part.index * STEP) / STEP));
      const e = easeInOutCubic(local);
      tmpVec.copy(part.explode).multiplyScalar(e);
      part.exp.position.copy(tmpVec);
    }
  }

  /* ---------------- 自动取景（随拆解进度调整视野） ---------------- */
  const tmpBox = new THREE.Box3();
  const tmpCenter = new THREE.Vector3();
  const tmpSize = new THREE.Vector3();
  const tmpOffset = new THREE.Vector3();
  let autoFrame = true;

  function frameContent(dt) {
    tmpBox.setFromObject(root);
    if (tmpBox.isEmpty()) return;
    tmpBox.getCenter(tmpCenter);
    tmpBox.getSize(tmpSize);
    const fov = (camera.fov * Math.PI) / 180;
    const distV = tmpSize.y / 2 / Math.tan(fov / 2);
    const distH = Math.max(tmpSize.x, tmpSize.z) / 2 / (Math.tan(fov / 2) * camera.aspect);
    const dist = Math.max(distV, distH) * 1.62 + 0.75;

    const k = 1 - Math.pow(0.02, dt);
    controls.target.lerp(tmpCenter, k);
    tmpOffset.copy(camera.position).sub(controls.target);
    const cur = tmpOffset.length() || dist;
    tmpOffset.setLength(THREE.MathUtils.lerp(cur, dist, k));
    camera.position.copy(controls.target).add(tmpOffset);
  }

  /* ---------------- 动画循环 ---------------- */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (state.tween) {
      const k = Math.min(1, (performance.now() - state.t0) / (state.dur * 1000));
      const e = easeInOutCubic(k);
      state.p = state.from + (state.to - state.from) * e;
      if (k >= 1) {
        state.p = state.to;
        state.tween = false;
        autoFrame = false;
      }
      applyProgress(state.p);
      refreshProgressUI(state.p);
      autoFrame = true;
    }

    if (autoFrame) frameContent(dt);

    // 聚焦插值
    if (focus.active) {
      controls.target.lerp(focus.target, 1 - Math.pow(0.001, dt));
      const desired = focus.distance;
      const offset = camera.position.clone().sub(controls.target);
      const cur = offset.length();
      const next = THREE.MathUtils.lerp(cur, desired, 1 - Math.pow(0.004, dt));
      offset.setLength(next);
      camera.position.copy(controls.target).add(offset);
      if (Math.abs(cur - desired) < 0.01) focus.active = false;
    }

    controls.update();

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const showLabels = state.p > 0.02 || !!state.selected;
    labelLayer.setVisible(showLabels);
    labelLayer.update(camera, w, h, state.selected);

    renderer.render(scene, camera);
  }

  applyProgress(0);
  refreshProgressUI(0);
  frameContent(1);
  animate();

  requestAnimationFrame(() => {
    const ld = document.getElementById('loading');
    if (ld) ld.classList.add('done');
  });

  window.__arm = { scene, camera, controls, parts, state, setProgress, selectPart };
  return { scene, camera, controls, parts };
}
