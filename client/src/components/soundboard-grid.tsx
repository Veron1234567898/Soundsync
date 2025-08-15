import { Play, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Sound } from "@shared/schema";

interface SoundboardGridProps {
  sounds: Sound[];
  isLoading: boolean;
  onPlaySound: (sound: Sound) => void;
}

const solidColorClasses = [
  "sound-button-purple",
  "sound-button-green", 
  "sound-button-red",
  "sound-button-yellow",
  "sound-button-indigo",
  "sound-button-pink",
  "sound-button-teal",
  "sound-button-orange",
];

const gradientColorClasses = [
  "sound-button-purple-gradient",
  "sound-button-green-gradient", 
  "sound-button-red-gradient",
  "sound-button-yellow-gradient",
  "sound-button-indigo-gradient",
  "sound-button-pink-gradient",
  "sound-button-teal-gradient",
  "sound-button-orange-gradient",
];

export default function SoundboardGrid({ sounds, isLoading, onPlaySound }: SoundboardGridProps) {
  if (isLoading) {
    return (
      <Card className="bg-discord-card border-gray-600">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-6 flex items-center">
            <Music className="mr-3 text-discord-purple" />
            Soundboard
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-600 p-4 rounded-lg animate-pulse h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-discord-card border-gray-600">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center">
          <Music className="mr-3 text-discord-purple" />
          Soundboard
        </h3>
        
        {sounds.length === 0 ? (
          <div className="text-center py-12">
            <Music className="mx-auto h-12 w-12 text-gray-500 mb-4" />
            <p className="text-gray-400 mb-2">No sounds uploaded yet</p>
            <p className="text-sm text-gray-500">Upload your first sound to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sounds.map((sound, index) => {
              // Check if this is a default sound by looking at the fileName
              const isDefaultSound = sound.fileName?.startsWith('default-');
              const colorClasses = isDefaultSound ? solidColorClasses : gradientColorClasses;
              const colorClass = colorClasses[index % colorClasses.length];
              const isGreenOrYellow = colorClass.includes('green') || colorClass.includes('yellow');
              
              return (
                <Button
                  key={sound.id}
                  onClick={() => onPlaySound(sound)}
                  className={`${colorClass} p-4 rounded-lg transition-all duration-200 hover:scale-105 shadow-md group h-auto flex flex-col`}
                >
                  <Play className={`text-2xl mb-2 group-hover:text-discord-accent transition-colors ${isGreenOrYellow ? 'text-black group-hover:text-discord-accent' : 'text-white'}`} />
                  <p className={`text-sm font-medium mb-1 ${isGreenOrYellow ? 'text-black' : 'text-white'}`}>
                    {sound.name}
                  </p>
                  <p className={`text-xs ${isGreenOrYellow ? 'text-gray-800' : 'text-gray-300'}`}>
                    {(sound.duration / 1000).toFixed(1)}s
                  </p>
                </Button>
              );
            })}
          </div>
        )}

        {/* Upload Zone */}
        <div className="mt-8 border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-discord-purple transition-colors duration-200">
          <Music className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <p className="text-gray-300 mb-2">Drag & drop audio files here or</p>
          <button className="text-discord-purple hover:text-purple-400 font-medium">Browse Files</button>
          <p className="text-xs text-gray-500 mt-2">Supports MP3, WAV (Max 10MB)</p>
        </div>
      </CardContent>
    </Card>
  );
}
