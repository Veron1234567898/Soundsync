export class AudioManager {
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private masterVolume: number = 0.75;

  async loadSound(soundId: string, url: string, preloadFully = false): Promise<HTMLAudioElement> {
    if (this.audioElements.has(soundId)) {
      return this.audioElements.get(soundId)!;
    }

    const audio = new Audio(url);
    audio.volume = this.masterVolume;
    audio.preload = preloadFully ? 'auto' : 'metadata';
    audio.crossOrigin = 'anonymous'; // Help with CORS issues
    
    return new Promise((resolve, reject) => {
      const eventToWaitFor = preloadFully ? 'canplaythrough' : 'loadedmetadata';
      const timeoutId = setTimeout(() => {
        reject(new Error('Audio loading timeout'));
      }, 10000); // 10 second timeout
      
      audio.addEventListener(eventToWaitFor, () => {
        clearTimeout(timeoutId);
        this.audioElements.set(soundId, audio);
        resolve(audio);
      }, { once: true });
      
      audio.addEventListener('error', (error) => {
        clearTimeout(timeoutId);
        console.error('Audio loading error:', error);
        reject(new Error(`Failed to load audio: ${error.type || 'Unknown error'}`));
      }, { once: true });

      // Start loading
      audio.load();
    });
  }

  async playSound(soundId: string, url?: string): Promise<void> {
    let audio = this.audioElements.get(soundId);
    
    if (!audio && url) {
      try {
        audio = await this.loadSound(soundId, url, false); // Load quickly for immediate playback
      } catch (error) {
        console.error(`Failed to load sound ${soundId}:`, error);
        throw error;
      }
    }
    
    if (audio) {
      try {
        audio.currentTime = 0;
        audio.volume = this.masterVolume;
        
        // Clone the audio element if it's already playing to allow overlapping sounds
        if (!audio.paused) {
          const clonedAudio = audio.cloneNode() as HTMLAudioElement;
          clonedAudio.volume = this.masterVolume;
          clonedAudio.currentTime = 0;
          return clonedAudio.play();
        }
        
        return audio.play();
      } catch (playError) {
        console.error(`Failed to play sound ${soundId}:`, playError);
        throw playError;
      }
    } else {
      throw new Error(`Sound ${soundId} not found and no URL provided`);
    }
  }

  stopSound(soundId: string): void {
    const audio = this.audioElements.get(soundId);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  stopAllSounds(): void {
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.audioElements.forEach(audio => {
      audio.volume = this.masterVolume;
    });
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  preloadSounds(sounds: Array<{ id: string; url: string }>): Promise<void[]> {
    return Promise.all(
      sounds.map(sound => 
        this.loadSound(sound.id, sound.url, true).then(() => {}).catch(console.error)
      )
    );
  }

  // Preload a single sound for instant playback
  async preloadSound(soundId: string, url: string): Promise<void> {
    try {
      await this.loadSound(soundId, url, true);
    } catch (error) {
      console.error('Failed to preload sound:', error);
    }
  }
}

export const audioManager = new AudioManager();
