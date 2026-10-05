# Turismo SV

App web de turismo que muestra El Salvador como un diorama 3D estilizado, con contenido administrable, modelos 3D generados con un kit de piezas paramétricas y un agente que los compone. El diseño está en `docs/superpowers/specs/2026-10-04-turismo-3d-sv-design.md` y los planes en `docs/superpowers/plans/`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `kit/` | Paleta, proyección geográfica, 21 piezas paramétricas, documento de modelo (Zod), reglas de estilo, guía de estilo para el agente y los cinco modelos de referencia |
| `pipeline/` | DEM de Copernicus a teselas 3D Tiles en terrazas (quadtree de 6 niveles, glb con meshopt) y publicación a S3 |
| `builder-service/` | Servicio Node: `/build`, `/validate-upload` y `/generate` (agente con Claude), exportación a glb y miniaturas con Chromium |
| `backend/` | Laravel 13, Filament 5, PostGIS: API pública, panel de administración, flujo de aprobación, páginas SEO |
| `frontend/` | Vue 3 + Three.js: visor 3D, búsqueda, filtros, panel de detalle, promociones, vista lista, PWA |
| `docker/` | Imágenes y configuración de los servicios locales |

## Requisitos

- Node 22 o superior y pnpm 10
- Docker Desktop

PHP y Composer no se instalan en el host: el backend corre dentro de Docker.

## Primer arranque

```bash
pnpm install
docker compose --profile init run --rm s3-init
docker compose up -d --build --wait
docker compose exec php php artisan migrate --seed
docker compose exec php php artisan admin:create tu@correo.com --super
```

El panel queda en `http://localhost:8000/admin` y el estado del backend en `http://localhost:8000/api/health`.

### Mapa base

```bash
pnpm --filter @turismo/pipeline fetch:dem
TILESET_VERSION=v1 pnpm --filter @turismo/pipeline build:country
S3_ENDPOINT=http://localhost:8333 TILESET_VERSION=v1 pnpm --filter @turismo/pipeline publish:tiles
docker compose exec php php artisan tilesets:register v1 http://localhost:8333/turismo/tiles/v1/
```

### Modelos de referencia

```bash
docker compose exec php php artisan models:seed-reference --as=tu@correo.com
```

### Visor en desarrollo

```bash
pnpm --filter @turismo/frontend dev
```

Para servirlo desde Laravel: `pnpm --filter @turismo/frontend build` genera `backend/public/app`.

### Agente generador

Define `ANTHROPIC_API_KEY` antes de levantar el servicio `builder`. Sin ella `/generate` responde 503 y el resto del servicio funciona. Los precios para el costo estimado se configuran con `LLM_PRICE_INPUT`, `LLM_PRICE_OUTPUT`, `LLM_PRICE_CACHE_READ` y `LLM_PRICE_CACHE_WRITE` (USD por millón de tokens).

## Pruebas

```bash
pnpm typecheck
pnpm test
docker compose exec php vendor/bin/pest
pnpm --filter @turismo/frontend e2e
```

Las pruebas e2e necesitan el backend, el visor y un tileset publicado; usan `CHROMIUM_PATH` para el navegador y `BASE_URL` para apuntar al visor de Vite o a Laravel. Con `E2E_PRODUCTION=1` se activan las del service worker.

## Puertos locales

| Servicio | Puerto |
|---|---|
| Laravel | 8000 |
| builder-service | 3100 |
| PostgreSQL + PostGIS | 54320 |
| Redis | 63790 |
| SeaweedFS S3 | 8333 |
| Vite | 5173 |

## Estado

Implementado y verificado con pruebas automáticas y en navegador:

- Terreno de todo el país en teselas con carga por nivel, modelos 3D aprobados de los cinco monumentos del Centro Histórico, pines, promociones con insignias y spritesheets, panel de detalle, búsqueda, filtros, ES/EN, enlaces profundos, páginas SEO, vista lista sin WebGL y PWA.
- Panel con roles de superadministrador y administrador de zona (alcance por geometría), flujo borrador → aprobación para sitios, promociones y modelos, estudio 3D con versiones, subida de glb y generación con IA.

Pendiente o no verificado:

- Calles, edificios genéricos, vegetación y límites administrativos desde OSM: el pipeline solo usa el DEM y un contorno provisional del país porque el acceso a Geofabrik estaba bloqueado en el entorno de desarrollo. El detalle completo del Gran San Salvador depende de esos datos.
- Exclusión de huellas en las teselas al aprobar un modelo y vista previa 3D dentro de Filament.
- El agente contra la API real de Claude: se probó con respuestas grabadas y el ciclo completo entre servicios con un modelo de lenguaje simulado, sin llamadas reales.
- La configuración de Docker (servicios `builder`, `queue`, `scheduler`, lectura anónima y CORS de SeaweedFS) está escrita pero no se pudo ejecutar en el entorno de desarrollo, que no tenía Docker; el resto se probó contra Postgres, Redis y un S3 compatible locales.
- Rendimiento en un Android de gama media y los ajustes visuales finos.
