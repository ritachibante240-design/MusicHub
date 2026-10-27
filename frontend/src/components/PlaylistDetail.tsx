import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import ActionSheet from "./ActionSheet";
import Cover from "./Cover";
import DetailActions from "./DetailActions";
import NamePrompt from "./NamePrompt";
import PlayingBars from "./PlayingBars";
import { SongListSkeleton } from "./Skeleton";
import SongRow from "./SongRow";
import StickyTitleBar from "./StickyTitleBar";
import { usePlayer } from "../player/PlayerContext";
import {
  addSongToPlaylist,
  deletePlaylist,
  describeError,
  getPlaylist,
  removeSongFromPlaylist,
  renamePlaylist,
} from "../services/catalog";
import { colors, seedColor } from "../theme/colors";
import { display } from "../theme/typography";
import type { PlaylistDetailData } from "../types/playlist";
import type { Song } from "../types/song";
import { formatDuration } from "../utils/media";

type Props = {
  playlistId: number;
  allSongs: Song[];
  onBack: () => void;
  onSelectSong: (song: Song, queue: Song[], queueId?: string | null) => void;
  onChanged: () => void;
};

const ARTWORK = 230;

export default function PlaylistDetail({
  playlistId,
  allSongs,
  onBack,
  onSelectSong,
  onChanged,
}: Props) {
  const { currentSong } = usePlayer();
  const queueId = `playlist:${playlistId}`;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [playlist, setPlaylist] = useState<PlaylistDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [query, setQuery] = useState("");
  const [sorted, setSorted] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setPlaylist(await getPlaylist(playlistId));
    } catch (err) {
      console.error("Erro ao carregar a playlist:", err);
      setError(describeError(err, "Não foi possível carregar a playlist."));
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    void load();
  }, [load]);

  const songs = useMemo(() => playlist?.songs ?? [], [playlist]);

  // A pesquisa filtra dentro da playlist; "Ordenar" alterna entre a
  // ordem em que foram juntas e a ordem alfabética.
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = search
      ? songs.filter((song) => song.title.toLowerCase().includes(search))
      : songs;

    if (!sorted) return filtered;

    return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, query, sorted]);

  const missing = allSongs.filter(
    (song) => !songs.some((inPlaylist) => inPlaylist.id === song.id)
  );

  async function add(song: Song) {
    try {
      await addSongToPlaylist(playlistId, song.id);
      await load();
      onChanged();
    } catch (err) {
      console.error("Erro ao adicionar à playlist:", err);
      setError(describeError(err, "Não foi possível adicionar a música."));
    }
  }

  async function remove(song: Song) {
    try {
      await removeSongFromPlaylist(playlistId, song.id);
      await load();
      onChanged();
    } catch (err) {
      console.error("Erro ao remover da playlist:", err);
      setError(describeError(err, "Não foi possível remover a música."));
    }
  }

  async function saveName(name: string) {
    try {
      setSavingName(true);
      await renamePlaylist(playlistId, name);
      setRenaming(false);
      await load();
      onChanged();
    } catch (err) {
      console.error("Erro ao mudar o nome:", err);
      setError(describeError(err, "Não foi possível mudar o nome."));
    } finally {
      setSavingName(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Apagar a playlist?",
      "As músicas não são apagadas: só deixam de estar nesta playlist.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePlaylist(playlistId);
              onChanged();
              onBack();
            } catch (err) {
              console.error("Erro ao apagar a playlist:", err);
              setError(describeError(err, "Não foi possível apagar a playlist."));
            }
          },
        },
      ]
    );
  }

  if (loading && !playlist) {
    return (
      <View style={styles.container}>
        <View style={[styles.topBar, styles.skeletonBar]}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <SongListSkeleton count={4} />
        </View>
      </View>
    );
  }

  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration || 0), 0);
  const tiles = songs.length >= 4 ? songs.slice(0, 4) : songs.slice(0, 1);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[seedColor(playlistId), colors.background]}
        style={styles.backdrop}
        pointerEvents="none"
      />

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={() => setMenuOpen(true)}
                style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Mais opções"
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
              </Pressable>
            </View>

            {songs.length > 0 && (
              <View style={styles.tools}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={colors.text} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Encontrar na playlist"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.searchInput}
                    accessibilityLabel="Encontrar na playlist"
                  />
                </View>

                <Pressable
                  onPress={() => setSorted((value) => !value)}
                  style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={sorted ? "Ordem original" : "Ordenar por nome"}
                >
                  <Text style={styles.sortText}>
                    {sorted ? "A-Z" : "Ordenar"}
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.artworkWrap}>
              <View style={styles.artwork}>
                {tiles.length > 0 ? (
                  tiles.map((song) => (
                    <Cover
                      key={song.id}
                      path={song.cover_url}
                      seed={song.id}
                      size={tiles.length > 1 ? ARTWORK / 2 : ARTWORK}
                      radius={0}
                    />
                  ))
                ) : (
                  <View style={styles.emptyArtwork}>
                    <Ionicons name="musical-notes" size={64} color={colors.primaryLight} />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.body}>
              <Text style={styles.title}>{playlist?.name ?? ""}</Text>

              <Text style={styles.meta}>
                Playlist · {songs.length}{" "}
                {songs.length === 1 ? "música" : "músicas"}
                {songs.length > 0 ? ` · ${formatDuration(totalSeconds)}` : ""}
              </Text>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <DetailActions
                songs={songs}
                queueId={queueId}
                onSelectSong={onSelectSong}
              />

              <Pressable
                onPress={() => setPicking(true)}
                style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Adicionar músicas à playlist"
              >
                <View style={styles.addIcon}>
                  <Ionicons name="add" size={24} color={colors.text} />
                </View>
                <Text style={styles.addText}>Adicionar músicas</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.message}>
            {query.trim()
              ? `Nenhuma música corresponde a "${query.trim()}".`
              : "Esta playlist ainda não tem músicas."}
          </Text>
        }
        renderItem={({ item }) => {
          const isCurrent = currentSong?.id === item.id;

          return (
            <View style={styles.body}>
              <SongRow
                song={item}
                active={isCurrent}
                showDuration={false}
                onPress={() => onSelectSong(item, visible, queueId)}
                trailing={
                  <View style={styles.trailing}>
                    {isCurrent && <PlayingBars />}

                    <Pressable
                      onPress={() => void remove(item)}
                      style={styles.removeButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${item.title} da playlist`}
                    >
                      <Ionicons
                        name="remove-circle-outline"
                        size={22}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  </View>
                }
              />
            </View>
          );
        }}
      />

      <StickyTitleBar
        title={playlist?.name ?? ""}
        color={seedColor(playlistId)}
        scrollY={scrollY}
        appearAt={280}
        onBack={onBack}
        onMenu={() => setMenuOpen(true)}
      />

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        options={[
          {
            icon: "create-outline",
            title: "Mudar o nome",
            description: "Dá outro nome a esta playlist",
            onPress: () => setRenaming(true),
          },
          {
            icon: "trash-outline",
            title: "Apagar playlist",
            description: "As músicas continuam na tua biblioteca",
            onPress: confirmDelete,
          },
        ]}
      />

      <NamePrompt
        visible={renaming}
        title="Novo nome da playlist"
        placeholder={playlist?.name ?? "Nome"}
        confirmLabel="Guardar"
        saving={savingName}
        onCancel={() => setRenaming(false)}
        onConfirm={(name) => void saveName(name)}
      />

      <Modal
        visible={picking}
        animationType="slide"
        onRequestClose={() => setPicking(false)}
        statusBarTranslucent
      >
        <View style={styles.container}>
          <View style={styles.pickerHeader}>
            <Pressable
              onPress={() => setPicking(false)}
              style={styles.roundButton}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.pickerTitle}>Adicionar músicas</Text>
          </View>

          <FlatList
            data={missing}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.message}>
                Todas as tuas músicas já estão nesta playlist.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.body}>
                <SongRow
                  song={item}
                  showDuration={false}
                  onPress={() => void add(item)}
                  trailing={
                    <Pressable
                      onPress={() => void add(item)}
                      style={styles.removeButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Adicionar ${item.title}`}
                    >
                      <Ionicons name="add-circle" size={26} color={colors.primary} />
                    </Pressable>
                  }
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 520,
    opacity: 0.5,
  },
  list: {
    paddingTop: 10,
    paddingBottom: 24,
  },
  body: {
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  skeletonBar: {
    paddingTop: 10,
    marginBottom: 6,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 14.5,
  },
  sortButton: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  sortText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  artworkWrap: {
    alignItems: "center",
    marginTop: 26,
    marginBottom: 22,
  },
  // Mosaico com as quatro primeiras capas, como as playlists do Spotify.
  artwork: {
    width: ARTWORK,
    height: ARTWORK,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
    backgroundColor: colors.surfaceLight,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  emptyArtwork: {
    width: ARTWORK,
    height: ARTWORK,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...display.screen,
    color: colors.text,
    fontSize: 28,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  addIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  removeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  pickerTitle: {
    ...display.section,
    color: colors.text,
  },
  error: {
    color: colors.danger,
    fontSize: 13.5,
    marginTop: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    paddingTop: 20,
    paddingHorizontal: 20,
    lineHeight: 21,
  },
});
