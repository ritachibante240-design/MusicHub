import { useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { usePlayer } from "../player/PlayerContext";
import { colors } from "../theme/colors";

function Bar({ playing, duration }: { playing: boolean; duration: number }) {
  const height = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!playing) {
      Animated.timing(height, {
        toValue: 0.35,
        duration: 150,
        useNativeDriver: true,
      }).start();

      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(height, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(height, {
          toValue: 0.3,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [playing, duration, height]);

  return (
    <Animated.View style={[styles.bar, { transform: [{ scaleY: height }] }]} />
  );
}

// Três barras a mexer, para se ver qual é a música a tocar. Lê o
// estado aqui dentro, para o resto da página não ser redesenhado a
// cada segundo de reprodução.
export default function PlayingBars() {
  const { player } = usePlayer();
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  return (
    <View style={styles.container}>
      <Bar playing={playing} duration={380} />
      <Bar playing={playing} duration={260} />
      <Bar playing={playing} duration={460} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    width: 22,
    height: 18,
  },
  bar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.primaryLight,
  },
});
