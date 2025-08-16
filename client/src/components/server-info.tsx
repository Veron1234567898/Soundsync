
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Wifi, Clock } from "lucide-react";

interface ServerInfo {
  country: string;
  region: string;
  city: string;
  ping: number;
}

export function ServerInfo() {
  const [serverInfo, setServerInfo] = useState<ServerInfo>({
    country: "Loading...",
    region: "",
    city: "",
    ping: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getServerInfo = async () => {
      try {
        // Get server location info
        const locationResponse = await fetch('https://ipapi.co/json/');
        const locationData = await locationResponse.json();
        
        // Measure ping
        const startTime = Date.now();
        await fetch('/api/ping', { method: 'HEAD' });
        const ping = Date.now() - startTime;

        setServerInfo({
          country: locationData.country_name || "Unknown",
          region: locationData.region || "",
          city: locationData.city || "",
          ping
        });
      } catch (error) {
        console.error('Failed to get server info:', error);
        setServerInfo({
          country: "Unknown",
          region: "",
          city: "",
          ping: 0
        });
      } finally {
        setIsLoading(false);
      }
    };

    getServerInfo();
    
    // Update ping every 30 seconds
    const interval = setInterval(async () => {
      try {
        const startTime = Date.now();
        await fetch('/api/ping', { method: 'HEAD' });
        const ping = Date.now() - startTime;
        setServerInfo(prev => ({ ...prev, ping }));
      } catch (error) {
        console.error('Failed to measure ping:', error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getPingColor = (ping: number) => {
    if (ping < 50) return "text-green-400";
    if (ping < 100) return "text-yellow-400";
    if (ping < 200) return "text-orange-400";
    return "text-red-400";
  };

  const getPingStatus = (ping: number) => {
    if (ping < 50) return "Excellent";
    if (ping < 100) return "Good";
    if (ping < 200) return "Fair";
    return "Poor";
  };

  if (isLoading) {
    return (
      <Card className="bg-discord-card border-gray-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-discord-green"></div>
            <span className="text-sm text-gray-400">Loading server info...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-discord-card border-gray-600">
      <CardContent className="p-4">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-3">
            <Globe className="w-5 h-5 text-discord-purple" />
            <div>
              <p className="text-sm font-medium text-white">
                Hosted in {serverInfo.city && `${serverInfo.city}, `}{serverInfo.region && `${serverInfo.region}, `}{serverInfo.country}
              </p>
              <p className="text-xs text-gray-400">Server Location</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Wifi className={`w-5 h-5 ${getPingColor(serverInfo.ping)}`} />
            <div className="text-right">
              <p className={`text-sm font-medium ${getPingColor(serverInfo.ping)}`}>
                {serverInfo.ping}ms
              </p>
              <p className="text-xs text-gray-400">
                {getPingStatus(serverInfo.ping)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
