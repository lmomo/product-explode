import { GROUP_ORDER } from './parts.js';

/**
 * 左侧部件清单：分组、搜索、选中与悬停联动
 */
export function buildPartList(parts, listHost, countHost, handlers) {
  const groups = new Map();
  for (const part of parts) {
    if (!groups.has(part.group)) groups.set(part.group, []);
    groups.get(part.group).push(part);
  }

  const order = [...GROUP_ORDER, ...groups.keys()].filter((g, i, a) => a.indexOf(g) === i);
  const rows = new Map();

  for (const g of order) {
    const list = groups.get(g);
    if (!list) continue;
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = g;
    title.dataset.group = g;
    listHost.appendChild(title);

    for (const part of list) {
      const row = document.createElement('div');
      row.className = 'part-item';
      row.dataset.id = part.id;
      row.dataset.name = part.name;
      const hex = '#' + part.color.toString(16).padStart(6, '0');
      row.innerHTML = `
        <span class="dot" style="background:${hex};color:${hex}"></span>
        <span class="pwrap">
          <span class="pname">${part.name}</span>
          <span class="pdesc">${part.use}</span>
        </span>
        <span class="pidx">${String(part.index + 1).padStart(2, '0')}</span>`;
      row.addEventListener('click', () => handlers.onSelect(part.id));
      row.addEventListener('mouseenter', () => handlers.onHover(part.id));
      row.addEventListener('mouseleave', () => handlers.onHover(null));
      listHost.appendChild(row);
      rows.set(part.id, row);
    }
  }

  countHost.textContent = `${parts.length} 个部件`;

  // 搜索过滤
  const filter = document.getElementById('part-filter');
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    listHost.querySelectorAll('.part-item').forEach((el) => {
      const hit = !q || el.dataset.name.toLowerCase().includes(q) ||
        el.textContent.toLowerCase().includes(q);
      el.style.display = hit ? '' : 'none';
    });
    listHost.querySelectorAll('.group-title').forEach((el) => {
      const g = el.dataset.group;
      let any = false;
      listHost.querySelectorAll('.part-item').forEach((row) => {
        if (row.style.display === 'none') return;
        const grp = groups.get(g) || [];
        if (grp.some((p) => p.id === row.dataset.id)) any = true;
      });
      el.style.display = any ? '' : 'none';
    });
  });

  return {
    setActive(id) {
      rows.forEach((row, key) => row.classList.toggle('active', key === id));
    },
    scrollTo(id) {
      const row = rows.get(id);
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };
}

/**
 * 右侧详情面板：展示选中部件的名称、用途、说明与规格
 */
export function buildDetail(host) {
  const empty = host.querySelector('.d-empty');
  const card = host.querySelector('.d-card');
  const idx = host.querySelector('.d-idx');
  const name = host.querySelector('.d-name');
  const short = host.querySelector('.d-short');
  const use = host.querySelector('.d-use');
  const desc = host.querySelector('.d-desc');
  const axis = host.querySelector('.d-axis');
  const specs = host.querySelector('.d-specs');
  const group = host.querySelector('.d-group');
  const dot = host.querySelector('.d-dot');

  return {
    show(part) {
      if (!part) {
        empty.hidden = false;
        card.hidden = true;
        return;
      }
      empty.hidden = true;
      card.hidden = false;
      const hex = '#' + part.color.toString(16).padStart(6, '0');
      idx.textContent = String(part.index + 1).padStart(2, '0');
      name.textContent = part.name;
      short.textContent = part.short;
      use.textContent = part.use;
      desc.textContent = part.desc;
      axis.textContent = part.axis;
      group.textContent = part.group;
      dot.style.background = hex;
      dot.style.color = hex;
      specs.innerHTML = part.specs
        .map(([k, v]) => `<div class="spec-row"><dt>${k}</dt><dd>${v}</dd></div>`)
        .join('');
      card.style.setProperty('--pc', hex);
    },
  };
}
