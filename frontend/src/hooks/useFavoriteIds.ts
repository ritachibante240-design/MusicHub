import { useEffect, useState } from "react";

import {
  currentFavoriteIds,
  loadFavoriteIds,
  subscribeFavorites,
} from "../services/favorites";

// Os favoritos, sempre atualizados: começa pelo que já se sabe, pede a
// lista ao servidor e acompanha as mudanças feitas noutros ecrãs.
export function useFavoriteIds(): number[] {
  const [ids, setIds] = useState<number[]>(() => currentFavoriteIds() ?? []);

  useEffect(() => {
    const unsubscribe = subscribeFavorites(setIds);
    const known = currentFavoriteIds();

    if (known) setIds(known);
    void loadFavoriteIds();

    return unsubscribe;
  }, []);

  return ids;
}
