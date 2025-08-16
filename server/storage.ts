import { type Room, type InsertRoom, type Sound, type InsertSound, type Participant, type InsertParticipant, rooms, sounds, participants } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Room methods
  createRoom(room: InsertRoom & { code: string }): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getRoomById(id: string): Promise<Room | undefined>;
  getPublicRooms(): Promise<Room[]>;
  deleteRoom(id: string): Promise<void>;

  // Sound methods
  createSound(sound: InsertSound): Promise<Sound>;
  getSoundsByRoomId(roomId: string): Promise<Sound[]>;
  getSoundById(id: string): Promise<Sound | undefined>;
  deleteSound(id: string): Promise<void>;

  // Participant methods
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  getParticipantsByRoomId(roomId: string): Promise<Participant[]>;
  getParticipantById(id: string): Promise<Participant | undefined>;
  updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined>;
  deleteParticipant(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private rooms: Map<string, Room> = new Map();
  private sounds: Map<string, Sound> = new Map();
  private participants: Map<string, Participant> = new Map();

  async createRoom(insertRoom: InsertRoom & { code: string }): Promise<Room> {
    const id = randomUUID();
    const room: Room = {
      id,
      name: insertRoom.name,
      code: insertRoom.code,
      hostId: insertRoom.hostId,
      isPublic: insertRoom.isPublic || false,
      createdAt: new Date(),
    };
    this.rooms.set(id, room);
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    return Array.from(this.rooms.values()).find(room => room.code === code);
  }

  async getRoomById(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async getPublicRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values()).filter(room => room.isPublic);
  }

  async deleteRoom(id: string): Promise<void> {
    this.rooms.delete(id);
    // Clean up associated sounds and participants, and their files
    Array.from(this.sounds.values())
      .filter(sound => sound.roomId === id)
      .forEach(sound => {
        // Clean up audio files when room is deleted
        this.cleanupAudioFile(sound.fileName);
        this.sounds.delete(sound.id);
      });
    
    Array.from(this.participants.values())
      .filter(participant => participant.roomId === id)
      .forEach(participant => this.participants.delete(participant.id));
  }

  async deleteSound(id: string): Promise<void> {
    const sound = this.sounds.get(id);
    if (sound) {
      // Clean up the associated audio file
      this.cleanupAudioFile(sound.fileName);
      this.sounds.delete(id);
    }
  }

  private cleanupAudioFile(fileName: string): void {
    try {
      const path = require('path');
      const fs = require('fs');
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up audio file:', fileName);
      }
    } catch (error) {
      console.warn('Failed to cleanup audio file:', fileName, error);
    }
  }

  async createSound(insertSound: InsertSound): Promise<Sound> {
    const id = randomUUID();
    const sound: Sound = {
      ...insertSound,
      id,
      createdAt: new Date(),
    };
    this.sounds.set(id, sound);
    return sound;
  }

  async getSoundsByRoomId(roomId: string): Promise<Sound[]> {
    return Array.from(this.sounds.values()).filter(sound => sound.roomId === roomId);
  }

  async getSoundById(id: string): Promise<Sound | undefined> {
    return this.sounds.get(id);
  }



  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const id = randomUUID();
    const participant: Participant = {
      id,
      name: insertParticipant.name,
      roomId: insertParticipant.roomId,
      isHost: insertParticipant.isHost ?? false,
      isActive: insertParticipant.isActive ?? true,
      joinedAt: new Date(),
    };
    this.participants.set(id, participant);
    return participant;
  }

  async getParticipantsByRoomId(roomId: string): Promise<Participant[]> {
    return Array.from(this.participants.values()).filter(participant => participant.roomId === roomId);
  }

  async getParticipantById(id: string): Promise<Participant | undefined> {
    return this.participants.get(id);
  }

  async updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined> {
    const participant = this.participants.get(id);
    if (!participant) {
      return undefined;
    }
    
    const updatedParticipant = { ...participant, ...updates };
    this.participants.set(id, updatedParticipant);
    return updatedParticipant;
  }

  async deleteParticipant(id: string): Promise<void> {
    this.participants.delete(id);
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async createRoom(insertRoom: InsertRoom & { code: string }): Promise<Room> {
    const [room] = await db
      .insert(rooms)
      .values({
        name: insertRoom.name,
        code: insertRoom.code,
        hostId: insertRoom.hostId,
        isPublic: insertRoom.isPublic || false,
      })
      .returning();
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    return room || undefined;
  }

  async getRoomById(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async getPublicRooms(): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.isPublic, true));
  }

  async deleteRoom(id: string): Promise<void> {
    // First get all sounds to clean up files
    const roomSounds = await db.select().from(sounds).where(eq(sounds.roomId, id));
    
    // Clean up audio files
    for (const sound of roomSounds) {
      this.cleanupAudioFile(sound.fileName);
    }
    
    // Delete related data (foreign key constraints will handle this automatically)
    await db.delete(participants).where(eq(participants.roomId, id));
    await db.delete(sounds).where(eq(sounds.roomId, id));
    await db.delete(rooms).where(eq(rooms.id, id));
  }

  async createSound(insertSound: InsertSound): Promise<Sound> {
    const [sound] = await db
      .insert(sounds)
      .values(insertSound)
      .returning();
    return sound;
  }

  async getSoundsByRoomId(roomId: string): Promise<Sound[]> {
    return await db.select().from(sounds).where(eq(sounds.roomId, roomId));
  }

  async getSoundById(id: string): Promise<Sound | undefined> {
    const [sound] = await db.select().from(sounds).where(eq(sounds.id, id));
    return sound || undefined;
  }

  async deleteSound(id: string): Promise<void> {
    const [sound] = await db.select().from(sounds).where(eq(sounds.id, id));
    if (sound) {
      this.cleanupAudioFile(sound.fileName);
      await db.delete(sounds).where(eq(sounds.id, id));
    }
  }

  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const [participant] = await db
      .insert(participants)
      .values(insertParticipant)
      .returning();
    return participant;
  }

  async getParticipantsByRoomId(roomId: string): Promise<Participant[]> {
    return await db.select().from(participants).where(eq(participants.roomId, roomId));
  }

  async getParticipantById(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id));
    return participant || undefined;
  }

  async updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined> {
    const [updatedParticipant] = await db
      .update(participants)
      .set(updates)
      .where(eq(participants.id, id))
      .returning();
    return updatedParticipant || undefined;
  }

  async deleteParticipant(id: string): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id));
  }

  private async cleanupAudioFile(fileName: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, that's okay
      console.warn(`Could not delete audio file ${fileName}:`, error);
    }
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
