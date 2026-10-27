import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ActionSheet, { type SheetOption } from "../components/ActionSheet";
import AlbumDetail from "../components/AlbumDetail";
import ArtistAvatar from "../components/ArtistAvatar";
import ArtistDetail from "../components/ArtistDetail";
import Cover from "../components/Cover";
import NamePrompt from "../components/NamePrompt";
import PlayingBars from "../components/PlayingBars";
import PlaylistDetail from "../components/PlaylistDetail";
import { SongListSkeleton } from "../components/Skeleton";
import SongRow from "../components/SongRow";
import AddArtistScreen from "./AddArtistScreen";
import AddSongScreen from "./AddSongScreen";
import { usePlayer } from "../player/PlayerContext";
import { api } from "../services/api";
import {
  createPlaylist,
  deleteSong,
  describeError,
  listPlaylists,
} from "../services/catalog";
import { colors } from "../theme/colors";
import { display } from "../theme/typography";
import type { Album } from "../types/album";
import type { Artist } from "../types/artist";
import type { Playlist } from "../types/playlist";
import type { Song } from "../types/song";
import { confirmDestructive, notify } from "../utils/confirm";
import { getArtistName } from "../utils/media";

type Props = {
  onSelectSong: (song: Song, queue: Song[], queueId?: string | null) => void;
  /** Página a abrir logo, quando se vem do Início. */
  initialDetail?: Detail;
  onInitialDetailUsed?: () => void;
};

type LibraryTab = "Músicas" | "Artistas" | "Álbuns" | "Playlists";
type IconName = ComponentProps<typeof Ionicons>["name"];

type Detail =
  | { kind: "artist"; id: number | null }
  | { kind: "album"; id: number }
  | { kind: "playlist"; id: number }
  | null;

const TABS: LibraryTab[] = ["Músicas", "Artistas", "Álbuns", "Playlists"];

function toList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object" && "items" in data && Array.isArray(data.items)) {
    return data.items as T[];
  }

  return [];
}

export default function LibraryScreen({
  onSelectSong,
  initialDetail,
  onInitialDetailUsed,
}: Props) {
  const { currentSong, removeFromQueue } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const [activeTab, setActiveTab] = useState<LibraryTab>("Músicas");
  const [recentFirst, setRecentFirst] = useState(true);
  const [grid, setGrid] = useState(false);

  const [detail, setDetail] = useState<Detail>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Música cujo menu (⋮) está aberto.
  const [songMenu, setSongMenu] = useState<Song | null>(null);
  const [addingSong, setAddingSong] = useState(false);
  const [addingArtist, setAddingArtist] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const [promptError, setPromptError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLibrary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [songsResponse, artistsResponse, albumsResponse, playlistsData] =
        await Promise.all([
          api.get("/songs/"),
          api.get("/artists/"),
          api.get("/albums/"),
          listPlaylists(),
        ]);

      setSongs(toList<Song>(songsResponse.data));
      setArtists(toList<Artist>(artistsResponse.data));
      setAlbums(toList<Album>(albumsResponse.data));
      setPlaylists(playlistsData);
    } catch (err) {
      console.error("Erro ao carregar biblioteca:", err);
      setError("Não foi possível carregar a biblioteca. Verifica se o backend está ligado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  // Veio do Início a pedir um álbum, artista ou playlist: abre-o.
  useEffect(() => {
    if (!initialDetail) return;

    setDetail(initialDetail);
    onInitialDetailUsed?.();
  }, [initialDetail]);

  const artistEntries = useMemo(() => {
    const entries = artists.map((artist) => ({
      id: artist.id as number | null,
      name: artist.name,
      photo: artist.photo_url ?? null,
      bio: artist.bio ?? null,
      songs: songs.filter((song) => song.artist_id === artist.id),
    }));

    const orphans = songs.filter((song) => song.artist_id == null);

    if (orphans.length > 0) {
      entries.push({
        id: null,
        name: "Artista desconhecido",
        photo: null,
        bio: null,
        songs: orphans,
      });
    }

    return entries;
  }, [artists, songs]);

  const albumEntries = useMemo(
    () =>
      albums.map((album) => ({
        album,
        songs: songs.filter((song) => song.album_id === album.id),
      })),
    [albums, songs]
  );

  // "Recentes" é a ordem que vem da API (mais novo primeiro);
  // a alternativa é por ordem alfabética.
  function sortByName<T>(items: T[], nameOf: (item: T) => string) {
    if (recentFirst) return items;

    return [...items].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }

  function artistNameFor(artistId?: number | null) {
    if (artistId == null) return null;
    return artists.find((artist) => artist.id === artistId)?.name ?? null;
  }

  function artistPhotoFor(artistId?: number | null) {
    if (artistId == null) return null;
    return artists.find((artist) => artist.id === artistId)?.photo_url ?? null;
  }

  async function savePlaylist(name: string) {
    try {
      setSavingPlaylist(true);
      setPromptError("");

      await createPlaylist(name);
      await loadLibrary();

      setCreatingPlaylist(false);
      setActiveTab("Playlists");
    } catch (err) {
      console.error("Erro ao criar a playlist:", err);
      setPromptError(describeError(err, "Não foi possível criar a playlist."));
    } finally {
      setSavingPlaylist(false);
    }
  }

  const sheetOptions: SheetOption[] = [
    {
      icon: "musical-notes",
      title: "Música",
      description: "Envia um ficheiro e junta-o ao teu catálogo",
      onPress: () => setAddingSong(true),
    },
    {
      icon: "list",
      title: "Playlist",
      description: "Cria uma playlist com as tuas músicas",
      onPress: () => setCreatingPlaylist(true),
    },
  ];

  function askDeleteSong(song: Song) {
    confirmDestructive(
      "Apagar a música?",
      `"${song.title}" sai do catálogo, das playlists e dos favoritos. Não dá para desfazer.`,
      "Apagar",
      () => void removeSong(song)
    );
  }

  async function removeSong(song: Song) {
    try {
      await deleteSong(song.id);
      // Se estava na fila (e não é a que toca agora), deixa de estar.
      removeFromQueue(song.id);
      setSongs((list) => list.filter((item) => item.id !== song.id));
      void loadLibrary();
    } catch (err) {
      console.error("Erro ao apagar a música:", err);
      notify(
        "Não foi possível apagar",
        describeError(err, "Tenta outra vez daqui a pouco.")
      );
    }
  }

  const songMenuOptions: SheetOption[] = songMenu
    ? [
        {
          icon: "trash-outline",
          title: "Apagar música",
          description: "Remove-a do catálogo para toda a gente",
          // Espera o painel fechar antes da pergunta (no iOS um alerta
          // aberto durante a animação do painel pode não aparecer).
          onPress: () => {
            const target = songMenu;
            setTimeout(() => askDeleteSong(target), 250);
          },
        },
      ]
    : [];

  // ----- ecrãs que substituem a biblioteca -----

  if (addingSong) {
    return (
      <AddSongScreen
        artists={artists}
        albums={albums}
        onClose={() => setAddingSong(false)}
        onCreated={() => void loadLibrary()}
      />
    );
  }

  if (addingArtist) {
    return (
      <AddArtistScreen
        onClose={() => setAddingArtist(false)}
        onCreated={() => void loadLibrary()}
      />
    );
  }

  if (detail?.kind === "artist") {
    const entry = artistEntries.find((artist) => artist.id === detail.id);

    if (entry) {
      return (
        <ArtistDetail
          artistId={entry.id}
          name={entry.name}
          photo={entry.photo}
          bio={entry.bio}
          songs={entry.songs}
          albums={albums.filter((album) => album.artist_id === entry.id)}
          onBack={() => setDetail(null)}
          onSelectSong={onSelectSong}
          onOpenAlbum={(id) => setDetail({ kind: "album", id })}
          onUpdated={() => void loadLibrary()}
        />
      );
    }
  }

  if (detail?.kind === "album") {
    const entry = albumEntries.find((item) => item.album.id === detail.id);

    if (entry) {
      const albumArtistId = entry.album.artist_id;

      return (
        <AlbumDetail
          album={entry.album}
          artistName={artistNameFor(albumArtistId)}
          artistPhoto={artistPhotoFor(albumArtistId)}
          songs={entry.songs}
          onBack={() => setDetail(null)}
          onSelectSong={onSelectSong}
          onOpenArtist={
            albumArtistId != null
              ? () => setDetail({ kind: "artist", id: albumArtistId })
              : undefined
          }
          onDeleted={() => void loadLibrary()}
        />
      );
    }
  }

  if (detail?.kind === "playlist") {
    return (
      <PlaylistDetail
        playlistId={detail.id}
        allSongs={songs}
        onBack={() => setDetail(null)}
        onSelectSong={onSelectSong}
        onChanged={() => void loadLibrary()}
      />
    );
  }

  // ----- a biblioteca -----

  function renderHeader() {
    return (
      <View>
        <View style={styles.topBar}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>E</Text>
          </View>

          <Text style={styles.title}>A tua Biblioteca</Text>

          <Pressable
            onPress={() => setSheetOpen(true)}
            style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Adicionar"
          >
            <Ionicons name="add" size={28} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab;

            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.chip, active && styles.chipOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextOn]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sortRow}>
          <Pressable
            onPress={() => setRecentFirst((value) => !value)}
            style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={
              recentFirst ? "Ordenar alfabeticamente" : "Ordenar pelos mais recentes"
            }
          >
            <Ionicons name="swap-vertical" size={18} color={colors.text} />
            <Text style={styles.sortText}>
              {recentFirst ? "Recentes" : "A-Z"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setGrid((value) => !value)}
            style={({ pressed }) => [styles.gridButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={grid ? "Ver em lista" : "Ver em grelha"}
          >
            <Ionicons
              name={grid ? "list" : "grid"}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // Linha "Adicionar ..." no fim da lista, conforme o separador aberto.
  function renderFooter() {
    const footers: Partial<Record<LibraryTab, { label: string; onPress: () => void }>> = {
      Músicas: { label: "Adicionar músicas", onPress: () => setAddingSong(true) },
      Artistas: { label: "Adicionar artistas", onPress: () => setAddingArtist(true) },
      Playlists: { label: "Criar playlist", onPress: () => setCreatingPlaylist(true) },
    };

    const footer = footers[activeTab];

    if (!footer || grid) return null;

    return (
      <Pressable
        onPress={footer.onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={footer.label}
      >
        <View style={[styles.addCircle, activeTab !== "Artistas" && styles.addSquare]}>
          <Ionicons name="add" size={26} color={colors.textSecondary} />
        </View>
        <Text style={styles.rowTitle}>{footer.label}</Text>
      </Pressable>
    );
  }

  function renderEmpty() {
    if (loading) return <SongListSkeleton count={4} />;

    const icons: Record<LibraryTab, IconName> = {
      Músicas: "musical-notes-outline",
      Artistas: "person-outline",
      Álbuns: "disc-outline",
      Playlists: "list-outline",
    };

    return (
      <View style={styles.empty}>
        <Ionicons
          name={error ? "cloud-offline-outline" : icons[activeTab]}
          size={36}
          color={colors.textTertiary}
        />
        <Text style={styles.message}>
          {error || `Ainda não tens ${activeTab.toLowerCase()}.`}
        </Text>
      </View>
    );
  }

  type Entry = {
    key: string;
    title: string;
    subtitle: string;
    round: boolean;
    cover?: string | null;
    seed: number;
    onPress: () => void;
    // Só as músicas têm; serve para marcar a que está a tocar.
    songId?: number;
    song?: Song;
  };

  const entries: Entry[] =
    activeTab === "Músicas"
      ? sortByName(songs, (song) => song.title).map((song) => ({
          key: `song-${song.id}`,
          title: song.title,
          subtitle: `Música · ${getArtistName(song)}`,
          round: false,
          cover: song.cover_url,
          seed: song.id,
          songId: song.id,
          song,
          onPress: () => onSelectSong(song, songs, "biblioteca"),
        }))
      : activeTab === "Artistas"
        ? sortByName(artistEntries, (artist) => artist.name).map((artist) => ({
            key: `artist-${artist.id ?? "sem"}`,
            title: artist.name,
            subtitle: "Artista",
            round: true,
            cover: artist.photo,
            seed: artist.id ?? 0,
            onPress: () => setDetail({ kind: "artist", id: artist.id }),
          }))
        : activeTab === "Álbuns"
          ? sortByName(albumEntries, (item) => item.album.title).map((item) => ({
              key: `album-${item.album.id}`,
              title: item.album.title,
              subtitle: `Álbum · ${artistNameFor(item.album.artist_id) ?? "Sem artista"}`,
              round: false,
              cover: item.album.cover_url,
              seed: item.album.id,
              onPress: () => setDetail({ kind: "album", id: item.album.id }),
            }))
          : sortByName(playlists, (playlist) => playlist.name).map((playlist) => ({
              key: `playlist-${playlist.id}`,
              title: playlist.name,
              subtitle: `Playlist · ${playlist.song_count} ${playlist.song_count === 1 ? "música" : "músicas"}`,
              round: false,
              seed: playlist.id,
              onPress: () => setDetail({ kind: "playlist", id: playlist.id }),
            }));

  function renderArtwork(entry: Entry, size: number) {
    if (entry.round) {
      return <ArtistAvatar name={entry.title} photo={entry.cover} size={size} />;
    }

    return (
      <Cover path={entry.cover} seed={entry.seed} size={size} radius={8} />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        // A grelha obriga a recriar a lista, por isso a chave muda.
        key={`${activeTab}-${grid ? "grelha" : "lista"}`}
        data={entries}
        keyExtractor={(item) => item.key}
        numColumns={grid ? 2 : 1}
        // As linhas também dependem da música a tocar, não só da lista.
        extraData={currentSong?.id}
        columnWrapperStyle={grid ? styles.column : undefined}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) =>
          grid ? (
            <Pressable
              onPress={item.onPress}
              onLongPress={item.song ? () => setSongMenu(item.song ?? null) : undefined}
              style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              {renderArtwork(item, 150)}
              <Text
                style={[
                  styles.gridTitle,
                  item.songId === currentSong?.id && styles.titlePlaying,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text style={styles.gridSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={item.onPress}
              onLongPress={item.song ? () => setSongMenu(item.song ?? null) : undefined}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              {renderArtwork(item, 56)}
              <View style={styles.flex}>
                <Text
                  style={[
                    styles.rowTitle,
                    item.songId === currentSong?.id && styles.titlePlaying,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>

              {/* Música a tocar: barrinhas. O que abre outra página: seta. */}
              {item.songId === undefined ? (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              ) : (
                <>
                  {item.songId === currentSong?.id && <PlayingBars />}
                  <Pressable
                    onPress={() => setSongMenu(item.song ?? null)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Opções: ${item.title}`}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color={colors.textTertiary}
                    />
                  </Pressable>
                </>
              )}
            </Pressable>
          )
        }
      />

      <ActionSheet
        visible={sheetOpen}
        options={sheetOptions}
        onClose={() => setSheetOpen(false)}
      />

      <ActionSheet
        visible={songMenu !== null}
        options={songMenuOptions}
        onClose={() => setSongMenu(null)}
      />

      <NamePrompt
        visible={creatingPlaylist}
        title="Dá um nome à playlist"
        placeholder="A minha playlist"
        saving={savingPlaylist}
        error={promptError}
        onCancel={() => {
          setCreatingPlaylist(false);
          setPromptError("");
        }}
        onConfirm={(name) => void savePlaylist(name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  moreButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "800",
  },
  title: {
    ...display.screen,
    flex: 1,
    color: colors.text,
    fontSize: 23,
  },
  topButton: {
    width: 44,
    height: 44,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  // A fila de filtros desliza até à borda do ecrã, sem cortar no padding.
  chipsScroll: {
    marginHorizontal: -20,
    marginBottom: 18,
  },
  chips: {
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  chipTextOn: {
    color: colors.white,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingRight: 10,
  },
  sortText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  gridButton: {
    width: 44,
    height: 44,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15.5,
    fontWeight: "600",
  },
  titlePlaying: {
    color: colors.primaryLight,
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  addCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  addSquare: {
    borderRadius: 8,
  },
  column: {
    gap: 16,
  },
  gridItem: {
    flex: 1,
    marginBottom: 20,
  },
  gridTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  gridSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  empty: {
    alignItems: "center",
    paddingTop: 30,
    gap: 12,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
