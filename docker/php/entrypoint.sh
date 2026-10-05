#!/bin/sh
set -e

if [ -f artisan ]; then
  [ -f .env ] || cp .env.example .env
  [ -f vendor/autoload.php ] || composer install --no-interaction --prefer-dist
  grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force
fi

exec "$@"
