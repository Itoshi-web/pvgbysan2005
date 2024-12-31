export class TurnManager {
  constructor() {
    this.turnTimers = new Map();
  }

  startTurnTimer(roomId, callback) {
    if (this.turnTimers.has(roomId)) {
      clearTimeout(this.turnTimers.get(roomId));
    }

    const timer = setTimeout(() => {
      callback();
    }, 30000);

    this.turnTimers.set(roomId, timer);
  }

  handleRoll(room, value, powerUpManager) {
    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    
    const maxRoll = room.players.length === 5 ? 6 : room.players.length;
    if (value > maxRoll) {
      throw new Error(`Invalid roll. Maximum value for ${room.players.length} players is ${maxRoll}`);
    }

    if (currentPlayer.firstMove && value !== 1) {
      room.gameState.gameLog.push({
        type: 'firstMove',
        player: currentPlayer.username,
        message: 'Must roll a 1 to start'
      });
      room.gameState.nextTurn();
      return { room };
    }

    if (room.players.length === 5 && value === 6) {
      const powerUp = powerUpManager.grantPowerUp(currentPlayer.id);
      if (powerUp) {
        room.gameState.gameLog.push({
          type: 'powerUp',
          player: currentPlayer.username,
          powerUpType: powerUp.type
        });
        return { room, powerUp };
      }
    }

    const powerUpState = powerUpManager.getPlayerState(currentPlayer.id);
    if (powerUpState?.activeEffects.some(effect => effect.type === 'noRoll')) {
      room.gameState.gameLog.push({
        type: 'skipTurn',
        player: currentPlayer.username,
        message: 'Turn skipped due to No Roll effect'
      });
      room.gameState.nextTurn();
      return { room };
    }

    const targetCell = currentPlayer.cells[value - 1];
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
        targetCell.bullets = 5;
        room.gameState.gameLog.push({
          type: 'reload',
          player: currentPlayer.username,
          cell: value
        });
      }
    }

    if (currentPlayer.firstMove) {
      currentPlayer.firstMove = false;
    }

    room.gameState.lastRoll = value;
    return { room };
  }

  cleanup() {
    for (const timer of this.turnTimers.values()) {
      clearTimeout(timer);
    }
    this.turnTimers.clear();
  }
}
