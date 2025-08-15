import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import { rooms, sounds, participants, insertRoomSchema, insertSoundSchema, type Room, type Sound, type InsertRoom, type InsertSound } from '../shared/schema';
import ws from "ws";

// Configure WebSocket for Neon in serverless environment
neonConfig.webSocketConstructor = ws;

// Ensure environment is properly set for Vercel
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for Railway database connection');
}

// Initialize database connection for serverless
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema: { rooms, sounds, participants } });

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Database operations - direct database calls for serverless
async function createRoom(insertRoom: InsertRoom & { code: string }): Promise<Room> {
  const [room] = await db
    .insert(rooms)
    .values({
      name: insertRoom.name,
      code: insertRoom.code,
      hostId: insertRoom.hostId,
    })
    .returning();
  return room;
}

async function getRoomByCode(code: string): Promise<Room | undefined> {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  return room || undefined;
}

async function getSoundsByRoomId(roomId: string): Promise<Sound[]> {
  return await db.select().from(sounds).where(eq(sounds.roomId, roomId));
}

async function createSound(insertSound: InsertSound): Promise<Sound> {
  const [sound] = await db
    .insert(sounds)
    .values(insertSound)
    .returning();
  return sound;
}

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);

  try {
    // Health check endpoint
    if (pathname === '/api/health') {
      return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Soundboard API is running on Vercel with Railway database'
      });
    }

    // Create room endpoint
    if (pathname === '/api/rooms' && req.method === 'POST') {
      const { name, hostId } = insertRoomSchema.parse(req.body);
      
      let code: string;
      let attempts = 0;
      do {
        code = generateRoomCode();
        attempts++;
        if (attempts > 10) {
          throw new Error('Unable to generate unique room code');
        }
      } while (await getRoomByCode(code));

      const room = await createRoom({ code, name, hostId });
      return res.json(room);
    }

    // Get room by code endpoint
    if (pathname.startsWith('/api/rooms/') && !pathname.includes('/sounds') && req.method === 'GET') {
      const code = pathname.split('/')[3];
      const room = await getRoomByCode(code.toUpperCase());
      
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      return res.json(room);
    }

    // Get sounds for room endpoint
    if (pathname.match(/^\/api\/rooms\/[^\/]+\/sounds$/) && req.method === 'GET') {
      const roomId = pathname.split('/')[3];
      const sounds = await getSoundsByRoomId(roomId);
      return res.json(sounds);
    }

    // Upload sound endpoint (simplified for serverless)
    if (pathname.match(/^\/api\/rooms\/[^\/]+\/sounds$/) && req.method === 'POST') {
      const roomId = pathname.split('/')[3];
      
      // Note: File uploads are limited in serverless functions
      // For production, integrate with cloud storage service
      const soundData = {
        roomId,
        name: 'Uploaded Sound',
        fileName: 'uploaded-audio.mp3',
        uploadedBy: 'Anonymous',
        duration: 3000
      };

      const sound = await createSound(soundData);
      return res.json({
        ...sound,
        note: 'File upload functionality requires cloud storage integration for production use'
      });
    }

    // Default 404 response
    return res.status(404).json({
      error: 'API endpoint not found',
      path: pathname,
      method: req.method
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      message: error.message || 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

