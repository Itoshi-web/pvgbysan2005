import { Room } from '../models/Room';
import { generateRoomId } from '../utils/roomUtils';

export class RoomService {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map();
  }

  createRoom(maxPlayers: number, password: string | null = null): Room {
    if (maxPlayers < 2 || maxPlayers > 5) {
      throw new Error('Invalid number of players');
    }
    const roomId = generateRoomId();
    const room = new Room(roomId, maxPlayers, password);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  findAvailableRoom(): string | null {
    for (const [roomId, room] of this.rooms.entries()) {
      if (!room.password && !room.isFull() && !room.started) {
        return roomId;
      }
    }
    return null;
  }
}