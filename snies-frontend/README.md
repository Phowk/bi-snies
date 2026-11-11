# SNIES BI — Frontend Angular

Interfaz web del sistema ETL/OLAP de programas académicos del SNIES (Universidad de Nariño).
Angular 22 + Angular Material + ECharts (ngx-echarts).

## Ejecutar

```bash
npm install
npm start          # http://localhost:4200
npm test           # pruebas unitarias (Vitest)
npm run build      # compilación de producción en dist/
```

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/carga` | Arrastrar y soltar `.xlsx`/`.csv` (máx. 50 MB), progreso de subida y seguimiento del ETL cada 2 s hasta `EXITOSO` o `ERROR`. |
| `/historial` | Tabla ordenable de `audit.log_cargas`: duración, filas leídas/cargadas/rechazadas, reconciliación y mensaje de error. Se refresca sola mientras haya cargas en proceso. |
| `/dashboard` | Filtros (año, departamento, modalidad, nivel, sector), KPIs y las consultas CS-1…CS-5, CC-2, CC-4…CC-7 del cubo. CC-1 y CC-3 se obtienen con los filtros. |

## Modo simulado y backend real

`src/environments/environment.ts`:

- `useMock: true` (por defecto): un interceptor HTTP (`src/app/core/mock/`) responde en el navegador con ~1500 programas sintéticos y reimplementa las consultas del cubo. Un archivo cuyo nombre contiene `error` simula una carga fallida.
- `useMock: false`: las peticiones van a `/api`, que `proxy.conf.json` redirige a FastAPI en `http://localhost:8000`.

## Contrato de la API (lo que FastAPI debe implementar)

Tipos exactos en `src/app/core/models.ts`.

| Método y ruta | Respuesta |
|---|---|
| `POST /api/etl/upload` — multipart, campo `archivo` | `202 { "id_carga": number }`; lanza el ETL con `BackgroundTasks`. Errores: `{ "detail": "..." }` |
| `GET /api/etl/cargas` | `Carga[]` (filas de `audit.log_cargas`, más reciente primero) |
| `GET /api/etl/cargas/{id}` | `Carga` |
| `GET /api/olap/filtros` | `{ anio: number[], departamento: string[], modalidad: string[], nivel: string[], sector: string[] }` |
| `GET /api/olap/kpis` | `{ total_programas, promedio_creditos, promedio_periodos, costo_promedio }` |
| `GET /api/olap/{cs1\|cs2\|cs3\|cs4\|cs5\|cc2\|cc4\|cc5\|cc6\|cc7}` | Filas con las mismas columnas (alias) que los scripts SQL del documento del cubo OLAP |

Todos los `GET /api/olap/*` aceptan filtros como parámetros repetidos, p. ej.
`?anio=2024&departamento=Nariño&departamento=Cauca`. Un filtro ausente significa "todos"; los valores de un mismo filtro se combinan con `IN (...)` y los filtros entre sí con `AND`. En el SQL, sustituya los valores fijos (2024, 'Nariño', …) por estos parámetros. Excepciones:

- `cs2` fija la institución en Universidad de Nariño (ignora `departamento` y `sector`).
- `cs3` y `cc7` son series de tiempo: ignoran `anio`.
- `cc6` compara Nariño contra el país: ignora `departamento`.
- `cc7` usa los departamentos filtrados; sin filtro usa Nariño, Cauca y Putumayo.
- `cc2` devuelve las filas del `ROLLUP` con `nivel_agregacion` 0 = municipio, 1 = departamento, 2 = total nacional.
