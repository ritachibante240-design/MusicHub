import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from "expo-audio";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Song } from "../types/song";
import { getMediaUrl } from "../utils/media";

type PlayerValue = {
  /** Instância partilhada: a música continua a tocar ao mudar de ecrã. */
  player: AudioPlayer;
  currentSong: Song | null;
  queue: Song[];
  /** De onde veio a fila: "album:3", "playlist:1", "artista:2"... */
  queueId: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  shuffleOn: boolean;
  repeat: boolean;
  isOpen: boolean;
  error: string;
  playSong: (song: Song, songs?: Song[], queueId?: string | null) => void;
  playShuffled: (songs: Song[], queueId?: string | null) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlayback: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  openPlayer: () => void;
  closePlayer: () => void;
  /** Passa uma música da fila para logo a seguir à que está a tocar. */
  playAfterCurrent: (songId: number) => void;
  /** Tira uma música da fila (nunca a que está a tocar). */
  removeFromQueue: (songId: number) => void;
};

const PlayerContext = createContext<PlayerValue | null>(null);

export function usePlayer() {
  const value = useContext(PlayerContext);

  if (!value) {
    throw new Error("usePlayer tem de ser usado dentro de <PlayerProvider>.");
  }

  return value;
}

// Mantém a música escolhida em primeiro lugar e baralha as restantes.
function shuffleWithFirst(list: Song[], first: Song) {
  const rest = list.filter((song) => song.id !== first.id);

  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [first, ...rest];
}

// Fica fora do provider para que as atualizações de tempo (várias por
// segundo) não obriguem os ecrãs todos a desenhar de novo.
function AutoAdvance({
  player,
  onFinish,
}: {
  player: AudioPlayer;
  onFinish: () => void;
}) {
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) onFinish();
  }, [status.didJustFinish]);

  return null;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [originalQueue, setOriginalQueue] = useState<Song[]>([]);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  // Qual música está mesmo carregada no leitor.
  const loadedSongId = useRef<number | null>(null);

  const index = currentSong
    ? queue.findIndex((song) => song.id === currentSong.id)
    : -1;
  const hasPrevious = index > 0;
  const hasNext = index >= 0 && index < queue.length - 1;

  // Carrega e começa a tocar sempre que a música muda. Se for a mesma
  // música escolhida noutra lista, continua de onde estava em vez de
  // voltar ao início.
  useEffect(() => {
    if (!currentSong) return;

    if (loadedSongId.current === currentSong.id) {
      player.play();
      return;
    }

    const uri = getMediaUrl(currentSong.audio_url);

    if (!uri) {
      setError("Esta música não tem ficheiro de áudio.");
      return;
    }

    try {
      setError("");
      player.replace({ uri });
      player.play();
      loadedSongId.current = currentSong.id;
    } catch (err) {
      console.error("Erro ao carregar áudio:", err);
      setError("Não foi possível carregar esta música.");
      return;
    }

    // Um ficheiro em falta não faz o leitor lançar erro nenhum: fica
    // parado em 0:00, em silêncio. Por isso perguntamos ao servidor se o
    // ficheiro existe. Só um "não existe" claro conta como erro — uma
    // falha de rede passageira não deve assustar ninguém.
    let stale = false;

    fetch(uri, { method: "HEAD" })
      .then((response) => {
        if (stale || response.ok) return;
        player.pause();
        setError("O ficheiro de áudio desta música não está no servidor.");
      })
      .catch(() => {});

    return () => {
      stale = true;
    };
  }, [currentSong, player]);

  useEffect(() => {
    player.loop = repeat;
  }, [repeat, currentSong, player]);

  // Tocar não abre o leitor em ecrã inteiro: a música começa e aparece
  // o mini-leitor em baixo. O leitor abre ao tocar nesse mini-leitor.
  const playSong = useCallback(
    (song: Song, songs: Song[] = [song], id: string | null = null) => {
      const validQueue = songs.length > 0 ? songs : [song];

      setOriginalQueue(validQueue);
      setQueue(shuffleOn ? shuffleWithFirst(validQueue, song) : validQueue);
      setQueueId(id);
      setCurrentSong(song);
    },
    [shuffleOn]
  );

  // Liga a ordem aleatória e começa numa música à sorte.
  const playShuffled = useCallback((songs: Song[], id: string | null = null) => {
    if (songs.length === 0) return;

    const first = songs[Math.floor(Math.random() * songs.length)];

    setShuffleOn(true);
    setOriginalQueue(songs);
    setQueue(shuffleWithFirst(songs, first));
    setQueueId(id);
    setCurrentSong(first);
  }, []);

  const playNext = useCallback(() => {
    if (hasNext) setCurrentSong(queue[index + 1]);
  }, [hasNext, queue, index]);

  const playPrevious = useCallback(() => {
    if (hasPrevious) setCurrentSong(queue[index - 1]);
  }, [hasPrevious, queue, index]);

  const togglePlayback = useCallback(() => {
    try {
      setError("");

      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (err) {
      console.error("Erro na reprodução:", err);
      setError("Não foi possível reproduzir esta música.");
    }
  }, [player]);

  const toggleShuffle = useCallback(() => {
    const next = !shuffleOn;
    setShuffleOn(next);

    if (!currentSong) return;

    setQueue(next ? shuffleWithFirst(originalQueue, currentSong) : originalQueue);
  }, [shuffleOn, currentSong, originalQueue]);

  const toggleRepeat = useCallback(() => setRepeat((value) => !value), []);
  const openPlayer = useCallback(() => setIsOpen(true), []);
  const closePlayer = useCallback(() => setIsOpen(false), []);

  // Mexer na fila aplica-se às duas versões dela — a original e a
  // baralhada — para que ligar ou desligar o aleatório não desfaça
  // o que o utilizador escolheu.
  const playAfterCurrent = useCallback(
    (songId: number) => {
      if (!currentSong || currentSong.id === songId) return;

      const move = (list: Song[]) => {
        const song = list.find((item) => item.id === songId);
        if (!song) return list;

        const without = list.filter((item) => item.id !== songId);
        const at = without.findIndex((item) => item.id === currentSong.id);
        if (at < 0) return list;

        return [...without.slice(0, at + 1), song, ...without.slice(at + 1)];
      };

      setQueue(move);
      setOriginalQueue(move);
    },
    [currentSong]
  );

  const removeFromQueue = useCallback(
    (songId: number) => {
      if (currentSong?.id === songId) return;

      setQueue((list) => list.filter((item) => item.id !== songId));
      setOriginalQueue((list) => list.filter((item) => item.id !== songId));
    },
    [currentSong]
  );

  // No fim da música: passa à seguinte ou, na última, pára no início.
  const handleFinish = useCallback(() => {
    if (repeat) return;

    if (hasNext) {
      playNext();
    } else {
      player.pause();
      void player.seekTo(0);
    }
  }, [repeat, hasNext, playNext, player]);

  const value: PlayerValue = {
    player,
    currentSong,
    queue,
    queueId,
    hasNext,
    hasPrevious,
    shuffleOn,
    repeat,
    isOpen,
    error,
    playSong,
    playShuffled,
    playNext,
    playPrevious,
    togglePlayback,
    toggleShuffle,
    toggleRepeat,
    openPlayer,
    closePlayer,
    playAfterCurrent,
    removeFromQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
      {currentSong && <AutoAdvance player={player} onFinish={handleFinish} />}
      {children}
    </PlayerContext.Provider>
  );
}
