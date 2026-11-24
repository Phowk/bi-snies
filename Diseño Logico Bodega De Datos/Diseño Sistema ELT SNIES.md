# **Diseño del Sistema Automático ETL/ELT para la Bodega de Datos de Programas Académicos del SNIES**

**Jaider Alexis Ceballos Yandún, Juan Estheban Chalaca Córdoba, Steffany Mayerly Rodríguez Noguera, Omar David Vallejos**

**Universidad de Nariño  
Facultad de Ingeniería – Departamento de Sistemas  
Inteligencia de Negocios  
Ipiales – Nariño  
2026**

---

# **1. Introducción y Enfoque de la Solución**

El presente documento define la arquitectura y el diseño técnico del sistema automático de integración de datos (ETL/ELT) encargado de alimentar la bodega de datos de programas académicos de educación superior en Colombia, a partir de los reportes oficiales del Sistema Nacional de Información de la Educación Superior (SNIES). El diseño toma como base el modelo dimensional en estrella propuesto bajo la metodología de Ralph Kimball, permitiendo responder a interrogantes estratégicos sobre la oferta educativa, con énfasis en el contexto institucional de la Universidad de Nariño y su comparación regional y nacional.

El sistema debe poblar de manera íntegra, auditable y automatizada la tabla de hechos `dw.fact_programa` y sus dimensiones analíticas asociadas: institución, programa, ubicación geográfica, área de conocimiento, modalidad y tiempo.

Para dar respuesta a los requerimientos operativos de la organización, el sistema se estructura bajo una arquitectura integral de tres capas:
1. **Base de Datos Analítica (PostgreSQL):** Almacena y procesa los datos en esquemas desacoplados (`staging`, `dw` y `audit`), asegurando integridad referencial, transaccionalidad e idempotencia.
2. **Backend de Ingesta y Servicios (FastAPI + Python):** Gestiona la recepción de los archivos masivos en formato Excel (`.xlsx`), coordina la ejecución automatizada del pipeline ETL en segundo plano y expone endpoints REST para alimentar el procesamiento analítico en línea (OLAP).
3. **Frontend Interactivo (Angular):** Proporciona una interfaz web intuitiva dirigida a directivos y analistas académicos (usuarios no expertos en SQL), permitiendo la carga interactiva de archivos mediante arrastrar y soltar (*drag & drop*), seguimiento del proceso de carga en tiempo real y exploración dinámica mediante tableros y filtros multidimensionales.

La automatización garantiza que cada vez que se cargue una nueva versión del archivo de programas (como el reporte institucional del SIES/SNIES), el sistema ejecute de forma transparente la extracción, limpieza, resolución de llaves e inserción en la bodega, dejándola inmediatamente disponible para consulta.

---

# **2. Arquitectura de Datos y Capas en PostgreSQL**

La base de datos se organiza en esquemas especializados para garantizar la trazabilidad del dato crudo, aislar las transformaciones intermedias y proteger el modelo dimensional de consultas analíticas.

**Tabla 1**  
*Capas de datos y esquemas del sistema en PostgreSQL*

| Capa (Esquema) | Contenido | Propósito |
|---|---|---|
| **`staging`** | Tablas de aterrizaje y preparación (`stg_programas_raw`). Contiene la copia de las filas extraídas del archivo Excel con tipificación validada y huellas digitales de registro. | Preservar los datos recibidos de la fuente, ejecutar normalización de textos, parseo de fechas seriales de Excel y deduplicación antes de afectar el almacén analítico. |
| **`dw`** | Modelo dimensional en estrella: tabla de hechos `dw.fact_programa` y dimensiones (`dim_institucion`, `dim_programa`, `dim_ubicacion`, `dim_area_conocimiento`, `dim_modalidad`, `dim_tiempo`). | Servir como núcleo de almacenamiento analítico optimizado para consultas OLAP, reportes y visualización interactiva. |
| **`audit`** | Registro de ejecución y control de lotes (`log_cargas` y `log_errores_etl`). Contiene identificadores de carga (`id_carga`), fechas, métricas de reconciliación y excepciones. | Garantizar la trazabilidad operativa, medir indicadores de calidad y permitir el diagnóstico de fallas o rechazos. |

*Elaboración propia (2026).*

---

# **3. Funcionalidades Básicas del Sistema ETL**

Las funcionalidades básicas cubren el ciclo de vida completo del procesamiento de datos, desde la recepción del archivo hasta la disponibilidad de las métricas en la bodega.

**Tabla 2**  
*Matriz de funcionalidades básicas del sistema ETL*

| Código | Funcionalidad | Descripción | Mecanismo de Implementación |
|---|---|---|---|
| **FB-1** | Extracción de Fuentes | Recepción y lectura estructurada del archivo maestro de programas académicos en formato XLSX/CSV. | Módulo Python (`pandas` / `openpyxl`) invocado por un endpoint de FastAPI que procesa la hoja principal de programas (39 columnas) y maneja codificaciones UTF-8. |
| **FB-2** | Carga a Zona Staging | Almacenar los registros recibidos en `staging.stg_programas_raw`, conservando el identificador de carga (`id_carga`). | Inserción en bloque (*batch insert*) con `psycopg2.extras.execute_values`, vinculando cada registro al lote activo en `audit.log_cargas`. |
| **FB-3** | Limpieza y Normalización | Corrección de inconsistencias textuales, supresión de caracteres especiales, y conversión de tipos numéricos y fechas. | Rutinas en Python y SQL que convierten números seriales de fecha de Excel (ej. `45253.0` a formato fecha nativo `YYYY-MM-DD`), limpian sufijos flotantes en códigos y homogeneizan cadenas a mayúsculas estándar. |
| **FB-4** | Tratamiento de Nulos y Miembro Desconocido | Sustitución de valores ausentes y prevención de fallas de integridad referencial. | Asignación de miembros por defecto ("No especificado", "No registrado"). En caso de registros sin equivalencia en dimensiones, se enlazan al miembro desconocido subrogado con clave `-1`. |
| **FB-5** | Carga Idempotente de Dimensiones | Poblado ordenado de las dimensiones del modelo en estrella respetando sus jerarquías. | Sentencias SQL `INSERT ... ON CONFLICT (llave_natural) DO UPDATE` para aplicar SCD Tipo 1 sobre atributos descriptivos de programas e instituciones. |
| **FB-6** | Carga de Tabla de Hechos | Inserción de métricas analíticas en `dw.fact_programa` resolviendo claves foráneas contra las dimensiones. | Operación `INSERT ... SELECT` con cruces relacionales (`LEFT JOIN`) contra `dw.dim_*`. Deduplicación mediante huella digital SHA-256 (`hash_fila`) por programa, institución y modalidad. |
| **FB-7** | Auditoría y Reconciliación | Generación de métricas de control de calidad sobre el volumen procesado. | Registro de inicio, fin, total de filas leídas, filas insertadas en hechos y filas rechazadas en `audit.log_cargas`. |
| **FB-8** | Orquestación Integrada y Automática | Ejecución secuencial y atómica del flujo ETL al momento de recibir un archivo. | Disparo asíncrono mediante `BackgroundTasks` en FastAPI; ante fallos, se ejecuta un *rollback* transaccional y se notifica el estado a la interfaz web. |

*Elaboración propia (2026).*

---

# **4. Script DDL y Procedimientos en PostgreSQL**

A continuación se presenta el código SQL validado para la creación de esquemas, tablas de auditoría, zona de staging, dimensiones con miembro desconocido (-1) y tabla de hechos con sus restricciones.

### **Código 1**  
*Definición DDL del esquema de almacenamiento analítico en PostgreSQL*

```sql
-- Creación de esquemas de trabajo
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS dw;
CREATE SCHEMA IF NOT EXISTS audit;

-- ============================================================================
-- 1. ESQUEMA DE AUDITORÍA
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit.log_cargas (
    id_carga SERIAL PRIMARY KEY,
    nombre_archivo VARCHAR(255) NOT NULL,
    peso_archivo_kb NUMERIC(10,2),
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    estado VARCHAR(30) DEFAULT 'EN_PROCESO', -- EN_PROCESO, EXITOSO, ERROR
    total_filas_origen INT DEFAULT 0,
    filas_cargadas_hechos INT DEFAULT 0,
    filas_rechazadas INT DEFAULT 0,
    mensaje_error TEXT
);

-- ============================================================================
-- 2. ESQUEMA STAGING (Zona de aterrizaje limpia)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staging.stg_programas_raw (
    id_staging BIGSERIAL PRIMARY KEY,
    id_carga INT REFERENCES audit.log_cargas(id_carga),
    codigo_institucion_padre VARCHAR(50),
    codigo_institucion VARCHAR(50),
    nombre_institucion VARCHAR(255),
    estado_institucion VARCHAR(100),
    caracter_academico VARCHAR(100),
    sector VARCHAR(50),
    registro_unico VARCHAR(50),
    codigo_snies VARCHAR(50),
    codigo_anterior_icfes VARCHAR(100),
    nombre_programa VARCHAR(255),
    titulo_otorgado VARCHAR(255),
    estado_programa VARCHAR(100),
    justificacion TEXT,
    reconocimiento_ministerio VARCHAR(255),
    resolucion_aprobacion VARCHAR(255),
    fecha_resolucion DATE,
    fecha_ejecutoria DATE,
    vigencia_anios INT,
    fecha_registro_snies DATE,
    cine_campo_amplio VARCHAR(255),
    cine_campo_especifico VARCHAR(255),
    cine_campo_detallado VARCHAR(255),
    area_conocimiento VARCHAR(255),
    nucleo_basico_conocimiento VARCHAR(255),
    nivel_academico VARCHAR(100),
    nivel_formacion VARCHAR(100),
    modalidad VARCHAR(100),
    numero_creditos INT,
    numero_periodos_duracion INT,
    periodicidad VARCHAR(100),
    ciclos_propedeuticos VARCHAR(50),
    departamento_oferta VARCHAR(100),
    municipio_oferta VARCHAR(100),
    costo_matricula_nuevos NUMERIC(14,2),
    hash_fila VARCHAR(64)
);

-- ============================================================================
-- 3. ESQUEMA DW (Modelo Dimensional en Estrella)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dw.dim_institucion (
    sk_institucion SERIAL PRIMARY KEY,
    codigo_institucion VARCHAR(50) UNIQUE NOT NULL,
    nombre_institucion VARCHAR(255) NOT NULL,
    estado_institucion VARCHAR(100) DEFAULT 'No especificado',
    sector VARCHAR(50) DEFAULT 'No especificado',
    caracter_academico VARCHAR(100) DEFAULT 'No especificado'
);

CREATE TABLE IF NOT EXISTS dw.dim_ubicacion (
    sk_ubicacion SERIAL PRIMARY KEY,
    departamento VARCHAR(100) NOT NULL,
    municipio VARCHAR(100) NOT NULL,
    region VARCHAR(100) DEFAULT 'No especificado',
    CONSTRAINT uq_dw_ubicacion UNIQUE (departamento, municipio)
);

CREATE TABLE IF NOT EXISTS dw.dim_modalidad (
    sk_modalidad SERIAL PRIMARY KEY,
    modalidad VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS dw.dim_area_conocimiento (
    sk_area SERIAL PRIMARY KEY,
    area_conocimiento VARCHAR(255) NOT NULL,
    nucleo_basico VARCHAR(255) DEFAULT 'No especificado',
    cine_campo_amplio VARCHAR(255) DEFAULT 'No especificado',
    cine_campo_especifico VARCHAR(255) DEFAULT 'No especificado',
    cine_campo_detallado VARCHAR(255) DEFAULT 'No especificado',
    CONSTRAINT uq_dw_area UNIQUE (area_conocimiento, nucleo_basico, cine_campo_amplio)
);

CREATE TABLE IF NOT EXISTS dw.dim_tiempo (
    sk_tiempo SERIAL PRIMARY KEY,
    anio INT NOT NULL,
    semestre INT NOT NULL,
    periodo VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS dw.dim_programa (
    sk_programa SERIAL PRIMARY KEY,
    codigo_snies VARCHAR(50) NOT NULL,
    nombre_programa VARCHAR(255) NOT NULL,
    titulo_otorgado VARCHAR(255) DEFAULT 'No registrado',
    nivel_academico VARCHAR(100) DEFAULT 'No especificado',
    nivel_formacion VARCHAR(100) DEFAULT 'No especificado',
    modalidad VARCHAR(100) DEFAULT 'No especificado',
    area_conocimiento VARCHAR(255) DEFAULT 'No especificado',
    cine_campo_amplio VARCHAR(255) DEFAULT 'No especificado',
    estado_programa VARCHAR(100) DEFAULT 'No especificado',
    reconocimiento VARCHAR(255) DEFAULT 'No especificado',
    periodicidad VARCHAR(100) DEFAULT 'No especificado',
    CONSTRAINT uq_dw_programa_snies UNIQUE (codigo_snies, modalidad)
);

-- Tabla de Hechos
CREATE TABLE IF NOT EXISTS dw.fact_programa (
    sk_fact BIGSERIAL PRIMARY KEY,
    sk_programa INT NOT NULL REFERENCES dw.dim_programa(sk_programa),
    sk_institucion INT NOT NULL REFERENCES dw.dim_institucion(sk_institucion),
    sk_ubicacion INT NOT NULL REFERENCES dw.dim_ubicacion(sk_ubicacion),
    sk_modalidad INT NOT NULL REFERENCES dw.dim_modalidad(sk_modalidad),
    sk_area INT NOT NULL REFERENCES dw.dim_area_conocimiento(sk_area),
    sk_tiempo INT NOT NULL REFERENCES dw.dim_tiempo(sk_tiempo),
    id_carga INT REFERENCES audit.log_cargas(id_carga),
    numero_creditos INT,
    numero_periodos_duracion INT,
    costo_matricula_nuevos NUMERIC(14,2),
    vigencia_anios INT,
    fecha_resolucion DATE,
    fecha_registro_snies DATE,
    cantidad_programa INT DEFAULT 1,
    hash_fila VARCHAR(64) UNIQUE
);

-- ============================================================================
-- 4. REGISTRO DE MIEMBROS DESCONOCIDOS (Clave -1 para integridad)
-- ============================================================================
INSERT INTO dw.dim_institucion (sk_institucion, codigo_institucion, nombre_institucion, sector, caracter_academico)
VALUES (-1, '-1', 'Institución no identificada', 'No especificado', 'No especificado')
ON CONFLICT (sk_institucion) DO NOTHING;

INSERT INTO dw.dim_ubicacion (sk_ubicacion, departamento, municipio, region)
VALUES (-1, 'No especificado', 'No especificado', 'No especificado')
ON CONFLICT (sk_ubicacion) DO NOTHING;

INSERT INTO dw.dim_modalidad (sk_modalidad, modalidad)
VALUES (-1, 'No especificado')
ON CONFLICT (sk_modalidad) DO NOTHING;

INSERT INTO dw.dim_area_conocimiento (sk_area, area_conocimiento, nucleo_basico, cine_campo_amplio)
VALUES (-1, 'Área no identificada', 'No especificado', 'No especificado')
ON CONFLICT (sk_area) DO NOTHING;

INSERT INTO dw.dim_tiempo (sk_tiempo, anio, semestre, periodo)
VALUES (-1, 1900, 1, '1900-1')
ON CONFLICT (sk_tiempo) DO NOTHING;

INSERT INTO dw.dim_programa (sk_programa, codigo_snies, nombre_programa, nivel_formacion, modalidad)
VALUES (-1, '-1', 'Programa no identificado', 'No especificado', 'No especificado')
ON CONFLICT (sk_programa) DO NOTHING;
```

---

# **5. Funcionalidades Avanzadas de Integración y Calidad**

Las funcionalidades avanzadas garantizan que el sistema no solo cargue datos, sino que opere con idempotencia, historización, soporte de errores y consumo amigable.

**Tabla 3**  
*Matriz de funcionalidades avanzadas del sistema*

| Código | Funcionalidad | Descripción | Mecanismo de Implementación |
|---|---|---|---|
| **FA-1** | Carga Incremental e Idempotencia | Procesar actualizaciones periódicas sin generar filas duplicadas ni alterar periodos inmutables. | Uso de cláusulas `ON CONFLICT (hash_fila) DO UPDATE` en hechos y llaves naturales en dimensiones. Si el mismo archivo se sube repetidas veces, no se alteran los conteos. |
| **FA-2** | Historización de Dimensiones (SCD) | Mantener la vigencia de cambios en atributos clave (estados y reconocimientos de acreditación). | Implementación de SCD Tipo 1 para correcciones ortográficas y datos de contacto, y estructura preparada para SCD Tipo 2 mediante fechas de vigencia en resoluciones del programa. |
| **FA-3** | Control de Calidad en Ingesta | Detección temprana de anomalías en el archivo fuente. | Validación de dominios de modalidad, conversión segura de números y rangos plausibles de créditos (1 a 350) y periodos (1 a 16). Valores fuera de rango son imputados o marcados como estimados. |
| **FA-4** | Automatización Orientada a Eventos | Disparo del flujo ETL en tiempo de ejecución sin dependencias de tareas programadas tipo cron. | Integración directa con el framework FastAPI mediante `BackgroundTasks`, permitiendo que la subida del archivo por el usuario en Angular dispare el procesamiento de forma no bloqueante. |
| **FA-5** | Manejo Transaccional de Errores | Prevenir estados inconsistentes ante interrupciones. | El pipeline se ejecuta bajo bloques transaccionales de PostgreSQL (`BEGIN ... COMMIT / ROLLBACK`). Si surge un error crítico, el lote se marca como `ERROR` en auditoría sin corromper el modelo dimensional. |
| **FA-6** | Integración Analítica con el Cubo OLAP | Compatibilidad nativa con las 12 consultas del Cubo analítico institucional. | Se proveen vistas y endpoints REST que entregan resultados agregados para filtros multidimensionales (slice, dice, drill-down, roll-up y pivot). |

*Elaboración propia (2026).*

---

# **6. Arquitectura del Backend (FastAPI + Python) y Frontend (Angular)**

Para lograr que el sistema sea accesible y fácil de operar para usuarios que no son expertos en bases de datos, se prescinde de herramientas externas pesadas (como Airflow o Docker) y se implementa una arquitectura web moderna y liviana:

```
                  ┌───────────────────────────────────────────┐
                  │          FRONTEND WEB (Angular 18)        │
                  │  - Módulo Carga Excel (Drag & Drop)       │
                  │  - Barra de Progreso y Alertas Reactivas  │
                  │  - Dashboard con Filtros y Gráficos       │
                  └─────────────────────┬─────────────────────┘
                                        │ HTTP POST /upload
                                        │ HTTP GET /analytics
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │         BACKEND API (FastAPI + Python)    │
                  │  - Endpoint /api/etl/upload               │
                  │  - BackgroundTasks: Orquestador ETL       │
                  │  - Parser Fechas Seriales y Sanitización  │
                  │  - Endpoints REST del Cubo OLAP           │
                  └─────────────────────┬─────────────────────┘
                                        │ Conexión psycopg2
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │        BASE DE DATOS (PostgreSQL 16)      │
                  │  - audit.log_cargas (Trazabilidad)        │
                  │  - staging.stg_programas_raw (Aterrizaje) │
                  │  - dw.* (Dimensiones y Hechos Validados)  │
                  └───────────────────────────────────────────┘
```

### **6.1 Pipeline de Carga Automatizada en Python (`etl_pipeline.py`)**

```python
import hashlib
from datetime import datetime, timedelta
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {
    "dbname": "snies_dw",
    "user": "postgres",
    "password": "password",
    "host": "localhost",
    "port": 5432
}

def parsear_fecha_excel(valor):
    """Resuelve números seriales de Excel (ej. 45253.0) o cadenas de texto a objeto fecha."""
    if pd.isna(valor) or valor == "" or valor is None:
        return None
    try:
        num = float(valor)
        if num > 1000:  # Número serial de fecha Excel
            return (datetime(1899, 12, 30) + timedelta(days=num)).date()
    except (ValueError, TypeError):
        pass
    try:
        return pd.to_datetime(valor).date()
    except Exception:
        return None

def ejecutar_pipeline_etl(ruta_archivo: str, id_carga: int):
    """Ejecuta el ciclo completo Extract-Transform-Load hacia PostgreSQL."""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    try:
        # 1. Extracción con pandas
        df = pd.read_excel(ruta_archivo, sheet_name=0, dtype=str)
        filas_staging = []

        for _, r in df.iterrows():
            snies = str(r.get("CÓDIGO_SNIES_DEL_PROGRAMA", "")).replace(".0", "").strip()
            cod_inst = str(r.get("CÓDIGO_INSTITUCIÓN", "")).replace(".0", "").strip()
            modalidad = str(r.get("MODALIDAD", "No especificado")).strip()

            if not snies or snies.lower() == "nan":
                continue

            hash_fila = hashlib.sha256(f"{snies}_{cod_inst}_{modalidad}".encode()).hexdigest()
            f_res = parsear_fecha_excel(r.get("FECHA_DE_RESOLUCIÓN"))
            f_eje = parsear_fecha_excel(r.get("FECHA_EJECUTORIA"))
            f_snies = parsear_fecha_excel(r.get("FECHA_DE_REGISTRO_EN_SNIES"))

            def a_int(val):
                try: return int(float(val)) if pd.notna(val) else None
                except: return None

            def a_num(val):
                try: return float(val) if pd.notna(val) else None
                except: return None

            filas_staging.append((
                id_carga, str(r.get("CÓDIGO_INSTITUCIÓN_PADRE", "")).strip(), cod_inst,
                str(r.get("NOMBRE_INSTITUCIÓN", "No especificado")).strip(),
                str(r.get("ESTADO_INSTITUCIÓN", "No especificado")).strip(),
                str(r.get("CARÁCTER_ACADÉMICO", "No especificado")).strip(),
                str(r.get("SECTOR", "No especificado")).strip(),
                str(r.get("REGISTRO_UNICO", "")).strip(), snies,
                str(r.get("CÓDIGO_ANTERIOR_ICFES", "")).strip(),
                str(r.get("NOMBRE_DEL_PROGRAMA", "No registrado")).strip(),
                str(r.get("TITULO_OTORGADO", "No registrado")).strip(),
                str(r.get("ESTADO_PROGRAMA", "No especificado")).strip(),
                str(r.get("JUSTIFICACION", "")).strip(),
                str(r.get("RECONOCIMIENTO_DEL_MINISTERIO", "No especificado")).strip(),
                str(r.get("RESOLUCIÓN_DE_APROBACIÓN", "")).strip(),
                f_res, f_eje, a_int(r.get("VIGENCIA_AÑOS")), f_snies,
                str(r.get("CINE_F_2013_AC_CAMPO_AMPLIO", "No especificado")).strip(),
                str(r.get("CINE_F_2013_AC_CAMPO_ESPECÍFIC", "No especificado")).strip(),
                str(r.get("CINE_F_2013_AC_CAMPO_DETALLADO", "No especificado")).strip(),
                str(r.get("ÁREA_DE_CONOCIMIENTO", "No especificado")).strip(),
                str(r.get("NÚCLEO_BÁSICO_DEL_CONOCIMIENTO", "No especificado")).strip(),
                str(r.get("NIVEL_ACADÉMICO", "No especificado")).strip(),
                str(r.get("NIVEL_DE_FORMACIÓN", "No especificado")).strip(),
                modalidad, a_int(r.get("NÚMERO_CRÉDITOS")), a_int(r.get("NÚMERO_PERIODOS_DE_DURACIÓN")),
                str(r.get("PERIODICIDAD", "No especificado")).strip(),
                str(r.get("SE_OFRECE_POR_CICLOS_PROPEDÉUT", "No")).strip(),
                str(r.get("DEPARTAMENTO_OFERTA_PROGRAMA", "No especificado")).strip(),
                str(r.get("MUNICIPIO_OFERTA_PROGRAMA", "No especificado")).strip(),
                a_num(r.get("COSTO_MATRÍCULA_ESTUD_NUEVOS")), hash_fila
            ))

        # 2. Inserción masiva en Staging
        cur.execute("DELETE FROM staging.stg_programas_raw WHERE id_carga = %s;", (id_carga,))
        sql_stg = """
            INSERT INTO staging.stg_programas_raw (
                id_carga, codigo_institucion_padre, codigo_institucion, nombre_institucion,
                estado_institucion, caracter_academico, sector, registro_unico, codigo_snies,
                codigo_anterior_icfes, nombre_programa, titulo_otorgado, estado_programa,
                justificacion, reconocimiento_ministerio, resolucion_aprobacion, fecha_resolucion,
                fecha_ejecutoria, vigencia_anios, fecha_registro_snies, cine_campo_amplio,
                cine_campo_especifico, cine_campo_detallado, area_conocimiento,
                nucleo_basico_conocimiento, nivel_academico, nivel_formacion, modalidad,
                numero_creditos, numero_periodos_duracion, periodicidad, ciclos_propedeuticos,
                departamento_oferta, municipio_oferta, costo_matricula_nuevos, hash_fila
            ) VALUES %s
        """
        execute_values(cur, sql_stg, filas_staging, page_size=2000)

        # 3. Actualización/Inserción de Dimensiones (Idempotencia)
        cur.execute("""
            INSERT INTO dw.dim_institucion (codigo_institucion, nombre_institucion, sector, caracter_academico, estado_institucion)
            SELECT DISTINCT codigo_institucion, nombre_institucion, sector, caracter_academico, estado_institucion
            FROM staging.stg_programas_raw WHERE id_carga = %s AND codigo_institucion <> ''
            ON CONFLICT (codigo_institucion) DO UPDATE SET
                nombre_institucion = EXCLUDED.nombre_institucion,
                sector = EXCLUDED.sector,
                caracter_academico = EXCLUDED.caracter_academico,
                estado_institucion = EXCLUDED.estado_institucion;
        """, (id_carga,))

        cur.execute("""
            INSERT INTO dw.dim_ubicacion (departamento, municipio)
            SELECT DISTINCT departamento_oferta, municipio_oferta
            FROM staging.stg_programas_raw WHERE id_carga = %s
            ON CONFLICT (departamento, municipio) DO NOTHING;
        """, (id_carga,))

        cur.execute("""
            INSERT INTO dw.dim_modalidad (modalidad)
            SELECT DISTINCT modalidad FROM staging.stg_programas_raw WHERE id_carga = %s
            ON CONFLICT (modalidad) DO NOTHING;
        """, (id_carga,))

        cur.execute("""
            INSERT INTO dw.dim_area_conocimiento (area_conocimiento, nucleo_basico, cine_campo_amplio)
            SELECT DISTINCT area_conocimiento, nucleo_basico_conocimiento, cine_campo_amplio
            FROM staging.stg_programas_raw WHERE id_carga = %s
            ON CONFLICT (area_conocimiento, nucleo_basico, cine_campo_amplio) DO NOTHING;
        """, (id_carga,))

        cur.execute("""
            INSERT INTO dw.dim_programa (codigo_snies, nombre_programa, titulo_otorgado, nivel_academico,
                                        nivel_formacion, modalidad, area_conocimiento, cine_campo_amplio,
                                        estado_programa, reconocimiento, periodicidad)
            SELECT DISTINCT codigo_snies, nombre_programa, titulo_otorgado, nivel_academico,
                            nivel_formacion, modalidad, area_conocimiento, cine_campo_amplio,
                            estado_programa, reconocimiento_ministerio, periodicidad
            FROM staging.stg_programas_raw WHERE id_carga = %s
            ON CONFLICT (codigo_snies, modalidad) DO UPDATE SET
                nombre_programa = EXCLUDED.nombre_programa,
                titulo_otorgado = EXCLUDED.titulo_otorgado,
                estado_programa = EXCLUDED.estado_programa,
                reconocimiento = EXCLUDED.reconocimiento;
        """, (id_carga,))

        cur.execute("""
            INSERT INTO dw.dim_tiempo (anio, semestre, periodo)
            SELECT DISTINCT 
                EXTRACT(YEAR FROM fecha_registro_snies)::INT,
                CASE WHEN EXTRACT(MONTH FROM fecha_registro_snies) <= 6 THEN 1 ELSE 2 END,
                CONCAT(EXTRACT(YEAR FROM fecha_registro_snies)::INT, '-', 
                       CASE WHEN EXTRACT(MONTH FROM fecha_registro_snies) <= 6 THEN 1 ELSE 2 END)
            FROM staging.stg_programas_raw
            WHERE id_carga = %s AND fecha_registro_snies IS NOT NULL
            ON CONFLICT (periodo) DO NOTHING;
        """, (id_carga,))

        # 4. Inserción de Hechos con resolución de llaves subrogadas
        cur.execute("""
            INSERT INTO dw.fact_programa (
                sk_programa, sk_institucion, sk_ubicacion, sk_modalidad, sk_area, sk_tiempo,
                id_carga, numero_creditos, numero_periodos_duracion, costo_matricula_nuevos,
                vigencia_anios, fecha_resolucion, fecha_registro_snies, cantidad_programa, hash_fila
            )
            SELECT 
                COALESCE(p.sk_programa, -1),
                COALESCE(i.sk_institucion, -1),
                COALESCE(u.sk_ubicacion, -1),
                COALESCE(m.sk_modalidad, -1),
                COALESCE(a.sk_area, -1),
                COALESCE(t.sk_tiempo, -1),
                s.id_carga, s.numero_creditos, s.numero_periodos_duracion, s.costo_matricula_nuevos,
                s.vigencia_anios, s.fecha_resolucion, s.fecha_registro_snies, 1, s.hash_fila
            FROM staging.stg_programas_raw s
            LEFT JOIN dw.dim_institucion i ON i.codigo_institucion = s.codigo_institucion
            LEFT JOIN dw.dim_ubicacion u ON u.departamento = s.departamento_oferta AND u.municipio = s.municipio_oferta
            LEFT JOIN dw.dim_modalidad m ON m.modalidad = s.modalidad
            LEFT JOIN dw.dim_area_conocimiento a ON a.area_conocimiento = s.area_conocimiento 
                 AND a.nucleo_basico = s.nucleo_basico_conocimiento AND a.cine_campo_amplio = s.cine_campo_amplio
            LEFT JOIN dw.dim_programa p ON p.codigo_snies = s.codigo_snies AND p.modalidad = s.modalidad
            LEFT JOIN dw.dim_tiempo t ON t.periodo = CONCAT(EXTRACT(YEAR FROM s.fecha_registro_snies)::INT, '-', 
                 CASE WHEN EXTRACT(MONTH FROM s.fecha_registro_snies) <= 6 THEN 1 ELSE 2 END)
            WHERE s.id_carga = %s
            ON CONFLICT (hash_fila) DO UPDATE SET
                numero_creditos = EXCLUDED.numero_creditos,
                numero_periodos_duracion = EXCLUDED.numero_periodos_duracion,
                costo_matricula_nuevos = EXCLUDED.costo_matricula_nuevos;
        """, (id_carga,))

        filas_cargadas = cur.rowcount

        # 5. Cierre exitoso en auditoría
        cur.execute("""
            UPDATE audit.log_cargas
            SET estado = 'EXITOSO',
                fecha_fin = CURRENT_TIMESTAMP,
                total_filas_origen = %s,
                filas_cargadas_hechos = %s
            WHERE id_carga = %s;
        """, (len(df), filas_cargadas, id_carga))
        conn.commit()
    except Exception as e:
        conn.rollback()
        cur.execute("""
            UPDATE audit.log_cargas
            SET estado = 'ERROR', fecha_fin = CURRENT_TIMESTAMP, mensaje_error = %s
            WHERE id_carga = %s;
        """, (str(e), id_carga))
        conn.commit()
        raise e
    finally:
        cur.close()
        conn.close()
```

---

# **7. Herramientas y Tecnologías**

La selección tecnológica combina robustez académica, simplicidad de despliegue y compatibilidad con el entorno de la Universidad de Nariño.

**Tabla 4**  
*Pila tecnológica del sistema ETL y BI*

| Herramienta | Función en el Sistema | Justificación de Selección |
|---|---|---|
| **PostgreSQL 16** | Motor de base de datos relacional y dimensional. | Soporte avanzado para sentencias `UPSERT` (`ON CONFLICT`), particionamiento, índices B-Tree/Hash y funciones de agregación analítica (ROLLUP, CUBE). |
| **Python 3.11+** | Lenguaje para desarrollo del pipeline ETL y API. | Estándar de la industria para ciencia de datos y manipulación estructurada de información. |
| **FastAPI** | Servidor REST asíncrono para ingesta y analítica. | Rendimiento de alta velocidad, generación automática de documentación OpenAPI/Swagger y ejecución de tareas en segundo plano (`BackgroundTasks`). |
| **Pandas & openpyxl** | Lectura y sanitización del archivo Excel. | Procesamiento vectorial eficiente de archivos masivos con capacidad de inspección de tipos y conversión de seriales de fecha. |
| **psycopg2-binary** | Adaptador de conexión PostgreSQL para Python. | Ejecución de inserciones en bloque optimizadas mediante `execute_values`, reduciendo drásticamente el tiempo de carga de miles de registros. |
| **Angular 18** | Framework de frontend web interactivo. | Arquitectura basada en componentes y servicios reactivos (`RxJS`) que facilita la carga interactiva de archivos y la navegación dinámica de indicadores. |
| **Visual Studio Code & Git** | Entorno de desarrollo y control de versiones. | Herramientas estándar adoptadas por el equipo para trabajo colaborativo y seguimiento del proyecto. |

*Elaboración propia (2026).*

---

# **8. Cronograma de Desarrollo**

**Tabla 5**  
*Cronograma de fases del proyecto (2026)*

| Fase | Actividades Principales | Período (2026) | Entregable Clave |
|---|---|---|---|
| **1. Preparación del Entorno** | Creación de esquemas `staging`, `dw` y `audit` en PostgreSQL; configuración del repositorio y entornos virtuales. | 5 al 7 de Noviembre | Esquema físico y DDL ejecutado en base de datos. |
| **2. Pipeline de Extracción y Limpieza** | Implementación del módulo Python para lectura de Excel, tratamiento de fechas seriales y normalización de textos. | 8 al 11 de Noviembre | Scripts de carga masiva hacia la zona staging. |
| **3. Carga Dimensional y Hechos** | Codificación de inserciones idempotentes (`ON CONFLICT`) en dimensiones y resolución de claves foráneas hacia `fact_programa`. | 12 al 15 de Noviembre | Poblado completo de la bodega con datos limpios (Hito 1). |
| **4. Desarrollo del Backend FastAPI** | Implementación del endpoint `/api/etl/upload`, tareas en segundo plano y endpoints de consulta del Cubo OLAP. | 16 al 18 de Noviembre | API REST documentada y operativa. |
| **5. Desarrollo del Frontend Angular** | Construcción del componente de subida (*drag & drop*), monitoreo por sondeo reactivo y dashboard de visualización para usuarios no expertos. | 19 al 22 de Noviembre | Interfaz web interactiva funcional (Hito 2). |
| **6. Pruebas Integrales y Documentación** | Pruebas de estrés con archivos de gran tamaño, validación de idempotencia, ajuste de índices y entrega del informe final. | 23 al 24 de Noviembre | Sistema integral probado y documentado. |
| **7. Sustentación y Entrega** | Presentación del sistema de Inteligencia de Negocios en funcionamiento. | 25 de Noviembre | Entrega formal del proyecto (Hito 3). |

*Elaboración propia (2026).*

---

# **9. Referencias**

* Kimball, R., & Ross, M. (2013). *The data warehouse toolkit: The definitive guide to dimensional modeling* (3.ª ed.). John Wiley & Sons.
* Ministerio de Educación Nacional de Colombia. (s. f.). *Sistema Nacional de Información de la Educación Superior (SNIES)*. https://snies.mineducacion.gov.co
* PostgreSQL Global Development Group. (2024). *PostgreSQL 16 Documentation*. https://www.postgresql.org/docs/16/
* Ramírez, S. (2023). *FastAPI: Modern Python Web Development*. O'Reilly Media.
* Angular Team. (2024). *Angular Documentation and Best Practices*. Google Open Source. https://angular.dev
* Pérez Rodríguez, M. D. (Coord.). (2024). *Business Intelligence* (1.ª ed.). Editorial ICB.
