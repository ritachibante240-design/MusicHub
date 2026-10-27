
from pydantic import BaseModel, ConfigDict, Field


class AlbumCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    cover_url: str | None = Field(default=None, max_length=500)
    release_year: int | None = Field(
        default=None,
        ge=1901,
        le=2155,
    )
    artist_id: int | None = Field(default=None, gt=0)


class AlbumResponse(BaseModel):
    id: int
    title: str
    cover_url: str | None
    release_year: int | None
    artist_id: int | None

    model_config = ConfigDict(from_attributes=True)
