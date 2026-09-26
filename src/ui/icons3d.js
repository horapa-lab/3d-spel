// Glossy 3D-rendered UI icons (rendered once at startup into small PNGs with a
// dark cartoon outline) so every button looks like a real mobile game.

import * as THREE from 'three';
import { Kit } from '../gfx/kit.js';
import { gunTemplate } from '../gfx/gunModels.js';
import { buildCrate } from '../gfx/props.js';

const SIZE = 128;
const INK = '#2b1d3a';

function shape(points, close = true) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  if (close) s.closePath();
  return s;
}

function extrude(k, sh, color, depth = 0.3, bevel = 0.08, o = {}) {
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  k.geo(g, color, o.x || 0, o.y || 0, o.z || 0, o);
}

function starShape(r1, r2, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return shape(pts);
}

function gearShape(r1, r2, teeth = 8) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    pts.push([Math.cos(a0) * r2, Math.sin(a0) * r2]);
    pts.push([Math.cos(a0 + step * 0.15) * r1, Math.sin(a0 + step * 0.15) * r1]);
    pts.push([Math.cos(a0 + step * 0.45) * r1, Math.sin(a0 + step * 0.45) * r1]);
    pts.push([Math.cos(a0 + step * 0.6) * r2, Math.sin(a0 + step * 0.6) * r2]);
  }
  const s = shape(pts);
  const hole = new THREE.Path();
  hole.absarc(0, 0, r2 * 0.42, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

const BUILD = {
  coin(k) {
    k.cyl(0.95, 0.3, 0xe0a21a, 0, 0, 0, { axis: 'z', seg: 32, m: 'metal' });
    k.tor(0.88, 0.1, 0xffd23f, 0, 0, 0.12, { seg: 32, m: 'metal' });
    k.cyl(0.78, 0.32, 0xffd23f, 0, 0, 0.02, { axis: 'z', seg: 32, m: 'metal' });
    extrude(k, starShape(0.5, 0.22), 0xfff0a0, 0.1, 0.04, { z: 0.2, m: 'metal' });
    return { rx: 0.35, ry: -0.45 };
  },
  bolt(k) {
    extrude(k, shape([[0.15, 1.05], [-0.55, -0.05], [-0.05, -0.05], [-0.3, -1.05], [0.6, 0.2], [0.05, 0.2], [0.35, 1.05]]), 0xffc62e, 0.34, 0.1, { m: 'metal' });
    return { rx: 0.2, ry: -0.35 };
  },
  fire(k) {
    const outer = shape([[0, 1.1], [0.35, 0.55], [0.7, 0.1], [0.72, -0.35], [0.45, -0.85], [0, -1.0], [-0.45, -0.85], [-0.72, -0.35], [-0.6, 0.15], [-0.3, 0.35], [-0.2, 0.75]]);
    extrude(k, outer, 0xff5a2a, 0.3, 0.08);
    const inner = shape([[0, 0.45], [0.3, 0.0], [0.4, -0.4], [0.2, -0.75], [0, -0.82], [-0.2, -0.75], [-0.4, -0.4], [-0.25, -0.05]]);
    extrude(k, inner, 0xffd23f, 0.2, 0.06, { z: 0.2, m: 'glow' });
    return { rx: 0.15, ry: -0.3 };
  },
  shield(k) {
    const sh = shape([[0, 1.05], [0.85, 0.75], [0.8, -0.05], [0.45, -0.7], [0, -1.05], [-0.45, -0.7], [-0.8, -0.05], [-0.85, 0.75]]);
    extrude(k, sh, 0x2a86e8, 0.3, 0.1);
    const inner = shape([[0, 0.8], [0.6, 0.58], [0.56, -0.02], [0.3, -0.5], [0, -0.78], [-0.3, -0.5], [-0.56, -0.02], [-0.6, 0.58]]);
    extrude(k, inner, 0x8fd0ff, 0.1, 0.04, { z: 0.2 });
    extrude(k, starShape(0.34, 0.15), 0xffffff, 0.08, 0.03, { z: 0.3, y: 0.05 });
    return { rx: 0.2, ry: -0.35 };
  },
  clover(k) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      k.sph(0.42, 0x3fd24a, Math.cos(a) * 0.4, Math.sin(a) * 0.4 + 0.1, 0, { sz: 0.45, seg: 20 });
    }
    k.sph(0.2, 0x2fa83a, 0, 0.1, 0.12, { sz: 0.5 });
    k.cap(0.07, 0.6, 0x2fa83a, 0.25, -0.6, 0, { rz: 0.5 });
    return { rx: 0.25, ry: -0.3 };
  },
  vault(k) {
    k.rbox(1.6, 1.6, 1.1, 0.2, 0x9aa5b4, 0, 0, 0, { m: 'metal', seg: 3 });
    k.cyl(0.58, 0.14, 0x6b7482, 0, 0.02, 0.58, { axis: 'z', seg: 28, m: 'metal' });
    k.tor(0.34, 0.07, 0xffc62e, 0, 0.02, 0.68, { m: 'metal', seg: 24 });
    for (let i = 0; i < 4; i++) k.box(0.07, 0.62, 0.07, 0xffc62e, 0, 0.02, 0.68, { rz: (i * Math.PI) / 4, m: 'metal' });
    k.rbox(0.14, 0.6, 0.14, 0.05, 0x3b4150, 0.7, 0, 0.55);
    return { rx: 0.3, ry: -0.5, s: 0.95 };
  },
  slot(k) {
    k.rbox(1.6, 1.6, 0.5, 0.35, 0x3fcf52, 0, 0, 0, { seg: 3 });
    const w = 0.18;
    const l = 0.55;
    extrude(k, shape([[-w, -l], [w, -l], [w, -w], [l, -w], [l, w], [w, w], [w, l], [-w, l], [-w, w], [-l, w], [-l, -w], [-w, -w]]), 0xffffff, 0.12, 0.04, { z: 0.3 });
    return { rx: 0.3, ry: -0.35 };
  },
  up(k) {
    extrude(k, shape([[0, 1.05], [0.85, 0.1], [0.35, 0.1], [0.35, -1.0], [-0.35, -1.0], [-0.35, 0.1], [-0.85, 0.1]]), 0x3fd24a, 0.34, 0.1);
    return { rx: 0.2, ry: -0.35 };
  },
  star(k) {
    extrude(k, starShape(1.05, 0.46), 0xffc62e, 0.34, 0.1, { m: 'metal' });
    return { rx: 0.2, ry: -0.3 };
  },
  gear(k) {
    extrude(k, gearShape(0.72, 1.0, 8), 0xd6dbe6, 0.34, 0.07, { m: 'metal' });
    k.cyl(0.3, 0.36, 0x9c6bff, 0, 0, 0, { axis: 'z', seg: 24 });
    return { rx: 0.3, ry: -0.35 };
  },
  skull(k) {
    k.rbox(1.4, 1.2, 1.1, 0.5, 0xf6f2e6, 0, 0.15, 0, { seg: 3 });
    k.rbox(0.9, 0.4, 0.8, 0.15, 0xf6f2e6, 0, -0.55, 0.12);
    k.sph(0.24, 0x2b1d3a, -0.3, 0.12, 0.5, { sz: 0.5 });
    k.sph(0.24, 0x2b1d3a, 0.3, 0.12, 0.5, { sz: 0.5 });
    k.sph(0.08, 0xff3b4d, -0.3, 0.12, 0.62, { m: 'glow' });
    k.sph(0.08, 0xff3b4d, 0.3, 0.12, 0.62, { m: 'glow' });
    for (let i = -1; i <= 1; i++) k.rbox(0.14, 0.16, 0.06, 0.03, 0x2b1d3a, i * 0.22, -0.52, 0.53);
    return { rx: 0.2, ry: -0.3, s: 0.95 };
  },
  clock(k) {
    k.cyl(1.0, 0.3, 0x3fa9ff, 0, 0, 0, { axis: 'z', seg: 32 });
    k.cyl(0.84, 0.32, 0xffffff, 0, 0, 0.02, { axis: 'z', seg: 32 });
    k.rbox(0.12, 0.6, 0.08, 0.04, 0x2b1d3a, 0, 0.26, 0.2);
    k.rbox(0.45, 0.12, 0.08, 0.04, 0x2b1d3a, 0.2, 0, 0.2);
    k.sph(0.1, 0xff4d5e, 0, 0, 0.24);
    return { rx: 0.2, ry: -0.35 };
  },
  music(k) {
    k.sph(0.36, 0xb45cff, -0.42, -0.6, 0, { sz: 0.7, sy: 0.8 });
    k.sph(0.36, 0xb45cff, 0.5, -0.4, 0, { sz: 0.7, sy: 0.8 });
    k.rbox(0.14, 1.5, 0.2, 0.06, 0xb45cff, -0.16, 0.12, 0);
    k.rbox(0.14, 1.5, 0.2, 0.06, 0xb45cff, 0.76, 0.32, 0);
    k.rbox(1.05, 0.3, 0.22, 0.1, 0x8a3fe0, 0.3, 0.9, 0, { rz: 0.2 });
    return { rx: 0.1, ry: -0.3, s: 0.95 };
  },
  sound(k) {
    extrude(k, shape([[-0.9, 0.35], [-0.45, 0.35], [0.1, 0.85], [0.1, -0.85], [-0.45, -0.35], [-0.9, -0.35]]), 0xf2f4f8, 0.4, 0.08);
    k.tor(0.5, 0.08, 0x3fa9ff, 0.15, 0, 0, { arc: Math.PI * 0.7, rz: -Math.PI * 0.35 });
    k.tor(0.85, 0.08, 0x3fa9ff, 0.15, 0, 0, { arc: Math.PI * 0.6, rz: -Math.PI * 0.3 });
    return { rx: 0.15, ry: -0.35 };
  },
  lock(k) {
    k.tor(0.42, 0.13, 0xb8c2cf, 0, 0.35, 0, { arc: Math.PI, m: 'metal' });
    k.rbox(1.3, 1.0, 0.6, 0.22, 0xffc62e, 0, -0.3, 0, { m: 'metal', seg: 3 });
    k.sph(0.13, 0x2b1d3a, 0, -0.22, 0.3);
    k.rbox(0.1, 0.3, 0.1, 0.03, 0x2b1d3a, 0, -0.45, 0.28);
    return { rx: 0.25, ry: -0.35 };
  },
  trophy(k) {
    k.cyl(0.62, 0.9, 0xffc62e, 0, 0.45, 0, { axis: 'y', r2: 0.72, seg: 24, m: 'metal' });
    k.cyl(0.14, 0.45, 0xe0a21a, 0, -0.2, 0, { axis: 'y', m: 'metal' });
    k.rbox(1.0, 0.3, 0.7, 0.1, 0x8a5a2b, 0, -0.55, 0, { seg: 3 });
    for (const sx of [-1, 1]) k.tor(0.3, 0.08, 0xffc62e, sx * 0.72, 0.5, 0, { axis: 'z', arc: Math.PI, rz: sx > 0 ? -Math.PI / 2 : Math.PI / 2, m: 'metal' });
    return { rx: 0.2, ry: -0.3, s: 0.9 };
  },
  arrowDown(k) {
    extrude(k, shape([[0, -1.05], [0.85, -0.1], [0.35, -0.1], [0.35, 1.0], [-0.35, 1.0], [-0.35, -0.1], [-0.85, -0.1]]), 0xffc62e, 0.34, 0.1);
    return { rx: 0.2, ry: -0.35 };
  },
  play(k) {
    k.rbox(1.9, 1.3, 0.4, 0.3, 0xff4d5e, 0, 0, 0, { seg: 3 });
    extrude(k, shape([[-0.25, 0.4], [0.45, 0], [-0.25, -0.4]]), 0xffffff, 0.12, 0.05, { z: 0.24 });
    return { rx: 0.25, ry: -0.35 };
  },
};

export class IconFactory {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = {};
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a6a8a, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(-2, 4, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff0d0, 1.4);
    rim.position.set(4, 2, -3);
    this.scene.add(rim);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0, 8.2);
    this.rt = new THREE.WebGLRenderTarget(SIZE * 2, SIZE * 2, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.buf = new Uint8Array(SIZE * 2 * SIZE * 2 * 4);
  }

  get(name) {
    if (this.cache[name]) return this.cache[name];
    let url = '';
    try {
      url = this._render(name);
    } catch (e) {
      console.warn('icon render failed', name, e);
    }
    this.cache[name] = url;
    return url;
  }

  _model(name) {
    if (name === 'gun') {
      const t = gunTemplate('pistol');
      const g = new THREE.Group();
      const o = t.obj.clone(true);
      const c = new THREE.Vector3();
      t.box.getCenter(c);
      o.position.sub(c);
      g.add(o);
      g.rotation.set(0.25, Math.PI / 2 - 0.35, 0);
      g.scale.setScalar(1.55);
      return g;
    }
    if (name === 'crate') {
      const c = buildCrate(0);
      const g = new THREE.Group();
      c.position.set(0, -0.55, 0);
      g.add(c);
      g.rotation.set(0.45, -0.55, 0);
      g.scale.setScalar(0.62);
      return g;
    }
    const k = new Kit();
    const b = BUILD[name] || BUILD.star;
    const pose = b(k);
    const g = new THREE.Group();
    g.add(k.build({ shadows: false }));
    g.rotation.set(pose.rx || 0, pose.ry || 0, 0);
    g.scale.setScalar(pose.s || 1);
    return g;
  }

  _render(name) {
    const r = this.renderer;
    const model = this._model(name);
    this.scene.add(model);
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevShadow = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    const W = SIZE * 2;
    r.readRenderTargetPixels(this.rt, 0, 0, W, W, this.buf);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    r.shadowMap.enabled = prevShadow;
    this.scene.remove(model);

    // flip Y into a canvas
    const src = document.createElement('canvas');
    src.width = src.height = W;
    const sctx = src.getContext('2d');
    const img = sctx.createImageData(W, W);
    const row = W * 4;
    for (let y = 0; y < W; y++) img.data.set(this.buf.subarray((W - 1 - y) * row, (W - y) * row), y * row);
    sctx.putImageData(img, 0, 0);

    // cartoon outline: stamp a dark silhouette around the icon, then the icon on top
    const out = document.createElement('canvas');
    out.width = out.height = SIZE;
    const g = out.getContext('2d');
    const sil = document.createElement('canvas');
    sil.width = sil.height = SIZE;
    const sg = sil.getContext('2d');
    const pad = 8;
    sg.drawImage(src, pad, pad, SIZE - pad * 2, SIZE - pad * 2);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = INK;
    sg.fillRect(0, 0, SIZE, SIZE);
    const R = 4;
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      g.drawImage(sil, Math.cos(ang) * R, Math.sin(ang) * R + 1.5);
    }
    g.drawImage(src, pad, pad, SIZE - pad * 2, SIZE - pad * 2);
    return out.toDataURL('image/png');
  }
}
