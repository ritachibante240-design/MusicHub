import { Platform } from "react-native";

import { api } from "./api";
import type { Album } from "../types/album";
import type { Artist } from "../types/artist";
import type { Playlist, PlaylistDetailData } from "../types/playlist";
import type { Song } from "../types/song";

export type UploadResult = {
  filename: string;
  url: string;
  size_bytes: number;
  duration_seconds?: number;
};

export type PickedFile = {
  uri: string;
  name: string;
  type: string;
};

// O upload de um ficheiro grande demora mais do que um pedido normal.
const UPLOAD_TIMEOUT = 120000;

const isWeb = Platform.OS === "web";

async function toFormData(file: PickedFile) {
  const form = new FormData();

  if (isWeb) {
    // No browser, {uri, name, type} chegava ao servidor como o texto
    // "[object Object]". Lá é preciso ler o ficheiro e enviá-lo como Blob,
    // com o tipo e o nome certos — o servidor valida os dois.
    const original = await (await fetch(file.uri)).blob();
    const blob = original.slice(0, original.size, file.type);

    (form as unknown as { append(name: string, value: Blob, filename: string): void })
      .append("file", blob, file.name);
  } else {
    // Em React Native, um ficheiro é enviado como {uri, name, type}.
    form.append("file", file as unknown as Blob);
  }

  return form;
}

// No browser, o próprio browser escreve o cabeçalho multipart (com a
// fronteira entre partes); escrevê-lo à mão estragava o pedido.
const UPLOAD_HEADERS = isWeb ? undefined : { "Content-Type": "multipart/form-data" };

export async function uploadAudio(file: PickedFile) {
  const { data } = await api.post<UploadResult>(
    "/uploads/audio",
    await toFormData(file),
    { headers: UPLOAD_HEADERS, timeout: UPLOAD_TIMEOUT }
  );

  return data;
}

export async function uploadCover(file: PickedFile) {
  const { data } = await api.post<UploadResult>(
    "/uploads/cover",
    await toFormData(file),
    { headers: UPLOAD_HEADERS, timeout: UPLOAD_TIMEOUT }
  );

  return data;
}

export async function createArtist(
  name: string,
  bio?: string | null,
  photoUrl?: string | null
) {
  const { data } = await api.post<Artist>("/artists/", {
    name,
    bio: bio || null,
    photo_url: photoUrl || null,
  });

  return data;
}

export async function updateArtist(
  id: number,
  artist: { name: string; bio?: string | null; photo_url?: string | null }
) {
  const { data } = await api.put<Artist>(`/artists/${id}`, {
    name: artist.name,
    bio: artist.bio || null,
    photo_url: artist.photo_url || null,
  });

  return data;
}

// Escolhe uma imagem da galeria e envia-a; devolve o endereço guardado.
export async function pickAndUploadImage(): Promise<string | null> {
  const ImagePicker = await import("expo-image-picker");

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Sem acesso às fotografias.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const isPng = (asset.mimeType ?? asset.uri).toLowerCase().includes("png");

  const uploaded = await uploadCover({
    uri: asset.uri,
    name: isPng ? "foto.png" : "foto.jpg",
    type: isPng ? "image/png" : "image/jpeg",
  });

  return uploaded.url;
}

export async function createAlbum(album: {
  title: string;
  artist_id?: number | null;
  cover_url?: string | null;
  release_year?: number | null;
}) {
  const { data } = await api.post<Album>("/albums/", {
    title: album.title,
    artist_id: album.artist_id ?? null,
    cover_url: album.cover_url ?? null,
    release_year: album.release_year ?? null,
  });

  return data;
}

export async function createSong(song: {
  title: string;
  duration: number;
  audio_url: string;
  cover_url?: string | null;
  artist_id?: number | null;
  album_id?: number | null;
}) {
  const { data } = await api.post<Song>("/songs/", {
    title: song.title,
    duration: song.duration,
    audio_url: song.audio_url,
    cover_url: song.cover_url ?? null,
    artist_id: song.artist_id ?? null,
    album_id: song.album_id ?? null,
  });

  return data;
}

export async function deleteSong(id: number) {
  await api.delete(`/songs/${id}`);
}

export async function deleteAlbum(id: number) {
  await api.delete(`/albums/${id}`);
}

export async function deleteArtist(id: number) {
  await api.delete(`/artists/${id}`);
}

export async function renamePlaylist(id: number, name: string) {
  const { data } = await api.put<Playlist>(`/playlists/${id}`, { name });

  return data;
}

export async function listPlaylists() {
  const { data } = await api.get<Playlist[]>("/playlists/");

  return data;
}

export async function getPlaylist(id: number) {
  const { data } = await api.get<PlaylistDetailData>(`/playlists/${id}`);

  return data;
}

export async function createPlaylist(name: string) {
  const { data } = await api.post<Playlist>("/playlists/", { name });

  return data;
}

export async function addSongToPlaylist(playlistId: number, songId: number) {
  await api.post(`/playlists/${playlistId}/songs`, { song_id: songId });
}

export async function removeSongFromPlaylist(playlistId: number, songId: number) {
  await api.delete(`/playlists/${playlistId}/songs/${songId}`);
}

export async function deletePlaylist(id: number) {
  await api.delete(`/playlists/${id}`);
}

// Mostra a mensagem que o backend devolve, em vez de um erro técnico.
export function describeError(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  return fallback;
}
