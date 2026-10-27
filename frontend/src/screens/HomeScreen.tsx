import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import ArtistAvatar from "../components/ArtistAvatar";
import Cover from "../components/Cover";
import DetailActions from "../components/DetailActions";
import PlayingBars from "../components/PlayingBars";
import PressableScale from "../components/PressableScale";
import ShowAllScreen, {
  type ShowAllCategory,
  type ShowAllEntry,
} from "../components/ShowAllScreen";
import { SongListSkeleton } from "../components/Skeleton";
import SongRow from "../components/SongRow";
import { usePlayer } from "../player/PlayerContext";
import { API_URL, api, USING_REMOTE_API } from "../services/api";
import { listPlaylists } from "../services/catalog";
import { useFavoriteIds } from "../hooks/useFavoriteIds";
import { toggleFavoriteId } from "../services/favorites";
import { colors, seedColor } from "../theme/colors";
import { display } from "../theme/typography";
import type { Album } from "../types/album";
import type { Artist } from "../types/artist";
import type { Playlist } from "../types/playlist";
import type { Song } from "../types/song";
import { formatDuration, getArtistName } from "../utils/media";

export type LibraryTarget =
  | { kind: "artist"; id: number | null }
  | { kind: "album"; id: number }
  | { kind: "playlist"; id: number };

type Props = {
  onSelectSong: (song: Song, queue: Song[], queueId?: string | null) => void;
  onSearchPress?: () => void;
  onOpenInLibrary?: (target: LibraryTarget) => void;
};

const ROW = 64;
// Quantas músicas a prateleira de destaque mostra antes de valer a pena
// existir, e a partir de quantos itens "Mostrar tudo" deixa de ser ruído.
const RECENT_LIMIT = 8;
const SHOW_ALL_FROM = 4;
// Tudo o que se toca a partir do Início usa a mesma fila (todas as
// músicas); o nome deixa os botões saber se é esta lista que está a tocar.
const HOME_QUEUE = "inicio";

const SHOW_ALL_TITLES: Record<ShowAllCategory, string> = {
  songs: "Recentes",
  albums: "Os teus álbuns",
  artists: "Artistas",
  playlists: "As tuas playlists",
};

const SHOW_ALL_CHIPS: { id: ShowAllCategory; label: string }[] = [
  { id: "songs", label: "Músicas" },
  { id: "albums", label: "Álbuns" },
  { id: "artists", label: "Artistas" },
  { id: "playlists", label: "Playlists" },
];

// Singular e plural de cada categoria, para a contagem no topo da lista.
const SHOW_ALL_WORDS: Record<ShowAllCategory, [string, string]> = {
  songs: ["música", "músicas"],
  albums: ["álbum", "álbuns"],
  artists: ["artista", "artistas"],
  playlists: ["playlist", "playlists"],
};

function toList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object" && "items" in data && Array.isArray(data.items)) {
    return data.items as T[];
  }

  return [];
}

export default function HomeScreen({
  onSelectSong,
  onSearchPress,
  onOpenInLibrary,
}: Props) {
  const { width } = useWindowDimensions();
  // Dois cartões por ecrã e um pedaço do terceiro à espreita, para se
  // perceber que a prateleira continua.
  const card = Math.round(Math.min(168, Math.max(134, (width - 56) / 2.25)));
  const avatarSize = Math.round(card * 0.72);

  const { currentSong, openPlayer } = usePlayer();
  const [showAll, setShowAll] = useState<ShowAllCategory | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const favoriteIds = useFavoriteIds();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waking, setWaking] = useState(false);

  const load = useCallback(async () => {
    // No Render gratuito o servidor pode estar a dormir. Se a resposta
    // demorar, dizemos porquê, em vez de deixar só os esqueletos a piscar.
    const wakingTimer = USING_REMOTE_API
      ? setTimeout(() => setWaking(true), 4000)
      : null;

    try {
      setError("");
      setLoading(true);

      const [songsResponse, albumsResponse, artistsResponse, playlistsData] =
        await Promise.all([
          api.get("/songs/"),
          api.get("/albums/"),
          api.get("/artists/"),
          listPlaylists(),
        ]);

      setSongs(toList<Song>(songsResponse.data));
      setAlbums(toList<Album>(albumsResponse.data));
      setArtists(toList<Artist>(artistsResponse.data));
      setPlaylists(playlistsData);
    } catch (err) {
      console.error("Erro ao carregar o início:", err);
      setError(
        USING_REMOTE_API
          ? "Não foi possível falar com o servidor. Verifica a ligação à internet e tenta novamente."
          : "Não foi possível falar com o servidor. Verifica se o backend está ligado e se o telemóvel está na mesma rede Wi-Fi do PC."
      );
    } finally {
      if (wakingTimer) clearTimeout(wakingTimer);
      setWaking(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);


  // O coração muda logo; se o servidor recusar, volta atrás sozinho.
  async function toggleFavorite(id: number) {
    try {
      await toggleFavoriteId(id);
    } catch (err) {
      console.error("Erro ao guardar favorito:", err);
    }
  }

  function artistNameFor(artistId?: number | null) {
    if (artistId == null) return "Sem artista";
    return artists.find((artist) => artist.id === artistId)?.name ?? "Sem artista";
  }

  // As linhas da lista de "Mostrar tudo", conforme a categoria escolhida.
  function showAllEntries(category: ShowAllCategory): ShowAllEntry[] {
    // Ao sair para outra página, a lista fecha-se, para quem voltar ao
    // Início encontrar o Início e não a lista de onde saiu.
    function open(target: LibraryTarget) {
      setShowAll(null);
      onOpenInLibrary?.(target);
    }

    if (category === "songs") {
      return songs.map((song) => ({
        key: `song-${song.id}`,
        title: song.title,
        subtitle: `Música · ${getArtistName(song)}`,
        label: `Reproduzir ${song.title}`,
        artwork: (
          <Cover path={song.cover_url} seed={song.id} size={ROW} radius={6} />
        ),
        onPress: () => onSelectSong(song, songs, HOME_QUEUE),
      }));
    }

    if (category === "albums") {
      return albums.map((album) => ({
        key: `album-${album.id}`,
        title: album.title,
        subtitle: `Álbum · ${artistNameFor(album.artist_id)}`,
        label: `Abrir o álbum ${album.title}`,
        chevron: true,
        artwork: (
          <Cover path={album.cover_url} seed={album.id} size={ROW} radius={6} />
        ),
        onPress: () => open({ kind: "album", id: album.id }),
      }));
    }

    if (category === "artists") {
      return artists.map((artist) => ({
        key: `artist-${artist.id}`,
        title: artist.name,
        subtitle: "Artista",
        label: `Abrir o artista ${artist.name}`,
        chevron: true,
        artwork: (
          <ArtistAvatar name={artist.name} photo={artist.photo_url} size={ROW} />
        ),
        onPress: () => open({ kind: "artist", id: artist.id }),
      }));
    }

    return playlists.map((playlist) => ({
      key: `playlist-${playlist.id}`,
      title: playlist.name,
      subtitle: `Playlist · ${playlist.song_count} ${
        playlist.song_count === 1 ? "música" : "músicas"
      }`,
      label: `Abrir a playlist ${playlist.name}`,
      chevron: true,
      artwork: (
        <View style={styles.rowPlaylistArt}>
          <Ionicons name="musical-notes" size={26} color={colors.primaryLight} />
        </View>
      ),
      onPress: () => open({ kind: "playlist", id: playlist.id }),
    }));
  }

  // Cabeçalho de secção. "Mostrar tudo" só entra quando a secção não
  // mostra já tudo o que tem — um atalho para dois álbuns anuncia o
  // vazio em vez de ajudar.
  function SectionTitle({
    title,
    onShowAll,
  }: {
    title: string;
    onShowAll?: () => void;
  }) {
    return (
      <View style={styles.shelfHeader}>
        <Text style={styles.shelfTitle} numberOfLines={1}>
          {title}
        </Text>

        {onShowAll && (
          <Pressable
            onPress={onShowAll}
            style={styles.showAll}
            accessibilityRole="button"
            accessibilityLabel={`Mostrar tudo: ${title}`}
          >
            <Text style={styles.showAllText}>Mostrar tudo</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Prateleira horizontal com um título e, se fizer sentido, "Mostrar tudo".
  function Shelf({
    title,
    onShowAll,
    children,
  }: {
    title: string;
    onShowAll?: () => void;
    children: ReactNode;
  }) {
    return (
      <View style={styles.shelf}>
        <SectionTitle title={title} onShowAll={onShowAll} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfRow}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  function Card({
    artwork,
    title,
    subtitle,
    onPress,
    label,
  }: {
    artwork: ReactNode;
    title: string;
    subtitle: string;
    onPress: () => void;
    label: string;
  }) {
    return (
      <PressableScale
        style={{ width: card }}
        onPress={onPress}
        accessibilityLabel={label}
      >
        <View style={styles.cardArtwork}>{artwork}</View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </PressableScale>
    );
  }

  function renderHeader() {
    // A música em foco: a que está a tocar ou, se ainda nada tocou, a
    // última que adicionaste. É o único elemento dominante da página.
    const featured = currentSong ?? songs[0];

    // Com poucas músicas, "Recentes" mostrava exatamente o mesmo que a
    // lista em baixo. Só aparece quando tem alguma coisa a acrescentar.
    const showRecent = songs.length > RECENT_LIMIT;

    const inventory = [
      songs.length > 0
        ? `${songs.length} ${songs.length === 1 ? "música" : "músicas"}`
        : null,
      albums.length > 0
        ? `${albums.length} ${albums.length === 1 ? "álbum" : "álbuns"}`
        : null,
      artists.length > 0
        ? `${artists.length} ${artists.length === 1 ? "artista" : "artistas"}`
        : null,
    ].filter(Boolean);

    return (
      <View>
        <View style={styles.topBar}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>E</Text>
          </View>

          <View style={styles.flex}>
            <Text style={styles.logo}>
              Music<Text style={styles.logoAccent}>Hub</Text>
            </Text>
            {inventory.length > 0 && (
              <Text style={styles.inventory}>{inventory.join(" · ")}</Text>
            )}
          </View>

          {onSearchPress && (
            <Pressable
              onPress={onSearchPress}
              style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Pesquisar"
            >
              <Ionicons name="search" size={24} color={colors.text} />
            </Pressable>
          )}
        </View>

        {featured && (
          <PressableScale
            style={styles.hero}
            scaleTo={0.985}
            // A tocar: abre o leitor. Ainda nada tocou: começa esta.
            onPress={
              currentSong ? openPlayer : () => onSelectSong(featured, songs, HOME_QUEUE)
            }
            accessibilityLabel={
              currentSong
                ? `Abrir o leitor: ${featured.title}`
                : `Reproduzir ${featured.title}`
            }
          >
            <LinearGradient
              colors={[seedColor(featured.id), colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroInner}
            >
              <Cover
                path={featured.cover_url}
                seed={featured.id}
                size={86}
                radius={8}
                style={styles.heroCover}
              />

              <View style={styles.heroText}>
                <Text style={styles.heroLabel}>
                  {currentSong ? "A TOCAR" : "COMEÇA POR AQUI"}
                </Text>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {featured.title}
                </Text>
                <Text style={styles.heroArtist} numberOfLines={1}>
                  {getArtistName(featured)}
                </Text>
              </View>

              <View style={[styles.heroAction, currentSong && styles.heroActionLive]}>
                {currentSong ? (
                  <PlayingBars />
                ) : (
                  <Ionicons name="play" size={22} color={colors.white} />
                )}
              </View>
            </LinearGradient>
          </PressableScale>
        )}

        {showRecent && (
          <Shelf title="Recentes" onShowAll={() => setShowAll("songs")}>
            {songs.slice(0, RECENT_LIMIT).map((song) => (
              <Card
                key={song.id}
                label={`Reproduzir ${song.title}`}
                artwork={
                  <Cover path={song.cover_url} seed={song.id} size={card} radius={10} />
                }
                title={song.title}
                subtitle={getArtistName(song)}
                onPress={() => onSelectSong(song, songs, HOME_QUEUE)}
              />
            ))}
          </Shelf>
        )}

        {albums.length > 0 && (
          <Shelf
            title="Os teus álbuns"
            onShowAll={
              albums.length > SHOW_ALL_FROM ? () => setShowAll("albums") : undefined
            }
          >
            {albums.map((album) => (
              <Card
                key={album.id}
                label={`Abrir o álbum ${album.title}`}
                artwork={
                  <Cover path={album.cover_url} seed={album.id} size={card} radius={10} />
                }
                title={album.title}
                subtitle={`Álbum · ${artistNameFor(album.artist_id)}`}
                onPress={() => onOpenInLibrary?.({ kind: "album", id: album.id })}
              />
            ))}
          </Shelf>
        )}

        {/* Os artistas são pessoas: círculo, não quadrado, e menores
            que os álbuns, para as duas filas não competirem. */}
        {artists.length > 0 && (
          <Shelf
            title="Artistas"
            onShowAll={
              artists.length > SHOW_ALL_FROM ? () => setShowAll("artists") : undefined
            }
          >
            {artists.map((artist) => (
              <PressableScale
                key={artist.id}
                style={{ width: avatarSize }}
                onPress={() => onOpenInLibrary?.({ kind: "artist", id: artist.id })}
                accessibilityLabel={`Abrir o artista ${artist.name}`}
              >
                <ArtistAvatar
                  name={artist.name}
                  photo={artist.photo_url}
                  size={avatarSize}
                />
                <Text style={styles.artistName} numberOfLines={1}>
                  {artist.name}
                </Text>
              </PressableScale>
            ))}
          </Shelf>
        )}

        {/* Uma playlist não tem capa própria: como linha diz mais
            (nome e quantas músicas) e ocupa menos. */}
        {playlists.length > 0 && (
          <View style={styles.shelf}>
            <SectionTitle
              title="As tuas playlists"
              onShowAll={
                playlists.length > SHOW_ALL_FROM
                  ? () => setShowAll("playlists")
                  : undefined
              }
            />

            {playlists.map((playlist) => (
              <PressableScale
                key={playlist.id}
                style={styles.playlistRow}
                scaleTo={0.99}
                onPress={() => onOpenInLibrary?.({ kind: "playlist", id: playlist.id })}
                accessibilityLabel={`Abrir a playlist ${playlist.name}`}
              >
                <View style={styles.playlistIcon}>
                  <Ionicons
                    name="musical-notes"
                    size={22}
                    color={colors.primaryLight}
                  />
                </View>

                <View style={styles.flex}>
                  <Text style={styles.playlistName} numberOfLines={1}>
                    {playlist.name}
                  </Text>
                  <Text style={styles.playlistMeta}>
                    {playlist.song_count}{" "}
                    {playlist.song_count === 1 ? "música" : "músicas"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              </PressableScale>
            ))}
          </View>
        )}

        {songs.length > 0 && (
          <View style={styles.listHeader}>
            <View style={styles.flex}>
              <Text style={styles.listTitle}>Todas as músicas</Text>
              <Text style={styles.listMeta}>
                {songs.length} {songs.length === 1 ? "música" : "músicas"} ·{" "}
                {formatDuration(
                  songs.reduce((total, song) => total + (song.duration || 0), 0)
                )}
              </Text>
            </View>

            <DetailActions
              compact
              songs={songs}
              queueId={HOME_QUEUE}
              onSelectSong={onSelectSong}
            />
          </View>
        )}
      </View>
    );
  }

  function renderEmpty() {
    if (loading) {
      return (
        <View>
          {waking && (
            <View style={styles.waking}>
              <ActivityIndicator color={colors.primaryLight} />
              <View style={styles.flex}>
                <Text style={styles.wakingTitle}>A acordar o servidor…</Text>
                <Text style={styles.wakingText}>
                  No plano gratuito, a primeira visita depois de uma pausa pode
                  demorar até um minuto.
                </Text>
              </View>
            </View>
          )}
          <SongListSkeleton count={5} />
        </View>
      );
    }

    return (
      <View style={styles.empty}>
        <Ionicons
          name={error ? "cloud-offline-outline" : "musical-notes-outline"}
          size={40}
          color={colors.textTertiary}
        />
        <Text style={styles.message}>
          {error || "Ainda não existem músicas na biblioteca."}
        </Text>

        {!!error && (
          <>
            {/* O endereço que a app tentou: dá para o abrir no browser
                do telemóvel e ver logo se o problema é a rede. */}
            <Text style={styles.address}>{API_URL}</Text>

            <Pressable
              onPress={() => void load()}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  if (showAll) {
    const entries = showAllEntries(showAll);
    const [one, many] = SHOW_ALL_WORDS[showAll];

    return (
      <ShowAllScreen
        title={SHOW_ALL_TITLES[showAll]}
        chips={SHOW_ALL_CHIPS}
        active={showAll}
        onSelectChip={setShowAll}
        entries={entries}
        countLabel={`${entries.length} ${entries.length === 1 ? one : many}`}
        onBack={() => setShowAll(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={error ? [] : songs}
        // As linhas dependem da música a tocar e dos favoritos, não só
        // da lista: sem isto podiam ficar com a marca na música anterior.
        extraData={`${currentSong?.id ?? ""}|${favoriteIds.join(",")}`}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isFavorite = favoriteIds.includes(item.id);
          const isCurrent = currentSong?.id === item.id;

          return (
            <SongRow
              song={item}
              active={isCurrent}
              showDuration={!isCurrent}
              onPress={() => onSelectSong(item, songs, HOME_QUEUE)}
              trailing={
                <View style={styles.rowTrailing}>
                  {isCurrent && <PlayingBars />}

                  <Pressable
                    onPress={() => void toggleFavorite(item.id)}
                    style={styles.favoriteButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
                    }
                  >
                    <Ionicons
                      name={isFavorite ? "heart" : "heart-outline"}
                      size={22}
                      color={isFavorite ? colors.primaryLight : colors.textTertiary}
                    />
                  </Pressable>
                </View>
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginBottom: 20,
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
  flex: {
    flex: 1,
  },
  logo: {
    ...display.screen,
    color: colors.text,
    fontSize: 24,
  },
  // Quanto tens, em números reais: a coleção é tua e é pequena, e isso
  // é para se ver com orgulho, não para esconder.
  inventory: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2,
  },
  logoAccent: {
    color: colors.primary,
  },
  topButton: {
    width: 44,
    height: 44,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  // O único bloco dominante da página: capa grande, uma ação clara.
  hero: {
    marginBottom: 30,
  },
  heroInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroCover: {
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  heroText: {
    flex: 1,
  },
  heroLabel: {
    color: colors.text,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 2,
    opacity: 0.75,
  },
  heroTitle: {
    ...display.card,
    color: colors.text,
    fontSize: 20,
    marginTop: 6,
  },
  heroArtist: {
    color: colors.textSecondary,
    fontSize: 13.5,
    marginTop: 3,
  },
  heroAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  // A tocar, o círculo escurece para as barras se lerem bem.
  heroActionLive: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  shelf: {
    marginBottom: 26,
  },
  shelfHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  shelfTitle: {
    ...display.section,
    flex: 1,
    color: colors.text,
  },
  showAll: {
    minHeight: 40,
    justifyContent: "center",
    paddingLeft: 12,
  },
  showAllText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  // O espaço à direita deixa o último cartão respirar ao deslizar.
  shelfRow: {
    gap: 16,
    paddingRight: 20,
  },
  // Sombra por baixo das capas: dá relevo sem precisar de contorno.
  cardArtwork: {
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderRadius: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "700",
    marginTop: 10,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 3,
  },
  artistName: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 9,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  playlistMeta: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2,
  },
  rowPlaylistArt: {
    width: ROW,
    height: ROW,
    borderRadius: 6,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  listTitle: {
    ...display.section,
    color: colors.text,
  },
  listMeta: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 3,
  },
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 6,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  waking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wakingTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "700",
  },
  wakingText: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  address: {
    color: colors.textTertiary,
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  retryText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: "700",
  },
});
