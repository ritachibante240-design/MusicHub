// Paleta "tinta e brasa".
//
// O fundo é um preto quente, não azulado: as capas são fotografias e,
// sobre preto-quente, parecem arte em vez de píxeis num ecrã.
// O acento é um só — brasa queimada — e está reservado a ações. Quando
// uma cor aparece em todo o lado, deixa de destacar seja o que for.
export const colors = {
  background: "#0C0A09",
  surface: "#16120F",
  surfaceLight: "#211C18",
  surfaceElevated: "#2C2520",
  primary: "#C2410C",
  primaryLight: "#F59E5B",
  primaryDark: "#7C2D12",
  primarySoft: "rgba(194, 65, 12, 0.18)",
  // Osso em vez de branco puro: sobre preto quente, o branco total
  // vibra e cansa a vista.
  text: "#F5F0EA",
  textSecondary: "#A8A09A",
  textTertiary: "#8A827B",
  border: "#2A2219",
  danger: "#F43F5E",
  white: "#FFFFFF",
  transparent: "transparent",
};

// Gradiente partilhado pelos cabeçalhos de destaque (Início e Favoritos),
// para que os dois ecrãs pareçam partes do mesmo produto.
export const heroGradient: [string, string, string] = [
  "#C2410C",
  "#7C2D12",
  "#16120F",
];

// Cor de fundo da página de um álbum, artista ou playlist. Vem do
// mesmo número que gera a capa, por isso página e capa combinam.
export function seedColor(seed: number) {
  return coverGradients[Math.abs(seed) % coverGradients.length][0];
}

// Capas sem imagem. Cinco cores de hues diferentes mas com a mesma
// intensidade e a mesma profundidade — lado a lado leem-se como um
// conjunto, e não como cinco cores escolhidas à sorte.
export const coverGradients: [string, string][] = [
  ["#B45309", "#431407"],
  ["#9F1239", "#3F0D1C"],
  ["#115E59", "#042F2E"],
  ["#3730A3", "#1E1B4B"],
  ["#4D7C0F", "#1A2E05"],
];
