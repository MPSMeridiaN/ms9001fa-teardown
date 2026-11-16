// The overlay: panels around the core, built as real controls (buttons, a range input) so the page keeps
// its keyboard and screen-reader behaviour. Two compositions share one DOM: a landscape console around the
// machine, and a portrait stack for phones. Every number is a field of the load state that also poses the 3D.
import {DATA, profile} from './spec.js';

const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});

const SUBS = [
  ['overview', 'OVERVIEW', 'whole core'],
  ['inlet', 'INLET & IGV', 'bellmouth · 22 vanes'],
  ['compressor', 'COMPRESSOR', '18 stages · 15.4 : 1'],
  ['combustor', 'COMBUSTOR', '14 DLN-2.0+ cans'],
  ['turbine', 'TURBINE', '3 stages · 1–2 cooled'],
  ['rotor', 'ROTOR & BEARINGS', 'one shaft · 2 bearings'],
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
#app{position:absolute;inset:auto;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;
  background:#ecedef;color:#14171a;font-family:Inter,system-ui,sans-serif;font-size:16px;
  --ink:#14171a;--muted:#5b626a;--faint:#6d747c;--line:#d3d6da;--line2:#e3e5e8;
  --panel:#f7f7f8;--accent:#e8491d;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
#app ::selection{background:#f7d9ce;color:#14171a}
#app:focus-within{outline:none}
#gl{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;display:block}
#gl.drag{cursor:grabbing}
.pan{position:absolute;pointer-events:none}
.eyebrow,.grp-t,.row span,.opt,.cap-h,.chip,.note,.seg-h{font-family:Inter,system-ui,sans-serif}
.tnum{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}

/* ---------- header ---------- */
.p-head{left:36px;top:24px;width:1528px;display:flex;align-items:flex-end;justify-content:space-between;
  gap:24px;padding-bottom:9px;border-bottom:1px solid var(--line)}
.p-head .ttl{font-family:Inter,system-ui,sans-serif;font-size:12px;line-height:1;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)}
.p-head .ttl b{font-weight:800}
.p-head .ttl .ttl-sub{color:var(--faint);font-weight:600}
.p-head .meta{font:500 10.5px/1 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--muted);text-transform:uppercase;white-space:nowrap}

/* ---------- readout ---------- */
.p-read{left:36px;top:96px;width:404px;padding-right:56px;box-sizing:border-box}

.read-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.readout{display:flex;align-items:baseline;gap:8px}
.readout .n{font:700 82px/0.86 'JetBrains Mono',monospace;letter-spacing:-0.035em}
.readout .u{font:600 17px/1 'JetBrains Mono',monospace;color:var(--muted);letter-spacing:.02em}
.read-cap{margin-top:10px;font:500 11px/1.35 Inter,sans-serif;color:var(--muted)}
.read-cap b{color:var(--ink);font-weight:600}
.rule{height:1px;background:var(--line);margin:16px 0 2px}
.rows{margin-top:2px}
.stat-row{display:flex;justify-content:space-between;align-items:baseline;height:32px;border-bottom:1px solid var(--line2)}
.stat-row span{padding-top:9px;font:500 11px/1 Inter,sans-serif;color:var(--muted)}
.stat-row b{padding-top:7px;font:600 15px/1 'JetBrains Mono',monospace;letter-spacing:-.01em}
.stat-row b i{font-style:normal;font-size:10px;color:var(--faint);margin-left:3px;letter-spacing:.02em}
.split{margin-top:18px}
.bl{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;
  font:500 10.5px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.bl b{font:600 12px/1 'JetBrains Mono',monospace;color:var(--ink);letter-spacing:0}
.work-bar{position:relative;height:5px;background:#dfe1e4;margin-bottom:14px}
.work-bar i{position:absolute;left:0;top:0;bottom:0;background:#41474e;transition:width .18s ease-out}
.work-bar.c i{background:var(--accent)}

/* ---------- controls ---------- */
.p-ctl{left:1164px;top:96px;width:412px;padding-left:56px;box-sizing:border-box}
.grp{margin-bottom:18px}
.grp-t{margin:0 0 8px;font:700 10px/1 Inter,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}
.opt{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
  height:31px;margin:0 0 4px;padding:0 10px;border:1px solid var(--line);background:var(--panel);
  color:var(--ink);font:600 11px/1 Inter,sans-serif;letter-spacing:.07em;text-transform:uppercase;
  cursor:pointer;transition:background .16s ease-out,border-color .16s ease-out,color .16s ease-out}
.opt:last-child{margin-bottom:0}
.opt .l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.opt .s{font:500 9.5px/1 'JetBrains Mono',monospace;letter-spacing:.02em;color:var(--faint);
  text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.opt:hover{border-color:#b9bcc2;background:#fff}
.opt:active{background:#eceef0}
.opt:focus-visible,.tog:focus-visible,.range:focus-visible,.chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.opt[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
.opt[aria-pressed="true"] .s{color:#a7adb5}
.seg{display:flex;gap:4px;margin-bottom:4px}
.seg .opt{flex:1;justify-content:center;padding:0 6px}
.seg .opt .l{font-size:10px;letter-spacing:.06em}

.tog{display:flex;align-items:center;gap:9px;width:100%;height:28px;padding:0;border:0;background:none;
  color:var(--ink);font:600 11px/1 Inter,sans-serif;letter-spacing:.07em;text-transform:uppercase;
  cursor:pointer;text-align:left}
.tog .sw{position:relative;flex:0 0 28px;width:28px;height:15px;border:1px solid #c3c6cb;background:#e6e8ea;
  transition:background .16s ease-out,border-color .16s ease-out}
.tog .sw::after{content:'';position:absolute;left:1px;top:1px;width:11px;height:11px;background:#fff;
  border:1px solid #c3c6cb;transition:left .16s ease-out,background .16s ease-out,border-color .16s ease-out}
.tog[aria-pressed="true"] .sw{background:var(--ink);border-color:var(--ink)}
.tog[aria-pressed="true"] .sw::after{left:14px;background:var(--accent);border-color:var(--ink)}
.tog:hover .sw{border-color:#9aa0a7}

.load-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:7px}
.load-head .k{font:500 10.5px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.load-head .v{font:600 17px/1 'JetBrains Mono',monospace}
.range{appearance:none;-webkit-appearance:none;display:block;width:100%;height:22px;margin:0;background:none;
  cursor:ew-resize;--fill:100%}
.range::-webkit-slider-runnable-track{height:3px;background:linear-gradient(to right,var(--accent) var(--fill),#d3d5d9 var(--fill))}
.range::-moz-range-track{height:3px;background:#d3d5d9}
.range::-moz-range-progress{height:3px;background:var(--accent)}
.range::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:14px;height:14px;margin-top:-6px;
  background:#fff;border:2px solid var(--ink);border-radius:0}
.range::-moz-range-thumb{width:12px;height:12px;background:#fff;border:2px solid var(--ink);border-radius:0}
.range-ends{display:flex;justify-content:space-between;font:500 9.5px/1 'JetBrains Mono',monospace;
  color:var(--faint);text-transform:uppercase;letter-spacing:.04em;margin-top:-2px}
.gen{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--line2);
  font:500 10.5px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.gen b{font:600 11px/1 'JetBrains Mono',monospace;color:var(--ink)}

/* ---------- chart ---------- */
.p-chart{left:36px;top:660px;width:1132px;height:192px;background:#ecedef}
.chart-cap{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--line);
  padding-bottom:7px;margin-bottom:6px}
.chart-head{margin:0;font:700 10px/1 Inter,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}
.chart-cap .chart-legend{display:flex;gap:16px;font:500 10px/1 Inter,sans-serif;letter-spacing:.05em;color:var(--muted);
  text-transform:uppercase}
.chart-cap .chart-legend s{text-decoration:none;display:flex;align-items:center;gap:6px}
.chart-cap .chart-legend u{text-decoration:none;width:16px;height:3px;display:block;background:#2b3138}
.chart-cap .chart-legend u.c{background:var(--accent)}
#chart{display:block;width:100%;height:150px}
.p-note{left:36px;top:860px;width:1132px;font:400 10.5px/1.55 Inter,sans-serif;color:var(--faint)}
.p-note b{color:var(--muted);font-weight:600}

/* ---------- callouts ---------- */
.co{position:absolute;top:0;left:0;pointer-events:none;opacity:0;transition:opacity .2s ease-out}
.co.on{opacity:1}
.co .bx{padding:4px 0 5px 10px;border-left:1px solid var(--accent);background:rgba(255,255,255,.9)}
.co .k{font:600 11px/1.25 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.co .s{font:500 10px/1.3 'JetBrains Mono',monospace;color:var(--muted);white-space:nowrap;margin-top:3px}

/* ---------- cursor + chip ---------- */
.cur{position:absolute;top:0;left:0;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;
  border:1.5px solid rgba(20,23,26,.5);background:rgba(255,255,255,.55);pointer-events:none;
  opacity:0;transition:opacity .2s;z-index:40}
.cur.on{opacity:1}
.cur::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:1.5px solid var(--accent);opacity:0}
.cur.press::after{animation:pr .45s ease-out}
@keyframes pr{0%{opacity:.9;transform:scale(.5)}100%{opacity:0;transform:scale(1.5)}}
.chip{position:absolute;left:800px;top:74px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;
  height:23px;padding:0 11px;border:1px solid var(--line);background:rgba(255,255,255,.94);color:var(--ink);
  font-size:9.5px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;white-space:nowrap;cursor:pointer;z-index:30}
.chip i{display:block;width:6px;height:6px;border-radius:50%;background:var(--accent)}
.chip[aria-pressed="true"] i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}

@media (prefers-reduced-motion: reduce){
  #app *,#app *::before,#app *::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
}

/* frame capture jumps between times: a transition would show the previous frame's state */
#app.flatbtn .opt,#app.flatbtn .tog,#app.flatbtn .co,#app.flatbtn .cur{transition:none!important}

/* ================= portrait: the same DOM, laid out in real CSS pixels ================= */
#app.port .p-head{left:16px;right:16px;top:14px;width:auto;display:block;height:50px;padding-bottom:8px;overflow:hidden}
#app.port .p-head .ttl .ttl-sub{display:none}
#app.port .p-head .ttl{font-size:11.5px;letter-spacing:.13em}
#app.port .p-head .meta{margin-top:7px;font-size:9px;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#app.port .p-read{left:16px;right:16px;top:70px;width:auto;padding-right:0}
#app.port .readout .n{font-size:54px}
#app.port .readout .u{font-size:13px}
#app.port .read-cap{margin-top:6px;font-size:10.5px;line-height:1.4}
#app.port .rule{margin-top:12px}
#app.port .rows{display:grid;grid-template-columns:1fr 1fr;column-gap:20px;margin-top:0}
#app.port .stat-row{height:29px}
#app.port .stat-row span{padding-top:9px;font-size:10.5px}
#app.port .stat-row b{padding-top:8px;font-size:13px}
#app.port .stat-row:nth-child(2),#app.port .stat-row:nth-child(4),#app.port .stat-row:nth-child(5),#app.port .stat-row:nth-child(8){display:none}
#app.port .split{display:none}
#app.port .p-chart,#app.port .p-note{display:none}
#app.port .p-ctl{left:0;right:0;top:auto;bottom:0;width:auto;max-height:58%;overflow-y:auto;overscroll-behavior:contain;
  padding:12px 16px 18px;background:#ecedef;border-top:1px solid var(--line);display:block;pointer-events:auto}
#app.port .p-ctl::-webkit-scrollbar{width:0}
#app.port .grp{margin-bottom:12px}
#app.port .grp-t{font-size:9.5px;letter-spacing:.13em;margin-bottom:6px}
#app.port .subs{display:flex;gap:4px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;
  -webkit-mask-image:linear-gradient(90deg,#000 88%,transparent 100%);mask-image:linear-gradient(90deg,#000 88%,transparent 100%)}
#app.port .subs::-webkit-scrollbar{display:none}
#app.port .subs .opt{flex:0 0 auto;width:auto;padding:0 13px;margin:0}
#app.port .opt{height:44px;font-size:10.5px;padding:0 10px;margin-bottom:4px}
#app.port .opt .s{display:none}
/* camera: five views on one line, drag mode under it */
#app.port .p-ctl > .grp:nth-child(3){display:flex;flex-wrap:wrap;gap:4px;align-items:stretch}
#app.port .p-ctl > .grp:nth-child(3) .grp-t{flex:0 0 100%}
#app.port .p-ctl > .grp:nth-child(3) .seg{flex:1 1 46%;margin:0;gap:4px}
#app.port .seg .opt{font-size:9.5px;padding:0 2px;margin:0}
#app.port .p-ctl > .grp:nth-child(4){display:flex;flex-wrap:wrap;gap:0 18px}
#app.port .p-ctl > .grp:nth-child(4) .grp-t{flex:0 0 100%}
#app.port .tog{height:38px;font-size:10.5px;width:auto}
#app.port .load-head{margin-bottom:8px}
#app.port .range{height:36px}
#app.port .range::-webkit-slider-thumb{width:20px;height:20px;margin-top:-9px}
#app.port .gen{display:none}
#app.port .range-ends{display:none}
#app.port .grp{margin-bottom:10px}
#app.port .chip{left:50%;transform:translateX(-50%);top:auto;display:flex;font-size:9px;height:26px}
`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
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
  const hd = add('div', 'pan p-head');
  hd.innerHTML = `<div class="ttl"><b>GE MS9001FA</b><span class="ttl-sub"> &nbsp;/&nbsp; gas turbine teardown</span></div>
    <div class="meta">50 Hz · 3,000 rpm · single shaft · cold-end drive · PG9351FA</div>`;

  // ------------------------------------------------------------ readout
  const read = add('div', 'pan p-read');
  read.innerHTML = `
    <div class="read-top">
      <div>
        <div class="readout"><span class="n tnum" id="mw-n">256</span><span class="u">MW</span></div>
        <div class="read-cap"><b id="mw-abs">255.6</b> MW at the generator terminals · ISO base load</div>
      </div>

    </div>
    <div class="rule"></div>
    <div class="rows">
      ${[
        ['heat', 'Heat rate', 'kJ/kWh'],
        ['eff', 'Thermal efficiency', '%'],
        ['pr', 'Pressure ratio', ':1'],
        ['flow', 'Airflow', 'kg/s'],
        ['fuel', 'Fuel · natural gas', 'kg/s'],
        ['fire', 'Firing temperature', '°C'],
        ['exh', 'Exhaust temperature', '°C'],
        ['gw', 'Generator output', 'MW'],
      ].map(([k, l]) => `<div class="stat-row"><span>${l}</span><b id="v-${k}" class="tnum">–</b></div>`).join('')}
    </div>
    <div class="split">
      <div class="bl"><span>Compressor work</span><b id="v-cw">–</b></div>
      <div class="work-bar"><i id="b-cw" style="width:0%"></i></div>
      <div class="bl"><span>Turbine work</span><b id="v-tw">–</b></div>
      <div class="work-bar c"><i id="b-tw" style="width:0%"></i></div>
    </div>`;

  // ------------------------------------------------------------ controls
  const ctl = add('div', 'pan p-ctl');
  const grp = (title, parent = ctl) => {
    const d = add('div', 'grp', parent);
    add('h3', 'grp-t', d, title);
    return d;
  };
  const btn = {};
  const gSub = grp('Subsystem');
  const subsWrap = add('div', 'subs', gSub);
  for (const [k, label, sub] of SUBS) {
    const b = add('button', 'opt', subsWrap,
      `<span class="l">${label}</span><span class="s">${sub}</span>`);
    b.type = 'button';
    b.dataset.k = k;
    b.setAttribute('aria-pressed', 'false');
    btn[k] = b;
  }
  const gCut = grp('Cutaway');
  const cutRow = add('div', 'seg', gCut);
  for (const [k, label] of CUTS) {
    const b = add('button', 'opt', cutRow, `<span class="l">${label}</span>`);
    b.type = 'button';
    b.dataset.k = k;
    b.setAttribute('aria-pressed', 'false');
    btn[k] = b;
  }
  const gView = grp('Camera');
  const viewRow1 = add('div', 'seg', gView);
  const viewRow2 = add('div', 'seg', gView);
  VIEWS.forEach(([k, label], i) => {
    const b = add('button', 'opt', i < 3 ? viewRow1 : viewRow2, `<span class="l">${label}</span>`);
    b.type = 'button';
    b.dataset.k = k;
    b.setAttribute('aria-pressed', 'false');
    b.title = `Camera: ${label}`;
    btn['view-' + k] = b;
  });
  const dragRow = add('div', 'seg', gView);
  for (const [k, label] of DRAGS) {
    const b = add('button', 'opt', dragRow, `<span class="l">${label}</span>`);
    b.type = 'button';
    b.dataset.k = k;
    b.setAttribute('aria-pressed', 'false');
    b.title = k === 'object' ? 'The part follows your finger' : 'The camera follows your finger (inverted)';
    btn['drag-' + k] = b;
  }
  const gOv = grp('Overlay');
  const gasTog = add('button', 'tog', gOv, '<span class="sw"></span><span>Gas path</span>');
  gasTog.type = 'button';
  gasTog.setAttribute('aria-pressed', 'false');
  const explTog = add('button', 'tog', gOv, '<span class="sw"></span><span>Exploded view</span>');
  explTog.type = 'button';
  explTog.setAttribute('aria-pressed', 'false');
  const gLoad = grp('Load');
  const lab = add('div', 'load-head', gLoad,
    '<span class="k">Fuel demand</span><span class="v tnum" id="v-load">100%</span>');
  const slider = add('input', 'range', gLoad);
  slider.type = 'range';
  slider.min = '5';
  slider.max = '100';
  slider.step = '1';
  slider.value = '100';
  slider.setAttribute('aria-label', 'Fuel demand, percent of base load');
  const ends = add('div', 'range-ends', gLoad, '<span>5</span><span>50</span><span>base</span>');
  add('div', 'gen', gLoad, '<span>Generator</span><b id="v-gw2" class="tnum">–</b>');

  // ------------------------------------------------------------ chart
  const chart = add('div', 'pan p-chart');
  chart.innerHTML = `<div class="chart-cap"><h3 class="chart-head">Gas path · station profile</h3>
      <div class="chart-legend"><s><u class="c"></u>temperature °C</s><s><u></u>pressure bar</s></div></div>
    <canvas id="chart" role="img" aria-label="Temperature and pressure along the machine, inlet to exhaust"></canvas>`;
  const cvs = chart.querySelector('canvas');
  const ctx = cvs.getContext('2d');

  // ------------------------------------------------------------ callouts + cursor
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'cosvg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible';
  root.appendChild(svg);
  const cos = {};
  for (const s of ['inlet', 'compressor', 'combustor', 'turbine', 'rotor', 'exhaust', 'bearing']) {
    const d = document.createElement('div');
    d.className = 'co';
    d.setAttribute('aria-hidden', 'true');
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
  cursor.setAttribute('aria-hidden', 'true');
  root.appendChild(cursor);

  const note = add('div', 'pan p-note');
  note.innerHTML =
    '<b>GE MS9001FA</b> · 255.6 MW ISO · heat rate 9,250 Btu/kWh (9,757 kJ/kWh) · pressure ratio 15.4:1 · 624 kg/s · 3,000 rpm · exhaust 609 °C. ' +
    'Stage counts and performance from GE PSP30027-06; frame proportions scaled from the published 9F cutaway. ' +
    'The panels read the same model that poses the parts.';

  // ------------------------------------------------------------ measuring
  const spots = {};
  const spotOf = (node) => {
    const r = node.getBoundingClientRect();
    const a = root.getBoundingClientRect();
    const s = a.width / app.clientWidth || 1;
    // just outside the control's left edge, so the operator's cursor never sits on the words
    return [(r.left - a.left) / s - 11, (r.top - a.top) / s + r.height / s / 2];
  };
  const measure = () => {
    for (const k of Object.keys(btn)) spots[k] = spotOf(btn[k]);
    spots.slider = spotOf(slider);
  };

  const el = {};
  for (const id of ['mw-n', 'mw-abs', 'v-heat', 'v-eff', 'v-pr', 'v-flow', 'v-fuel', 'v-fire', 'v-exh', 'v-gw', 'v-gw2', 'v-cw', 'v-tw', 'b-cw', 'b-tw', 'v-load'])
    el[id] = root.querySelector('#' + id);

  // the machine's free rectangle, so callouts never land on a panel
  let bounds = {top: 60, bottom: 660};
  const setBounds = (top, bottom) => {
    bounds = {top, bottom};
  };

  const setOn = (node, on) => {
    node.classList.toggle('on', !!on);
    node.setAttribute('aria-pressed', on ? 'true' : 'false');
  };

  // ------------------------------------------------------------ chart
  function fitCanvas() {
    const cssW = cvs.clientWidth;
    const cssH = cvs.clientHeight;
    if (!cssW || !cssH) return false;
    const dpr = 2;
    if (cvs.width !== Math.round(cssW * dpr) || cvs.height !== Math.round(cssH * dpr)) {
      cvs.width = Math.round(cssW * dpr);
      cvs.height = Math.round(cssH * dpr);
    }
    return true;
  }

  function drawChart(s) {
    if (!cvs.clientWidth || !fitCanvas()) return;
    const W = cvs.width;
    const H = cvs.height;
    const px = W / cvs.clientWidth; // device px per css px
    const g = ctx;
    g.clearRect(0, 0, W, H);
    const prof = profile(s, 150);
    const padL = 0;
    const padR = 0;
    const padT = 18 * px;
    const padB = 26 * px;
    const xOf = (u) => padL + u * (W - padL - padR);
    const yT = (t) => H - padB - (t / 1450) * (H - padT - padB);
    const yP = (p) => H - padB - (p / 17) * (H - padT - padB);

    // grid
    g.strokeStyle = 'rgba(20,23,26,.07)';
    g.lineWidth = 1 * px;
    for (let i = 1; i <= 3; i++) {
      const y = padT + ((H - padT - padB) * i) / 4;
      g.beginPath();
      g.moveTo(padL, y);
      g.lineTo(W - padR, y);
      g.stroke();
    }

    // temperature area
    const grad = g.createLinearGradient(0, padT, 0, H - padB);
    grad.addColorStop(0, 'rgba(232,73,29,0.26)');
    grad.addColorStop(1, 'rgba(232,73,29,0.03)');
    g.beginPath();
    g.moveTo(xOf(0), H - padB);
    for (const p of prof) g.lineTo(xOf(p.x), yT(p.t));
    g.lineTo(xOf(1), H - padB);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    g.beginPath();
    prof.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, xOf(p.x), yT(p.t)));
    g.strokeStyle = '#e8491d';
    g.lineWidth = 2 * px;
    g.lineJoin = 'round';
    g.stroke();

    // pressure line
    g.beginPath();
    prof.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, xOf(p.x), yP(p.p)));
    g.strokeStyle = '#2b3138';
    g.lineWidth = 2 * px;
    g.stroke();

    // station separators + names
    const segs = [
      [0, 0.05, 'INLET'],
      [0.05, 0.5, 'COMPRESSOR · 18 STAGES'],
      [0.5, 0.62, 'BURN'],
      [0.62, 0.79, 'TURBINE · 3 STAGES'],
      [0.79, 1, 'EXHAUST'],
    ];
    g.font = `500 ${10.5 * px}px Inter, sans-serif`;
    g.textBaseline = 'alphabetic';
    g.letterSpacing = `${0.8 * px}px`;
    for (const [a, b, label] of segs) {
      if (a > 0) {
        g.beginPath();
        g.setLineDash([3 * px, 5 * px]);
        g.moveTo(xOf(a), padT);
        g.lineTo(xOf(a), H - padB);
        g.strokeStyle = 'rgba(20,23,26,.16)';
        g.lineWidth = 1 * px;
        g.stroke();
        g.setLineDash([]);
      }
      const w = g.measureText(label).width;
      const mid = ((a + b) / 2) * W;
      g.fillStyle = '#5b626a';
      g.fillText(label, Math.min(W - w - 2, Math.max(2, mid - w / 2)), H - 6 * px);
    }

    // firing point + peak annotation
    const fire = prof.find((p) => p.x >= 0.62) || prof[prof.length - 1];
    g.beginPath();
    g.arc(xOf(fire.x), yT(fire.t), 3.5 * px, 0, Math.PI * 2);
    g.fillStyle = '#e8491d';
    g.fill();
    g.font = `600 ${11 * px}px 'JetBrains Mono', monospace`;
    g.letterSpacing = '0px';
    g.fillStyle = '#14171a';
    g.textAlign = 'right';
    g.fillText(`${fmt(s.firingC)} °C`, xOf(fire.x) - 8 * px, yT(fire.t) - 10 * px);
    const peak = prof.reduce((m, p) => (p.p > m.p ? p : m), prof[0]);
    g.textAlign = 'left';
    g.fillStyle = '#41474e';
    g.fillText(`${fmt(peak.p, 1)} bar`, Math.min(W - 58 * px, xOf(peak.x) + 6 * px), yP(peak.p) - 8 * px);
    g.textAlign = 'left';
  }

  // ------------------------------------------------------------ frame
  const frame = (s, ops = {}) => {
    el['mw-n'].textContent = fmt(s.genMW, 0);
    el['mw-abs'].textContent = fmt(s.genMW, 1);
    el['v-heat'].innerHTML = `${fmt(s.heatRate)}<i>kJ/kWh</i>`;
    el['v-eff'].innerHTML = `${fmt(s.eff * 100, 1)}<i>%</i>`;
    el['v-pr'].innerHTML = `${fmt(s.pr, 2)}<i>:1</i>`;
    el['v-flow'].innerHTML = `${fmt(s.mAir)}<i>kg/s</i>`;
    el['v-fuel'].innerHTML = `${fmt(s.fuel, 2)}<i>kg/s</i>`;
    el['v-fire'].innerHTML = `${fmt(s.firingC)}<i>°C</i>`;
    el['v-exh'].innerHTML = `${fmt(s.exhaustC)}<i>°C</i>`;
    el['v-gw'].innerHTML = `${fmt(s.genMW, 1)}<i>MW</i>`;
    el['v-gw2'].textContent = `${fmt(s.genMW, 1)} MW`;
    el['v-cw'].innerHTML = `${fmt(s.compMW)}<i>MW</i>`;
    el['v-tw'].innerHTML = `${fmt(s.turbMW)}<i>MW</i>`;
    el['b-cw'].style.width = `${Math.min(100, (s.compMW / 560) * 100)}%`;
    el['b-tw'].style.width = `${Math.min(100, (s.turbMW / 560) * 100)}%`;
    el['v-load'].textContent = `${Math.round(s.load * 100)}%`;
    if (ops.sliderValue !== undefined && document.activeElement !== slider) slider.value = String(Math.round(ops.sliderValue));
    slider.style.setProperty('--fill', `${((s.load * 100 - 5) / 95) * 100}%`);

    for (const [k] of SUBS) setOn(btn[k], k === ops.view);
    for (const [k] of CUTS) setOn(btn[k], k === ops.cut);
    for (const [k] of VIEWS) setOn(btn['view-' + k], k === ops.cam);
    for (const [k] of DRAGS) setOn(btn['drag-' + k], k === ops.orbit);
    setOn(gasTog, ops.gas);
    setOn(explTog, ops.explode > 0.5);

    for (const key of Object.keys(cos)) {
      cos[key].box.classList.remove('on');
      cos[key].line.style.opacity = '0';
    }
    for (const c of ops.callouts || []) {
      const p = ops.project(c.p[0], c.p[1], c.p[2]);
      const co = cos[c.key];
      if (!p || !co) continue;
      co.k.textContent = c.text;
      co.s.textContent = c.sub;
      co.box.classList.add('on');
      const [ax, ay] = p;
      const side = c.side ?? 1;
      const bw = co.box.offsetWidth || 170;
      const bx = Math.min(app.clientWidth - bw - 14, Math.max(14, ax + side * (bw * 0.55 + 44)));
      const by = Math.min(bounds.bottom - 52, Math.max(bounds.top + 6, ay - 46));
      co.box.style.transform = `translate(${bx}px, ${by}px)`;
      co.line.setAttribute('points', `${ax},${ay} ${ax + side * 30},${ay - 22} ${bx},${by + 12}`);
      co.line.style.opacity = '1';
    }

    if (ops.cursor) {
      cursor.classList.add('on');
      cursor.style.transform = `translate(${ops.cursor.x}px, ${ops.cursor.y}px)`;
      cursor.classList.toggle('press', !!ops.cursor.press);
    } else cursor.classList.remove('on');

    drawChart(s);
  };

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = '';
  root.appendChild(chip);

  measure();
  return {root, btn, cos, cursor, chart, slider, gasTog, explTog, spots, measure, frame, chip, setBounds};
}
