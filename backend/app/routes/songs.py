from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Album, Artist, Favorite, Song
from app.schemas.song import SongCreate, SongResponse
from app.services.files import remove_file_if_unused

router = APIRouter(prefix="/api/songs", tags=["Músicas"])


@router.get("/", response_model=list[SongResponse])
def list_songs(db: Session = Depends(get_db)):
    return db.query(Song).order_by(Song.id.desc()).all()


@router.get("/{song_id}", response_model=SongResponse)
def get_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Música não encontrada",
        )

    return song


@router.post(
    "/",
    response_model=SongResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_song(
    song_data: SongCreate,
    db: Session = Depends(get_db),
):
    if song_data.artist_id is not None:
        if db.get(Artist, song_data.artist_id) is None:
            raise HTTPException(
                status_code=404,
                detail="Artista não encontrado",
            )

    if song_data.album_id is not None:
        if db.get(Album, song_data.album_id) is None:
            raise HTTPException(
                status_code=404,
                detail="Álbum não encontrado",
            )

    song = Song(**song_data.model_dump())

    db.add(song)
    db.commit()
    db.refresh(song)

    return song


@router.put("/{song_id}", response_model=SongResponse)
def update_song(
    song_id: int,
    song_data: SongCreate,
    db: Session = Depends(get_db),
):
    song = db.get(Song, song_id)

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Música não encontrada",
        )

    if song_data.artist_id is not None:
        if db.get(Artist, song_data.artist_id) is None:
            raise HTTPException(
                status_code=404,
                detail="Artista não encontrado",
            )

    if song_data.album_id is not None:
        if db.get(Album, song_data.album_id) is None:
            raise HTTPException(
                status_code=404,
                detail="Álbum não encontrado",
            )

    for field, value in song_data.model_dump().items():
        setattr(song, field, value)

    db.commit()
    db.refresh(song)

    return song


@router.delete("/{song_id}")
def delete_song(song_id: int, db: Session = Depends(get_db)):
    song = db.get(Song, song_id)

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Musica nao encontrada",
        )

    audio_url = song.audio_url
    cover_url = song.cover_url

    # Sem chave estrangeira, os favoritos limpam-se aqui.
    db.query(Favorite).filter(Favorite.song_id == song_id).delete()
    db.delete(song)
    db.commit()

    # Os ficheiros so sao apagados se mais nenhuma musica ou album os usar.
    removed = [
        url
        for url in (audio_url, cover_url)
        if remove_file_if_unused(db, url)
    ]

    return {
        "detail": "Musica apagada.",
        "removed_files": removed,
    }


@router.get("/search/", response_model=list[SongResponse])
def search_songs(
    q: str,
    db: Session = Depends(get_db),
):
    search_term = f"%{q.strip()}%"
    songs = (
        db.query(Song)
        .filter(
            or_(
                Song.title.like(search_term),
            )
        )
        .order_by(Song.title.asc())
        .all()
    )

    return songs