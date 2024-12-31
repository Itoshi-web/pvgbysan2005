export class PowerUpManager {
  constructor() {
    this.powerUps = new Map(); // playerId -> PowerUpState
  }

  initializePlayer(playerId) {
    this.powerUps.set(playerId, {
      currentPowerUp: null,
      cooldownTurns: 0,
      activeEffects: []
    });
  }

  canReceivePowerUp(playerId) {
    const state = this.powerUps.get(playerId);
    return state && state.cooldownTurns === 0 && !state.currentPowerUp;
  }

  grantPowerUp(playerId) {
    if (!this.canReceivePowerUp(playerId)) return null;

    const powerUps = ['freeze', 'shield', 'noRoll', 'doubleShot'];
    const randomPowerUp = {
      type: powerUps[Math.floor(Math.random() * powerUps.length)]
    };

    const state = this.powerUps.get(playerId);
    state.currentPowerUp = randomPowerUp;
    return randomPowerUp;
  }

  usePowerUp(playerId, targetPlayerId, targetCell) {
    const state = this.powerUps.get(playerId);
    if (!state || !state.currentPowerUp) return null;

    const effect = {
      ...state.currentPowerUp,
      targetCell,
      targetPlayer: targetPlayerId
    };

    state.activeEffects.push(effect);
    state.currentPowerUp = null;
    state.cooldownTurns = 2;

    return effect;
  }

  updateCooldowns() {
    for (const [playerId, state] of this.powerUps.entries()) {
      if (state.cooldownTurns > 0) {
        state.cooldownTurns--;
      }

      // Remove expired effects
      state.activeEffects = state.activeEffects.filter(effect => effect.turnsLeft > 0);
      state.activeEffects.forEach(effect => {
        if (effect.turnsLeft) effect.turnsLeft--;
      });
    }
  }

  getPlayerState(playerId) {
    return this.powerUps.get(playerId);
  }

  removePlayer(playerId) {
    this.powerUps.delete(playerId);
  }
}