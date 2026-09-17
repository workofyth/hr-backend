#!/bin/sh
set -e

echo "[entrypoint] Menjalankan migration database..."
node ./node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run

echo "[entrypoint] Migration selesai, menjalankan aplikasi..."
exec "$@"
