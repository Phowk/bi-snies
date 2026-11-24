**Procesamiento Analítico en Línea OLAP** 

**Presentado por:  Jaider Alexis Ceballos Yandun** 

**Juan Estheban Chalaca Córdoba Steffany Mayerly Rodríguez Noguera Omar David Vallejos** 

**Universidad De Nariño Facultad De Ingeniería Departamento de Sistemas Inteligencia de Negocios** 

**Ipiales** 

**2026** 

# **1. Definición de cubo OLAP** 

# **Componentes del Cubo OLAP** 

Granularidad: cada registro de la tabla de hechos Programas_Academicos representa un programa académico identificado mediante su código y asociado a una institución, un área de conocimiento, una modalidad, una ubicación y un periodo de referencia. Esto permite analizar la oferta académica según sus características institucionales, geográficas y temporales. 

- Tabla de Hechos: Programas_Academicos 

- Medidas cuantitativas (Métricas): 

   - NumeroCreditos (Promedio o suma de créditos académicos). 

   - NumeroPeriodos (Duración estimada en semestres/periodos). 

   - CostoMatricula (Valor financiero de la matrícula). 

   - CantidadPrograma (Conteo físico de registros o programas ofertados). 

- Dimensiones (Ejes de análisis): 

   - Dimensión_Programa (Atributos como Nombre, Nivel de Formación, Estado, Reconocimiento). 

   - Dimensión_Modalidad (Presencial, Virtual, Distancia). 

   - Dimensión_Institución (Nombre, Estado, Sector, Carácter Académico). 

   - Dimensión_Area_Conocimiento (Campos de estudio detallados y núcleos básicos). 

   - Dimensión_Ubicación (Geografía de la oferta académica). 

   - Dimensión_Tiempo (Fechas, años y periodicidad). 

# **Jerarquías de Navegación sugeridas para documentar** 

Jerarquías de desglose ( _Drill-down_ ) que permiten los atributos de tus tablas: 

- Jerarquía Geográfica: Región → Departamento → Municipio 

- Jerarquía de Conocimiento (SNIES): CampoAmplio →  CampoEspecifico → CampoDetallado →  AreaConocimiento. 

- Jerarquía Temporal: Año → Periodicidad → Fecha 

# **Cubo OLAP: Análisis de la oferta de programas académicos del SNIES** 

Objetivo: Analizar la composición, distribución y características de los programas académicos ofertados por las instituciones de educación superior de Colombia, con especial atención a la Universidad de Nariño y al contexto regional. 

1. Ejes de análisis 

   - Tiempo: año y periodo de referencia. 

   - Institución: nombre, sector y carácter académico. 

   - Programa: nivel de formación, estado y reconocimiento. 

   - Área de conocimiento: clasificación temática. 

   - Modalidad: presencial, virtual, distancia, entre otras. 

   - Ubicación: región, departamento y municipio. 

2. Indicadores principales 

   - Cantidad de programas académicos. 

   - Promedio de créditos por programa. 

   - Duración promedio de los programas. 

   - Costo promedio de matrícula. 

3. Operaciones OLAP 

   - Slice: filtrar los programas de una institución o un año. 

   - Dice: seleccionar una combinación de años, modalidades, departamentos y niveles de formación. 

   - Drill-down: profundizar desde el departamento hasta el municipio. 

   - Roll-up: resumir los resultados desde el municipio hasta el departamento o la región. 

   - Pivot: intercambiar dimensiones para observar los mismos indicadores desde otra perspectiva. 

# **Valor Agregado** 

- Planeación académica: identificar qué niveles de formación y áreas de conocimiento predominan en Nariño y comparar su distribución con otras regiones. 

- Benchmarking institucional: comparar la oferta académica de la Universidad de Nariño con la de otras instituciones en cuanto a cantidad de programas, modalidades, duración y costos. 

- Seguimiento de la oferta: examinar cómo cambia la cantidad de programas por institución, modalidad, ubicación y periodo, siempre que la bodega conserve información histórica. 

- Exploración interactiva: permitir que los directivos pasen de una visión nacional resumida a resultados específicos por departamento, municipio o institución, sin construir una consulta independiente para cada análisis. 

# **2. Herramientas para implementar el Cubo OLAP** 

Para implementar el cubo OLAP de la oferta académica de la Universidad de Nariño, se seleccionaron PostgreSQL, pgAdmin, Visual Studio Code. Estas herramientas permiten trabajar de manera complementaria en el almacenamiento de los datos, la elaboración de scripts SQL, el procesamiento analítico y la visualización de los resultados. 

# **Justificación de la elección de las herramientas** 

La selección de estas herramientas es adecuada para el modelo dimensional diseñado y disposición de un entorno que permita ejecutar consultas analíticas y presentar los resultados de manera comprensible e interactiva. 

Como primero PostgreSQL, se utiliza para implementar la estructura de datos del cubo OLAP mediante un modelo dimensional y ejecutar consultas SQL para procesar las medidas y analizar la información. Por otra parte, pgAdmin, facilita la administrar la base de datos y apoyar la construcción del modelo dimensional, facilitando la creación y revisión de las tablas, la verificación de las relaciones entre la tabla de hechos y las dimensiones, la ejecución de consultas para comprobar que la estructura del cubo y los resultados obtenidos sean correctos. De igual manera, Visual Studio Code, facilita el desarrollo los scripts SQL necesarios para la construcción del modelo dimensional y la elaboración de las consultas analíticas. 

Así pues, la selección de estas herramientas responde a la necesidad de construir una estructura dimensional que permita organizar los datos, relacionar las dimensiones con las medidas y ejecutar operaciones de análisis multidimensional, siendo PostgreSQL la herramienta principal para desarrollar y analizar el cubo propuesto, mientras que pgAdmin y Visual Studio Code complementan el proceso al facilitar la administración de la base de datos, la ejecución y validación de las consultas y la organización de los scripts SQL. 

# **Procesamiento Analítico en Línea OLAP: Consultas Simples y Complejas sobre el Cubo de Programas Académicos del SNIES** 

**Modelo Físico de Referencia** 

Las consultas se ejecutan en PostgreSQL (PostgreSQL Global Development Group, 2024), administrado con pgAdmin y editado en Visual Studio Code, sobre el modelo dimensional en estrella definido en el punto 1 (Kimball y Ross, 2013). En la bodega real, la tabla de hechos es dw.fact_programa; cada fila representa un programa y las medidas disponibles son numero_creditos, numero_periodos_duracion y costo_matricula_nuevos. Las dimensiones son dw.dim_programa, dw.dim_institucion y dw.dim_ubicacion; modalidad y área de conocimiento son atributos de dw.dim_programa. Los datos provienen del Sistema Nacional de Información de la Educación Superior (SNIES; Ministerio de Educación Nacional \[MEN\], s. f.). 

# **Código 1** 

_Script de creación del esquema dimensional_ 

```
-- Esquema dimensional de referencia (PostgreSQL)
CREATE TABLE dim_programa (
  id_programa        SERIAL PRIMARY KEY,
  codigo_snies       INTEGER NOT NULL,
  nombre_programa    VARCHAR(250),
  nivel_formacion    VARCHAR(80),
  estado_programa    VARCHAR(40),
  reconocimiento     VARCHAR(80)
);
CREATE TABLE dim_modalidad (
  id_modalidad       SERIAL PRIMARY KEY,
  modalidad          VARCHAR(40)
);
CREATE TABLE dim_institucion (
  id_institucion     SERIAL PRIMARY KEY,
  nombre_institucion VARCHAR(250),
  estado_institucion VARCHAR(40),
```

```
  sector             VARCHAR(40),
  caracter_academico VARCHAR(80)
);
CREATE TABLE dim_area_conocimiento (
  id_area            SERIAL PRIMARY KEY,
  campo_amplio       VARCHAR(150),
  campo_especifico   VARCHAR(150),
  campo_detallado    VARCHAR(150),
  area_conocimiento  VARCHAR(150),
  nucleo_basico      VARCHAR(150)
);
CREATE TABLE dim_ubicacion (
  id_ubicacion       SERIAL PRIMARY KEY,
  region             VARCHAR(80),
  departamento       VARCHAR(80),
  municipio          VARCHAR(80)
);
CREATE TABLE dim_tiempo (
  id_tiempo          SERIAL PRIMARY KEY,
  anio               INTEGER,
  periodicidad       VARCHAR(30),
  fecha              DATE
);
CREATE TABLE programas_academicos (
  id_programa        INTEGER REFERENCES dim_programa(id_programa),
  id_institucion     INTEGER REFERENCES
dim_institucion(id_institucion),
  id_area            INTEGER REFERENCES
dim_area_conocimiento(id_area),
  id_modalidad       INTEGER REFERENCES dim_modalidad(id_modalidad),
  id_ubicacion       INTEGER REFERENCES dim_ubicacion(id_ubicacion),
  id_tiempo          INTEGER REFERENCES dim_tiempo(id_tiempo),
  numero_creditos    INTEGER,
  numero_periodos    INTEGER,
  costo_matricula    NUMERIC(14,2),
  cantidad_programa  INTEGER DEFAULT 1
);
```

Los valores usados en los filtros (por ejemplo, los años 2023 y 2024, o los nombres 

de nivel de formación y modalidad) deben ajustarse a los valores efectivamente cargados 

desde el SNIES. 

# **Consultas Simples Soportadas por el Cubo** 

Las consultas simples resumen una medida a partir de una sola dimensión o de un único 

filtro, sin subconsultas ni funciones de ventana. Son la base de la exploración inicial del cubo. La Tabla 1 resume las consultas y las operaciones OLAP que ejercitan. 

# **Tabla 1** 

_Consultas simples del cubo OLAP_ 

|Código|Consulta|Operación OLAP|
|---|---|---|
|CS-1|Cantidad de programas por nivel de formación|Agregación básica (resumen por<br>una dimensión)|
|CS-2|Oferta de la Universidad de Nariño por<br>modalidad|Slice (filtro sobre la dimensión<br>Institución)|
|CS-3|Programas ofertados por año y periodicidad|Agregación sobre la dimensión<br>Tiempo|
|CS-4|Costo promedio de matrícula por departamento|Agregación sobre la dimensión<br>Ubicación|
|CS-5|Créditos y duración promedio por modalidad|Agregación sobre la dimensión<br>Modalidad|



# **CS-1. Cantidad de programas por nivel de formación** 

**Operación OLAP.** Agregación básica (resumen por una dimensión) 

**Descripción.** Cuenta cuántos programas hay en cada nivel de formación (universitario, 

especialización, maestría, doctorado, etc.). Permite conocer la composición general de la 

oferta académica. 

# **Código 2** 

_Script SQL de la consulta CS-1_ 

```
SELECT p.nivel_formacion,
```

```
        COUNT(DISTINCT f.sk_programa) AS total_programas
 FROM   dw.fact_programa f
 JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
```

```
 GROUP  BY p.nivel_formacion
 ORDER  BY total_programas DESC;
```

# **CS-2. Oferta de la Universidad de Nariño por modalidad** 

**Operación OLAP.** Slice (filtro sobre la dimensión Institución) 

**Descripción.** Fija una única institución (Universidad de Nariño) y muestra su cantidad de 

programas y el promedio de créditos según la modalidad de oferta. 

# **Código 3** 

_Script SQL de la consulta CS-2_ 

```
SELECT i.nombre_institucion,
        p.modalidad,
        COUNT(DISTINCT f.sk_programa)      AS total_programas,
        ROUND(AVG(f.numero_creditos), 1)   AS promedio_creditos
 FROM   dw.fact_programa f
 JOIN   dw.dim_institucion i ON i.sk_institucion = f.sk_institucion
 JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
 WHERE  i.nombre_institucion ILIKE '%Universidad de Nari%o%'
 GROUP  BY i.nombre_institucion, p.modalidad
 ORDER  BY total_programas DESC;
```

# **CS-3. Programas ofertados por año y periodicidad** 

**Operación OLAP.** Agregación sobre la dimensión Tiempo 

**Descripción.** Muestra la evolución anual de la cantidad de programas según su 

periodicidad (semestral, anual, etc.). 

# **Código 4** 

_Script SQL de la consulta CS-3_ 

```
SELECT EXTRACT(YEAR FROM f.fecha_registro_snies)::integer AS anio,
        p.periodicidad,
        COUNT(DISTINCT f.sk_programa) AS total_programas
 FROM   dw.fact_programa f
 JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
 WHERE  f.fecha_registro_snies IS NOT NULL
```

```
 GROUP  BY EXTRACT(YEAR FROM f.fecha_registro_snies)::integer,
p.periodicidad
 ORDER  BY anio, p.periodicidad;
```

# **CS-4. Costo promedio de matrícula por departamento** 

**Operación OLAP.** Agregación sobre la dimensión Ubicación 

**Descripción.** Calcula el costo promedio de matrícula y el número de programas por 

departamento. Las funciones AVG ignoran los valores nulos, por lo que solo se promedian 

programas con costo reportado. 

# **Código 5** 

_Script SQL de la consulta CS-4_ 

```
SELECT u.departamento,
        COUNT(DISTINCT f.sk_programa) AS programas_con_costo,
        ROUND(AVG(f.costo_matricula_nuevos), 0) AS
costo_promedio_matricula
 FROM   dw.fact_programa f
 JOIN   dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion
 WHERE  f.costo_matricula_nuevos IS NOT NULL
 GROUP  BY u.departamento
 ORDER  BY costo_promedio_matricula DESC;
```

# **CS-5. Créditos y duración promedio por modalidad** 

**Operación OLAP.** Agregación sobre la dimensión Modalidad 

**Descripción.** Compara el esfuerzo académico (créditos) y la duración (periodos) de los 

programas según su modalidad. 

# **Código 6** 

_Script SQL de la consulta CS-5_ 

```
SELECT p.modalidad,
        ROUND(AVG(f.numero_creditos), 1) AS promedio_creditos,
        ROUND(AVG(f.numero_periodos_duracion), 1) AS
promedio_periodos,
        COUNT(DISTINCT f.sk_programa) AS total_programas
 FROM   dw.fact_programa f
```

```
 JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
 GROUP  BY p.modalidad
 ORDER  BY total_programas DESC;
```

# **Consultas Complejas Soportadas por el Cubo** 

Las consultas complejas combinan varias dimensiones y emplean expresiones de 

agrupación multidimensional (ROLLUP y CUBE), expresiones de tabla comunes (CTE), funciones de ventana (RANK, LAG y SUM OVER) y agregaciones condicionales 

(FILTER), todas descritas en la documentación de PostgreSQL (PostgreSQL Global 

Development Group, 2024). Con ellas se implementan las operaciones OLAP de dice, roll- 

up, drill-down y pivot (Han et al., 2012), además de comparaciones y análisis de tendencia. La Tabla 2 resume las consultas. 

# **Tabla 2** 

_Consultas complejas del cubo OLAP_ 

|Código|Consulta|Operación OLAP|
|---|---|---|
|CC-1|Dice: oferta por año, modalidad, departamento<br>y nivel|Dice (subcubo con filtros sobre<br>varias dimensiones)|
|CC-2|Roll-up / Drill-down geográfico con ROLLUP|Roll-up y Drill-down (Región →<br>Departamento → Municipio)|
|CC-3|Cubo completo: modalidad × nivel de<br>formación × sector|Cálculo de todas las combinaciones<br>de agregación (CUBE)|
|CC-4|Pivot: departamentos en filas y modalidades en<br>columnas|Pivot (rotación de dimensiones)|
|CC-5|Benchmarking institucional con ranking|Comparación entre miembros de la<br>dimensión Institución|
|CC-6|Participación por campo amplio: Nariño vs.<br>Colombia|Dice + comparación local/nacional<br>con funciones de ventana|
|CC-7|Variación anual de la oferta por departamento|Análisis temporal (Drill-down por<br>Año) con LAG|



# **CC-1. Dice: oferta por año, modalidad, departamento y nivel** 

**Operación OLAP.** Dice (subcubo con filtros sobre varias dimensiones) 

**Descripción.** Selecciona un subconjunto del cubo combinando condiciones sobre cuatro 

dimensiones a la vez (tiempo, modalidad, ubicación y programa) y calcula cantidad, 

créditos promedio y costo promedio. Los valores de los filtros deben ajustarse a los 

registrados en la bodega. 

# **Código 7** 

_Script SQL de la consulta CC-1_ 

```
ELECT EXTRACT(YEAR FROM f.fecha_registro_snies)::integer AS anio,
        p.modalidad,
        u.departamento,
        p.nivel_formacion,
        COUNT(DISTINCT f.sk_programa)      AS total_programas,
        ROUND(AVG(f.numero_creditos), 1)   AS promedio_creditos,
        ROUND(AVG(f.costo_matricula_nuevos), 0) AS costo_promedio
 FROM   dw.fact_programa f
 JOIN   dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion
 JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
 WHERE  EXTRACT(YEAR FROM f.fecha_registro_snies)::integer IN (2023,
2024)
   AND  p.modalidad IN ('Presencial', 'Virtual')
   AND  u.departamento IN ('Nariño', 'Cauca', 'Putumayo')
   AND  p.nivel_formacion IN ('Universitario',
```

```
                              'Especialización universitaria',
                              'Maestría')
 GROUP  BY EXTRACT(YEAR FROM f.fecha_registro_snies)::integer,
           p.modalidad, u.departamento, p.nivel_formacion
 ORDER  BY anio, u.departamento, p.modalidad, p.nivel_formacion;
```

# **CC-2. Roll-up / Drill-down geográfico con ROLLUP** 

**Operación OLAP.** Roll-up y Drill-down (Región → Departamento → Municipio) 

**Descripción.** Genera en una sola consulta el detalle por municipio, los subtotales por 

departamento y por región, y el total nacional, siguiendo la jerarquía geográfica del cubo. 

La columna nivel_agregacion indica el nivel (0 = municipio, 1 = departamento, 2 = región, 

# 3 = total). 

# **Código 8** 

# _Script SQL de la consulta CC-2_ 

```
SELECT CASE WHEN GROUPING(u.departamento) = 1 THEN 'TOTAL NACIONAL'
```

```
             ELSE u.departamento END AS departamento,
        CASE WHEN GROUPING(u.municipio) = 1 THEN '(todos)'
```

```
             ELSE u.municipio END AS municipio,
```

```
        GROUPING(u.departamento) + GROUPING(u.municipio) AS
nivel_agregacion,
        COUNT(DISTINCT f.sk_programa) AS total_programas,
```

```
        ROUND(AVG(f.costo_matricula_nuevos), 0) AS costo_promedio
 FROM   dw.fact_programa f
 JOIN   dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion
 WHERE  EXTRACT(YEAR FROM f.fecha_registro_snies)::integer = 2024
 GROUP  BY ROLLUP (u.departamento, u.municipio)
 ORDER  BY u.departamento NULLS LAST, u.municipio NULLS LAST;
```

# **CC-3. Cubo completo: modalidad × nivel de formación × sector** 

**Operación OLAP.** Cálculo de todas las combinaciones de agregación (CUBE) 

**Descripción.** Calcula todas las agregaciones posibles entre tres dimensiones (8 

combinaciones de totales y subtotales). Es la materialización clásica del cubo OLAP y 

permite navegar sin escribir una consulta distinta para cada análisis. 

# **Código 9** 

_Script SQL de la consulta CC-3_ 

```
SELECT COALESCE(p.modalidad,       'TODAS')  AS modalidad,
        COALESCE(p.nivel_formacion, 'TODOS')  AS nivel_formacion,
        COALESCE(i.sector,          'TODOS')  AS sector,
        COUNT(DISTINCT f.sk_programa)         AS total_programas,
        ROUND(AVG(f.numero_creditos), 1)      AS promedio_creditos,
        ROUND(AVG(f.numero_periodos_duracion), 1) AS promedio_periodos
 FROM   dw.fact_programa f
 JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
 JOIN   dw.dim_institucion i ON i.sk_institucion = f.sk_institucion
 WHERE  EXTRACT(YEAR FROM f.fecha_registro_snies)::integer = 2024
 GROUP  BY CUBE (p.modalidad, p.nivel_formacion, i.sector)
```

```
 ORDER  BY GROUPING(p.modalidad), GROUPING(p.nivel_formacion),
           GROUPING(i.sector), total_programas DESC;
```

# **CC-4. Pivot: departamentos en filas y modalidades en columnas** 

**Operación OLAP.** Pivot (rotación de dimensiones) 

**Descripción.** Intercambia la dimensión Modalidad de las filas a las columnas, de modo que 

cada departamento muestra su cantidad de programas por modalidad y el porcentaje de 

oferta presencial. 

**Código 10** 

_Script SQL de la consulta CC-4_ 

```
SELECT u.departamento,
        COUNT(DISTINCT f.sk_programa) FILTER (WHERE p.modalidad =
'Presencial')
                                               AS presencial,
        COUNT(DISTINCT f.sk_programa) FILTER (WHERE p.modalidad =
'Virtual')
                                               AS virtual,
        COUNT(DISTINCT f.sk_programa) FILTER (WHERE p.modalidad = 'A
distancia')
                                               AS a_distancia,
        COUNT(DISTINCT f.sk_programa) AS total,
        ROUND(100.0 * COUNT(DISTINCT f.sk_programa)
              FILTER (WHERE p.modalidad = 'Presencial')
              / NULLIF(COUNT(DISTINCT f.sk_programa), 0), 1) AS
pct_presencial
 FROM   dw.fact_programa f
 JOIN   dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion
 JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
 WHERE  EXTRACT(YEAR FROM f.fecha_registro_snies)::integer = 2024
 GROUP  BY u.departamento
 ORDER  BY total DESC;
```

# **CC-5. Benchmarking institucional con ranking** 

**Operación OLAP.** Comparación entre miembros de la dimensión Institución 

**Descripción.** Ordena las instituciones según su cantidad de programas y compara el costo 

de matrícula de cada una con el promedio entre instituciones. Muestra las 10 primeras y la 

Universidad de Nariño, aunque no esté en ese grupo. 

# **Código 11** 

_Script SQL de la consulta CC-5_ 

```
WITH base AS (
   SELECT i.nombre_institucion,
          i.sector,
          COUNT(DISTINCT f.sk_programa) AS total_programas,
          AVG(f.numero_creditos)   AS prom_creditos,
          AVG(f.numero_periodos_duracion) AS prom_periodos,
          AVG(f.costo_matricula_nuevos) AS prom_costo
   FROM   dw.fact_programa f
   JOIN   dw.dim_institucion i ON i.sk_institucion = f.sk_institucion
   WHERE  EXTRACT(YEAR FROM f.fecha_registro_snies)::integer = 2024
   GROUP  BY i.nombre_institucion, i.sector
 ),
 ranking AS (
   SELECT b.*,
          RANK() OVER (ORDER BY total_programas DESC) AS
puesto_oferta,
          AVG(prom_costo) OVER ()                     AS
costo_prom_instituciones
   FROM   base b
 )
 SELECT puesto_oferta,
        nombre_institucion,
        sector,
        total_programas,
        ROUND(prom_creditos, 1)  AS prom_creditos,
        ROUND(prom_periodos, 1)  AS prom_periodos,
        ROUND(prom_costo, 0)     AS costo_promedio,
        ROUND(100.0 * (prom_costo - costo_prom_instituciones)
              / NULLIF(costo_prom_instituciones, 0), 1) AS
dif_costo_pct
 FROM   ranking
 WHERE  puesto_oferta <= 10
    OR  nombre_institucion ILIKE '%Universidad de Nari%o%'
 ORDER  BY puesto_oferta;
```

# **CC-6. Participación por campo amplio: Nariño vs. Colombia** 

**Operación OLAP.** Dice + comparación local/nacional con funciones de ventana 

**Descripción.** Calcula qué porcentaje de la oferta de Nariño y del país corresponde a cada 

campo amplio del conocimiento y mide la diferencia en puntos porcentuales. Un valor 

positivo indica un área en la que Nariño concentra más oferta que el promedio nacional. 

# **Código 12** 

_Script SQL de la consulta CC-6_ 

```
WITH nacional AS (
   SELECT p.cine_campo_amplio AS campo_amplio,
          COUNT(DISTINCT f.sk_programa) AS total_nal
   FROM   dw.fact_programa f
   JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
   WHERE  EXTRACT(YEAR FROM f.fecha_registro_snies)::integer = 2024
   GROUP  BY p.cine_campo_amplio
 ),
 narino AS (
   SELECT p.cine_campo_amplio AS campo_amplio,
          COUNT(DISTINCT f.sk_programa) AS total_nar
   FROM   dw.fact_programa f
   JOIN   dw.dim_programa p ON p.sk_programa = f.sk_programa
   JOIN   dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion
   WHERE  EXTRACT(YEAR FROM f.fecha_registro_snies)::integer = 2024
     AND  u.departamento = 'Nariño'
   GROUP  BY p.cine_campo_amplio
 )
 SELECT nal.campo_amplio,
        COALESCE(nar.total_nar, 0)                           AS
programas_narino,
        nal.total_nal                                        AS
programas_nacional,
        ROUND(100.0 * COALESCE(nar.total_nar, 0)
              / SUM(nar.total_nar) OVER (), 2)               AS
pct_narino,
        ROUND(100.0 * nal.total_nal
              / SUM(nal.total_nal) OVER (), 2)               AS
pct_nacional,
        ROUND(100.0 * COALESCE(nar.total_nar, 0)
              / SUM(nar.total_nar) OVER ()
            - 100.0 * nal.total_nal
              / SUM(nal.total_nal) OVER (), 2)               AS
diferencia_pp
 FROM   nacional nal
```

```
 LEFT   JOIN narino nar ON nar.campo_amplio = nal.campo_amplio
 ORDER  BY diferencia_pp DESC;
```

# **CC-7. Variación anual de la oferta por departamento** 

**Operación OLAP.** Análisis temporal (Drill-down por Año) con LAG 

**Descripción.** Compara la cantidad de programas de cada año con la del año anterior para 

Nariño y departamentos vecinos, calculando la variación absoluta y porcentual. Requiere 

que la bodega conserve información histórica de varios años. 

# **Código 13** 

_Script SQL de la consulta CC-7_ 

```
WITH oferta AS (
   SELECT u.departamento,
          EXTRACT(YEAR FROM f.fecha_registro_snies)::integer AS anio,
          COUNT(DISTINCT f.sk_programa) AS total_programas
   FROM   dw.fact_programa f
   JOIN   dw.dim_ubicacion u ON u.sk_ubicacion = f.sk_ubicacion
   WHERE  u.departamento IN ('Nariño', 'Cauca', 'Putumayo')
     AND  f.fecha_registro_snies IS NOT NULL
   GROUP  BY u.departamento, EXTRACT(YEAR FROM
f.fecha_registro_snies)::integer
 )
 SELECT departamento,
        anio,
        total_programas,
        LAG(total_programas) OVER w                      AS
programas_anio_anterior,
        total_programas - LAG(total_programas) OVER w    AS variacion,
        ROUND(100.0 * (total_programas - LAG(total_programas) OVER w)
              / NULLIF(LAG(total_programas) OVER w, 0), 2) AS
variacion_pct
 FROM   oferta
 WINDOW w AS (PARTITION BY departamento ORDER BY anio)
 ORDER  BY departamento, anio;
```

# **Conclusión** 

Las doce consultas muestran que el cubo responde preguntas de distinta complejidad sobre la oferta académica del SNIES: desde conteos y promedios por una dimensión hasta 

comparaciones entre Nariño y el país, totales jerárquicos por región, departamento y 

municipio, y variaciones entre años. Todas se apoyan en la misma tabla de hechos y en dimensiones compartidas, por lo que posteriormente pueden conectarse directamente a Power BI para construir matrices, gráficos y filtros interactivos. 

**Referencias:** 

- Han, J., Kamber, M., y Pei, J. (2012). _Data mining: Concepts and techniques_ (3.ª ed.). Morgan Kaufmann. 

- Kimball, R., y Ross, M. (2013). _The data warehouse toolkit: The definitive guide to dimensional modeling_ (3.ª ed.). Wiley. 

- Ministerio de Educación Nacional. (s. f.). _Sistema Nacional de Información de la_ 

   - _Educación Superior (SNIES)_ . https://snies.mineducacion.gov.co 

- PostgreSQL Global Development Group. (2024). _PostgreSQL 16 documentation_ . 

   - https://www.postgresql.org/docs/16/ 

