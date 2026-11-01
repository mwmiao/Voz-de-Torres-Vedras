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
# Um só ciclo, porque o SQLite aceita um escritor de cada vez: os avisos correm entre recolhas completas.
hours="${UPDATE_INTERVAL_HOURS:-0}"
alert_minutes="${ALERT_INTERVAL_MINUTES:-60}"
if [ "$hours" -gt 0 ]; then
  (
    sleep 60
    next_full=0
    while true; do
      if [ "$(date +%s)" -ge "$next_full" ]; then
        next_full=$(($(date +%s) + hours * 3600))
        npx tsx ingestion/run.ts || echo "A atualização falhou; volta a tentar no próximo ciclo."
      elif [ "$alert_minutes" -gt 0 ]; then
        npx tsx ingestion/run.ts --alertas || echo "A atualização de avisos falhou; volta a tentar no próximo ciclo."
      fi
      sleep $(((alert_minutes > 0 ? alert_minutes : 60) * 60))
    done
  ) &
fi

exec "$@"
