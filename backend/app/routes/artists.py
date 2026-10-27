
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Album, Artist, Song
from app.schemas.artist import ArtistCreate, ArtistResponse
from app.services.files import remove_file_if_unused

router = APIRouter(prefix="/api/artists", tags=["Artistas"])


@router.get("/", response_model=list[ArtistResponse])
def list_artists(db: Session = Depends(get_db)):
    return db.query(Artist).order_by(Artist.id.desc()).all()


@router.get("/{artist_id}", response_model=ArtistResponse)
def get_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)

    if artist is None:
        raise HTTPException(
            status_code=404,
            detail="Artista não encontrado",
        )

    return artist


@router.post(
    "/",
    response_model=ArtistResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_artist(
    artist_data: ArtistCreate,
    db: Session = Depends(get_db),
):
    artist = Artist(**artist_data.model_dump())

    db.add(artist)
    db.commit()
    db.refresh(artist)

    return artist


@router.put("/{artist_id}", response_model=ArtistResponse)
def update_artist(
    artist_id: int,
    artist_data: ArtistCreate,
    db: Session = Depends(get_db),
):
    artist = db.get(Artist, artist_id)

    if artist is None:
        raise HTTPException(
            status_code=404,
            detail="Artista nao encontrado",
        )

    old_photo = artist.photo_url

    for field, value in artist_data.model_dump().items():
        setattr(artist, field, value)

    db.commit()
    db.refresh(artist)

    # Se a foto mudou, a antiga deixa de ser precisa.
    if old_photo and old_photo != artist.photo_url:
        remove_file_if_unused(db, old_photo)

    return artist


@router.delete("/{artist_id}")
def delete_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.get(Artist, artist_id)

    if artist is None:
        raise HTTPException(
            status_code=404,
            detail="Artista nao encontrado",
        )

    # As musicas e os albuns nao sao apagados: apenas ficam sem artista.
    songs = (
        db.query(Song)
        .filter(Song.artist_id == artist_id)
        .update({Song.artist_id: None}, synchronize_session=False)
    )
    albums = (
        db.query(Album)
        .filter(Album.artist_id == artist_id)
        .update({Album.artist_id: None}, synchronize_session=False)
    )

    photo_url = artist.photo_url

    db.delete(artist)
    db.commit()

    remove_file_if_unused(db, photo_url)

    return {
        "detail": "Artista apagado.",
        "songs_without_artist": songs,
        "albums_without_artist": albums,
    }
