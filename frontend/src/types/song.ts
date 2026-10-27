export type Song = {
  id: number;
  title: string;
  duration: number;
  audio_url: string;
  cover_url?: string | null;
  artist_id?: number | null;
  album_id?: number | null;
  artist?: {
    id?: number;
    name?: string;
  } | null;
  // A API já envia o álbum dentro de cada música.
  album?: {
    id: number;
    title: string;
    cover_url?: string | null;
  } | null;
  artist_name?: string | null;
};
