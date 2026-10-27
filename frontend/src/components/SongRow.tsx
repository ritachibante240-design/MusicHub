import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import type { Song } from "../types/song";
import { formatDuration, getArtistName } from "../utils/media";
import Cover from "./Cover";

type Props = {
  song: Song;
  onPress: () => void;
  position?: number;
  active?: boolean;
  showDuration?: boolean;
  trailing?: ReactNode;
};

// Linha de música partilhada por todos os ecrãs, para que capas,
// alinhamentos e tipografia sejam iguais em toda a app.
export default function SongRow({
  song,
  onPress,
  position,
  active = false,
  showDuration = true,
  trailing,
}: Props) {
  return (
    <View style={[styles.row, active && styles.rowActive]}>
      <Pressable
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Reproduzir ${song.title}`}
      >
        {position !== undefined && (
          <Text style={styles.position}>{position}</Text>
        )}

        <Cover path={song.cover_url} seed={song.id} size={50} radius={10} />

        <View style={styles.info}>
          <Text
            style={[styles.title, active && styles.titleActive]}
            numberOfLines={1}
          >
            {song.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {getArtistName(song)}
          </Text>
        </View>

        {showDuration && (
          <Text style={styles.duration}>{formatDuration(song.duration)}</Text>
        )}
      </Pressable>

      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingLeft: 8,
    paddingRight: 2,
    marginHorizontal: -8,
  },
  rowActive: {
    backgroundColor: colors.surface,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  position: {
    width: 16,
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  titleActive: {
    color: colors.primaryLight,
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  duration: {
    color: colors.textTertiary,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    marginLeft: 4,
  },
});
