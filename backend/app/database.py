import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "A variável DATABASE_URL não foi definida no ficheiro .env"
    )


def _prepare(url_text: str) -> tuple:
    """Aceita o endereço tal como os serviços na nuvem o dão.

    O Aiven, por exemplo, dá "mysql://...?ssl-mode=REQUIRED": o "mysql://"
    não diz que biblioteca usar e o "ssl-mode" não é percebido pelo
    PyMySQL. Aqui ficam os dois resolvidos. Localmente nada muda.
    """
    url = make_url(url_text)

    if url.drivername == "mysql":
        url = url.set(drivername="mysql+pymysql")

    query = dict(url.query)
    ssl_mode = query.pop("ssl-mode", None) or query.pop("ssl_mode", None)
    url = url.set(query=query)

    connect_args: dict = {}
    ca_file = os.getenv("DATABASE_SSL_CA")

    # Com o certificado do fornecedor, a ligação é cifrada e verificada.
    if ca_file:
        connect_args["ssl"] = {"ca": ca_file}
    elif ssl_mode and str(ssl_mode).upper() not in ("DISABLED", "PREFERRED"):
        raise RuntimeError(
            "A base de dados exige SSL: define DATABASE_SSL_CA com o caminho "
            "do certificado (ca.pem) do fornecedor."
        )

    return url, connect_args


_url, _connect_args = _prepare(DATABASE_URL)

engine = create_engine(
    _url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    # Bases de dados na nuvem fecham ligações paradas; renovamos antes.
    pool_recycle=280,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def test_connection():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT DATABASE()"))
        print("Base de dados ligada:", result.scalar())
