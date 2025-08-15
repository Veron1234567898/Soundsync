declare module 'node-ffprobe' {
  interface FFProbeStream {
    duration?: string;
    [key: string]: any;
  }

  interface FFProbeFormat {
    duration?: string;
    [key: string]: any;
  }

  interface FFProbeData {
    streams: FFProbeStream[];
    format: FFProbeFormat;
  }

  function ffprobe(filePath: string): Promise<FFProbeData>;
  export = ffprobe;
}