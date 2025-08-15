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
    
    return new Promise((resolve, reject) => {
      const eventToWaitFor = preloadFully ? 'canplaythrough' : 'loadedmetadata';
      
      audio.addEventListener(eventToWaitFor, () => {
        this.audioElements.set(soundId, audio);
        resolve(audio);
      }, { once: true });
      
      audio.addEventListener('error', (error) => {
        console.error('Audio loading error:', error);
        reject(new Error(`Failed to load audio: ${error.type || 'Unknown error'}`));
      }, { once: true });
    });
  }

  async playSound(soundId: string, url?: string): Promise<void> {
    let audio = this.audioElements.get(soundId);
    
    if (!audio && url) {
      audio = await this.loadSound(soundId, url);
    }
    
    if (audio) {
      audio.currentTime = 0;
      audio.volume = this.masterVolume;
      return audio.play();
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
