// Rough balance simulation: an "always buy the cheapest useful thing" player.
// Run: npm run sim   (prints milestones for ~3 hours of play)

import * as E from '../src/core/economy.js';
import { ENEMIES, ENEMY_IDS, enemyWeight } from '../src/data/enemies.js';
import { zoneIndexForWave } from '../src/data/zones.js';
import { RARITIES } from '../src/data/rarities.js';
import { mulberry32 } from '../src/util/math.js';

const seed = Number(process.argv[2] || 7);
const rng = mulberry32(seed);
const HOURS = Number(process.argv[3] || 3);

const s = {
  coins: 0, wave: 1, bestWave: 1, opens: 0, pity: 0, freeCrates: 1,
  up: { firepower: 0, firerate: 0, coins: 0, slots: 0, barricade: 0, crate: 0, vault: 0 },
  guns: [{ t: 'pistol', l: 1, g: 0 }], income: 0,
};

function avgEnemy(w) {
  let tw = 0, hp = 0, rew = 0, dmg = 0;
  for (const id of ENEMY_IDS) {
    const e = ENEMIES[id];
    const we = enemyWeight(id, w, zoneIndexForWave(w));
    if (!we) continue;
    const st = E.zombieStats(id, w);
    tw += we; hp += st.hp * we; rew += st.reward * we; dmg += st.dmg * we;
  }
  return { hp: hp / tw, reward: rew / tw, dmg: dmg / tw };
}

const rarityCount = RARITIES.map(() => 0);
function openCrate() {
  const g = E.rollCrate(s, { rng });
  rarityCount[g.rarity]++;
  s.pity = g.rarity >= 3 ? 0 : s.pity + 1;
  s.opens++;
  const d = E.decidePlacement(s, g);
  if (d.kind === 'place' || d.kind === 'replace') s.guns[d.slot] = { t: g.t, l: 1, g: g.g };
  else if (d.kind === 'levelup') { const o = s.guns[d.slot]; o.l++; o.g = o.g || g.g; }
  else s.coins += E.scrapValue(s, g.rarity);
}

const EFF = 0.72; // overkill, travel time, range
let t = 0, dt = 0.5, kills = 0, attackers = 0, barricade = E.barricadeMaxHp(s);
let bossHp = 0, bossTimer = 0, breaches = 0, lastBreach = -999;
const milestones = [2, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80];
const printed = new Set();
const log = (...a) => console.log(...a);

let nextOpen = 0;
const OPEN_TIME = Number(process.argv[4] || 3.5); // seconds per crate incl. walking + reveal
function buyStep() {
  for (let guard = 0; guard < 50; guard++) {
    const canOpen = t >= nextOpen;
    if (s.freeCrates > 0 && canOpen) { s.freeCrates--; openCrate(); nextOpen = t + OPEN_TIME; continue; }
    const opts = [];
    const crate = E.crateCost(s);
    if (canOpen) opts.push({ k: 'open', c: crate * 0.7 });
    for (const id of ['firepower', 'firerate', 'coins', 'slots', 'crate', 'barricade', 'vault']) {
      if (E.isMaxed(s, id)) continue;
      let c = E.upgradeCost(id, E.upgradeLevel(s, id));
      let w = 1;
      if (id === 'vault') w = 3;
      if (id === 'barricade') w = t - lastBreach < 120 ? 0.6 : 2.5;
      if (id === 'slots' && s.guns.filter(Boolean).length < E.slotCount(s)) w = 4;
      opts.push({ k: id, c: c * w, real: c });
    }
    opts.sort((a, b) => a.c - b.c);
    const best = opts[0];
    const price = best.k === 'open' ? crate : best.real;
    if (s.coins < price) return;
    s.coins -= price;
    if (best.k === 'open') { openCrate(); nextOpen = t + OPEN_TIME; }
    else s.up[best.k] = (s.up[best.k] || 0) + 1;
  }
}

while (t < HOURS * 3600) {
  const w = s.wave;
  const en = avgEnemy(w);
  const dps = E.totalDps(s) * EFF;
  const spawn = E.spawnPerSec(w);
  let earned = 0;
  if (E.isBossWave(w)) {
    if (bossHp <= 0) { bossHp = ENEMIES.boss_zombie.hp * E.ZOMBIE_BASE_HP * E.hpMult(w); bossTimer = 60; }
    // half the fire goes to the boss, the rest to the stream of normal zombies
    bossHp -= dps * 0.5 * dt;
    const k = Math.min(spawn * 0.5, (dps * 0.5) / en.hp);
    earned += k * dt * en.reward;
    bossTimer -= dt;
    if (bossHp <= 0) {
      earned += E.zombieStats('boss_zombie', w).reward;
      s.freeCrates++;
      s.wave++; kills = 0;
    } else if (bossTimer < -barricade / (E.zombieStats('boss_zombie', w).dmg)) {
      s.wave = Math.max(1, w - 1); breaches++; lastBreach = t; bossHp = 0; kills = 0;
      barricade = E.barricadeMaxHp(s);
    }
  } else {
    const k = Math.min(spawn, dps / en.hp);
    const leak = spawn - k;
    kills += k * dt;
    earned += k * dt * en.reward;
    if (leak > 0.02) attackers += leak * dt;
    else attackers = Math.max(0, attackers - (dps / en.hp - spawn) * dt);
    if (attackers > 0.5) barricade -= attackers * en.dmg * dt;
    else barricade = Math.min(E.barricadeMaxHp(s), barricade + E.barricadeMaxHp(s) * E.barricadeRegen(s) * dt);
    if (barricade <= 0) {
      s.wave = Math.max(1, w - 1); breaches++; lastBreach = t; attackers = 0; kills = 0;
      barricade = E.barricadeMaxHp(s);
    } else if (kills >= E.killsNeeded(w)) {
      kills = 0; s.wave++;
      earned += E.waveClearBonus(w);
    }
  }
  earned *= E.coinMultOf(s);
  s.coins += earned;
  s.income = s.income * 0.99 + (earned / dt) * 0.01;
  s.bestWave = Math.max(s.bestWave, s.wave);
  buyStep();
  t += dt;

  for (const m of milestones) {
    if (s.bestWave >= m && !printed.has(m)) {
      printed.add(m);
      const guns = s.guns.filter(Boolean);
      const rar = guns.map((g) => RARITIES[E.gunPower({ t: g.t, l: 1, g: 0 }) && 0] && g.t);
      log(`wave ${String(m).padStart(3)} @ ${(t / 60).toFixed(1).padStart(6)} min | dps ${E.totalDps(s).toExponential(2)} | coins/s ${s.income.toExponential(2)} | opens ${s.opens} | slots ${E.slotCount(s)} | crateLv ${E.crateLevel(s)} | fp ${s.up.firepower} fr ${s.up.firerate} cb ${s.up.coins} bar ${s.up.barricade} vault ${s.up.vault} | breaches ${breaches}`);
    }
  }
  if (Math.abs((t / 60) % 30) < dt / 60) {
    const top = s.guns.filter(Boolean).map((g) => `${g.t}${g.g ? '*' : ''}:${g.l}`).join(' ');
    log(`  -- ${Math.round(t / 60)} min: wave ${s.wave} (best ${s.bestWave}) crate$ ${E.crateCost(s).toExponential(2)} guns: ${top}`);
  }
}
log('rarities opened:', RARITIES.map((r, i) => `${r.id}:${rarityCount[i]}`).join(' '));
log('odds lv1', E.rarityOdds(1).map((x) => (x * 100).toFixed(2)).join(' '));
log('odds lv10', E.rarityOdds(10).map((x) => (x * 100).toFixed(2)).join(' '));
log('odds lv20', E.rarityOdds(20).map((x) => (x * 100).toFixed(2)).join(' '));
log('odds lv30', E.rarityOdds(30).map((x) => (x * 100).toFixed(2)).join(' '));
