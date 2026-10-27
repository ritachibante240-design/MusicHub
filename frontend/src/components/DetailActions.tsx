import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayerStatus } from "expo-audio";
import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { usePlayer } from "../player/PlayerContext";
import { colors } from "../theme/colors";
import type { Song } from "../types/song";

type Props = {
  songs: Song[];
  /** Identifica esta lista: "album:3", "playlist:1", "artista:2"... */
  queueId: string;
  onSelectSong: (song: Song, queue: Song[], queueId?: string | null) => void;
  // Versão pequena, para pôr ao lado de um título (no Início): sem a
  // etiqueta "A reproduzir" e com um botão que não compete com o destaque.
  compact?: boolean;
};

export default function DetailActions({
  songs,
  queueId,
  onSelectSong,
  compact = false,
}: Props) {
  const {
    player,
    queueId: playingQueueId,
    shuffleOn,
    togglePlayback,
    playShuffled,
  } = usePlayer();
  const status = useAudioPlayerStatus(player);
  const scale = useRef(new Animated.Value(1)).current;

  if (songs.length === 0) return null;

  // É esta lista que está a tocar? Comparamos a lista, não a música:
  // a mesma música pode estar numa playlist e na página do artista.
  const isThisList = playingQueueId === queueId;
  const isPlaying = isThisList && status.playing;

  function press(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
  }

  function handlePlay() {
    if (isThisList) {
      togglePlayback();
    } else {
      onSelectSong(songs[0], songs, queueId);
    }
  }

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {!compact && isPlaying && (
        <Text style={styles.playingLabel}>A reproduzir</Text>
      )}

      {!compact && <View style={styles.spacer} />}

      <Pressable
        onPress={() => playShuffled(songs, queueId)}
        style={({ pressed }) => [
          styles.shuffle,
          shuffleOn && isThisList && styles.shuffleOn,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Tocar por ordem aleatória"
        accessibilityState={{ selected: shuffleOn && isThisList }}
      >
        <Ionicons
          name="shuffle"
          size={24}
          color={shuffleOn && isThisList ? colors.white : colors.primaryLight}
        />
      </Pressable>

      <Pressable
        onPress={handlePlay}
        onPressIn={() => press(0.92)}
        onPressOut={() => press(1)}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pausar" : "Tocar tudo"}
      >
        <Animated.View
          style={[styles.play, compact && styles.playCompact, { transform: [{ scale }] }]}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={compact ? 22 : 28}
            color={colors.white}
            style={isPlaying ? undefined : styles.playIcon}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  rowCompact: {
    gap: 2,
    marginTop: 0,
    marginBottom: 0,
  },
  spacer: {
    flex: 1,
  },
  playingLabel: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  shuffle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  shuffleOn: {
    backgroundColor: colors.primary,
  },
  play: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  playCompact: {
    width: 46,
    height: 46,
    borderRadius: 23,
    shadowOpacity: 0,
    elevation: 0,
  },
  playIcon: {
    marginLeft: 3,
  },
  pressed: {
    opacity: 0.6,
  },
});
