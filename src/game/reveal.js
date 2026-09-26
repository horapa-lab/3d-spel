// Full-screen "you got a gun" moment rendered as an overlay scene on top of
// the running game: dimmed world, spinning rarity rays, the gun rotating.

import * as THREE from 'three';
import { createGunModel } from '../gfx/gunModels.js';
import { RARITIES } from '../data/rarities.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { easeOutBack, clamp } from '../util/math.js';

export class Reveal {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.t = 0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0.2, 9);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a80, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 5, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(-4, 2, -5);
    this.scene.add(rim);
    this.rimLight = rim;

    // dim the world
    this.dim = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 }, uCol: { value: new THREE.Color(0x14091f) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `uniform float uA; uniform vec3 uCol; varying vec2 vUv;
          void main(){ float v = length(vUv - 0.5) * 1.3; gl_FragColor = vec4(uCol, uA * (0.72 + v * 0.35)); }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.dim.frustumCulled = false;
    this.dim.renderOrder = -2;
    this.scene.add(this.dim);

    // rotating rays
    this.raysMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color(1, 1, 1) }, uRainbow: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uT; uniform float uA; uniform vec3 uCol; uniform float uRainbow; varying vec2 vUv;
        vec3 hsv(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          float rays = smoothstep(0.35, 0.95, sin(a * 9.0 + uT * 0.9) * 0.5 + 0.5);
          float rays2 = smoothstep(0.5, 1.0, sin(a * 5.0 - uT * 0.6) * 0.5 + 0.5);
          float fall = smoothstep(1.0, 0.05, r);
          float core = smoothstep(0.45, 0.0, r);
          vec3 col = mix(uCol, hsv(fract(a / 6.2831 + uT * 0.1)), uRainbow);
          float v = (rays * 0.55 + rays2 * 0.3) * fall + core * 0.9;
          gl_FragColor = vec4(col * v + vec3(1.0) * core * 0.35, uA * clamp(v, 0.0, 1.0));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), this.raysMat);
    this.rays.position.z = -2;
    this.rays.renderOrder = -1;
    this.scene.add(this.rays);

    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.spinT = 0;
  }

  show(result) {
    const game = this.game;
    this.result = result;
    this.active = true;
    this.t = 0;
    this.closing = false;
    this.holder.clear();
    const w = WEAPON_BY_ID[result.t];
    const m = createGunModel(result.t, !!result.g);
    const box = m.box;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const inner = new THREE.Group();
    m.obj.position.sub(center);
    inner.add(m.obj);
    inner.rotation.y = Math.PI / 2; // show the side profile, muzzle pointing right
    // fit by length and height so pistols don't fill the screen
    this.baseScale = Math.min(3.3 / Math.max(size.z, 0.8), 1.55 / Math.max(size.y, 0.3));
    this.holder.add(inner);
    this.model = m;
    const rc = RARITIES[result.rarity];
    this.raysMat.uniforms.uCol.value.set(result.g ? 0xffd23f : rc.hex);
    this.raysMat.uniforms.uRainbow.value = rc.rainbow ? 1 : 0;
    this.rimLight.color.set(rc.hex);
    this.resize(game.width, game.height);
    game.ui.showReveal(result, w);
    // routine results get a short look, rarer guns a longer celebration
    this.quick = !!result.quick;
    this.autoT = this.quick ? 1.3 : [2.4, 2.8, 3.4, 4.2, 5.2, 6.2, 7.0][result.rarity];
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // keep the gun inside the screen on narrow (portrait) displays
    const visibleW = 2 * Math.tan((30 * Math.PI) / 360) * 9 * aspect;
    this.fit = clamp(visibleW / 4.8, 0.45, 1);
  }

  dismiss() {
    if (!this.active || this.closing || this.t < (this.quick ? 0.25 : 0.45)) return false;
    this.closing = true;
    this.closeT = 0;
    this.game.ui.hideReveal();
    this.game.onRevealClosed(this.result);
    return true;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    this.raysMat.uniforms.uT.value += dt;
    const inK = Math.min(1, this.t / 0.5);
    let alpha = inK;
    let scale = easeOutBack(inK, 2.2);
    if (this.closing) {
      this.closeT += dt;
      const k = Math.min(1, this.closeT / 0.3);
      alpha = 1 - k;
      scale *= 1 - k * 0.7;
      this.holder.position.y = k * 1.5;
      if (k >= 1) {
        this.active = false;
        this.holder.clear();
        return;
      }
    } else {
      this.holder.position.y = 0.1 + Math.sin(this.t * 2) * 0.08;
      if (this.t > this.autoT && this.game.settings.autoContinue !== false) this.dismiss();
    }
    this.dim.material.uniforms.uA.value = alpha * (this.quick ? 0.45 : 0.88);
    this.raysMat.uniforms.uA.value = alpha * (this.quick ? 0.6 : 1);
    this.holder.scale.setScalar(Math.max(0.001, scale * this.baseScale * this.fit * (this.quick ? 0.75 : 1)));
    this.holder.rotation.y = Math.sin(this.t * 1.3) * 0.55;
    this.holder.rotation.x = Math.sin(this.t * 0.9) * 0.12;
    if (this.model && this.model.spinner) this.model.spinner.rotation.z += dt * 12;
  }

  render(renderer) {
    if (!this.active) return;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
