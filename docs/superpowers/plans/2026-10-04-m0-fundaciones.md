# M0 Fundaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar listo el monorepo con el paquete compartido `kit` (paleta y proyección geográfica), la infraestructura Docker (PostGIS, Redis, SeaweedFS), un backend Laravel 13 con Pest y un endpoint de salud, y CI en GitHub Actions.

**Architecture:** Monorepo pnpm con paquetes TypeScript (`kit/` en este hito) y un backend Laravel en `backend/` que solo se ejecuta dentro de Docker, porque la máquina de desarrollo no tiene PHP ni Composer. `docker-compose.yml` en la raíz levanta todos los servicios; el contenedor `php` monta el repositorio completo en `/repo` y prepara el backend automáticamente con un entrypoint.

**Tech Stack:** Node 24, pnpm 11, TypeScript 7, Vitest 5, proj4 2.22, PHP 8.4, Laravel 13, Pest 5, predis, league/flysystem-aws-s3-v3, PostgreSQL 17 + PostGIS 3.5, Redis 8.8, SeaweedFS 4.48, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-04-turismo-3d-sv-design.md`

## Global Constraints

- Paleta exacta (spec 5.2): `ground #E8EBFA`, `neutral #F7F8FC`, `secondary #C7CDF0`, `accent #0F47AF`, `glass #9EB6FF`, `vegetation #6FCB8F`, `water #A9C8FF`, `promo #F2B33D`.
- Proyección (spec 7.2): plano métrico local basado en UTM 16N con origen en el centro del país; Three.js usa Y arriba, así que `x` = este y `z` = sur (`z` negativo hacia el norte).
- Geometrías en base de datos en WGS84, SRID 4326 (spec 4).
- Comentarios en código: solo DocBlocks (JSDoc/PHPDoc) cuando aportan algo que el nombre no dice; ningún comentario narrativo, ni en archivos de configuración, YAML, Markdown o dotfiles.
- Markdown sin cortes de línea dentro de párrafos.
- Commits con Conventional Commits y sin trailers de coautoría.
- PHP, Composer, Artisan y Pest se ejecutan siempre con `docker compose`, nunca en el host.
- Los comandos se escriben para Git Bash en Windows; los que pasan rutas absolutas de contenedor usan `MSYS_NO_PATHCONV=1`.
- Linters o formatters solo sobre los archivos modificados, nunca sobre directorios completos.

## Review Focus

- Coordenadas con latitud y longitud invertidas (error clásico al copiar de Google Maps): `lonLatToScene` debe lanzar `RangeError` en lugar de devolver un punto absurdo. Prueba en Task 2.
- Clonado en Windows con `core.autocrlf=true`: `docker/php/entrypoint.sh` con CRLF rompe el contenedor (`/bin/sh^M: not found`). Se fija con `.gitattributes` en Task 1 y se verifica con `git ls-files --eol` en Task 3.
- Clon limpio sin `vendor/` ni `.env`: `docker compose up` debe dejar el backend funcionando sin pasos manuales. Lo cubre el entrypoint de Task 3 y se verifica en CI (Task 5), que siempre parte de un clon limpio.
- Una dependencia caída (Redis o almacenamiento): `/api/health` debe responder 503 con el detalle por servicio, no un 500 genérico. Pruebas en Task 4.
- Ejecutar dos veces la inicialización del bucket: `s3-init` debe ser idempotente y terminar con código 0 la segunda vez. Verificación en Task 3.

---

## File Structure

```
turismo-sv/
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .github/workflows/ci.yml
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── docker-compose.yml
├── docker/
│   ├── php/Dockerfile
│   ├── php/entrypoint.sh
│   ├── postgres/20-test-database.sql
│   └── seaweedfs/s3.json
├── kit/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/palette.ts
│   ├── src/geo.ts
│   ├── test/palette.test.ts
│   └── test/geo.test.ts
└── backend/                                  (skeleton de Laravel 13)
    ├── .env.example                          (reemplazado)
    ├── phpunit.xml                           (reemplazado)
    ├── bootstrap/app.php                     (modificado: rutas api)
    ├── routes/api.php                        (nuevo)
    ├── app/Http/Controllers/HealthController.php
    ├── database/migrations/0001_01_01_000000_enable_postgis.php
    ├── tests/Pest.php
    └── tests/Feature/HealthTest.php
```

Responsabilidades: `kit/src/palette.ts` es la única definición de colores por rol; `kit/src/geo.ts` es la única conversión lat/lon ↔ escena; `HealthController` reporta el estado de cada dependencia del backend; `docker/php/entrypoint.sh` prepara `.env`, `vendor/` y `APP_KEY` en un clon limpio.

---

### Task 1: Monorepo y paleta del kit

**Files:**
- Create: `.editorconfig`, `.gitattributes`, `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `kit/package.json`, `kit/tsconfig.json`, `kit/src/palette.ts`
- Test: `kit/test/palette.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: módulo `@turismo/kit/palette` con `PALETTE: Readonly<Record<ColorRole, string>>`, `type ColorRole = 'ground' | 'neutral' | 'secondary' | 'accent' | 'glass' | 'vegetation' | 'water' | 'promo'`, `COLOR_ROLES: readonly ColorRole[]`, `isColorRole(value: unknown): value is ColorRole`, `colorForRole(role: ColorRole): string`. Scripts raíz `pnpm test` y `pnpm typecheck` que recorren todos los paquetes.

- [ ] **Step 1: Crear los archivos raíz del monorepo**

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.php]
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```

`.gitattributes`:

```
* text=auto eol=lf
*.sh text eol=lf
*.png binary
*.jpg binary
*.glb binary
```

`.gitignore`:

```
node_modules/
dist/
coverage/
.env
*.log
.DS_Store
Thumbs.db
```

`package.json`:

```json
{
  "name": "turismo-sv",
  "private": true,
  "packageManager": "pnpm@11.3.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "test": "pnpm -r --if-present test",
    "typecheck": "pnpm -r --if-present typecheck"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - kit
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  }
}
```

- [ ] **Step 2: Renormalizar los archivos existentes a LF**

Run: `git add --renormalize . && git status --short`
Expected: aparecen los archivos nuevos y, si había alguno con CRLF en el índice, la spec como modificada; no hay errores.

- [ ] **Step 3: Crear el paquete `kit`**

`kit/package.json`:

```json
{
  "name": "@turismo/kit",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./palette": "./src/palette.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^5.0.3"
  }
}
```

`kit/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src", "test"]
}
```

Run: `pnpm install`
Expected: se crea `pnpm-lock.yaml` y `kit/node_modules`; termina sin errores.

- [ ] **Step 4: Escribir la prueba de la paleta**

`kit/test/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { COLOR_ROLES, PALETTE, colorForRole, isColorRole } from '../src/palette';

describe('palette', () => {
  it('defines exactly the roles of the style guide', () => {
    expect([...COLOR_ROLES].sort()).toEqual(
      ['accent', 'glass', 'ground', 'neutral', 'promo', 'secondary', 'vegetation', 'water'],
    );
  });

  it('uses uppercase six digit hex values for every role', () => {
    for (const role of COLOR_ROLES) {
      expect(PALETTE[role]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('uses the Salvadoran flag blue as accent', () => {
    expect(colorForRole('accent')).toBe('#0F47AF');
  });

  it('matches the spec values', () => {
    expect(PALETTE).toEqual({
      ground: '#E8EBFA',
      neutral: '#F7F8FC',
      secondary: '#C7CDF0',
      accent: '#0F47AF',
      glass: '#9EB6FF',
      vegetation: '#6FCB8F',
      water: '#A9C8FF',
      promo: '#F2B33D',
    });
  });

  it('accepts only known role names', () => {
    expect(isColorRole('accent')).toBe(true);
    expect(isColorRole('#0F47AF')).toBe(false);
    expect(isColorRole('red')).toBe(false);
    expect(isColorRole(undefined)).toBe(false);
    expect(isColorRole(42)).toBe(false);
  });

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true);
  });
});
```

- [ ] **Step 5: Ejecutar la prueba y verificar que falla**

Run: `pnpm --filter @turismo/kit test`
Expected: FAIL con un error de resolución de `../src/palette`.

- [ ] **Step 6: Implementar la paleta**

`kit/src/palette.ts`:

```ts
export type ColorRole =
  | 'ground'
  | 'neutral'
  | 'secondary'
  | 'accent'
  | 'glass'
  | 'vegetation'
  | 'water'
  | 'promo';

export const PALETTE: Readonly<Record<ColorRole, string>> = Object.freeze({
  ground: '#E8EBFA',
  neutral: '#F7F8FC',
  secondary: '#C7CDF0',
  accent: '#0F47AF',
  glass: '#9EB6FF',
  vegetation: '#6FCB8F',
  water: '#A9C8FF',
  promo: '#F2B33D',
});

export const COLOR_ROLES: readonly ColorRole[] = Object.freeze(Object.keys(PALETTE) as ColorRole[]);

/**
 * Checks whether a value is a palette role name, rejecting raw color values.
 *
 * @param value Value to check.
 * @returns True when the value is one of the palette roles.
 */
export function isColorRole(value: unknown): value is ColorRole {
  return typeof value === 'string' && Object.hasOwn(PALETTE, value);
}

export function colorForRole(role: ColorRole): string {
  return PALETTE[role];
}
```

- [ ] **Step 7: Ejecutar pruebas y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: 6 pruebas PASS en `palette.test.ts`; `tsc` sin errores.

- [ ] **Step 8: Commit**

```bash
git add .editorconfig .gitattributes .gitignore package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json kit docs
git commit -m "feat(kit): scaffold pnpm monorepo and style palette"
```

---

### Task 2: Proyección geográfica del kit

**Files:**
- Create: `kit/src/geo.ts`
- Modify: `kit/package.json` (export `./geo` y dependencia `proj4`)
- Test: `kit/test/geo.test.ts`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: módulo `@turismo/kit/geo` con `interface LonLat { lon: number; lat: number }`, `interface ScenePoint { x: number; z: number }`, `SCENE_ORIGIN: Readonly<LonLat>` (`{ lon: -88.9, lat: 13.75 }`), `PROJECTION_BOUNDS: Readonly<{ minLon: number; maxLon: number; minLat: number; maxLat: number }>`, `lonLatToScene(point: LonLat): ScenePoint`, `sceneToLonLat(point: ScenePoint): LonLat`. Ambas funciones lanzan `RangeError` ante valores no finitos o fuera de `PROJECTION_BOUNDS`.

- [ ] **Step 1: Agregar la dependencia y el export**

Run: `pnpm --filter @turismo/kit add proj4@^2.22.0`
Expected: `kit/package.json` gana `"dependencies": { "proj4": "^2.22.0" }`.

En `kit/package.json`, dejar `exports` así:

```json
  "exports": {
    "./palette": "./src/palette.ts",
    "./geo": "./src/geo.ts"
  },
```

- [ ] **Step 2: Escribir las pruebas de proyección**

`kit/test/geo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SCENE_ORIGIN, lonLatToScene, sceneToLonLat, type LonLat } from '../src/geo';

const CATEDRAL: LonLat = { lon: -89.191, lat: 13.699 };
const SAN_SALVADOR: LonLat = { lon: -89.2182, lat: 13.6929 };
const SANTA_ANA: LonLat = { lon: -89.5597, lat: 13.9942 };

function haversineMeters(a: LonLat, b: LonLat): number {
  const r = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

describe('lonLatToScene', () => {
  it('maps the scene origin to (0, 0)', () => {
    const p = lonLatToScene(SCENE_ORIGIN);
    expect(Math.abs(p.x)).toBeLessThan(1e-6);
    expect(Math.abs(p.z)).toBeLessThan(1e-6);
  });

  it('points north towards negative z', () => {
    const p = lonLatToScene({ lon: SCENE_ORIGIN.lon, lat: SCENE_ORIGIN.lat + 0.01 });
    expect(p.z).toBeLessThan(0);
    expect(Math.abs(p.z + 1106)).toBeLessThan(5);
  });

  it('points east towards positive x', () => {
    const p = lonLatToScene({ lon: SCENE_ORIGIN.lon + 0.01, lat: SCENE_ORIGIN.lat });
    expect(p.x).toBeGreaterThan(0);
    expect(Math.abs(p.x - 1081.5)).toBeLessThan(5);
  });

  it('preserves real distances within 0.5 percent', () => {
    const a = lonLatToScene(SAN_SALVADOR);
    const b = lonLatToScene(SANTA_ANA);
    const projected = Math.hypot(b.x - a.x, b.z - a.z);
    const real = haversineMeters(SAN_SALVADOR, SANTA_ANA);
    expect(Math.abs(projected - real) / real).toBeLessThan(0.005);
  });

  it('rejects swapped latitude and longitude', () => {
    expect(() => lonLatToScene({ lon: 13.699, lat: -89.191 })).toThrow(RangeError);
  });

  it('rejects coordinates far outside El Salvador', () => {
    expect(() => lonLatToScene({ lon: -99.13, lat: 19.43 })).toThrow(RangeError);
  });

  it('rejects non finite values', () => {
    expect(() => lonLatToScene({ lon: Number.NaN, lat: 13.7 })).toThrow(RangeError);
  });
});

describe('sceneToLonLat', () => {
  it('round trips a landmark with sub-centimeter error', () => {
    const back = sceneToLonLat(lonLatToScene(CATEDRAL));
    expect(Math.abs(back.lon - CATEDRAL.lon)).toBeLessThan(1e-7);
    expect(Math.abs(back.lat - CATEDRAL.lat)).toBeLessThan(1e-7);
  });

  it('rejects scene points that fall outside the projection bounds', () => {
    expect(() => sceneToLonLat({ x: 5_000_000, z: 0 })).toThrow(RangeError);
  });

  it('rejects non finite values', () => {
    expect(() => sceneToLonLat({ x: Number.POSITIVE_INFINITY, z: 0 })).toThrow(RangeError);
  });
});
```

- [ ] **Step 3: Ejecutar las pruebas y verificar que fallan**

Run: `pnpm --filter @turismo/kit test`
Expected: FAIL con un error de resolución de `../src/geo`.

- [ ] **Step 4: Implementar la proyección**

`kit/src/geo.ts`:

```ts
import proj4 from 'proj4';

export interface LonLat {
  lon: number;
  lat: number;
}

export interface ScenePoint {
  x: number;
  z: number;
}

const WGS84 = 'EPSG:4326';
const UTM_16N = '+proj=utm +zone=16 +datum=WGS84 +units=m +no_defs';

export const SCENE_ORIGIN: Readonly<LonLat> = Object.freeze({ lon: -88.9, lat: 13.75 });

export const PROJECTION_BOUNDS = Object.freeze({
  minLon: -90.5,
  maxLon: -87.3,
  minLat: 12.8,
  maxLat: 14.8,
});

const [ORIGIN_EASTING, ORIGIN_NORTHING] = proj4(WGS84, UTM_16N, [SCENE_ORIGIN.lon, SCENE_ORIGIN.lat]) as [number, number];

function assertWithinBounds({ lon, lat }: LonLat): void {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new RangeError(`Coordinates must be finite numbers, received lon=${lon} lat=${lat}`);
  }
  const { minLon, maxLon, minLat, maxLat } = PROJECTION_BOUNDS;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
    throw new RangeError(
      `Coordinates lon=${lon} lat=${lat} are outside El Salvador projection bounds; check that latitude and longitude are not swapped`,
    );
  }
}

/**
 * Projects WGS84 coordinates into scene meters, with x towards east and z towards south.
 *
 * @param point Longitude and latitude in degrees.
 * @returns Scene coordinates in meters relative to SCENE_ORIGIN.
 * @throws {RangeError} When the point is not finite or lies outside PROJECTION_BOUNDS.
 */
export function lonLatToScene(point: LonLat): ScenePoint {
  assertWithinBounds(point);
  const [easting, northing] = proj4(WGS84, UTM_16N, [point.lon, point.lat]) as [number, number];
  return { x: easting - ORIGIN_EASTING, z: -(northing - ORIGIN_NORTHING) };
}

/**
 * Converts scene meters back to WGS84 coordinates.
 *
 * @param point Scene coordinates in meters relative to SCENE_ORIGIN.
 * @returns Longitude and latitude in degrees.
 * @throws {RangeError} When the point is not finite or maps outside PROJECTION_BOUNDS.
 */
export function sceneToLonLat(point: ScenePoint): LonLat {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    throw new RangeError(`Scene point must be finite, received x=${point.x} z=${point.z}`);
  }
  const [lon, lat] = proj4(UTM_16N, WGS84, [point.x + ORIGIN_EASTING, ORIGIN_NORTHING - point.z]) as [number, number];
  const result = { lon, lat };
  assertWithinBounds(result);
  return result;
}
```

- [ ] **Step 5: Ejecutar pruebas y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: 16 pruebas PASS (6 de paleta y 10 de geo); `tsc` sin errores. Si `tsc` reporta que `proj4` no tiene export por defecto, cambiar la importación a `import * as proj4Module from 'proj4'; const proj4 = proj4Module.default;` y volver a ejecutar.

- [ ] **Step 6: Commit**

```bash
git add kit pnpm-lock.yaml
git commit -m "feat(kit): add local UTM 16N scene projection"
```

---

### Task 3: Infraestructura Docker

**Files:**
- Create: `docker-compose.yml`, `docker/php/Dockerfile`, `docker/php/entrypoint.sh`, `docker/postgres/20-test-database.sql`, `docker/seaweedfs/s3.json`

**Interfaces:**
- Consumes: `.gitattributes` de Task 1 (LF en `*.sh`).
- Produces: servicios `postgres` (host `postgres:5432`, base `turismo` y `turismo_test`, usuario y contraseña `turismo`), `redis` (`redis:6379`), `s3` (endpoint `http://s3:8333`, access key `turismo`, secret `turismo-secret`, bucket `turismo`), `php` (imagen con PHP 8.4, `pdo_pgsql`, `intl`, `zip`, `bcmath`, `pcntl` y Composer; monta el repo en `/repo` con working dir `/repo/backend`; sirve Laravel en el puerto 8000). Servicio `s3-init` en el perfil `init`. Puertos del host: 54320 (Postgres), 63790 (Redis), 8333 (S3), 8000 (Laravel).

- [ ] **Step 1: Verificar que Docker Desktop está corriendo**

Run: `docker info --format '{{.ServerVersion}}'`
Expected: imprime una versión. Si falla con `failed to connect to the docker API`, iniciar Docker Desktop y repetir.

- [ ] **Step 2: Crear la configuración de servicios**

`docker/postgres/20-test-database.sql`:

```sql
CREATE DATABASE turismo_test OWNER turismo;
```

`docker/seaweedfs/s3.json`:

```json
{
  "identities": [
    {
      "name": "turismo",
      "credentials": [
        {
          "accessKey": "turismo",
          "secretKey": "turismo-secret"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
```

`docker/php/Dockerfile`:

```dockerfile
FROM php:8.4-cli-alpine

RUN apk add --no-cache git unzip libpq icu-libs libzip \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS postgresql-dev icu-dev libzip-dev linux-headers \
    && docker-php-ext-install pdo_pgsql intl zip bcmath pcntl \
    && apk del .build-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /repo/backend
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

`docker/php/entrypoint.sh`:

```sh
#!/bin/sh
set -e

if [ -f artisan ]; then
  [ -f .env ] || cp .env.example .env
  [ -f vendor/autoload.php ] || composer install --no-interaction --prefer-dist
  grep -q '^APP_KEY=base64:' .env || php artisan key:generate --force
fi

exec "$@"
```

`docker-compose.yml`:

```yaml
name: turismo-sv

services:
  postgres:
    image: postgis/postgis:17-3.5-alpine
    environment:
      POSTGRES_DB: turismo
      POSTGRES_USER: turismo
      POSTGRES_PASSWORD: turismo
    ports:
      - "54320:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/20-test-database.sql:/docker-entrypoint-initdb.d/20-test-database.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U turismo -d turismo"]
      interval: 5s
      timeout: 5s
      retries: 30

  redis:
    image: redis:8.8-alpine
    ports:
      - "63790:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20

  s3:
    image: chrislusf/seaweedfs:4.48
    command: server -dir=/data -ip.bind=0.0.0.0 -s3 -s3.port=8333 -s3.config=/etc/seaweedfs/s3.json
    ports:
      - "8333:8333"
    volumes:
      - s3-data:/data
      - ./docker/seaweedfs/s3.json:/etc/seaweedfs/s3.json:ro
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:9333/cluster/status || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 30

  s3-init:
    image: amazon/aws-cli:2.37.9
    profiles: ["init"]
    depends_on:
      s3:
        condition: service_healthy
    environment:
      AWS_ACCESS_KEY_ID: turismo
      AWS_SECRET_ACCESS_KEY: turismo-secret
      AWS_DEFAULT_REGION: us-east-1
    entrypoint: ["sh", "-c"]
    command:
      - aws --endpoint-url http://s3:8333 s3api head-bucket --bucket turismo || aws --endpoint-url http://s3:8333 s3 mb s3://turismo

  php:
    build: docker/php
    command: php artisan serve --host=0.0.0.0 --port=8000
    ports:
      - "8000:8000"
    volumes:
      - ./:/repo
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:8000/api/health || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 300s
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      s3:
        condition: service_healthy

volumes:
  postgres-data:
  s3-data:
```

- [ ] **Step 3: Verificar finales de línea LF del entrypoint**

Run: `git add docker docker-compose.yml && git ls-files --eol docker/php/entrypoint.sh`
Expected: la línea contiene `i/lf` y `attr/text eol=lf`.

- [ ] **Step 4: Levantar los servicios de datos**

Run: `docker compose up -d --wait postgres redis s3`
Expected: los tres servicios quedan `Healthy`.

- [ ] **Step 5: Verificar PostGIS y la base de pruebas**

Run: `docker compose exec -T postgres psql -U turismo -d turismo_test -tAc "CREATE EXTENSION IF NOT EXISTS postgis; SELECT postgis_lib_version();"`
Expected: imprime `CREATE EXTENSION` (o un aviso de que ya existe) y una versión que empieza por `3.5`.

- [ ] **Step 6: Crear el bucket dos veces para verificar la idempotencia**

Run: `docker compose --profile init run --rm s3-init && docker compose --profile init run --rm s3-init && echo IDEMPOTENT_OK`
Expected: la primera ejecución imprime `make_bucket: turismo`; la segunda termina sin error; al final aparece `IDEMPOTENT_OK`.

- [ ] **Step 7: Construir la imagen PHP y verificar extensiones**

Run: `docker compose build php && docker compose run --rm --no-deps php php -m`
Expected: la lista incluye `pdo_pgsql`, `intl`, `zip`, `bcmath`, `pcntl`, `pdo_sqlite` y `mbstring`. El directorio `backend/` puede quedar creado vacío en el host; se usa en la tarea siguiente.

- [ ] **Step 8: Commit**

```bash
git add docker docker-compose.yml
git commit -m "build(docker): add postgis, redis, seaweedfs and php services"
```

---

### Task 4: Backend Laravel con endpoint de salud

**Files:**
- Create: `backend/` (skeleton de Laravel 13 vía `composer create-project`)
- Replace: `backend/.env.example`, `backend/phpunit.xml`
- Modify: `backend/bootstrap/app.php` (registrar `routes/api.php`)
- Create: `backend/routes/api.php`, `backend/app/Http/Controllers/HealthController.php`, `backend/database/migrations/0001_01_01_000000_enable_postgis.php`, `backend/tests/Pest.php`
- Delete: `backend/tests/Feature/ExampleTest.php`, `backend/tests/Unit/ExampleTest.php`
- Test: `backend/tests/Feature/HealthTest.php`

**Interfaces:**
- Consumes: servicios `postgres`, `redis`, `s3` y la imagen `php` de Task 3.
- Produces: `GET /api/health` que responde `200 {"status":"ok","checks":{"database":true,"postgis":"<versión>","redis":true,"storage":true}}`, o `503` con `"status":"degraded"` y `false` en cada dependencia que falla. La migración `enable_postgis` se ejecuta antes que cualquier otra (prefijo `0001_01_01_000000`). `tests/Pest.php` aplica `RefreshDatabase` a todas las pruebas de `tests/Feature`.

- [ ] **Step 1: Crear el proyecto Laravel**

Run: `docker compose run --rm --no-deps php sh -c "cd /repo && composer create-project laravel/laravel backend '^13.0' --no-interaction"`
Expected: termina con `Application ready` o un mensaje equivalente; existe `backend/artisan`.

- [ ] **Step 2: Instalar dependencias de backend**

Run: `docker compose run --rm --no-deps php sh -c "composer remove phpunit/phpunit --dev --no-interaction && composer require pestphp/pest pestphp/pest-plugin-laravel --dev --with-all-dependencies --no-interaction && composer require predis/predis league/flysystem-aws-s3-v3 --no-interaction && vendor/bin/pest --init"`
Expected: `composer.json` incluye `pestphp/pest`, `pestphp/pest-plugin-laravel`, `predis/predis` y `league/flysystem-aws-s3-v3`; existe `tests/Pest.php`.

- [ ] **Step 3: Reemplazar `.env.example` y regenerar `.env`**

`backend/.env.example`:

```
APP_NAME="Turismo SV"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

APP_LOCALE=es
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=es_ES

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=turismo
DB_USERNAME=turismo
DB_PASSWORD=turismo

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=s3
QUEUE_CONNECTION=redis
CACHE_STORE=redis

REDIS_CLIENT=predis
REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_FROM_ADDRESS="hola@turismo-sv.test"
MAIL_FROM_NAME="${APP_NAME}"

AWS_ACCESS_KEY_ID=turismo
AWS_SECRET_ACCESS_KEY=turismo-secret
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=turismo
AWS_ENDPOINT=http://s3:8333
AWS_USE_PATH_STYLE_ENDPOINT=true

VITE_APP_NAME="${APP_NAME}"
```

Run: `rm -f backend/.env backend/database/database.sqlite && docker compose run --rm --no-deps php sh -c "grep -c '^APP_KEY=base64:' .env"`
Expected: el entrypoint copia `.env.example` a `.env`, genera la clave y el comando imprime `1`.

- [ ] **Step 4: Reemplazar `phpunit.xml`**

`backend/phpunit.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true">
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>app</directory>
        </include>
    </source>
    <php>
        <env name="APP_ENV" value="testing" force="true"/>
        <env name="APP_MAINTENANCE_DRIVER" value="file"/>
        <env name="BCRYPT_ROUNDS" value="4"/>
        <env name="CACHE_STORE" value="array" force="true"/>
        <env name="DB_CONNECTION" value="pgsql" force="true"/>
        <env name="DB_DATABASE" value="turismo_test" force="true"/>
        <env name="MAIL_MAILER" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync" force="true"/>
        <env name="SESSION_DRIVER" value="array" force="true"/>
        <env name="PULSE_ENABLED" value="false"/>
        <env name="TELESCOPE_ENABLED" value="false"/>
        <env name="NIGHTWATCH_ENABLED" value="false"/>
    </php>
</phpunit>
```

- [ ] **Step 5: Configurar Pest y quitar las pruebas de ejemplo**

`backend/tests/Pest.php`:

```php
<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');
```

Run: `rm -f backend/tests/Feature/ExampleTest.php backend/tests/Unit/ExampleTest.php && touch backend/tests/Unit/.gitkeep`
Expected: `backend/tests/Feature/` queda sin archivos de ejemplo.

- [ ] **Step 6: Escribir las pruebas del endpoint de salud**

`backend/tests/Feature/HealthTest.php`:

```php
<?php

use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\Fluent\AssertableJson;

it('reports every dependency as healthy', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('status', 'ok')
            ->where('checks.database', true)
            ->where('checks.redis', true)
            ->where('checks.storage', true)
            ->where('checks.postgis', fn (string $version) => str_starts_with($version, '3.'))
        );
});

it('returns 503 with the failing check when redis is unreachable', function () {
    Redis::shouldReceive('connection')->andThrow(new RuntimeException('connection refused'));

    $this->getJson('/api/health')
        ->assertStatus(503)
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.redis', false)
        ->assertJsonPath('checks.database', true);
});

it('returns 503 with the failing check when storage is unreachable', function () {
    Storage::shouldReceive('disk')->with('s3')->andThrow(new RuntimeException('endpoint unreachable'));

    $this->getJson('/api/health')
        ->assertStatus(503)
        ->assertJsonPath('status', 'degraded')
        ->assertJsonPath('checks.storage', false)
        ->assertJsonPath('checks.redis', true);
});
```

- [ ] **Step 7: Ejecutar las pruebas y verificar que fallan**

Run: `docker compose run --rm php vendor/bin/pest`
Expected: FAIL; la primera prueba recibe 404 porque `/api/health` no existe.

- [ ] **Step 8: Crear la migración de PostGIS**

`backend/database/migrations/0001_01_01_000000_enable_postgis.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');
    }

    public function down(): void
    {
        DB::statement('DROP EXTENSION IF EXISTS postgis');
    }
};
```

- [ ] **Step 9: Crear el controlador de salud**

`backend/app/Http/Controllers/HealthController.php`:

```php
<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class HealthController
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->probe(fn () => DB::select('select 1 as ok') !== []),
            'postgis' => $this->probe(fn () => (string) DB::scalar('select postgis_lib_version()')),
            'redis' => $this->probe(fn () => (bool) Redis::connection()->ping()),
            'storage' => $this->probe(fn () => $this->storageRoundTrip()),
        ];

        $healthy = ! in_array(false, $checks, true);

        return response()->json(
            ['status' => $healthy ? 'ok' : 'degraded', 'checks' => $checks],
            $healthy ? 200 : 503,
        );
    }

    /**
     * Runs a dependency probe and converts any failure into false.
     *
     * @param  Closure(): (bool|string)  $probe  Probe returning true, false or a version string.
     * @return bool|string Probe result, or false when it throws.
     */
    private function probe(Closure $probe): bool|string
    {
        try {
            return $probe();
        } catch (Throwable) {
            return false;
        }
    }

    private function storageRoundTrip(): bool
    {
        $disk = Storage::disk('s3');
        $path = 'health/probe.txt';

        $disk->put($path, 'ok');
        $ok = $disk->get($path) === 'ok';
        $disk->delete($path);

        return $ok;
    }
}
```

- [ ] **Step 10: Registrar la ruta**

`backend/routes/api.php`:

```php
<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);
```

En `backend/bootstrap/app.php`, dentro de `->withRouting(`, agregar la línea `api: __DIR__.'/../routes/api.php',` justo después de la línea `web: __DIR__.'/../routes/web.php',`. El bloque queda así:

```php
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
```

- [ ] **Step 11: Ejecutar las pruebas y verificar que pasan**

Run: `docker compose run --rm php vendor/bin/pest`
Expected: 3 pruebas PASS.

- [ ] **Step 12: Verificar el servidor de desarrollo**

Run: `docker compose up -d --wait php && docker compose exec -T php php artisan migrate --force && curl -s http://localhost:8000/api/health`
Expected: las migraciones corren empezando por `0001_01_01_000000_enable_postgis` y `curl` imprime un JSON con `"status":"ok"`.

- [ ] **Step 13: Commit**

```bash
git add backend
git commit -m "feat(backend): scaffold Laravel 13 with Pest and health endpoint"
```

---

### Task 5: CI y README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: scripts `pnpm test` y `pnpm typecheck` (Task 1), `docker-compose.yml` y perfil `init` (Task 3), `vendor/bin/pest` (Task 4).
- Produces: workflow `ci` con los jobs `kit` y `backend`, que corre en cada push y pull request.

- [ ] **Step 1: Crear el workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
  pull_request:

jobs:
  kit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: docker compose --profile init run --rm s3-init
      - run: docker compose up -d --build --wait
      - run: docker compose exec -T php vendor/bin/pest
      - if: failure()
        run: docker compose logs
```

- [ ] **Step 2: Crear el README**

`README.md`:

````markdown
# Turismo SV

App web de turismo que muestra El Salvador como un diorama 3D estilizado. El diseño está en `docs/superpowers/specs/2026-10-04-turismo-3d-sv-design.md` y los planes de implementación en `docs/superpowers/plans/`.

## Requisitos

- Node 24 y pnpm 11
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
````

- [ ] **Step 3: Verificar el flujo de clon limpio en local**

Run: `docker compose down -v && rm -rf backend/vendor backend/.env && docker compose --profile init run --rm s3-init && docker compose up -d --build --wait && docker compose exec -T php vendor/bin/pest`
Expected: el entrypoint recrea `.env`, instala `vendor/`, genera `APP_KEY`; `php` solo queda `Healthy` cuando `/api/health` responde 200, y las 3 pruebas PASS. Esto reproduce lo que hará el job `backend` en CI.

- [ ] **Step 4: Commit**

```bash
git add .github README.md
git commit -m "ci: add kit and backend workflows with project readme"
```

- [ ] **Step 5: Push y verificación de CI**

Pedir confirmación al usuario antes de hacer push. Con su visto bueno:

Run: `git push && gh run watch --exit-status $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: los jobs `kit` y `backend` terminan en verde.

---

## Hoja de ruta de planes siguientes

Cada hito tendrá su propio plan, escrito al iniciarlo a partir de la spec y de lo aprendido en el hito anterior:

1. `m1-mapa-base`: pipeline OSM + DEM a 3D Tiles para el país en baja resolución y el Gran San Salvador completo; frontend Vue con el motor, cámara, navegación y niveles de zoom.
2. `m2-contenido`: modelo de datos, Filament 5 con roles y zonas, categorías dinámicas, API por celdas, capa de sitios y panel de detalle.
3. `m3-kit-estudio-3d`: piezas paramétricas, builder-service con `/build`, vista previa en Filament, exclusión de huellas en teselas y cinco monumentos modelados.
4. `m4-agente`: generación con Claude, validación, autocrítica visual y flujo de aprobación.
5. `m5-demo`: promociones y sprites, i18n ES/EN, PWA, páginas SEO, vista lista y pulido visual.
