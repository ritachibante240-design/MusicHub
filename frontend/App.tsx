import {
  Sora_700Bold,
  Sora_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/sora";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import HomeScreen, { type LibraryTarget } from "./src/screens/HomeScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import LibraryScreen from "./src/screens/LibraryScreen";
import SearchScreen from "./src/screens/SearchScreen";
import MiniPlayer from "./src/components/MiniPlayer";
import MusicPlayer from "./src/components/MusicPlayer";
import BottomNavigation, {
  type TabName,
} from "./src/components/BottomNavigation";

import { PlayerProvider, usePlayer } from "./src/player/PlayerContext";
import { colors } from "./src/theme/colors";

// O leitor desliza de baixo para cima e volta a descer ao fechar.
function PlayerOverlay() {
  const { isOpen, currentSong } = usePlayer();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(height)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);

      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: height,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [isOpen, height, translateY]);

  if (!mounted || !currentSong) return null;

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY }] }]}>
      <MusicPlayer />
    </Animated.View>
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<TabName>("Inicio");
  const [libraryTarget, setLibraryTarget] = useState<LibraryTarget | null>(null);
  const { playSong } = usePlayer();

  // Tocar num álbum ou artista no Início leva à página dele na Biblioteca.
  function openInLibrary(target: LibraryTarget) {
    setLibraryTarget(target);
    setActiveTab("Biblioteca");
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.content}>
        {activeTab === "Inicio" ? (
          <HomeScreen
            onSelectSong={playSong}
            onSearchPress={() => setActiveTab("Pesquisar")}
            onOpenInLibrary={openInLibrary}
          />
        ) : activeTab === "Favoritos" ? (
          <FavoritesScreen onSelectSong={playSong} />
        ) : activeTab === "Biblioteca" ? (
          <LibraryScreen
            onSelectSong={playSong}
            initialDetail={libraryTarget}
            onInitialDetailUsed={() => setLibraryTarget(null)}
          />
        ) : (
          <SearchScreen onSelectSong={playSong} />
        )}
      </View>

      <MiniPlayer />

      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <PlayerOverlay />
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Sora_700Bold, Sora_800ExtraBold });

  // Enquanto a fonte carrega mostra o fundo, não um ecrã branco.
  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <AppShell />
      </PlayerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
  },
});
