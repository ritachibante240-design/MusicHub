from sqlalchemy import TIMESTAMP, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Favorite(Base):
    """Uma música guardada nos favoritos.

    O id cresce a cada música guardada, por isso ordenar por ele dá a
    ordem em que foram guardadas (mais fiável do que a data, que pode
    repetir-se ao importar várias de uma vez).

    Não há chave estrangeira para songs de propósito: a tabela songs foi
    criada à mão, e uma pequena diferença no tipo da coluna faria o MySQL
    recusar a chave — e a tabela inteira. A limpeza ao apagar uma música
    é feita no código (rotas de músicas).
    """

    __tablename__ = "favorites"

    id: Mapped[int] = mapped_column(primary_key=True)
    song_id: Mapped[int] = mapped_column(unique=True, nullable=False)
    created_at = mapped_column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
