/**
 * Character rig: named joints (THREE.Bone objects, which are plain Object3D nodes) driven by
 * procedural poses. The mesh is rigidly bound (each vertex follows exactly one joint), so this
 * behaves like a "named part-group" rig while rendering the whole character in ONE draw call.
 *
 * Joint names (all findable with getObjectByName):
 *   root, hips, spine, neck, head, lidL, lidR, clavL, clavR, upperArmL, upperArmR, forearmL,
 *   forearmR, wristL, wristR, fingersL, fingersL2, thumbL, fingersR, fingersR2, thumbR,
 *   thighL, thighR, shinL, shinR, footL, footR
 * Sockets (plain Object3D): handR (HAND_R_NAME), handL, headTop.
 * Rest pose: standing straight, arms hanging straight down, palms facing the thighs, all joint
 * rotations zero. Facing +Z, feet at y = 0.
 */
import * as THREE from 'three';

export const BONES = [
  'root',
  'hips',
  'spine',
  'neck',
  'head',
  'lidL',
  'lidR',
  'clavL',
  'clavR',
  'upperArmL',
  'upperArmR',
  'forearmL',
  'forearmR',
  'wristL',
  'wristR',
  'fingersL',
  'fingersL2',
  'thumbL',
  'fingersR',
  'fingersR2',
  'thumbR',
  'thighL',
  'thighR',
  'shinL',
  'shinR',
  'footL',
  'footR',
] as const;
export type BoneName = (typeof BONES)[number];
export const BI: Record<BoneName, number> = Object.fromEntries(BONES.map((b, i) => [b, i])) as Record<BoneName, number>;

const PARENT: Record<BoneName, BoneName | null> = {
  root: null,
  hips: 'root',
  spine: 'hips',
  neck: 'spine',
  head: 'neck',
  lidL: 'head',
  lidR: 'head',
  clavL: 'spine',
  clavR: 'spine',
  upperArmL: 'clavL',
  upperArmR: 'clavR',
  forearmL: 'upperArmL',
  forearmR: 'upperArmR',
  wristL: 'forearmL',
  wristR: 'forearmR',
  fingersL: 'wristL',
  fingersL2: 'fingersL',
  thumbL: 'wristL',
  fingersR: 'wristR',
  fingersR2: 'fingersR',
  thumbR: 'wristR',
  thighL: 'hips',
  thighR: 'hips',
  shinL: 'thighL',
  shinR: 'thighR',
  footL: 'shinL',
  footR: 'shinR',
};

/** Body measurements in metres (model space, rest pose). */
export interface Proportions {
  height: number;
  fem: boolean;
  /** 0 slim .. 1 stocky */
  mass: number;
  age: 'young' | 'adult' | 'old';
  headH: number; // chin → crown
  headW: number; // half width
  headD: number; // half depth
  hipY: number; // hips joint (pelvis pivot)
  waistY: number; // spine pivot
  neckY: number; // neck base
  headY: number; // head pivot (top of neck)
  shoulderX: number;
  shoulderY: number;
  upperArm: number;
  forearm: number;
  hand: number; // wrist → knuckles
  finger: number;
  hipX: number; // leg joint half separation
  legTopY: number; // hip joint height
  thigh: number;
  shin: number;
  ankleY: number;
  footLen: number;
  // girths (half-widths)
  chestW: number;
  chestD: number;
  waistW: number;
  waistD: number;
  hipW: number;
  hipD: number;
  belly: number;
  bust: number;
  armR: number;
  legR: number;
  neckR: number;
  hunch: number;
}

export function makeProportions(o: { fem: boolean; body: 'slim' | 'average' | 'stocky'; age: 'young' | 'adult' | 'old'; heightMul?: number }): Proportions {
  const mass = o.body === 'slim' ? 0 : o.body === 'average' ? 0.5 : 1;
  let height = o.fem ? 1.69 : 1.77;
  if (o.body === 'stocky') height -= 0.03;
  if (o.age === 'young') height -= 0.04;
  if (o.age === 'old') height -= 0.04;
  height *= o.heightMul ?? 1;
  const k = height / 1.75;
  const headH = (o.fem ? 0.232 : 0.24) * (o.age === 'young' ? 1.0 : 1) * Math.pow(k, 0.5);
  const legTopY = 0.925 * k;
  const ankleY = 0.085 * k;
  const thigh = (legTopY - ankleY) * 0.5;
  const shin = legTopY - ankleY - thigh;
  const neckY = height - headH - 0.075 * k;
  const p: Proportions = {
    height,
    fem: o.fem,
    mass,
    age: o.age,
    headH,
    headW: (o.fem ? 0.074 : 0.078) * (1 + mass * 0.05),
    headD: o.fem ? 0.096 : 0.1,
    hipY: 0.97 * k,
    waistY: 1.04 * k,
    neckY,
    headY: height - headH - 0.002 * k,
    shoulderX: (o.fem ? 0.172 : 0.195) * (1 + mass * 0.1) * k,
    shoulderY: neckY - 0.045 * k,
    upperArm: 0.29 * k,
    forearm: 0.25 * k,
    hand: 0.092 * k * (o.fem ? 0.93 : 1),
    finger: 0.085 * k * (o.fem ? 0.93 : 1),
    hipX: (o.fem ? 0.092 : 0.09) * (1 + mass * 0.12) * k,
    legTopY,
    thigh,
    shin,
    ankleY,
    footLen: (o.fem ? 0.235 : 0.26) * k,
    chestW: (o.fem ? 0.15 : 0.172) * (1 + mass * 0.16) * k,
    chestD: (o.fem ? 0.1 : 0.108) * (1 + mass * 0.2) * k,
    waistW: (o.fem ? 0.125 : 0.148) * (1 + mass * 0.3) * k,
    waistD: (o.fem ? 0.088 : 0.1) * (1 + mass * 0.42) * k,
    hipW: (o.fem ? 0.172 : 0.16) * (1 + mass * 0.16) * k,
    hipD: (o.fem ? 0.11 : 0.1) * (1 + mass * 0.2) * k,
    belly: mass * (o.age === 'young' ? 0.01 : 0.035) * k,
    bust: o.fem ? 0.022 + mass * 0.012 : 0,
    armR: (o.fem ? 0.04 : 0.046) * (1 + mass * 0.18) * k,
    legR: (o.fem ? 0.068 : 0.07) * (1 + mass * 0.16) * k,
    neckR: (o.fem ? 0.046 : 0.056) * (1 + mass * 0.12) * k,
    hunch: o.age === 'old' ? 1 : 0,
  };
  return p;
}

export interface Rig {
  root: THREE.Object3D;
  bones: THREE.Bone[];
  byName: Record<BoneName, THREE.Bone>;
  /** rest local positions */
  rest: THREE.Vector3[];
  /** model-space rest positions */
  world: THREE.Vector3[];
  handR: THREE.Object3D;
  handL: THREE.Object3D;
  headTop: THREE.Object3D;
  props: Proportions;
  /** eye centres (model space) — lids pivot here */
  eyeL: THREE.Vector3;
  eyeR: THREE.Vector3;
}

/** Joint positions in model space for the given proportions. */
export function jointPositions(p: Proportions, eyeL: THREE.Vector3, eyeR: THREE.Vector3): Record<BoneName, THREE.Vector3> {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const shoulderZ = -0.015 - p.hunch * 0.02;
  const elbowY = p.shoulderY - p.upperArm;
  const wristY = elbowY - p.forearm;
  const knuckleY = wristY - p.hand;
  const kneeY = p.legTopY - p.thigh;
  const j: Record<BoneName, THREE.Vector3> = {
    root: V(0, 0, 0),
    hips: V(0, p.hipY, 0),
    spine: V(0, p.waistY, -0.005),
    neck: V(0, p.neckY, -0.02 - p.hunch * 0.03),
    head: V(0, p.headY, -0.005 - p.hunch * 0.035),
    lidL: eyeL.clone(),
    lidR: eyeR.clone(),
    clavL: V(0.03, p.shoulderY + 0.01, shoulderZ),
    clavR: V(-0.03, p.shoulderY + 0.01, shoulderZ),
    upperArmL: V(p.shoulderX, p.shoulderY, shoulderZ),
    upperArmR: V(-p.shoulderX, p.shoulderY, shoulderZ),
    forearmL: V(p.shoulderX, elbowY, shoulderZ - 0.005),
    forearmR: V(-p.shoulderX, elbowY, shoulderZ - 0.005),
    wristL: V(p.shoulderX, wristY, shoulderZ),
    wristR: V(-p.shoulderX, wristY, shoulderZ),
    fingersL: V(p.shoulderX - 0.004, knuckleY, shoulderZ),
    fingersL2: V(p.shoulderX - 0.004, knuckleY - p.finger * 0.5, shoulderZ),
    thumbL: V(p.shoulderX - 0.012, wristY - 0.022, shoulderZ + 0.03),
    fingersR: V(-p.shoulderX + 0.004, knuckleY, shoulderZ),
    fingersR2: V(-p.shoulderX + 0.004, knuckleY - p.finger * 0.5, shoulderZ),
    thumbR: V(-p.shoulderX + 0.012, wristY - 0.022, shoulderZ + 0.03),
    thighL: V(p.hipX, p.legTopY, 0),
    thighR: V(-p.hipX, p.legTopY, 0),
    shinL: V(p.hipX, kneeY, 0.004),
    shinR: V(-p.hipX, kneeY, 0.004),
    footL: V(p.hipX, p.ankleY, -0.012),
    footR: V(-p.hipX, p.ankleY, -0.012),
  };
  return j;
}

export function createRig(p: Proportions, joints: Record<BoneName, THREE.Vector3>, eyeL: THREE.Vector3, eyeR: THREE.Vector3): Rig {
  const bones: THREE.Bone[] = [];
  const byName = {} as Record<BoneName, THREE.Bone>;
  const rest: THREE.Vector3[] = [];
  const world: THREE.Vector3[] = [];
  for (const name of BONES) {
    const b = new THREE.Bone();
    b.name = name;
    bones.push(b);
    byName[name] = b;
  }
  for (const name of BONES) {
    const b = byName[name];
    const par = PARENT[name];
    const w = joints[name];
    world.push(w.clone());
    if (par) {
      byName[par].add(b);
      b.position.copy(w).sub(joints[par]);
    } else {
      b.position.copy(w);
    }
    rest.push(b.position.clone());
  }
  // sockets
  const handR = new THREE.Object3D();
  handR.name = 'handR';
  // palm centre of the right fist; socket +Y runs along the grip (out of the thumb side = forward in rest)
  handR.position.set(0.012, -0.058, 0.004);
  handR.rotation.x = Math.PI / 2;
  byName.wristR.add(handR);
  const handL = new THREE.Object3D();
  handL.name = 'handL';
  handL.position.set(-0.012, -0.058, 0.004);
  handL.rotation.x = Math.PI / 2;
  byName.wristL.add(handL);
  const headTop = new THREE.Object3D();
  headTop.name = 'headTop';
  headTop.position.set(0, p.headH + 0.02, 0);
  byName.head.add(headTop);
  const root = byName.root;
  return { root, bones, byName, rest, world, handR, handL, headTop, props: p, eyeL, eyeR };
}
