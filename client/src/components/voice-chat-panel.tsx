import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Badge component not yet implemented, using simple span
import { Mic, MicOff, Headphones, HeadphonesIcon, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { cn } from "@/lib/utils";

interface VoiceChatPanelProps {
  roomId: string;
  participantId: string;
  isHost: boolean;
}

export function VoiceChatPanel({ roomId, participantId, isHost }: VoiceChatPanelProps) {
  const {
    isConnected,
    isMuted,
    isDeafened,
    isConnecting,
    participants,
    voiceParticipantCount,
    toggleMute,
    toggleDeafen,
    joinVoiceChat,
    leaveVoiceChat
  } = useVoiceChat();

  const handleToggleVoiceChat = () => {
    if (isConnected) {
      leaveVoiceChat();
    } else {
      joinVoiceChat(roomId, participantId);
    }
  };

  return (
    <Card className="bg-discord-card border-gray-600">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center text-gray-300">
            <Volume2 className="w-4 h-4 mr-2" />
            Voice Chat
          </span>
          <span className={`px-2 py-1 rounded text-xs ${
            voiceParticipantCount > 0 ? "bg-discord-green text-black" : "bg-gray-600 text-gray-300"
          }`}>
            {voiceParticipantCount} connected
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connection Controls */}
        <div className="flex gap-2">
          <Button
            onClick={handleToggleVoiceChat}
            disabled={isConnecting}
            className={cn(
              "flex-1",
              isConnected
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-discord-green hover:bg-green-600 text-black"
            )}
            size="sm"
          >
            {isConnecting ? (
              "Connecting..."
            ) : isConnected ? (
              <>
                <PhoneOff className="w-4 h-4 mr-2" />
                Leave
              </>
            ) : (
              <>
                <Phone className="w-4 h-4 mr-2" />
                Join Voice
              </>
            )}
          </Button>
        </div>

        {/* Voice Controls */}
        {isConnected && (
          <div className="flex gap-2">
            <Button
              onClick={toggleMute}
              variant="outline"
              size="sm"
              className={cn(
                "flex-1 border-gray-600",
                isMuted
                  ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                  : "bg-transparent hover:bg-gray-700 text-gray-300"
              )}
            >
              {isMuted ? (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  Muted
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Mic
                </>
              )}
            </Button>

            <Button
              onClick={toggleDeafen}
              variant="outline"
              size="sm"
              className={cn(
                "flex-1 border-gray-600",
                isDeafened
                  ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                  : "bg-transparent hover:bg-gray-700 text-gray-300"
              )}
            >
              {isDeafened ? (
                <>
                  <VolumeX className="w-4 h-4 mr-2" />
                  Deafened
                </>
              ) : (
                <>
                  <Headphones className="w-4 h-4 mr-2" />
                  Audio
                </>
              )}
            </Button>
          </div>
        )}

        {/* Participants List */}
        {isConnected && participants.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              In Voice ({participants.length})
            </h4>
            <div className="space-y-1">
              {participants.map((participant) => (
                <div
                  key={participant.participantId}
                  className="flex items-center justify-between p-2 rounded bg-discord-bg"
                >
                  <span className="text-sm text-gray-300 flex items-center">
                    {participant.isSpeaking && (
                      <Mic className="w-6 h-6 mr-2 text-discord-green animate-pulse" />
                    )}
                    Participant {participant.participantId.slice(-4)}
                  </span>
                  <div className="flex items-center space-x-1">
                    {participant.isMuted && (
                      <MicOff className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connection Status */}
        {!isConnected && !isConnecting && (
          <p className="text-xs text-gray-400 text-center">
            Join voice chat to talk with other participants
          </p>
        )}
      </CardContent>
    </Card>
  );
}