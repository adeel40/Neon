// Per-run gameplay state and the accumulated upgrade modifiers.
import { CONFIG, xpToNext } from './config.js';

// Mutable modifiers applied on top of base values. Passives mutate these.
export class PlayerStats {
  constructor() { this.reset(); }

  reset() {
    this.damageMult = 1;
    this.moveSpeedMult = 1;
    this.magnetMult = 1;
    this.cooldownMult = 1; // multiplies weapon cooldown; lower = faster
    this.armorFlat = 0;    // flat damage reduction per hit
    this.luck = 0;         // shifts rarity odds upward
    this.stacks = {};      // upgradeId -> times taken
  }

  get moveSpeed() { return CONFIG.player.moveSpeed * this.moveSpeedMult; }
  get magnetRadius() { return CONFIG.player.magnetRadius * this.magnetMult; }

  apply(stat, amount, id) {
    switch (stat) {
      case 'damageMult':    this.damageMult += amount; break;
      case 'moveSpeedMult': this.moveSpeedMult += amount; break;
      case 'magnetMult':    this.magnetMult += amount; break;
      // Cooldown reduction: multiply so it never reaches zero. amount ~0.10.
      case 'cooldownMult':  this.cooldownMult *= (1 - amount); break;
      case 'armorFlat':     this.armorFlat += amount; break;
      case 'luck':          this.luck += amount; break;
      default: break; // unknown stat: ignore (data-driven safety)
    }
    this.stacks[id] = (this.stacks[id] || 0) + 1;
  }

  stacksOf(id) { return this.stacks[id] || 0; }
}

// Live per-run state: timer, xp/level, hp, kills, combo.
export class RunState {
  constructor() { this.reset(CONFIG.player.maxHp); }

  reset(maxHp) {
    this.elapsed = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpToNext(1);
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.gameOver = false;
    this.victory = false;
    // Combo / kill-streak
    this.combo = 0;
    this.comboTimer = 0;
  }

  get difficultyTier() { return Math.floor(this.elapsed / CONFIG.spawn.tierSeconds); }
  get xpProgress() { return this.xpToNext ? Math.min(1, this.xp / this.xpToNext) : 0; }
  get hpProgress() { return this.maxHp ? Math.max(0, this.hp / this.maxHp) : 0; }

  // Adds XP; returns number of level-ups triggered (can be >1 on overflow).
  addXp(amount) {
    this.xp += amount;
    let ups = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      ups += 1;
      this.xpToNext = xpToNext(this.level);
    }
    return ups;
  }

  registerKill() {
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 2.5; // seconds to keep the streak alive
  }

  tickCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  get formattedTime() {
    const t = Math.floor(this.elapsed);
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
}
