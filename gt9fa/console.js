// The overlay: 1600 x 900 panels around the core. Every number here is a field of the load state that
// also poses the 3D, so a gauge cannot disagree with the flame it sits next to.
import {DATA, profile, STATIONS} from './spec.js';

const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});

const SUBS = [
  ['overview', 'OVERVIEW', 'whole core'],
  ['inlet', 'INLET & IGV', 'bellmouth, 22 vanes'],
  ['compressor', 'COMPRESSOR', '18 stages, 15.4 : 1'],
  ['combustor', 'COMBUSTOR', '14 DLN-2.0+ cans'],
  ['turbine', 'TURBINE', '3 stages, cooled 1–2'],
  ['rotor', 'ROTOR & BEARINGS', 'one shaft, 2 bearings'],
  ['exhaust', 'EXHAUST', 'axial diffuser'],
];
const CUTS = [
  ['solid', 'SOLID'],
  ['glass', 'GLASS'],
  ['section', 'SECTION'],
];
const VIEWS = [
  ['hero', '3/4'],
  ['front', 'INLET'],
  ['side', 'SIDE'],
  ['axial', 'AXIAL'],
  ['detail', 'DETAIL'],
];
const DRAGS = [
  ['object', 'DRAG OBJECT'],
  ['camera', 'DRAG CAMERA'],
];

const CSS = `
#app{position:absolute;inset:auto;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;background:#ecedef;
  font-family:Inter,system-ui,sans-serif;color:#16181b;user-select:none;-webkit-font-smoothing:antialiased}
#gl{position:absolute;inset:0;width:1600px;height:900px;touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.pan{position:absolute;pointer-events:none}
.hd{left:36px;top:26px;width:1528px;height:40px;display:flex;align-items:flex-end;justify-content:space-between;border-bottom:1px solid #d4d6da;padding-bottom:8px}
.ttl{font:600 13px/1 'JetBrains Mono',monospace;letter-spacing:2.6px;text-transform:uppercase}
.ttl b{font-weight:800;font-family:Inter,sans-serif;letter-spacing:1px}
.meta{font:500 10.5px/1 'JetBrains Mono',monospace;letter-spacing:1.5px;color:#6f747b;text-transform:uppercase}
.dim{color:#9aa0a7}
.eyebrow{font:600 9.5px/1 'JetBrains Mono',monospace;letter-spacing:2.2px;color:#8b9097;text-transform:uppercase}
.big{font:700 86px/0.94 'JetBrains Mono',monospace;letter-spacing:-3px;margin-top:9px}
.big em{font-style:normal;font-size:22px;letter-spacing:0;margin-left:10px;color:#7c828a;font-weight:600}
.rule{height:1px;background:#d4d6da;margin:14px 0 0}
.rows{margin-top:5px}
.row{display:flex;justify-content:space-between;align-items:baseline;height:33px;border-bottom:1px solid #e2e4e7}
.row span{font:500 10.5px/1 'JetBrains Mono',monospace;letter-spacing:1.2px;color:#7c828a;text-transform:uppercase;padding-top:9px}
.row b{font:600 15px/1 'JetBrains Mono',monospace;padding-top:7px;font-variant-numeric:tabular-nums}
.row b i{font-style:normal;font-size:9.5px;color:#8b9097;margin-left:3px;letter-spacing:.5px}
.split{margin-top:16px}
.bar{position:relative;height:6px;background:#dcdee2;margin:5px 0 9px}
.bar i{position:absolute;left:0;top:0;bottom:0;background:#3b4249}
.bar.c i{background:#e8491d}
.bl{display:flex;justify-content:space-between;font:500 9.5px/1 'JetBrains Mono',monospace;letter-spacing:1.2px;color:#7c828a;margin-bottom:14px}
.bl b{color:#16181b;font-weight:600}
.grp{margin-bottom:20px}
.grp h4{font:600 9.5px/1 'JetBrains Mono',monospace;letter-spacing:2.2px;color:#8b9097;text-transform:uppercase;margin:0 0 8px}
#app.flatbtn .btn,#app.flatbtn .co{transition:none!important}
.btn{position:relative;height:31px;border:1px solid #d8dade;background:#f7f7f8;margin-bottom:5px;display:flex;align-items:center;
  padding:0 11px;justify-content:space-between;cursor:pointer;pointer-events:auto;transition:background .18s,border-color .18s,color .18s}
.btn small{font:500 9px/1 'JetBrains Mono',monospace;letter-spacing:.8px;color:#9599a0;text-transform:uppercase}
.btn .l{font:600 10.5px/1 'JetBrains Mono',monospace;letter-spacing:1.4px;text-transform:uppercase}
.btn:hover{background:#fff;border-color:#b9bcc2}
.btn.on{background:#16181b;border-color:#16181b;color:#fff}
.btn.on small{color:#9fa5ad}
.btn.on::before{content:'';position:absolute;left:-1px;top:-1px;bottom:-1px;width:3px;background:#e8491d}
.seg{display:flex;gap:5px;margin-bottom:5px}
.seg .btn{flex:1;justify-content:center;margin:0;padding:0}
.seg .btn .l{font-size:9.5px;letter-spacing:1px}
.tog{display:flex;align-items:center;gap:9px;height:26px;cursor:pointer;pointer-events:auto}
.tog i{width:26px;height:14px;border:1px solid #c3c6cb;background:#e6e8ea;position:relative;display:block;transition:background .2s}
.tog i::after{content:'';position:absolute;left:1px;top:1px;width:10px;height:10px;background:#fff;border:1px solid #c3c6cb;transition:left .2s}
.tog.on i{background:#16181b;border-color:#16181b}
.tog.on i::after{left:13px;border-color:#16181b;background:#e8491d}
.tog span{font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:1.3px;text-transform:uppercase}
.slider{position:relative;height:30px;margin-top:2px;pointer-events:auto;cursor:ew-resize}
.slider .trk{position:absolute;left:0;right:0;top:13px;height:3px;background:#d3d5d9}
.slider .fil{position:absolute;left:0;top:13px;height:3px;background:#e8491d}
.slider .knb{position:absolute;top:7px;width:15px;height:15px;margin-left:-7px;background:#fff;border:2px solid #16181b}
.slider .ticks{position:absolute;left:0;right:0;top:21px;display:flex;justify-content:space-between;font:500 8.5px/1 'JetBrains Mono',monospace;color:#9599a0}
.lab{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.lab .v{font:600 16px/1 'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
.chart{position:absolute;left:36px;top:672px;width:1132px;height:192px;background:#ecedef}
.chart .cap{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #d4d6da;padding-bottom:6px;margin-bottom:4px}
.chart .cap h4{margin:0;font:600 9.5px/1 'JetBrains Mono',monospace;letter-spacing:2.2px;color:#7c828a;text-transform:uppercase}
.chart .cap .lg{font:500 9px/1 'JetBrains Mono',monospace;letter-spacing:1.4px;color:#8b9097;display:flex;gap:16px}
.chart .cap .lg s{text-decoration:none;display:flex;align-items:center;gap:5px}
.chart .cap .lg u{text-decoration:none;width:14px;height:3px;display:block;background:#2b3138}
.chart .cap .lg u.c{background:#e8491d;height:2px}
.chart canvas{width:1132px;height:150px;display:block}
.note{position:absolute;left:36px;top:872px;width:1132px;font:400 9.5px/1.5 'JetBrains Mono',monospace;color:#9aa0a7;letter-spacing:.2px}
.co{position:absolute;pointer-events:none;opacity:0;transition:opacity .35s}
.co.on{opacity:1}
.co .bx{border-left:1px solid #e8491d;padding:2px 0 3px 9px;background:rgba(255,255,255,.82)}
.co .k{font:600 10px/1.2 'JetBrains Mono',monospace;letter-spacing:1.3px;text-transform:uppercase;white-space:nowrap}
.co .s{font:500 9.5px/1.3 'JetBrains Mono',monospace;color:#7c828a;letter-spacing:.4px;white-space:nowrap;margin-top:2px}
.cosvg{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none;overflow:visible}
#app.flatbtn .cur{border-color:rgba(22,24,27,.35)}
.cur{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:1.5px solid rgba(22,24,27,.5);
  background:rgba(255,255,255,.5);pointer-events:none;opacity:0;transition:opacity .2s;z-index:40}
.cur.on{opacity:1}
.cur::after{content:'';position:absolute;inset:-9px;border-radius:50%;border:1.5px solid #e8491d;opacity:0}
.cur.press::after{animation:pr .45s ease-out}
@keyframes pr{0%{opacity:.9;transform:scale(.5)}100%{opacity:0;transform:scale(1.5)}}
.tag{position:absolute;font:600 9px/1 'JetBrains Mono',monospace;letter-spacing:1.6px;color:#b3b7bd;text-transform:uppercase}
`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  // capture jumps between times: a CSS transition would show the previous frame's state
  if (window.__CAPTURE) app.classList.add('flatbtn');

  const root = document.createElement('div');
  root.className = 'oc';
  app.appendChild(root);
  const add = (tag, cls, parent = root, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    parent.appendChild(n);
    return n;
  };

  // ------------------------------------------------------------ header
  const hd = add('div', 'pan hd');
  hd.innerHTML = `<div class="ttl"><b>GE MS9001FA</b> &nbsp;/&nbsp; HEAVY-DUTY GAS TURBINE TEARDOWN</div>
    <div class="meta">50 Hz &nbsp;·&nbsp; 3,000 RPM &nbsp;·&nbsp; SINGLE SHAFT &nbsp;·&nbsp; COLD-END DRIVE &nbsp;·&nbsp; PG9351FA</div>`;

  // ------------------------------------------------------------ left readout
  const left = add('div', 'pan');
  left.style.cssText = 'left:36px;top:96px;width:404px;padding-right:56px;box-sizing:border-box;background:linear-gradient(90deg,rgba(236,237,239,0.97) 78%,rgba(236,237,239,0.55) 92%,rgba(236,237,239,0) 100%)';
  left.innerHTML = `
    <div class="eyebrow">ISO BASE LOAD OUTPUT</div>
    <div class="big" id="mw">255<em>MW</em></div>
    <div class="rule"></div>
    <div class="rows">
      ${[
        ['heat', 'HEAT RATE', 'kJ/kWh'],
        ['eff', 'THERMAL EFFICIENCY', '%'],
        ['pr', 'PRESSURE RATIO', ''],
        ['flow', 'AIRFLOW', 'kg/s'],
        ['fuel', 'FUEL · NG', 'kg/s'],
        ['fire', 'FIRING TEMPERATURE', '°C'],
        ['exh', 'EXHAUST TEMPERATURE', '°C'],
      ].map(([k, l]) => `<div class="row"><span>${l}</span><b id="v-${k}">–</b></div>`).join('')}
    </div>
    <div class="split">
      <div class="bl"><span>COMPRESSOR WORK</span><b id="v-cw">–</b></div>
      <div class="bar"><i id="b-cw" style="width:0%"></i></div>
      <div class="bl c"><span>TURBINE WORK</span><b id="v-tw">–</b></div>
      <div class="bar c"><i id="b-tw" style="width:0%"></i></div>
    </div>`;

  // ------------------------------------------------------------ right controls
  const right = add('div', 'pan');
  right.style.cssText =
    'left:1164px;top:96px;width:412px;padding-left:56px;box-sizing:border-box;pointer-events:none;background:linear-gradient(270deg,rgba(236,237,239,0.97) 78%,rgba(236,237,239,0.55) 92%,rgba(236,237,239,0) 100%)';
  const grp = (title) => {
    const d = add('div', 'grp', right);
    add('h4', null, d, title);
    return d;
  };
  const gSub = grp('Subsystems');
  const btn = {};
  for (const [k, label, sub] of SUBS) {
    const b = add('div', 'btn', gSub, `<span class="l">${label}</span><small>${sub}</small>`);
    b.dataset.k = k;
    btn[k] = b;
  }
  const gCut = grp('Cutaway');
  const cutRow = add('div', 'seg', gCut);
  for (const [k, label] of CUTS) {
    const b = add('div', 'btn', cutRow, `<span class="l">${label}</span>`);
    b.dataset.k = k;
    btn[k] = b;
  }
  const gView = grp('Camera');
  const viewRow1 = add('div', 'seg', gView);
  const viewRow2 = add('div', 'seg', gView);
  VIEWS.forEach(([k, label], i) => {
    const b = add('div', 'btn', i < 3 ? viewRow1 : viewRow2, `<span class="l">${label}</span>`);
    b.dataset.k = k;
    btn['view-' + k] = b;
  });
  const dragRow = add('div', 'seg', gView);
  for (const [k, label] of DRAGS) {
    const b = add('div', 'btn', dragRow, `<span class="l">${label}</span>`);
    b.dataset.k = k;
    b.title = k === 'object' ? 'the part follows your finger' : 'the camera follows your finger (inverted)';
    btn['drag-' + k] = b;
  }
  const gOv = grp('Overlays');
  const gasTog = add('div', 'tog', gOv, '<i></i><span>Gas path</span>');
  const explTog = add('div', 'tog', gOv, '<i></i><span>Exploded view</span>');
  const gLoad = grp('Load');
  const lab = add('div', 'lab', gLoad, `<span class="eyebrow">FUEL DEMAND</span><span class="v" id="v-load">100%</span>`);
  const slider = add('div', 'slider', gLoad,
    '<div class="trk"></div><div class="fil" id="fil"></div><div class="knb" id="knb"></div><div class="ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>BASE</span></div>');
  const loadState = add('div', 'bl', gLoad, '<span>GENERATOR</span><b id="v-gw">–</b>');

  // ------------------------------------------------------------ chart
  const chart = add('div', 'pan chart');
  chart.innerHTML = `<div class="cap"><h4>Gas path · station profile</h4>
      <div class="lg"><s><u class="c"></u>TEMPERATURE °C</s><s><u></u>PRESSURE BAR</s></div></div>
    <canvas id="chart" width="2264" height="300"></canvas>`;
  const cvs = chart.querySelector('canvas');
  const ctx = cvs.getContext('2d');

  // ------------------------------------------------------------ callouts + cursor
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cosvg');
  root.appendChild(svg);
  const cos = {};
  for (const s of ['inlet', 'compressor', 'combustor', 'turbine', 'rotor', 'exhaust', 'bearing']) {
    const d = document.createElement('div');
    d.className = 'co';
    d.innerHTML = '<div class="bx"><div class="k"></div><div class="s"></div></div>';
    root.appendChild(d);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    ln.setAttribute('fill', 'none');
    ln.setAttribute('stroke', '#e8491d');
    ln.setAttribute('stroke-width', '1');
    ln.setAttribute('opacity', '0');
    svg.appendChild(ln);
    cos[s] = {box: d, k: d.querySelector('.k'), s: d.querySelector('.s'), line: ln};
  }
  const cursor = document.createElement('div');
  cursor.className = 'cur';
  root.appendChild(cursor);

  const note = add('div', 'pan note');
  note.innerHTML =
    'GE MS9001FA · 255.6 MW ISO · heat rate 9,250 Btu/kWh (9,757 kJ/kWh) · pressure ratio 15.4:1 · 624 kg/s · 3,000 rpm · exhaust 609 °C · 18-stage compressor + 2 OGV, 14 DLN-2.0+ cans, 3-stage turbine — from GE PSP30027-06. Frame proportions scaled from the published 9F cutaway; the panels read the model, not a typed number.';

  // button screen spots (for the tour cursor)
  const spots = {};
  const spotOf = (node) => {
    const r = node.getBoundingClientRect();
    const a = root.getBoundingClientRect();
    return [r.left - a.left + r.width / 2, r.top - a.top + r.height / 2];
  };
  const measure = () => {
    for (const k of Object.keys(btn)) spots[k] = spotOf(btn[k]);
    spots.slider = spotOf(slider);
  };
  const el = {};
  for (const id of ['mw', 'v-heat', 'v-eff', 'v-pr', 'v-flow', 'v-fuel', 'v-fire', 'v-exh', 'v-cw', 'v-tw', 'b-cw', 'b-tw', 'b-cw', 'v-load', 'v-gw', 'fil', 'knb'])
    el[id] = root.querySelector('#' + id);

  // ------------------------------------------------------------ frame
  function drawChart(s) {
    const W = cvs.width;
    const H = cvs.height;
    const pad = {l: 0, r: 0, t: 10, b: 34};
    const g = ctx;
    g.clearRect(0, 0, W, H);
    const prof = profile(s, 140);
    const xOf = (u) => u * W;
    const yT = (t) => H - pad.b - ((t - 0) / 1450) * (H - pad.t - pad.b);
    const yP = (p) => H - pad.b - (p / 17) * (H - pad.t - pad.b);

    // temperature area
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(232,73,29,0.30)');
    grad.addColorStop(1, 'rgba(232,73,29,0.03)');
    g.beginPath();
    g.moveTo(0, H - pad.b);
    for (const p of prof) g.lineTo(xOf(p.x), yT(p.t));
    g.lineTo(W, H - pad.b);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    g.beginPath();
    for (const [i, p] of prof.entries()) (i ? g.lineTo : g.moveTo).call(g, xOf(p.x), yT(p.t));
    g.strokeStyle = '#e8491d';
    g.lineWidth = 2.5;
    g.stroke();

    // pressure line
    g.beginPath();
    for (const [i, p] of prof.entries()) (i ? g.lineTo : g.moveTo).call(g, xOf(p.x), yP(p.p));
    g.strokeStyle = '#2b3138';
    g.lineWidth = 2;
    g.stroke();

    // segment separators + labels
    const segs = [
      [0, 0.05, 'INLET'],
      [0.05, 0.5, 'COMPRESSOR · 18 STAGES'],
      [0.5, 0.62, 'BURN'],
      [0.62, 0.79, 'TURBINE · 3 STAGES'],
      [0.79, 1, 'EXHAUST'],
    ];
    g.font = '600 17px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    for (const [a, b, label] of segs) {
      if (a > 0) {
        g.beginPath();
        g.setLineDash([4, 6]);
        g.moveTo(xOf(a), pad.t);
        g.lineTo(xOf(a), H - pad.b);
        g.strokeStyle = 'rgba(22,24,27,0.16)';
        g.lineWidth = 1.5;
        g.stroke();
        g.setLineDash([]);
      }
      g.fillStyle = '#8b9097';
      const mid = ((a + b) / 2) * W;
      const w = g.measureText(label).width;
      g.fillText(label, Math.min(W - w, Math.max(2, mid - w / 2)), H - pad.b + 12);
    }
    // firing point marker
    const fire = prof.find((p) => p.x >= 0.62) || prof[prof.length - 1];
    g.beginPath();
    g.arc(xOf(fire.x), yT(fire.t), 4.5, 0, Math.PI * 2);
    g.fillStyle = '#e8491d';
    g.fill();
    g.font = '600 18px "JetBrains Mono", monospace';
    g.fillStyle = '#16181b';
    g.textAlign = 'right';
    g.fillText(`${fmt(s.firingC)}°C`, xOf(fire.x) - 10, yT(fire.t) - 26);
    g.textAlign = 'left';
    g.fillStyle = '#545a62';
    g.fillText(`${fmt(s.pr, 1)} bar`, W - 96, yP(s.P2) - 26);
  }

  // ------------------------------------------------------------ frame
  const setOn = (node, on) => node.classList.toggle('on', !!on);
  const frame = (s, ops = {}) => {
    el.mw.innerHTML = `${fmt(s.genMW, 0)}<em>MW</em>`;
    el['v-heat'].innerHTML = `${fmt(s.heatRate)}<i>kJ/kWh</i>`;
    el['v-eff'].innerHTML = `${fmt(s.eff * 100, 1)}<i>%</i>`;
    el['v-pr'].innerHTML = `${fmt(s.pr, 2)}<i>:1</i>`;
    el['v-flow'].innerHTML = `${fmt(s.mAir)}<i>kg/s</i>`;
    el['v-fuel'].innerHTML = `${fmt(s.fuel, 2)}<i>kg/s</i>`;
    el['v-fire'].innerHTML = `${fmt(s.firingC)}<i>°C</i>`;
    el['v-exh'].innerHTML = `${fmt(s.exhaustC)}<i>°C</i>`;
    el['v-cw'].innerHTML = `${fmt(s.compMW)}<i>MW</i>`;
    el['v-tw'].innerHTML = `${fmt(s.turbMW)}<i>MW</i>`;
    el['b-cw'].style.width = `${Math.min(100, (s.compMW / 560) * 100)}%`;
    el['b-tw'].style.width = `${Math.min(100, (s.turbMW / 560) * 100)}%`;
    el['v-load'].textContent = `${Math.round(s.load * 100)}%`;
    el['v-gw'].textContent = `${fmt(s.genMW, 1)} MW`;
    el.fil.style.width = `${s.load * 100}%`;
    el.knb.style.left = `${s.load * 100}%`;

    for (const [k] of SUBS) setOn(btn[k], k === ops.view);
    for (const [k] of CUTS) setOn(btn[k], k === ops.cut);
    for (const [k] of VIEWS) setOn(btn['view-' + k], k === ops.cam);
    for (const [k] of DRAGS) setOn(btn['drag-' + k], k === ops.orbit);
    setOn(gasTog, ops.gas);
    setOn(explTog, ops.explode > 0.5);

    for (const key of Object.keys(cos)) cos[key].box.classList.remove('on'), (cos[key].line.style.opacity = '0');
    for (const c of ops.callouts || []) {
      const p = ops.project(c.p[0], c.p[1], c.p[2]);
      const co = cos[c.key];
      if (!p || !co) continue;
      co.k.textContent = c.text;
      co.s.textContent = c.sub;
      co.box.classList.add('on');
      const [ax, ay] = p;
      const side = c.side ?? 1;
      const bw = co.box.offsetWidth || 180;
      const bx = Math.min(1156 - bw, Math.max(404, ax + side * (bw * 0.55 + 54)));
      const by = Math.min(636, Math.max(84, ay - 52));
      co.box.style.transform = `translate(${bx}px, ${by}px)`;
      co.line.setAttribute('points', `${ax},${ay} ${ax + side * 34},${ay - 26} ${bx},${by + 14}`);
      co.line.style.opacity = '1';
    }

    if (ops.cursor) {
      cursor.classList.add('on');
      cursor.style.left = `${ops.cursor.x}px`;
      cursor.style.top = `${ops.cursor.y}px`;
      if (ops.cursor.press) cursor.classList.add('press');
      else cursor.classList.remove('press');
    } else cursor.classList.remove('on');

    drawChart(s);
  };

  measure();
  return {root, btn, cos, cursor, chart, slider, gasTog, explTog, spots, measure, frame};
}
