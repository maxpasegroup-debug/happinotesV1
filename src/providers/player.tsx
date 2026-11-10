import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import type { Book, BookEpisode } from "@/lib/types";

type PlayerContextValue = {
  player: ReturnType<typeof useAudioPlayer>;
  status: ReturnType<typeof useAudioPlayerStatus>;
  currentBook: Book | null;
  currentEpisode: BookEpisode | null;
  playBook: (book: Book) => Promise<void>;
  playEpisode: (book: Book, episode: BookEpisode) => Promise<void>;
  togglePlayback: () => void;
  stop: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  clearCurrent: () => Promise<void>;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<BookEpisode | null>(
    null,
  );
  const currentBookRef = useRef<Book | null>(null);
  const currentEpisodeRef = useRef<BookEpisode | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {});
  }, []);

  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);

  useEffect(() => {
    currentEpisodeRef.current = currentEpisode;
  }, [currentEpisode]);

  const activateNowPlaying = useCallback(
    (book: Book, episode: BookEpisode | null) => {
      try {
        player.setActiveForLockScreen(
          true,
          {
            title: episode?.title || book.title,
            artist: "HappiNotes",
            albumTitle: book.title,
            ...(book.coverImageUrl ? { artworkUrl: book.coverImageUrl } : {}),
          },
          {
            showSeekBackward: true,
            showSeekForward: true,
            seekBackwardIntervalSeconds: 15,
            seekForwardIntervalSeconds: 15,
          },
        );
      } catch {
      }
    },
    [player],
  );

  const playUrl = useCallback(
    async (book: Book, url: string, episode: BookEpisode | null) => {
      if (!url) throw new Error("This book has no audio yet.");
      currentBookRef.current = book;
      currentEpisodeRef.current = episode;
      setCurrentBook(book);
      setCurrentEpisode(episode);
      player.replace(url);
      activateNowPlaying(book, episode);
      player.play();
    },
    [activateNowPlaying, player],
  );

  const playEpisode = useCallback(
    async (book: Book, episode: BookEpisode) => {
      await playUrl(book, episode.audioUrl, episode);
    },
    [playUrl],
  );

  const playBook = useCallback(
    async (book: Book) => {
      if (book.episodes.length > 0) {
        await playEpisode(book, book.episodes[0]);
      } else {
        await playUrl(book, book.audioUrl, null);
      }
    },
    [playEpisode, playUrl],
  );

  const togglePlayback = useCallback(() => {
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing]);

  const stop = useCallback(async () => {
    player.pause();
    try {
      await player.seekTo(0);
    } catch {
    }
    try {
      player.clearLockScreenControls();
    } catch {
    }
    currentBookRef.current = null;
    currentEpisodeRef.current = null;
    setCurrentBook(null);
    setCurrentEpisode(null);
  }, [player]);

  const clearCurrent = useCallback(async () => {
    await stop();
  }, [stop]);

  const playNext = useCallback(async () => {
    const book = currentBookRef.current;
    const episode = currentEpisodeRef.current;
    if (!book || !episode) return;
    const index = book.episodes.findIndex(
      (item) =>
        item.audioUrl === episode.audioUrl && item.title === episode.title,
    );
    if (index >= 0 && index + 1 < book.episodes.length) {
      await playEpisode(book, book.episodes[index + 1]);
    }
  }, [playEpisode]);

  const playPrevious = useCallback(async () => {
    const book = currentBookRef.current;
    const episode = currentEpisodeRef.current;
    if (!book || !episode) return;
    const index = book.episodes.findIndex(
      (item) =>
        item.audioUrl === episode.audioUrl && item.title === episode.title,
    );
    if (index > 0) await playEpisode(book, book.episodes[index - 1]);
  }, [playEpisode]);

  const seek = useCallback(
    async (seconds: number) => {
      try {
        await player.seekTo(seconds);
      } catch {
      }
    },
    [player],
  );

  const value = useMemo(
    () => ({
      player,
      status,
      currentBook,
      currentEpisode,
      playBook,
      playEpisode,
      togglePlayback,
      stop,
      playNext,
      playPrevious,
      seek,
      clearCurrent,
    }),
    [
      player,
      status,
      currentBook,
      currentEpisode,
      playBook,
      playEpisode,
      togglePlayback,
      stop,
      playNext,
      playPrevious,
      seek,
      clearCurrent,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("PlayerProvider is missing.");
  return value;
}
