/**
 * GPU texture baking: run a fragment shader over a render target once (or on demand).
 * Used for procedural noise / foam / cloud textures and per-frame wave cascades.
 */
import * as THREE from 'three';
import { FULLSCREEN_VERT } from './glsl';

const tri = new THREE.BufferGeometry();
tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export interface BakeOptions {
  width: number;
  height: number;
  type?: THREE.TextureDataType;
  format?: THREE.PixelFormat;
  mipmaps?: boolean;
  wrap?: THREE.Wrapping;
  uniforms?: Record<string, THREE.IUniform>;
  defines?: Record<string, string | number | boolean>;
  anisotropy?: number;
  linear?: boolean;
}

export class ShaderBaker {
  readonly target: THREE.WebGLRenderTarget;
  readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly scene = new THREE.Scene();

  constructor(fragmentShader: string, o: BakeOptions) {
    const mip = o.mipmaps ?? false;
    this.target = new THREE.WebGLRenderTarget(o.width, o.height, {
      type: o.type ?? THREE.UnsignedByteType,
      format: o.format ?? THREE.RGBAFormat,
      generateMipmaps: mip,
      minFilter: o.linear === false ? THREE.NearestFilter : mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: o.linear === false ? THREE.NearestFilter : THREE.LinearFilter,
      wrapS: o.wrap ?? THREE.RepeatWrapping,
      wrapT: o.wrap ?? THREE.RepeatWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      anisotropy: o.anisotropy ?? 1,
    });
    this.target.texture.colorSpace = THREE.NoColorSpace;
    this.material = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader,
      uniforms: o.uniforms ?? {},
      defines: o.defines ?? {},
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(tri, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  get texture(): THREE.Texture {
    return this.target.texture;
  }

  render(renderer: THREE.WebGLRenderer): void {
    const prevTarget = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    const prevAutoClear = renderer.autoClear;
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, orthoCam);
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    renderer.xr.enabled = prevXr;
    renderer.shadowMap.autoUpdate = prevShadow;
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}

/** Render a full-screen shader into an arbitrary target (post-processing helper). */
export class FullscreenPass {
  readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly scene = new THREE.Scene();

  constructor(material: THREE.ShaderMaterial) {
    this.material = material;
    this.mesh = new THREE.Mesh(tri, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null): void {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, orthoCam);
  }
}

export { FULLSCREEN_VERT };
