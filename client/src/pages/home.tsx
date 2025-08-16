import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Volume2, Users, Plus, Globe, Lock, RefreshCw } from "lucide-react";
import type { Room } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [userName, setUserName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const { toast } = useToast();

  // Query for public rooms
  const { data: publicRooms = [], refetch: refetchPublicRooms, isRefetching } = useQuery({
    queryKey: ['/api/rooms/public'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/rooms/public");
      return response.json();
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; hostId: string; isPublic: boolean }) => {
      const response = await apiRequest("POST", "/api/rooms", data);
      return response.json();
    },
    onSuccess: (room) => {
      localStorage.setItem("participantName", userName || "Host");
      // Refetch public rooms if we created a public room
      if (isPublic) {
        refetchPublicRooms();
      }
      setLocation(`/room/${room.code}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create room",
        variant: "destructive",
      });
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("GET", `/api/rooms/${code}`);
      return response.json();
    },
    onSuccess: (room) => {
      localStorage.setItem("participantName", userName || "Guest");
      setLocation(`/room/${room.code}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Room not found",
        variant: "destructive",
      });
    },
  });

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name",
        variant: "destructive",
      });
      return;
    }

    const hostId = userName || "Host";
    createRoomMutation.mutate({ name: roomName, hostId, isPublic });
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room code",
        variant: "destructive",
      });
      return;
    }

    joinRoomMutation.mutate(joinCode.toUpperCase());
  };

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
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            Welcome to <span className="text-discord-purple">SoundSync</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Create or join a multiplayer soundboard room and share audio experiences in real-time with friends!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Create Room */}
          <Card className="bg-discord-card border-gray-600">
            <CardHeader>
              <CardTitle className="flex items-center text-discord-green">
                <Plus className="mr-2" />
                Create New Room
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="roomName" className="text-gray-300">Room Name</Label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Epic Gaming Session"
                  className="bg-discord-bg border-gray-600 text-white focus:border-discord-purple mt-1"
                />
              </div>
              <div>
                <Label htmlFor="hostName" className="text-gray-300">Your Name</Label>
                <Input
                  id="hostName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="DJ_Host123"
                  className="bg-discord-bg border-gray-600 text-white focus:border-discord-purple mt-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isPublic ? (
                    <Globe className="h-4 w-4 text-discord-green" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-400" />
                  )}
                  <Label htmlFor="isPublic" className="text-gray-300">
                    {isPublic ? "Public Room" : "Private Room"}
                  </Label>
                </div>
                <Switch
                  id="isPublic"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  data-testid="switch-room-visibility"
                />
              </div>
              {isPublic && (
                <p className="text-sm text-gray-400">
                  Your room will appear in the public server list for others to discover and join.
                </p>
              )}
              <Button
                onClick={handleCreateRoom}
                disabled={createRoomMutation.isPending || !roomName.trim()}
                className="w-full bg-discord-green hover:bg-green-600 text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createRoomMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  "Create Room"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Join Room */}
          <Card className="bg-discord-card border-gray-600">
            <CardHeader>
              <CardTitle className="flex items-center text-discord-purple">
                <Users className="mr-2" />
                Join Existing Room
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="joinCode" className="text-gray-300">Room Code</Label>
                <Input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="bg-discord-bg border-gray-600 text-white focus:border-discord-purple mt-1 text-center font-mono text-lg"
                />
              </div>
              <div>
                <Label htmlFor="guestName" className="text-gray-300">Your Name</Label>
                <Input
                  id="guestName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Guest_Player"
                  className="bg-discord-bg border-gray-600 text-white focus:border-discord-purple mt-1"
                />
              </div>
              <Button
                onClick={handleJoinRoom}
                disabled={joinRoomMutation.isPending || !joinCode.trim()}
                className="w-full bg-discord-purple hover:bg-purple-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joinRoomMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Joining...
                  </div>
                ) : (
                  "Join Room"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Public Server List */}
        <div className="mt-12">
          <Card className="bg-discord-card border-gray-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-discord-green">
                  <Globe className="mr-2" />
                  Public Servers ({publicRooms.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchPublicRooms()}
                  disabled={isRefetching}
                  className="border-discord-green text-discord-green hover:bg-discord-green hover:text-black disabled:opacity-50"
                  data-testid="button-refresh-servers"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {publicRooms.length > 0 ? (
                <div className="grid gap-3">
                  {publicRooms.map((room: Room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between p-3 bg-discord-bg rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                      onClick={() => {
                        localStorage.setItem("participantName", userName || "Guest");
                        setLocation(`/room/${room.code}`);
                      }}
                      data-testid={`card-public-room-${room.code}`}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-discord-purple rounded-lg flex items-center justify-center mr-3">
                          <Volume2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{room.name}</h3>
                          <p className="text-sm text-gray-400">Code: {room.code} • Host: {room.hostId}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-400">{room.participantCount || 0}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-discord-green text-discord-green hover:bg-discord-green hover:text-black"
                          data-testid={`button-join-${room.code}`}
                        >
                          Join
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No Public Servers</h3>
                  <p className="text-sm text-gray-400">
                    No public rooms are currently available. Create a public room to get started!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-discord-card rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Volume2 className="text-discord-purple text-2xl" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Real-time Audio</h3>
            <p className="text-gray-400">Play sounds that all participants hear instantly</p>
          </div>
          <div className="text-center">
            <div className="bg-discord-card rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Plus className="text-discord-green text-2xl" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Custom Sounds</h3>
            <p className="text-gray-400">Upload your own MP3 and WAV files</p>
          </div>
          <div className="text-center">
            <div className="bg-discord-card rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Users className="text-discord-accent text-2xl" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Multiplayer Fun</h3>
            <p className="text-gray-400">Share rooms with friends using simple codes</p>
          </div>
        </div>
      </div>
    </div>
  );
}