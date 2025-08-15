import { Users, Link, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Participant } from "@shared/schema";

interface RoomParticipantsProps {
  participants: Participant[];
  currentParticipantId?: string;
  onInvite: () => void;
}

const avatarColors = [
  'bg-discord-purple',
  'bg-green-600',
  'bg-red-600', 
  'bg-yellow-600',
  'bg-indigo-600',
  'bg-pink-600',
  'bg-teal-600',
  'bg-orange-600',
];

export default function RoomParticipants({ participants, currentParticipantId, onInvite }: RoomParticipantsProps) {
  return (
    <Card className="bg-discord-card border-gray-600">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center">
          <Users className="mr-3 text-discord-accent" />
          Participants 
          <span className="ml-auto text-sm bg-discord-purple px-2 py-1 rounded">
            {participants.length}
          </span>
        </h3>
        
        <div className="space-y-3">
          {participants.map((participant, index) => {
            const isCurrentUser = participant.id === currentParticipantId;
            const avatarColor = avatarColors[index % avatarColors.length];
            
            return (
              <div key={participant.id} className="flex items-center p-3 bg-discord-bg rounded-lg">
                <div className={`w-10 h-10 ${avatarColor} rounded-full flex items-center justify-center mr-3`}>
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{participant.name}</p>
                  <p className="text-xs text-discord-accent">
                    {isCurrentUser ? 'You' : participant.isHost ? 'Host' : 'Guest'}
                  </p>
                </div>
                <div className="flex items-center">
                  <div className={`w-2 h-2 ${participant.isActive ? 'bg-discord-green animate-pulse' : 'bg-gray-500'} rounded-full`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Invite Button */}
        <Button
          onClick={onInvite}
          className="w-full mt-6 bg-discord-purple hover:bg-purple-600 text-white font-medium"
        >
          <Link className="mr-2 h-4 w-4" />
          Invite Friends
        </Button>
      </CardContent>
    </Card>
  );
}
