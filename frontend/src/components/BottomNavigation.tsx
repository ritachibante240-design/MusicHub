import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

export type TabName = "Inicio" | "Biblioteca" | "Favoritos" | "Pesquisar";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
};

const tabs: { name: TabName; label: string; icon: IconName; activeIcon: IconName }[] = [
  { name: "Inicio", label: "Início", icon: "home-outline", activeIcon: "home" },
  { name: "Pesquisar", label: "Pesquisa", icon: "search-outline", activeIcon: "search" },
  { name: "Biblioteca", label: "Biblioteca", icon: "library-outline", activeIcon: "library" },
  { name: "Favoritos", label: "Favoritos", icon: "heart-outline", activeIcon: "heart" },
];

export default function BottomNavigation({ activeTab, onTabChange }: Props) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = activeTab === tab.name;

        return (
          <Pressable
            key={tab.name}
            onPress={() => onTabChange(tab.name)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={active ? tab.activeIcon : tab.icon}
                size={22}
                color={active ? colors.primaryLight : colors.textTertiary}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    gap: 2,
  },
  iconWrap: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: "500",
  },
  labelActive: {
    color: colors.primaryLight,
    fontWeight: "700",
  },
});
