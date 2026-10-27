from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.files import read_duration_seconds
from app.services.storage import incoming_path, store

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

MAX_AUDIO_SIZE = 30 * 1024 * 1024  # 30 MB
MAX_COVER_SIZE = 5 * 1024 * 1024   # 5 MB

ALLOWED_EXTENSIONS = {
    "audio/mpeg": {".mp3"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
}


async def receive(file: UploadFile, allowed_types: set[str], max_size: int) -> tuple[Path, int]:
    """Valida e escreve o upload numa pasta temporária.

    Devolve o caminho temporário e o tamanho. Quem chama decide para onde
    o ficheiro vai depois (pasta local ou nuvem).
    """
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Tipo de ficheiro não permitido.",
        )

    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS.get(file.content_type, set()):
        raise HTTPException(
            status_code=400,
            detail="A extensão do ficheiro não corresponde ao tipo permitido.",
        )

    temp = incoming_path(f"{uuid4().hex}{extension}")
    size = 0

    try:
        with temp.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                size += len(chunk)

                if size > max_size:
                    raise HTTPException(
                        status_code=413,
                        detail="O ficheiro excede o tamanho máximo permitido.",
                    )

                output.write(chunk)

        if size == 0:
            raise HTTPException(
                status_code=400,
                detail="O ficheiro está vazio.",
            )

        return temp, size

    except Exception:
        temp.unlink(missing_ok=True)
        raise

    finally:
        await file.close()


def keep(temp: Path, folder: str, content_type: str) -> str:
    try:
        return store(temp, folder, content_type)
    except Exception as error:  # noqa: BLE001
        print("Erro ao guardar o ficheiro:", error)
        raise HTTPException(
            status_code=502,
            detail="Não foi possível guardar o ficheiro. Tenta novamente.",
        )


@router.post("/audio")
async def upload_audio(file: UploadFile = File(...)):
    temp, size = await receive(file, {"audio/mpeg"}, MAX_AUDIO_SIZE)

    # A duração é lida do próprio ficheiro, antes de ele sair do servidor.
    duration = read_duration_seconds(temp)
    url = keep(temp, "audio", file.content_type or "audio/mpeg")

    return {
        "filename": temp.name,
        "url": url,
        "size_bytes": size,
        "duration_seconds": duration,
    }


@router.post("/cover")
async def upload_cover(file: UploadFile = File(...)):
    temp, size = await receive(file, {"image/jpeg", "image/png"}, MAX_COVER_SIZE)
    url = keep(temp, "covers", file.content_type or "image/jpeg")

    return {
        "filename": temp.name,
        "url": url,
        "size_bytes": size,
    }
