import * as THREE from 'three';

/**
 * 3D 部件标签：HTML 卡片 + SVG 引线
 * 标签跟随部件锚点投影到屏幕，避开视口边缘。
 * 卡片内容：部件名称 + 用途说明 + 编号。
 */
export class LabelLayer {
  constructor(parts, labelHost, leaderHost) {
    this.parts = parts;
    this.host = labelHost;
    this.leader = leaderHost;
    this.items = new Map();
    this.visible = false;

    for (const part of parts) {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.innerHTML = `
        <div class="t-name"><i></i><span class="t-text"></span><span class="t-idx"></span></div>
        <div class="t-use"><em>用途</em><span class="t-use-text"></span></div>`;
      tag.querySelector('.t-text').textContent = part.name;
      tag.querySelector('.t-use-text').textContent = part.use;
      tag.querySelector('.t-idx').textContent = String(part.index + 1).padStart(2, '0');
      tag.querySelector('.t-name i').style.background = '#' + part.color.toString(16).padStart(6, '0');
      tag.style.setProperty('--pc', '#' + part.color.toString(16).padStart(6, '0'));
      this.host.appendChild(tag);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '2.6');
      this.leader.appendChild(line);
      this.leader.appendChild(dot);

      this.items.set(part.id, { tag, line, dot, part });
    }
  }

  setVisible(v) {
    this.visible = v;
    if (!v) {
      for (const item of this.items.values()) {
        item.tag.classList.remove('show');
        item.line.setAttribute('opacity', '0');
        item.dot.setAttribute('opacity', '0');
      }
    }
  }

  /** 每帧更新标签位置：标签停靠到视口左右两侧，并做纵向避让 */
  update(camera, width, height, selectedId) {
    if (!this.visible) return;
    const v = new THREE.Vector3();
    const visible = [];
    const GAP = 100;

    for (const item of this.items.values()) {
      const { part, tag, line, dot } = item;
      item.anchorWorld = item.anchorWorld || new THREE.Vector3();
      part.anchor.getWorldPosition(item.anchorWorld);
      v.copy(item.anchorWorld).project(camera);

      const behind = v.z > 1;
      const px = (v.x * 0.5 + 0.5) * width;
      const py = (-v.y * 0.5 + 0.5) * height;

      const show = !behind && px > -60 && px < width + 60 && py > -40 && py < height + 40;
      if (!show) {
        tag.classList.remove('show');
        line.setAttribute('opacity', '0');
        dot.setAttribute('opacity', '0');
        continue;
      }
      visible.push({ item, px, py });
    }

    // 左右分组
    const left = visible.filter((o) => o.px < width / 2).sort((a, b) => a.py - b.py);
    const right = visible.filter((o) => o.px >= width / 2).sort((a, b) => a.py - b.py);

    const place = (list, side) => {
      if (!list.length) return;
      let prev = -Infinity;
      for (const o of list) {
        let y = Math.max(o.py, prev + GAP);
        prev = y;
        o.ly = y;
      }
      // 超出下边界时整体上移
      const overflow = prev - (height - 24);
      if (overflow > 0) for (const o of list) o.ly -= overflow;
      for (const o of list) {
        o.lx = side === 'left' ? 14 : width - 14;
        o.side = side;
      }
    };
    place(left, 'left');
    place(right, 'right');

    for (const o of visible) {
      const { item, px, py } = o;
      const { tag, line, dot } = item;
      const part = item.part;
      const isSel = selectedId === part.id;

      const lx = Math.min(Math.max(o.lx, 40), width - 40);
      const ly = Math.min(Math.max(o.ly, 26), height - 26);

      tag.style.left = `${lx}px`;
      tag.style.top = `${ly}px`;
      tag.style.transform = o.side === 'left' ? 'translate(0, -50%)' : 'translate(-100%, -50%)';
      tag.classList.add('show');
      tag.classList.toggle('sel', isSel);
      tag.style.zIndex = isSel ? 3 : 2;

      const inner = o.side === 'left' ? lx : lx;

      line.setAttribute('x1', px);
      line.setAttribute('y1', py);
      line.setAttribute('x2', inner);
      line.setAttribute('y2', ly);
      line.setAttribute('opacity', isSel ? '0.95' : '0.45');
      line.setAttribute('stroke', isSel ? '#ffb347' : 'rgba(120,200,255,0.55)');
      dot.setAttribute('cx', px);
      dot.setAttribute('cy', py);
      dot.setAttribute('opacity', '0.95');
      dot.setAttribute('fill', isSel ? '#ffb347' : 'rgba(120,200,255,0.95)');
    }
  }
}
