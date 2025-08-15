import { Volume2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Sound } from "@shared/schema";

interface NowPlayingProps {
  currentSound: { sound: Sound; player: string; progress: number } | null;
}

export default function NowPlaying({ currentSound }: NowPlayingProps) {
  if (!currentSound) {
    return (
      <Card className="bg-discord-card border-gray-600">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <Volume2 className="mr-3 text-gray-400" />
            Now Playing
          </h3>
          <div className="bg-discord-bg rounded-lg p-4 text-center">
            <p className="text-gray-400">No sounds playing</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-discord-card border-gray-600">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Volume2 className="mr-3 text-discord-green" />
          Now Playing
        </h3>
        <div className="bg-discord-bg rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">{currentSound.sound.name}</span>
            <span className="text-sm text-gray-400">
              Played by <span className="text-discord-accent">{currentSound.player}</span>
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-discord-purple h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(currentSound.progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{((currentSound.sound.duration * currentSound.progress / 100) / 1000).toFixed(1)}s</span>
            <span>{(currentSound.sound.duration / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
