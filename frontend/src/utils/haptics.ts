import * as Haptics from "expo-haptics";

// Vibrações curtas que confirmam um toque sem o anunciar. Ficam todas
// aqui, para o app inteiro vibrar da mesma maneira. Num telemóvel sem
// motor de vibração (ou com ela desligada), simplesmente não acontece
// nada — por isso os erros são ignorados.
function quietly(promise: Promise<void>) {
  promise.catch(() => {});
}

export const haptics = {
  // Mudar de música, fechar o leitor.
  light: () => quietly(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // Tocar / pausar: a ação principal, um pouco mais firme.
  medium: () => quietly(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  // Ligar e desligar coisas (aleatório, repetir, escolher na barra).
  selection: () => quietly(Haptics.selectionAsync()),
  // Guardar nos favoritos.
  success: () =>
    quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
