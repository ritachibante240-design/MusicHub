import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type SheetOption = {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  options: SheetOption[];
  onClose: () => void;
};

// Painel que sobe do fundo do ecrã com as ações disponíveis.
export default function ActionSheet({ visible, options, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        {options.map((option) => (
          <Pressable
            key={option.title}
            onPress={() => {
              onClose();
              option.onPress();
            }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={option.title}
          >
            <View style={styles.icon}>
              <Ionicons name={option.icon} size={24} color={colors.text} />
            </View>

            <View style={styles.info}>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  sheet: {
    backgroundColor: colors.surfaceLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
    alignSelf: "center",
    marginBottom: 18,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
});
