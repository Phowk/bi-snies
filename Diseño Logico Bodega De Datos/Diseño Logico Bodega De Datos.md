ñ# **Diseño lógico de una bodega de datos** 

**Presentado por:  Jaider Alexis Ceballos Yandun** 

**Juan Estheban Chalaca Cordoba Steffany Mayerly Rodríguez Noguera Omar David Vallejos** 

**Universidad De Nariño Facultad De Ingeniería Departamento de Sistemas Inteligencia de Negocios** 

**Ipiales 2026** 

# **Contenido** 

|1. Enfoque de bodega de datos. ................................................................................................. 3|
|---|
|2. Estructura del dato, tabla de hechos ....................................................................................... 3|
|3. Tabla de dimensiones, tipo de esquema, granularidad .......................................................... 4|
|3.1 Tabla de dimensiones ....................................................................................................... 4|
|3.1.1 Dimensión Tiempo (Id_Tiempo) .............................................................................. 4|
|3.1.2 Dimensión Programa (Cod_Programa)..................................................................... 4|
|3.1.3 Dimensión Institución (Id_Institución) ..................................................................... 4|
|3.1.4 Dimensión Área de Conocimiento (Id_Area) ........................................................... 4|
|3.1.5 Dimensión Modalidad (Id_Modalidad) .................................................................... 5|
|3.1.6 Dimensión Ubicación (Id_Ubicación) ...................................................................... 5|
|3.1.7 Tabla de hechos Hechos_ProgramasAcademicos ..................................................... 5|
|3.2 Tipo de esquema .............................................................................................................. 5|
|3.3 Granularidad .................................................................................................................... 6|
|3.4 Esquema ........................................................................................................................... 6|
|4. Subsistema ETL, procesos ..................................................................................................... 7|
|4.1 Arquitectura general del subsistema ETL ........................................................................ 7|
|4.2 Proceso de extracción (Extract) ....................................................................................... 7|
|4.3 Proceso de transformación (Transform) .......................................................................... 8|
|4.4 Proceso de carga (Load)................................................................................................. 10|
|4.5 Tratamiento general de valores nulos y datos faltantes ................................................. 10|
|4.6 Control de calidad, trazabilidad y auditoría del proceso ETL ....................................... 11|
|Referencias ............................................................................................................................... 12|



# **1. Enfoque de bodega de datos.** 

Para el diseño de la bodega de datos se seleccionó el enfoque metodológico de Ralph Kimball con enfoque ascendente, puesto que en el caso del SNIES, la información se orienta al análisis de varias dimensiones donde los usuarios requieren consultas rápidas relacionadas con programas académicos, instituciones y lugares de ubicación geográfica. Con el modelo dimensional elegido se facilita la construcción de cubos de datos y tableros de control. La Universidad de Nariño requiere analizar información académica relacionada con programas, niveles de formación, modalidades, facultades e instituciones comparables. La metodología Kimball permite organizar la información alrededor de estos procesos de negocio mediante esquemas dimensionales fáciles de entender y consultar. 

# **2. Estructura del dato, tabla de hechos** 

Para el modelado de la estructura del dato teniendo en cuenta el caso de estudio del negocio de la Universidad de Nariño y los datos de los programas proporcionados por el SNIES se definió la siguiente tabla de hechos: 

|Campo|Descripción|Tipo|
|---|---|---|
|Cod_Programa|Clave foránea de programa|STRING|
|Id_Institucion|Clave foránea institución|STRING|
|Id_Area|Clave foránea área|STRING|
|Id_Modalidad|Clave foránea modalidad|STRING|
|Id_Ubicación|Clave foránea ubicación|STRING|
|Id_Tiempo|Claveforánea tiempo|STRING|
|NumeroCreditos|Número total de créditos<br>académicos|STRING|
|NumeroPeriodos|Número total de periodos de<br>duración|STRING|
|CostoMatricula|Costo de matrícula para<br>estudiantes nuevos (COP)|STRING|



Esta tabla de hechos se define como el núcleo de la bodega de datos porque concentra las principales métricas e indicadores académicos relacionados con la oferta académica de la Universidad De Nariño. Su función es registrar los datos de tipo cuantitativo que serán utilizados para el análisis y toma de decisiones estratégicas. 

# **3. Tabla de dimensiones, tipo de esquema, granularidad** 

# **3.1 Tabla de dimensiones** 

# **3.1.1 Dimensión Tiempo (Id_Tiempo)** 

Se construye de forma independiente al origen (dimensión de fecha generada), a partir del calendario académico institucional. 

Dimensión_Tiempo + Id_Tiempo: STRING (PK) 

Fecha: DATE Año: INTEGER Periodicidad: <u>STRING</u> 

# **3.1.2 Dimensión Programa (Cod_Programa)** 

Dimensión_Programa + Cod_Programa: STRING (PK) CodigoSnies: INTEGER NombrePrograma: STRING NivelFormación: STRING TituloOtorgado: STRING EstadoPrograma: STRING RenoconocimientoMinisterio: STRING <u>ResoluciónAprobación: STRING</u> 

# **3.1.3 Dimensión Institución (Id_Institución)** 

Dimensión_Institución + Id_Institución: STRING (PK) Codigolnstitución: INTEGER Nombrelnstitución: STRING Estadolnstitución: STRING Sector: STRING <u>CaracterAcademico: STRING</u> 

# **3.1.4 Dimensión Área de Conocimiento (Id_Area)** 

Dimensión_Area_Conocimiento + Id_Area: STRING (PK) AreaConocimiento: STRING NucleoBasicoConocimiento: STRING CampoAmplio: STRING CampoEspecifico: STRING <u>CampoDetallado: STRING</u> 

# **3.1.5 Dimensión Modalidad (Id_Modalidad)** 

<u>Dimensión_Modalidad</u> + Id_Modalidad: STRING (PK) <u>Modalidad: STRING</u> 

# **3.1.6 Dimensión Ubicación (Id_Ubicación)** 

Dimensión_Ubicación + Id_Ubicación: STRING (PK) 

Departamento: STRING Municipio: STRING Región: <u>STRING</u> 

# **3.2 Tipo de esquema** 

El esquema de estrella es el más adecuado para la bodega de datos, porque permite organizar la información de manera más clara y sencilla, que favorece un mejor rendimiento en los procesos de realización de consulta, análisis sobre cada oferta académica, generación de reportes y toma de decisiones más acertadas. Además de adaptarse al modelo dimensional planteado mediante la metodología Kimball. 

# **3.3 Granularidad** 

La granularidad corresponde al nivel de detalle de cada registro almacenado en la bodega de datos. En este caso, representa un programa académico especifico de una institución, asociado a un área de conocimiento, una modalidad, una ubicación geográfica y un periodo académico determinado. 

Este nivel de detalle permite conservar la información de la oferta académica a través del tiempo, realizar consultas, comparaciones y agregaciones desde las diferentes dimensiones definidas en el modelo. Así mismo, facilita el cálculo de las medidas establecidas, como el número de créditos, número de periodos, costo de matrícula y cantidad de programas. 

A partir de esto, permite analizar la evolución de los programas académicos y sus características, sin reducir la información que limite la posibilidad de consulta. De esta manera la bodega de datos conserva la información necesaria para generar indicadores y realizar análisis consolidados que apoyen la toma de decisiones. 

# **3.4 Esquema** 



<!-- Start of picture text -->
+ Id_Modalidad: STRING (PK)<br>Modalidad: STRING<br>Dimensién_Programa Dimensién_institucién<br>+ Cod_Programa: STRING (PK) ) ; + Id_Instirucion: STRING (PK)<br>CodigoSINIES: STRING Codigolntritucion: STRING<br>NombrePrograma: STRING Nombreinstitucién: STRING<br>NivelFormacién: STRING Estadoinstitucién: STRING<br>TituloOtorgado: STRING Programas_Academicos Sector: STRING<br>EstadoPrograma: STRING + Cod_Programa: STRING (FK) CaracterAcademico: STRING<br>RenoconocimientoMinisterio: + IdLInstitucién: STRING (FK)<br>SUIS +Id_Area: STRING (Fk)<br>ResoluciénAprobacién: STRING + Id_Modalidad: STRING (FK)<br>+ Id_Ubicacién: STRING (FK)<br>+ Id_Tiempo: STRING (FK)<br>NumeroCreditos: INTEGER<br>Dimensién_Area_Conocimiento CostoMatricula:Num eroperiocOsaINTEGER INTEGER: Dimensién_Ubicacién<br>+ Id_Area: STRING (PK) . + Id_Ubicacién: STRING (PK)<br>AreaConocimiento: STRING Departamento: STRING<br>NucleoBasicoConocimiento: STRING Municipio: STRING<br>CampoAmplio: STRING Region: STRING<br>CampoEspecifico: STRING<br>CampoDetallado: STRING<br>+ Id_Tiempo: STRING (PK)<br>Fecha: DATE<br>Afio: INTEGER<br>Periodicidad: STRING<br><!-- End of picture text -->

# **4. Subsistema ETL, procesos** 

El subsistema ETL (Extract, Transform, Load) es el componente encargado de trasladar la información desde las fuentes operativas del SNIES (Sistema Nacional de Información de la Educación Superior) y de los registros institucionales de la Universidad de Nariño hacia el modelo dimensional definido en las secciones anteriores. Este subsistema garantiza que los datos que ingresan a la bodega sean consistentes, íntegros y estén libres de duplicidad, aplicando reglas de limpieza, estandarización y validación antes de su disposición final en las tablas de dimensión y en la tabla de hechos Hechos_ProgramasAcademicos. 

# **4.1 Arquitectura general del subsistema ETL** 

El proceso se organiza en cuatro capas secuenciales que permiten aislar los datos crudos de la información ya validada que finalmente consulta el usuario de negocio: 

|**Capa**|**Descripción**|**Mecanismo sugerido**|
|---|---|---|
|1. Fuente (Extract)|Archivos de origen del<br>SNIES (programas,<br>instituciones, sedes) y bases<br>institucionales<br>administrativas.|Exportación en CSV/XLSX<br>y consultas SQL<br>programadas.|
|2. Staging|Área intermedia donde se<br>depositan los datos sin<br>transformar, conservando<br>una copia exacta del origen<br>para trazabilidad.|Tablas temporales (stg_*) en<br>el motor de base de datos.|
|3. Transformación|Limpieza, estandarización,<br>generación de llaves<br>subrogadas y aplicación de<br>reglas de negocio.|Rutinas ETL (SQL).|
|4. Carga (Load)|Inserción controlada en<br>dimensiones y en la tabla de<br>hechos, respetando el orden<br>de dependencias<br>referenciales.|Procedimientos de carga por<br>lotes (batch) con control<br>transaccional.|



# **4.2 Proceso de extracción (Extract)** 

La extracción reúne la información dispersa en las distintas fuentes que alimentan cada dimensión y la tabla de hechos. Se define una extracción inicial de tipo histórico (carga completa) y extracciones periódicas de tipo incremental, basadas en la fecha de corte que publica el SNIES cada periodo académico. 

|**Fuente de origen**|**Datos extraídos**|**Método de**<br>**extracción**|**Frecuencia**|
|---|---|---|---|
|Portal SNIES<br>(Ministerio de<br>Educación)|Programas<br>académicos,<br>instituciones, áreas<br>de conocimiento,<br>modalidad,<br>ubicación<br>geográfica.|Descarga de reportes<br>CSV/XLSX<br>públicos.|Semestral (según<br>actualización<br>oficial).|
|Divipola (DANE)|Códigos y nombres<br>normalizados de<br>departamento y<br>municipio.|Cruce de referencia<br>para la dimensión<br>ubicación.|Anual o bajo<br>demanda.|
|Calendario<br>académico<br>institucional|Año, semestre, fecha<br>de inicio y de cierre.|Carga manual<br>controlada o<br>generación|Anual.|



automática de la <u>dimensión tiempo.</u> 

# **4.3 Proceso de transformación (Transform)** 

En esta fase se diseñan las reglas específicas para cada dimensión y para la tabla de hechos. Ningún dato pasa de forma directa desde el origen hacia la bodega: todos los atributos se validan, se estandarizan y, cuando corresponde, se sustituye o se marca la ausencia de información mediante miembros por defecto ("No aplica", "No especificado" o llaves de valor -1), evitando así valores nulos dentro del modelo dimensional. 

# **4.3.0Tabla de dimensiones** 

# **4.3.1 Dimensión Tiempo (Id_Tiempo)** 

Se construye de forma independiente al origen (dimensión de fecha generada), a partir del <u>calendario académico institucional.</u> 

|**Campo destino**|**Transformación aplicada**|**Tratamiento de**<br>**nulos/faltantes**|
|---|---|---|
|Id_Tiempo (llave subrogada)|<br>Generación automática de un<br>identificador secuencial por<br>periodoacadémico.|No aplica; el campo siempre<br>se genera.|
|Año, Semestre, Periodo|Extracción del código de<br>periodo SNIES (ej. 2026-1) y<br>separación en año y semestre.|<br>Si el periodo llega vacío, se<br>asigna el periodo de corte<br>vigente del proceso de carga.|
|Fecha_Inicio, Fecha_Fin|Conversión al formato<br>estándar AAAA-MM-DD y<br>validación de que la fecha de<br>inicio sea anterior a la de fin.|Si falta alguna fecha, se<br>calcula a partir del periodo<br>académico institucional; si no<br>es posible, se marca "Fecha no<br>disponible".|



# **4.3.2 Dimensión Programa (Cod_Programa)** 

|**Campo destino**|**Transformación aplicada**|**Tratamiento de**<br>**nulos/faltantes**|
|---|---|---|
|Cod_Programa (llave)|Código secuencial por cada<br>registro ingresado-||
|Nombre_Programa|Estandarización de<br>mayúsculas/minúsculas,<br>eliminación de espacios dobles<br>y de caracteres especiales.|<br>Si el nombre llega vacío, se<br>marca como "Nombre no<br>registrado" y el registro se<br>deja pendiente de revisión.|
|Estado_Programa<br>Título_Otorgado|Homologación contra una<br>tabla de dominios controlados<br>(técnico, tecnológico,<br>pregrado, especialización,<br>maestría, doctorado).|Valores fuera del dominio se<br>reclasifican como "Sin<br>clasificar" y se reportan.|



# **<u>4.3.3 Dimensión Institución (Id_Institución)</u>** 

|**Campo destino**|**Transformación aplicada**|**Tratamiento de**<br>**nulos/faltantes**|
|---|---|---|
|Id_Institucion (llave<br>subrogada)|Deduplicación por NIT/código<br>SNIES de institución antes de<br>asignar la llave subrogada.|<br>Instituciones sin identificador<br>único se agrupan bajo<br>"Institución no identificada"<br>para no perder el hecho<br>asociado.|
|Nombre_Institución, Sector,<br>Carácter|Normalización de texto y<br>homologación de categorías<br>(pública/privada; universidad,<br>institución tecnológica, etc.).|Campos vacíos se completan<br>con "No especificado".|
|Tipo_Institucion|Estandarización y<br>homologación de las<br>categorías de tipo de<br>institución, eliminando<br>diferencias de escritura,<br>espacios y<br>mayúsculas/minúsculas para<br>mantener valores<br>consistentes.|Los registros sin tipo de<br>institución se asignan a "Tipo<br>de institución no identificado"<br>para conservar el registro y<br>evitar pérdida de información.|



# **4.3.4 Dimensión Área de** **<u>Conocimiento (Id_Area)</u>** 

|**Campo destino**|**Transformación aplicada**|**Tratamiento de**<br>**nulos/faltantes**<br>|
|---|---|---|
|Id_Area (llave subrogada)|Homologación contra la<br>clasificación oficial de áreas<br>del conocimiento del SNIES<br>(núcleos básicos del<br>conocimiento).|Áreas no clasificadas se<br>asignan al miembro "Área sin<br>clasificar".|
|Nombre_Area,<br>Núcleo_Básico|Limpieza de texto y<br>unificación de nombres<br>equivalentes (ej. "Ing." -><br>"Ingeniería").|Se documentan en el registro<br>de excepciones para revisión<br>posterior por el equipo<br>académico.|



|**4.3.5 Dimensión Modalid**|**ad (Id_Modalidad)**||
|---|---|---|
|**Campo destino**|**Transformación aplicada**|**Tratamiento de**<br>**nulos/faltantes**|
|Id_Modalidad (llave<br>subrogada)|Homologación a un dominio<br>cerrado y controlado:<br>presencial, distancia, virtual,<br>dual dependiendo de lo<br>permitido porelSNIES.|Modalidades no reconocidas<br>se asignan al miembro<br>"Modalidad no definida".|



# **<u>4.3.6 Dimensión Ubicación (Id_Ubicación)</u>** 

|**Campo destino**|**Transformación aplicada**|**Tratamiento de**<br>**nulos/faltantes**|
|---|---|---|
|Id_Ubicación (llave<br>subrogada)|Cruce con la codificación<br>DIVIPOLA del DANE para<br>estandarizar departamento y<br>municipio y evitar variaciones<br>de escritura.|<br>Ubicaciones sin código<br>DIVIPOLA válido se asocian<br>al miembro "Ubicación no<br>geo-referenciada".|
|Departamento, Municipio,<br>Región|Se deriva el nivel jerárquico<br>Región a partir del<br>departamento para habilitar el<br>análisis por agregación<br>(jerarquía natural de la<br>dimensión).|Si el municipio no existe pero<br>el departamento sí, se<br>conserva el registro con<br>municipio "No especificado".|



**4.3.7 Tabla de hechos Hechos_ProgramasAcademicos** 

La tabla de hechos únicamente recibe registros cuyas llaves foráneas ya fueron validadas y resueltas contra las dimensiones (Cod_Programa, Id_Institucion, Id_Area, Id_Modalidad, Id_Ubicación, Id_Tiempo). Ningún hecho se carga sin que exista previamente su fila correspondiente en cada dimensión, incluyendo los miembros "no aplica" o "no especificado" <u>descritos anteriormente, lo cual evita valores nulos en las llaves foráneas de la tabla de hechos.</u> 

|**Campo destino**|**Transformación aplicada**|**Tratamiento de**<br>**nulos/faltantes**|
|---|---|---|
|NumeroCreditos|Conversión a tipo entero y<br>validación de rango razonable<br>(mayor a 0 y menor a 300).|Valores nulos o fuera de rango<br>se sustituyen por el promedio<br>del nivel de formación y<br>quedan marcados como<br>"estimado".|
|NumeroPeriodos|Conversión a entero;<br>homologación de unidades<br>(semestres/años a número de<br>periodos semestrales).|Si falta, se infiere a partir del<br>nivel de formación (ej.<br>pregrado = 10 periodos por<br>defecto) y se marca como<br>estimado.|
|CostoMatricula|Conversión a Decimal(18,2),<br>normalización de separadores<br>decimales y actualización a<br>pesos colombianos (COP)<br>corrientes.|Costos nulos o en cero se<br>imputan con el valor 0.00 y se<br>etiquetan como "costo no<br>reportado", sin excluir el<br>registro del análisis de oferta<br>académica.|
|CantidadProgramas (medida<br>aditiva)|Se calcula en el proceso ETL<br>como conteo agregado de<br>programas por institución,<br>área, modalidad y periodo (no<br>proviene directamente del<br>origen).|Si no hay programas para una<br>combinación de dimensiones,<br>no se genera el hecho (no se<br>inserta fila), evitando registros<br>con medida en cero sin sentido<br>de negocio.|



# **4.4 Proceso de carga (Load)** 

La carga se ejecuta respetando el orden de dependencias del esquema estrella: primero se actualizan las dimensiones y, únicamente al finalizar con éxito esa etapa, se cargan los registros de la tabla de hechos. Se distingue entre una carga inicial (histórica) y cargas incrementales periódicas. 

|**Elemento cargado**|**Tipo de carga**|**Estrategia**|**Frecuencia**|
|---|---|---|---|
|Dimensiones (Programa,<br>Institución, Área, Modalidad,<br>Ubicación)|Incremental|Upsert (actualizar<br>si existe, insertar<br>si es nuevo) con<br>SCD tipo 1 para<br>atributos<br>descriptivos y<br>SCD tipo 2 para<br>atributos<br>históricos<br>relevantes (ej.<br>facultad,<br>acreditación).|Semestral,<br>alineada con la<br>publicación del<br>SNIES.|
|Dimensión Tiempo|Incremental|Inserción<br>anticipada de<br>periodos futuros<br>conocidos según<br>el calendario<br>académico.|Anual.|
|Tabla de hechos<br>Hechos_ProgramasAcademicos|Incremental (por<br>periodo<br>académico)|Inserción<br>exclusiva<br>(append)<br>validando<br>previamente la<br>existencia de las<br>llaves foráneas;<br>no se<br>sobrescriben<br>hechos de<br>periodos<br>cerrados.|Semestral.|
|Carga inicial (histórico<br>completo)|Carga completa<br>(full load)|Ejecución única<br>al poblar por<br>primera vez la<br>bodega, con<br>validación<br>exhaustiva de<br>calidad de datos.|Única vez, al<br>inicio del<br>proyecto.|



# **4.5 Tratamiento general de valores nulos y datos faltantes** 

Además de las reglas específicas descritas para cada dimensión y para la tabla de hechos, el subsistema ETL aplica una política general de manejo de datos ausentes, clasificada según el tipo de dato: 

|**Tipo de dato**|**Políticageneral aplicada**|
|---|---|
|Atributos de texto (nombres, descripciones)|Se sustituyen por el valor estándar "No<br>especificado" para conservar el registro sin<br>afectar los conteos ni los agrupamientos en<br>los reportes.|
|Llaves foráneas hacia dimensiones|Se asignan a un miembro por defecto de la<br>dimensión correspondiente ("No aplica" o<br>"Desconocido"), nunca se deja la llave en<br>blanco ni con valor nulo real en la base de<br>datos.|
|Medidas numéricas (créditos, periodos,<br>costo)|Se imputan mediante valores de referencia<br>(promedios, valores por defecto del nivel de<br>formación) y se marcan con un indicador de<br>"dato estimado" para diferenciarlos de los<br>datosreales en los análisis.|
|Fechas|Se calculan a partir de reglas del calendario<br>académico institucional; si no es posible<br>deducirlas, se registran como "Fecha no<br>disponible" sin bloquear la carga del resto<br>del registro.|
|Registros totalmente incompletos (sin llave<br>natural identificable)|Se descartan de la carga y se envían a una<br>tabla de excepciones (stg_errores_etl) para<br>revisión manual por el equipo funcional, sin<br>interrumpir la carga del resto del lote.|



# **4.6 Control de calidad, trazabilidad y auditoría del proceso ETL** 

Cada ejecución del subsistema ETL queda documentada para garantizar la trazabilidad de la información y permitir auditorías posteriores sobre la calidad del dato cargado. Para ello se contemplan los siguientes mecanismos de control: 

|**Mecanismo de control**|**Descripción**|
|---|---|
|Identificador de lote (Batch_Id)|Cada ejecución del ETL recibe un<br>identificador único que se almacena junto<br>con los registros cargados, permitiendo<br>rastrear el origen y la fecha de cada dato en<br>la bodega.|
|Conteo de reconciliación|Se compara el número de registros extraídos<br>del origen contra los registros efectivamente<br>cargados en la bodega, reportando cualquier<br>diferencia.|
|Tabla de excepciones (stg_errores_etl)|Almacena los registros rechazados durante<br>la extracción o la transformación junto con<br>el motivo del rechazo, para su corrección<br>posterior.|



|Indicadores de calidad de dato|Se miden completitud (porcentaje de<br>campos sin valores por defecto),<br>consistencia (cumplimiento de reglas de<br>dominio) y exactitud (coincidencia con el<br>origen) encada carga.|
|---|---|
|Registro de auditoría (log ETL)|Guarda fecha, hora, duración, usuario o<br>proceso ejecutor y resultado (éxito, éxito<br>parcial o fallo) de cada corrida del<br>subsistema.|



En conjunto, estos procesos de extracción, transformación y carga garantizan que el modelo dimensional definido bajo la metodología de Kimball reciba información limpia, estandarizada y libre de valores nulos no controlados, condición indispensable para que la Universidad de Nariño pueda construir cubos de datos y tableros de control confiables sobre la oferta académica reportada al SNIES (Kimball & Ross, 2013; Astera, s. f.). 

# **Referencias** 

Astera. (s. f.). Creación de un almacén de datos: una guía paso a paso. <u>https://www.astera.com/es/type/blog/building-data-warehouse/</u> 

Kimball, R., & Ross, M. (2013). The data warehouse toolkit: The definitive guide to dimensional modeling (3.ª ed.). Wiley. 

Pérez Rodríguez, M. D. (Coord.). (2024). Business Intelligence (1.ª ed.). Editorial ICB. <u>https://elibro.net/es/ereader/udenar/283858?page=90</u> 

