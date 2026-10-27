import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type DimensionValue } from "react-native";

import { colors } from "../theme/colors";

type Props = {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: object;
};

// Bloco cinzento que pulsa devagar, no lugar do círculo a girar.
export function Skeleton({ width, height, radius = 8, style }: Props) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity: pulse },
        style,
      ]}
    />
  );
}

// Linha de música em esqueleto, com as mesmas medidas da linha real.
export function SongRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={50} height={50} radius={10} />
      <View style={styles.info}>
        <Skeleton width="70%" height={13} radius={6} />
        <Skeleton width="45%" height={11} radius={6} style={styles.second} />
      </View>
      <Skeleton width={30} height={11} radius={6} />
    </View>
  );
}

export function SongListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, index) => (
        <SongRowSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceLight,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  info: {
    flex: 1,
  },
  second: {
    marginTop: 8,
  },
});
