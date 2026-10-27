# Certificado da base de dados

Guarda aqui o certificado (CA) do Aiven com o nome **`ca.pem`**:

1. Aiven → o teu serviço MySQL → **Connection information**
2. **CA certificate** → **Download** (ou **Show** e copiar tudo)
3. Guarda como `backend/certs/ca.pem`

É um certificado **público** — serve para o backend confirmar que está
mesmo a falar com o Aiven — por isso pode ir para o GitHub. O que **nunca**
vai para o GitHub é a palavra-passe (o `DATABASE_URL`, no `.env` e no Render).

O backend usa este ficheiro sozinho quando o endereço da base de dados pede
SSL e a variável `DATABASE_SSL_CA` não está definida. O MySQL do teu PC não
é afetado.
