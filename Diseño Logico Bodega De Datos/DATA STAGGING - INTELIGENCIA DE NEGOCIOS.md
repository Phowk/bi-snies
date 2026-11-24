## Diseño de Data Staging

## Presentado por: Jaider Alexis Ceballos Yandun Steffany Mayerly Rodríguez Noguera Juan Estheban Chalaca Córdoba Omar David Vallejos

## Departamento de Sistemas Inteligencia de Negocios Universidad De Nariño Facultad De Ingeniería Ipiales 2026


Contenido

[1. Diseño del data Staging ...................................................................................... 3](#page-0)

[2. Construcción del Data Staging en PostgreSQL ..................................................... 4](#page-0)

[3. Carga de datos en el Data Staging ....................................................................... 7](#page-0)

[4. Script o funciones para implementación del subsistema ETL ............................... 9](#page-0)


## 1. Diseño del data Staging

Se utilizan los siguientes elementos:

- stg_cargas

- o stg_programas

- o stg_instituciones

En stg_cargas se registra cada ejecución de cargas, con el fin de darles trazabilidad

| Campo |   |   | Descripción |
| --- | --- | --- | --- |
| id_carga |   |   | Identificador de la carga |
| fecha_inicio |   |   | Inicio de la carga |
| fecha_fin |   |   | Finalización |
| estado |   |   | INICIADA / EXITOSA / ERROR |
| registros_programas |   |   | Cantidad cargada |
| registros_instituciones |   |   | Cantidad cargada |

stg_programas: Almacenar registros provenientes del archivo de programas del SNIES.

| stg_programas |
| --- |
| CÓDIGO_SNIES_DEL_PROGRAMA |
| CÓDIGO_ANTERIOR_ICFES |
| NOMBRE_DEL_PROGRAMA |
| TITULO_OTORGADO |
| ESTADO_PROGRAMA |
| JUSTIFICACION |
| JUSTIFICACION_DETALLADA |
| RECONOCIMIENTO_DEL_MINISTERIO |
| RESOLUCIÓN_DE_APROBACIÓN |
| FECHA_DE_RESOLUCIÓN |
| FECHA_EJECUTORIA |
| VIGENCIA_AÑOS |
| FECHA_DE_REGISTRO_EN_SNIES |
| CINE_F_2013_AC_CAMPO_AMPLIO |
| CINE_F_2013_AC_CAMPO_ESPECÍFIC |
| CINE_F_2013_AC_CAMPO_DETALLADO |
| ÁREA_DE_CONOCIMIENTO |


NÚCLEO_BÁSICO_DEL_CONOCIMIENTO

NIVEL_ACADÉMICO

NIVEL_DE_FORMACIÓN

MODALIDAD

NÚMERO_CRÉDITOS

NÚMERO_PERIODOS_DE_DURACIÓN

PERIODICIDAD

SE_OFRECE_POR_CICLOS_PROPEDÉUT

PERIODICIDAD_ADMISIONES

PROGRAMA_EN_CONVENIO

DEPARTAMENTO_OFERTA_PROGRAMA

MUNICIPIO_OFERTA_PROGRAMA

COSTO_MATRÍCULA_ESTUD_NUEVOS

VIGENCIA TRANSITORIA

OBSERVACIÓN DECRETO 1174/23

stg_instituciones: Almacenar registros de las instituciones.

## stg_instituciones

CÓDIGO_INSTITUCIÓN_PADRE

CÓDIGO_INSTITUCIÓN

NOMBRE_INSTITUCIÓN

ESTADO_INSTITUCIÓN

CARÁCTER_ACADÉMICO

SECTOR

REGISTRO_UNICO

CÓDIGO_INSTITUCIÓN_PADRE

## 2. Construcción del Data Staging en PostgreSQL

```
Creación de esquema:
CREATE SCHEMA IF NOT EXISTS staging;
Tabla de cargas:
CREATE TABLE staging.stg_cargas (
id_carga SERIAL PRIMARY KEY,
fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
fecha_fin TIMESTAMP,
archivo_programas VARCHARC255),
archivo_instituciones VARCHARC255),
estado VARCHARC20) NOT NULL,
registros_programas INT DEFAULT O,
```


registros_instituciones INT DEFAULT © J;

## Tabla de programas:

CREATE TABLE staging.stg_programas (

id_staging BIGSERIAL PRIMARY KEY, id_carga INT NOT NULL, codigo_institucion VARCHAR(50), codigo_snies_programa VARCHAR(50) codigo_anterior_icfes VARCHAR(50) nombre_programa VARCHAR(255), titulo_otorgado VARCHAR(255), estado_programa VARCHAR(100), justificacion TEXT, justificacion_detallada TEXT, reconocimiento_ministerio VARCHAR(255), resolucion_aprobacion VARCHAR(255), fecha_resolucion DATE, fecha_ejecutoria DATE, vigencia_anios INT, fecha_registro_snies DATE, cine_campo_amplio VARCHAR(255), cine_campo_especifico VARCHAR(255), cine_campo_detallado VARCHAR(255) area_conocimiento VARCHAR(255), nucleo_basico_conocimiento VARCHAR(255), nivel_academico VARCHAR(100),


nivel_formacion VARCHAR(100), modalidad VARCHAR(100), numero_creditos INT, numero_periodos_duracion INT, periodicidad VARCHAR(100), ciclos_propedeuticos VARCHAR(100) periodicidad_admisiones VARCHAR(100), programa_convenio VARCHAR(100), departamento_oferta VARCHAR(100), municipio_oferta VARCHAR(100), costo_matricula_estudiantes_nuevos DECIMAL(18,2), vigencia_transitoria VARCHAR(255) observacion_decreto_1174 VARCHAR(500), fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP, hash_registro VARCHAR(64), CONSTRAINT fk_carga_programas

FOREIGN KEY (id_carga) REFERENCES staging. stg_cargas(id_carga)

J;

Tabla de instituciones:

CREATE TABLE staging.stg_instituciones(

id_staging BIGSERIAL PRIMARY KEY, id_carga INT NOT NULL, codigo_institucion_padre VARCHAR(50), codigo_institucion VARCHAR(50), nombre_institucion VARCHAR(255),

estado_institucion VARCHAR(100),


## 3. Script de carga de datos en el Data Staging

## Propósito

El presente código tiene como finalidad preparar y ejecutar el proceso de carga de los datos provenientes de las fuentes originales hacia el área de Staging. Esta capa actúa como una zona intermedia entre los archivos fuente y la bodega de datos, permitiendo un tratamiento controlado de la información antes de su integración definitiva en el sistema analítico.

## Justificación General

Se implementa una tabla de aterrizaje denominada staging.raw_programas, ya que los datos extraídos desde archivos CSV o Excel pueden contener fechas, valores numéricos y cadenas de texto en diversos formatos. Al realizar una primera recepción de todos los datos como texto, se evita que errores de formato en registros individuales interrumpan el proceso completo de carga.

Posteriormente, la información es transformada mediante funciones de validación y conversión que permiten asignar a cada campo su tipo de dato correspondiente. Además, el proceso incorpora una estrategia de carga incremental, mediante la cual solo se almacenan los registros nuevos o aquellos que han sufrido modificaciones. Esto contribuye a reducir la duplicidad de información, optimizar el almacenamiento y conservar la trazabilidad histórica de los datos recibidos.


## Justificación de los Componentes Principales

Tabla staging.raw_programas

Esta tabla almacena temporalmente una copia de los datos originales tal como fueron recibidos. Su principal utilidad es preservar la información de origen para facilitar auditorías, validaciones y procesos de depuración en caso de presentarse errores durante la transformación.

## Columnas Adicionales e Índices

Se incorporan campos complementarios para registrar información relacionada con el proceso de carga, así como índices que mejoran la velocidad de búsqueda y consulta por criterios como código, institución o identificador de carga.

Función staging.fn_a_entero

Permite convertir valores de texto a números enteros, aceptando formatos como 164 o 164.0. Cuando el dato recibido no puede transformarse correctamente, la función retorna un valor NULL en lugar de generar una excepción que interrumpa el proceso.

Función staging.fn_a_numerico

Se encarga de convertir valores numéricos expresados con diferentes separadores decimales, admitiendo formatos como 8.5 o 8,5. Esto garantiza la correcta interpretación de datos provenientes de distintas configuraciones regionales.

Función staging.fn_a_fecha

Realiza la conversión de fechas almacenadas como texto hacia el tipo de dato fecha, soportando formatos habituales como YYYY-MM-DD y DD/MM/YYYY.

Función staging.fn_hash

Genera una huella digital utilizando el algoritmo SHA-256 a partir de los valores de cada registro. Esta huella permite identificar de manera eficiente si un registro ha sido modificado respecto a una carga anterior.

Función staging.fn_cargar_staging

Corresponde a la función principal del proceso. Su responsabilidad es registrar la ejecución de la carga, verificar la existencia de datos en la tabla de aterrizaje, transformar la información, insertar los registros nuevos o modificados en las tablas de staging y generar un resumen de los resultados obtenidos.

Estrategia de Carga Incremental


La carga incremental evita la inserción repetida de registros ya existentes cuando no presentan cambios. Asimismo, conserva las versiones anteriores de los datos en el área de staging, garantizando la trazabilidad y el seguimiento histórico de la información.

## Control de Errores

El proceso incorpora mecanismos de control que permiten registrar cualquier incidencia detectada durante la carga. En caso de error, la ejecución queda marcada con el estado ERROR junto con el mensaje descriptivo correspondiente, facilitando la identificación, análisis y corrección de las causas del problema.

## Resultado Esperado

Una vez finalizado el proceso de carga y transformación, la información queda almacenada en las siguientes tablas:

staging.stg_programas

staging.stg_instituciones

staging.stg_cargas

La tabla staging.stg_cargas permite llevar el control de las ejecuciones realizadas, registrando información como el archivo procesado, la fecha y hora de finalización, la cantidad de registros afectados y los posibles errores de conversión o validación generados durante el proceso. Esto proporciona trazabilidad, control operativo y soporte para actividades de auditoría y monitoreo de la calidad de los datos.

## 4. Script para implementación del subsistema ETL

## Propósito

El presente código implementa el subsistema ETL (Extract, Transform and Load) de la solución de inteligencia de negocios. Su función principal es tomar los registros nuevos o modificados provenientes del área de Staging, aplicar los procesos de limpieza y transformación necesarios, registrar las modificaciones realizadas y cargar finalmente la información en la bodega de datos.

## Justificación General

La bodega de datos requiere información consistente, estandarizada y optimizada para el análisis. Por esta razón, el proceso ETL realiza la separación de los datos en dimensiones y hechos, convierte los valores a los tipos de datos adecuados, gestiona valores faltantes y garantiza la integridad de las relaciones entre instituciones, ubicaciones y programas académicos.


Adicionalmente, el proceso incorpora mecanismos de auditoría que permiten conocer el valor original recibido desde la fuente, el valor almacenado tras la transformación y la regla aplicada durante el proceso. Esto proporciona transparencia, trazabilidad y control sobre la calidad de los datos almacenados.

## Justificación de los Componentes Principales

Esquemas dw y etl

Estos esquemas permiten separar la información consolidada de la bodega de datos de las estructuras utilizadas para la ejecución, control y auditoría del proceso ETL. Esta organización facilita el mantenimiento y la administración de la solución.

Tabla etl.reglas_transformacion

Actúa como un catálogo centralizado de reglas de transformación. Su objetivo es documentar y describir las acciones aplicadas a cada dato durante su proceso de limpieza, conversión o estandarización.

Tabla etl.control_etl

Registra cada ejecución del proceso ETL asociada a una carga proveniente del área de Staging. Permite controlar el estado de la ejecución, las fechas de inicio y finalización, la cantidad de registros procesados y los posibles errores ocurridos durante el procedimiento.

Tabla etl.auditoria_transformacion

Almacena el detalle de las transformaciones realizadas sobre los datos. Gracias a esta tabla es posible rastrear y justificar cualquier modificación aplicada a la información original.

Dimensión dw.dim_institucion

Contiene la información descriptiva de las instituciones educativas y constituye una de las dimensiones principales de la bodega de datos.

Dimensión dw.dim_ubicacion

Centraliza la información geográfica asociada a departamentos y municipios, evitando la redundancia de datos y mejorando la consistencia de las consultas analíticas.

Dimensión dw.dim_programa

Almacena la información descriptiva de los programas académicos, proporcionando un contexto adecuado para el análisis de la oferta educativa.

Tabla de Hechos dw.fact_programa


Representa el núcleo analítico del modelo dimensional. Relaciona programas, instituciones y ubicaciones, además de almacenar valores numéricos, indicadores y fechas relevantes para el análisis.

Miembro Desconocido -1

Se implementa un registro especial denominado miembro desconocido con identificador -1, que permite mantener la integridad referencial cuando un programa no encuentra una institución asociada en las dimensiones. De esta forma se evita la pérdida de información y se registra la incidencia mediante la auditoría correspondiente.

Función etl.fn_es_marcador_nulo

Identifica valores que representan ausencia de información, tales como N/A, NA, NULL u otras variantes equivalentes.

Función etl.fn_limpiar_texto

Realiza procesos de normalización textual, eliminando espacios innecesarios, corrigiendo repeticiones y convirtiendo cadenas vacías o marcadores de ausencia en valores NULL.

Función etl.fn_a_booleano

Transforma diferentes representaciones textuales de respuestas afirmativas y negativas, como Sí, No, S o N, en valores booleanos.

Función etl.fn_limpiar_fecha

Valida y depura fechas, descartando valores imposibles o fuera de los rangos establecidos, como fechas anteriores a 1950 o posteriores a la fecha de ejecución del proceso.

Función etl.fn_limpiar_vigencia

Garantiza la validez de las vigencias registradas, aceptando únicamente valores comprendidos entre 0 y 30 años, evitando así la incorporación de datos atípicos o erróneos.

Función etl.fn_etl_instituciones

Procesa la información de las instituciones, seleccionando la última versión disponible dentro de cada carga, registrando los cambios detectados y actualizando la dimensión correspondiente.

Función etl.fn_etl_programas

Ejecuta la transformación de los programas académicos, actualiza dimensiones y ubicaciones, establece las relaciones necesarias con las instituciones y registra la información resultante en la tabla de hechos.


Función etl.fn_procesar_carga

Coordina el procesamiento completo de una carga específica, ejecutando primero la actualización de instituciones y posteriormente la de programas académicos.

Función etl.fn_ejecutar_etl

Permite procesar automáticamente todas las cargas pendientes en el orden correspondiente o ejecutar una carga individual previamente seleccionada.

Vista etl.v_resumen_auditoria

Proporciona una visión consolidada de las transformaciones realizadas, agrupando la información por carga, tabla, columna y regla aplicada. Esta vista facilita la revisión de la calidad y consistencia de los datos transformados.

## Resultado Esperado

Al finalizar el proceso ETL, la información queda disponible en la bodega de datos para su explotación analítica y generación de reportes.

Los datos se almacenan en las siguientes estructuras:

dw.dim_institucion: información descriptiva de las instituciones.

dw.dim_ubicacion: información geográfica de departamentos y municipios.

dw.dim_programa: información descriptiva de los programas académicos.

dw.fact_programa: relaciones entre programas, instituciones y ubicaciones, junto con sus indicadores y atributos numéricos.

etl.v_resumen_auditoria: consulta consolidada de las transformaciones aplicadas durante el ETL.
