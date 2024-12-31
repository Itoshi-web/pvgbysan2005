import { POWER_UPS } from '../constants/power-ups.js';

export class PowerUpService {
  handlePowerUpRoll(gameState) {
    const currentPlayer = gameState.players[gameState.currentPlayer];
    
    if (currentPlayer.powerUpCooldown > 0) {
      return null;
    }

    const randomPowerUp = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
    currentPlayer.powerUp = randomPowerUp;
    
    gameState.gameLog.push({
      type: 'powerUp',
      player: currentPlayer.username,
      powerUp: randomPowerUp.type
    });

    return randomPowerUp;
  }

  applyPowerUp(gameState, targetPlayerId, targetCell) {
    const currentPlayer = gameState.players[gameState.currentPlayer];
    const powerUp = currentPlayer.powerUp;
    
    if (!powerUp) return false;

    const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) return false;

    switch (powerUp.type) {
      case 'freeze':
        if (targetCell === undefined) return false;
        targetPlayer.cells[targetCell].frozen = true;
        break;
      
      case 'shield':
        if (targetCell === undefined) return false;
        currentPlayer.cells[targetCell].shielded = true;
        break;
      
      case 'noRoll':
        targetPlayer.skipNextTurn = true;
        break;
      
      case 'doubleShot':
        gameState.doubleShotActive = true;
        break;
    }

    currentPlayer.powerUp = null;
    currentPlayer.powerUpCooldown = 2;

    gameState.gameLog.push({
      type: 'powerUpUsed',
      player: currentPlayer.username,
      target: targetPlayer.username,
      powerUp: powerUp.type,
      cell: targetCell
    });

    return true;
  }
}