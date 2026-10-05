# Turismo SV

App web de turismo que muestra El Salvador como un diorama 3D estilizado. El diseño está en `docs/superpowers/specs/2026-10-04-turismo-3d-sv-design.md` y los planes de implementación en `docs/superpowers/plans/`.

## Requisitos

- Node 22 o superior y pnpm 10
- Docker Desktop

PHP y Composer no se instalan en el host: el backend corre solo dentro de Docker.

## Primer arranque

```bash
pnpm install
```

```bash
docker compose --profile init run --rm s3-init
```

```bash
docker compose up -d --build --wait
```

```bash
docker compose exec php php artisan migrate
```

El backend queda en `http://localhost:8000` y su estado en `http://localhost:8000/api/health`.

## Pruebas

```bash
pnpm test
```

```bash
docker compose exec php vendor/bin/pest
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `kit/` | Paleta, proyección geográfica y, más adelante, piezas paramétricas del estilo 3D |
| `backend/` | Laravel 13, API pública y panel Filament |
| `docker/` | Imágenes y configuración de servicios locales |

## Puertos locales

| Servicio | Puerto |
|---|---|
| Laravel | 8000 |
| PostgreSQL + PostGIS | 54320 |
| Redis | 63790 |
| SeaweedFS S3 | 8333 |
