// The MS9001FA core, built from code: bellmouth and IGV, 18 compressor stages (rotor drum + blade rows),
// 14 DLN-2.0+ cans with transition pieces, 3 turbine stages with cooled buckets and tip shrouds,
// the axial exhaust diffuser, one rotor, two bearings. update() poses it for a load state.
import * as THREE from 'three';
import {profile} from './spec.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- layout (metres, axis = +X)
const L = {
  xBell: -6.0,
  xIgv: -5.15,
  xC0: -4.68,
  pitch: 0.212,
  xOgv: -0.9,
  xBurn0: -0.5,
  xCan0: 0.0,
  xCan1: 1.06,
  xTrans1: 1.7,
  xT: [1.86, 2.36, 2.86],
  xTend: 3.2,
  xExh: 5.62,
  canR: 0.96,
  canBody: 0.185,
};
const STAGE = (i) => L.xC0 + i * L.pitch;
const TIP = (i) => 1.02 - 0.22 * (i / 17);
const HUB = (i) => 0.52 + 0.18 * (i / 17);
const T_TIP = [1.06, 1.13, 1.19];
const T_HUB = [0.68, 0.72, 0.76];

const PALETTE = {
  casing: {color: 0xb7bcc4, metalness: 0.5, roughness: 0.46},
  casingD: {color: 0x8d939b, metalness: 0.6, roughness: 0.4},
  rotor: {color: 0x4d535a, metalness: 0.85, roughness: 0.34},
  blade: {color: 0x9ba2aa, metalness: 0.95, roughness: 0.3},
  bladeHot: {color: 0x7b6a5f, metalness: 0.82, roughness: 0.42, emissive: 0x2c1105, emissiveIntensity: 0.26},
  can: {color: 0x8f8478, metalness: 0.72, roughness: 0.4, emissive: 0x2a1206, emissiveIntensity: 0.25},
  nozzle: {color: 0x6d6157, metalness: 0.76, roughness: 0.44, emissive: 0x2a1206, emissiveIntensity: 0.3},
  flame: {color: 0xffb066, emissive: 0xff5a12, emissiveIntensity: 2.4, transparent: true, opacity: 0.92},
  accent: {color: 0xe8491d, metalness: 0.3, roughness: 0.5, emissive: 0xe8491d, emissiveIntensity: 0.4},
};

// one airfoil, unit span 0..1 along +Y, chord 1 along X, thickness ~0.16 along Z
function bladeGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.bezierCurveTo(-0.34, 0.095, 0.14, 0.062, 0.46, 0.012);
  s.lineTo(0.5, 0);
  s.lineTo(0.46, -0.008);
  s.bezierCurveTo(0.14, -0.028, -0.34, -0.055, -0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, {depth: 1, bevelEnabled: false, curveSegments: 5});
  g.rotateX(-Math.PI / 2); // span → +Y
  g.computeVertexNormals();
  return g;
}

// surface of revolution about +X from a [x, radius] polyline
function lathe(pts, segs = 96) {
  const g = new THREE.LatheGeometry(
    pts.map(([x, r]) => new THREE.Vector2(Math.max(0.001, r), x)),
    segs,
  );
  g.rotateZ(-Math.PI / 2);
  return g;
}

// a swept duct along a curve with a per-step radius (transition pieces, struts fairings)
function sweep(curve, radiusFn, segs = 22, radial = 20) {
  const pos = [];
  const idx = [];
  const up = new V3(0, 1, 0);
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const c = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).normalize();
    let a = new V3().crossVectors(tan, up);
    if (a.lengthSq() < 1e-6) a = new V3().crossVectors(tan, new V3(1, 0, 0));
    a.normalize();
    const b = new V3().crossVectors(tan, a).normalize();
    const r = radiusFn(u);
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * TAU;
      pos.push(
        c.x + (a.x * Math.cos(th) + b.x * Math.sin(th)) * r,
        c.y + (a.y * Math.cos(th) + b.y * Math.sin(th)) * r,
        c.z + (a.z * Math.cos(th) + b.z * Math.sin(th)) * r,
      );
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      idx.push(a, b, a + radial, b, b + radial, a + radial);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Builds the core. Returns groups (so a subsystem can be isolated), a fade helper for the
 * teardown, explode offsets, the gas-path points, and update(state, ops).
 */
export function buildMachine() {
  const root = new THREE.Group();
  const groups = {};
  const mats = new Map();

  const mat = (part, key) => {
    const id = part + '|' + key;
    if (!mats.has(id)) {
      const m = new THREE.MeshStandardMaterial({side: THREE.DoubleSide, ...PALETTE[key]});
      m.userData.op0 = m.opacity;
      m.userData.part = part;
      mats.set(id, m);
    }
    return mats.get(id);
  };
  const g = (part, name) => {
    const grp = new THREE.Group();
    grp.name = name || part;
    grp.userData.part = part;
    groups[part] = groups[part] || grp;
    if (!grp.parent) root.add(grp);
    return grp;
  };
  const mesh = (geo, material, part, pos) => {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    part.add(m);
    return m;
  };

  const blade = bladeGeometry();
  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  // radial row: n blades at angle, spanning hub..tip, staggered by beta
  const row = (parent, material, x, n, hub, tip, chord, thick, beta, phase = 0) => {
    const im = new THREE.InstancedMesh(blade, material, n);
    im.castShadow = true;
    im.receiveShadow = true;
    const span = tip - hub;
    for (let k = 0; k < n; k++) {
      const th = (k / n) * TAU + phase;
      q.setFromEuler(e.set(th, beta, 0, 'XYZ'));
      tmp.identity()
        .multiply(new THREE.Matrix4().makeTranslation(x, 0, 0))
        .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
        .multiply(new THREE.Matrix4().makeTranslation(0, hub, 0))
        .multiply(new THREE.Matrix4().makeScale(chord, span, thick));
      im.setMatrixAt(k, tmp);
    }
    im.instanceMatrix.needsUpdate = true;
    parent.add(im);
    return im;
  };

  // ---------------------------------------------------------------- inlet + IGV
  const inlet = g('inlet');
  mesh(lathe([[-6.0, 1.02], [-5.92, 1.16], [-5.4, 1.19], [-5.18, 1.12]], 96), mat('inlet', 'casing'), inlet);
  mesh(lathe([[-5.4, 1.05], [-5.18, 1.04]], 96), mat('inlet', 'casingD'), inlet);
  // bellmouth lip
  const lip = mesh(new THREE.TorusGeometry(1.1, 0.05, 10, 64), mat('inlet', 'casingD'), inlet);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = -5.98;
  row(inlet, mat('inlet', 'blade'), L.xIgv, 22, 0.5, 1.03, 0.24, 0.055, 0.35);
  // inlet cone on the rotor nose
  const cone = mesh(new THREE.ConeGeometry(0.5, 0.62, 32), mat('shaft', 'rotor'), inlet);
  cone.rotation.z = Math.PI / 2;
  cone.position.x = -5.52;

  // ---------------------------------------------------------------- compressor
  const compCase = g('compCase');
  const compRotor = g('compRotor');
  const compRows = g('compStator');
  const casePts = [[-5.16, 1.1]];
  for (let i = 0; i < 18; i++) {
    const x = STAGE(i) - 0.1;
    casePts.push([x, TIP(i) + 0.045], [x + 0.2, TIP(i) + 0.045]);
  }
  casePts.push([-0.86, 0.82], [-0.52, 0.8]);
  mesh(lathe(casePts, 96), mat('compCase', 'casing'), compCase);
  for (const [fx, fr] of [[-5.14, 1.11], [-0.9, 0.85], [-0.56, 0.82]]) {
    const fl = mesh(new THREE.TorusGeometry(fr, 0.035, 8, 64), mat('compCase', 'casingD'), compCase);
    fl.rotation.y = Math.PI / 2;
    fl.position.x = fx;
  }

  // rotor drum: stacked disks on the shaft
  const drum = [[-5.2, 0.3]];
  for (let i = 0; i < 18; i++) {
    const x = STAGE(i);
    drum.push([x - 0.095, HUB(i) - 0.035], [x + 0.095, HUB(i) - 0.035]);
    if (i < 17) drum.push([x + 0.1, HUB(i) + 0.006]);
  }
  drum.push([-0.5, 0.42], [-0.34, 0.3]);
  mesh(lathe(drum, 96), mat('compRotor', 'rotor'), compRotor);

  const rotorRow = new THREE.Group();
  compRotor.add(rotorRow);
  for (let i = 0; i < 18; i++) {
    const n = Math.round(44 + 30 * (i / 17));
    row(rotorRow, mat('compRotor', 'blade'), STAGE(i), n, HUB(i) - 0.005, TIP(i) - 0.012,
      0.17 - 0.1 * (i / 17), 0.05, 0.55 + 0.35 * (i / 17), (i % 2) * 0.02);
  }
  // stators between the rotor rows, hung off the casing
  for (let i = 0; i < 18; i++) {
    const n = Math.round(56 + 34 * (i / 17));
    row(compRows, mat('compStator', 'blade'), STAGE(i) + L.pitch * 0.5, n, HUB(i) + 0.005, TIP(i) + 0.04,
      0.15 - 0.085 * (i / 17), 0.042, -0.5 - 0.3 * (i / 17));
  }
  // exit guide vanes + compressor exit diffuser
  for (const dx of [0, 0.075]) {
    row(compRows, mat('compStator', 'blade'), L.xOgv + dx, 58, 0.62, 0.8, 0.09, 0.02, -0.2);
  }

  // ---------------------------------------------------------------- combustor (14 cans)
  const combCase = g('combCase');
  const cans = g('cans');
  mesh(lathe([[L.xBurn0, 0.8], [0.06, 1.3], [L.xCan1, 1.3], [1.26, 1.24], [1.88, 1.17]], 96), mat('combCase', 'casing'), combCase);
  const flange1 = mesh(new THREE.TorusGeometry(1.3, 0.045, 10, 72), mat('combCase', 'casingD'), combCase);
  flange1.rotation.y = Math.PI / 2;
  flange1.position.x = L.xCan1;
  // the inner diffuser skin the cans sit on
  mesh(lathe([[L.xBurn0, 0.62], [0.2, 0.66], [L.xTrans1, 0.6]], 64), mat('combCase', 'casingD'), combCase);

  const flames = [];
  const canGeo = {
    body: (() => {
      const b = new THREE.CylinderGeometry(L.canBody, L.canBody, L.xCan1 - L.xCan0, 24, 1, false);
      b.rotateZ(-Math.PI / 2);
      return b;
    })(),
    dome: (() => {
      const d = new THREE.SphereGeometry(L.canBody, 24, 12, 0, TAU, 0, Math.PI / 2);
      d.rotateZ(Math.PI / 2);
      return d;
    })(),
    flame: (() => {
      const f = new THREE.SphereGeometry(0.078, 20, 14);
      f.scale(4.0, 1, 1);
      return f;
    })(),
    nozzle: (() => {
      const n = new THREE.CylinderGeometry(0.055, 0.075, 0.26, 14);
      n.rotateZ(-Math.PI / 2);
      return n;
    })(),
  };
  for (let k = 0; k < 14; k++) {
    const th = (k / 14) * TAU + 0.11;
    const cy = Math.cos(th) * L.canR;
    const cz = Math.sin(th) * L.canR;
    const body = mesh(canGeo.body, mat('cans', 'can'), cans, [(L.xCan0 + L.xCan1) / 2, cy, cz]);
    body.rotation.x = 0;
    const dome = mesh(canGeo.dome, mat('cans', 'can'), cans, [L.xCan0, cy, cz]);
    dome.rotation.z = -Math.PI / 2;
    const cf = mesh(new THREE.TorusGeometry(L.canBody + 0.022, 0.012, 8, 26), mat('cans', 'can'), cans,
      [L.xCan0 + 0.05, cy, cz]);
    cf.rotation.y = Math.PI / 2;
    const fl = mesh(canGeo.flame, mat('cans', 'flame'), cans, [L.xCan0 + 0.52, cy, cz]);
    fl.scale.set(1, 1, 1);
    flames.push(fl);
    const nz = mesh(canGeo.nozzle, mat('cans', 'bladeHot'), cans, [L.xCan0 + 0.03, cy, cz]);
    nz.rotation.x = 0;
    // six fuel spokes on the nozzle cap
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * TAU;
      const sp = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.055, 8), mat('cans', 'bladeHot'), cans,
        [L.xCan0 + 0.15, cy + Math.cos(a) * 0.13, cz + Math.sin(a) * 0.13]);
      sp.rotation.z = Math.PI / 2;
    }
    // transition piece: can exit down to the stage-1 nozzle annulus
    const curve = new THREE.CatmullRomCurve3([
      new V3(L.xCan1 - 0.05, cy, cz),
      new V3(L.xCan1 + 0.28, cy * 0.92, cz * 0.92),
      new V3(L.xTrans1 - 0.08, cy * 0.68, cz * 0.68),
      new V3(L.xTrans1, cy * 0.64, cz * 0.64),
    ]);
    mesh(sweep(curve, (u) => L.canBody * (1.02 + 0.55 * u * u), 18, 20), mat('cans', 'can'), cans);
  }

  // ---------------------------------------------------------------- turbine
  const turbCase = g('turbCase');
  const turbNoz = g('turbStator');
  const turbRotor = g('turbRotor');
  mesh(lathe([[1.86, 1.17], [2.3, 1.22], [L.xT[2] - 0.06, 1.28], [L.xTend, 1.3]], 96),
    mat('turbCase', 'casing'), turbCase);
  mesh(lathe([[L.xTrans1, 0.6], [L.xT[2], 0.68], [L.xTend, 0.9]], 72), mat('turbCase', 'casingD'), turbCase);
  // the cone that closes the transition ducts into the stage-1 annulus
  mesh(lathe([[L.xTrans1 - 0.02, 0.62], [1.86, 1.16]], 64), mat('turbCase', 'casingD'), turbCase);
  const tfl = mesh(new THREE.TorusGeometry(1.13, 0.05, 10, 64), mat('turbCase', 'casingD'), turbCase);
  tfl.rotation.y = Math.PI / 2;
  tfl.position.x = 2.2;
  for (const [i, x] of L.xT.entries()) {
    // nozzle row, hung from the casing
    row(turbNoz, mat('turbStator', 'nozzle'), x - 0.1, 40 + i * 5, T_HUB[i] + 0.02, T_TIP[i] + 0.02,
      0.22, 0.065, -0.62);
    // bucket row
    row(turbRotor, mat('turbRotor', 'bladeHot'), x + 0.08, 48 + i * 4, T_HUB[i], T_TIP[i],
      0.22, 0.06, 0.62);
    // tip shroud: a thin band on the bucket tips, not a full drum
    const sh = mesh(new THREE.CylinderGeometry(T_TIP[i] + 0.035, T_TIP[i] + 0.035, 0.085, 72, 1, true),
      mat('turbRotor', 'bladeHot'), turbRotor, [x + 0.08, 0, 0]);
    sh.rotation.z = Math.PI / 2;
    // rotor disk
    const disk = mesh(lathe([[x - 0.1, T_HUB[i] - 0.02], [x + 0.1, T_HUB[i] - 0.02], [x + 0.1, 0.34], [x - 0.1, 0.34]],
      64), mat('turbRotor', 'rotor'), turbRotor);
  }
  // turbine rear frame struts into the exhaust
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.2;
    const st = mesh(new THREE.BoxGeometry(0.28, 0.9, 0.075), mat('turbCase', 'casingD'), turbCase,
      [L.xTend + 0.04, Math.cos(a) * 0.72, Math.sin(a) * 0.72]);
    st.rotation.x = -a;
  }

  // ---------------------------------------------------------------- exhaust diffuser
  const exhaust = g('exhaust');
  mesh(lathe([[L.xTend, 1.34], [3.6, 1.36], [4.6, 1.62], [L.xExh, 1.78], [L.xExh + 0.06, 1.76]], 96),
    mat('exhaust', 'casing'), exhaust);
  mesh(lathe([[L.xTend, 0.95], [4.2, 1.05], [L.xExh, 1.3]], 64), mat('exhaust', 'casingD'), exhaust);
  const rim = mesh(new THREE.TorusGeometry(1.76, 0.055, 10, 80), mat('exhaust', 'casingD'), exhaust);
  rim.rotation.y = Math.PI / 2;
  rim.position.x = L.xExh + 0.05;

  // ---------------------------------------------------------------- rotor + bearings
  const shaft = g('shaft');
  const shaftGeo = (() => {
    const parts = [
      [-4.9, -0.34, 0.26],
      [-0.34, 1.7, 0.3],
      [1.7, 3.0, 0.28],
      [3.0, 3.42, 0.14],
    ];
    const geos = parts.map(([a, b, r]) => {
      const gl = new THREE.CylinderGeometry(r, r, b - a, 40, 1, false);
      gl.rotateZ(-Math.PI / 2);
      gl.translate((a + b) / 2, 0, 0);
      return gl;
    });
    // merge without a helper: one BufferGeometry per piece is cheap enough
    return geos;
  })();
  for (const gl of shaftGeo) mesh(gl, mat('shaft', 'rotor'), shaft);
  // nose cone and the coupling flange at the cold end
  const nose = mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.6, 32), mat('shaft', 'rotor'), shaft, [-5.2, 0, 0]);
  nose.rotation.z = Math.PI / 2;

  // both rotors spin on the same shaft angle, but stay separate groups so either can be shown alone
  compCase.add(compRows);

  const bearings = g('bearings');
  const race = (x, r) => {
    const t = mesh(new THREE.TorusGeometry(r, 0.055, 10, 40), mat('bearings', 'casingD'), bearings, [x, 0, 0]);
    t.rotation.y = Math.PI / 2;
    return t;
  };
  race(-5.28, 0.3);
  race(3.12, 0.28);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU;
    const b = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('bearings', 'blade'), bearings,
      [-5.28, Math.cos(a) * 0.36, Math.sin(a) * 0.36]);
  }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + 0.4;
    const s = mesh(new THREE.BoxGeometry(0.22, 0.62, 0.05), mat('bearings', 'casingD'), bearings,
      [-5.28, Math.cos(a) * 0.62, Math.sin(a) * 0.62]);
    s.rotation.x = -a;
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.2;
    const s = mesh(new THREE.BoxGeometry(0.2, 0.55, 0.045), mat('bearings', 'casingD'), bearings,
      [3.12, Math.cos(a) * 0.55, Math.sin(a) * 0.55]);
    s.rotation.x = -a;
  }

  // ---------------------------------------------------------------- fade / cut / explode
  const explode = {
    inlet: [-2.4, 0, 0],
    compCase: [-1.1, 0.15, 0],
    cans: [0.55, 0, 0],
    combCase: [0.55, 0, 0],
    turbCase: [1.95, 0.35, 0],
    turbRotor: [1.5, 0, 0],
    exhaust: [3.1, 0, 0],
  };
  const basePos = new Map();
  for (const [k, grp] of Object.entries(groups)) basePos.set(grp, grp.position.clone());

  const CLIP = new THREE.Plane(new V3(0, 0, -1), 0);
  let cut = 'glass';
  const applyCut = () => {
    for (const m of mats.values()) {
      m.clippingPlanes = cut === 'section' ? [CLIP] : null;
      m.clipShadows = true;
      m.needsUpdate = true;
    }
  };
  // glass: casings see-through, everything inside solid. section: clip the near half.
  const CASINGS = new Set(['compCase', 'combCase', 'turbCase', 'exhaust', 'inlet']);
  const GLASS = {compCase: 0.36, combCase: 0.24, turbCase: 0.26, exhaust: 0.11, inlet: 0.32};

  const partOpacity = {};
  const fadeTo = (opacities) => {
    for (const m of mats.values()) {
      const o = opacities[m.userData.part] ?? 0;
      partOpacity[m.userData.part] = o;
      m.opacity = (m.userData.op0 ?? 1) * o;
      m.transparent = m.opacity < 0.999;
      m.depthWrite = m.opacity > 0.9;
    }
    for (const [part, grp] of Object.entries(groups)) grp.visible = (opacities[part] ?? 0) > 0.02;
  };

  // ---------------------------------------------------------------- gas path points
  const GAS_N = 900;
  const gasPos = new Float32Array(GAS_N * 3);
  const gasCol = new Float32Array(GAS_N * 3);
  const seeds = new Float32Array(GAS_N);
  const angs = new Float32Array(GAS_N);
  const rads = new Float32Array(GAS_N);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < GAS_N; i++) {
    seeds[i] = rnd();
    angs[i] = rnd() * TAU;
    rads[i] = 0.18 + 0.82 * Math.pow(rnd(), 0.7);
  }
  const gasGeo = new THREE.BufferGeometry();
  gasGeo.setAttribute('position', new THREE.BufferAttribute(gasPos, 3));
  gasGeo.setAttribute('color', new THREE.BufferAttribute(gasCol, 3));
  const gasMat = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const gas = new THREE.Points(gasGeo, gasMat);
  gas.frustumCulled = false;
  root.add(gas);

  const x0 = -5.9;
  const x1 = 5.55;
  const midR = (x) => {
    if (x < L.xC0) return 0.78;
    if (x < -0.5) {
      const i = Math.min(17, Math.max(0, (x - L.xC0) / L.pitch));
      return (HUB(i) + TIP(i)) / 2;
    }
    if (x < L.xCan1) return L.canR;
    if (x < L.xT[0]) return 0.68 + ((x - L.xCan1) / (L.xT[0] - L.xCan1)) * 0.0 + 0.0;
    if (x < L.xTend) return 0.85;
    return 0.9 + Math.min(0.55, (x - L.xTend) * 0.32);
  };
  // temperature colour pairs: cool air → fired gas
  const cool = new THREE.Color('#8fa6bd');
  const warm = new THREE.Color('#d99a55');
  const hot = new THREE.Color('#f0521c');
  const cc = new THREE.Color();
  const tempColor = (tK, out) => {
    const k = Math.min(1, Math.max(0, (tK - 300) / 1300));
    if (k < 0.5) out.copy(cool).lerp(warm, k * 2);
    else out.copy(warm).lerp(hot, (k - 0.5) * 2);
    return out;
  };

  let gasOn = 0;
  const update = (state, ops = {}) => {
    const angle = ops.angle ?? 0;
    compRotor.rotation.x = angle;
    rotorRow.rotation.x = 0;
    // the compressor drum spins, the stator rows do not; both rotor groups share the shaft
    turbRotor.rotation.x = angle;
    // blades are children of the rotor groups, so the InstancedMeshes rotate with them
    gas.visible = gasOn > 0.02;
    if (gas.visible) {
      const prof = profile(state, 64);
      const tempAt = (u) => prof[Math.min(63, Math.max(0, Math.round(u * 63)))].t;
      for (let i = 0; i < GAS_N; i++) {
        const u = (seeds[i] + (ops.time ?? 0) * 0.035) % 1;
        const x = x0 + (x1 - x0) * u;
        const r = midR(x) * (0.55 + 0.45 * rads[i]);
        const a = angs[i] + u * 5.5;
        gasPos[i * 3] = x;
        gasPos[i * 3 + 1] = Math.cos(a) * r;
        gasPos[i * 3 + 2] = Math.sin(a) * r;
        tempColor(tempAt(u), cc);
        const f = 0.55 + 0.45 * gasOn;
        gasCol[i * 3] = cc.r * f;
        gasCol[i * 3 + 1] = cc.g * f;
        gasCol[i * 3 + 2] = cc.b * f;
      }
      gasGeo.attributes.position.needsUpdate = true;
      gasGeo.attributes.color.needsUpdate = true;
    }
    // flame grows with firing temperature
    const fk = Math.max(0.15, (state.firingC - 700) / 620);
    const canFade = partOpacity.cans ?? 1;
    for (const f of flames) {
      f.scale.set(0.5 + fk * 0.55, 0.7 + fk * 0.35, 0.7 + fk * 0.35);
      const m = f.material;
      m.emissiveIntensity = (1.1 + fk * 2.2) * canFade;
      m.opacity = (0.55 + fk * 0.4) * canFade;
    }
    const ex = ops.explode ?? 0;
    for (const [k, grp] of Object.entries(groups)) {
      const d = explode[k];
      const b = basePos.get(grp);
      if (d) grp.position.set(b.x + d[0] * ex, b.y + d[1] * ex, b.z + d[2] * ex);
      else grp.position.copy(b);
    }
  };

  const setCut = (mode) => {
    cut = mode;
    applyCut();
    gasMat.clippingPlanes = mode === 'section' ? [CLIP] : null;
    gasMat.needsUpdate = true;
    for (const c of CASINGS)
      for (const grp of [groups[c]]) grp?.traverse((n) => { if (n.isMesh) n.castShadow = mode !== 'glass'; });
    if (mode === 'glass') {
      const o = {};
      for (const [part] of Object.entries(groups)) o[part] = 1;
      for (const c of CASINGS) o[c] = GLASS[c];
      fadeTo(o);
    } else fadeTo(Object.fromEntries(Object.keys(groups).map((k) => [k, 1])));
  };
  // parts: a list of group names to keep, or a map {name: opacity} for an x-ray view; null shows everything.
  const isolate = (parts) => {
    const o = {};
    for (const k of Object.keys(groups)) o[k] = parts ? 0 : 1;
    if (Array.isArray(parts)) for (const k of parts) o[k] = 1;
    else if (parts) Object.assign(o, parts);
    if (cut === 'glass' && !parts) {
      for (const c of CASINGS) o[c] = GLASS[c];
    }
    fadeTo(o);
  };
  const setGas = (v) => (gasOn = v);

  setCut('glass');
  root.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return {
    root, groups, update, setCut, isolate, setGas, CLIP,
    // screen-space anchor points for callouts
    anchors: {
      inlet: [-5.6, 1.05, 0],
      compressor: [-3.0, 0.95, 0],
      combustor: [0.55, 1.2, 0.3],
      turbine: [2.35, 1.15, 0],
      rotor: [-2.0, 0.3, 0],
      bearings: [-5.28, 0.5, 0],
      exhaust: [4.6, 1.4, 0],
    },
    layout: L,
  };
}
