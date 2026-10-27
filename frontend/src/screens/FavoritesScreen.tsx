import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayerStatus } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Cover from "../components/Cover";
import PlayingBars from "../components/PlayingBars";
import { SongListSkeleton } from "../components/Skeleton";
import SongRow from "../components/SongRow";
import { usePlayer } from "../player/PlayerContext";
import { api } from "../services/api";
import { useFavoriteIds } from "../hooks/useFavoriteIds";
import { removeFavoriteLater, UNDO_DELAY } from "../services/favorites";
import { colors, heroGradient } from "../theme/colors";
import { display } from "../theme/typography";
import type { Song } from "../types/song";
import { haptics } from "../utils/haptics";
import { getArtistName } from "../utils/media";

type Props = {
  onSelectSong: (song: Song, queue: Song[], queueId?: string | null) => void;
};

// O nome desta fila, para os botões saberem se são os favoritos que
// estão a tocar (e não a mesma música vinda de um álbum).
const FAVORITES_QUEUE = "favoritos";

// A procura e a escolha de ordem só aparecem com uma lista que já as
// justifique: com três músicas seriam ruído.
const TOOLS_FROM = 9;

type Order = "recentes" | "nome" | "artista";
const ORDER_NEXT: Record<Order, Order> = {
  recentes: "nome",
  nome: "artista",
  artista: "recentes",
};
const ORDER_LABEL: Record<Order, string> = {
  recentes: "Recentes",
  nome: "Nome",
  artista: "Artista",
};

// Os dois botões do cartão. Ficam num componente à parte porque leem o
// estado do leitor, que muda a cada segundo: assim só eles se redesenham,
// e não a página inteira.
function HeroActions({
  songs,
  onSelectSong,
}: {
  songs: Song[];
  onSelectSong: Props["onSelectSong"];
}) {
  const { player, queueId, shuffleOn, togglePlayback, playShuffled } = usePlayer();
  const status = useAudioPlayerStatus(player);

  const isThisList = queueId === FAVORITES_QUEUE;
  const isPlaying = isThisList && status.playing;
  const shuffleActive = isThisList && shuffleOn;

  return (
    <View style={styles.heroActions}>
      <Pressable
        onPress={() => {
          haptics.selection();
          playShuffled(songs, FAVORITES_QUEUE);
        }}
        style={({ pressed }) => [
          styles.pill,
          shuffleActive && styles.pillOn,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: shuffleActive }}
        accessibilityLabel="Tocar os favoritos por ordem aleatória"
      >
        <Ionicons
          name="shuffle"
          size={18}
          color={shuffleActive ? colors.background : colors.white}
        />
        <Text style={[styles.pillText, shuffleActive && styles.pillTextOn]}>
          Ordem aleatória
        </Text>
      </Pressable>

      <View style={styles.spacer} />

      <Pressable
        onPress={() => {
          haptics.medium();
          if (isThisList) togglePlayback();
          else onSelectSong(songs[0], songs, FAVORITES_QUEUE);
        }}
        style={({ pressed }) => [styles.playAll, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pausar os favoritos" : "Tocar todos os favoritos"}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={24}
          color={colors.background}
          style={isPlaying ? undefined : styles.playAllIcon}
        />
      </Pressable>
    </View>
  );
}

// Lado do mosaico de capas do cabeçalho.
const ARTWORK = 84;

export default function FavoritesScreen({ onSelectSong }: Props) {
  const { currentSong } = usePlayer();
  // Guardamos todas as músicas e escolhemos as favoritas a cada momento:
  // assim, uma música juntada aos favoritos no leitor aparece logo aqui.
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const favoriteIds = useFavoriteIds();

  // Pela ordem em que as guardaste — a última primeiro —, e não pela
  // ordem em que entraram no app.
  const songs = useMemo(() => {
    const byId = new Map(allSongs.map((song) => [song.id, song]));
    return favoriteIds
      .map((id) => byId.get(id))
      .filter((song): song is Song => song !== undefined);
  }, [allSongs, favoriteIds]);

  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<Order>("recentes");
  const showTools = songs.length >= TOOLS_FROM;

  const visible = useMemo(() => {
    if (!showTools) return songs;

    const search = query.trim().toLowerCase();
    const found = search
      ? songs.filter(
          (song) =>
            song.title.toLowerCase().includes(search) ||
            getArtistName(song).toLowerCase().includes(search)
        )
      : songs;

    if (order === "recentes") return found;

    const key = order === "nome" ? (song: Song) => song.title : getArtistName;
    return [...found].sort((a, b) => key(a).localeCompare(key(b), "pt"));
  }, [songs, query, order, showTools]);

  // "Desfazer" depois de tirar um favorito.
  const [undoInfo, setUndoInfo] = useState<{ title: string; undo: () => void } | null>(
    null
  );
  const undoAppear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!undoInfo) return;

    undoAppear.setValue(0);
    Animated.timing(undoAppear, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => setUndoInfo(null), UNDO_DELAY);
    return () => clearTimeout(timer);
  }, [undoInfo, undoAppear]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/songs/");
      const data: unknown = response.data;
      const fetched: Song[] = Array.isArray(data)
        ? data
        : data &&
            typeof data === "object" &&
            "items" in data &&
            Array.isArray(data.items)
          ? data.items
          : [];

      setAllSongs(fetched);
    } catch (loadError) {
      console.error("Erro ao carregar favoritos:", loadError);
      setError("Não foi possível carregar os favoritos. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  // Sai logo da lista; o servidor só é avisado quando o "Desfazer" acaba.
  function removeFavorite(song: Song) {
    haptics.selection();
    setUndoInfo({ title: song.title, undo: removeFavoriteLater(song.id) });
  }

  const totalMinutes = Math.max(
    1,
    Math.round(songs.reduce((sum, song) => sum + (song.duration || 0), 0) / 60)
  );

  // Mosaico com as capas das músicas guardadas: a partir de quatro
  // favoritos mostra quatro capas, como as playlists do Spotify.
  function renderArtwork() {
    if (songs.length === 0) {
      return (
        <View style={styles.heroIcon}>
          <Ionicons name="heart" size={32} color={colors.white} />
        </View>
      );
    }

    const tiles = songs.length >= 4 ? songs.slice(0, 4) : [songs[0]];
    const tileSize = tiles.length > 1 ? ARTWORK / 2 : ARTWORK;

    return (
      <View style={styles.artwork}>
        <View style={styles.mosaic}>
          {tiles.map((song) => (
            <Cover
              key={song.id}
              path={song.cover_url}
              seed={song.id}
              size={tileSize}
              radius={0}
            />
          ))}
        </View>

        <View style={styles.artworkBadge}>
          <Ionicons name="heart" size={13} color={colors.white} />
        </View>
      </View>
    );
  }

  function renderHeader() {
    return (
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          {renderArtwork()}

          <View style={styles.heroInfo}>
            <Text style={styles.heroLabel}>A TUA LISTA</Text>
            <Text style={styles.heroTitle}>Favoritos</Text>
            <Text style={styles.heroMeta}>
              {songs.length} {songs.length === 1 ? "música" : "músicas"}
              {songs.length > 0 ? ` · ${totalMinutes} min` : ""}
            </Text>
          </View>
        </View>

        {songs.length > 0 && (
          <HeroActions songs={songs} onSelectSong={onSelectSong} />
        )}
      </LinearGradient>
    );
  }

  function renderTools() {
    if (!showTools) return null;

    return (
      <View style={styles.tools}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Encontrar nos favoritos"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            accessibilityLabel="Encontrar nos favoritos"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Limpar a procura"
            >
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => {
            haptics.selection();
            setOrder((current) => ORDER_NEXT[current]);
          }}
          style={({ pressed }) => [styles.orderButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Ordem: ${ORDER_LABEL[order]}. Tocar para mudar.`}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.text} />
          <Text style={styles.orderText}>{ORDER_LABEL[order]}</Text>
        </Pressable>
      </View>
    );
  }

  // Com poucas músicas, a página ficava um vazio por baixo da lista.
  // Uma linha discreta diz como se junta mais, sem ocupar o lugar delas.
  function renderFooter() {
    if (loading || error || songs.length === 0 || songs.length >= 4) return null;

    return (
      <View style={styles.hint}>
        <Ionicons name="heart-outline" size={20} color={colors.textTertiary} />
        <Text style={styles.hintText}>
          Toca no coração de qualquer música — no Início ou no leitor — para a
          juntares aqui.
        </Text>
      </View>
    );
  }

  function renderEmpty() {
    if (loading) {
      return <SongListSkeleton count={3} />;
    }

    if (!error && songs.length > 0 && visible.length === 0) {
      return (
        <Text style={styles.message}>
          Nenhum favorito corresponde a "{query.trim()}".
        </Text>
      );
    }

    if (error) {
      return (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={() => void loadFavorites()}
            accessibilityRole="button"
            style={styles.retry}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="heart-outline" size={30} color={colors.primaryLight} />
        </View>
        <Text style={styles.emptyTitle}>Ainda não tens favoritos</Text>
        <Text style={styles.message}>
          Toca no coração de uma música — no Início ou no leitor — para a
          guardares aqui.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={loading || error ? [] : visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        // Um elemento, e não a função: com a função, o cabeçalho era
        // recriado a cada letra e a caixa de procura perdia o teclado.
        ListHeaderComponent={
          <View>
            {renderHeader()}
            {renderTools()}
          </View>
        }
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        // As linhas também dependem da música a tocar, não só da lista.
        extraData={currentSong?.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isCurrent = currentSong?.id === item.id;

          return (
            <SongRow
              song={item}
              position={index + 1}
              active={isCurrent}
              showDuration={false}
              onPress={() => onSelectSong(item, visible, FAVORITES_QUEUE)}
              trailing={
                <View style={styles.rowTrailing}>
                  {isCurrent && <PlayingBars />}

                  <Pressable
                    onPress={() => removeFavorite(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${item.title} dos favoritos`}
                    style={styles.remove}
                  >
                    <Ionicons name="heart" size={22} color={colors.primaryLight} />
                  </Pressable>
                </View>
              }
            />
          );
        }}
      />

      {undoInfo && (
        <Animated.View
          style={[
            styles.snackbar,
            {
              opacity: undoAppear,
              transform: [
                {
                  translateY: undoAppear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.snackText} numberOfLines={1}>
            «{undoInfo.title}» saiu dos favoritos
          </Text>

          <Pressable
            onPress={() => {
              haptics.selection();
              undoInfo.undo();
              setUndoInfo(null);
            }}
            style={styles.snackButton}
            accessibilityRole="button"
            accessibilityLabel={`Desfazer: voltar a guardar ${undoInfo.title}`}
          >
            <Text style={styles.snackAction}>Desfazer</Text>
          </Pressable>
        </Animated.View>
      )}
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 91, 0.25)",
    overflow: "hidden",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  heroIcon: {
    width: ARTWORK,
    height: ARTWORK,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  artwork: {
    width: ARTWORK,
    height: ARTWORK,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  mosaic: {
    width: ARTWORK,
    height: ARTWORK,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  // Pequeno coração por cima das capas, para a lista continuar
  // reconhecível à primeira vista.
  artworkBadge: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(12, 10, 9, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: {
    flex: 1,
  },
  // Por cima do gradiente brasa: osso, e não brasa clara (que ali quase
  // não se lia).
  heroLabel: {
    color: "rgba(245, 240, 234, 0.8)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  heroTitle: {
    ...display.screen,
    color: colors.text,
    marginTop: 2,
  },
  // Por cima do gradiente brasa: osso translúcido, que mantém o
  // contraste (o cinzento secundário ficava ilegível sobre laranja).
  heroMeta: {
    color: "rgba(245, 240, 234, 0.85)",
    fontSize: 13,
    marginTop: 2,
  },
  // Os botões ficam dentro do cartão, na mesma linha, como no Início.
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },
  spacer: {
    flex: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  pillOn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pillTextOn: {
    color: colors.background,
  },
  pillText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "600",
  },
  playAll: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  playAllIcon: {
    marginLeft: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingLeft: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 14.5,
  },
  clearButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  orderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
  },
  orderText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "700",
  },
  snackbar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 52,
    paddingLeft: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  snackText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  snackButton: {
    height: 52,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  snackAction: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: "800",
  },
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 6,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  hintText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  remove: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: "center",
  },
  retry: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
  },
  retryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
});
