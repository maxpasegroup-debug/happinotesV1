import { createContext, useContext, useEffect } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

type Player = ReturnType<typeof useAudioPlayer>;
type PlayerStatus = ReturnType<typeof useAudioPlayerStatus>;
const AudioContext = createContext<{
  player: Player;
  status: PlayerStatus;
} | null>(null);

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {});
  }, []);
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  return (
    <AudioContext.Provider value={{ player, status }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAppAudio() {
  const value = useContext(AudioContext);
  if (!value) throw new Error("AudioPlayerProvider is missing.");
  return value;
}
