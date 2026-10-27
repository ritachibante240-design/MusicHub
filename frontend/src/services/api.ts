import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Endereço fixo da API — para usar o servidor no Render. Vem do ficheiro
// frontend/.env.local (que não vai para o GitHub), por exemplo:
//   EXPO_PUBLIC_API_URL=https://musichub-api.onrender.com/api
// Sem ele, o app procura o teu PC na rede, como sempre.
// Tem de ficar escrito exatamente assim: a Expo só substitui o valor
// quando encontra "process.env.EXPO_PUBLIC_..." por extenso.
const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

// Um endereço de túnel (Expo com --tunnel) não serve: aponta para o
// Metro na internet, não para o backend na rede local.
function isLanHost(host?: string | null) {
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return false;
  return !/\.(exp\.direct|ngrok\.io|ngrok-free\.app|trycloudflare\.com)$/i.test(host);
}

function cleanUrl(url?: string) {
  const trimmed = url?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

// Por ordem: o que estiver fixado em app.json (extra.apiHost), depois o
// IP do PC onde corre o Expo, e só depois o endereço de reserva.
const pinnedHost = (Constants.expoConfig?.extra as { apiHost?: string } | undefined)
  ?.apiHost;
const expoHost = Constants.expoConfig?.hostUri?.split(":")[0];
const FALLBACK_HOST = "192.168.188.136";

const host = pinnedHost || (isLanHost(expoHost) ? expoHost : FALLBACK_HOST);
const remoteUrl = cleanUrl(configuredUrl);

/** true quando o app está a falar com o servidor na nuvem. */
export const USING_REMOTE_API = remoteUrl !== undefined;

export const API_URL =
  remoteUrl ??
  (Platform.OS === "web" ? "http://127.0.0.1:8000/api" : `http://${host}:8000/api`);

export const api = axios.create({
  baseURL: API_URL,
  // No Render gratuito o servidor adormece e demora cerca de um minuto a
  // acordar; no PC responde logo, e aí um erro deve aparecer depressa.
  timeout: USING_REMOTE_API ? 75000 : 10000,
});

export const STORAGE_URL = API_URL.replace(/\/api$/, "");
