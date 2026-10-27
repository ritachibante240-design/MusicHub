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


# Valores que, numa opção de SSL do endereço, querem dizer "liga o SSL".
_SSL_ON = {
    "1", "true", "yes", "on", "required", "require",
    "verify_ca", "verify-ca", "verify_identity", "verify-identity", "verify-full",
}


def _first(value) -> str:
    # No endereço, uma opção repetida chega como tuplo.
    if isinstance(value, (tuple, list)):
        value = value[0] if value else ""
    return str(value).strip()


def _split_ssl(query: dict, env_ca: str | None) -> tuple[dict, dict | None]:
    """Separa as opções de SSL do resto do endereço.

    Opções como "ssl=true" ou "ssl-mode=REQUIRED" não podem seguir no
    endereço: o PyMySQL espera-as noutra forma e falha com
    "'str' object has no attribute 'get'". Por isso saem todas daqui e o
    SSL é configurado de uma só maneira: com o certificado do fornecedor.

    Devolve (o resto das opções, a configuração ssl para o PyMySQL ou None).
    """
    rest: dict = {}
    wanted = False
    url_ca = None

    for key, value in query.items():
        name = key.lower().replace("-", "_")

        if not name.startswith("ssl"):
            rest[key] = value
            continue

        text = _first(value)

        if name in ("ssl", "ssl_mode") and text.lower() in _SSL_ON:
            wanted = True
        elif name == "ssl_ca" and text:
            url_ca = text
            wanted = True

    ca_file = env_ca or url_ca

    if ca_file:
        return rest, {"ca": ca_file}

    if wanted:
        raise RuntimeError(
            "A base de dados pede SSL, mas falta o certificado: define "
            "DATABASE_SSL_CA com o caminho do ca.pem do fornecedor "
            "(no Render: /etc/secrets/ca.pem)."
        )

    return rest, None


def _prepare(url_text: str) -> tuple:
    """Aceita o endereço tal como os serviços na nuvem o dão.

    O Aiven, por exemplo, dá "mysql://...?ssl-mode=REQUIRED": o "mysql://"
    não diz que biblioteca usar e as opções de SSL não são percebidas pelo
    PyMySQL nessa forma. Aqui fica tudo resolvido. Localmente nada muda.
    """
    url = make_url(url_text)

    if url.drivername == "mysql":
        url = url.set(drivername="mysql+pymysql")

    query, ssl = _split_ssl(dict(url.query), os.getenv("DATABASE_SSL_CA"))
    url = url.set(query=query)

    connect_args: dict = {}

    # Com o certificado do fornecedor, a ligação é cifrada e verificada.
    if ssl:
        if not os.path.isfile(ssl["ca"]):
            raise RuntimeError(
                f"Não encontrei o certificado em {ssl['ca']}. No Render, cria "
                "um Secret File chamado exatamente ca.pem com o certificado "
                "do Aiven."
            )

        connect_args["ssl"] = ssl

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
