
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Album, Artist, Song
from app.schemas.album import AlbumCreate, AlbumResponse
from app.services.files import remove_file_if_unused

router = APIRouter(prefix="/api/albums", tags=["Álbuns"])


@router.get("/", response_model=list[AlbumResponse])
def list_albums(db: Session = Depends(get_db)):
    return db.query(Album).order_by(Album.id.desc()).all()


@router.get("/{album_id}", response_model=AlbumResponse)
def get_album(album_id: int, db: Session = Depends(get_db)):
    album = db.get(Album, album_id)

    if album is None:
        raise HTTPException(
            status_code=404,
            detail="Álbum não encontrado",
        )

    return album


@router.post(
    "/",
    response_model=AlbumResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_album(
    album_data: AlbumCreate,
    db: Session = Depends(get_db),
):
    if album_data.artist_id is not None:
        artist = db.get(Artist, album_data.artist_id)

        if artist is None:
            raise HTTPException(
                status_code=404,
                detail="Artista não encontrado",
            )

    album = Album(**album_data.model_dump())

    db.add(album)
    db.commit()
    db.refresh(album)

    return album


@router.put("/{album_id}", response_model=AlbumResponse)
def update_album(
    album_id: int,
    album_data: AlbumCreate,
    db: Session = Depends(get_db),
):
    album = db.get(Album, album_id)

    if album is None:
        raise HTTPException(
            status_code=404,
            detail="Album nao encontrado",
        )

    if album_data.artist_id is not None:
        if db.get(Artist, album_data.artist_id) is None:
            raise HTTPException(
                status_code=404,
                detail="Artista nao encontrado",
            )

    old_cover = album.cover_url

    for field, value in album_data.model_dump().items():
        setattr(album, field, value)

    db.commit()
    db.refresh(album)

    # Se a capa mudou, a antiga deixa de ser precisa.
    if old_cover and old_cover != album.cover_url:
        remove_file_if_unused(db, old_cover)

    return album


@router.delete("/{album_id}")
def delete_album(album_id: int, db: Session = Depends(get_db)):
    album = db.get(Album, album_id)

    if album is None:
        raise HTTPException(
            status_code=404,
            detail="Album nao encontrado",
        )

    cover_url = album.cover_url

    # As musicas nao sao apagadas: apenas ficam sem album.
    songs = (
        db.query(Song)
        .filter(Song.album_id == album_id)
        .update({Song.album_id: None}, synchronize_session=False)
    )

    db.delete(album)
    db.commit()

    removed = remove_file_if_unused(db, cover_url)

    return {
        "detail": "Album apagado.",
        "songs_without_album": songs,
        "removed_cover": removed,
    }
