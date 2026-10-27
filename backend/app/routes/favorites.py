from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Favorite, Song

router = APIRouter(prefix="/api/favorites", tags=["Favoritos"])


class FavoritesImport(BaseModel):
    # Pela ordem em que foram guardados no telemóvel (o mais antigo primeiro).
    ids: list[int] = Field(default_factory=list, max_length=5000)


@router.get("/", response_model=list[int])
def list_favorites(db: Session = Depends(get_db)):
    """Ids das músicas favoritas, da última guardada para a primeira.

    O join com songs deixa de fora favoritos de músicas que já não existem.
    """
    rows = (
        db.query(Favorite.song_id)
        .join(Song, Song.id == Favorite.song_id)
        .order_by(Favorite.id.desc())
        .all()
    )

    return [song_id for (song_id,) in rows]


@router.put("/{song_id}")
def add_favorite(song_id: int, db: Session = Depends(get_db)):
    """Guarda nos favoritos. Repetir não faz mal: fica como estava."""
    if db.get(Song, song_id) is None:
        raise HTTPException(status_code=404, detail="Musica nao encontrada")

    exists = db.query(Favorite).filter(Favorite.song_id == song_id).first()

    if exists is None:
        db.add(Favorite(song_id=song_id))

        try:
            db.commit()
        except IntegrityError:
            # Dois pedidos ao mesmo tempo: o outro já a guardou.
            db.rollback()

    return {"detail": "Guardada nos favoritos."}


@router.delete("/{song_id}")
def remove_favorite(song_id: int, db: Session = Depends(get_db)):
    """Tira dos favoritos. Se já não estava, não é erro."""
    db.query(Favorite).filter(Favorite.song_id == song_id).delete()
    db.commit()

    return {"detail": "Removida dos favoritos."}


@router.post("/import")
def import_favorites(payload: FavoritesImport, db: Session = Depends(get_db)):
    """Recebe, uma única vez, os favoritos que estavam só no telemóvel.

    Ignora os que já existem e os de músicas apagadas, e mantém a ordem
    em que foram guardados.
    """
    if not payload.ids:
        return {"added": 0}

    existing = {song_id for (song_id,) in db.query(Favorite.song_id).all()}
    valid = {
        song_id
        for (song_id,) in db.query(Song.id).filter(Song.id.in_(payload.ids)).all()
    }

    added = 0

    for song_id in payload.ids:
        if song_id in valid and song_id not in existing:
            db.add(Favorite(song_id=song_id))
            existing.add(song_id)
            added += 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"added": 0}

    return {"added": added}
