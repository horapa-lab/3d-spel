// Debug showcase (?showcase=guns | ?showcase=chars): renders every model in a
// clean grid so art can be reviewed without playing.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { kitMaterials } from '../gfx/kit.js';
import { gunTemplate } from '../gfx/gunModels.js';
import { buildCrate, buildLuckStation, buildVault, buildMount, CRATE_TIERS } from '../gfx/props.js';
import { buildPlayerModel } from '../gfx/characters.js';
import { Zombies } from '../game/zombies.js';
import { WEAPONS } from '../data/weapons.js';
import { RARITIES } from '../data/rarities.js';
import { ENEMIES } from '../data/enemies.js';

export function runShowcase(kind) {
  document.getElementById('loading')?.remove();
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3e6cf);
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const M = kitMaterials();
  M.solid.envMap = env;
  M.solid.envMapIntensity = 0.45;
  M.metal.envMap = env;
  M.metal.envMapIntensity = 0.9;
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0xe0a060, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.position.set(-10, 20, 14);
  scene.add(sun);
  const labels = document.getElementById('labels');
  const aspect = window.innerWidth / window.innerHeight;
  const addLabel = (text, color, x, y) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,0);font:16px 'Lilita One',sans-serif;color:${color};text-shadow:0 2px 0 #2b1d3a,1px 1px 0 #2b1d3a,-1px 1px 0 #2b1d3a,1px -1px 0 #2b1d3a,-1px -1px 0 #2b1d3a;white-space:nowrap;text-align:center`;
    d.innerHTML = text;
    labels.appendChild(d);
  };

  let camera;
  if (kind === 'guns') {
    const cols = 7;
    const cellW = 4.4;
    const cellH = 2.9;
    const rows = Math.ceil(WEAPONS.length / cols);
    const W = cols * cellW;
    const H = rows * cellH;
    const viewH = Math.max(H, W / aspect) * 1.02;
    camera = new THREE.OrthographicCamera((-viewH * aspect) / 2, (viewH * aspect) / 2, viewH / 2, -viewH / 2, 0.1, 100);
    camera.position.set(0, 0, 30);
    WEAPONS.forEach((w, i) => {
      const t = gunTemplate(w.id);
      const obj = t.obj.clone(true);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      t.box.getSize(size);
      t.box.getCenter(center);
      obj.position.sub(center);
      const pivot = new THREE.Group();
      pivot.add(obj);
      pivot.rotation.set(0.25, Math.PI / 2 - 0.5, 0);
      pivot.scale.setScalar(3.3 / Math.max(size.z, 1.1));
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = -W / 2 + cellW * (c + 0.5);
      const y = H / 2 - cellH * (r + 0.5) + 0.25;
      pivot.position.set(x, y, 0);
      scene.add(pivot);
      const px = ((x / (viewH * aspect)) + 0.5) * window.innerWidth;
      const py = ((-(y - 1.2) / viewH) + 0.5) * window.innerHeight;
      const rr = RARITIES[w.rarity];
      addLabel(`${w.name}<br><small>${rr.name}</small>`, rr.color, px, py);
    });
  } else {
    camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 200);
    camera.position.set(0, 10, 34);
    camera.lookAt(0, 2.8, -2);
    camera.updateMatrixWorld();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshLambertMaterial({ color: 0xf0ae57 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    sun.castShadow = true;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    // zombies through the real instanced renderer
    const stub = {
      scene, time: 0.3, ui: { overlay: { damageNumber() {} } }, fx: { goo() {} },
      onBarricadeHit() {}, onZombieKilled() {},
    };
    const zs = new Zombies(stub);
    const types = Object.keys(ENEMIES).filter((t) => !ENEMIES[t].boss || t === 'boss_zombie' || t === 'boss_orc');
    const bosses = types.filter((t) => ENEMIES[t].boss);
    const normal = types.filter((t) => !ENEMIES[t].boss);
    normal.forEach((t, i) => {
      const z = zs.spawn(t, 15, { x: 0, z: 0 });
      z.x = -16 + i * 3.2;
      z.z = 3;
      z.laneX = z.x;
      z.spawnT = 5;
      z.phase = 0.9 + i;
      const p = new THREE.Vector3(z.x, 0, z.z + 2.4).project(camera);
      addLabel(ENEMIES[t].name, '#fff', (p.x * 0.5 + 0.5) * window.innerWidth, (-p.y * 0.5 + 0.5) * window.innerHeight);
    });
    bosses.forEach((t, i) => {
      const z = zs.spawn(t, 15, { x: 0, z: 0 });
      z.x = -6 + i * 12;
      z.z = -8;
      z.spawnT = 5;
      z.phase = 2 + i;
    });
    zs.render();
    const pl = buildPlayerModel();
    pl.root.position.set(18.5, 0, 3);
    pl.root.rotation.y = -0.4;
    scene.add(pl.root);
    CRATE_TIERS.forEach((tier, i) => {
      const c = buildCrate(i);
      c.position.set(-19 + i * 4.4, 0, -16);
      c.scale.setScalar(0.85);
      scene.add(c);
    });
    const luck = buildLuckStation();
    luck.position.set(12, 0, -16);
    scene.add(luck);
    const vault = buildVault();
    vault.position.set(16, 0, -16);
    scene.add(vault);
    const mount = buildMount();
    mount.position.set(20, 0, -10);
    scene.add(mount);
  }
  renderer.render(scene, camera);
  window.__showcaseReady = true;
}
