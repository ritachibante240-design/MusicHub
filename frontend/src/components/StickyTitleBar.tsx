import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { display } from "../theme/typography";

type Props = {
  title: string;
  color: string;
  scrollY: Animated.Value;
  onBack: () => void;
  onMenu?: () => void;
  // Altura de deslizamento a partir da qual a barra começa a aparecer.
  appearAt?: number;
};

// Barra que aparece ao deslizar para baixo, com o nome da página.
// Mantém os botões sempre acessíveis depois de a capa sair do ecrã.
export default function StickyTitleBar({
  title,
  color,
  scrollY,
  onBack,
  onMenu,
  appearAt = 150,
}: Props) {
  const [active, setActive] = useState(false);
  const end = appearAt + 80;

  const opacity = scrollY.interpolate({
    inputRange: [appearAt, end],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Enquanto a barra está invisível não deve apanhar toques, senão
  // tapava os botões que estão por baixo dela.
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      setActive((current) => {
        const next = value >= end - 40;
        return next === current ? current : next;
      });
    });

    return () => scrollY.removeListener(id);
  }, [scrollY, end]);

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color, opacity }]}
      pointerEvents={active ? "auto" : "none"}
    >
      <Pressable
        onPress={onBack}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {onMenu ? (
        <Pressable
          onPress={onMenu}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Mais opções"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.button} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    zIndex: 10,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...display.section,
    flex: 1,
    color: colors.text,
    fontSize: 17,
    textAlign: "center",
  },
});
