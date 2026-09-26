// GPU-friendly particle primitives. Each system is ONE draw call.
//  Billboards   - camera facing sprites (glow, smoke, sparkles) with per-particle alpha
//  CubeBits     - small lit cubes with physics (goo, debris, confetti)
//  Streaks      - stretched glowing boxes between two points (tracers, lightning, beams)
//  RingPool     - expanding shockwave rings on the ground

import * as THREE from 'three';

const _c = new THREE.Color();

// ------------------------------------------------------------------ billboards
const BB_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iCol;
attribute float iSize;
attribute float iRot;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vUv = uv;
  vCol = iCol;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iRot), s = sin(iRot);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSize;
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
}`;

const BB_FRAG = /* glsl */ `
uniform int uShape;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float a;
  if (uShape == 0) {            // soft glow
    a = pow(max(0.0, 1.0 - d), 1.6);
  } else if (uShape == 1) {     // puffy smoke
    a = smoothstep(1.0, 0.55, d);
  } else {                      // 4 point sparkle
    float st = max(0.0, 1.0 - abs(p.x) * 6.0 - abs(p.y) * 0.9) + max(0.0, 1.0 - abs(p.y) * 6.0 - abs(p.x) * 0.9);
    a = clamp(st + pow(max(0.0, 1.0 - d * 1.8), 2.0), 0.0, 1.0);
  }
  if (a <= 0.002) discard;
  gl_FragColor = vec4(vCol.rgb, a * vCol.a);
  #include <colorspace_fragment>
}`;

export class Billboards {
  constructor(max, { additive = true, shape = 0, renderOrder = 10 } = {}) {
    this.max = max;
    this.count = 0;
    // simulation state (SoA)
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.rgb = new Float32Array(max * 3);
    this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.rotV = new Float32Array(max);
    this.fadeIn = new Float32Array(max);

    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iCol', this.aCol);
    geo.setAttribute('iSize', this.aSize);
    geo.setAttribute('iRot', this.aRot);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uShape: { value: shape } },
      vertexShader: BB_VERT,
      fragmentShader: BB_FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.geo = geo;
  }

  /** color: hex number. size animates from s0 to s1 over the lifetime. */
  spawn(x, y, z, vx, vy, vz, life, s0, s1, color, alpha = 1, o = {}) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i3 = i * 3;
    this.p[i3] = x;
    this.p[i3 + 1] = y;
    this.p[i3 + 2] = z;
    this.v[i3] = vx;
    this.v[i3 + 1] = vy;
    this.v[i3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.s0[i] = s0;
    this.s1[i] = s1;
    _c.set(color);
    this.rgb[i3] = _c.r;
    this.rgb[i3 + 1] = _c.g;
    this.rgb[i3 + 2] = _c.b;
    this.a0[i] = alpha;
    this.drag[i] = o.drag ?? 1.5;
    this.grav[i] = o.grav ?? 0;
    this.rot[i] = o.rot ?? Math.random() * 6.28;
    this.rotV[i] = o.rotV ?? 0;
    this.fadeIn[i] = o.fadeIn ?? 0;
  }

  _kill(i) {
    const last = --this.count;
    if (i === last) return;
    const i3 = i * 3;
    const l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      this.p[i3 + k] = this.p[l3 + k];
      this.v[i3 + k] = this.v[l3 + k];
      this.rgb[i3 + k] = this.rgb[l3 + k];
    }
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.s0[i] = this.s0[last];
    this.s1[i] = this.s1[last];
    this.a0[i] = this.a0[last];
    this.drag[i] = this.drag[last];
    this.grav[i] = this.grav[last];
    this.rot[i] = this.rot[last];
    this.rotV[i] = this.rotV[last];
    this.fadeIn[i] = this.fadeIn[last];
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this._kill(i);
        continue;
      }
      const i3 = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.v[i3] *= d;
      this.v[i3 + 1] = this.v[i3 + 1] * d - this.grav[i] * dt;
      this.v[i3 + 2] *= d;
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      this.rot[i] += this.rotV[i] * dt;
      i++;
    }
    const pos = this.aPos.array;
    const col = this.aCol.array;
    const size = this.aSize.array;
    const rot = this.aRot.array;
    for (let j = 0; j < this.count; j++) {
      const j3 = j * 3;
      const t = 1 - this.life[j] / this.maxLife[j]; // 0 -> 1
      pos[j3] = this.p[j3];
      pos[j3 + 1] = this.p[j3 + 1];
      pos[j3 + 2] = this.p[j3 + 2];
      let a = this.a0[j] * (1 - t * t);
      const fi = this.fadeIn[j];
      if (fi > 0 && t < fi) a *= t / fi;
      col[j * 4] = this.rgb[j3];
      col[j * 4 + 1] = this.rgb[j3 + 1];
      col[j * 4 + 2] = this.rgb[j3 + 2];
      col[j * 4 + 3] = a;
      size[j] = this.s0[j] + (this.s1[j] - this.s0[j]) * t;
      rot[j] = this.rot[j];
    }
    this.geo.instanceCount = this.count;
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aRot.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.geo.instanceCount = 0;
  }
}

// ------------------------------------------------------------------ cube bits
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export class CubeBits {
  constructor(max, geometry, material) {
    this.max = max;
    this.count = 0;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.d = []; // particle objects (small count so objects are fine)
    for (let i = 0; i < max; i++) {
      this.d.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 1, life: 0, max: 1, r: 1, g: 1, b: 1, grav: 18, bounce: 0.35, spin: 1 });
    }
  }

  spawn(x, y, z, vx, vy, vz, size, color, life = 1, o = {}) {
    if (this.count >= this.max) return null;
    const p = this.d[this.count++];
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.rx = Math.random() * 6;
    p.ry = Math.random() * 6;
    p.rz = Math.random() * 6;
    const spin = o.spin ?? 8;
    p.wx = (Math.random() - 0.5) * spin;
    p.wy = (Math.random() - 0.5) * spin;
    p.wz = (Math.random() - 0.5) * spin;
    p.s = size;
    p.life = life;
    p.max = life;
    _c.set(color);
    p.r = _c.r;
    p.g = _c.g;
    p.b = _c.b;
    p.grav = o.grav ?? 18;
    p.bounce = o.bounce ?? 0.35;
    p.flat = !!o.flat;
    return p;
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      const p = this.d[i];
      p.life -= dt;
      if (p.life <= 0) {
        const last = --this.count;
        this.d[i] = this.d[last];
        this.d[last] = p;
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const ground = p.s * 0.5;
      if (p.y < ground) {
        p.y = ground;
        if (p.vy < 0) p.vy = -p.vy * p.bounce;
        p.vx *= 0.7;
        p.vz *= 0.7;
        p.wx *= 0.6;
        p.wy *= 0.6;
        p.wz *= 0.6;
      }
      p.rx += p.wx * dt;
      p.ry += p.wy * dt;
      p.rz += p.wz * dt;
      i++;
    }
    const col = this.mesh.instanceColor.array;
    for (let j = 0; j < this.count; j++) {
      const p = this.d[j];
      const t = p.life / p.max;
      const sc = p.s * Math.min(1, t * 4);
      _e.set(p.rx, p.ry, p.rz);
      _q.setFromEuler(_e);
      _p.set(p.x, p.y, p.z);
      _s.set(sc, p.flat ? sc * 0.2 : sc, sc);
      _m.compose(_p, _q, _s);
      _m.toArray(this.mesh.instanceMatrix.array, j * 16);
      col[j * 3] = p.r;
      col[j * 3 + 1] = p.g;
      col[j * 3 + 2] = p.b;
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.mesh.count = 0;
  }
}

// ------------------------------------------------------------------ streaks
const Z = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Vector3();

export class Streaks {
  constructor(max) {
    this.max = max;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.count = 0;
    this.n = 0; // written this frame
    this.persist = []; // fading segments
  }

  /** Draw a segment this frame only. color components are linear floats. */
  push(ax, ay, az, bx, by, bz, w, r, g, b) {
    if (this.n >= this.max) return;
    _d.set(bx - ax, by - ay, bz - az);
    const len = _d.length();
    if (len < 1e-4) return;
    _d.multiplyScalar(1 / len);
    _q.setFromUnitVectors(Z, _d);
    _p.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
    _s.set(w, w, len);
    _m.compose(_p, _q, _s);
    const i = this.n++;
    _m.toArray(this.mesh.instanceMatrix.array, i * 16);
    const c = this.mesh.instanceColor.array;
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
  }

  /** A segment that lives for `life` seconds, shrinking + fading. */
  add(ax, ay, az, bx, by, bz, w, color, life) {
    _c.set(color);
    this.persist.push({ ax, ay, az, bx, by, bz, w, r: _c.r, g: _c.g, b: _c.b, life, max: life });
  }

  flush(dt) {
    for (let i = this.persist.length - 1; i >= 0; i--) {
      const s = this.persist[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.persist[i] = this.persist[this.persist.length - 1];
        this.persist.pop();
        continue;
      }
      const t = s.life / s.max;
      this.push(s.ax, s.ay, s.az, s.bx, s.by, s.bz, s.w * (0.3 + 0.7 * t), s.r * t, s.g * t, s.b * t);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.n = 0;
  }
}

// ------------------------------------------------------------------ rings
export class RingPool {
  constructor(scene, max = 16) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.82, 1, 48);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      mesh.visible = false;
      mesh.renderOrder = 9;
      scene.add(mesh);
      this.items.push({ mesh, t: 0, dur: 1, r0: 0, r1: 1 });
    }
  }

  spawn(x, y, z, r0, r1, color, dur = 0.5) {
    const it = this.items.find((i) => !i.mesh.visible) || this.items[0];
    it.mesh.visible = true;
    it.mesh.position.set(x, y, z);
    it.mesh.material.color.set(color);
    it.t = 0;
    it.dur = dur;
    it.r0 = r0;
    it.r1 = r1;
  }

  update(dt) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.t += dt;
      const k = it.t / it.dur;
      if (k >= 1) {
        it.mesh.visible = false;
        continue;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const r = it.r0 + (it.r1 - it.r0) * e;
      it.mesh.scale.setScalar(r);
      it.mesh.material.opacity = 1 - k;
    }
  }
}
