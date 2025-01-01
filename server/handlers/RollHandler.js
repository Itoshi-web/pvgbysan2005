export class RollHandler {
  constructor(powerUpManager) {
    this.powerUpManager = powerUpManager;
  }

  handle(room, value) {
    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    
    if (value > room.gameState.maxDiceValue) {
      throw new Error('Invalid dice value');
    }

    // Handle first move - must roll a 1
    if (currentPlayer.firstMove) {
      if (value !== 1) {
        room.gameState.gameLog.push({
          type: 'firstMove',
          player: currentPlayer.username,
          message: 'Must roll a 1 to start'
        });
        room.gameState.nextTurn();
        return { room };
      }
      // If they roll a 1, mark firstMove as false and continue
      currentPlayer.firstMove = false;
    }

    // Handle power-up roll (rolling 6 in 5-player game)
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

    // Check for no-roll effect
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

    // Handle cell update and advance turn
    if (!targetCell.isActive) {
      targetCell.isActive = true;
      targetCell.stage = 1;
      room.gameState.gameLog.push({
        type: 'activate',
        player: currentPlayer.username,
        cell: value
      });
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
      } else if (targetCell.bullets < 5) {
        targetCell.bullets++;
        room.gameState.gameLog.push({
          type: 'reload',
          player: currentPlayer.username,
          cell: value
        });
      }
    }

    // Always advance turn after a successful move
    room.gameState.nextTurn();
    room.gameState.lastRoll = value;
    return { room };
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
}}
