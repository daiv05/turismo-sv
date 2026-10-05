# Turismo 3D El Salvador — Diseño del MVP

## 1. Propósito y criterios de éxito

Aplicación web de turismo que muestra El Salvador como un diorama 3D estilizado (isométrico, low-poly, paleta restringida con un acento saturado y UI flotante), empezando por San Salvador y su Centro Histórico. El contenido (sitios turísticos, servicios como baños, comercios y promociones) es administrable, y los modelos 3D de cada sitio se generan mediante un agente que respeta por construcción las reglas de estilo de la app.

El MVP sigue una estrategia en dos etapas sobre la misma base técnica:

- **Demo / pitch**: pocos sitios muy pulidos en el Centro Histórico, impacto visual, flujo completo de administración y generación 3D demostrable.
- **Piloto**: la misma base crece a usuarios reales (turistas) con rendimiento en móvil, datos correctos y administradores cargando contenido.

Criterios de éxito de la demo:

- El visor recorre todo el país en baja resolución y el Gran San Salvador con detalle completo, con carga por distancia y sin bloqueos perceptibles.
- Cinco monumentos del Centro Histórico (Catedral Metropolitana, Palacio Nacional, Teatro Nacional, Iglesia El Rosario, Plaza Libertad) tienen modelo 3D aprobado con el kit de estilo.
- Un admin de zona puede crear un sitio, generar su modelo 3D con el agente y enviarlo a aprobación; un super admin lo aprueba y aparece publicado en el visor.
- Las promociones vigentes aparecen como sprites sobre sus sitios y abren su tarjeta.
- La app funciona en español e inglés, en escritorio y en un Android de gama media.

Restricciones: un solo desarrollador asistido por Claude, sin fecha fija; la calidad prima sobre la velocidad.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| País | El Salvador, iniciando por San Salvador / Centro Histórico |
| Plataforma | Web responsiva / PWA; Capacitor como opción para el piloto |
| Backend y admin | Laravel 12 + Filament 4 + PostgreSQL/PostGIS |
| Frontend | Vue 3 + Vite + TypeScript + Pinia; motor 3D en Three.js puro, desacoplado de Vue |
| Repositorio | Monorepo separado por carpetas |
| Mapa | Diorama estilizado generado desde datos reales (OSM + DEM) |
| Streaming del mapa | OGC 3D Tiles con `3DTilesRendererJS` |
| Generación 3D | Kit de piezas paramétricas; el agente produce JSON, nunca mallas |
| Roles | Dos niveles: super admin y admin de zona, con flujo borrador → aprobación |
| Promociones | Badges estáticos o por plantilla en el MVP; formato de spritesheet soportado desde el inicio |
| Idiomas | Español e inglés desde el MVP |
| Métricas | Fuera del MVP |

## 3. Arquitectura

### 3.1 Estructura del repositorio

```
turismo-sv/
├── backend/          Laravel 12 + Filament 4 + PostGIS
│   ├── app/Domain/   Places, Categories, Promotions, Models3D, Zones
│   ├── app/Filament/ Panel de administración
│   └── routes/api.php
├── frontend/         Vue 3 + Vite + TS + Pinia (PWA)
│   ├── src/engine/   Motor Three.js sin dependencias de Vue
│   └── src/ui/       Componentes de interfaz
├── kit/              Paquete TS compartido: piezas, esquemas, builder, paleta, geo
├── builder-service/  Node: agente 3D, validación, exportación .glb y thumbnails
├── pipeline/         Node/TS: OSM + DEM → 3D Tiles estilizados
└── docker-compose.yml
```

Servicios de `docker-compose.yml`: `postgres` (con PostGIS), `php` (Laravel + workers de cola), `redis` (colas y caché), `minio` (almacenamiento S3 local), `builder` (builder-service), `node` (desarrollo de frontend y pipeline).

### 3.2 Flujos de datos

**Mapa base (estático).** `pipeline/` genera `tileset.json` y teselas `.glb`, y los publica en S3/MinIO en una carpeta versionada servida por CDN. El frontend los consume directamente con `3DTilesRendererJS`, sin pasar por Laravel. Un registro `tileset_versions` en el backend indica la versión vigente y el frontend la obtiene de `GET /api/config`.

**Contenido (dinámico).** El frontend solicita `GET /api/places?cell={z}/{x}/{y}&categories=…&locale=…` y Laravel responde con sitios publicados, promociones vigentes y la URL del `.glb` aprobado de cada sitio, resueltos con PostGIS. Las celdas son de una cuadrícula fija por nivel de zoom, cacheables en navegador y CDN con ETag.

**Generación 3D (administración).** El admin de zona describe el sitio y adjunta fotos de referencia; Laravel encola un job que invoca `builder-service`. El servicio ejecuta el agente, valida el resultado, exporta `.glb` y thumbnails, y responde a Laravel, que guarda la versión como borrador. El super admin la revisa en la vista previa 3D de Filament y la aprueba o rechaza.

### 3.3 Principios

- `kit/` es la única fuente de verdad del estilo y de la proyección geográfica; lo consumen frontend, vista previa del admin, builder-service y pipeline.
- Mapa base y contenido están separados: cambiar contenido nunca obliga a regenerar teselas, salvo la exclusión de huellas de sitios con modelo aprobado (sección 7.3).
- Las tareas lentas (generación 3D, regeneración de teselas, procesamiento de imágenes) se ejecutan en colas.

## 4. Modelo de datos

Todas las geometrías se almacenan en WGS84 (SRID 4326). Los campos traducibles usan `spatie/laravel-translatable` con locales `es` y `en`.

### 4.1 Zonas y permisos

- `zones`: `id`, `name` (traducible), `slug`, `type` (`country`, `department`, `municipality`, `tourist_district`), `parent_id`, `boundary` (MultiPolygon), `camera` (JSON con encuadre por defecto para el selector de zona).
- `zone_user`: `zone_id`, `user_id`.
- Roles con `spatie/laravel-permission`: `super_admin`, `zone_admin`.
- Un `zone_admin` solo accede a sitios y promociones cuya ubicación cae dentro de alguna de sus zonas (`ST_Within`), aplicado en policies y en los queries de Filament.

### 4.2 Categorías

- `categories`: `id`, `slug`, `name` (traducible), `icon`, `color_token` (rol de la paleta), `kind` (`attraction`, `service`, `commerce`), `min_zoom`, `attributes_schema` (JSON Schema), `sort`.
- Solo el super admin gestiona categorías.
- Filament genera el formulario de atributos de cada sitio a partir de `attributes_schema`; el backend valida `places.attributes` contra ese esquema al guardar.

### 4.3 Sitios

- `places`: `id`, `category_id`, `zone_id`, `name`, `slug`, `summary`, `description` (traducibles), `location` (Point), `footprint` (Polygon, opcional), `attributes` (JSON), `opening_hours` (JSON), `priority` (entero), `status` (`draft`, `in_review`, `published`, `archived`), `current_model_id`, `created_by`, timestamps.
- Medios con `spatie/laravel-medialibrary` (colección `photos`).
- Un sitio sin modelo aprobado se representa con el pin genérico de su categoría.
- La publicación de un sitio creado por un `zone_admin` requiere aprobación del super admin.

### 4.4 Modelos 3D

- `place_models`: `id`, `place_id`, `version`, `source` (`kit`, `upload`), `kit_version`, `spec` (JSON del kit, nulo si `upload`), `glb_path`, `thumbnail_paths` (JSON), `prompt`, `reference_media` (JSON de ids de medios), `status` (`queued`, `generating`, `draft`, `approved`, `rejected`, `failed`), `failure_reason`, `generation_log` (JSON con iteraciones, tokens y costo), `created_by`, `reviewed_by`, `review_notes`, timestamps.
- Aprobar una versión la asigna como `places.current_model_id` y dispara la regeneración de teselas afectadas.

### 4.5 Promociones

- `promotions`: `id`, `place_id`, `title`, `body` (traducibles), `starts_at`, `ends_at`, `status` (`draft`, `in_review`, `published`, `archived`), `priority`, `sprite_type` (`static`, `spritesheet`, `template`), `sprite_frames`, `sprite_cols`, `sprite_rows`, `sprite_fps`, `template_key`, `template_data` (JSON), timestamps.
- Imagen del sprite en la colección de medios `sprite`.
- La API solo expone promociones `published` con `starts_at <= now() < ends_at`.
- La publicación de una promoción creada por un `zone_admin` requiere aprobación del super admin.

### 4.6 Teselas

- `tileset_versions`: `id`, `version`, `base_url`, `regions` (JSON), `is_current`, `built_at`.

## 5. Kit de estilo (`kit/`)

### 5.1 Contenido del paquete

- `palette`: tokens de color y roles.
- `materials`: material único estilizado (sombreado suave tipo toon con oclusión ambiental horneada en vértices), parámetros de biselado y contorno.
- `pieces`: catálogo de piezas paramétricas; cada pieza exporta un esquema Zod y una función `build(params, ctx) → THREE.Object3D`.
- `spec`: esquema Zod del documento de modelo, exportado también como JSON Schema.
- `builder`: `buildModel(spec) → THREE.Group`, con validación previa.
- `rules`: validador de reglas de estilo.
- `styleGuide`: generador de la guía de estilo en texto que recibe el agente.
- `geo`: proyección lat/lon ↔ coordenadas de escena.

### 5.2 Paleta

| Rol | Uso | Valor inicial |
|---|---|---|
| `ground` | Suelo y terreno base | `#E8EBFA` |
| `neutral` | Edificios genéricos y cuerpos principales | `#F7F8FC` |
| `secondary` | Techos, bases, detalles | `#C7CDF0` |
| `accent` | Elemento dominante de sitios destacados, pines, selección | `#0F47AF` |
| `glass` | Ventanas y superficies vidriadas | `#9EB6FF` |
| `vegetation` | Árboles y áreas verdes | `#6FCB8F` |
| `water` | Lagos, ríos y océano | `#A9C8FF` |
| `promo` | Sprites y badges de promociones | `#F2B33D` |

El acento corresponde al azul de la bandera salvadoreña.

### 5.3 Catálogo de piezas

- Estructurales: `hall`, `tower`, `belfry`, `dome`, `gable-roof`, `hip-roof`, `pediment`, `arcade`, `colonnade`, `steps`, `plinth`, `window-strip`, `door`.
- Entorno: `plaza-floor`, `tree-round`, `tree-cone`, `palm`, `bench`, `fountain`, `lamp`, `kiosk`.

### 5.4 Documento de modelo

```json
{
  "kitVersion": "1.0",
  "footprint": { "w": 40, "d": 70 },
  "parts": [
    { "type": "hall", "params": { "w": 30, "d": 60, "h": 18 }, "pos": [0, 0, 0], "rot": 0, "role": "neutral" },
    { "type": "dome", "params": { "r": 9 }, "pos": [0, 18, 10], "rot": 0, "role": "accent" },
    { "type": "belfry", "params": { "h": 35 }, "pos": [-12, 0, -28], "rot": 0, "role": "neutral" }
  ]
}
```

Unidades en metros; `pos` relativo al centro del footprint; `rot` en grados sobre el eje vertical.

### 5.5 Reglas de estilo validadas en código

- Los colores solo se expresan como roles de la paleta; no se aceptan valores hexadecimales.
- Material, biselado y contorno son fijos y no parametrizables por el agente.
- Todas las piezas se apoyan en el suelo o sobre otra pieza (sin elementos flotantes).
- La caja delimitadora del modelo no excede el footprint más un margen del 10 %.
- Presupuesto máximo de 15 000 triángulos por sitio.
- Como máximo un grupo contiguo de piezas con rol `accent`.
- Un documento que viole cualquier regla se rechaza con una lista de errores legibles con la ruta de la pieza afectada.

## 6. Agente 3D (`builder-service/`)

### 6.1 Endpoints internos

- `POST /generate`: recibe descripción, URLs de fotos de referencia, footprint del sitio (polígono en coordenadas de escena) y opciones; responde de forma asíncrona vía callback a Laravel.
- `POST /build`: recibe un `spec` editado manualmente, lo valida y devuelve `.glb` y thumbnails.
- `POST /validate-upload`: recibe un `.glb` externo, valida presupuesto y escala, reemplaza materiales por los de la paleta y devuelve el `.glb` normalizado.

Autenticación entre Laravel y builder-service mediante token compartido; el servicio no se expone públicamente.

### 6.2 Ciclo de generación

1. Construcción del contexto: descripción, fotos de referencia, footprint de OSM si existe y guía de estilo generada por `kit/styleGuide`.
2. Generación del `spec` con Claude (`claude-sonnet-5-5`) mediante tool use con el JSON Schema del kit.
3. Validación con `kit/rules`; ante errores, se devuelven al modelo para corrección, hasta 3 reintentos.
4. Construcción y render de thumbnails desde 3 ángulos con Three.js en Node (render headless).
5. Autocrítica visual: Claude compara los thumbnails con las fotos de referencia y devuelve ajustes al `spec`; se repite de 1 a 2 rondas según configuración.
6. Exportación final a `.glb` comprimido con meshopt mediante `gltf-transform`, subida a MinIO/S3 y callback a Laravel con rutas, `spec`, y `generation_log`.

### 6.3 Estudio 3D en Filament

- Página por sitio con lista de versiones y su estado.
- Vista previa 3D en vivo embebida (bundle del `engine` y `kit`).
- Formulario de parámetros por pieza para ajustes manuales, que invoca `POST /build`.
- Acción "Regenerar con indicaciones" que encola una nueva generación a partir del `spec` vigente y el texto del admin.
- Acciones de aprobar y rechazar con notas, exclusivas del super admin.
- Subida de `.glb` externo, exclusiva del super admin.

## 7. Pipeline geográfico (`pipeline/`)

### 7.1 Fuentes

- OpenStreetMap: extracto de El Salvador de Geofabrik.
- Elevación: Copernicus GLO-30.
- Límites administrativos de OSM, que también se importan a `zones`.

### 7.2 Etapas

1. **Proyección**: plano métrico local basado en UTM 16N con origen en el centro del país, implementado en `kit/geo`.
2. **Base del diorama**: contorno del país extruido con paredes laterales; océano como plano con shader de oleaje.
3. **Terreno**: remuestreo del DEM por nivel de LOD, cuantización en terrazas (escalones mayores a escala país, menores a escala ciudad) y exageración vertical configurable. Lagos y ríos como superficies de agua.
4. **Calles**: cintas por clase de vía con anchos estilizados, adaptadas al terreno; marcas viales solo en el nivel calle.
5. **Edificios genéricos**: huellas de OSM simplificadas y extruidas con rol `neutral`; altura desde `building:levels` × 3 m o valor por defecto según tipo.
6. **Vegetación**: puntos de árboles distribuidos por uso de suelo, almacenados con `EXT_mesh_gpu_instancing`.
7. **Teselado**: quadtree de 6 niveles (país a calle) con error geométrico por nivel; salida `tileset.json` y `.glb` con colores por vértice, sin texturas, optimizados con `gltf-transform` y meshopt.
8. **Publicación**: subida a carpeta versionada y registro en `tileset_versions`.

### 7.3 Exclusión de huellas

Al aprobar un modelo 3D, el `footprint` del sitio se agrega como zona de exclusión. Un job regenera solo las teselas que intersectan esa huella, omitiendo los edificios genéricos dentro de ella, y publica una nueva versión del tileset.

### 7.4 Alcance de datos de la demo

- Todo el país en los niveles país y departamento.
- Detalle completo (niveles ciudad y calle) solo para el Gran San Salvador.
- La ampliación por regiones se hace configurando nuevas regiones en el pipeline, sin cambios de código.

### 7.5 Herramientas y licencias

- `osmium` y GDAL en contenedor para extracción y recorte; Node/TS con Three.js y `gltf-transform` para geometría.
- Atribución visible de OpenStreetMap (ODbL) y Copernicus en el visor.

## 8. Visor 3D y UI pública (`frontend/`)

### 8.1 Motor (`src/engine/`)

- **Cámara**: perspectiva con FOV de 25°, inclinación limitada entre 35° y 60°, controles de mapa (desplazar, zoom, rotación acotada).
- **Niveles semánticos de zoom**: país, departamento, ciudad, calle.
- **Fly-to**: animación de cámara hacia zona o sitio seleccionado, con resaltado del footprint.
- **Capas**:
  1. Mapa base con `3DTilesRendererJS`, con presupuesto de memoria y error según el dispositivo.
  2. Sitios con LOD propio: burbujas agrupadas por zona (lejos), pines instanciados por categoría (medio), modelos 3D bajo demanda con caché LRU y máximo de modelos simultáneos (cerca).
  3. Promociones: billboards con shader de spritesheet y animación de flotación; un badge estático es un spritesheet de un cuadro.
  4. Etiquetas SDF con `troika-three-text`, priorizadas y con control de colisiones.
- **Picking** por raycast sobre pines, modelos y sprites.
- **Calidad adaptativa**: límite de pixel ratio y reducción de detalle si la tasa de cuadros cae por debajo del objetivo.
- **Comunicación con Vue**: el motor expone una API imperativa y emite eventos tipados; Pinia mantiene el estado de selección, filtros y zona.

### 8.2 Carga de contenido

- Cuadrícula fija por nivel de zoom; el motor calcula las celdas visibles y solicita solo las que no están en caché.
- Caché en memoria por celda con expiración corta y respaldo en caché HTTP.

### 8.3 Interfaz

- **Barra superior**: marca, buscador (sitios, categorías, promociones), selector de zona, selector de idioma.
- **Chips de filtro** por categoría.
- **Tarjetas de contexto**: "Cerca de ti", "Promos activas hoy", "Abierto ahora".
- **Panel de detalle**: lateral en escritorio, hoja inferior en móvil; fotos, horario, atributos de categoría, promociones y botón "Cómo llegar" con enlace a Google Maps o Waze.
- **"Estás aquí"** mediante geolocalización con permiso del usuario.
- **Deep links**: `/lugar/{slug}` y `/zona/{slug}`.
- **Vista lista** sin 3D para dispositivos sin WebGL o de baja capacidad, y para accesibilidad.

### 8.4 Estilo visual

- Paleta de la sección 5.2 aplicada también a la UI: superficies blancas translúcidas sobre la escena, acento azul para selección y acciones primarias, `promo` para promociones.
- Tipografía: Bricolage Grotesque para títulos y Onest para interfaz y cuerpo, con cifras tabulares en datos.
- Microinteracciones: aparición escalonada de tarjetas, rebote suave de pines al seleccionar, flotación de sprites.

### 8.5 PWA y SEO

- Manifest e instalación; service worker que cachea el shell de la app y las teselas visitadas recientemente.
- Laravel sirve páginas Blade ligeras en `/lugar/{slug}` y `/zona/{slug}` con meta tags Open Graph y contenido indexable, que montan la app 3D.

## 9. API pública

| Endpoint | Descripción |
|---|---|
| `GET /api/config` | Versión vigente del tileset, paleta, categorías y zonas de primer nivel |
| `GET /api/places?cell={z}/{x}/{y}&categories=…&locale=…` | Sitios publicados y promociones vigentes de una celda |
| `GET /api/places/{slug}?locale=…` | Detalle completo de un sitio |
| `GET /api/zones/{slug}` | Zona con encuadre de cámara y zonas hijas |
| `GET /api/search?q=…&locale=…` | Búsqueda de sitios, categorías y promociones |

Solo lectura, sin autenticación, con rate limiting y cabeceras de caché.

## 10. Manejo de errores

- **Generación 3D**: fallos tras reintentos dejan la versión en `failed` con `failure_reason` visible y acción de reintentar; los jobs reintentan con backoff ante indisponibilidad de builder-service.
- **Teselas**: reintento de carga y mantenimiento del LOD anterior mientras tanto.
- **Modelos de sitio**: si un `.glb` falla, el sitio conserva su pin genérico.
- **WebGL ausente**: redirección automática a la vista lista.
- **API**: uso de datos cacheados de la celda y aviso discreto.
- **Geolocalización denegada**: se omite el indicador de posición sin interrumpir el flujo.
- **Datos**: validación de atributos contra el esquema de categoría al guardar; promociones fuera de fecha nunca se exponen.

## 11. Pruebas

- **backend**: Pest ejecutado vía `docker compose`; alcance por zona de `zone_admin`, consultas por celda, filtrado de promociones por fecha, validación de atributos, flujos borrador → aprobado de sitios, modelos y promociones.
- **kit**: Vitest por pieza (esquema, solo roles de paleta, presupuesto de triángulos, caja delimitadora), validador de reglas y proyección `geo` ida y vuelta.
- **builder-service**: pruebas con respuestas de Claude grabadas, sin llamadas reales en CI; set de evaluación de 8 monumentos de San Salvador revisado con checklist ante cambios de prompt o kit.
- **pipeline**: ejecución sobre una zona fixture pequeña; validez del tileset, error geométrico decreciente por nivel y presupuesto de peso por tesela.
- **frontend**: Vitest para lógica pura del motor (selección de LOD, celdas visibles, prioridad de etiquetas); Playwright e2e para carga, búsqueda, selección de sitio, apertura del panel y respaldo sin WebGL.

## 12. Hitos

1. **M0 Fundaciones**: monorepo, `docker-compose.yml` (PostGIS, Redis, MinIO), `kit/geo`, CI.
2. **M1 Mapa base**: pipeline (país en baja resolución y Gran San Salvador completo), motor con cámara, navegación y niveles de zoom.
3. **M2 Contenido**: modelo de datos, Filament con roles y zonas, categorías dinámicas, API por celdas, capa de sitios y panel de detalle.
4. **M3 Kit y Estudio 3D manual**: piezas, builder-service (`/build`), vista previa en Filament, exclusión de huellas en teselas, cinco monumentos modelados con el kit.
5. **M4 Agente**: generación, validación, autocrítica visual y flujo de aprobación.
6. **M5 Demo**: promociones y sprites, i18n ES/EN, PWA, páginas SEO, vista lista y pulido visual.

## 13. Fuera del alcance del MVP

- Métricas y analítica.
- Cuentas de turistas, favoritos y reseñas.
- Navegación paso a paso.
- Pagos y autoservicio de comercios.
- Mapas offline completos y notificaciones push.
- Empaquetado nativo con Capacitor.
- Generación híbrida con IA de texto o imagen a 3D.
