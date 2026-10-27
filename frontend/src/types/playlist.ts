import type { Song } from "./song";

export type Playlist = {
  id: number;
  name: string;
  song_count: number;
};

export type PlaylistDetailData = Playlist & {
  songs: Song[];
};
