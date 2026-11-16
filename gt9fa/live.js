// The page you drive: buttons for every subsystem, three cutaways, five cameras, the gas path,
// the exploded view and a load slider — and when nobody touches it, a tour that presses the buttons itself.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole} from './console.js';
import {createStage} from './stage.js';
import {simulate} from './spec.js';

const W = 1600;
const H = 900;
const D2R = Math.PI / 180;
const IDLE = 25;
const SHOW = 1 / 50; // rotor motion is shown at 1/50 of 3,000 rpm
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// ---------------------------------------------------------------- cameras
// az: degrees around +y from +z, el: above the horizon, d: metres
const CAMS = {
  hero: {tx: 0.15, ty: 0.05, tz: 0, az: -30, el: 13, d: 31.0},
  front: {tx: -5.1, ty: 0, tz: 0, az: -106, el: 10, d: 8.6},
  side: {tx: -0.2, ty: 0.05, tz: 0, az: -4, el: 4, d: 32},
  axial: {tx: 1.2, ty: 0, tz: 0, az: 84, el: 4, d: 20},
  detail: {tx: 2.3, ty: 0, tz: 0, az: -16, el: 12, d: 11.5},
  inlet: {tx: -5.1, ty: 0, tz: 0, az: -56, el: 14, d: 10.0},
  compressor: {tx: -2.75, ty: 0, tz: 0, az: -24, el: 12, d: 13.5},
  combustor: {tx: 0.5, ty: 0.05, tz: 0, az: -58, el: 21, d: 14.0},
  turbine: {tx: 2.3, ty: 0, tz: 0, az: -52, el: 20, d: 8.4},
  rotor: {tx: -0.9, ty: 0, tz: 0, az: -54, el: 8, d: 15.5},
  bearings: {tx: -5.0, ty: 0, tz: 0, az: -40, el: 20, d: 9.5},
  exhaust: {tx: 4.3, ty: 0.1, tz: 0, az: 118, el: 16, d: 13.5},
};

const ISO = {
  overview: null,
  inlet: ['inlet'],
  compressor: ['compCase', 'compRotor', 'compStator', 'shaft'],
  combustor: {cans: 0.6, combCase: 0.12, compCase: 0.06, turbCase: 0.05},
  turbine: {turbCase: 1, turbRotor: 1, turbStator: 1, shaft: 0.22},
  rotor: ['compRotor', 'turbRotor', 'shaft', 'bearings'],
  exhaust: ['exhaust'],
};

const CALLS = {
  overview: [],
  inlet: [['inlet', 'BELLMOUTH + IGV', 'inlet air · 15 °C', 'inlet', -1]],
  compressor: [['compressor', 'COMPRESSOR · 18 STAGES', '15.4 : 1 · exit 403 °C', 'compressor', -1]],
  combustor: [['combustor', '14 DLN-2.0+ CANS', 'firing 1,315 °C', 'combustor', 1]],
  turbine: [['turbine', 'TURBINE · 3 STAGES', 'stage 1–2 buckets air-cooled', 'turbine', 1]],
  rotor: [['rotor', 'SINGLE ROTOR', 'one shaft · 3,000 rpm · 2 bearings', 'rotor', -1]],
  bearings: [['bearing', 'NO.1 JOURNAL BEARING', 'forward · carries the compressor', 'bearings', -1]],
  exhaust: [['exhaust', 'AXIAL EXHAUST DIFFUSER', 'exit 609 °C', 'exhaust', 1]],
};

// ---------------------------------------------------------------- the tour
// one row per beat: when, which subsystem, which camera, what the operator does to the machine
const TOUR = [
  {t: 0, view: 'overview', cam: 'hero', load: 1, gas: 0, explode: 0, cut: 'glass'},
  {t: 5, view: 'inlet', cam: 'inlet', load: 1, gas: 0, explode: 0, cut: 'glass', press: 'inlet'},
  {t: 11, view: 'compressor', cam: 'compressor', load: 1, gas: 1, explode: 0, cut: 'section', press: 'compressor'},
  {t: 18.5, view: 'combustor', cam: 'combustor', load: 0.78, gas: 1, explode: 0, cut: 'glass', press: 'combustor'},
  {t: 26, view: 'turbine', cam: 'turbine', load: 1, gas: 1, explode: 0, cut: 'glass', press: 'turbine'},
  {t: 33, view: 'rotor', cam: 'rotor', load: 1, gas: 0, explode: 0, cut: 'solid', press: 'rotor'},
  {t: 40.5, view: 'overview', cam: 'hero', load: 1, gas: 0, explode: 1, cut: 'glass', press: 'exhaust'},
  {t: 47.5, view: 'combustor', cam: 'detail', load: 0.9, gas: 1, explode: 0, cut: 'section', press: 'combustor'},
  {t: 54, view: 'overview', cam: 'hero', load: 1, gas: 0, explode: 0, cut: 'glass'},
];
const TOUR_LEN = 60;

export function runLive() {
  document.title = 'GE MS9001FA — Gas Turbine Teardown';
  const style = document.createElement('style');
  style.textContent = `
    html,body{background:#ecedef;overflow:hidden;margin:0;overscroll-behavior:none}
    #app{position:absolute;inset:auto!important;left:0;top:0;transform-origin:0 0}
  `;
  document.head.appendChild(style);

  const app = document.getElementById('app');
  // two compositions: a landscape console around the machine, a portrait stack for phones.
  // landscape is a fixed 1600 x 900 board scaled to the window; portrait lays out in real CSS pixels,
  // so touch targets stay 44 px and type stays legible.
  const sizeFor = (m) => (m === 'land' ? [1600, 900] : [Math.max(320, innerWidth), Math.max(560, innerHeight)]);
  const modeOf = () => (innerWidth / Math.max(1, innerHeight) >= 1.25 ? 'land' : 'port');
  let mode = modeOf();
  let [W, H] = sizeFor(mode);
  app.classList.toggle('port', mode === 'port');

  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);
  ui.measure();

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: true, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tier = light ? 2 : 0;
  let scale = 1;
  let syBase = 0;

  // centre the machine in whatever the panels leave free, so the subject never sits under a panel
  const layoutOffsets = () => {
    const a = app.getBoundingClientRect();
    const s = a.width / W || 1;
    const box = (sel) => {
      const n = ui.root.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      if (r.height === 0) return null;
      return [(r.top - a.top) / s, (r.bottom - a.top) / s];
    };
    const head = box('.p-head');
    const read = box('.p-read');
    const chart = box('.p-chart');
    const ctl = box('.p-ctl');
    const top = mode === 'port' && read ? read[1] : head ? head[1] : 60;
    const bottom = mode === 'port' ? (ctl ? ctl[0] : H * 0.72) : chart ? chart[0] : H - 40;
    syBase = (top + bottom) / 2 - H / 2;
    ui.setBounds(top, bottom);
    if (mode === 'port' && read) ui.chip.style.top = `${read[1] + 8}px`;
  };

  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.width = `${W}px`;
    app.style.height = `${H}px`;
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    const pr = clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr);
    st.setQuality({...TIERS[tier], pr: 1});
    st.resize(W, H, pr);
    ui.measure();
    layoutOffsets();
  };
  const relayout = () => {
    const m = modeOf();
    if (m !== mode) {
      mode = m;
      W = DESIGN_W[mode];
      app.classList.toggle('port', mode === 'port');
    }
    [W, H] = sizeFor(mode);
    fit();
  };
  st.setQuality(TIERS[0]);
  addEventListener('resize', relayout);
  addEventListener('orientationchange', () => setTimeout(relayout, 220));
  relayout();

  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  // ------------------------------------------------------------ state
  let T = 0;
  let load = 1;
  let loadTarget = 1;
  let view = 'overview';
  let camName = 'hero';
  let cut = 'glass';
  let gas = 0;
  let explode = 0;
  let explodeTarget = 0;
  let angle = 0;
  let hidden = false;
  let chipLabel = null;
  let chipMode = null;
  // how a drag maps to the orbit: 'object' = the part follows your finger, 'camera' = the camera does (inverted)
  let orbit = (() => {
    try {
      return localStorage.getItem('gt9fa.orbit') === 'camera' ? 'camera' : 'object';
    } catch (e) {
      return 'object';
    }
  })();
  const off = {az: 0, el: 0, k: 1};
  const cam = {...CAMS.hero, sx: 0, sy: -72};
  let ring = {t: -9, x: 0, y: 0};
  let isoParts = null;
  let lastCut = null;
  let lastIso = null;
  let lastGas = -1;

  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (k) => ui.spots[k] && pulse(ui.spots[k][0], ui.spots[k][1]);

  // ------------------------------------------------------------ tour
  const AP = {on: true, t0: 0};
  let lastInput = 0;
  let pressAt = -9;
  let pressKey = null;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const tourState = (c) => {
    let i = 0;
    for (let k = 0; k < TOUR.length; k++) if (TOUR[k].t <= c) i = k;
    return TOUR[i];
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const c = (T - AP.t0) % TOUR_LEN;
    const b = tourState(c);
    view = b.view;
    camName = b.cam;
    cut = b.cut;
    explode = explodeTarget = b.explode;
    gas = b.gas;
    load = loadTarget = b.load;
    isoParts = ISO[view];
  };

  ui.chip.addEventListener('click', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== ui.chip) takeOver();
  });

  // ------------------------------------------------------------ controls
  const setView = (v) => {
    view = v;
    camName = CAMS[v] ? v : 'hero';
    Object.assign(off, {az: 0, el: 0, k: 1});
    isoParts = ISO[v];
    if (v === 'combustor') gas = 1;
  };
  const setCam = (c) => {
    camName = c;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  for (const [k] of Object.entries(ISO))
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      setView(k);
    });
  for (const k of ['solid', 'glass', 'section'])
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      cut = k;
    });
  for (const k of ['hero', 'front', 'side', 'axial', 'detail'])
    ui.btn['view-' + k].addEventListener('click', () => {
      takeOver();
      pulseBtn('view-' + k);
      setCam(k);
    });
  for (const k of ['object', 'camera'])
    ui.btn['drag-' + k].addEventListener('click', () => {
      takeOver();
      pulseBtn('drag-' + k);
      orbit = k;
      try {
        localStorage.setItem('gt9fa.orbit', k);
      } catch (e) {}
    });
  ui.gasTog.addEventListener('click', () => {
    takeOver();
    gas = gas ? 0 : 1;
  });
  ui.explTog.addEventListener('click', () => {
    takeOver();
    explodeTarget = explodeTarget > 0.5 ? 0 : 1;
  });

  // load slider — a real range input, so the keyboard works without inventing anything
  const sliderEl = ui.slider;
  sliderEl.addEventListener('input', (e) => {
    takeOver();
    loadTarget = clamp(Number(e.target.value) / 100, 0.05, 1);
    lastInput = T;
  });
  sliderEl.addEventListener('pointerdown', () => takeOver());

  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    takeOver();
    const map = {1: 'hero', 2: 'front', 3: 'side', 4: 'axial', 5: 'detail'};
    if (map[key]) setCam(map[key]);
    else if (key === 'h') hidden = !hidden;
    else if (key === 'g') gas = gas ? 0 : 1;
    else if (key === 'e') explodeTarget = explodeTarget > 0.5 ? 0 : 1;
    else if (key === 'i') {
      orbit = orbit === 'object' ? 'camera' : 'object';
      try {
        localStorage.setItem('gt9fa.orbit', orbit);
      } catch (err) {}
    }
    else if (key === 'arrowup') {
      loadTarget = clamp(loadTarget + 0.05, 0.05, 1);
      lastInput = T;
    } else if (key === 'arrowdown') {
      loadTarget = clamp(loadTarget - 0.05, 0.05, 1);
      lastInput = T;
    } else return;
    e.preventDefault();
  });

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / scale;
    const dy = (e.clientY - drag.y) / scale;
    // object: the part follows the finger (drag right → its near side moves right, drag down → you look from
    // above). camera: the camera follows the finger instead, i.e. both axes inverted.
    const s = orbit === 'camera' ? 1 : -1;
    off.az += dx * 0.34 * s;
    off.el = clamp(off.el + dy * 0.22 * -s, -14, 58);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    takeOver();
    off.k = clamp(off.k * Math.exp(e.deltaY * 0.0011), 0.4, 2.4);
  }, {passive: false});

  // ------------------------------------------------------------ frame
  if (reduce) {
    AP.on = false;
    lastInput = 0;
  } else startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const step = (dt) => {
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.024 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            st.setQuality(TIERS[tier]);
            fit();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let cursor = null;
    if (AP.on) {
      const c = (T - AP.t0) % TOUR_LEN;
      const b = tourState(c);
      if (b.press && b.t !== pressAt) {
        pressAt = b.t;
        pressKey = b.press;
        pulse(...(ui.spots[b.press] || [0, 0]));
      }
      view = b.view;
      camName = b.cam;
      cut = b.cut;
      gas = b.gas;
      explodeTarget = b.explode;
      loadTarget = b.load;
      isoParts = ISO[view];
      // the operator's cursor: sits on the button of the beat, glides to the next one
      const next = TOUR.find((x) => x.t > c && x.press);
      const prev = [...TOUR].reverse().find((x) => x.t <= c && x.press);
      const target = ui.spots[(next && next.t - c < 1.6 ? next : prev || next || b).press || 'compressor'];
      const k = 1 - Math.exp(-dt / 0.22);
      const cur = ring;
      const cx = cur.x || target[0];
      const cy = cur.y || target[1];
      cursor = {
        x: cx + (target[0] - cx) * k,
        y: cy + (target[1] - cy) * k,
        press: T - pressAt < 0.3,
      };
      ring = {t: T, x: cursor.x, y: cursor.y};
    } else {
      if (!reduce && T - lastInput > IDLE) startTour();
      cursor = null;
    }

    load += (loadTarget - load) * (1 - Math.exp(-dt / 0.55));
    explode += (explodeTarget - explode) * (1 - Math.exp(-dt / 0.4));
    angle += dt * (3000 / 60) * Math.PI * 2 * SHOW;

    const v = CAMS[camName] || CAMS.hero;
    const tgt = {
      tx: v.tx + off.az * 0.001,
      ty: v.ty,
      tz: v.tz,
      az: v.az + off.az,
      el: clamp(v.el + off.el, -6, 80),
      // portrait owns a narrower pane, so the same part has to sit further back to read at the same size
      d: v.d * (mode === 'port' ? clamp(2.3 * 0.462 / (W / H), 1.15, 3.2) : 1) * off.k,
      sx: 0,
      sy: syBase,
    };
    const k = 1 - Math.exp(-dt / (AP.on ? 0.55 : 0.42));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;

    const cutChanged = cut !== lastCut;
    if (cutChanged) {
      st.eng.setCut(cut);
      lastCut = cut;
    }
    if (isoParts !== lastIso || cutChanged) {
      st.eng.isolate(isoParts);
      lastIso = isoParts;
    }
    if (gas !== lastGas) {
      st.eng.setGas(gas);
      lastGas = gas;
    }

    const s = simulate(load);
    st.eng.update(s, {angle, time: T, explode});
    st.frame(cam);

    const calls = (CALLS[view] || []).map(([key, text, sub, anchor, side]) => ({
      key, text, sub: subFor(sub, s), p: st.eng.anchors[anchor], side,
    }));
    if (view === 'overview' && explode < 0.2) {
      calls.push(
        {key: 'compressor', text: 'COMPRESSOR · 18 STAGES', sub: `exit ${Math.round(s.compExitC)} °C · ${s.pr.toFixed(1)} : 1`, p: st.eng.anchors.compressor, side: -1},
        {key: 'turbine', text: 'TURBINE · 3 STAGES', sub: `firing ${Math.round(s.firingC)} °C`, p: st.eng.anchors.turbine, side: 1},
      );
    }

    ui.root.style.display = hidden ? 'none' : '';
    ui.frame(s, {
      view, cut, cam: camName, gas, explode, orbit,
      callouts: calls,
      project: st.project,
      cursor,
      sliderValue: s.load * 100,
    });

    if (chipLabel !== AP.on || chipMode !== mode) {
      chipLabel = AP.on;
      chipMode = mode;
      ui.chip.classList.toggle('on', AP.on);
      ui.chip.setAttribute('aria-pressed', AP.on ? 'true' : 'false');
      ui.chip.setAttribute('aria-label', AP.on ? 'Pause the auto tour and take control' : 'Resume the auto tour');
      ui.chip.innerHTML = AP.on
        ? `<i></i>Auto tour · ${mode === 'port' ? 'tap' : 'click'} anywhere to take over`
        : '<span aria-hidden="true">▶</span> Resume tour';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
  };

  const frame = (now) => {
    const dt = Math.min(0.08, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    requestAnimationFrame(frame);
  };

  // Frame capture (sims/capture.mjs) drives the tour through the same step(): render(t) advances the
  // page to t in fixed slices, so a still and the video read exactly the frames the tour plays.
  let simT = 0;
  window.SIM = {
    ready: true,
    duration: TOUR_LEN,
    fps: 30,
    render: (t) => {
      AP.on = true;
      AP.t0 = 0;
      if (t < simT - 1e-6) simT = 0;
      while (simT < t - 1e-6) {
        const d = Math.min(1 / 60, t - simT);
        step(d);
        simT += d;
      }
    },
  };

  // callout strings that follow the live state
  function subFor(key, s) {
    const map = {
      'inlet air · 15 °C': `inlet air ${Math.round(s.T1 - 273.15)} °C · ${Math.round(s.mAir)} kg/s`,
      '15.4 : 1 · exit 403 °C': `${s.pr.toFixed(1)} : 1 · exit ${Math.round(s.compExitC)} °C`,
      'firing 1,315 °C': `firing ${Math.round(s.firingC)} °C · 14 cans`,
      'stage 1–2 buckets air-cooled': `exit ${Math.round(s.exhaustC)} °C · 3 stages`,
      'one shaft · 3,000 rpm · 2 bearings': `${s.rpm} rpm · shows 1/50 speed`,
      'forward · carries the compressor': `thrust + radial · ${Math.round(s.mAir)} kg/s`,
      'exit 609 °C': `exit ${Math.round(s.exhaustC)} °C · ${Math.round(s.exhaustFlow)} kg/s`,
    };
    return map[key] || key;
  }

  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => {
    if (window.__CAPTURE) step(0);
    else requestAnimationFrame(frame);
  });
  window.LIVE = {st, ui, get T() { return T; }, startTour, takeOver};
}
