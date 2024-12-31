// Add to existing socket.io event handlers

socket.on('usePowerUp', ({ roomId, targetPlayerId, targetCell }) => {
  try {
    const room = gameService.handlePowerUp(roomId, targetPlayerId, targetCell);
    io.to(roomId).emit(EVENTS.GAME_STATE_UPDATED, { gameState: room.gameState });
  } catch (error) {
    socket.emit(EVENTS.ERROR, { message: error.message });
  }
});