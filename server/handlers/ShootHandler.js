export class ShootHandler {
  handle(room, targetPlayer, targetCell) {
    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    const target = room.gameState.players[targetPlayer];

    this.validateShot(room, currentPlayer, target, targetCell);

    const lastRoll = room.gameState.lastRoll;
    const shooterCell = currentPlayer.cells[lastRoll - 1];
    const targetCellObj = target.cells[targetCell];

    shooterCell.bullets--;
    targetCellObj.isActive = false;
    targetCellObj.stage = 0;
    targetCellObj.bullets = 0;

    room.gameState.gameLog.push({
      type: 'shoot',
      shooter: currentPlayer.username,
      target: target.username,
      cell: targetCell + 1
    });

    this.checkElimination(room, target, currentPlayer);
    room.gameState.nextTurn();
    
    return room;
  }

  validateShot(room, currentPlayer, target, targetCell) {
    if (!target) throw new Error('Target player not found');
    if (target.eliminated) throw new Error('Cannot shoot an eliminated player');
    if (currentPlayer.eliminated) throw new Error('Eliminated players cannot shoot');
    if (currentPlayer.firstMove) throw new Error('Cannot shoot on first move');

    const lastRoll = room.gameState.lastRoll;
    if (!lastRoll) throw new Error('Must roll before shooting');

    const shooterCell = currentPlayer.cells[lastRoll - 1];
    if (!shooterCell) throw new Error('Invalid shooter cell');
    if (!shooterCell.isActive) throw new Error('Shooter cell is not active');
    if (shooterCell.stage !== 6) throw new Error('Cell must be at stage 6 to shoot');
    if (!shooterCell.bullets || shooterCell.bullets <= 0) throw new Error('No bullets available');

    const targetCellObj = target.cells[targetCell];
    if (!targetCellObj) throw new Error('Target cell not found');
    if (!targetCellObj.isActive) throw new Error('Cannot shoot an inactive cell');
  }

  checkElimination(room, target, currentPlayer) {
    const isEliminated = target.cells.every(cell => !cell.isActive);
    if (isEliminated) {
      target.eliminated = true;
      room.gameState.gameLog.push({
        type: 'eliminate',
        player: target.username,
        shooter: currentPlayer.username
      });
    }
  }
}