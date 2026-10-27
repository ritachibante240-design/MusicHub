from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Album, Artist, Song

BASE_DIR = Path(__file__).resolve().parents[2]
STORAGE_DIR = BASE_DIR / "storage"


def resolve_storage_path(url: str | None) -> Path | None:
    """Converte "/storage/audio/x.mp3" no caminho real do ficheiro.

    Devolve None se o endereco nao pertencer a pasta storage, o que
    impede que um valor manipulado aponte para fora dela.
    """
    if not url or not url.startswith("/storage/"):
        return None

    relative = url[len("/storage/"):]
    candidate = (STORAGE_DIR / relative).resolve()

    try:
        candidate.relative_to(STORAGE_DIR.resolve())
    except ValueError:
        return None

    return candidate


def count_references(db: Session, url: str) -> int:
    """Quantos registos ainda usam este ficheiro."""
    return (
        db.query(Song).filter(Song.audio_url == url).count()
        + db.query(Song).filter(Song.cover_url == url).count()
        + db.query(Album).filter(Album.cover_url == url).count()
        + db.query(Artist).filter(Artist.photo_url == url).count()
    )


def remove_file_if_unused(db: Session, url: str | None) -> bool:
    """Apaga o ficheiro do disco se mais nenhum registo o usar.

    Deve ser chamada depois do commit que remove o registo, para que a
    contagem ja nao inclua a linha apagada.
    """
    if not url:
        return False

    if count_references(db, url) > 0:
        return False

    # Ficheiro na nuvem? Apaga-se lá. (Importado aqui para evitar que os
    # dois módulos se importem um ao outro.)
    from app.services.storage import delete_cloud_object

    if delete_cloud_object(url):
        return True

    path = resolve_storage_path(url)

    if path is None or not path.is_file():
        return False

    path.unlink(missing_ok=True)

    return True


def read_duration_seconds(path: Path) -> int:
    """Le a duracao real do ficheiro de audio, em segundos."""
    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(path)

        if audio is None or audio.info is None:
            return 0

        return int(round(audio.info.length))
    except Exception:
        # Se nao for possivel ler, fica 0 e o utilizador pode escrever.
        return 0
