/* ============================================================
   공통 헬퍼 라이브러리 — 모든 챕터 페이지가 <script src> 로 로드.
   전역 네임스페이스 VZ 에 함수 제공.
   ============================================================ */
(function (global) {
  'use strict';

  // ---- 숫자 포맷 ----
  const fmt = (n, d = 2) => {
    if (!isFinite(n)) return '∞';
    const r = Number(n).toFixed(d);
    return Object.is(parseFloat(r), -0) ? (0).toFixed(d) : r;
  };

  // ---- 벡터/행렬 연산 ----
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  // 행벡터 v(1×n) × 행렬 W(n×m) → out(1×m).  out_j = Σ_i v_i·W[i][j]
  const vecMat = (v, W) => W[0].map((_, j) => +v.reduce((s, x, i) => s + x * W[i][j], 0).toFixed(4));
  // 행렬 A(p×n) × 행렬 B(n×m) → (p×m)
  const matMul = (A, B) =>
    A.map(row => B[0].map((_, j) => +row.reduce((s, x, k) => s + x * B[k][j], 0).toFixed(4)));
  const transpose = M => M[0].map((_, j) => M.map(r => r[j]));

  // ---- softmax (수치 안정 버전) ----
  const softmax = (arr) => {
    const m = Math.max(...arr);
    const ex = arr.map(x => Math.exp(x - m));
    const s = ex.reduce((a, b) => a + b, 0) || 1;
    return ex.map(e => e / s);
  };

  // ---- 색상 팔레트 (단어/시리즈용) ----
  const PALETTE = ['#60a5fa', '#fbbf24', '#94a3b8', '#34d399', '#f472b6', '#c084fc', '#fb7185', '#37bdf8'];

  /* ============================================================
     mxMatrix: 행렬을 대괄호+라벨+shape 로 그리는 HTML 문자열 생성
     data    : 2차원 배열
     opts:
       rowLabs : 좌측 행 라벨 배열 (string, HTML 허용)
       colLabs : 상단 열 라벨 배열
       acc     : 대괄호 색 (CSS color / var)
       title   : 상단 제목
       shape   : 하단 shape 텍스트 (예 '[4×3]')
       hlRow   : 강조할 행 인덱스 (-1=없음)
       hlCol   : 강조할 열 인덱스
       pct     : true면 값을 ×100 정수%로 표시
       fmtCell : (v,r,c)=>string  커스텀 셀 포맷
       zeroDim : true면 0을 흐리게(zero 클래스)
     ============================================================ */
  function mxMatrix(data, opts = {}) {
    const {
      rowLabs = [], colLabs = [], acc = 'var(--line)', title = '', shape = '',
      hlRow = -1, hlCol = -1, pct = false, fmtCell = null, zeroDim = false
    } = opts;
    const cols = data[0].length;
    const tmpl = `grid-template-columns:repeat(${cols},50px)`;
    const head = colLabs.length
      ? `<div class="mx-colhead" style="${tmpl}">${colLabs.map(c => `<div class="h">${c}</div>`).join('')}</div>`
      : '';
    const grid = `<div class="mx-grid" style="${tmpl}">` +
      data.map((row, r) => row.map((v, c) => {
        const cls = [
          'mx-cell',
          (r === hlRow || c === hlCol) ? 'hl' : '',
          (zeroDim && v === 0) ? 'zero' : ''
        ].filter(Boolean).join(' ');
        const txt = fmtCell ? fmtCell(v, r, c) : (pct ? Math.round(v * 100) : fmt(v));
        return `<div class="${cls}">${txt}</div>`;
      }).join('')).join('') + `</div>`;
    const rl = rowLabs.length
      ? `<div class="mx-rowlabs ${colLabs.length ? 'head-pad' : ''}">${rowLabs.map(l => `<div class="mx-rowlab">${l}</div>`).join('')}</div>`
      : '';
    return `<div class="mx" style="--acc:${acc}">${title ? `<div class="mx-title">${title}</div>` : ''}
      <div class="mx-body">${rl}<div class="mx-colwrap">${head}<div class="mx-bracket">${grid}</div></div></div>
      ${shape ? `<div class="mx-shape">${shape}</div>` : ''}</div>`;
  }

  // op 연결 (A × B = C 형태)
  function opRow(parts, ops) {
    // parts: HTML 배열, ops: 사이에 들어갈 기호 배열(parts.length-1)
    let html = '<div class="mx-op-row">';
    parts.forEach((p, i) => {
      html += p;
      if (i < ops.length) html += `<div class="mx-bigop">${ops[i]}</div>`;
    });
    return html + '</div>';
  }

  /* ============================================================
     스텝퍼: 버튼들로 패널 전환
     containerSel: 스텝 버튼 컨테이너, panelSel: 패널 셀렉터
     버튼 data-s 와 패널 data-panel 매칭
     ============================================================ */
  function setupStepper(stepperSel = '#stepper', panelSel = '[data-panel]') {
    const stepper = document.querySelector(stepperSel);
    if (!stepper) return;
    const panels = [...document.querySelectorAll(panelSel)];
    stepper.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = b.dataset.s;
      stepper.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      panels.forEach(p => p.classList.toggle('show', p.dataset.panel === s));
      const top = stepper.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }

  /* ============================================================
     뷰 토글: 두 컨테이너 사이를 전환 (single ⇄ tensor 등)
     toggleSel 안의 button[data-v] 클릭 → views[data-v] 만 표시
     onShow(v) 콜백으로 지연 렌더 가능
     ============================================================ */
  function setupViewToggle(toggleSel, views, onShow) {
    const toggle = document.querySelector(toggleSel);
    if (!toggle) return;
    const shown = {};
    toggle.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const v = b.dataset.v;
      toggle.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (onShow && !shown[v]) { onShow(v); shown[v] = true; }
      Object.keys(views).forEach(key => {
        const el = document.querySelector(views[key]);
        if (el) el.style.display = (key === v) ? '' : 'none';
      });
    });
  }

  /* ============================================================
     상단 네비 마운트: 허브 링크 + 챕터 배지
     el: 컨테이너, badge: 'CH 02 · Tensor' 등
     ============================================================ */
  function mountTopnav(sel, badge) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.innerHTML =
      `<a class="home" href="index.html">← 목차로</a><span class="chapbadge">${badge}</span>`;
  }

  // 가로 막대 행 (barrow) HTML
  function barRow(label, frac, { win = false, color = null, pctText = null } = {}) {
    const c = color || (win ? 'var(--hot)' : 'var(--q)');
    return `<div class="barrow ${win ? 'win' : ''}">
      <div class="bw">${label}${win ? ' 🏆' : ''}</div>
      <div class="track"><div class="fill" style="width:${(frac * 100).toFixed(1)}%;background:${c}"></div></div>
      <div class="pct">${pctText != null ? pctText : (frac * 100).toFixed(1) + '%'}</div>
    </div>`;
  }

  global.VZ = {
    fmt, dot, vecMat, matMul, transpose, softmax, PALETTE,
    mxMatrix, opRow, setupStepper, setupViewToggle, mountTopnav, barRow
  };
})(window);

/* ============================================================
   FSM 상태그래프 엔진 (VZ.SM) — 상태=원, 전이=화살표, self-loop 지원
   states: [{id,label,x,y}]  transitions: [{from,to,label}]
   opts: {W,H,active(현재 상태 id),r}
   ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;

  const SM = {
    draw(states, transitions, opts = {}) {
      const { W = 520, H = 340, active = null, r = 34 } = opts;
      const byId = {}; states.forEach(s => byId[s.id] = s);
      const defs = `<defs><marker id="smArw" markerWidth="11" markerHeight="11" refX="9" refY="4" orient="auto">
        <path d="M0,0 L10,4 L0,8 Z" fill="var(--muted)"/></marker>
        <marker id="smArwHot" markerWidth="11" markerHeight="11" refX="9" refY="4" orient="auto">
        <path d="M0,0 L10,4 L0,8 Z" fill="var(--hot)"/></marker></defs>`;
      let edges = '', labels = '';
      transitions.forEach(t => {
        const a = byId[t.from], b = byId[t.to];
        if (!a || !b) return;
        const hot = t.active === true;
        const col = hot ? 'var(--hot)' : 'var(--muted)';
        const mk = hot ? 'url(#smArwHot)' : 'url(#smArw)';
        const lw = hot ? 3 : 2;
        if (t.from === t.to) {                 // self-loop (노드 위 원호)
          const ly = a.y - r;
          edges += `<path d="M${a.x - 13},${ly - 2} A 20 20 0 1 1 ${a.x + 13},${ly - 2}" fill="none" stroke="${col}" stroke-width="${lw}" marker-end="${mk}"/>`;
          if (t.label) labels += `<text x="${a.x}" y="${ly - 30}" text-anchor="middle" fill="${col}" font-size="11" font-family="JetBrains Mono">${t.label}</text>`;
          return;
        }
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const sx = a.x + ux * r, sy = a.y + uy * r, ex = b.x - ux * r, ey = b.y - uy * r;
        const hasRev = transitions.some(o => o.from === t.to && o.to === t.from);
        if (hasRev) {                          // 양방향 → 곡선으로 분리
          const mx = (sx + ex) / 2 - uy * 26, my = (sy + ey) / 2 + ux * 26;
          edges += `<path d="M${sx},${sy} Q ${mx},${my} ${ex},${ey}" fill="none" stroke="${col}" stroke-width="${lw}" marker-end="${mk}"/>`;
          if (t.label) labels += `<text x="${mx}" y="${my}" text-anchor="middle" fill="${col}" font-size="11" font-family="JetBrains Mono">${t.label}</text>`;
        } else {
          edges += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${col}" stroke-width="${lw}" marker-end="${mk}"/>`;
          const mx = (sx + ex) / 2, my = (sy + ey) / 2;
          if (t.label) labels += `<text x="${mx}" y="${my - 7}" text-anchor="middle" fill="${col}" font-size="11" font-family="JetBrains Mono">${t.label}</text>`;
        }
      });
      let nodes = '';
      states.forEach(s => {
        const on = s.id === active;
        nodes += `<circle cx="${s.x}" cy="${s.y}" r="${r}" fill="${on ? 'rgba(251,191,36,.18)' : 'var(--panel-2)'}"
          stroke="${on ? 'var(--hot)' : 'var(--line)'}" stroke-width="${on ? 3 : 1.5}"/>`;
        nodes += `<text x="${s.x}" y="${s.y + 4}" text-anchor="middle" fill="${on ? 'var(--hot)' : 'var(--ink)'}" font-size="12" font-weight="700">${s.label}</text>`;
      });
      return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;display:block">${defs}${edges}${labels}${nodes}</svg>`;
    }
  };
  VZ.SM = SM;

  /* ============================================================
     Behavior Tree 엔진 (VZ.BT)
     node: {id, type:'sequence'|'selector'|'inverter'|'repeater'|'action'|'condition', name, children?, fn?(bb)->status}
     - tick(root, bb): {status, visited:[{id,status}...]} (단축평가 순서대로)
     - draw(root, statusMap, opts): SVG (자동 레이아웃)
     ============================================================ */
  const BT = {
    tick(root, bb = {}) {
      const visited = [];
      const run = (n) => {
        let st;
        if (n.type === 'sequence') {
          st = 'success';
          for (const c of n.children) { const s = run(c); if (s !== 'success') { st = s; break; } }
        } else if (n.type === 'selector') {
          st = 'failure';
          for (const c of n.children) { const s = run(c); if (s !== 'failure') { st = s; break; } }
        } else if (n.type === 'inverter') {
          const c = n.children && n.children[0];
          const s = c ? run(c) : 'failure';
          st = s === 'success' ? 'failure' : s === 'failure' ? 'success' : s;
        } else if (n.type === 'repeater') {
          const c = n.children && n.children[0];
          st = c ? run(c) : 'failure';
        } else {                              // leaf: action / condition
          st = (typeof n.fn === 'function') ? n.fn(bb) : (n.status || 'failure');
        }
        visited.push({ id: n.id, status: st });
        return st;
      };
      const status = run(root);
      return { status, visited };
    },
    layout(root, o = {}) {
      const hGap = o.hGap || 96, vGap = o.vGap || 84, x0 = o.x0 || 50, y0 = o.y0 || 36;
      let leaf = x0;
      const assign = (n, d) => {
        n._y = y0 + d * vGap;
        if (n.children && n.children.length) {
          n.children.forEach(c => assign(c, d + 1));
          n._x = (n.children[0]._x + n.children[n.children.length - 1]._x) / 2;
        } else { n._x = leaf; leaf += hGap; }
      };
      assign(root, 0);
      let mx = 0, my = 0; const walk = n => { mx = Math.max(mx, n._x); my = Math.max(my, n._y); (n.children || []).forEach(walk); };
      walk(root);
      return { W: mx + x0 + 20, H: my + 50 };
    },
    draw(root, statusMap = {}, o = {}) {
      const dim = this.layout(root, o);
      const W = o.W || dim.W, H = o.H || dim.H;
      const COL = { success: 'var(--good)', failure: 'var(--k)', running: 'var(--hot)', idle: 'var(--line)' };
      const SYM = { sequence: '→', selector: '?', inverter: '!', repeater: '↻' };
      let edges = '', nodes = '';
      const walk = (n) => {
        (n.children || []).forEach(c => {
          edges += `<line x1="${n._x}" y1="${n._y + 20}" x2="${c._x}" y2="${c._y - 20}" stroke="var(--line)" stroke-width="1.5"/>`;
          walk(c);
        });
        const st = statusMap[n.id] || 'idle';
        const col = COL[st];
        const isLeaf = n.type === 'action' || n.type === 'condition';
        const w = isLeaf ? 92 : 44, h = 40;
        const x = n._x - w / 2, y = n._y - h / 2;
        const fill = st === 'idle' ? 'var(--panel-2)' : `color-mix(in srgb, ${col} 18%, var(--panel-2))`;
        const rx = isLeaf ? 9 : (n.type === 'inverter' || n.type === 'repeater' ? 22 : 6);
        nodes += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${col}" stroke-width="2"/>`;
        if (isLeaf) {
          const tcol = n.type === 'condition' ? 'var(--q)' : 'var(--ink)';
          nodes += `<text x="${n._x}" y="${n._y + 4}" text-anchor="middle" fill="${tcol}" font-size="11" font-weight="700">${n.name || ''}</text>`;
        } else {
          nodes += `<text x="${n._x}" y="${n._y + 7}" text-anchor="middle" fill="${col === 'var(--line)' ? 'var(--muted)' : col}" font-size="20" font-weight="700" font-family="JetBrains Mono">${SYM[n.type] || ''}</text>`;
          if (n.name) nodes += `<text x="${n._x}" y="${y - 6}" text-anchor="middle" fill="var(--muted)" font-size="10" font-family="JetBrains Mono">${n.name}</text>`;
        }
      };
      walk(root);
      return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;display:block">${edges}${nodes}</svg>`;
    }
  };
  VZ.BT = BT;

  // 단계 점등 애니메이션: items를 interval 간격으로 순서대로 apply(it,i) 호출.
  // 호출할 때마다 이전 애니메이션 타이머를 모두 취소 → ▶tick 연타 시 겹침/깜빡임 방지.
  let _stepTimers = [];
  VZ.stepLight = function (items, apply, interval = 400) {
    _stepTimers.forEach(clearTimeout); _stepTimers = [];
    items.forEach((it, i) => { _stepTimers.push(setTimeout(() => apply(it, i), i * interval)); });
    return () => { _stepTimers.forEach(clearTimeout); _stepTimers = []; };  // 취소 함수
  };
})(window);

/* ============================================================
   강화학습 그리드월드 엔진 (VZ.RL)
   env: {rows, cols, walls:["r,c"...], goal:[r,c], pit:[r,c]|[[r,c]...], start:[r,c]}
   행동 인덱스: 상=0, 하=1, 좌=2, 우=3
   - gridSVG(env, opts): 그리드 SVG (가치 히트맵·정책 화살표·에이전트·자취)
   - stepState/isTerminal 등: 환경 규칙 헬퍼 (챕터 페이지가 Q-learning 등에 사용)
   ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;

  const ACT = [
    { dr: -1, dc: 0, sym: '↑', name: '상' },
    { dr: 1, dc: 0, sym: '↓', name: '하' },
    { dr: 0, dc: -1, sym: '←', name: '좌' },
    { dr: 0, dc: 1, sym: '→', name: '우' },
  ];
  const keyOf = (r, c) => r + ',' + c;
  const argmax = (arr) => { let bi = 0; for (let i = 1; i < arr.length; i++) if (arr[i] > arr[bi]) bi = i; return bi; };

  const asPits = (env) => !env.pit ? [] : (Array.isArray(env.pit[0]) ? env.pit : [env.pit]);
  const isWall = (env, r, c) => (env.walls || []).includes(keyOf(r, c));
  const isGoal = (env, r, c) => env.goal && env.goal[0] === r && env.goal[1] === c;
  const isPit = (env, r, c) => asPits(env).some(p => p[0] === r && p[1] === c);
  const isTerminal = (env, r, c) => isGoal(env, r, c) || isPit(env, r, c);

  // 다음 상태: 경계 밖/벽이면 제자리
  function stepState(env, r, c, a) {
    const nr = r + ACT[a].dr, nc = c + ACT[a].dc;
    if (nr < 0 || nc < 0 || nr >= env.rows || nc >= env.cols || isWall(env, nr, nc)) return [r, c];
    return [nr, nc];
  }

  // 값 → 발산형(음수=코랄·양수=그린) 색 (어두운 패널 위에 혼합)
  function valColor(v, vmax) {
    if (!isFinite(v) || !(vmax > 0)) return 'var(--panel-2)';  // vmax undefined/NaN 방어
    const t = Math.max(-1, Math.min(1, v / vmax));
    if (Math.abs(t) < 0.02) return 'var(--panel-2)';
    const col = t > 0 ? 'var(--good)' : 'var(--k)';
    const pct = Math.round(12 + Math.abs(t) * 60);
    return `color-mix(in srgb, ${col} ${pct}%, var(--panel-2))`;
  }

  function gridSVG(env, opts = {}) {
    const cell = opts.cell || 56, pad = 12;
    const W = env.cols * cell + pad * 2, H = env.rows * cell + pad * 2;
    const V = opts.V || null, policy = opts.policy || null;
    let vmax = opts.vmax;
    if (V && vmax == null) {
      vmax = 0;
      for (const row of V) for (const v of row) if (isFinite(v)) vmax = Math.max(vmax, Math.abs(v));
      vmax = vmax || 1;
    }
    const defs = `<defs><marker id="rlArw" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="var(--hot)"/></marker></defs>`;
    let cells = '', overlay = '';
    for (let r = 0; r < env.rows; r++) for (let c = 0; c < env.cols; c++) {
      const x = pad + c * cell, y = pad + r * cell;
      const wall = isWall(env, r, c), goal = isGoal(env, r, c), pit = isPit(env, r, c);
      let fill = 'var(--panel-2)';
      if (wall) fill = 'var(--line)';
      else if (goal) fill = 'color-mix(in srgb, var(--good) 38%, var(--panel-2))';
      else if (pit) fill = 'color-mix(in srgb, var(--k) 38%, var(--panel-2))';
      else if (V) fill = valColor(V[r][c], vmax);
      cells += `<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="7" fill="${fill}" stroke="var(--line)" stroke-width="1"/>`;
      if (goal) overlay += `<text x="${x + cell / 2}" y="${y + cell / 2 + 8}" text-anchor="middle" font-size="22"><title>목표 (+1)</title>⭐</text>`;
      else if (pit) overlay += `<text x="${x + cell / 2}" y="${y + cell / 2 + 8}" text-anchor="middle" font-size="22"><title>함정 (−1)</title>🕳️</text>`;
      else if (!wall) {
        if (opts.showVals && V) overlay += `<text x="${x + cell / 2}" y="${y + 13}" text-anchor="middle" fill="var(--muted)" font-size="9" font-family="JetBrains Mono">${VZ.fmt(V[r][c], 2)}</text>`;
        if (policy && policy[r][c] != null) {
          const a = policy[r][c], cx = x + cell / 2, cy = y + cell / 2, L = cell * 0.2;
          overlay += `<line x1="${cx - ACT[a].dc * L}" y1="${cy - ACT[a].dr * L}" x2="${cx + ACT[a].dc * L}" y2="${cy + ACT[a].dr * L}" stroke="var(--hot)" stroke-width="2" marker-end="url(#rlArw)"/>`;
        }
      }
      if (opts.highlight && opts.highlight[0] === r && opts.highlight[1] === c)
        overlay += `<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="7" fill="none" stroke="var(--hot)" stroke-width="3"/>`;
    }
    if (opts.trail) opts.trail.forEach(([r, c], i) => {
      const x = pad + c * cell + cell / 2, y = pad + r * cell + cell / 2;
      overlay += `<circle cx="${x}" cy="${y}" r="3" fill="var(--q)" opacity="${(0.2 + 0.6 * ((i + 1) / opts.trail.length)).toFixed(2)}"/>`;
    });
    if (opts.agent) {
      const [r, c] = opts.agent, x = pad + c * cell + cell / 2, y = pad + r * cell + cell / 2;
      overlay += `<text x="${x}" y="${y + 9}" text-anchor="middle" font-size="26">${opts.agentEmoji || '🤖'}</text>`;
    }
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="강화학습 그리드월드 — 로봇이 보상으로 목표까지 길을 학습하는 격자 (초록=가치 높음, 빨강=낮음, 화살표=정책)" style="max-width:100%;display:block">${defs}${cells}${overlay}</svg>`;
  }

  // 1차원 띠 렌더러 (가치 색·정책 화살표·보물/목표·에이전트). 04·05장 등 공유.
  function stripSVG(n, opts = {}) {
    const cell = opts.cell || 54, pad = 12, W = n * cell + pad * 2, H = cell + pad * 2;
    const V = opts.V || null; let vmax = opts.vmax;
    if (V && vmax == null) { vmax = 0; for (const v of V) if (isFinite(v)) vmax = Math.max(vmax, Math.abs(v)); vmax = vmax || 1; }
    const defs = `<defs><marker id="rlStripArw" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--hot)"/></marker></defs>`;
    let cells = '', over = ''; const goals = opts.goals || {};
    for (let c = 0; c < n; c++) {
      const x = pad + c * cell, y = pad, g = goals[c];
      const fill = g ? `color-mix(in srgb, ${g.col || 'var(--good)'} 38%, var(--panel-2))` : (V ? valColor(V[c], vmax) : 'var(--panel-2)');
      cells += `<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="8" fill="${fill}" stroke="var(--line)"/>`;
      if (g) over += `<text x="${x + cell / 2}" y="${y + cell / 2 + 8}" text-anchor="middle" font-size="22">${g.emoji}</text>`;
      else {
        if (opts.showVals && V) over += `<text x="${x + cell / 2}" y="${y + 14}" text-anchor="middle" fill="var(--muted)" font-size="9" font-family="JetBrains Mono">${VZ.fmt(V[c], 2)}</text>`;
        if (opts.policy && opts.policy[c] != null) {
          const a = opts.policy[c], dc = ACT[a].dc, cx = x + cell / 2, cy = y + cell / 2 + (opts.showVals ? 7 : 0), L = cell * 0.22;
          over += `<line x1="${cx - dc * L}" y1="${cy}" x2="${cx + dc * L}" y2="${cy}" stroke="var(--hot)" stroke-width="2.5" marker-end="url(#rlStripArw)"/>`;
        }
      }
    }
    if (opts.agent != null) { const x = pad + opts.agent * cell + cell / 2, y = pad + cell / 2; over += `<text x="${x}" y="${y + 9}" text-anchor="middle" font-size="26">🤖</text>`; }
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="1차원 길" style="max-width:100%;display:block">${defs}${cells}${over}</svg>`;
  }

  VZ.RL = { ACT, keyOf, argmax, asPits, isWall, isGoal, isPit, isTerminal, stepState, valColor, gridSVG, stripSVG };
})(window);

/* ============================================================
   꺾은선 차트 (VZ.linePlot) — 학습/보상 곡선용 (02·08·09·11·12장 공유)
   series: [{pts:[[x,y]...], color, label, dash?}]
   opts: {W,H, xlab, ylab, xmin,xmax,ymin,ymax (생략시 자동), legend, hline:{y,label}}
   ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;
  function linePlot(series, opts = {}) {
    const W = opts.W || 460, H = opts.H || 230, padL = 44, padR = 14, padT = opts.legend === false ? 14 : 30, padB = 34;
    const all = series.filter(s => s.pts && s.pts.length);
    let xmin = opts.xmin, xmax = opts.xmax, ymin = opts.ymin, ymax = opts.ymax;
    if (xmin == null) xmin = Math.min(...all.flatMap(s => s.pts.map(p => p[0])), 0);
    if (xmax == null) xmax = Math.max(...all.flatMap(s => s.pts.map(p => p[0])), 1);
    if (ymin == null) ymin = Math.min(...all.flatMap(s => s.pts.map(p => p[1])), 0);
    if (ymax == null) ymax = Math.max(...all.flatMap(s => s.pts.map(p => p[1])), 1);
    if (ymax === ymin) ymax = ymin + 1;
    if (xmax === xmin) xmax = xmin + 1;
    const px = x => padL + (x - xmin) / (xmax - xmin) * (W - padL - padR);
    const py = y => H - padB - (y - ymin) / (ymax - ymin) * (H - padT - padB);
    let g = '';
    // y 격자 + 눈금 (4분할)
    for (let i = 0; i <= 4; i++) {
      const yv = ymin + (ymax - ymin) * i / 4, y = py(yv);
      g += `<line class="gridline" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>`;
      g += `<text class="axislabel" x="${padL - 6}" y="${y + 3}" text-anchor="end">${VZ.fmt(yv, Math.abs(ymax - ymin) >= 10 ? 0 : 1)}</text>`;
    }
    // x 세로 격자 (4분할)
    for (let i = 1; i < 4; i++) { const xv = xmin + (xmax - xmin) * i / 4; g += `<line class="gridline" x1="${px(xv)}" y1="${padT}" x2="${px(xv)}" y2="${H - padB}"/>`; }
    // 축
    g += `<line class="axis" x1="${padL}" y1="${py(ymin)}" x2="${W - padR}" y2="${py(ymin)}"/>`;
    g += `<line class="axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}"/>`;
    // x 눈금 라벨: 시작·끝 (+ xlab 없으면 중간)
    g += `<text class="axislabel" x="${padL}" y="${H - padB + 16}" text-anchor="start">${VZ.fmt(xmin, 0)}</text>`;
    g += `<text class="axislabel" x="${W - padR}" y="${H - padB + 16}" text-anchor="end">${VZ.fmt(xmax, 0)}</text>`;
    if (opts.xlab) g += `<text class="axislabel" x="${(padL + W - padR) / 2}" y="${H - padB + 16}" text-anchor="middle">${opts.xlab}</text>`;
    else g += `<text class="axislabel" x="${px((xmin + xmax) / 2)}" y="${H - padB + 16}" text-anchor="middle">${VZ.fmt((xmin + xmax) / 2, 0)}</text>`;
    if (opts.ylab) g += `<text class="axislabel" x="${padL - 30}" y="${(padT + H - padB) / 2}" text-anchor="middle" transform="rotate(-90 ${padL - 30} ${(padT + H - padB) / 2})">${opts.ylab}</text>`;
    if (opts.hline) {
      const y = py(opts.hline.y);
      g += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--faint)" stroke-width="1" stroke-dasharray="4 3"/>`;
      if (opts.hline.label) g += `<text class="axislabel" x="${W - padR}" y="${y - 4}" text-anchor="end" fill="var(--faint)">${opts.hline.label}</text>`;
    }
    // 시리즈
    all.forEach(s => {
      const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`;
    });
    // 범례
    if (opts.legend !== false) {
      let lx = padL;
      all.forEach(s => {
        if (!s.label) return;
        g += `<line x1="${lx}" y1="10" x2="${lx + 16}" y2="10" stroke="${s.color}" stroke-width="3" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
        g += `<text x="${lx + 20}" y="13" font-size="11" font-family="JetBrains Mono" fill="var(--muted)">${s.label}</text>`;
        lx += 26 + (s.label.length * 7.2);
      });
    }
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;display:block">${g}</svg>`;
  }
  VZ.linePlot = linePlot;
})(window);
