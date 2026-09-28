/**
 * Global fog upgrade for every built-in three.js material (OWNER: render).
 *
 * `scene.fog` stays a THREE.FogExp2 (so SkyAPI.fog keeps its type), but the fog chunk is
 * replaced by exponential HEIGHT fog integrated along the view ray plus a sun in-scatter lobe
 * (aerial perspective). The extra uniforms are plain objects shared by reference across all
 * materials, so updating `fogShared` once per frame updates every material.
 *
 * Custom ShaderMaterials from other authors that include the fog chunks still compile: they
 * simply miss the extra uniforms (fogParams.w == 0) and fall back to three's classic FogExp2.
 */
import * as THREE from 'three';
import { FOG_FUNC_GLSL } from './glsl';

export const fogShared = {
  fogSunDir: { value: { x: 0, y: 1, z: 0 } },
  fogSunColor: { value: { x: 0, y: 0, z: 0 } },
  /** x: height falloff (1/m), y: camera height, z: unused, w: enabled flag. */
  fogParams: { value: { x: 0.001, y: 2, z: 0, w: 1 } },
};

let patched = false;

export function patchFogChunks(): void {
  if (patched) return;
  patched = true;
  const SC = THREE.ShaderChunk as unknown as Record<string, string>;
  SC.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogRay;
#endif
`;
  SC.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogRay = mvPosition.xyz * mat3( viewMatrix );
#endif
`;
  SC.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogRay;
  uniform vec3 fogSunDir;
  uniform vec3 fogSunColor;
  uniform vec4 fogParams;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  ${FOG_FUNC_GLSL}
#endif
`;
  SC.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    if ( fogParams.w > 0.5 ) {
      float fogOD = heightFogDepth( fogDensity, fogParams.x, fogParams.y, vFogRay );
      float fogFactor = 1.0 - exp( - fogOD );
      vec3 fogDirN = normalize( vFogRay );
      float fogMu = max( dot( fogDirN, fogSunDir ), 0.0 );
      vec3 fogCol = fogColor + fogSunColor * ( 0.35 * pow( fogMu, 6.0 ) + 0.65 * pow( fogMu, 48.0 ) );
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
    } else {
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    }
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif
#endif
`;
  // Inject the shared uniforms into the fog uniform library and every built-in shader
  // that already merged it (ShaderLib entries are built at module load time).
  const lib = THREE.UniformsLib as unknown as Record<string, Record<string, THREE.IUniform>>;
  Object.assign(lib.fog, fogShared);
  const shaderLib = THREE.ShaderLib as unknown as Record<string, { uniforms: Record<string, THREE.IUniform> }>;
  for (const key of Object.keys(shaderLib)) {
    const u = shaderLib[key].uniforms;
    if (u && 'fogColor' in u) Object.assign(u, fogShared);
  }
}
