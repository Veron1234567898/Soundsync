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
const roomCleanupTimers: Map<string, NodeJS.Timeout> = new Map(); // roomId -> cleanup timer

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
    { name: 'Panjabi MC Mundian', fileName: 'default-panjabi-mc-mundian.mp3' },
    { name: 'Y2mate Sound', fileName: 'default-y2mate.mp3' },
    { name: 'Rat Dance Music', fileName: 'default-rat-dance-music.mp3' },
    { name: 'Peter Griffin', fileName: 'default-peter-griffin.mp3' },
    { name: 'Gayy Echo', fileName: 'default-gayy-echo.mp3' },
    { name: 'Fart Meme', fileName: 'default-fartmeme.mp3' },
    { name: 'Baby Laughing Meme', fileName: 'default-baby-laughing-meme.mp3' }
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

async function checkAndScheduleRoomCleanup(roomId: string) {
  // Cancel any existing cleanup timer for this room
  const existingTimer = roomCleanupTimers.get(roomId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    roomCleanupTimers.delete(roomId);
  }

  // Check if room has any active participants
  const activeParticipants = await storage.getParticipantsByRoomId(roomId);
  const hasActiveParticipants = activeParticipants.some(p => p.isActive);

  if (!hasActiveParticipants) {
    console.log(`No active participants in room ${roomId}, scheduling cleanup in 3 seconds`);
    
    // Schedule room deletion after 3 seconds
    const cleanupTimer = setTimeout(async () => {
      try {
        // Double-check that room is still empty before deleting
        const currentParticipants = await storage.getParticipantsByRoomId(roomId);
        const stillEmpty = !currentParticipants.some(p => p.isActive);
        
        if (stillEmpty) {
          console.log(`Cleaning up empty room ${roomId}`);
          await storage.deleteRoom(roomId);
          
          // Clean up any remaining data structures
          voiceParticipants.delete(roomId);
          roomCleanupTimers.delete(roomId);
          
          // Remove any dead connections for this room
          Array.from(clients.entries()).forEach(([clientId, client]) => {
            if (client.roomId === roomId) {
              clients.delete(clientId);
            }
          });
          
          console.log(`Room ${roomId} has been automatically deleted due to inactivity`);
        } else {
          console.log(`Room ${roomId} has active participants again, canceling cleanup`);
          roomCleanupTimers.delete(roomId);
        }
      } catch (error) {
        console.error(`Error during room cleanup for ${roomId}:`, error);
        roomCleanupTimers.delete(roomId);
      }
    }, 3000); // 3 seconds

    roomCleanupTimers.set(roomId, cleanupTimer);
  }
}

function cancelRoomCleanup(roomId: string) {
  const existingTimer = roomCleanupTimers.get(roomId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    roomCleanupTimers.delete(roomId);
    console.log(`Canceled cleanup timer for room ${roomId}`);
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
            
            // Cancel any pending room cleanup since someone joined
            cancelRoomCleanup(message.roomId);
            
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
              
              // Check if room should be cleaned up after participant leaves
              await checkAndScheduleRoomCleanup(message.roomId);
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
          
          // Check if room should be cleaned up after participant disconnects
          await checkAndScheduleRoomCleanup(client.roomId);
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
      const roomData = insertRoomSchema.parse(req.body);
      
      // Get host location information
      let hostLocation = {
        hostCountry: null,
        hostRegion: null,
        hostCity: null
      };
      
      try {
        // Get client IP (handling potential proxies)
        const clientIP = req.headers['x-forwarded-for'] || 
                        req.headers['x-real-ip'] || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress ||
                        (req.connection.socket ? req.connection.socket.remoteAddress : null);
        
        console.log('Client IP for room creation:', clientIP);
        
        // Only try to get location for non-local IPs
        if (clientIP && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIP.toString())) {
          const locationResponse = await fetch(`https://ipapi.co/${clientIP}/json/`);
          if (locationResponse.ok) {
            const locationData = await locationResponse.json();
            hostLocation = {
              hostCountry: locationData.country_name || null,
              hostRegion: locationData.region || null,
              hostCity: locationData.city || null
            };
            console.log('Host location detected:', hostLocation);
          }
        } else {
          console.log('Local IP detected, using default location');
          hostLocation = {
            hostCountry: "Local Network",
            hostRegion: "Replit",
            hostCity: "Development"
          };
        }
      } catch (error) {
        console.warn('Failed to get host location:', error);
        // Use default values for location
        hostLocation = {
          hostCountry: "Unknown",
          hostRegion: null,
          hostCity: null
        };
      }
      
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
      const room = await storage.createRoom({ 
        name: roomData.name, 
        code, 
        hostId: roomData.hostId,
        isPublic: roomData.isPublic || false,
        ...hostLocation
      });
      
      // Create host participant with the actual host name
      await storage.createParticipant({
        name: roomData.hostId,
        roomId: room.id,
        isHost: true,
        isActive: true
      });
      
      // Add default sounds to the new room
      await addDefaultSounds(room.id, roomData.hostId);
      
      res.json(room);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get all public rooms for server list
  app.get('/api/rooms/public', async (req, res) => {
    try {
      const publicRooms = await storage.getPublicRooms();
      // Add participant count to each room
      const roomsWithParticipantCount = await Promise.all(
        publicRooms.map(async (room) => {
          const participants = await storage.getParticipantsByRoomId(room.id);
          const activeParticipants = participants.filter(p => p.isActive);
          return {
            ...room,
            participantCount: activeParticipants.length
          };
        })
      );
      res.json(roomsWithParticipantCount);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Ping endpoint for latency measurement
  app.head('/api/ping', (req, res) => {
    res.status(200).end();
  });

  app.get('/api/ping', (req, res) => {
    res.json({ timestamp: Date.now(), status: 'ok' });
  });

  // Ping endpoint for specific rooms
  app.get('/api/rooms/:roomId/ping', async (req, res) => {
    try {
      const room = await storage.getRoomById(req.params.roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json({ 
        timestamp: Date.now(), 
        status: 'ok',
        roomId: req.params.roomId,
        location: {
          country: room.hostCountry,
          region: room.hostRegion,
          city: room.hostCity
        }
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Clean up inactive rooms
  app.delete('/api/rooms/cleanup', async (req, res) => {
    try {
      console.log('Starting manual room cleanup...');
      const allRooms = await storage.getAllRooms();
      let deletedCount = 0;
      
      for (const room of allRooms) {
        const participants = await storage.getParticipantsByRoomId(room.id);
        const hasActiveParticipants = participants.some(p => p.isActive);
        
        if (!hasActiveParticipants) {
          console.log(`Deleting inactive room: ${room.code} (${room.name})`);
          await storage.deleteRoom(room.id);
          
          // Clean up any remaining data structures
          voiceParticipants.delete(room.id);
          roomCleanupTimers.delete(room.id);
          
          // Remove any dead connections for this room
          Array.from(clients.entries()).forEach(([clientId, client]) => {
            if (client.roomId === room.id) {
              clients.delete(clientId);
            }
          });
          
          deletedCount++;
        }
      }
      
      console.log(`Manual cleanup completed: ${deletedCount} rooms deleted`);
      res.json({ message: `Cleaned up ${deletedCount} inactive rooms` });
    } catch (error) {
      console.error('Error during manual cleanup:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Delete ALL rooms (nuclear option)
  app.delete('/api/rooms/cleanup/all', async (req, res) => {
    try {
      console.log('Starting nuclear cleanup - deleting ALL rooms...');
      const allRooms = await storage.getAllRooms();
      let deletedCount = 0;
      
      for (const room of allRooms) {
        console.log(`Force deleting room: ${room.code} (${room.name})`);
        await storage.deleteRoom(room.id);
        
        // Clean up any remaining data structures
        voiceParticipants.delete(room.id);
        roomCleanupTimers.delete(room.id);
        
        // Remove any dead connections for this room
        Array.from(clients.entries()).forEach(([clientId, client]) => {
          if (client.roomId === room.id) {
            clients.delete(clientId);
          }
        });
        
        deletedCount++;
      }
      
      // Clear all remaining data structures
      clients.clear();
      voiceParticipants.clear();
      roomCleanupTimers.clear();
      
      console.log(`Nuclear cleanup completed: ${deletedCount} rooms deleted`);
      res.json({ message: `Deleted ALL ${deletedCount} rooms` });
    } catch (error) {
      console.error('Error during nuclear cleanup:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
          
          // Cancel any pending room cleanup since host returned
          cancelRoomCleanup(participantData.roomId);
          
          return res.json(updatedHost);
        }
      }
      
      const participant = await storage.createParticipant(participantData);
      
      // Cancel any pending room cleanup since someone joined
      cancelRoomCleanup(participantData.roomId);
      
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
