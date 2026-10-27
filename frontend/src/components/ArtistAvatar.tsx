import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "../theme/colors";
import { getMediaUrl } from "../utils/media";

type Props = {
  name: string;
  photo?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
};

// Foto do artista; sem foto, mostra a inicial do nome.
export default function ArtistAvatar({ name, photo, size, style }: Props) {
  const uri = getMediaUrl(photo);
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.photo, box, style as object]} />;
  }

  return (
    <View style={[styles.fallback, box, style]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    backgroundColor: colors.surfaceLight,
  },
  fallback: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: colors.primaryLight,
    fontWeight: "800",
  },
});
