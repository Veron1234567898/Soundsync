import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from './use-websocket';

interface VoiceChatHook {
  isConnected: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isConnecting: boolean;
  participants: VoiceParticipant[];
  toggleMute: () => void;
  toggleDeafen: () => void;
  joinVoiceChat: (roomId: string, participantId: string) => void;
  leaveVoiceChat: () => void;
  handleVoiceMessage: (message: any) => void;
}

interface VoiceParticipant {
  participantId: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface RTCConnection {
  participantId: string;
  connection: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
}

// Global singleton voice chat state
class VoiceChatManager {
  public localStream: MediaStream | null = null;
  public connections = new Map<string, RTCConnection>();
  public currentRoom: string | null = null;
  public currentParticipant: string | null = null;
  public isConnected = false;
  public participants: VoiceParticipant[] = [];

  reset() {
    this.currentRoom = null;
    this.currentParticipant = null;
    this.isConnected = false;
    this.participants = [];
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.connections.forEach(conn => conn.connection.close());
    this.connections.clear();
  }

  log() {
    console.log('VoiceChatManager state:', {
      currentParticipant: this.currentParticipant,
      currentRoom: this.currentRoom,
      isConnected: this.isConnected,
      hasLocalStream: !!this.localStream,
      connectionCount: this.connections.size
    });
  }
}

const voiceChatManager = new VoiceChatManager();

export function useVoiceChat(): VoiceChatHook {
  const [isConnected, setIsConnected] = useState(voiceChatManager.isConnected);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>(voiceChatManager.participants);

  // Use refs that directly reference the manager
  const localStreamRef = useRef<MediaStream | null>(voiceChatManager.localStream);
  const connectionsRef = useRef<Map<string, RTCConnection>>(voiceChatManager.connections);
  const currentRoomRef = useRef<string | null>(voiceChatManager.currentRoom);
  const currentParticipantRef = useRef<string | null>(voiceChatManager.currentParticipant);
  
  // Sync state with manager and log the state
  useEffect(() => {
    console.log('Voice chat hook initialized/re-initialized.');
    voiceChatManager.log();
    
    localStreamRef.current = voiceChatManager.localStream;
    connectionsRef.current = voiceChatManager.connections;
    currentRoomRef.current = voiceChatManager.currentRoom;
    currentParticipantRef.current = voiceChatManager.currentParticipant;
    setIsConnected(voiceChatManager.isConnected);
    setParticipants(voiceChatManager.participants);
    
    console.log('Refs after sync:', {
      currentParticipant: currentParticipantRef.current,
      currentRoom: currentRoomRef.current,
      hasLocalStream: !!localStreamRef.current
    });
  }, []);

  // Update manager state whenever refs change
  useEffect(() => {
    voiceChatManager.localStream = localStreamRef.current;
    voiceChatManager.connections = connectionsRef.current;
    voiceChatManager.currentRoom = currentRoomRef.current;
    voiceChatManager.currentParticipant = currentParticipantRef.current;
  });
  
  // Create a mutable ref for the voice message handler
  const handleVoiceMessageRef = useRef<((message: any) => void) | null>(null);
  
  const { sendMessage } = useWebSocket({
    onMessage: (message) => {
      // Log all messages for debugging
      if (message.type?.startsWith('voice_')) {
        console.log('WebSocket received voice message:', message.type, message);
      }
      if (handleVoiceMessageRef.current) {
        handleVoiceMessageRef.current(message);
      }
    }
  });

  // ICE servers for WebRTC
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // Update participant mute status
  const updateParticipantMuteStatus = useCallback((participantId: string, muted: boolean) => {
    setParticipants(prev => 
      prev.map(p => 
        p.participantId === participantId 
          ? { ...p, isMuted: muted }
          : p
      )
    );
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    console.log('Received ICE candidate from:', from);
    const connection = connectionsRef.current.get(from);
    if (connection) {
      try {
        await connection.connection.addIceCandidate(candidate);
      } catch (error) {
        console.error('Failed to add ICE candidate:', error);
      }
    }
  }, []);

  // Handle WebRTC answer
  const handleAnswer = useCallback(async (from: string, answer: RTCSessionDescriptionInit) => {
    console.log('Received answer from:', from, 'SDP type:', answer.type);
    const connection = connectionsRef.current.get(from);
    if (connection) {
      try {
        await connection.connection.setRemoteDescription(answer);
        console.log('Successfully set remote description (answer) from:', from);
        console.log('Connection state with', from, ':', connection.connection.connectionState);
        console.log('ICE connection state with', from, ':', connection.connection.iceConnectionState);
      } catch (error) {
        console.error('Failed to set remote description for answer from', from, ':', error);
      }
    } else {
      console.error('No connection found for participant:', from);
    }
  }, []);

  // Create peer connection for WebRTC
  const createPeerConnection = useCallback((participantId: string): RTCPeerConnection => {
    console.log('Creating peer connection for participant:', participantId);
    const connection = new RTCPeerConnection({ iceServers });
    
    // Note: We don't add tracks here anymore to avoid duplicates
    // Tracks will be added separately in the calling function

    // Handle incoming remote stream
    connection.ontrack = (event) => {
      console.log('Received remote track from:', participantId, 'streams:', event.streams.length);
      const [remoteStream] = event.streams;
      
      if (!remoteStream) {
        console.error('No remote stream received');
        return;
      }
      
      // Create audio element to play remote audio
      const audioElement = new Audio();
      audioElement.srcObject = remoteStream;
      audioElement.autoplay = true;
      audioElement.muted = isDeafened;
      audioElement.volume = 1.0;
      audioElement.controls = false;
      // Set playsInline for mobile devices
      (audioElement as any).playsInline = true;
      
      // Store audio element reference
      const existingConnection = connectionsRef.current.get(participantId);
      if (existingConnection) {
        existingConnection.audioElement = audioElement;
      }
      
      // Play the audio with better error handling
      const playAudio = async () => {
        try {
          await audioElement.play();
          console.log('Started playing remote audio from:', participantId);
        } catch (error) {
          console.warn('Autoplay failed, will retry on user interaction:', error);
          // Add event listeners to start audio on user interaction
          const startAudio = async () => {
            try {
              await audioElement.play();
              console.log('Audio started after user interaction');
              document.removeEventListener('click', startAudio);
              document.removeEventListener('touchstart', startAudio);
            } catch (err) {
              console.error('Failed to start audio even after user interaction:', err);
            }
          };
          document.addEventListener('click', startAudio, { once: true });
          document.addEventListener('touchstart', startAudio, { once: true });
        }
      };
      
      playAudio();
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate && currentRoomRef.current && currentParticipantRef.current) {
        console.log('Sending ICE candidate to:', participantId, 'candidate type:', event.candidate.type);
        sendMessage({
          type: 'voice_ice_candidate',
          roomId: currentRoomRef.current,
          to: participantId,
          from: currentParticipantRef.current,
          candidate: event.candidate
        });
      } else if (!event.candidate) {
        console.log('ICE gathering complete for:', participantId);
      }
    };

    // Log connection state changes and handle failures
    connection.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}:`, connection.connectionState);
      
      if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
        console.warn(`Connection with ${participantId} failed/disconnected, attempting to reconnect...`);
        // Remove failed connection after a delay to allow for potential reconnection
        setTimeout(() => {
          if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
            handleParticipantLeft(participantId);
          }
        }, 5000);
      }
    };

    // Handle ICE connection state changes
    connection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${participantId}:`, connection.iceConnectionState);
    };

    return connection;
  }, [sendMessage, isDeafened]);

  // Handle WebRTC offer
  const handleOffer = useCallback(async (from: string, offer: RTCSessionDescriptionInit) => {
    console.log('Received offer from:', from);
    
    // Clean up any existing connection for this participant
    if (connectionsRef.current.has(from)) {
      const existingConnection = connectionsRef.current.get(from);
      if (existingConnection) {
        existingConnection.connection.close();
        if (existingConnection.audioElement) {
          existingConnection.audioElement.pause();
          existingConnection.audioElement.srcObject = null;
        }
      }
    }
    
    const connection = createPeerConnection(from);
    connectionsRef.current.set(from, { participantId: from, connection });

    try {
      // Add local tracks if available (must be done before creating answer)
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          console.log('Adding local track to answer connection for:', from, 'track:', track.kind);
          connection.addTrack(track, localStreamRef.current!);
        });
      }
      
      await connection.setRemoteDescription(offer);
      console.log('Set remote description (offer) from:', from);
      
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      
      console.log('Created answer for:', from, 'SDP type:', answer.type);
      console.log('Sending answer to:', from, 'from:', currentParticipantRef.current);
      
      sendMessage({
        type: 'voice_answer',
        roomId: currentRoomRef.current,
        to: from,
        from: currentParticipantRef.current,
        answer
      });
      
      console.log('Voice answer sent successfully to:', from);

      setParticipants(prev => {
        if (!prev.find(p => p.participantId === from)) {
          return [...prev, { participantId: from, isMuted: false, isSpeaking: false }];
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to handle offer:', error);
      // Clean up failed connection
      connectionsRef.current.delete(from);
    }
  }, [createPeerConnection, sendMessage]);

  // Handle new participant joining voice chat
  const handleParticipantJoined = useCallback(async (participantId: string) => {
    if (participantId === currentParticipantRef.current) return;
    
    console.log('Handling voice participant joined:', participantId, 'current:', currentParticipantRef.current);
    
    // Don't create duplicate connections
    if (connectionsRef.current.has(participantId)) {
      console.log('Connection already exists for participant:', participantId);
      return;
    }
    
    // Check if we have a local stream first
    if (!localStreamRef.current) {
      console.log('Local stream not available:', {
        hasStream: !!localStreamRef.current,
        managerStream: !!voiceChatManager.localStream,
        isConnected: voiceChatManager.isConnected
      });
      return;
    }
    
    console.log('Local stream available:', !!localStreamRef.current);
    console.log('Current connections:', Array.from(connectionsRef.current.keys()));
    
    try {
      console.log('Creating offer for new participant:', participantId);
      
      const connection = createPeerConnection(participantId);
      connectionsRef.current.set(participantId, { participantId, connection });

      // Wait for the connection to be ready and ensure local stream is still available
      if (!localStreamRef.current) {
        throw new Error('Local stream became unavailable during connection setup');
      }

      const tracks = localStreamRef.current.getTracks();
      console.log('Adding', tracks.length, 'tracks for new participant:', participantId);
      tracks.forEach((track, index) => {
        console.log(`Adding track ${index} (${track.kind}) to connection for participant:`, participantId);
        connection.addTrack(track, localStreamRef.current!);
      });

      // Wait for tracks to be added before creating offer
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check connection state before creating offer
      if (connection.connectionState === 'closed' || connection.connectionState === 'failed') {
        throw new Error(`Connection is in ${connection.connectionState} state`);
      }

      console.log('Creating offer with connection state:', connection.connectionState, connection.iceConnectionState);
      
      const offer = await connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      console.log('Offer created successfully, setting local description...');
      await connection.setLocalDescription(offer);
      console.log('Local description set successfully');
      
      console.log('Created offer for:', participantId, 'SDP type:', offer.type);
      console.log('Sending offer to:', participantId, 'from:', currentParticipantRef.current);
      
      if (!currentRoomRef.current || !currentParticipantRef.current) {
        throw new Error('Room or participant ID not available');
      }
      
      sendMessage({
        type: 'voice_offer',
        roomId: currentRoomRef.current,
        to: participantId,
        from: currentParticipantRef.current,
        offer
      });
      
      console.log('Voice offer sent successfully to:', participantId);

      setParticipants(prev => {
        if (!prev.find(p => p.participantId === participantId)) {
          return [...prev, { participantId, isMuted: false, isSpeaking: false }];
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to create offer for participant:', participantId);
      console.error('Error details:', error);
      console.error('Connection state:', connectionsRef.current.get(participantId)?.connection?.connectionState || 'no connection');
      console.error('Local stream state:', {
        hasStream: !!localStreamRef.current,
        trackCount: localStreamRef.current?.getTracks().length || 0,
        tracks: localStreamRef.current?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })) || []
      });
      // Clean up failed connection
      connectionsRef.current.delete(participantId);
    }
  }, [createPeerConnection, sendMessage]);

  // Handle participant leaving voice chat
  const handleParticipantLeft = useCallback((participantId: string) => {
    console.log('Participant left voice chat:', participantId);
    const connection = connectionsRef.current.get(participantId);
    if (connection) {
      connection.connection.close();
      if (connection.audioElement) {
        connection.audioElement.pause();
        connection.audioElement.srcObject = null;
      }
      connectionsRef.current.delete(participantId);
    }
    
    setParticipants(prev => prev.filter(p => p.participantId !== participantId));
  }, []);

  // Create a stable message handler using refs to avoid closure issues
  const handleVoiceMessageStable = useCallback((message: any) => {
    // Log all message types for debugging
    if (message.type?.startsWith('voice_')) {
      console.log('Voice message received:', message.type, message);
    }
    
    if (!message.type?.startsWith('voice_')) return;
    
    // Always sync refs with manager before processing
    currentParticipantRef.current = voiceChatManager.currentParticipant;
    currentRoomRef.current = voiceChatManager.currentRoom;
    localStreamRef.current = voiceChatManager.localStream;
    
    console.log('Processing voice message, current state:', {
      participantId: currentParticipantRef.current,
      roomId: currentRoomRef.current,
      hasLocalStream: !!localStreamRef.current,
      messageType: message.type,
      managerState: {
        participant: voiceChatManager.currentParticipant,
        room: voiceChatManager.currentRoom,
        connected: voiceChatManager.isConnected
      }
    });
    
    switch (message.type) {
      case 'voice_join_confirmed':
        console.log('Voice join confirmed for participant:', message.participantId);
        // This confirms that the server has registered our voice chat participation
        break;
      case 'voice_participant_joined':
        console.log('Handling voice participant joined:', message.participantId, 'current:', currentParticipantRef.current);
        console.log('Local stream available:', !!localStreamRef.current);
        console.log('Current connections:', Array.from(connectionsRef.current.keys()));
        
        // Check if we're the one who should create an offer (already connected + have local stream + different participant)
        if (message.participantId !== currentParticipantRef.current && 
            currentParticipantRef.current !== null && 
            localStreamRef.current) {
          console.log('Creating offer for new participant:', message.participantId);
          handleParticipantJoined(message.participantId).catch(console.error);
        } else if (message.participantId === currentParticipantRef.current) {
          console.log('Ignoring voice_participant_joined for self');
        } else if (currentParticipantRef.current === null) {
          console.log('Not connected to voice chat (current participant is null), ignoring participant joined');
        } else if (!localStreamRef.current) {
          console.log('No local stream available, cannot create offer');
        }
        break;
      case 'voice_participant_left':
        handleParticipantLeft(message.participantId);
        break;
      case 'voice_offer':
        if (message.to === currentParticipantRef.current) {
          handleOffer(message.from, message.offer).catch(console.error);
        }
        break;
      case 'voice_answer':
        if (message.to === currentParticipantRef.current) {
          handleAnswer(message.from, message.answer).catch(console.error);
        }
        break;
      case 'voice_ice_candidate':
        if (message.to === currentParticipantRef.current) {
          handleIceCandidate(message.from, message.candidate).catch(console.error);
        }
        break;
      case 'voice_participant_muted':
        updateParticipantMuteStatus(message.participantId, message.isMuted);
        break;
    }
  }, []);

  // Wrapper for backward compatibility
  const handleVoiceMessage = handleVoiceMessageStable;

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioTrack = audioTracks[0];
        const newMutedState = !audioTrack.enabled;
        audioTrack.enabled = !newMutedState;
        setIsMuted(newMutedState);
        
        console.log('Toggled mute:', newMutedState ? 'MUTED' : 'UNMUTED');
        
        // Notify other participants
        if (currentRoomRef.current && currentParticipantRef.current) {
          sendMessage({
            type: 'voice_participant_muted',
            roomId: currentRoomRef.current,
            participantId: currentParticipantRef.current,
            isMuted: newMutedState
          });
        }
      } else {
        console.warn('No audio tracks available to mute/unmute');
      }
    } else {
      console.warn('No local stream available for mute/unmute');
    }
  }, [sendMessage]);

  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    setIsDeafened(prev => {
      const newDeafened = !prev;
      
      // Update all remote audio elements
      connectionsRef.current.forEach(connection => {
        if (connection.audioElement) {
          connection.audioElement.muted = newDeafened;
        }
      });
      
      return newDeafened;
    });
  }, []);

  // Join voice chat with real WebRTC
  const joinVoiceChat = useCallback(async (roomId: string, participantId: string) => {
    if (isConnecting || isConnected) return;
    
    console.log('Joining voice chat for room:', roomId, 'participant:', participantId);
    setIsConnecting(true);
    currentRoomRef.current = roomId;
    currentParticipantRef.current = participantId;
    
    // Sync with manager
    voiceChatManager.currentRoom = roomId;
    voiceChatManager.currentParticipant = participantId;

    try {
      // Get user media with optimized audio settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000, min: 8000 },
          channelCount: { ideal: 1 }
        }
      });
      
      console.log('Got microphone access, audio tracks:', stream.getAudioTracks().length);
      
      // Verify we actually have audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in media stream');
      }
      
      // Log audio track details
      audioTracks.forEach((track, index) => {
        console.log(`Audio track ${index}:`, {
          id: track.id,
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings()
        });
      });
      
      localStreamRef.current = stream;
      voiceChatManager.localStream = stream;
      
      // Add a small delay to ensure WebSocket connection is stable
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Notify server that we joined voice chat
      sendMessage({
        type: 'voice_join',
        roomId,
        participantId
      });
      
      setIsConnected(true);
      setIsConnecting(false);
      voiceChatManager.isConnected = true;
      console.log('Voice chat connected successfully with', audioTracks.length, 'audio tracks');
      console.log('Current participant ID set to:', currentParticipantRef.current);
      console.log('Current room ID set to:', currentRoomRef.current);
    } catch (error) {
      console.error('Failed to access microphone:', error);
      setIsConnecting(false);
      
      // Reset refs on failure
      currentRoomRef.current = null;
      currentParticipantRef.current = null;
      voiceChatManager.currentRoom = null;
      voiceChatManager.currentParticipant = null;
      
      // Provide specific error messages based on error type
      let errorMessage = 'Could not access your microphone. Please check your browser permissions and try again.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings and try again.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Your browser does not support voice chat. Please use a modern browser like Chrome, Firefox, or Safari.';
        } else if (error.message.includes('audio tracks')) {
          errorMessage = 'Microphone access failed. Your audio device may be in use by another application.';
        }
      }
      alert(errorMessage);
    }
  }, [isConnecting, isConnected, sendMessage]);

  // Leave voice chat
  const leaveVoiceChat = useCallback(() => {
    console.log('Leaving voice chat');
    
    // Close all peer connections
    connectionsRef.current.forEach(connection => {
      connection.connection.close();
      if (connection.audioElement) {
        connection.audioElement.pause();
        connection.audioElement.srcObject = null;
      }
    });
    connectionsRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped audio track');
      });
      localStreamRef.current = null;
      voiceChatManager.localStream = null;
    }

    // Notify server
    if (currentRoomRef.current) {
      sendMessage({
        type: 'voice_leave',
        roomId: currentRoomRef.current,
        participantId: currentParticipantRef.current
      });
    }

    setIsConnected(false);
    setParticipants([]);
    currentRoomRef.current = null;
    currentParticipantRef.current = null;
    
    // Sync with manager
    voiceChatManager.isConnected = false;
    voiceChatManager.currentRoom = null;
    voiceChatManager.currentParticipant = null;
  }, [sendMessage]);

  // Set up the voice message handler ref - with stable functions
  useEffect(() => {
    handleVoiceMessageRef.current = (message: any) => {
      handleVoiceMessage(message);
    };
  });

  // Debugging effect to track state changes
  useEffect(() => {
    console.log('Voice chat state changed:', {
      isConnected,
      currentParticipant: currentParticipantRef.current,
      currentRoom: currentRoomRef.current,
      hasLocalStream: !!localStreamRef.current,
      participantCount: participants.length
    });
  }, [isConnected, participants.length]);

  return {
    isConnected,
    isMuted,
    isDeafened,
    isConnecting,
    participants,
    toggleMute,
    toggleDeafen,
    joinVoiceChat,
    leaveVoiceChat,
    handleVoiceMessage
  };
}