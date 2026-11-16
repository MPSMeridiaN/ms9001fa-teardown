// The studio the core sits in: a pale gradient backdrop, one big softbox and two strip lights for the
// casings to catch, a shadow on an invisible floor, GTAO for the blade rows. frame(cam) draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildMachine} from './machine.js';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
export const BG = {top: '#f6f6f7', mid: '#ecedef', low: '#e2e4e7'};

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const g2 = c.getContext('2d');
    const gr = g2.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, BG.top);
    gr.addColorStop(0.55, BG.mid);
    gr.addColorStop(1, BG.low);
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }

  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.05, 200);
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}),
  );
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.55;
  gtao.updateGtaoMaterial({radius: 0.16, distanceExponent: 1.4, thickness: 0.9, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const aoSkip = (on) => {
    shade.visible = on;
  };
  composer.addPass(new Toggle(() => aoSkip(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => aoSkip(true)));
  composer.addPass(new OutputPass());

  // studio environment: a top softbox, two strips, a pale floor
  const env = new THREE.Scene();
  env.background = new THREE.Color('#dfe1e4');
  const box = (w, h, pos, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  box(60, 60, new V3(0, 46, 6), 2.7);
  box(10, 50, new V3(-38, 12, 18), 3.2);
  box(10, 50, new V3(38, 12, -12), 2.0);
  box(60, 8, new V3(0, 6, 44), 1.7);
  const floorEnv = new THREE.Mesh(new THREE.CircleGeometry(120, 32), new THREE.MeshBasicMaterial({color: '#c8cacd', side: THREE.DoubleSide}));
  floorEnv.rotation.x = -Math.PI / 2;
  floorEnv.position.y = -6;
  env.add(floorEnv);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 1.0;
  pm.dispose();

  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(-5, 19, 8);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -9, right: 9, top: 7, bottom: -7, near: 0.5, far: 40});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 18;
  sun.shadow.blurSamples = 24;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c8cbd0', 1.1));

  const FLOOR_Y = -2.15;
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShadowMaterial({color: '#5d636c', opacity: 0.17, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = FLOOR_Y;
  shade.receiveShadow = true;
  scene.add(shade);

  const eng = buildMachine();
  scene.add(eng.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // cam: target (tx,ty,tz), azimuth/elevation degrees from +z, distance, screen shift in px
  const frame = (cam) => {
    const {tx, ty, tz, az, el, d} = cam;
    const a = az * D2R;
    const e = el * D2R;
    camera.position.set(tx + d * Math.cos(e) * Math.sin(a), ty + d * Math.sin(e), tz + d * Math.cos(e) * Math.cos(a));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    composer.render();
  };

  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow, pr}) => {
    if (samples !== undefined) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    if (pr !== undefined) resize(size.w, size.h, pr);
  };
  return {renderer, scene, camera, eng, composer, gtao, sun, resize, frame, project, size, FLOOR_Y, setQuality};
}
