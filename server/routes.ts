import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import ffprobe from "node-ffprobe";
import { storage } from "./storage";
import { insertRoomSchema, insertSoundSchema, insertParticipantSchema } from "@shared/schema";

// Set up file upload storage
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
    const allowedExtensions = ['.mp3', '.wav'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3 and WAV files are allowed.'));
    }
  }
});

interface WebSocketClient {
  ws: WebSocket;
  participantId: string;
  roomId: string;
}

const clients: Map<string, WebSocketClient> = new Map();
const voiceParticipants: Map<string, Set<string>> = new Map(); // roomId -> Set of participantIds in voice chat

function generateRoomCode(): string {
  // Generate more secure room codes with better collision avoidance
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const metadata = await ffprobe(filePath);
    const duration = metadata.streams[0]?.duration;
    return duration ? Math.round(parseFloat(duration) * 1000) : 3000; // Convert to milliseconds
  } catch (error) {
    console.warn('Failed to get audio duration, using default:', error);
    return 3000; // Default 3 seconds if probe fails
  }
}

async function addDefaultSounds(roomId: string, hostId: string): Promise<void> {
  const defaultSounds = [
    { name: 'Yo Phone Lining', fileName: 'default-yo-phone-lining.mp3' },
    { name: 'Tuco Get Out', fileName: 'default-tuco-get-out.mp3' },
    { name: 'Sad Meow Song', fileName: 'default-sad-meow-song.mp3' },
    { name: 'Panjabi MC Mundian', fileName: 'default-panjabi-mc-mundian.mp3' }
  ];

  for (const defaultSound of defaultSounds) {
    try {
      const filePath = path.join(uploadDir, defaultSound.fileName);
      if (fs.existsSync(filePath)) {
        const duration = await getAudioDuration(filePath);
        await storage.createSound({
          name: defaultSound.name,
          fileName: defaultSound.fileName,
          duration,
          roomId,
          uploadedBy: hostId
        });
        console.log(`Added default sound: ${defaultSound.name}`);
      } else {
        console.warn(`Default sound file not found: ${defaultSound.fileName}`);
      }
    } catch (error) {
      console.error(`Failed to add default sound ${defaultSound.name}:`, error);
    }
  }
}

function broadcastToRoom(roomId: string, message: any, excludeParticipantId?: string) {
  const roomClients = Array.from(clients.values())
    .filter(client => client.roomId === roomId && client.participantId !== excludeParticipantId);
  
  console.log(`Broadcasting to room ${roomId}: ${roomClients.length} clients`);
  console.log(`Room participants: ${roomClients.map(c => c.participantId).join(', ')}`);
  console.log(`Message type: ${message.type}`);
  
  // Debug the exact message being sent
  if (message.type === 'voice_participant_count_changed') {
    console.log('🎯 SENDING VOICE COUNT MESSAGE:', JSON.stringify(message, null, 2));
  }
  
  let successCount = 0;
  let failureCount = 0;
  
  roomClients.forEach((client, index) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        client.ws.send(messageStr);
        console.log(`Message sent to client ${index + 1} (participant: ${client.participantId})`);
        
        // Extra debug for voice count messages
        if (message.type === 'voice_participant_count_changed') {
          console.log(`🎯 SENT VOICE COUNT to ${client.participantId}:`, messageStr);
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to send message to client ${index + 1}:`, error);
        failureCount++;
      }
    } else {
      console.log(`Client ${index + 1} not ready (state: ${client.ws.readyState}), removing from map`);
      failureCount++;
      // Clean up dead connections
      Array.from(clients.entries()).forEach(([id, c]) => {
        if (c === client) {
          clients.delete(id);
        }
      });
    }
  });
  
  console.log(`Broadcast completed: ${successCount} successful, ${failureCount} failed`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log('New WebSocket connection:', clientId);
    
    // Keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received WebSocket message:', message.type, 'from client:', clientId);
        
        switch (message.type) {
          case 'join_room':
            // Check if this client is already registered for this participant
            const existingClient = clients.get(clientId);
            if (existingClient && existingClient.participantId === message.participantId) {
              console.log(`Client ${clientId} already registered for participant ${message.participantId}`);
              // Still send confirmation back to the client
              ws.send(JSON.stringify({
                type: 'join_confirmed',
                participantId: message.participantId,
                roomId: message.roomId
              }));
              break;
            }
            
            // Remove any other clients with same participant ID to prevent duplicates
            Array.from(clients.entries()).forEach(([id, client]) => {
              if (id !== clientId && client.participantId === message.participantId) {
                console.log(`Removing duplicate client ${id} for participant ${message.participantId}`);
                if (client.ws.readyState === WebSocket.OPEN) {
                  client.ws.close(1000, "Duplicate connection");
                }
                clients.delete(id);
              }
            });
            
            const client: WebSocketClient = {
              ws,
              participantId: message.participantId,
              roomId: message.roomId
            };
            clients.set(clientId, client);
            console.log(`Client ${clientId} joined room ${message.roomId} as participant ${message.participantId}`);
            console.log(`Total clients in map: ${clients.size}`);
            
            // Send confirmation to the joining participant first
            ws.send(JSON.stringify({
              type: 'join_confirmed',
              participantId: message.participantId,
              roomId: message.roomId
            }));
            
            // Small delay to ensure client is properly registered before broadcasting
            setTimeout(() => {
              // Notify others in room about new participant
              console.log('Broadcasting participant join to room:', message.roomId);
              broadcastToRoom(message.roomId, {
                type: 'participant_joined',
                participantId: message.participantId
              }, message.participantId);
            }, 50);
            break;

          // Voice chat WebRTC signaling
          case 'voice_join':
            console.log(`Voice join: broadcasting voice_participant_joined for ${message.participantId} to room ${message.roomId}`);
            
            // Track voice participant
            if (!voiceParticipants.has(message.roomId)) {
              voiceParticipants.set(message.roomId, new Set());
            }
            voiceParticipants.get(message.roomId)!.add(message.participantId);
            
            // Send confirmation to the joining participant first
            ws.send(JSON.stringify({
              type: 'voice_join_confirmed',
              participantId: message.participantId,
              roomId: message.roomId
            }));
            
            // Then broadcast to all other participants in the room
            broadcastToRoom(message.roomId, {
              type: 'voice_participant_joined',
              participantId: message.participantId
            }, message.participantId);
            
            // Broadcast voice participant count to ALL room participants
            const voiceCountAfterJoin = voiceParticipants.get(message.roomId)?.size || 0;
            broadcastToRoom(message.roomId, {
              type: 'voice_participant_count_changed',
              count: voiceCountAfterJoin
            });
            break;
            
          case 'voice_leave':
            // Remove from voice participants tracking
            if (voiceParticipants.has(message.roomId)) {
              voiceParticipants.get(message.roomId)!.delete(message.participantId);
              // Clean up empty sets
              if (voiceParticipants.get(message.roomId)!.size === 0) {
                voiceParticipants.delete(message.roomId);
              }
            }
            
            broadcastToRoom(message.roomId, {
              type: 'voice_participant_left',
              participantId: message.participantId
            }, message.participantId);
            
            // Broadcast updated voice participant count to ALL room participants
            const voiceCountAfterLeave = voiceParticipants.get(message.roomId)?.size || 0;
            broadcastToRoom(message.roomId, {
              type: 'voice_participant_count_changed',
              count: voiceCountAfterLeave
            });
            break;
            
          case 'voice_offer':
          case 'voice_answer':
          case 'voice_ice_candidate':
            // Forward WebRTC signaling messages to specific participant
            const targetClient = Array.from(clients.values())
              .find(c => c.roomId === message.roomId && c.participantId === message.to);
            
            if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
              targetClient.ws.send(JSON.stringify(message));
            }
            break;
            
          case 'voice_participant_muted':
            broadcastToRoom(message.roomId, {
              type: 'voice_participant_muted',
              participantId: message.participantId,
              isMuted: message.isMuted
            }, message.participantId);
            break;
            
          case 'play_sound':
            broadcastToRoom(message.roomId, {
              type: 'sound_played',
              soundId: message.soundId,
              participantId: message.participantId,
              timestamp: Date.now()
            }, message.participantId);
            break;
            
          case 'leave_room':
            // Mark participant as inactive in storage
            try {
              await storage.updateParticipant(message.participantId, { isActive: false });
              console.log(`Marked participant ${message.participantId} as inactive`);
            } catch (error) {
              console.error('Failed to update participant status:', error);
            }
            
            broadcastToRoom(message.roomId, {
              type: 'participant_left',
              participantId: message.participantId
            }, message.participantId);
            clients.delete(clientId);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async (code, reason) => {
      console.log(`Client ${clientId} disconnected (code: ${code}, reason: ${reason})`);
      clearInterval(pingInterval);
      
      const client = clients.get(clientId);
      if (client) {
        console.log(`Removing client ${clientId} from room ${client.roomId}`);
        
        // Clean up voice participant tracking
        if (voiceParticipants.has(client.roomId)) {
          const wasInVoiceChat = voiceParticipants.get(client.roomId)!.has(client.participantId);
          voiceParticipants.get(client.roomId)!.delete(client.participantId);
          
          // Clean up empty sets
          if (voiceParticipants.get(client.roomId)!.size === 0) {
            voiceParticipants.delete(client.roomId);
          }
          
          // If they were in voice chat, notify about count change
          if (wasInVoiceChat) {
            const voiceCountAfterDisconnect = voiceParticipants.get(client.roomId)?.size || 0;
            broadcastToRoom(client.roomId, {
              type: 'voice_participant_count_changed',
              count: voiceCountAfterDisconnect
            });
            
            // Also send voice participant left message
            broadcastToRoom(client.roomId, {
              type: 'voice_participant_left',
              participantId: client.participantId
            }, client.participantId);
          }
        }
        
        // Mark participant as inactive in storage
        try {
          await storage.updateParticipant(client.participantId, { isActive: false });
          console.log(`Marked participant ${client.participantId} as inactive on disconnect`);
        } catch (error) {
          console.error('Failed to update participant status on disconnect:', error);
        }
        
        broadcastToRoom(client.roomId, {
          type: 'participant_left',
          participantId: client.participantId
        }, client.participantId);
        clients.delete(clientId);
        console.log(`Total clients remaining: ${clients.size}`);
      }
    });
    
    ws.on('pong', () => {
      // Connection is alive
    });
  });

  // Room routes
  app.post('/api/rooms', async (req, res) => {
    try {
      const { name, hostId } = insertRoomSchema.parse(req.body);
      
      // Check for duplicate room codes and regenerate if needed
      let code: string;
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        code = generateRoomCode();
        const existingRoom = await storage.getRoomByCode(code);
        if (!existingRoom) break;
        attempts++;
      } while (attempts < maxAttempts);
      
      if (attempts >= maxAttempts) {
        return res.status(500).json({ error: 'Unable to generate unique room code. Please try again.' });
      }
      
      console.log('Generated unique room code:', code);
      const room = await storage.createRoom({ name, code, hostId });
      
      // Create host participant with the actual host name
      await storage.createParticipant({
        name: hostId,
        roomId: room.id,
        isHost: true,
        isActive: true
      });
      
      // Add default sounds to the new room
      await addDefaultSounds(room.id, hostId);
      
      res.json(room);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/rooms/:code', async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Participant routes
  app.post('/api/participants', async (req, res) => {
    try {
      const participantData = insertParticipantSchema.parse(req.body);
      
      // Check if this user is already the host for this room
      const room = await storage.getRoomById(participantData.roomId);
      if (room && room.hostId === participantData.name) {
        // Find existing host participant and update it
        const participants = await storage.getParticipantsByRoomId(participantData.roomId);
        const hostParticipant = participants.find(p => p.isHost);
        
        if (hostParticipant) {
          // Update the existing host participant
          const updatedHost = await storage.updateParticipant(hostParticipant.id, {
            name: participantData.name,
            isActive: true
          });
          return res.json(updatedHost);
        }
      }
      
      const participant = await storage.createParticipant(participantData);
      res.json(participant);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/rooms/:roomId/participants', async (req, res) => {
    try {
      const allParticipants = await storage.getParticipantsByRoomId(req.params.roomId);
      // Only return active participants
      const activeParticipants = allParticipants.filter(p => p.isActive);
      res.json(activeParticipants);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Sound routes
  app.post('/api/sounds', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const { name, roomId, uploadedBy } = req.body;
      
      // Get actual audio duration from the uploaded file
      const filePath = path.join(uploadDir, req.file.filename);
      const duration = await getAudioDuration(filePath);
      
      const sound = await storage.createSound({
        name,
        fileName: req.file.filename,
        duration,
        roomId,
        uploadedBy
      });

      // Notify room participants about new sound with delay to ensure proper delivery
      console.log('Broadcasting sound upload to room:', roomId);
      setTimeout(() => {
        broadcastToRoom(roomId, {
          type: 'sound_uploaded',
          sound,
          timestamp: Date.now()
        });
      }, 100);

      res.json(sound);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/rooms/:roomId/sounds', async (req, res) => {
    try {
      const sounds = await storage.getSoundsByRoomId(req.params.roomId);
      res.json(sounds);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/sounds/:id/audio', async (req, res) => {
    try {
      const sound = await storage.getSoundById(req.params.id);
      if (!sound) {
        return res.status(404).json({ error: 'Sound not found' });
      }

      const filePath = path.join(uploadDir, sound.fileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found' });
      }

      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return httpServer;
}
