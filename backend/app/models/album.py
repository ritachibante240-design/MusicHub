from sqlalchemy import ForeignKey, String, TIMESTAMP, text
from sqlalchemy.dialects.mysql import YEAR
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    cover_url: Mapped[str | None] = mapped_column(String(500))
    release_year: Mapped[int | None] = mapped_column(YEAR)
    artist_id: Mapped[int | None] = mapped_column(
        ForeignKey("artists.id", ondelete="SET NULL")
    )
    created_at = mapped_column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )