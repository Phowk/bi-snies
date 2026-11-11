-- Esquemas del sistema
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

CREATE TABLE IF NOT EXISTS audit.log_errores_etl (
    id_error BIGSERIAL PRIMARY KEY,
    id_carga INT REFERENCES audit.log_cargas(id_carga) ON DELETE CASCADE,
    fila_origen INT,
    codigo_snies VARCHAR(50),
    columna VARCHAR(80),
    valor_original TEXT,
    motivo VARCHAR(200),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_log_errores_carga ON audit.log_errores_etl(id_carga);

-- ============================================================================
-- 2. ESQUEMA STAGING (Zona de aterrizaje limpia)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staging.stg_programas_raw (
    id_staging BIGSERIAL PRIMARY KEY,
    id_carga INT REFERENCES audit.log_cargas(id_carga) ON DELETE CASCADE,
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
    vigencia_anios NUMERIC(5,1),
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

CREATE INDEX IF NOT EXISTS idx_stg_prog_carga ON staging.stg_programas_raw(id_carga);

-- ============================================================================
-- 3. ESQUEMA DW (Modelo Dimensional en Estrella - 6 Dimensiones)
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
    vigencia_anios NUMERIC(5,1),
    fecha_resolucion DATE,
    fecha_registro_snies DATE,
    cantidad_programa INT DEFAULT 1,
    hash_fila VARCHAR(64) UNIQUE
);

-- Índices analíticos
CREATE INDEX IF NOT EXISTS idx_fact_programa_inst ON dw.fact_programa(sk_institucion);
CREATE INDEX IF NOT EXISTS idx_fact_programa_prog ON dw.fact_programa(sk_programa);
CREATE INDEX IF NOT EXISTS idx_fact_programa_ubic ON dw.fact_programa(sk_ubicacion);
CREATE INDEX IF NOT EXISTS idx_fact_programa_mod ON dw.fact_programa(sk_modalidad);
CREATE INDEX IF NOT EXISTS idx_fact_programa_area ON dw.fact_programa(sk_area);
CREATE INDEX IF NOT EXISTS idx_fact_programa_tiempo ON dw.fact_programa(sk_tiempo);
CREATE INDEX IF NOT EXISTS idx_fact_fecha_snies ON dw.fact_programa(fecha_registro_snies);

-- ============================================================================
-- 4. MIEMBROS DESCONOCIDOS (-1) PARA INTEGRIDAD REFERENCIAL
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
