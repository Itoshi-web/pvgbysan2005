export class CombatManager {
  constructor(powerUpManager) {
    this.powerUpManager = powerUpManager;
  }

  handleShoot(room, targetPlayer, targetCell) {
    const currentPlayer = room.gameState.players[room.gameState.currentPlayer];
    const target = room.gameState.players[targetPlayer];

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

    const targetPowerUpState = this.powerUpManager.getPlayerState(target.id);
    const isShielded = targetPowerUpState?.activeEffects.some(
      effect => effect.type === 'shield' && effect.targetCell === targetCell
    );
    if (isShielded) throw new Error('Target cell is shielded');

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

    const isEliminated = target.cells.every(cell => !cell.isActive);
    if (isEliminated) {
      target.eliminated = true;
      room.gameState.gameLog.push({
        type: 'eliminate',
        player: target.username,
        shooter: currentPlayer.username
      });

      const remainingPlayers = room.gameState.players.filter(p => !p.eliminated);
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        const history = this.generateGameHistory(room, winner);
        return { room, gameEnded: true, history };
      }
    }

    room.gameState.nextTurn();
    return { room };
  }

  generateGameHistory(room, winner) {
    return {
      winner: winner.username,
      eliminations: room.gameState.gameLog
        .filter(log => log.type === 'eliminate')
        .map(log => ({
          eliminator: log.shooter,
          eliminated: log.player
        })),
      playerStats: Object.fromEntries(
        room.gameState.players.map(player => [
          player.username,
          {
            shotsFired: player.cells.reduce((acc, cell) => acc + (5 - (cell.bullets || 0)), 0),
            eliminations: room.gameState.gameLog.filter(log => 
              log.type === 'eliminate' && log.shooter === player.username
            ).length,
            timesTargeted: room.gameState.gameLog.filter(log =>
              log.type === 'shoot' && log.target === player.username
            ).length
          }
        ])
      )
    };
  }
}
