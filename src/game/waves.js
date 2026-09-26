// Endless stream of zombies: waves, bosses, breaches and zone changes.

import * as E from '../core/economy.js';
import { zoneIndexForWave, zoneName } from '../data/zones.js';
import { rand } from '../util/math.js';
import * as L from './layout.js';

export class Waves {
  constructor(game) {
    this.game = game;
    this.spawnT = 1.2;
    this.bossSpawned = false;
    this.bossTimer = 0;
  }

  /** (Re)start the current wave without touching the kill counter. */
  reset() {
    const w = this.game.state.wave;
    this.spawnT = 1.0;
    this.bossSpawned = false;
    this.bossTimer = E.isBossWave(w) ? 2.8 : 0;
    if (E.isBossWave(w)) this.game.ui.banner('BOSS WAVE', `Wave ${w}`, 'boss');
  }

  update(dt) {
    const game = this.game;
    const s = game.state;
    const w = s.wave;
    const boss = E.isBossWave(w);
    if (boss && !this.bossSpawned) {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) this.spawnBoss();
    }
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const zs = game.zombies;
    if (zs.aliveCount >= game.maxZombies) {
      this.spawnT = 0.3;
      return;
    }
    let n = 1;
    const r = Math.random();
    if (w >= 4 && r < 0.25) n = 2;
    if (w >= 8 && r < 0.08) n = 3 + Math.floor(Math.random() * 3);
    const baseX = rand(-L.LANE_HALF, L.LANE_HALF);
    for (let i = 0; i < n; i++) {
      const type = E.pickEnemyType(w);
      const x = n > 1 ? Math.max(-L.LANE_HALF, Math.min(L.LANE_HALF, baseX + rand(-1.6, 1.6))) : undefined;
      zs.spawn(type, w, { x, z: L.SPAWN_Z + rand(-1, 1) - i * 0.9 });
    }
    const rate = E.spawnPerSec(w) * (boss ? 0.55 : 1);
    this.spawnT += (n / rate) * rand(0.75, 1.25);
  }

  spawnBoss() {
    const game = this.game;
    this.bossSpawned = true;
    const z = game.zombies.spawn('boss', game.state.wave, { x: 0 });
    if (z) {
      game.ui.banner('BOSS INCOMING!', z.name, 'boss');
      game.audio.play('boss');
      game.shake(0.5);
      game.fx.rings.spawn(0, 0.2, L.SPAWN_Z, 1, 14, 0xff3358, 1.2);
    }
  }

  onKill(z) {
    const s = this.game.state;
    if (z.isBoss) {
      this.complete(true);
      return;
    }
    if (E.isBossWave(s.wave)) return;
    s.waveKills++;
    if (s.waveKills >= E.killsNeeded(s.wave)) this.complete(false);
  }

  complete(bossKill) {
    const game = this.game;
    const s = game.state;
    const bonus = Math.ceil(E.waveClearBonus(s.wave) * E.coinMultOf(s) * game.coinBoost() * (bossKill ? 4 : 1));
    game.addCoins(bonus, 'wave');
    const oldZone = zoneIndexForWave(s.wave);
    s.wave++;
    s.waveKills = 0;
    if (s.wave > s.bestWave) s.bestWave = s.wave;
    game.ui.toast(`WAVE ${s.wave - 1} CLEARED`, `+$${game.fmt(bonus)}`);
    game.audio.play('wave');
    const newZone = zoneIndexForWave(s.wave);
    if (newZone !== oldZone) game.changeZone(newZone, true);
    this.bossSpawned = false;
    this.bossTimer = E.isBossWave(s.wave) ? 3.2 : 0;
    if (E.isBossWave(s.wave)) setTimeout(() => game.ui.banner('BOSS WAVE', `Wave ${s.wave}`, 'boss'), 900);
    game.save();
  }

  breach() {
    const game = this.game;
    const s = game.state;
    s.stats.breaches++;
    game.zombies.clear(true);
    game.projectiles.clear();
    game.shake(0.9);
    game.flash(0.5, '#ff2e55');
    game.audio.play('breach');
    game.fx.rings.spawn(0, 0.3, L.BARRICADE_Z, 1, 30, 0xff3358, 0.9);
    game.fx.explosion(0, 0.5, L.BARRICADE_Z - 2, 5, 0xff5a3a);
    const oldZone = zoneIndexForWave(s.wave);
    s.wave = Math.max(1, s.wave - 1);
    s.waveKills = 0;
    game.barricadeHp = game.barricadeMax;
    game.ui.banner('BREACH!', `Fall back to wave ${s.wave} · upgrade your army!`, 'bad');
    const newZone = zoneIndexForWave(s.wave);
    if (newZone !== oldZone) game.changeZone(newZone, false);
    this.reset();
    this.spawnT = 2.5;
    game.save();
    void zoneName;
  }
}
