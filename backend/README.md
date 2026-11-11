# Backend FastAPI - Sistema ETL y Cubo OLAP SNIES

Backend REST para la ingesta automatizada de reportes del SNIES y procesamiento analítico multidimensional sobre PostgreSQL (Universidad de Nariño - Inteligencia de Negocios 2026).

---

## 1. Características Principales

1. **Auto-inicialización Garantizada**: Al iniciar la API, verifica la existencia de la base de datos `snies_dw`. Si no existe, la crea y aplica automáticamente el esquema físico completo de **6 dimensiones** (`staging`, `dw`, `audit`) con sus miembros desconocidos subrogados (`-1`).
2. **Pipeline ETL Idempotente**:
   - Ingesta optimizada del archivo oficial `Programas - SIES.xlsx` (hoja `Programas`, 39 columnas) y formatos `.csv`.
   - Limpieza de textos (colapso de espacios y caracteres nulos reales como `'n/a'`), parseo de fechas seriales de Excel y validación de rangos.
   - Detección de duplicados mediante huella digital `SHA-256` (`hash_fila`) e inserción idempotente con `ON CONFLICT`.
   - Registro de métricas de reconciliación en `audit.log_cargas` y anomalías en `audit.log_errores_etl`.
3. **Motor OLAP Dinámico (Self-Service BI)**:
   - Permite que el frontend arme consultas libres con cualquier combinación de dimensiones (ubicación, institución, programa, modalidad, área/CINE y tiempo) y métricas.
   - Soporte nativo para operaciones **Slice & Dice** (`group`), **Roll-up / Drill-down jerárquico** (`rollup`) y **Cubo completo** (`cube`).
   - **Pivot dinámico** matricial (rotación de dimensión a columnas con totales).
   - **Benchmarking institucional** con `RANK()` y comparación porcentual frente a la media.
   - **Participación territorial** (concentración temática local vs. nacional con diferencia en puntos porcentuales).
   - **Drillthrough y exportación CSV** para explorar los programas individuales detrás de cada cifra.
   - **12 Presets listos** que implementan las consultas del documento académico (`CS-1` a `CS-5` y `CC-1` a `CC-7`).

---

## 2. Requisitos y Configuración

- Python 3.11+ (probado en Python 3.14 con `psycopg 3` y `psycopg-pool`).
- PostgreSQL 16+ en ejecución.

### Configuración de Variables de Entorno (`.env`)

Crea o edita el archivo `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=snies_dw
DB_USER=postgres
DB_PASSWORD=1234
DB_MIN_CONN=1
DB_MAX_CONN=10
API_HOST=localhost
API_PORT=8000
CORS_ORIGINS=*
```

---

## 3. Instalación y Ejecución

```bash
# 1. Posicionarse en la carpeta backend
cd backend

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Iniciar el servidor FastAPI
uvicorn app.main:app --reload --host localhost --port 8000
```

- Documentación interactiva Swagger: **`http://localhost:8000/docs`**
- Interfaz ReDoc: **`http://localhost:8000/redoc`**

---

## 4. Endpoints Disponibles

### A. Sistema ETL (`/api/etl`)
- `POST /api/etl/upload`: Subida de archivo Excel o CSV (procesado asíncronamente con `BackgroundTasks`).
- `GET /api/etl/status/{id_carga}`: Estado de una carga en tiempo real (polling).
- `GET /api/etl/history`: Historial paginado de cargas.
- `GET /api/etl/errors/{id_carga}`: Anomalías o rechazos detectados en la auditoría.

### B. Cubo OLAP y Analítica (`/api/analytics`)
- `GET /api/analytics/metadata`: Diccionario de dimensiones, jerarquías, métricas y rangos.
- `GET /api/analytics/kpis`: Tarjetas con métricas globales.
- `POST /api/analytics/filter-options`: Opciones para selectores en cascada.
- `POST /api/analytics/query`: Constructor de consultas dinámicas (`group`, `rollup`, `cube`).
- `POST /api/analytics/pivot`: Matriz dinámica de dimensiones en filas y columnas.
- `POST /api/analytics/compare`: Benchmarking institucional o comparativa territorial.
- `POST /api/analytics/drillthrough`: Detalle tabular o descarga en CSV (`format="csv"`).
- `GET /api/analytics/presets`: Las 12 consultas del documento académico.

---

## 5. Pruebas de Verificación

Para ejecutar la suite de pruebas unitarias y de humo:

```bash
python backend/tests/test_smoke.py
```
