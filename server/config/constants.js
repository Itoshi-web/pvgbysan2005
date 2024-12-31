export const EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  ROOM_CREATED: 'roomCreated',
  PLAYER_JOINED: 'playerJoined',
  ROOM_UPDATED: 'roomUpdated',
  PLAYER_LEFT: 'playerLeft',
  GAME_STARTED: 'gameStarted',
  GAME_STATE_UPDATED: 'gameStateUpdated',
  GAME_ENDED: 'gameEnded',
  REJOIN_SUCCESS: 'rejoinSuccess',
  EMOTE: 'emote'
};

export const ORIGINS = [
  'https://inspiring-macaron-2070dc.netlify.app/',
  'http://localhost:5173'
];

export const PORT = process.env.PORT || 3000;
