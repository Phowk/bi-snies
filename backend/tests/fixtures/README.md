# Archivos de prueba de la carga ETL

Datos **ficticios** con la misma estructura que el reporte oficial de programas del SNIES (hoja `Programas`, 39 columnas).
Los programas usan códigos SNIES `990001` en adelante, que no existen en el reporte real.

> **No los cargue en la base real (`snies_dw`).** Sus programas se sumarían a las cifras del SNIES.
> Use la base de pruebas como se explica abajo.

## Qué prueba cada archivo

Cárguelos **en orden**: cada resultado parte del estado que dejó el anterior.

| Archivo | Caso | Resultado esperado | Programas en la bodega |
|---|---|---|---|
| `01_valido.xlsx` | Carga normal (incluye una hoja extra, como el reporte real) | EXITOSO · 40 leídas · 40 cargadas · 0 descartadas | 40 |
| `02_mismos_programas.csv` | Los mismos 40 programas, en CSV y con fechas como texto | EXITOSO · 40 leídas · 0 descartadas | 40 (no duplica) |
| `03_con_anomalias.xlsx` | 20 programas nuevos con errores típicos, una fila duplicada, 2 códigos SNIES inválidos y una nota al pie | EXITOSO · 24 leídas · 20 cargadas · 3 descartadas · 8 tipos de anomalías | 60 |
| `04_actualizacion.xlsx` | 5 programas existentes con nuevo costo (12.345.000) y 3 nuevos | EXITOSO | 63 |
| `05_vacio.xlsx` | Solo encabezados | ERROR: "El archivo no contiene programas válidos…" | 63 |
| `06_corrupto.xlsx` | Texto con extensión `.xlsx` | ERROR, la bodega no cambia | 63 |
| `07_otra_hoja_de_calculo.xlsx` | Un Excel que no es el reporte del SNIES | ERROR: "El archivo no contiene programas válidos…" | 63 |
| `08_formato_no_permitido.txt` | Extensión no permitida | El frontend no deja elegirlo; la API responde 400 | 63 |

Anomalías de `03_con_anomalias.xlsx` (se ven al terminar la carga, en "valores corregidos o descartados"):
créditos 0 y 999, 200 periodos, fecha de registro en 2031, fecha de resolución de 1940, fecha imposible `31/02/2020`,
costo `abc` y código SNIES `ABC123`. Esos valores quedan nulos y el programa se carga igual.
También comprueba que el número serial de Excel `45253` se convierta en la fecha 23/11/2023
y que `"  INGENIERÍA DE   SISTEMAS  "` (con espacios sobrantes) quede como `INGENIERÍA DE SISTEMAS`.

## Prueba automática

Desde `backend/`:

```powershell
.venv\Scripts\python -m unittest tests.test_carga -v
```

Crea desde cero la base `snies_dw_pruebas`, sube los 8 archivos por la API y verifica cada resultado de la tabla.
Ejecútela sola (no junto con `test_smoke`), porque la base se elige al importar la aplicación.

## Probar desde la interfaz

1. Detenga el backend y arránquelo apuntando a la base de pruebas (PowerShell, desde `backend/`):

   ```powershell
   $env:DB_NAME = "snies_dw_pruebas"
   .venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
   ```

2. En http://localhost:4200/carga suba los archivos en orden y compare con la tabla.
3. Al terminar, cierre esa terminal y vuelva a arrancar el backend normalmente (sin `DB_NAME`), que usa `snies_dw`.

Si la base de pruebas ya tiene datos de una ronda anterior, la prueba automática la deja limpia
(o bórrela en pgAdmin) antes de repetir la secuencia a mano.

## Regenerar los archivos

```powershell
.venv\Scripts\python tests\fixtures\generar_fixtures.py
```

Siempre produce los mismos archivos (semilla fija).
