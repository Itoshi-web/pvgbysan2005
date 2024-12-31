export class PowerUpManager {
  constructor() {
    this.powerUps = new Map();
    this.cooldowns = new Map();
  }

  getRandomPowerUp() {
    const types = ['freeze', 'shield', 'noRoll', 'doubleShot'];
    return types[Math.floor(Math.random() * types.length)];
  }

  givePowerUp(playerId) {
    if (this.cooldowns.get(playerId) > 0) {
      return null;
    }

    const powerUp = this.getRandomPowerUp();
    this.powerUps.set(playerId, powerUp);
    this.cooldowns.set(playerId, 0);
    return powerUp;
  }

  usePowerUp(playerId) {
    const powerUp = this.powerUps.get(playerId);
    if (powerUp) {
      this.powerUps.delete(playerId);
      this.cooldowns.set(playerId, 2); // Set 2-turn cooldown
      return powerUp;
    }
    return null;
  }

  decrementCooldowns() {
    for (const [playerId, cooldown] of this.cooldowns.entries()) {
      if (cooldown > 0) {
        this.cooldowns.set(playerId, cooldown - 1);
      }
    }
  }

  getPlayerPowerUp(playerId) {
    return this.powerUps.get(playerId);
  }

  getPlayerCooldown(playerId) {
    return this.cooldowns.get(playerId) || 0;
  }
}