# Boss API

```
docker buildx create \
  --use \
  --name mybuilder

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t tcoats/boss-api:latest \
  -t tcoats/boss-api:1.0.1 \
  -t tcoats/boss-api:1.0 \
  -t tcoats/boss-api:1 \
  --push \
  .

docker run --rm -it \
  -e BOSS_PG_HOST=127.0.0.1 \
  -e BOSS_PG_DATABASE=postgres \
  -e BOSS_PG_USER=postgres \
  -e BOSS_PG_PASSWORD=postgres \
  -e BOSS_PG_PORT=5432 \
  -e BOSS_PG_SCHEMA=public \
  -e BOSS_APPLICATION_NAME=boss-test \
  -e MIGRATE_ON_STARTUP=1 \
  -p "8081:8081" \
  -p "2323:23" \
  tcoats/boss-api:latest
```

---

To run locally you'll want to pull the two repositories, spin up a PostgreSQL server.

Boss API requires environment variables:
```
BOSS_PG_HOST=localhost
BOSS_PG_DATABASE=postgres
BOSS_PG_USER=postgres
BOSS_PG_PASSWORD=postgres
BOSS_PG_PORT=5432
BOSS_PG_SCHEMA=public
BOSS_APPLICATION_NAME=boss-test
MIGRATE_ON_STARTUP=1
And can be installed using
```

```
npm i
npm run dev
```

An API key and secret need to be generated. The API runs a telnet server internally. These commands will generate a new key and secret.

```
telnet localhost
help
api_key_new
```
