#!/bin/sh
set -e

# Pastas montadas pertencem ao dono no anfitrião: sem isto o SQLite não consegue escrever.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown -R app:app /app/data || echo "Aviso: não foi possível ajustar as permissões de /app/data."
  exec su-exec app "$0" "$@"
fi

npx prisma migrate deploy
npx tsx scripts/data.ts bootstrap

# Atualização automática dentro do contentor. 0 desliga.
hours="${UPDATE_INTERVAL_HOURS:-0}"
if [ "$hours" -gt 0 ]; then
  (
    sleep 60
    while true; do
      npx tsx ingestion/run.ts || echo "A atualização falhou; volta a tentar no próximo ciclo."
      sleep $((hours * 3600))
    done
  ) &
fi

exec "$@"
