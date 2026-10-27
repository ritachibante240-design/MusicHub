from sqlalchemy import inspect

from app.database import Base, engine
from app.models import Album, Artist, Playlist, PlaylistSong, Song


inspector = inspect(engine)

print("Tabelas existentes:")
for table in inspector.get_table_names():
    print("-", table)

print("\nModelos carregados:")
for model in [Artist, Album, Song, Playlist, PlaylistSong]:
    print("-", model.__name__)

print("\nTabelas registadas nos modelos:")
for table in Base.metadata.sorted_tables:
    print("-", table.name)

print("\nColunas da tabela songs:")
for column in inspector.get_columns("songs"):
    print("-", column["name"])
