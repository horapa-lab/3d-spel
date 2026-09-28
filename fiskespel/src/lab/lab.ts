/**
 * MODEL LAB — studio renders of any registered model, used by the 3D gauntlet.
 *
 * lab.html?kind=fish&ids=a,b,c            grid of models
 * lab.html?kind=fish&page=0&per=12        page through registry.list(kind)
 * lab.html?kind=rod&id=x&views=4          one model from 4 angles
 * Optional: cols=4  yaw=35  pitch=18  mutation=molten  attributes=gleaming,glittering
 *           bg=studio|dark|sea  labels=0  anim=1 (let animated models run 1.5s before capture)
 *           zoom=1.0 (camera distance multiplier)
 *
 * Sets window.__labReady = true once rendered. window.__labInfo holds tri/draw-call counts per cell.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { registry } from '../core/registry';
import type { ModelKind } from '../core/types';
import '../models/index';

const p = new URLSearchParams(location.search);
const kind = (p.get('kind') ?? 'fish') as ModelKind;
const single = p.get('id');
const views = Number(p.get('views') ?? (single ? 4 : 1));
let ids: string[];
if (single) ids = Array.from({ length: views }, () => single);
else if (p.get('ids')) ids = p.get('ids')!.split(',').filter(Boolean);
else {
  const per = Number(p.get('per') ?? 12);
  const page = Number(p.get('page') ?? 0);
  ids = registry.list(kind).slice(page * per, page * per + per);
}
const cols = Number(p.get('cols') ?? Math.min(4, Math.max(1, Math.ceil(Math.sqrt(ids.length)))));
const rows = Math.max(1, Math.ceil(ids.length / cols));
const baseYaw = THREE.MathUtils.degToRad(Number(p.get('yaw') ?? 35));
const pitch = THREE.MathUtils.degToRad(Number(p.get('pitch') ?? 18));
const zoom = Number(p.get('zoom') ?? 1);
const mutation = p.get('mutation');
const attributes = p.get('attributes')?.split(',').filter(Boolean) ?? [];
const bg = p.get('bg') ?? 'studio';
const showLabels = p.get('labels') !== '0';
const anim = p.get('anim') === '1';

document.body.dataset.bg = bg;
const canvas = document.getElementById('lab') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setScissorTest(true);
renderer.setClearColor(0x000000, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

interface Cell {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  model: THREE.Object3D;
  id: string;
}

const cells: Cell[] = [];
const info: { id: string; triangles: number; meshes: number; error?: string }[] = [];

function makeCell(id: string, index: number): Cell {
  const scene = new THREE.Scene();
  scene.environment = envTex;
  const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight(0x9ecbff, 1.4);
  rim.position.set(-4, 3, -5);
  const fill = new THREE.HemisphereLight(0xdfefff, 0x404048, 0.45);
  scene.add(key, rim, fill);

  let model: THREE.Object3D;
  try {
    model = registry.build(kind, id, { mutation, attributes, lod: 0, quality: 'ultra', seed: 1 });
  } catch (err) {
    console.error(`[lab] build failed for ${kind}/${id}`, err);
    model = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    info.push({ id, triangles: 0, meshes: 0, error: String(err) });
  }
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);

  // frame
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 0.05);

  // ground shadow catcher
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 12, radius * 12).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: 0.28 }),
  );
  ground.position.y = box.min.y - radius * 0.02;
  ground.receiveShadow = true;
  scene.add(ground);
  key.position.copy(center).add(new THREE.Vector3(radius * 3, radius * 5, radius * 4));
  key.target.position.copy(center);
  scene.add(key.target);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -radius * 2;
  sc.right = sc.top = radius * 2;
  sc.near = 0.01;
  sc.far = radius * 20;
  sc.updateProjectionMatrix();

  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  const yaw = views > 1 && single ? baseYaw + (index * Math.PI * 2) / views : baseYaw;
  const camera = new THREE.PerspectiveCamera(30, 1, radius * 0.02, radius * 50);
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.05 * zoom;
  camera.position.set(
    center.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    center.y + Math.sin(pitch) * dist,
    center.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(center);

  let tris = 0;
  let meshes = 0;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      meshes++;
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  if (!info.find((i) => i.id === id)) info.push({ id, triangles: Math.round(tris), meshes });

  if (showLabels) {
    const label = document.createElement('div');
    label.className = 'label';
    const col = index % cols;
    const row = Math.floor(index / cols);
    label.style.left = `${(col / cols) * 100}%`;
    label.style.top = `${((row + 1) / rows) * 100}%`;
    label.style.width = `${100 / cols}%`;
    label.textContent = views > 1 && single ? `${id} · view ${index + 1}` : id;
    document.getElementById('labels')!.appendChild(label);
  }
  return { scene, camera, model, id };
}

ids.forEach((id, i) => cells.push(makeCell(id, i)));

const t0 = performance.now();
function draw() {
  const w = innerWidth;
  const h = innerHeight;
  const cw = w / cols;
  const ch = h / rows;
  renderer.setScissor(0, 0, w, h);
  renderer.setViewport(0, 0, w, h);
  renderer.clear();
  cells.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cw;
    const y = h - (row + 1) * ch;
    const pad = showLabels ? 22 : 0;
    renderer.setViewport(x, y + pad, cw, ch - pad);
    renderer.setScissor(x, y + pad, cw, ch - pad);
    c.camera.aspect = cw / (ch - pad);
    c.camera.updateProjectionMatrix();
    const t = (performance.now() - t0) / 1000;
    c.model.traverse((o) => (o.userData.animate as ((t: number) => void) | undefined)?.(t));
    renderer.render(c.scene, c.camera);
  });
}

let frames = 0;
const start = performance.now();
function loop() {
  draw();
  frames++;
  const settled = anim ? performance.now() - start > 1500 && frames > 3 : frames > 2;
  if (settled && !(window as unknown as { __labReady?: boolean }).__labReady) {
    (window as unknown as { __labInfo: unknown }).__labInfo = info;
    (window as unknown as { __labReady: boolean }).__labReady = true;
  }
  requestAnimationFrame(loop);
}
loop();
