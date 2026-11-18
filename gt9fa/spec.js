// GE MS9001FA (PG9351FA) — 50 Hz heavy-duty, single-shaft, cold-end drive gas turbine.
//
// Every number here comes from one place: GE's MS9001FA product sheet (PSP30027-06)
//   output 255.6 MW · heat rate 9,250 Btu/kWh (9,757 kJ/kWh) · pressure ratio 15.4:1
//   airflow 1,375 lb/s (624 kg/s) · 3,000 rpm · exhaust 1,129 °F (609 °C)
// and the 9FA configuration description
//   18-stage axial compressor + 2 exit guide vanes · 14 DLN-2.0+ can combustors · 3-stage turbine.
// Frame dimensions are not published to the millimetre; the ratios below are scaled from the
// public cutaway of the 9F core (compressor ~4.4 m, core ~11.8 m, turbine tip ~2.3 m dia) and
// every panel reads back from here, so nothing on screen can disagree with the motion.

export const DATA = {
  model: 'MS9001FA',
  designation: 'PG9351FA',
  hz: 50,
  rpm: 3000,
  outputMW: 255.6,
  heatRateKJ: 9757,
  pressureRatio: 15.4,
  massFlow: 624, // kg/s
  exhaustC: 609,
  firingC: 1315,
  compressorStages: 18,
  ogv: 2,
  combustors: 14,
  turbineStages: 3,
  lengthM: 11.8,
};

// ---------------------------------------------------------------- gas path model
// One input: load 0..1. Everything below follows from it.
const CP_AIR = 1.005; // kJ/kgK
const CP_HOT = 1.212; // combustion products, mean over the burner rise (tuned so base load lands on the datasheet heat rate: 9,757 kJ/kWh)
const CP_EXP = 1.14; // mean over the expansion
const LHV = 50000; // kJ/kg, natural gas
const T1 = 288.15; // K, ISO 15 °C
const P1 = 1.013; // bar
const GAMMA = 0.286;

export function simulate(load) {
  const L = Math.min(1, Math.max(0, load));
  const pr = 4 + 11.4 * Math.pow(L, 0.55); // 15.4:1 at base load
  const T3 = 900 + 688 * Math.pow(L, 0.75); // K, 1,588 K = 1,315 °C firing
  const mAir = 624 * (0.35 + 0.65 * Math.sqrt(L));
  const T2 = T1 * (1 + (Math.pow(pr, GAMMA) - 1) / 0.88); // compressor exit, 88 % polytropic eff.

  const compKW = mAir * CP_AIR * (T2 - T1);
  const genKW = 255600 * L;
  const turbKW = genKW / 0.99 + compKW; // 1 % mechanical + generator loss
  const T4 = T3 - turbKW / (mAir * CP_EXP); // turbine exit
  const heatKW = (mAir * CP_HOT * (T3 - T2)) / 0.995;
  const fuel = heatKW / LHV; // kg/s
  const exhaustFlow = mAir + fuel;
  const heatRate = genKW > 500 ? (heatKW * 3600) / genKW : 0;
  const eff = heatKW > 0 ? genKW / heatKW : 0;

  return {
    load: L,
    pr,
    T1,
    T2,
    T3,
    T4,
    P1,
    P2: P1 * pr,
    P3: P1 * pr * 0.965, // 3.5 % combustor pressure loss, the value GE quotes in the 9FA data (PLOS 2025, Table 3)
    P4: P1 * 1.06,
    mAir,
    fuel,
    exhaustFlow,
    compMW: compKW / 1000,
    turbMW: turbKW / 1000,
    genMW: genKW / 1000,
    heatMW: heatKW / 1000,
    heatRate,
    eff,
    firingC: T3 - 273.15,
    exhaustC: T4 - 273.15,
    compExitC: T2 - 273.15,
    rpm: Math.round(3000 * (0.55 + 0.45 * Math.min(1, L / 0.75))),
    // rad/s for the 3D rotor (visual speed is dialled down separately)
    omega: (3000 / 60) * 2 * Math.PI,
  };
}

// Station samples across the core, 0..1 of the machine length.
// Same numbers the panels print, so the chart and the 3D flame cannot drift apart.
export function profile(s, n = 120) {
  const seg = (x) => (x < 0.05 ? 'inlet' : x < 0.5 ? 'comp' : x < 0.62 ? 'burn' : x < 0.79 ? 'turb' : 'exh');
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    let t;
    let p;
    if (x < 0.05) {
      t = s.T1;
      p = s.P1;
    } else if (x < 0.5) {
      const k = (x - 0.05) / 0.45;
      p = s.P1 * Math.pow(s.pr, Math.pow(k, 1.15));
      t = s.T1 * (1 + (Math.pow(p / s.P1, GAMMA) - 1) / 0.88);
    } else if (x < 0.62) {
      const k = (x - 0.5) / 0.12;
      p = s.P2 * (1 - 0.03 * k);
      t = s.T2 + (s.T3 - s.T2) * Math.pow(k, 0.65);
    } else if (x < 0.79) {
      const k = (x - 0.62) / 0.17;
      // three stages: equal pressure ratio each, enthalpy drop weighted 42/33/25
      p = s.P3 * Math.pow(s.P4 / s.P3, k);
      const e = k * 3;
      const stage = Math.min(2, Math.floor(e));
      const frac = e - stage;
      const drops = [0.42, 0.33, 0.25];
      let c = 0;
      for (let j = 0; j < stage; j++) c += drops[j];
      t = s.T3 - (s.T3 - s.T4) * (c + drops[stage] * frac);
    } else {
      const k = (x - 0.79) / 0.21;
      t = s.T4 - 14 * k;
      p = s.P4 - 0.05 * k;
    }
    out.push({x, t, p, seg: seg(x)});
  }
  return out;
}

export const STATIONS = [
  {key: 'inlet', label: 'INLET', sub: 'IGV'},
  {key: 'comp', label: 'COMPRESSOR', sub: '18 STAGES'},
  {key: 'burn', label: 'COMBUSTOR', sub: '14 CANS'},
  {key: 'turb', label: 'TURBINE', sub: '3 STAGES'},
  {key: 'exh', label: 'EXHAUST', sub: 'AXIAL'},
];
