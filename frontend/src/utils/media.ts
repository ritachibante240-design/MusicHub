import { STORAGE_URL } from "../services/api";
import type { Song } from "../types/song";

export function getMediaUrl(path?: string | null) {
  if (!path) return undefined;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${STORAGE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function formatDuration(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remaining = Math.floor(safe % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function getArtistName(song: Song) {
  return song.artist?.name || song.artist_name || "Artista desconhecido";
}
