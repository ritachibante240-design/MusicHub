import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SongListSkeleton } from "../components/Skeleton";
import SongRow from "../components/SongRow";
import { api } from "../services/api";
import { colors } from "../theme/colors";
import { display } from "../theme/typography";
import type { Song } from "../types/song";

type Props = {
  onSelectSong: (song: Song, queue: Song[]) => void;
};

export default function SearchScreen({ onSelectSong }: Props) {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const search = query.trim();

    if (!search) {
      setSongs([]);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/songs/search/?q=${encodeURIComponent(search)}`
        );

        const data = response.data;
        const results: Song[] = Array.isArray(data) ? data : data.items ?? [];

        if (active) setSongs(results);
      } catch (err) {
        console.error("Erro na pesquisa:", err);
        if (active) {
          setSongs([]);
          setError("Não foi possível pesquisar. Verifica se o backend está ligado.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  function renderState() {
    if (loading) {
      return <SongListSkeleton count={4} />;
    }

    const state = error
      ? { icon: "cloud-offline-outline" as const, title: "Sem ligação", text: error }
      : !query.trim()
        ? {
            icon: "search" as const,
            title: "Encontra a tua música",
            text: "Pesquisa pelo título de uma música.",
          }
        : {
            icon: "musical-notes-outline" as const,
            title: "Sem resultados",
            text: `Nenhuma música corresponde a "${query.trim()}".`,
          };

    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name={state.icon} size={30} color={colors.primaryLight} />
        </View>
        <Text style={styles.emptyTitle}>{state.title}</Text>
        <Text style={styles.message}>{state.text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pesquisa</Text>

      <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Pesquisar músicas..."
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Pesquisar músicas"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery("")}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Limpar pesquisa"
          >
            <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {songs.length > 0 && !loading && !error ? (
        <FlatList
          data={songs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              Resultados · {songs.length}
            </Text>
          }
          renderItem={({ item }) => (
            <SongRow
              song={item}
              onPress={() => onSelectSong(item, songs)}
              trailing={
                <Pressable
                  onPress={() => onSelectSong(item, songs)}
                  style={styles.playButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Reproduzir ${item.title}`}
                >
                  <View style={styles.playCircle}>
                    <Ionicons name="play" size={14} color={colors.white} style={styles.playIcon} />
                  </View>
                </Pressable>
              }
            />
          )}
        />
      ) : (
        renderState()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    ...display.screen,
    color: colors.text,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 15,
  },
  clearButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingBottom: 24,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  playButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 2,
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
    paddingHorizontal: 24,
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
});
