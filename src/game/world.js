// Static environment: sky, ground, road, gun decks, sandbags, barricade, plaza,
// portal, mesas, clouds and per-zone decorations + palettes.

import * as THREE from 'three';
import { Kit } from '../gfx/kit.js';
import {
  sandbagGeometry, barrierGeometry, buildPortal, decoCactus, decoRock, decoBarrel, decoCrate, decoTire,
  decoPine, decoMushroom, decoCrystal, decoDeadTree, decoLamp,
} from '../gfx/props.js';
import { ZONES } from '../data/zones.js';
import { mulberry32 } from '../util/math.js';
import * as L from './layout.js';

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.zoneIndex = -1;
    this.time = 0;
    this.shakeT = 0;
    this.decoGroup = null;
    this.mats = {};
    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildRoad();
    this.buildDecks();
    this.buildSandbags();
    this.buildBarricade();
    this.buildPlaza();
    this.portal = buildPortal(0x7dff5a);
    this.portal.position.set(0, 0, L.SPAWN_Z - 2.5);
    this.scene.add(this.portal);
    this.buildMesas();
    this.buildClouds();
    this.buildStars();
  }

  // ---------------------------------------------------------------- sky / light
  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vW;
        void main(){ float h = normalize(vW - cameraPosition).y; float t = smoothstep(-0.02, 0.5, h);
        gl_FragColor = vec4(mix(bottom, top, t), 1.0);
        #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), this.skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog(0xffffff, 70, 160);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0xe0a060, 1.35);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
    this.sun.position.set(-16, 40, 16);
    this.sun.target.position.set(0, 0, -14);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.left = -30;
    cam.right = 30;
    cam.top = 46;
    cam.bottom = -46;
    cam.near = 5;
    cam.far = 120;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.sun, this.sun.target);
  }

  setShadowQuality(q) {
    const size = q === 'high' ? 2048 : 1024;
    this.sun.castShadow = q !== 'low';
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  // ---------------------------------------------------------------- ground / road
  buildGround() {
    const tex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      const rnd = mulberry32(3);
      for (let i = 0; i < 70; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 20 + rnd() * 60;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        const dark = rnd() < 0.5;
        grd.addColorStop(0, dark ? 'rgba(200,190,175,0.35)' : 'rgba(255,255,255,0.4)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 1600; i++) {
        const v = 200 + Math.floor(rnd() * 40);
        g.fillStyle = `rgba(${v},${v - 10},${v - 25},0.5)`;
        g.fillRect(rnd() * w, rnd() * h, 2, 2);
      }
    }, 40, 40);
    this.mats.ground = new THREE.MeshLambertMaterial({ map: tex, color: 0xf0ae57 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), this.mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -60;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // soft dunes near the battlefield
    this.mats.dune = new THREE.MeshLambertMaterial({ color: 0xd98f3c });
    const duneGeo = new THREE.SphereGeometry(1, 18, 10);
    const rnd = mulberry32(21);
    this.dunes = new THREE.InstancedMesh(duneGeo, this.mats.dune, 26);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (22 + rnd() * 40);
      const z = -90 + rnd() * 100;
      const s = 6 + rnd() * 10;
      m.compose(new THREE.Vector3(x, -s * 0.72, z), new THREE.Quaternion(), new THREE.Vector3(s * 1.6, s, s * 1.2));
      this.dunes.setMatrixAt(i, m);
    }
    this.dunes.receiveShadow = true;
    this.scene.add(this.dunes);
  }

  buildRoad() {
    const tex = canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = '#8f949c';
      g.fillRect(0, 0, w, h);
      const rnd = mulberry32(9);
      for (let i = 0; i < 2600; i++) {
        const v = 120 + Math.floor(rnd() * 60);
        g.fillStyle = `rgba(${v},${v},${v + 6},0.45)`;
        g.fillRect(rnd() * w, rnd() * h, 2, 2);
      }
      // patches
      for (let i = 0; i < 5; i++) {
        g.fillStyle = 'rgba(70,72,78,0.25)';
        g.fillRect(20 + rnd() * 180, rnd() * h, 30 + rnd() * 50, 30 + rnd() * 60);
      }
      // cracks
      g.strokeStyle = 'rgba(40,40,45,0.55)';
      g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        let x = rnd() * w;
        let y = rnd() * h;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rnd() - 0.5) * 40;
          y += (rnd() - 0.2) * 30;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      // edge lines + dashed center
      g.fillStyle = '#f4f4f4';
      g.fillRect(10, 0, 9, h);
      g.fillRect(w - 19, 0, 9, h);
      for (let y = 20; y < h; y += 128) g.fillRect(w / 2 - 5, y, 10, 64);
    }, 1, 8);
    this.mats.road = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    const len = 80;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(L.ROAD_HALF * 2, len), this.mats.road);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, L.BARRICADE_Z + 1 - len / 2);
    road.receiveShadow = true;
    this.scene.add(road);

    // curb stones (red / white) along the road beyond the decks
    const k = new Kit();
    for (let z = L.DECK_Z1 - 0.5; z > L.SPAWN_Z - 4; z -= 1.2) {
      const col = Math.round(z / 1.2) % 2 ? 0xe53935 : 0xf2f2f2;
      k.box(0.35, 0.22, 1.18, col, -L.ROAD_HALF - 0.17, 0.11, z);
      k.box(0.35, 0.22, 1.18, col, L.ROAD_HALF + 0.17, 0.11, z);
    }
    const curbs = k.build();
    curbs.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    this.scene.add(curbs);
  }

  // ---------------------------------------------------------------- gun decks
  buildDecks() {
    const k = new Kit();
    const planks = [0xa8703e, 0x9a6536, 0xb57a45];
    for (const side of [-1, 1]) {
      // inner wooden deck
      let n = 0;
      for (let z = L.DECK_Z0; z > L.DECK_Z1; z -= 0.5) {
        k.box(2.9, 0.12, 0.47, planks[n++ % 3], side * L.INNER_X, L.INNER_Y - 0.06, z - 0.25);
      }
      const len = L.DECK_Z0 - L.DECK_Z1;
      const mid = (L.DECK_Z0 + L.DECK_Z1) / 2;
      k.box(2.8, L.INNER_Y - 0.12, len, 0x6e4526, side * L.INNER_X, (L.INNER_Y - 0.12) / 2, mid);
      for (let z = L.DECK_Z0 - 0.3; z > L.DECK_Z1; z -= 2.4) {
        k.box(0.2, L.INNER_Y - 0.1, 0.2, 0x4a2e19, side * (L.INNER_X + 1.45), (L.INNER_Y - 0.1) / 2, z);
      }
      // outer HESCO blast wall blocks
      for (let z = L.DECK_Z0 - 0.72; z > L.DECK_Z1; z -= 1.46) {
        const x = side * L.OUTER_X;
        k.rbox(2.9, L.OUTER_Y, 1.42, 0.06, 0xcdb582, x, L.OUTER_Y / 2, z);
        // wire mesh
        for (const yy of [0.4, 0.8, 1.2]) k.box(2.94, 0.03, 1.46, 0x7c7466, x, yy, z);
        for (const xx of [-1.45, -0.72, 0, 0.72, 1.45]) k.box(0.03, L.OUTER_Y + 0.02, 1.46, 0x7c7466, x + xx, L.OUTER_Y / 2, z);
        k.box(2.94, 0.06, 0.04, 0x7c7466, x, L.OUTER_Y, z + 0.71);
      }
    }
    const decks = k.build();
    decks.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    this.scene.add(decks);
  }

  buildSandbags() {
    const geo = sandbagGeometry();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const items = [];
    const rnd = mulberry32(5);
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 2; layer++) {
        for (let z = L.DECK_Z0 - 0.5 - layer * 0.5; z > L.DECK_Z1 + 0.3; z -= 1.0) {
          items.push({ x: side * 5.75, y: layer * 0.34, z, ry: Math.PI / 2 + (rnd() - 0.5) * 0.12 });
        }
      }
      // a few on top of the wooden deck edge (lip)
      for (let z = L.DECK_Z0 - 1; z > L.DECK_Z1 + 0.5; z -= 1.0) {
        items.push({ x: side * 6.05, y: 0.68, z, ry: Math.PI / 2 + (rnd() - 0.5) * 0.12, s: 0.9 });
      }
    }
    // plaza corner piles
    for (const [px, pz] of [[-8.2, 5.2], [8.2, 5.2], [-9.4, 14.8], [9.4, 14.8]]) {
      for (let i = 0; i < 5; i++) {
        items.push({ x: px + (i % 3) * 0.9 - 0.9, y: Math.floor(i / 3) * 0.34, z: pz + (rnd() - 0.5) * 0.2, ry: (rnd() - 0.5) * 0.3 });
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    const tones = [0xd9bd86, 0xcfae72, 0xe3c996, 0xc4a36a];
    items.forEach((it, i) => {
      e.set((rnd() - 0.5) * 0.08, it.ry, (rnd() - 0.5) * 0.08);
      q.setFromEuler(e);
      const s = it.s || 1;
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
      c.set(tones[Math.floor(rnd() * tones.length)]);
      mesh.setColorAt(i, c);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // concrete barriers along the far road
    const bgeo = barrierGeometry();
    const bmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const list = [];
    for (let z = L.DECK_Z1 - 1.6; z > L.SPAWN_Z + 2; z -= 2.2) {
      list.push([-L.ROAD_HALF - 0.9, z], [L.ROAD_HALF + 0.9, z]);
    }
    const bm = new THREE.InstancedMesh(bgeo, bmat, list.length);
    bm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
    list.forEach(([x, z], i) => {
      e.set(0, Math.PI / 2 + (rnd() - 0.5) * 0.15, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1));
      bm.setMatrixAt(i, m);
      c.set(0xc9ccd2).multiplyScalar(0.9 + rnd() * 0.15);
      bm.setColorAt(i, c);
    });
    bm.castShadow = true;
    bm.receiveShadow = true;
    this.scene.add(bm);
  }

  // ---------------------------------------------------------------- barricade
  buildBarricade() {
    const g = new THREE.Group();
    g.position.set(0, 0, L.BARRICADE_Z);
    const k = new Kit();
    // jersey barriers behind
    const bgeo = barrierGeometry();
    for (let i = 0; i < 5; i++) k.geo(bgeo.clone(), 0xc9ccd2, -4.2 + i * 2.1, 0, 0.35);
    // sandbags in front, 3 layers
    const bag = sandbagGeometry();
    const tones = [0xd9bd86, 0xcfae72, 0xe3c996];
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 11 - layer; i++) {
        const x = -5.0 + i * 1.0 + layer * 0.5;
        k.geo(bag.clone(), tones[(i + layer) % 3], x, layer * 0.34, -0.45, { ry: (Math.sin(i * 7.1) * 0.1) });
      }
    }
    // barbed wire coil
    for (let x = -5.2; x <= 5.2; x += 0.22) {
      k.tor(0.34, 0.018, 0x5a5f66, x, 0.36, -1.35, { axis: 'x', rs: 4, seg: 12, rz: 0.25, m: 'metal' });
    }
    k.box(10.6, 0.03, 0.03, 0x5a5f66, 0, 0.36, -1.35);
    // czech hedgehogs
    for (const hx of [-3.4, 0.2, 3.6]) {
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * Math.PI;
        k.box(0.14, 0.14, 1.9, 0x4d535c, hx, 0.62, -2.3, { ry: a, rx: 0.62, m: 'metal' });
      }
    }
    const mesh = k.build();
    mesh.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    g.add(mesh);
    this.barricade = g;
    this.scene.add(g);
  }

  shakeBarricade(amount = 0.15) {
    this.shakeT = Math.max(this.shakeT, amount);
  }

  // ---------------------------------------------------------------- plaza
  buildPlaza() {
    const k = new Kit();
    // concrete base slab + tiles
    k.box(19.4, 0.1, 11.6, 0xd6cfbf, 0, -0.03, 10.6);
    for (let x = -9; x <= 9; x += 3) k.box(0.05, 0.02, 11.4, 0xbdb4a2, x, 0.025, 10.6);
    for (let z = 5.2; z <= 16; z += 3) k.box(19.2, 0.02, 0.05, 0xbdb4a2, 0, 0.025, z);
    // hazard stripe at the front edge
    for (let i = 0; i < 24; i++) {
      k.box(0.8, 0.03, 0.4, i % 2 ? 0xffc62e : 0x2a2a2a, -9.3 + i * 0.81, 0.03, 4.95, { ry: 0 });
    }
    // props
    decoBarrel(k, -9.0, 7.0, 0xe53935);
    decoBarrel(k, -8.9, 8.1, 0x3fa9ff);
    decoBarrel(k, 9.1, 6.9, 0xffc62e);
    decoCrate(k, 9.0, 8.3, 0.9, 0.3);
    decoCrate(k, 8.8, 9.3, 0.6, -0.2);
    decoCrate(k, -9.1, 15.2, 0.8, 0.5);
    decoTire(k, 9.3, 15.6);
    decoTire(k, 9.3, 15.6 + 0.001);
    decoLamp(k, -9.8, 11.5, 0xfff1b0);
    decoLamp(k, 9.8, 11.5, 0xfff1b0);
    // flag pole
    k.cyl(0.07, 5.5, 0xc0c6cf, -8.4, 2.75, 13.4, { axis: 'y', m: 'metal' });
    k.sph(0.12, 0xffc62e, -8.4, 5.55, 13.4, { m: 'metal' });
    const base = k.build();
    base.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    this.scene.add(base);

    // waving flag (vertex animated)
    const flagGeo = new THREE.PlaneGeometry(2.2, 1.3, 10, 4);
    const fc = document.createElement('canvas');
    fc.width = 256;
    fc.height = 150;
    const g = fc.getContext('2d');
    g.fillStyle = '#e53935';
    g.fillRect(0, 0, 256, 150);
    g.fillStyle = '#ffc62e';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 20 : 48;
      g.lineTo(128 + Math.cos(a) * r, 75 + Math.sin(a) * r);
    }
    g.fill();
    const ft = new THREE.CanvasTexture(fc);
    ft.colorSpace = THREE.SRGBColorSpace;
    this.flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ map: ft, side: THREE.DoubleSide }));
    this.flag.position.set(-8.4 + 1.1, 4.8, 13.4);
    this.flag.castShadow = true;
    this.flagBase = flagGeo.attributes.position.array.slice();
    this.scene.add(this.flag);
  }

  // ---------------------------------------------------------------- scenery
  buildMesas() {
    this.mats.rock = new THREE.MeshLambertMaterial({ color: 0xd9773f, flatShading: true });
    this.mats.rockDark = new THREE.MeshLambertMaterial({ color: 0xb85a2c, flatShading: true });
    const rnd = mulberry32(77);
    const group = new THREE.Group();
    const spots = [];
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI * 0.95 + (i / 17) * Math.PI * 0.9 + (rnd() - 0.5) * 0.1;
      const r = 110 + rnd() * 70;
      spots.push([Math.cos(a) * r * 1.2, Math.sin(a) * r - 40]);
    }
    for (const [x, z] of spots) {
      const h = 12 + rnd() * 26;
      const rb = 10 + rnd() * 16;
      const m1 = new THREE.Mesh(new THREE.CylinderGeometry(rb * 0.72, rb, h, 7), rnd() < 0.5 ? this.mats.rock : this.mats.rockDark);
      m1.position.set(x, h / 2 - 1, z);
      m1.rotation.y = rnd() * 3;
      group.add(m1);
      if (rnd() < 0.6) {
        const h2 = h * (0.3 + rnd() * 0.4);
        const m2 = new THREE.Mesh(new THREE.CylinderGeometry(rb * 0.45, rb * 0.62, h2, 6), this.mats.rockDark);
        m2.position.set(x + (rnd() - 0.5) * 4, h + h2 / 2 - 1.5, z + (rnd() - 0.5) * 4);
        group.add(m2);
      }
    }
    this.scene.add(group);
  }

  buildClouds() {
    const k = new Kit({ mat: 'matte' });
    const rnd = mulberry32(12);
    for (let i = 0; i < 7; i++) {
      k.sph(1, 0xffffff, rnd() * 2.2 - 1.1, rnd() * 0.5, rnd() * 1.2 - 0.6, { seg: 10, segH: 7, sx: 1.4 + rnd(), sy: 0.8 + rnd() * 0.4, sz: 1.2 });
    }
    const tmpl = k.build({ shadows: false });
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = tmpl.clone();
      const s = 4 + rnd() * 5;
      c.scale.set(s, s * 0.7, s);
      c.position.set(-120 + rnd() * 240, 38 + rnd() * 22, -150 + rnd() * 90);
      this.clouds.push(c);
      this.scene.add(c);
    }
  }

  buildStars() {
    const n = 500;
    const pos = new Float32Array(n * 3);
    const rnd = mulberry32(99);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const e = 0.08 + rnd() * 1.3;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 440;
      pos[i * 3 + 1] = Math.sin(e) * 440;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 440;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
    this.stars.visible = false;
    this.scene.add(this.stars);
  }

  buildDecorations(zone, zi) {
    if (this.decoGroup) {
      this.scene.remove(this.decoGroup);
      this.decoGroup.traverse((o) => o.geometry && o.geometry.dispose());
    }
    const rnd = mulberry32(1000 + zi * 17);
    const k = new Kit();
    const spots = [];
    // wide fields left and right
    for (let i = 0; i < 46; i++) {
      const side = i % 2 ? 1 : -1;
      spots.push([side * (14 + rnd() * 34), -75 + rnd() * 95]);
    }
    // along the far road
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      spots.push([side * (7.5 + rnd() * 5), L.SPAWN_Z + 2 + rnd() * 24]);
    }
    const t = zone.deco;
    spots.forEach(([x, z], i) => {
      const r = rnd();
      const s = 0.8 + rnd() * 0.7;
      if (t === 'desert') {
        if (r < 0.35) decoCactus(k, x, z, s);
        else if (r < 0.6) decoRock(k, x, z, 0.8 * s, zone.rock, rnd() * 3);
        else if (r < 0.72) decoDeadTree(k, x, z, s);
        else if (r < 0.84) decoBarrel(k, x, z, rnd() < 0.5 ? 0xe53935 : 0xffc62e, rnd() < 0.4);
        else if (r < 0.93) decoTire(k, x, z);
        else decoCrate(k, x, z, s, rnd() * 3);
      } else if (t === 'canyon') {
        if (r < 0.55) decoRock(k, x, z, (0.9 + rnd()) * s, rnd() < 0.5 ? zone.rock : zone.rockDark, rnd() * 3);
        else if (r < 0.75) decoDeadTree(k, x, z, s);
        else if (r < 0.88) decoCrate(k, x, z, s, rnd() * 3);
        else decoBarrel(k, x, z, 0x8d6e63, rnd() < 0.5);
      } else if (t === 'snow') {
        if (r < 0.55) decoPine(k, x, z, s * 1.2, true);
        else if (r < 0.8) decoRock(k, x, z, 0.8 * s, zone.rock, rnd() * 3);
        else if (r < 0.9) {
          k.sph(0.7, 0xffffff, x, 0.6, z);
          k.sph(0.5, 0xffffff, x, 1.5, z);
          k.sph(0.35, 0xffffff, x, 2.2, z);
          k.cone(0.08, 0.4, 0xff8a1f, x, 2.2, z + 0.4);
        } else decoCrystal(k, x, z, s, 0x9fe8ff);
      } else if (t === 'toxic') {
        if (r < 0.45) decoMushroom(k, x, z, s * 1.3, rnd() < 0.5 ? 0xb04dff : 0x5ee65e);
        else if (r < 0.65) decoDeadTree(k, x, z, s);
        else if (r < 0.85) {
          decoBarrel(k, x, z, 0x3d8b3d, false);
          k.cyl(0.36, 0.06, 0xb6ff3a, x, 1.22, z, { axis: 'y', m: 'glow' });
        } else decoRock(k, x, z, 0.8 * s, zone.rock, rnd() * 3);
      } else if (t === 'volcano') {
        if (r < 0.5) decoRock(k, x, z, (0.9 + rnd()) * s, zone.rock, rnd() * 3);
        else if (r < 0.75) decoCrystal(k, x, z, s, 0xff5a1f);
        else decoDeadTree(k, x, z, s);
      } else {
        if (r < 0.35) {
          k.tor(1.4 * s, 0.35 * s, zone.rockDark, x, 0.05, z, { axis: 'y', sy: 0.4 });
        } else if (r < 0.6) decoRock(k, x, z, 0.8 * s, zone.rock, rnd() * 3);
        else if (r < 0.8) decoCrystal(k, x, z, s, 0x5ae0ff);
        else {
          k.cyl(0.1, 2.4, 0xc0c6cf, x, 1.2, z, { axis: 'y', m: 'metal' });
          k.sph(0.9, 0xe0e4ea, x, 2.7, z, { sy: 0.35, rx: 0.6, m: 'metal' });
          k.sph(0.12, 0xff3358, x, 3.2, z, { m: 'glow' });
        }
      }
      void i;
    });
    this.decoGroup = k.build();
    this.decoGroup.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    this.scene.add(this.decoGroup);
  }

  applyZone(zi) {
    const zone = ZONES[zi % ZONES.length];
    this.zoneIndex = zi;
    this.skyMat.uniforms.top.value.set(zone.skyTop);
    this.skyMat.uniforms.bottom.value.set(zone.skyBottom);
    this.scene.fog.color.set(zone.fog);
    this.scene.fog.near = zone.fogNear;
    this.scene.fog.far = zone.fogFar;
    this.mats.ground.color.set(zone.ground);
    this.mats.dune.color.set(zone.groundDark);
    this.mats.rock.color.set(zone.rock);
    this.mats.rockDark.color.set(zone.rockDark);
    this.mats.road.color.set(zone.road).multiplyScalar(1.55);
    this.hemi.color.set(zone.hemiSky);
    this.hemi.groundColor.set(zone.hemiGround);
    this.sun.color.set(zone.sun);
    this.portal.userData.vortex.material.uniforms.uColor.value.set(zone.accent);
    const moon = zone.deco === 'moon';
    this.stars.visible = moon;
    for (const c of this.clouds) c.visible = !moon;
    this.buildDecorations(zone, zi);
  }

  update(dt) {
    this.time += dt;
    this.portal.userData.vortex.material.uniforms.uTime.value = this.time;
    for (const c of this.clouds) {
      c.position.x += dt * 1.2;
      if (c.position.x > 140) c.position.x = -140;
    }
    // flag wave
    const p = this.flag.geometry.attributes.position;
    const a = p.array;
    const b = this.flagBase;
    for (let i = 0; i < a.length; i += 3) {
      const u = (b[i] + 1.1) / 2.2;
      a[i + 2] = b[i + 2] + Math.sin(this.time * 5 + b[i] * 3 + b[i + 1]) * 0.18 * u;
    }
    p.needsUpdate = true;
    this.flag.geometry.computeVertexNormals();
    // barricade shake
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt * 0.8);
      this.barricade.position.x = Math.sin(this.time * 70) * this.shakeT;
      this.barricade.position.z = L.BARRICADE_Z + Math.cos(this.time * 53) * this.shakeT * 0.5;
    } else {
      this.barricade.position.x = 0;
      this.barricade.position.z = L.BARRICADE_Z;
    }
  }
}
