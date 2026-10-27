from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.models  # noqa: F401 — regista todas as tabelas antes de as criar
from app.database import Base, engine

from app.routes.albums import router as albums_router
from app.routes.artists import router as artists_router
from app.routes.covers import router as covers_router
from app.routes.favorites import router as favorites_router
from app.routes.playlists import router as playlists_router
from app.routes.songs import router as songs_router
from app.routes.uploads import router as uploads_router

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
AUDIO_DIR = STORAGE_DIR / "audio"
COVERS_DIR = STORAGE_DIR / "covers"

AUDIO_DIR.mkdir(parents=True, exist_ok=True)
COVERS_DIR.mkdir(parents=True, exist_ok=True)

# Cria as tabelas que ainda não existirem. Numa base de dados nova (na
# nuvem) cria-as todas; no teu MySQL local, onde já existem, não faz nada
# — nunca altera nem apaga tabelas existentes. Se falhar, o servidor
# arranca na mesma e o erro fica no registo.
try:
    Base.metadata.create_all(bind=engine)
except Exception as error:  # noqa: BLE001
    print("Aviso: nao foi possivel criar as tabelas em falta:", error)

app = FastAPI(
    title="MusicHub API",
    description="API para gerir músicas, artistas e álbuns do MusicHub",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/storage",
    StaticFiles(directory=str(STORAGE_DIR)),
    name="storage",
)

app.include_router(songs_router)
app.include_router(artists_router)
app.include_router(albums_router)
app.include_router(playlists_router)
app.include_router(uploads_router)
app.include_router(covers_router)
app.include_router(favorites_router)


# GET e HEAD: o Render verifica o servidor com pedidos HEAD, que antes
# davam "405 Method Not Allowed" no registo.
@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {
        "message": "MusicHub API está a funcionar"
    }