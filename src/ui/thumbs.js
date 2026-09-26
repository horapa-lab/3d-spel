// Renders every gun model once into a small image for the Arsenal UI.

import * as THREE from 'three';
import { gunTemplate } from '../gfx/gunModels.js';

const W = 256;
const H = 150;

export class Thumbs {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = new Map();
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a9a, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 6);
    this.scene.add(key);
    this.camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
    this.camera.position.set(0, 0.6, 10);
    this.camera.lookAt(0, 0, 0);
    this.rt = new THREE.WebGLRenderTarget(W * 2, H * 2, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.buf = new Uint8Array(W * 2 * H * 2 * 4);
    this.canvas = document.createElement('canvas');
    this.canvas.width = W * 2;
    this.canvas.height = H * 2;
    this.ctx = this.canvas.getContext('2d');
  }

  get(id, gold = false) {
    const key = id + (gold ? '*' : '');
    if (this.cache.has(key)) return this.cache.get(key);
    const url = this._render(id, gold);
    this.cache.set(key, url);
    return url;
  }

  _render(id, gold) {
    const r = this.renderer;
    const t = gunTemplate(id, gold);
    const obj = t.obj.clone(true);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    t.box.getSize(size);
    t.box.getCenter(center);
    obj.position.sub(center);
    const pivot = new THREE.Group();
    pivot.add(obj);
    pivot.rotation.set(0.18, Math.PI / 2 - 0.42, 0);
    const s = 3.3 / Math.max(size.z, 1.1);
    pivot.scale.setScalar(s);
    this.scene.add(pivot);

    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevShadow = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    r.readRenderTargetPixels(this.rt, 0, 0, W * 2, H * 2, this.buf);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    r.shadowMap.enabled = prevShadow;
    this.scene.remove(pivot);

    const img = this.ctx.createImageData(W * 2, H * 2);
    const rowBytes = W * 2 * 4;
    for (let y = 0; y < H * 2; y++) {
      const src = (H * 2 - 1 - y) * rowBytes;
      img.data.set(this.buf.subarray(src, src + rowBytes), y * rowBytes);
    }
    this.ctx.clearRect(0, 0, W * 2, H * 2);
    this.ctx.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}
