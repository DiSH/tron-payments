#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running database migrations..."
  npm run db:migrate
fi

exec "$@"
