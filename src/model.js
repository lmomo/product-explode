/**
 * 六轴工业机械臂 —— 全程序化建模（无外部模型 / 贴图 / CDN 资源）
 *
 * 结构层级（关节父子关系）：
 *   底座 base
 *    └ 腰部转台 waist   (J1 绕 Y 回转)
 *       └ 大臂 upper   (J2 绕 Z 俯仰)
 *          └ 小臂 fore (J3 绕 Z 俯仰)
 *             └ 手腕 wrist (J4 滚转 + J5 俯仰)
 *                └ 末端夹爪 grip (J6)
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PART_DEFS } from './parts.js';

export const DIM = { groundY: -0.62, platformTop: -0.28 };

/* ---------------- 材质 ---------------- */
const BASE_MATS = {
  paint: new THREE.MeshPhysicalMaterial({
    color: 0xf2a500, roughness: 0.26, metalness: 0.28,
    clearcoat: 1, clearcoatRoughness: 0.12,
  }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.45, metalness: 0.75 }),
  cast: new THREE.MeshStandardMaterial({ color: 0x3b4048, roughness: 0.7, metalness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc3c9d0, roughness: 0.22, metalness: 1 }),
  bolt: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.35, metalness: 0.9 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.85 }),
  glow: new THREE.MeshStandardMaterial({ color: 0x081018, emissive: 0x3ddc84, emissiveIntensity: 2.4, roughness: 0.4, metalness: 0.5 }),
};

/** 每个部件使用独立的材质实例，避免高亮时互相串色 */
function makeMats() {
  const out = {};
  for (const k of Object.keys(BASE_MATS)) out[k] = BASE_MATS[k].clone();
  return out;
}

/* ---------------- 通用几何工具 ---------------- */
function addMesh(geo, mat, parent, partId) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  o.receiveShadow = true;
  o.userData.partId = partId;
  o.userData.baseEmissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
  o.userData.baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
  parent.add(o);
  return o;
}

/** 拉伸带倒角侧板的臂杆轮廓（沿 +X 延伸） */
function linkGeo(len, r0, r1, depth) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r0, Math.PI / 2, Math.PI * 1.5, false);
  s.lineTo(len, -r1);
  s.absarc(len, 0, r1, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, r0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025,
    bevelSegments: 3, curveSegments: 28,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** 电机端盖：盘 + 螺栓圈 + 中心铭牌 */
function motorCap(r, parent, partId, z, dir = 1, mats) {
  const g = new THREE.Group();
  g.position.z = z;
  parent.add(g);
  const c = addMesh(new THREE.CylinderGeometry(r, r, 0.05, 40), mats.dark, g, partId);
  c.rotation.x = Math.PI / 2;
  const c2 = addMesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.02, 40), mats.cast, g, partId);
  c2.rotation.x = Math.PI / 2;
  c2.position.z = 0.03 * dir;
  const bg = new THREE.CylinderGeometry(0.012, 0.012, 0.028, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = addMesh(bg, mats.bolt, g, partId);
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, 0.03 * dir);
  }
  return g;
}

/** 线缆 */
function cable(pts, parent, partId, mats, r = 0.016) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return addMesh(new THREE.TubeGeometry(curve, 40, r, 8), mats.rubber, parent, partId);
}

/* ---------------- 主构建函数 ---------------- */
export function buildArm() {
  const root = new THREE.Group();
  const parts = [];
  const order = ['base', 'waist', 'upper', 'fore', 'wrist', 'grip'];

  /**
   * 创建一个部件：
   *  joint（关节坐标系，可旋转） → exp（爆炸位移节点） → off（零件几何）
   */
  function makePart(parent, pos, rot, id, explodeVec, anchorPos) {
    const def = PART_DEFS[id];
    const joint = new THREE.Group();
    joint.position.set(pos[0], pos[1], pos[2]);
    if (rot) joint.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(joint);

    const exp = new THREE.Group();
    joint.add(exp);

    const off = new THREE.Group();
    exp.add(off);

    const anchor = new THREE.Object3D();
    anchor.position.set(anchorPos[0], anchorPos[1], anchorPos[2]);
    off.add(anchor);

    const part = {
      id,
      index: order.indexOf(id),
      name: def.name,
      short: def.short,
      use: def.use,
      desc: def.desc,
      axis: def.axis,
      group: def.group,
      color: def.color,
      specs: def.specs,
      joint,
      exp,
      object: off,
      anchor,
      explode: new THREE.Vector3(explodeVec[0], explodeVec[1], explodeVec[2]),
    };
    parts.push(part);
    return { part, mats: makeMats(), off };
  }

  /* ---------- 1. 底座 ---------- */
  let baseOff = null;
  {
    const { part, mats, off } = makePart(root, [0, 0, 0], null, 'base', [0, 0.1, 0.7], [0, 0.06, 0.5]);
    baseOff = off;
    const plate = addMesh(new THREE.CylinderGeometry(0.56, 0.62, 0.07, 56), mats.cast, off, part.id);
    plate.position.y = 0.035;
    const col = addMesh(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 56), mats.cast, off, part.id);
    col.position.y = 0.17;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rib = addMesh(new THREE.BoxGeometry(0.045, 0.19, 0.15), mats.cast, off, part.id);
      rib.position.set(Math.cos(a) * 0.5, 0.17, Math.sin(a) * 0.5);
      rib.rotation.y = -a;
      const b = addMesh(new THREE.CylinderGeometry(0.024, 0.024, 0.045, 6), mats.bolt, off, part.id);
      b.position.set(Math.cos(a + 0.4) * 0.56, 0.09, Math.sin(a + 0.4) * 0.56);
    }
    const ring = addMesh(new THREE.TorusGeometry(0.44, 0.011, 8, 64), mats.glow, off, part.id);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.275;
    const pad = addMesh(new THREE.BoxGeometry(0.24, 0.03, 0.16), mats.rubber, off, part.id);
    pad.position.set(0, 0.005, 0.42);
  }

  /* ---------- 2. 腰部转台 ---------- */
  const waistGroup = makePart(baseOff, [0, 0.28, 0], null, 'waist', [0, 0.36, 0], [0, 0.3, 0.42]);
  {
    const { part, mats, off } = waistGroup;
    const turn = addMesh(new THREE.CylinderGeometry(0.4, 0.44, 0.16, 56), mats.paint, off, part.id);
    turn.position.y = 0.08;
    const rim = addMesh(new THREE.TorusGeometry(0.4, 0.016, 8, 64), mats.dark, off, part.id);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.15;
    for (const z of [-0.21, 0.21]) {
      const yoke = addMesh(new RoundedBoxGeometry(0.34, 0.52, 0.12, 4, 0.05), mats.paint, off, part.id);
      yoke.position.set(0.02, 0.4, z);
    }
    const back = addMesh(new RoundedBoxGeometry(0.3, 0.34, 0.5, 4, 0.06), mats.paint, off, part.id);
    back.position.set(-0.32, 0.28, 0);
    const m1 = addMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 28), mats.dark, off, part.id);
    m1.rotation.x = Math.PI / 2;
    m1.position.set(-0.32, 0.52, 0);
    const capA = motorCap(0.18, off, part.id, 0.25, 1, mats);
    capA.position.set(-0.32, 0.52, 0.25);
    const capB = motorCap(0.18, off, part.id, -0.25, -1, mats);
    capB.position.set(-0.32, 0.52, -0.25);
    const plate = addMesh(new THREE.BoxGeometry(0.16, 0.055, 0.006), mats.bolt, off, part.id);
    plate.position.set(0.06, 0.2, 0.402);
  }

  /* ---------- 3. 大臂 ---------- */
  const upperGroup = makePart(waistGroup.off, [0, 0.62, 0], [0, 0, -0.55], 'upper', [0, 0.45, -0.38], [0, 0.6, 0.16]);
  {
    const { part, mats, off } = upperGroup;
    const shoulder = addMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 32), mats.dark, off, part.id);
    shoulder.rotation.x = Math.PI / 2;
    const shCap = addMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 32), mats.cast, off, part.id);
    shCap.rotation.x = Math.PI / 2;
    shCap.position.z = 0.23;
    const beam = addMesh(linkGeo(1.15, 0.155, 0.115, 0.22), mats.paint, off, part.id);
    beam.rotation.z = Math.PI / 2;
    const rib = addMesh(new THREE.BoxGeometry(0.055, 0.78, 0.24), mats.paint, off, part.id);
    rib.position.set(-0.13, 0.58, 0);
    for (const y of [0.34, 0.62, 0.9]) {
      const cl = addMesh(new RoundedBoxGeometry(0.09, 0.045, 0.26, 2, 0.014), mats.dark, off, part.id);
      cl.position.set(-0.15, y, 0);
    }
    motorCap(0.135, off, part.id, 0.17, 1, mats).position.y = 1.15;
    motorCap(0.135, off, part.id, -0.17, -1, mats).position.y = 1.15;
    cable([[-0.16, 0.06, 0.125], [-0.2, 0.45, 0.135], [-0.19, 0.82, 0.135], [-0.12, 1.04, 0.11]], off, part.id, mats);
    cable([[-0.16, 0.06, -0.125], [-0.2, 0.45, -0.135], [-0.19, 0.82, -0.135], [-0.12, 1.04, -0.11]], off, part.id, mats);
  }

  /* ---------- 4. 小臂 ---------- */
  const foreGroup = makePart(upperGroup.off, [0, 1.15, 0], [0, 0, -0.75], 'fore', [0, 0.4, 0.4], [0, 0.42, 0.1]);
  {
    const { part, mats, off } = foreGroup;
    const elbow = addMesh(new RoundedBoxGeometry(0.34, 0.3, 0.3, 4, 0.07), mats.paint, off, part.id);
    elbow.position.set(-0.06, 0.0, 0);
    const beam = addMesh(linkGeo(0.9, 0.115, 0.085, 0.16), mats.paint, off, part.id);
    beam.rotation.z = Math.PI / 2;
    beam.position.x = 0.02;
    const m3 = addMesh(new THREE.CylinderGeometry(0.085, 0.095, 0.34, 24), mats.dark, off, part.id);
    m3.rotation.x = Math.PI / 2;
    m3.position.set(-0.05, 0, 0);
    const m3c = addMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 24), mats.cast, off, part.id);
    m3c.rotation.x = Math.PI / 2;
    m3c.position.set(-0.05, 0, 0.18);
    const m3c2 = addMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 24), mats.cast, off, part.id);
    m3c2.rotation.x = Math.PI / 2;
    m3c2.position.set(-0.05, 0, -0.18);
    const tube = addMesh(new THREE.CylinderGeometry(0.05, 0.058, 0.5, 20), mats.steel, off, part.id);
    tube.position.set(0.13, 0.5, 0.0);
    cable([[-0.18, 0.14, 0.05], [0.2, 0.16, 0.06], [0.62, 0.1, 0.05], [0.88, 0.04, 0.03]], off, part.id, mats, 0.013);
  }

  /* ---------- 5. 手腕 ---------- */
  const wristGroup = makePart(foreGroup.off, [0, 0.9, 0], [0, 0, -0.25], 'wrist', [0, 0.34, -0.32], [0, 0.1, 0.13]);
  {
    const { part, mats, off } = wristGroup;
    const ball = addMesh(new THREE.SphereGeometry(0.1, 28, 20), mats.paint, off, part.id);
    const body = addMesh(new RoundedBoxGeometry(0.15, 0.19, 0.22, 4, 0.045), mats.paint, off, part.id);
    body.position.set(0.04, 0.02, 0);
    const flange = addMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 28), mats.steel, off, part.id);
    flange.position.set(0, 0.13, 0);
    const wc1 = motorCap(0.075, off, part.id, 0.115, 1, mats);
    wc1.position.set(0, 0.02, 0.115);
    const wc2 = motorCap(0.075, off, part.id, -0.115, -1, mats);
    wc2.position.set(0, 0.02, -0.115);
  }

  /* ---------- 6. 末端夹爪 ---------- */
  const gripGroup = makePart(wristGroup.off, [0, 0.2, 0], null, 'grip', [0, 0.3, 0.32], [0, 0.22, 0.08]);
  {
    const { part, mats, off } = gripGroup;
    /* 夹爪沿 +Y（工具轴线）延伸，手指沿 Z 开合 */
    const body = addMesh(new RoundedBoxGeometry(0.17, 0.14, 0.15, 3, 0.026), mats.dark, off, part.id);
    body.position.set(0, 0.07, 0);
    const valve = addMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 12), mats.steel, off, part.id);
    valve.rotation.z = Math.PI / 2;
    valve.position.set(0.105, 0.07, 0);
    const sensor = addMesh(new THREE.BoxGeometry(0.03, 0.02, 0.02), mats.glow, off, part.id);
    sensor.position.set(0, 0.13, 0.07);
    for (const s of [-1, 1]) {
      const f = new THREE.Group();
      f.position.set(0, 0.14, s * 0.05);
      off.add(f);
      addMesh(new THREE.BoxGeometry(0.09, 0.17, 0.028), mats.steel, f, part.id).position.y = 0.075;
      const pad = addMesh(new THREE.BoxGeometry(0.08, 0.06, 0.014), mats.rubber, f, part.id);
      pad.position.set(0, 0.12, -s * 0.02);
    }
  }

  /* ---------- 拆解位移（沿父级关节坐标系的分离方向） ---------- */
  parts.sort((a, b) => a.index - b.index);
  root.position.y = DIM.platformTop;

  return { root, parts };
}
