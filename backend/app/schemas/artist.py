
from pydantic import BaseModel, ConfigDict, Field


class ArtistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    photo_url: str | None = Field(default=None, max_length=500)
    bio: str | None = None


class ArtistResponse(BaseModel):
    id: int
    name: str
    photo_url: str | None
    bio: str | None

    model_config = ConfigDict(from_attributes=True)
