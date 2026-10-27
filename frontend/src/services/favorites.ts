import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "./api";

// Os favoritos vivem no servidor. Aqui fica uma cópia da última lista
// conhecida (a mais recente primeiro), para o app funcionar sem ligação.
const CACHE_KEY = "@musichub/favorites-v2";

// Onde os favoritos ficavam antes de irem para o servidor (o mais antigo
// primeiro). Enquanto esta chave existir, ainda não foram enviados.
const LEGACY_KEY = "@musichub/favorites";

// Quanto tempo há para "Desfazer" depois de tirar um favorito.
export const UNDO_DELAY = 5000;

type Listener = (ids: number[]) => void;

const listeners = new Set<Listener>();
let snapshot: number[] | null = null;
let inflight: Promise<number[]> | null = null;

// Remoções à espera do fim do "Desfazer". Só vão para o servidor quando
// o tempo acaba: assim desfazer devolve a música ao lugar exato, em vez
// de a guardar outra vez como se fosse nova.
const pending = new Map<number, { timer: ReturnType<typeof setTimeout>; index: number }>();

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === "number");
}

async function readIds(key: string): Promise<number[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? parseIds(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function insertAt(list: number[], id: number, index: number): number[] {
  if (list.includes(id)) return list;
  const copy = [...list];
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, id);
  return copy;
}

// Muda a lista e avisa todos os ecrãs que a estão a mostrar.
function publish(ids: number[]) {
  snapshot = ids;
  listeners.forEach((listener) => listener(ids));
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(ids)).catch(() => {});
}

export function subscribeFavorites(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentFavoriteIds(): number[] | null {
  return snapshot;
}

// Envia, uma única vez, os favoritos que estavam só no telemóvel.
async function sendLegacy(): Promise<void> {
  const legacy = await readIds(LEGACY_KEY);
  if (legacy === null) return;

  if (legacy.length > 0) {
    await api.post("/favorites/import", { ids: legacy });
  }

  await AsyncStorage.removeItem(LEGACY_KEY);
}

// Lê os favoritos do servidor. Sem ligação (ou com um servidor que ainda
// não tem favoritos), usa a última cópia guardada no telemóvel.
export function loadFavoriteIds(): Promise<number[]> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await sendLegacy();

      const response = await api.get("/favorites/");
      // Uma música à espera do fim do "Desfazer" não volta a aparecer.
      const ids = parseIds(response.data).filter((id) => !pending.has(id));

      publish(ids);
      return ids;
    } catch (err) {
      console.warn("Favoritos: a usar a cópia do telemóvel.", err);

      if (snapshot !== null) return snapshot;

      const cached =
        (await readIds(CACHE_KEY)) ?? [...((await readIds(LEGACY_KEY)) ?? [])].reverse();

      publish(cached);
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function restorePending(id: number) {
  const entry = pending.get(id);
  if (!entry) return;

  clearTimeout(entry.timer);
  pending.delete(id);
  publish(insertAt(snapshot ?? [], id, entry.index));
}

// Guarda ou tira uma música. O coração muda logo; se o servidor recusar,
// volta atrás e o erro chega a quem chamou.
export async function setFavorite(id: number, on: boolean): Promise<void> {
  // A música estava à espera de sair? Guardá-la outra vez é desfazer:
  // o servidor ainda a tem, no mesmo lugar.
  if (pending.has(id)) {
    if (on) restorePending(id);
    return;
  }

  const before = snapshot ?? (await loadFavoriteIds());
  if (before.includes(id) === on) return;

  publish(on ? [id, ...before] : before.filter((item) => item !== id));

  try {
    if (on) await api.put(`/favorites/${id}`);
    else await api.delete(`/favorites/${id}`);
  } catch (err) {
    // Desfaz só esta mudança, sem apagar outras feitas entretanto.
    const now = snapshot ?? [];
    publish(
      on ? now.filter((item) => item !== id) : insertAt(now, id, before.indexOf(id))
    );
    throw err;
  }
}

export function toggleFavoriteId(id: number): Promise<void> {
  return setFavorite(id, !(snapshot ?? []).includes(id));
}

// Tira já da lista, mas só avisa o servidor quando o "Desfazer" acabar.
// Devolve a função que desfaz.
export function removeFavoriteLater(id: number): () => void {
  const before = snapshot ?? [];
  const index = before.indexOf(id);

  if (index < 0 || pending.has(id)) return () => {};

  publish(before.filter((item) => item !== id));

  const timer = setTimeout(() => {
    pending.delete(id);
    api.delete(`/favorites/${id}`).catch(() => {
      // O servidor não a tirou: a lista volta a ser a dele.
      void loadFavoriteIds();
    });
  }, UNDO_DELAY);

  pending.set(id, { timer, index });

  return () => restorePending(id);
}
