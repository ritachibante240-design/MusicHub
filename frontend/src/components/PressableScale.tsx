import type { ReactNode } from "react";
import { useRef } from "react";
import {
  Animated,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  scaleTo?: number;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

// Encolhe ligeiramente ao ser premido e volta com uma mola:
// dá a sensação de que o elemento responde ao dedo.
export default function PressableScale({
  children,
  onPress,
  style,
  accessibilityLabel,
  scaleTo = 0.96,
  accessibilityState,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(scaleTo)}
      onPressOut={() => animateTo(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
