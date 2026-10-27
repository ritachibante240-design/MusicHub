import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ActionSheet from "./ActionSheet";
import ArtistAvatar from "./ArtistAvatar";
import Cover from "./Cover";
import DetailActions from "./DetailActions";
import PlayingBars from "./PlayingBars";
import SongRow from "./SongRow";
import StickyTitleBar from "./StickyTitleBar";
import { usePlayer } from "../player/PlayerContext";
import { deleteAlbum, describeError } from "../services/catalog";
import { colors, seedColor } from "../theme/colors";
import { display } from "../theme/typography";
import type { Album } from "../types/album";
import type { Song } from "../types/song";
import { formatDuration } from "../utils/media";

type Props = {
  album: Album;
  artistName?: string | null;
  artistPhoto?: string | null;
  songs: Song[];
  onBack: () => void;
  onSelectSong: (song: Song, queue: Song[], queueId?: string | null) => void;
  onOpenArtist?: () => void;
  onDeleted: () => void;
};

export default function AlbumDetail({
  album,
  artistName,
  artistPhoto,
  songs,
  onBack,
  onSelectSong,
  onOpenArtist,
  onDeleted,
}: Props) {
  const { currentSong } = usePlayer();
  const queueId = `album:${album.id}`;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");

  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration || 0), 0);
  const meta = [
    "Álbum",
    album.release_year ? String(album.release_year) : null,
    `${songs.length} ${songs.length === 1 ? "música" : "músicas"}`,
    formatDuration(totalSeconds),
  ]
    .filter(Boolean)
    .join(" · ");

  function confirmDelete() {
    Alert.alert(
      "Apagar o álbum?",
      "As músicas não são apagadas: apenas deixam de pertencer a este álbum.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAlbum(album.id);
              onDeleted();
              onBack();
            } catch (err) {
              console.error("Erro ao apagar o álbum:", err);
              setError(describeError(err, "Não foi possível apagar o álbum."));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[seedColor(album.id), colors.background]}
        style={styles.backdrop}
        pointerEvents="none"
      />

      <FlatList
        data={songs}
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

            <View style={styles.coverWrap}>
              <Cover
                path={album.cover_url}
                seed={album.id}
                size={230}
                radius={6}
                style={styles.cover}
              />
            </View>

            <Text style={styles.title}>{album.title}</Text>

            <Pressable
              onPress={onOpenArtist}
              disabled={!onOpenArtist}
              style={({ pressed }) => [styles.artistRow, pressed && styles.pressed]}
              accessibilityRole={onOpenArtist ? "button" : undefined}
              accessibilityLabel={
                onOpenArtist && artistName
                  ? `Abrir o artista ${artistName}`
                  : undefined
              }
            >
              <ArtistAvatar
                name={artistName ?? "?"}
                photo={artistPhoto}
                size={26}
              />
              <Text style={styles.artistName} numberOfLines={1}>
                {artistName ?? "Sem artista"}
              </Text>
            </Pressable>

            <Text style={styles.meta}>{meta}</Text>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <DetailActions
              songs={songs}
              queueId={queueId}
              onSelectSong={onSelectSong}
            />

            {songs.length > 0 && (
              <Text style={styles.sectionTitle}>Músicas</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.message}>Este álbum ainda não tem músicas.</Text>
        }
        renderItem={({ item }) => {
          const isCurrent = currentSong?.id === item.id;

          return (
            <SongRow
              song={item}
              active={isCurrent}
              showDuration={false}
              onPress={() => onSelectSong(item, songs, queueId)}
              trailing={
                <View style={styles.duration}>
                  {isCurrent ? (
                    <PlayingBars />
                  ) : (
                    <Text style={styles.durationText}>
                      {formatDuration(item.duration)}
                    </Text>
                  )}
                </View>
              }
            />
          );
        }}
      />

      <StickyTitleBar
        title={album.title}
        color={seedColor(album.id)}
        scrollY={scrollY}
        appearAt={200}
        onBack={onBack}
        onMenu={() => setMenuOpen(true)}
      />

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        options={[
          {
            icon: "trash-outline",
            title: "Apagar álbum",
            description: "As músicas ficam sem álbum, mas não são apagadas",
            onPress: confirmDelete,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // A cor do topo vem da capa e esbate-se no fundo escuro.
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 460,
    opacity: 0.55,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: -4,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverWrap: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 22,
  },
  cover: {
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  title: {
    ...display.screen,
    color: colors.text,
    fontSize: 27,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  artistName: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "700",
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  sectionTitle: {
    ...display.section,
    color: colors.text,
    fontSize: 17,
    marginTop: 10,
    marginBottom: 2,
  },
  duration: {
    minWidth: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  durationText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
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
  },
});
