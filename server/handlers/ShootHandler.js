export class ShootHandler {
  handle(room, targetPlayer, targetCell) {
    const currentPlayer = room.gameState.getCurrentPlayer();

    // Check if the current player has bullets
    if (currentPlayer.bullets <= 0) {
      throw new Error('Cannot shoot - no bullets available');
    }

    // Validate the target
    const target = room.players.find(player => player.id === targetPlayer);
    if (!target) {
      throw new Error('Invalid target player');
    }

    const cell = target.cells[targetCell];
    if (!cell || cell.isDestroyed) {
      throw new Error('Invalid or already destroyed target cell');
    }

    // Apply shooting logic
    cell.isDestroyed = true;

    // Decrement the bullet count
    currentPlayer.bullets -= 1;

    // Return success message
    return {
      success: true,
      message: `Shot successful! ${targetPlayer}'s cell ${targetCell} destroyed.`
    };
  }
}
