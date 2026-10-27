// Sora dá aos títulos uma personalidade própria; o resto do texto
// continua na fonte do sistema, que é a mais legível em tamanhos
// pequenos e a que o utilizador já conhece do telemóvel dele.
export const fonts = {
  display: "Sora_700Bold",
  displayHeavy: "Sora_800ExtraBold",
};

// Títulos grandes com o espaçamento apertado que se usa em capas e
// cabeçalhos; os valores mudam com o tamanho da letra.
export const display = {
  screen: {
    fontFamily: fonts.displayHeavy,
    fontSize: 28,
    letterSpacing: -0.8,
  },
  section: {
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: -0.4,
  },
  card: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.5,
  },
} as const;
