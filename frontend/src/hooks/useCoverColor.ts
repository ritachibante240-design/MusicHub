import { useEffect, useState } from "react";

import { api } from "../services/api";

// Uma capa não muda de cor: cada uma é pedida ao servidor uma só vez.
const cache = new Map<string, string | null>();

const HEX = /^#[0-9a-f]{6}$/i;

// Cor dominante de uma capa, calculada pelo backend. Devolve null
// enquanto não chega, se a capa não tiver cor, ou se o servidor ainda
// não souber calculá-la — quem usa fica com a cor de reserva.
export function useCoverColor(url?: string | null): string | null {
  const [result, setResult] = useState<{ url: string; color: string | null } | null>(
    null
  );

  useEffect(() => {
    if (!url || cache.has(url)) return;

    let alive = true;

    api
      .get("/covers/color", { params: { url } })
      .then((response) => {
        const value: unknown = response.data?.color;
        // Só aceitamos uma cor bem formada: um valor estranho aqui ia
        // direto para o gradiente e podia partir o ecrã.
        const color = typeof value === "string" && HEX.test(value) ? value : null;

        cache.set(url, color);
        if (alive) setResult({ url, color });
      })
      .catch(() => {
        // Falha de rede ou servidor antigo: não guardamos, para tentar
        // outra vez da próxima.
      });

    return () => {
      alive = false;
    };
  }, [url]);

  if (!url) return null;
  if (cache.has(url)) return cache.get(url) ?? null;

  return result?.url === url ? result.color : null;
}
