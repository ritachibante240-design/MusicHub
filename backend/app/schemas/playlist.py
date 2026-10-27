from pydantic import BaseModel, ConfigDict, Field

from app.schemas.song import SongResponse


class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)


class PlaylistSongAdd(BaseModel):
    song_id: int = Field(gt=0)


class PlaylistResponse(BaseModel):
    id: int
    name: str
    song_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PlaylistDetail(PlaylistResponse):
    songs: list[SongResponse] = []
