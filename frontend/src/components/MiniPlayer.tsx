import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayerStatus } from "expo-audio";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { usePlayer } from "../player/PlayerContext";
import { colors } from "../theme/colors";
import { haptics } from "../utils/haptics";
import { getArtistName } from "../utils/media";
import Cover from "./Cover";

// Barra fixa por cima da navegação: a música continua enquanto navegas.
export default function MiniPlayer() {
  const {
    player,
    currentSong,
    hasNext,
    isOpen,
    openPlayer,
    playNext,
    togglePlayback,
  } = usePlayer();
  const status = useAudioPlayerStatus(player);

  if (!currentSong || isOpen) return null;

  const duration = status.duration || 0;
  const progress = duration > 0 ? Math.min((status.currentTime || 0) / duration, 1) : 0;

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        onPress={openPlayer}
        accessibilityRole="button"
        accessibilityLabel={`Abrir o leitor: ${currentSong.title}`}
      >
        <Cover path={currentSong.cover_url} seed={currentSong.id} size={42} radius={8} />

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentSong.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {getArtistName(currentSong)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => {
          haptics.medium();
          togglePlayback();
        }}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pausar" : "Reproduzir"}
      >
        <Ionicons
          name={status.playing ? "pause" : "play"}
          size={24}
          color={colors.text}
        />
      </Pressable>

      <Pressable
        onPress={() => {
          haptics.light();
          playNext();
        }}
        disabled={!hasNext}
        style={[styles.button, !hasNext && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel="Próxima música"
      >
        <Ionicons name="play-skip-forward" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    paddingLeft: 10,
    paddingRight: 2,
    height: 62,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: "100%",
  },
  pressed: {
    opacity: 0.7,
  },
  info: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.3,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
});
