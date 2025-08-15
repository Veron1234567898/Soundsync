import { useState } from "react";
import { X, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  participantId: string;
  onUploadSuccess: () => void;
}

export default function UploadModal({ open, onClose, roomId, participantId, onUploadSuccess }: UploadModalProps) {
  const [soundName, setSoundName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: { name: string; roomId: string; uploadedBy: string; audio: File }) => {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('roomId', data.roomId);
      formData.append('uploadedBy', data.uploadedBy);
      formData.append('audio', data.audio);

      const response = await fetch('/api/sounds', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sound uploaded successfully",
      });
      onUploadSuccess();
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload sound",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSoundName("");
    setSelectedFile(null);
    onClose();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
      const allowedExtensions = ['.mp3', '.wav'];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      
      if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(`.${fileExtension}`)) {
        toast({
          title: "Invalid File Type",
          description: "Please select a valid audio file (MP3 or WAV format only)",
          variant: "destructive",
        });
        event.target.value = ''; // Clear the input
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Error", 
          description: "File size must be less than 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      if (!soundName) {
        setSoundName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = () => {
    if (!soundName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a sound name",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select an audio file",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      name: soundName.trim(),
      roomId,
      uploadedBy: participantId,
      audio: selectedFile,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-discord-card border-gray-600 text-white">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            Upload Sound
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="soundName" className="text-gray-300">Sound Name</Label>
            <Input
              id="soundName"
              value={soundName}
              onChange={(e) => setSoundName(e.target.value)}
              placeholder="Enter sound name"
              className="bg-discord-bg border-gray-600 text-white focus:border-discord-purple mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="audioFile" className="text-gray-300">Choose File</Label>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center mt-1">
              <Music className="mx-auto h-8 w-8 text-gray-500 mb-2" />
              {selectedFile ? (
                <div>
                  <p className="text-sm text-white mb-1">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Select audio file</p>
              )}
              <input
                id="audioFile"
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="ghost"
                className="mt-2 text-discord-purple hover:text-purple-400"
                onClick={() => document.getElementById('audioFile')?.click()}
              >
                Browse Files
              </Button>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              className="flex-1 bg-discord-purple hover:bg-purple-600 text-white font-medium"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
            <Button
              onClick={handleClose}
              variant="secondary"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
