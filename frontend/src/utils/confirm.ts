import { Alert, Platform } from "react-native";

// Pergunta antes de uma ação que não se desfaz (apagar).
// No telemóvel usa o alerta nativo de sempre. Na web, o Alert do React
// Native não mostra nada — por isso lá usamos a confirmação do browser.
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
) {
  if (Platform.OS === "web") {
    const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;

    if (ask?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancelar", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
