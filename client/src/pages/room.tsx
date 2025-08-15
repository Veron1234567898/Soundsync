import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Volume2, Upload, LogOut, Link, Settings } from "lucide-react";
import SoundboardGrid from "@/components/soundboard-grid";
import RoomParticipants from "@/components/room-participants";
import NowPlaying from "@/components/now-playing";
import UploadModal from "@/components/upload-modal";
import { VoiceChatPanel } from "@/components/voice-chat-panel";
import { useWebSocket } from "@/hooks/use-websocket";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import type { Room, Participant, Sound } from "@shared/schema";

export default function RoomPage() {
  const { roomCode } = useParams();
  const [, setLocation] = useLocation();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [currentSound, setCurrentSound] = useState<{ sound: Sound; player: string; progress: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch room data
  const { data: room, isLoading: roomLoading } = useQuery<Room>({
    queryKey: ['/api/rooms', roomCode],
    enabled: !!roomCode,
  });

  // Fetch sounds
  const { data: sounds = [], isLoading: soundsLoading } = useQuery<Sound[]>({
    queryKey: ['/api/rooms', room?.id, 'sounds'],
    enabled: !!room?.id,
  });

  // Fetch participants
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ['/api/rooms', room?.id, 'participants'],
    enabled: !!room?.id,
  });

  // Join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: async (data: { name: string; roomId: string; isHost: boolean; isActive: boolean }) => {
      const response = await apiRequest("POST", "/api/participants", data);
      return response.json();
    },
    onSuccess: (participant) => {
      setCurrentParticipant(participant);
      queryClient.invalidateQueries({ queryKey: ['/api/rooms', room?.id, 'participants'] });
    },
  });

  const voiceChat = useVoiceChat();

  // WebSocket connection
  const handleWebSocketMessage = useCallback((message: any) => {
    console.log('Received WebSocket message:', message.type, message);

    // Pass voice messages to the voice chat hook
    if (message.type?.startsWith('voice_')) {
      voiceChat.handleVoiceMessage(message);
    }

    switch (message.type) {
      case 'join_confirmed':
        console.log('Room join confirmed for participant:', message.participantId);
        break;

      case 'participant_joined':
        console.log('PARTICIPANT JOINED WebSocket message received!', message);
        queryClient.invalidateQueries({ queryKey: ['/api/rooms', room?.id, 'participants'] });
        break;

      case 'participant_left':
        console.log('PARTICIPANT LEFT WebSocket message received!', message);
        queryClient.invalidateQueries({ queryKey: ['/api/rooms', room?.id, 'participants'] });
        break;

      case 'sound_played':
        const sound = sounds?.find(s => s.id === message.soundId);
        const participant = participants?.find(p => p.id === message.participantId);

        console.log('Sound played message:', { sound, participant, sounds: sounds?.length, participants: participants?.length });

        if (sound && participant) {
          console.log('Playing sound:', sound.name, 'by', participant.name);
          setCurrentSound({ sound, player: participant.name, progress: 0 });

          // Play audio with better error handling
          const audio = new Audio(`/api/sounds/${sound.id}/audio`);
          audio.play().catch((error) => {
            console.error('Failed to play audio:', error);
            toast({
              title: "Audio Playback Failed",
              description: `Could not play ${sound.name}. The file may be corrupted or in an unsupported format.`,
              variant: "destructive",
            });
          });

          // Simulate progress
          let progress = 0;
          const interval = setInterval(() => {
            progress += 100 / (sound.duration / 100);
            setCurrentSound(prev => prev ? { ...prev, progress } : null);
            if (progress >= 100) {
              clearInterval(interval);
              setTimeout(() => setCurrentSound(null), 500);
            }
          }, 100);
        } else {
          console.log('Sound or participant not found:', { soundId: message.soundId, participantId: message.participantId });
        }
        break;

      case 'sound_uploaded':
        console.log('Received sound upload notification:', message.sound);
        queryClient.invalidateQueries({ queryKey: ['/api/rooms', room?.id, 'sounds'] });
        toast({
          title: "New Sound Added",
          description: `${message.sound.name} was uploaded`,
        });
        break;
    }
  }, [voiceChat, queryClient, room?.id, sounds, participants, toast]);

  const { sendMessage } = useWebSocket({
    onMessage: handleWebSocketMessage,
  });

  // Also listen for global WebSocket events to catch any missed messages
  useEffect(() => {
    const handleGlobalWebSocketMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        handleWebSocketMessage(customEvent.detail);
      }
    };

    window.addEventListener('websocket-message', handleGlobalWebSocketMessage);

    return () => {
      window.removeEventListener('websocket-message', handleGlobalWebSocketMessage);
    };
  }, [handleWebSocketMessage]);

  // Join room on mount
  useEffect(() => {
    if (room && !currentParticipant) {
      const participantName = localStorage.getItem("participantName") || "Guest";
      joinRoomMutation.mutate({
        name: participantName,
        roomId: room.id,
        isHost: false,
        isActive: true,
      });
    }
  }, [room, currentParticipant]);

  // Send join message via WebSocket - only once per participant/room combo
  useEffect(() => {
    if (currentParticipant && room) {
      const joinMessage = {
        type: 'join_room',
        participantId: currentParticipant.id,
        roomId: room.id,
      };

      // Send join message once
      sendMessage(joinMessage);

      // Send leave message when component unmounts or participant changes
      const handleBeforeUnload = () => {
        sendMessage({
          type: 'leave_room',
          participantId: currentParticipant.id,
          roomId: room.id,
        });
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        handleBeforeUnload();
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [currentParticipant?.id, room?.id, sendMessage]);

  const handlePlaySound = (sound: Sound) => {
    if (currentParticipant && room) {
      sendMessage({
        type: 'play_sound',
        soundId: sound.id,
        participantId: currentParticipant.id,
        roomId: room.id,
      });

      // Play locally immediately for better UX
      setCurrentSound({ sound, player: currentParticipant.name, progress: 0 });
      const audio = new Audio(`/api/sounds/${sound.id}/audio`);
      audio.play().catch(console.error);
    }
  };

  const handleLeaveRoom = () => {
    if (currentParticipant && room) {
      sendMessage({
        type: 'leave_room',
        participantId: currentParticipant.id,
        roomId: room.id,
      });
    }
    setLocation("/");
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast({
        title: "Room Code Copied",
        description: `Room code ${roomCode} copied to clipboard`,
      });
    }
  };

  if (roomLoading) {
    return (
      <div className="min-h-screen bg-discord-bg text-white flex items-center justify-center">
        <div className="text-center">
          <Volume2 className="mx-auto mb-4 h-12 w-12 animate-pulse text-discord-purple" />
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-discord-bg text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Room not found</p>
          <Button onClick={() => setLocation("/")} className="bg-discord-purple hover:bg-purple-600">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-discord-bg text-white">
      {/* Navigation */}
      <nav className="bg-discord-card shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Volume2 className="text-discord-purple text-2xl mr-3" />
              <h1 className="text-xl font-bold">SoundSync</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">
                {currentParticipant?.name || "Guest"}
              </span>
              <div className="w-8 h-8 bg-discord-purple rounded-full flex items-center justify-center">
                <Volume2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Room Header */}
        <div className="bg-discord-card rounded-lg p-6 mb-8 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h2 className="text-2xl font-bold mb-2">
                Room: <span className="text-discord-accent">{room.name}</span>
              </h2>
              <p className="text-gray-300">
                Room Code: <span className="bg-discord-purple px-3 py-1 rounded text-sm font-mono">{room.code}</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setUploadModalOpen(true)}
                className="bg-discord-green hover:bg-green-600 text-black font-medium"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Sound
              </Button>
              <Button
                onClick={handleLeaveRoom}
                variant="destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Leave Room
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Soundboard */}
          <div className="lg:col-span-3 space-y-6">
            <SoundboardGrid
              sounds={sounds}
              isLoading={soundsLoading}
              onPlaySound={handlePlaySound}
            />
            <NowPlaying currentSound={currentSound} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <RoomParticipants
              participants={participants || []}
              currentParticipantId={currentParticipant?.id}
              onInvite={() => setShowInviteDialog(true)}
              voiceParticipants={voiceChat.participants}
            />

            {/* Voice Chat */}
            {currentParticipant && room && (
              <VoiceChatPanel
                roomId={room.id}
                participantId={currentParticipant.id}
                isHost={currentParticipant.isHost}
              />
            )}

            {/* Room Settings */}
            <div className="bg-discord-card rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <Settings className="mr-3 text-gray-400" />
                Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Master Volume</span>
                  <input type="range" className="w-20" min="0" max="100" defaultValue="75" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sound Overlap</span>
                  <button className="bg-discord-green text-black px-3 py-1 rounded text-xs font-medium">ON</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        roomId={room.id}
        participantId={currentParticipant?.id || ""}
        onUploadSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/rooms', room.id, 'sounds'] });
        }}
      />
    </div>
  );
}