import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import ActionSheet from "./ActionSheet";
import Cover from "./Cover";
import DetailActions from "./DetailActions";
import PlayingBars from "./PlayingBars";
import SongRow from "./SongRow";
import StickyTitleBar from "./StickyTitleBar";
import { usePlayer } from "../player/PlayerContext";
import {
  deleteArtist,
  describeError,
  pickAndUploadImage,
  updateArtist,
} from "../services/catalog";
import { colors, seedColor } from "../theme/colors";
import { display } from "../theme/typography";
import { confirmDestructive } from "../utils/confirm";
import type { Album } from "../types/album";
import type { Song } from "../types/song";
import { formatDuration, getMediaUrl } from "../utils/media";

type Props = {
  artistId: number | null;
  name: string;
  photo?: string | null;
  bio?: string | null;
  songs: Song[];
  albums: Album[];
  onBack: () => void;
  onSelectSong: (song: Song, queue: Song[], queueId?: string | null) => void;
  onOpenAlbum: (albumId: number) => void;
  onUpdated: () => void;
};

export default function ArtistDetail({
  artistId,
  name,
  photo,
  bio,
  songs,
  albums,
  onBack,
  onSelectSong,
  onOpenAlbum,
  onUpdated,
}: Props) {
  const { width } = useWindowDimensions();
  const { currentSong } = usePlayer();
  const queueId = `artista:${artistId ?? "sem"}`;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const photoUri = getMediaUrl(photo);
  const headerHeight = Math.round(width * 0.92);

  // "Artista desconhecido" é só um agrupamento: não se edita nem apaga.
  const isReal = artistId != null;

  async function changePhoto() {
    if (!isReal) return;

    try {
      setError("");
      setUploading(true);

      const url = await pickAndUploadImage();

      if (!url) return;

      await updateArtist(artistId, { name, bio, photo_url: url });
      onUpdated();
    } catch (err) {
      console.error("Erro ao mudar a foto:", err);
      setError(describeError(err, "Não foi possível mudar a foto."));
    } finally {
      setUploading(false);
    }
  }

  function confirmDelete() {
    if (!isReal) return;

    confirmDestructive(
      "Apagar o artista?",
      "As músicas e os álbuns não são apagados: apenas ficam sem artista.",
      "Apagar",
      async () => {
        try {
          await deleteArtist(artistId);
          onUpdated();
          onBack();
        } catch (err) {
          console.error("Erro ao apagar o artista:", err);
          setError(describeError(err, "Não foi possível apagar o artista."));
        }
      }
    );
  }

  return (
    <View style={styles.container}>
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
            {/* Foto a ocupar a largura toda, com o nome por cima. */}
            <View style={[styles.header, { height: headerHeight }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <LinearGradient
                  colors={[seedColor(artistId ?? 0), colors.background]}
                  style={styles.photo}
                />
              )}

              <LinearGradient
                colors={["rgba(0,0,0,0.45)", "transparent", colors.background]}
                locations={[0, 0.45, 1]}
                style={styles.scrim}
                pointerEvents="none"
              />

              <View style={styles.topBar}>
                <Pressable
                  onPress={onBack}
                  style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar"
                >
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>

                {isReal && (
                  <Pressable
                    onPress={() => setMenuOpen(true)}
                    style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Mais opções"
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
                  </Pressable>
                )}
              </View>

              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
            </View>

            <View style={styles.body}>
              <Text style={styles.meta}>
                {songs.length} {songs.length === 1 ? "música" : "músicas"} ·{" "}
                {formatDuration(songs.reduce((sum, song) => sum + (song.duration || 0), 0))}
              </Text>

              {!!bio && <Text style={styles.bio}>{bio}</Text>}
              {!!error && <Text style={styles.error}>{error}</Text>}

              <DetailActions
                songs={songs}
                queueId={queueId}
                onSelectSong={onSelectSong}
              />

              {albums.length > 0 && (
                <View style={styles.albums}>
                  <Text style={styles.sectionTitle}>Álbuns</Text>

                  {albums.map((album) => (
                    <Pressable
                      key={album.id}
                      onPress={() => onOpenAlbum(album.id)}
                      style={({ pressed }) => [styles.albumRow, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir o álbum ${album.title}`}
                    >
                      <Cover path={album.cover_url} seed={album.id} size={50} radius={6} />

                      <View style={styles.flex}>
                        <Text style={styles.albumTitle} numberOfLines={1}>
                          {album.title}
                        </Text>
                        <Text style={styles.albumMeta}>
                          {album.release_year ? `Álbum · ${album.release_year}` : "Álbum"}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.textTertiary}
                      />
                    </Pressable>
                  ))}
                </View>
              )}

              {songs.length > 0 && (
                <Text style={styles.sectionTitle}>Populares</Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.message}>Este artista ainda não tem músicas.</Text>
        }
        renderItem={({ item, index }) => {
          const isCurrent = currentSong?.id === item.id;

          return (
            <View style={styles.body}>
              <SongRow
                song={item}
                position={index + 1}
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
            </View>
          );
        }}
      />

      <StickyTitleBar
        title={name}
        color={seedColor(artistId ?? 0)}
        scrollY={scrollY}
        appearAt={headerHeight - 150}
        onBack={onBack}
        onMenu={isReal ? () => setMenuOpen(true) : undefined}
      />

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        options={[
          {
            icon: uploading ? "hourglass-outline" : "camera-outline",
            title: "Mudar a foto",
            description: "Escolhe uma imagem da galeria",
            onPress: changePhoto,
          },
          {
            icon: "trash-outline",
            title: "Apagar artista",
            description: "As músicas ficam sem artista, mas não são apagadas",
            onPress: confirmDelete,
          },
        ]}
      />

      {uploading && (
        <View style={styles.uploading}>
          <ActivityIndicator color={colors.primaryLight} />
        </View>
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
    paddingBottom: 24,
  },
  flex: {
    flex: 1,
  },
  header: {
    justifyContent: "flex-end",
  },
  photo: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surfaceLight,
  },
  // Escurece o topo e o fundo, para o nome e os botões se lerem bem.
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  topBar: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    ...display.screen,
    color: colors.text,
    fontSize: 44,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  body: {
    paddingHorizontal: 20,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13.5,
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  albums: {
    marginTop: 10,
  },
  sectionTitle: {
    ...display.section,
    color: colors.text,
    marginTop: 18,
    marginBottom: 8,
  },
  albumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  albumTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  albumMeta: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2,
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
  uploading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    paddingTop: 20,
    paddingHorizontal: 20,
  },
});
