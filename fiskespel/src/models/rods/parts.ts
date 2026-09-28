/** Shared ornaments for gear models. */
import * as THREE from 'three';
import type { Geo } from './kit/geo';
import { M } from './kit/mat';

const TAU = Math.PI * 2;

export function addSkull(c: { add(g: Geo, m: THREE.Material): void }, x: number, y: number, z: number, s: number, bone: THREE.Material): void {
  const cran = new THREE.SphereGeometry(s * 0.5, 12, 10);
  cran.scale(1, 1.05, 1.1);
  cran.translate(x, y + s * 0.62, z);
  c.add(cran, bone);
  const jaw = new THREE.SphereGeometry(s * 0.34, 10, 6, 0, TAU, Math.PI * 0.35, Math.PI * 0.65);
  jaw.scale(1, 0.9, 1.1);
  jaw.translate(x, y + s * 0.34, z + s * 0.08);
  c.add(jaw, bone);
  const dark = M({ c: '#140c08', r: 0.9 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(s * 0.14, 8, 6);
    eye.scale(1, 0.9, 0.5);
    eye.translate(x + sx * s * 0.18, y + s * 0.6, z + s * 0.5);
    c.add(eye, dark);
  }
  const nose = new THREE.ConeGeometry(s * 0.06, s * 0.12, 3);
  nose.rotateX(Math.PI);
  nose.translate(x, y + s * 0.42, z + s * 0.52);
  c.add(nose, dark);
}

