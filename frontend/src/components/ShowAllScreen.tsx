import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import PressableScale from "./PressableScale";
import { colors } from "../theme/colors";
import { display } from "../theme/typography";

export type ShowAllCategory = "songs" | "albums" | "artists" | "playlists";

export type ShowAllEntry = {
  key: string;
  title: string;
  subtitle: string;
  artwork: ReactNode;
  onPress: () => void;
  // As linhas que abrem outra página mostram a seta; as que tocam
  // uma música não mostram nada.
  chevron?: boolean;
  label: string;
};

type Props = {
  title: string;
  chips: { id: ShowAllCategory; label: string }[];
  active: ShowAllCategory;
  onSelectChip: (id: ShowAllCategory) => void;
  entries: ShowAllEntry[];
  countLabel: string;
  onBack: () => void;
};

// Cada linha entra a subir e a ganhar opacidade, uma a seguir à outra.
// O atraso é limitado para as linhas de baixo não ficarem à espera.
function EnterUp({
  index = 0,
  children,
}: {
  index?: number;
  children: ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 340,
      delay: Math.min(index, 8) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [progress, index]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// Lista inteira de uma prateleira do Início, no estilo das listas
// grandes do Spotify: título ao centro, filtros e linhas largas.
export default function ShowAllScreen({
  title,
  chips,
  active,
  onSelectChip,
  entries,
  countLabel,
  onBack,
}: Props) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  // O ecrã entra a deslizar da direita, como quando se abre uma
  // página nova, em vez de aparecer de repente.
  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [enter]);

  const enterShift = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],
  });

  // A linha por baixo dos filtros só aparece quando há conteúdo
  // escondido por cima: é a pista de que a lista já foi deslizada.
  const dividerOpacity = scrollY.interpolate({
    inputRange: [0, 28],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: enter, transform: [{ translateX: enterShift }] },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </Pressable>

        <Text style={styles.topTitle} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.backButton} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {chips.map((chip) => {
          const selected = chip.id === active;

          return (
            <PressableScale
              key={chip.id}
              onPress={() => onSelectChip(chip.id)}
              style={[styles.chip, selected && styles.chipOn]}
              scaleTo={0.93}
              accessibilityState={{ selected }}
              accessibilityLabel={`Mostrar ${chip.label}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {chip.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <Animated.View style={[styles.divider, { opacity: dividerOpacity }]} />

      <FlatList
        // Mudar de categoria recomeça a lista: volta ao topo e as
        // linhas voltam a entrar.
        key={active}
        data={entries}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={
          entries.length > 0 ? (
            <EnterUp>
              <Text style={styles.groupTitle}>{countLabel}</Text>
            </EnterUp>
          ) : null
        }
        ListEmptyComponent={
          <EnterUp>
            <Text style={styles.message}>Ainda não há nada para mostrar aqui.</Text>
          </EnterUp>
        }
        renderItem={({ item, index }) => (
          <EnterUp index={index + 1}>
            <PressableScale
              onPress={item.onPress}
              style={styles.row}
              scaleTo={0.985}
              accessibilityLabel={item.label}
            >
              {item.artwork}

              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>

              {item.chevron && (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textTertiary}
                />
              )}
            </PressableScale>
          </EnterUp>
        )}
      />
    </Animated.View>
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
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    ...display.section,
    flex: 1,
    color: colors.text,
    fontSize: 19,
    textAlign: "center",
  },
  chips: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  chip: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 19,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: {
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextOn: {
    color: colors.white,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  groupTitle: {
    ...display.screen,
    color: colors.text,
    fontSize: 25,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 23,
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.6,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    paddingTop: 30,
  },
});
