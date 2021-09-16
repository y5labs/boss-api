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
