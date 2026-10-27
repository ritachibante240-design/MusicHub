import colorsys
import io
import urllib.request
from pathlib import Path
from typing import BinaryIO

from fastapi import APIRouter, Query

from app.services.files import resolve_storage_path
from app.services.storage import cloud_key

# Uma capa tem no máximo 5 MB; ao descarregar da nuvem não lemos mais.
MAX_DOWNLOAD = 6 * 1024 * 1024

router = APIRouter(prefix="/api/covers", tags=["Capas"])

# Uma capa nao muda de cor: guardamos o resultado por ficheiro e data de
# modificacao (na nuvem, pelo endereco, que nunca e reutilizado), para
# cada imagem ser analisada uma unica vez.
_cache: dict[tuple[str, float], str | None] = {}

# Quantas fatias do circulo das cores. A cor escolhida e a da fatia com
# mais peso, e nao a media de todas: numa capa vermelha e azul, a media
# daria um roxo que nao existe na imagem.
HUE_BUCKETS = 12


def _pillow_available() -> bool:
    try:
        import PIL  # noqa: F401
    except ImportError:
        return False
    return True


def _dominant_color(source: Path | BinaryIO) -> str | None:
    """Cor dominante de uma capa, ajustada para servir de fundo escuro.

    Devolve None quando a imagem nao tem cor (preto e branco) ou nao se
    consegue ler; nesse caso a app usa a cor de reserva que ja tinha.
    """
    from PIL import Image

    try:
        with Image.open(source) as image:
            small = image.convert("RGB")
            small.thumbnail((64, 64))
            pixels = list(small.getdata())
    except Exception:
        return None

    # Brancos, pretos e cinzentos nao contam: numa capa branca com letras
    # vermelhas, a cor da capa e o vermelho, nao o branco.
    buckets: dict[int, list[float]] = {}

    for red, green, blue in pixels:
        hue, light, sat = colorsys.rgb_to_hls(red / 255, green / 255, blue / 255)

        if light < 0.08 or light > 0.92 or sat < 0.18:
            continue

        weight = sat
        acc = buckets.setdefault(int(hue * HUE_BUCKETS) % HUE_BUCKETS, [0.0, 0.0, 0.0, 0.0])
        acc[0] += weight
        acc[1] += red * weight
        acc[2] += green * weight
        acc[3] += blue * weight

    if not buckets:
        return None

    weight, red_sum, green_sum, blue_sum = max(buckets.values(), key=lambda acc: acc[0])
    hue, light, sat = colorsys.rgb_to_hls(
        red_sum / weight / 255, green_sum / weight / 255, blue_sum / weight / 255
    )

    # Para fundo de um ecra escuro: luz media-baixa e saturacao firme,
    # senao uma capa palida dava um fundo lavado e uma escura desaparecia.
    light = min(max(light, 0.32), 0.42)
    sat = max(sat, 0.45)
    red, green, blue = colorsys.hls_to_rgb(hue, light, sat)

    return "#{:02x}{:02x}{:02x}".format(
        round(red * 255), round(green * 255), round(blue * 255)
    )


@router.get("/color")
def cover_color(url: str = Query(..., max_length=500)):
    """Cor dominante de uma capa guardada em /storage."""
    # Sem o Pillow instalado nao ha cor, mas o servidor continua a
    # funcionar; e nao guardamos o "sem cor", para que instalar o Pillow
    # passe a funcionar sem mais nada.
    if not _pillow_available():
        return {"color": None}

    path = resolve_storage_path(url)

    if path is not None and path.is_file():
        key = (str(path), path.stat().st_mtime)

        if key not in _cache:
            _cache[key] = _dominant_color(path)

        return {"color": _cache[key]}

    # Capa na nuvem: so descarregamos enderecos do nosso proprio bucket,
    # para este pedido nao poder ser usado para ir buscar outra coisa.
    if cloud_key(url) is None or "/covers/" not in url:
        return {"color": None}

    key = (url, 0.0)

    if key not in _cache:
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                data = response.read(MAX_DOWNLOAD + 1)
        except Exception:  # noqa: BLE001
            return {"color": None}

        if len(data) > MAX_DOWNLOAD:
            return {"color": None}

        _cache[key] = _dominant_color(io.BytesIO(data))

    return {"color": _cache[key]}
