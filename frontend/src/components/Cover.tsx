import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Image, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { colors, coverGradients } from "../theme/colors";
import { getMediaUrl } from "../utils/media";

type Props = {
  path?: string | null;
  seed?: number;
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  // Sem capa, mostra uma nota musical por cima do gradiente. No rótulo
  // do disco a nota ficava por baixo do furo central, por isso dá para
  // a desligar.
  icon?: boolean;
};

// Mostra a capa real da música; quando não existe, desenha um gradiente
// (escolhido pelo id, para cada música manter sempre a mesma cor).
export default function Cover({
  path,
  seed = 0,
  size,
  radius = 10,
  style,
  icon = true,
}: Props) {
  const uri = getMediaUrl(path);
  const box = { width: size, height: size, borderRadius: radius };

  // Um ficheiro de capa que falhe a carregar deixava um quadrado vazio.
  // Ao falhar, passa a mostrar o gradiente, como se não houvesse capa.
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, box, style as object]}
        onError={() => setFailed(true)}
      />
    );
  }

  const gradient = coverGradients[Math.abs(seed) % coverGradients.length];

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.placeholder, box, style]}
    >
      {icon && (
        <Ionicons
          name="musical-notes"
          size={Math.round(size * 0.4)}
          color="rgba(255,255,255,0.85)"
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceLight,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
