import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createAlbum,
  createArtist,
  createSong,
  describeError,
  uploadAudio,
  uploadCover,
  type PickedFile,
} from "../services/catalog";
import { colors } from "../theme/colors";
import type { Album } from "../types/album";
import type { Artist } from "../types/artist";
import { formatDuration } from "../utils/media";

type Props = {
  artists: Artist[];
  albums: Album[];
  onClose: () => void;
  onCreated: () => void;
};

const NEW = -1;

export default function AddSongScreen({ artists, albums, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");

  const [audioName, setAudioName] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const [coverPreview, setCoverPreview] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);

  const [artistId, setArtistId] = useState<number | null>(null);
  const [newArtistName, setNewArtistName] = useState("");

  const [albumId, setAlbumId] = useState<number | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumYear, setNewAlbumYear] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Artista/álbum novos já criados numa tentativa que falhou a meio.
  // Ao tentar outra vez reutilizam-se, em vez de ficarem repetidos.
  const createdArtist = useRef<{ name: string; id: number } | null>(null);
  const createdAlbum = useRef<{ title: string; id: number } | null>(null);

  async function pickAudio() {
    try {
      setError("");

      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/mpeg",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const name = asset.name?.toLowerCase().endsWith(".mp3")
        ? asset.name
        : "musica.mp3";

      const file: PickedFile = { uri: asset.uri, name, type: "audio/mpeg" };

      setUploadingAudio(true);

      const uploaded = await uploadAudio(file);

      setAudioUrl(uploaded.url);
      setAudioName(name);
      setDuration(uploaded.duration_seconds ?? 0);

      // Sugere o nome do ficheiro como título, se ainda estiver vazio.
      if (!title.trim()) {
        setTitle(name.replace(/\.mp3$/i, ""));
      }
    } catch (err) {
      console.error("Erro ao enviar o áudio:", err);
      setError(describeError(err, "Não foi possível enviar o ficheiro de áudio."));
    } finally {
      setUploadingAudio(false);
    }
  }

  async function pickCover() {
    try {
      setError("");

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError("Precisas de dar acesso às fotografias para escolher uma capa.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const isPng = (asset.mimeType ?? asset.uri).toLowerCase().includes("png");
      const file: PickedFile = {
        uri: asset.uri,
        name: isPng ? "capa.png" : "capa.jpg",
        type: isPng ? "image/png" : "image/jpeg",
      };

      setUploadingCover(true);

      const uploaded = await uploadCover(file);

      setCoverUrl(uploaded.url);
      setCoverPreview(asset.uri);
    } catch (err) {
      console.error("Erro ao enviar a capa:", err);
      setError(describeError(err, "Não foi possível enviar a capa."));
    } finally {
      setUploadingCover(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      setError("Escreve o título da música.");
      return;
    }

    if (!audioUrl) {
      setError("Escolhe o ficheiro de áudio.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      // 1. Artista: usa o escolhido, ou cria um novo.
      let finalArtistId: number | null = artistId === NEW ? null : artistId;

      if (artistId === NEW) {
        if (!newArtistName.trim()) {
          setError("Escreve o nome do novo artista.");
          setSaving(false);
          return;
        }

        const name = newArtistName.trim();

        if (createdArtist.current?.name === name) {
          finalArtistId = createdArtist.current.id;
        } else {
          const artist = await createArtist(name);
          createdArtist.current = { name, id: artist.id };
          finalArtistId = artist.id;
        }
      }

      // 2. Álbum: usa o escolhido, ou cria um novo.
      let finalAlbumId: number | null = albumId === NEW ? null : albumId;

      if (albumId === NEW) {
        if (!newAlbumTitle.trim()) {
          setError("Escreve o título do novo álbum.");
          setSaving(false);
          return;
        }

        const albumTitle = newAlbumTitle.trim();

        if (createdAlbum.current?.title === albumTitle) {
          finalAlbumId = createdAlbum.current.id;
        } else {
          const year = Number(newAlbumYear);
          const album = await createAlbum({
            title: albumTitle,
            artist_id: finalArtistId,
            cover_url: coverUrl || null,
            release_year: Number.isFinite(year) && year > 1900 ? year : null,
          });

          createdAlbum.current = { title: albumTitle, id: album.id };
          finalAlbumId = album.id;
        }
      }

      // 3. A música, já com tudo ligado.
      await createSong({
        title: title.trim(),
        duration,
        audio_url: audioUrl,
        cover_url: coverUrl || null,
        artist_id: finalArtistId,
        album_id: finalAlbumId,
      });

      onCreated();
      onClose();
    } catch (err) {
      console.error("Erro ao guardar a música:", err);
      setError(describeError(err, "Não foi possível guardar a música."));
    } finally {
      setSaving(false);
    }
  }

  const visibleAlbums =
    artistId == null || artistId === NEW
      ? albums
      : albums.filter((album) => album.artist_id === artistId);

  function Chip({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.chip, selected && styles.chipOn]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Adicionar música</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Ficheiros</Text>

        <Pressable
          onPress={pickAudio}
          disabled={uploadingAudio}
          style={({ pressed }) => [styles.fileCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Escolher o ficheiro de áudio"
        >
          <View style={styles.fileIcon}>
            {uploadingAudio ? (
              <ActivityIndicator color={colors.primaryLight} />
            ) : (
              <Ionicons
                name={audioUrl ? "checkmark-circle" : "musical-notes"}
                size={22}
                color={audioUrl ? colors.primaryLight : colors.primaryLight}
              />
            )}
          </View>

          <View style={styles.flex}>
            <Text style={styles.fileTitle}>
              {audioUrl ? audioName : "Escolher ficheiro MP3"}
            </Text>
            <Text style={styles.fileHint}>
              {uploadingAudio
                ? "A enviar..."
                : audioUrl
                  ? `Duração ${formatDuration(duration)} · lida do ficheiro`
                  : "Apenas MP3, até 30 MB"}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>

        <Pressable
          onPress={pickCover}
          disabled={uploadingCover}
          style={({ pressed }) => [styles.fileCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Escolher a capa"
        >
          {coverPreview ? (
            <Image source={{ uri: coverPreview }} style={styles.coverPreview} />
          ) : (
            <View style={styles.fileIcon}>
              {uploadingCover ? (
                <ActivityIndicator color={colors.primaryLight} />
              ) : (
                <Ionicons name="image" size={22} color={colors.primaryLight} />
              )}
            </View>
          )}

          <View style={styles.flex}>
            <Text style={styles.fileTitle}>
              {coverUrl ? "Capa escolhida" : "Escolher capa (opcional)"}
            </Text>
            <Text style={styles.fileHint}>
              {uploadingCover ? "A enviar..." : "JPG ou PNG, até 5 MB"}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>

        <Text style={styles.sectionTitle}>Detalhes</Text>

        <Text style={styles.label}>Título</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nome da música"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          accessibilityLabel="Título da música"
        />

        <Text style={styles.label}>Artista</Text>
        <View style={styles.chips}>
          <Chip
            label="Sem artista"
            selected={artistId === null}
            onPress={() => setArtistId(null)}
          />
          {artists.map((artist) => (
            <Chip
              key={artist.id}
              label={artist.name}
              selected={artistId === artist.id}
              onPress={() => {
                setArtistId(artist.id);
                setAlbumId(null);
              }}
            />
          ))}
          <Chip
            label="+ Novo"
            selected={artistId === NEW}
            onPress={() => {
              setArtistId(NEW);
              setAlbumId(null);
            }}
          />
        </View>

        {artistId === NEW && (
          <TextInput
            value={newArtistName}
            onChangeText={setNewArtistName}
            placeholder="Nome do novo artista"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            accessibilityLabel="Nome do novo artista"
          />
        )}

        <Text style={styles.label}>Álbum</Text>
        <View style={styles.chips}>
          <Chip
            label="Sem álbum"
            selected={albumId === null}
            onPress={() => setAlbumId(null)}
          />
          {visibleAlbums.map((album) => (
            <Chip
              key={album.id}
              label={album.title}
              selected={albumId === album.id}
              onPress={() => setAlbumId(album.id)}
            />
          ))}
          <Chip
            label="+ Novo"
            selected={albumId === NEW}
            onPress={() => setAlbumId(NEW)}
          />
        </View>

        {albumId === NEW && (
          <View>
            <TextInput
              value={newAlbumTitle}
              onChangeText={setNewAlbumTitle}
              placeholder="Título do novo álbum"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              accessibilityLabel="Título do novo álbum"
            />
            <TextInput
              value={newAlbumYear}
              onChangeText={setNewAlbumYear}
              placeholder="Ano (opcional)"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.input}
              accessibilityLabel="Ano do álbum"
            />
          </View>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={save}
          disabled={saving || uploadingAudio || uploadingCover}
          style={({ pressed }) => [
            styles.saveButton,
            (saving || uploadingAudio || uploadingCover) && styles.saveDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Guardar música"
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveText}>Guardar música</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 10,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  fileIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  coverPreview: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  fileTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  fileHint: {
    color: colors.textSecondary,
    fontSize: 12.5,
    marginTop: 2,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  chipTextOn: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: colors.danger,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 16,
  },
  saveButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  saveDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
  },
});
