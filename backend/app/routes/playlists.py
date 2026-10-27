from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Playlist, PlaylistSong, Song
from app.schemas.playlist import (
    PlaylistCreate,
    PlaylistDetail,
    PlaylistResponse,
    PlaylistSongAdd,
)

router = APIRouter(prefix="/api/playlists", tags=["Playlists"])


def get_playlist_or_404(playlist_id: int, db: Session) -> Playlist:
    playlist = db.get(Playlist, playlist_id)

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist nao encontrada",
        )

    return playlist


@router.get("/", response_model=list[PlaylistResponse])
def list_playlists(db: Session = Depends(get_db)):
    counts = dict(
        db.query(PlaylistSong.playlist_id, func.count(PlaylistSong.song_id))
        .group_by(PlaylistSong.playlist_id)
        .all()
    )

    playlists = db.query(Playlist).order_by(Playlist.id.desc()).all()

    return [
        PlaylistResponse(
            id=playlist.id,
            name=playlist.name,
            song_count=counts.get(playlist.id, 0),
        )
        for playlist in playlists
    ]


@router.get("/{playlist_id}", response_model=PlaylistDetail)
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = get_playlist_or_404(playlist_id, db)

    songs = (
        db.query(Song)
        .join(PlaylistSong, PlaylistSong.song_id == Song.id)
        .filter(PlaylistSong.playlist_id == playlist_id)
        .order_by(PlaylistSong.position.asc(), Song.id.asc())
        .all()
    )

    return PlaylistDetail(
        id=playlist.id,
        name=playlist.name,
        song_count=len(songs),
        songs=songs,
    )


@router.post(
    "/",
    response_model=PlaylistResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_playlist(
    playlist_data: PlaylistCreate,
    db: Session = Depends(get_db),
):
    playlist = Playlist(name=playlist_data.name)

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return PlaylistResponse(id=playlist.id, name=playlist.name, song_count=0)


@router.put("/{playlist_id}", response_model=PlaylistResponse)
def rename_playlist(
    playlist_id: int,
    playlist_data: PlaylistCreate,
    db: Session = Depends(get_db),
):
    playlist = get_playlist_or_404(playlist_id, db)
    playlist.name = playlist_data.name

    db.commit()
    db.refresh(playlist)

    count = (
        db.query(PlaylistSong)
        .filter(PlaylistSong.playlist_id == playlist_id)
        .count()
    )

    return PlaylistResponse(id=playlist.id, name=playlist.name, song_count=count)


@router.delete("/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    playlist = get_playlist_or_404(playlist_id, db)

    # As musicas nao sao apagadas: so deixam de pertencer a playlist.
    db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == playlist_id
    ).delete(synchronize_session=False)

    db.delete(playlist)
    db.commit()

    return {"detail": "Playlist apagada."}


@router.post("/{playlist_id}/songs", status_code=status.HTTP_201_CREATED)
def add_song(
    playlist_id: int,
    data: PlaylistSongAdd,
    db: Session = Depends(get_db),
):
    get_playlist_or_404(playlist_id, db)

    if db.get(Song, data.song_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Musica nao encontrada",
        )

    existing = db.get(PlaylistSong, (playlist_id, data.song_id))

    if existing is not None:
        return {"detail": "A musica ja estava na playlist."}

    last = (
        db.query(func.max(PlaylistSong.position))
        .filter(PlaylistSong.playlist_id == playlist_id)
        .scalar()
    )

    db.add(
        PlaylistSong(
            playlist_id=playlist_id,
            song_id=data.song_id,
            position=(last or 0) + 1,
        )
    )
    db.commit()

    return {"detail": "Musica adicionada a playlist."}


@router.delete("/{playlist_id}/songs/{song_id}")
def remove_song(
    playlist_id: int,
    song_id: int,
    db: Session = Depends(get_db),
):
    get_playlist_or_404(playlist_id, db)

    entry = db.get(PlaylistSong, (playlist_id, song_id))

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="A musica nao esta nesta playlist",
        )

    db.delete(entry)
    db.commit()

    return {"detail": "Musica removida da playlist."}
