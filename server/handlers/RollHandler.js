export class RollHandler {
  constructor(powerUpManager) {
    this.powerUpManager = powerUpManager;
  }

  handle(room, value) {
    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    
    if (value > room.gameState.maxDiceValue) {
      throw new Error('Invalid dice value');
    }

    if (this.handleFirstMove(room, currentPlayer, value)) {
      return { room };
    }

    if (this.handlePowerUpRoll(room, currentPlayer, value)) {
      return { room };
    }

    if (this.handleNoRollEffect(room, currentPlayer)) {
      return { room };
    }

    const targetCell = currentPlayer.cells[value - 1];
    
    // Check if the cell is already at stage 6 with bullets
    if (targetCell.isActive && targetCell.stage === 6 && targetCell.bullets > 0) {
      // Don't advance turn - player can shoot
      room.gameState.lastRoll = value;
      return { room };
    }

    return this.handleCellUpdate(room, currentPlayer, targetCell, value);
  }

  handleFirstMove(room, currentPlayer, value) {
    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: 'Must roll a 1 to start'
      });
      room.gameState.nextTurn();
      return true;
    }
    return false;
  }

  handlePowerUpRoll(room, currentPlayer, value) {
    if (room.players.length === 5 && value === 6) {
      const powerUp = this.powerUpManager.grantPowerUp(currentPlayer.id);
      if (powerUp) {
        room.gameState.gameLog.push({
          type: 'powerUp',
          player: currentPlayer.username,
          powerUpType: powerUp.type
        });
      }
    }
    return false;
  }

  handleNoRollEffect(room, currentPlayer) {
    const powerUpState = this.powerUpManager.getPlayerState(currentPlayer.id);
    if (powerUpState?.activeEffects.some(effect => effect.type === 'noRoll')) {
      room.gameState.gameLog.push({
        type: 'skipTurn',
        player: currentPlayer.username,
        message: 'Turn skipped due to No Roll effect'
      });
      room.gameState.nextTurn();
      return true;
    }
    return false;
  }

  handleCellUpdate(room, currentPlayer, targetCell, value) {
    if (!targetCell.isActive) {
      targetCell.isActive = true;
      targetCell.stage = 1;
      room.gameState.gameLog.push({
        type: 'activate',
        player: currentPlayer.username,
        cell: value
      });
      room.gameState.nextTurn();
    } else {
      if (targetCell.stage < 6) {
        targetCell.stage++;
        if (targetCell.stage === 6) {
          targetCell.bullets = 5;
          room.gameState.gameLog.push({
            type: 'maxLevel',
            player: currentPlayer.username,
            cell: value
          });
        }
        room.gameState.nextTurn();
      } else if (targetCell.bullets < 5) {
        targetCell.bullets++;
        room.gameState.gameLog.push({
          type: 'reload',
          player: currentPlayer.username,
          cell: value
        });
        room.gameState.nextTurn();
      }
    }

    if (currentPlayer.firstMove) {
      currentPlayer.firstMove = false;
    }

    room.gameState.lastRoll = value;
    return { room };
  }
}