from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SongCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    duration: int = Field(default=0, ge=0)
    audio_url: str = Field(min_length=1, max_length=500)
    cover_url: str | None = Field(default=None, max_length=500)
    artist_id: int | None = Field(default=None, gt=0)
    album_id: int | None = Field(default=None, gt=0)


class ArtistInfo(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class AlbumInfo(BaseModel):
    id: int
    title: str
    cover_url: str | None

    model_config = ConfigDict(from_attributes=True)


class SongResponse(BaseModel):
    id: int
    title: str
    duration: int
    audio_url: str
    cover_url: str | None
    artist_id: int | None
    album_id: int | None
    created_at: datetime
    artist: ArtistInfo | None = None
    album: AlbumInfo | None = None

    model_config = ConfigDict(from_attributes=True)