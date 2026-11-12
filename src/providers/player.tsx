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
import { router } from 'expo-router';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { fetchHappyBite, happyBiteAsBook, HappyBiteAccessError } from '@/lib/happy-bites';
import { apiErrorMessage } from '@/lib/api';
import { BACKGROUND_AUDIO_SUPPORTED, LOCK_SCREEN_CONTROLS_SUPPORTED } from '@/lib/app-environment';
import { useAuth } from '@/providers/auth';
import { useToast } from '@/providers/toast';
import type { Book, BookEpisode } from "@/lib/types";

type PlayerContextValue = {
  player: ReturnType<typeof useAudioPlayer>;
  status: ReturnType<typeof useAudioPlayerStatus>;
  loadingHappyBiteId: string | null;
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const [lockedTitle, setLockedTitle] = useState<string | null>(null);
  const [loadingHappyBiteId, setLoadingHappyBiteId] = useState<string | null>(null);
  const playbackRequest = useRef(0);
  const resuming = useRef(false);
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
      shouldPlayInBackground: BACKGROUND_AUDIO_SUPPORTED,
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
      // Android logs service-binding failures asynchronously, so try/catch
      // cannot handle them. Do not request this native service in Expo Go.
      if (!LOCK_SCREEN_CONTROLS_SUPPORTED) return;
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
      const requestId = ++playbackRequest.current;
      if (book.happyBiteId) {
        setLoadingHappyBiteId(book.happyBiteId);
        try {
          const bite = await fetchHappyBite(book.happyBiteId);
          if (requestId !== playbackRequest.current) throw new HappyBiteAccessError();
          if (bite.locked) {
            setLockedTitle(bite.title);
            throw new HappyBiteAccessError();
          }
          book = happyBiteAsBook(bite);
          episode = book.episodes[0];
          url = book.audioUrl;
        } finally {
          if (requestId === playbackRequest.current) setLoadingHappyBiteId(null);
        }
      } else {
        setLoadingHappyBiteId(null);
      }
      if (!url) throw new Error("This audio is not available yet.");
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

  const stop = useCallback(async () => {
    const requestId = ++playbackRequest.current;
    setLoadingHappyBiteId(null);
    const isHappyBite = Boolean(currentBookRef.current?.happyBiteId);
    player.pause();
    try {
      await player.seekTo(0);
    } catch {
    }
    if (requestId !== playbackRequest.current) return;
    try {
      if (LOCK_SCREEN_CONTROLS_SUPPORTED) player.clearLockScreenControls();
    } catch {
    }
    if (isHappyBite) player.replace(null);
    currentBookRef.current = null;
    currentEpisodeRef.current = null;
    setCurrentBook(null);
    setCurrentEpisode(null);
  }, [player]);

  // A retained player must not carry a previous user's premium entitlement.
  useEffect(() => {
    ++playbackRequest.current;
    // Synchronize the UI with the external audio session invalidated by this account change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingHappyBiteId(null);
    setLockedTitle(null);
    if (currentBookRef.current?.happyBiteId) void stop();
  }, [user?.id, user?.role, user?.subscriptionActive, user?.subscriptionExpiresAt, stop]);

  const togglePlayback = useCallback(() => {
    if (status.playing) { player.pause(); return; }
    const current = currentBookRef.current;
    if (!current?.happyBiteId) { player.play(); return; }
    if (resuming.current) return;
    resuming.current = true;
    const requestId = ++playbackRequest.current;
    setLoadingHappyBiteId(current.happyBiteId);
    void (async () => {
      try {
        const bite = await fetchHappyBite(current.happyBiteId!);
        if (requestId !== playbackRequest.current) return;
        if (bite.locked) {
          await stop();
          setLockedTitle(bite.title);
          return;
        }
        if (!bite.audioUrl) throw new Error('This audio is no longer available.');
        const refreshed = happyBiteAsBook(bite);
        // Preserve the playback position unless the admin replaced the audio.
        if (refreshed.audioUrl !== current.audioUrl) player.replace(refreshed.audioUrl);
        currentBookRef.current = refreshed;
        currentEpisodeRef.current = refreshed.episodes[0];
        setCurrentBook(refreshed);
        setCurrentEpisode(refreshed.episodes[0]);
        activateNowPlaying(refreshed, refreshed.episodes[0]);
        player.play();
      } catch (error) {
        if (requestId === playbackRequest.current) {
          await stop();
          showToast(apiErrorMessage(error), false);
        }
      } finally {
        resuming.current = false;
        if (requestId === playbackRequest.current) setLoadingHappyBiteId(null);
      }
    })();
  }, [activateNowPlaying, player, showToast, status.playing, stop]);

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
      loadingHappyBiteId,
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
      loadingHappyBiteId,
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
    <PlayerContext.Provider value={value}>
      {children}
      <ConfirmationModal visible={lockedTitle !== null} title="Premium Happy Bite" description={`“${lockedTitle ?? ''}” is included with HappiNotes Pro. ${user ? 'Use your existing Pro subscription to listen.' : 'Sign in to use your Pro subscription or view the available plans.'}`} icon="lock-closed-outline" confirmLabel={user ? 'View Pro plans' : 'Sign in'} cancelLabel="Not now" onCancel={() => setLockedTitle(null)} onConfirm={() => { setLockedTitle(null); router.push(user ? '/subscription' : '/auth'); }} />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("PlayerProvider is missing.");
  return value;
}
