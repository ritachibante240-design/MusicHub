"""Onde ficam os ficheiros carregados (MP3 e capas).

- No teu PC (sem S3_BUCKET definido): na pasta storage, como sempre.
- No Render: num bucket compatível com S3 (Cloudflare R2, Supabase
  Storage, Backblaze B2...). O disco do Render gratuito apaga-se a cada
  reinício, por isso lá os ficheiros não podem ficar no servidor.

Variáveis da nuvem:
  S3_BUCKET             nome do bucket
  S3_ENDPOINT_URL       endereço S3 do fornecedor
  S3_ACCESS_KEY_ID      chave de acesso
  S3_SECRET_ACCESS_KEY  segredo da chave
  S3_PUBLIC_BASE_URL    endereço público de leitura do bucket
  S3_REGION             opcional ("auto" serve para o R2)
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
STORAGE_DIR = BASE_DIR / "storage"
INCOMING_DIR = STORAGE_DIR / ".incoming"


def cloud_enabled() -> bool:
    return bool(os.getenv("S3_BUCKET"))


def _public_base() -> str:
    return (os.getenv("S3_PUBLIC_BASE_URL") or "").rstrip("/")


def _client():
    # Só é importado na nuvem: no PC não precisas de ter o boto3.
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
        aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
        region_name=os.getenv("S3_REGION") or "auto",
    )


def incoming_path(filename: str) -> Path:
    """Sítio temporário onde o upload é escrito antes de ser guardado."""
    INCOMING_DIR.mkdir(parents=True, exist_ok=True)
    return INCOMING_DIR / filename


def store(temp_path: Path, folder: str, content_type: str) -> str:
    """Guarda um ficheiro já recebido e devolve o endereço para a base de dados.

    folder é "audio" ou "covers". O ficheiro temporário deixa de existir.
    """
    filename = temp_path.name

    if not cloud_enabled():
        target_dir = STORAGE_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        temp_path.replace(target_dir / filename)
        return f"/storage/{folder}/{filename}"

    key = f"{folder}/{filename}"

    try:
        _client().upload_file(
            str(temp_path),
            os.environ["S3_BUCKET"],
            key,
            ExtraArgs={"ContentType": content_type},
        )
    finally:
        temp_path.unlink(missing_ok=True)

    return f"{_public_base()}/{key}"


def cloud_key(url: str | None) -> str | None:
    """A chave no bucket, se o endereço for um ficheiro nosso na nuvem."""
    base = _public_base()

    if not url or not cloud_enabled() or not base:
        return None

    if not url.startswith(base + "/"):
        return None

    key = url[len(base) + 1 :]

    # Só as nossas pastas, e nada de "../" — o endereço vem da base de dados.
    if ".." in key or not key.startswith(("audio/", "covers/")):
        return None

    return key


def delete_cloud_object(url: str | None) -> bool:
    """Apaga um ficheiro da nuvem. Devolve False se não era da nuvem."""
    key = cloud_key(url)

    if key is None:
        return False

    try:
        _client().delete_object(Bucket=os.environ["S3_BUCKET"], Key=key)
    except Exception as error:  # noqa: BLE001
        # Um ficheiro que não se apagou não deve impedir apagar a música.
        print("Aviso: nao foi possivel apagar da nuvem:", key, error)
        return False

    return True
