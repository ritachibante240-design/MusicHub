import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import ArtistAvatar from "../components/ArtistAvatar";
import {
  createArtist,
  describeError,
  pickAndUploadImage,
} from "../services/catalog";
import { colors } from "../theme/colors";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export default function AddArtistScreen({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function pickPhoto() {
    try {
      setError("");
      setUploading(true);

      const url = await pickAndUploadImage();

      if (url) setPhoto(url);
    } catch (err) {
      console.error("Erro ao enviar a foto:", err);
      setError(describeError(err, "Não foi possível enviar a foto."));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("Escreve o nome do artista.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await createArtist(name.trim(), bio.trim() || null, photo);

      onCreated();
      onClose();
    } catch (err) {
      console.error("Erro ao criar o artista:", err);
      setError(describeError(err, "Não foi possível criar o artista."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Novo artista</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={pickPhoto}
          disabled={uploading}
          style={({ pressed }) => [styles.photoPicker, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Escolher a foto do artista"
        >
          <ArtistAvatar name={name || "?"} photo={photo} size={120} />

          <View style={styles.photoBadge}>
            {uploading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="camera" size={18} color={colors.white} />
            )}
          </View>
        </Pressable>

        <Text style={styles.photoHint}>
          {uploading ? "A enviar a foto..." : "Toca para escolher uma foto"}
        </Text>

        <Text style={styles.label}>Nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nome do artista"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoFocus
          accessibilityLabel="Nome do artista"
        />

        <Text style={styles.label}>Biografia (opcional)</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Algumas palavras sobre o artista"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, styles.multiline]}
          multiline
          accessibilityLabel="Biografia do artista"
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            saving && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Guardar artista"
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveText}>Guardar artista</Text>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  closeButton: {
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  photoPicker: {
    alignSelf: "center",
  },
  photoBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  photoHint: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  error: {
    color: colors.danger,
    fontSize: 13.5,
    marginTop: 16,
  },
  saveButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  saveText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
