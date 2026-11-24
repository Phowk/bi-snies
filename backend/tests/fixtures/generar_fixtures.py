"""Genera los archivos de prueba de la carga ETL (datos ficticios, siempre los mismos).

Uso, desde backend/:
    .venv/Scripts/python tests/fixtures/generar_fixtures.py

Cada archivo ejercita un caso del pipeline; los resultados esperados están en README.md de esta carpeta
y se verifican automáticamente en tests/test_carga.py.

Los programas usan códigos SNIES 990001+ (inexistentes) y, salvo la Universidad de Nariño (que las consultas
CS-2 y CC-5 buscan por nombre), instituciones inventadas.
"""
import csv
import random
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook

CARPETA = Path(__file__).parent

# Mismas 39 columnas y en el mismo orden que el reporte oficial "Programas - SIES.xlsx".
# El pipeline lee por posición, así que el orden es lo que importa.
COLUMNAS = [
    "CÓDIGO_INSTITUCIÓN_PADRE", "CÓDIGO_INSTITUCIÓN", "NOMBRE_INSTITUCIÓN", "ESTADO_INSTITUCIÓN", "CARÁCTER_ACADÉMICO",
    "SECTOR", "REGISTRO_UNICO", "CÓDIGO_SNIES_DEL_PROGRAMA", "CÓDIGO_ANTERIOR_ICFES", "NOMBRE_DEL_PROGRAMA",
    "TITULO_OTORGADO", "ESTADO_PROGRAMA", "JUSTIFICACION", "JUSTIFICACION_DETALLADA", "RECONOCIMIENTO_DEL_MINISTERIO",
    "RESOLUCIÓN_DE_APROBACIÓN", "FECHA_DE_RESOLUCIÓN", "FECHA_EJECUTORIA", "VIGENCIA_AÑOS", "FECHA_DE_REGISTRO_EN_SNIES",
    "CINE_F_2013_AC_CAMPO_AMPLIO", "CINE_F_2013_AC_CAMPO_ESPECÍFIC", "CINE_F_2013_AC_CAMPO_DETALLADO",
    "ÁREA_DE_CONOCIMIENTO", "NÚCLEO_BÁSICO_DEL_CONOCIMIENTO", "NIVEL_ACADÉMICO", "NIVEL_DE_FORMACIÓN", "MODALIDAD",
    "NÚMERO_CRÉDITOS", "NÚMERO_PERIODOS_DE_DURACIÓN", "PERIODICIDAD", "SE_OFRECE_POR_CICLOS_PROPEDÉUT",
    "PERIODICIDAD_ADMISIONES", "PROGRAMA_EN_CONVENIO", "DEPARTAMENTO_OFERTA_PROGRAMA", "MUNICIPIO_OFERTA_PROGRAMA",
    "COSTO_MATRÍCULA_ESTUD_NUEVOS", "VIGENCIA TRANSITORIA", "OBSERVACIÓN DECRETO 1174/23",
]
I = {c: i for i, c in enumerate(COLUMNAS)}

INSTITUCIONES = [
    # código, nombre, sector, carácter, ubicaciones donde oferta
    ("1206", "UNIVERSIDAD DE NARIÑO", "Oficial", "Universidad", [("Nariño", "Pasto"), ("Nariño", "Ipiales"), ("Nariño", "Tumaco")]),
    ("99001", "INSTITUCIÓN UNIVERSITARIA DE PRUEBA ANDINA", "Privado", "Institución Universitaria/Escuela Tecnológica", [("Nariño", "Pasto"), ("Cauca", "Popayán")]),
    ("99002", "CORPORACIÓN DE PRUEBA DEL PACÍFICO", "Privado", "Institución Técnica Profesional", [("Cauca", "Popayán"), ("Putumayo", "Mocoa")]),
    ("99003", "UNIVERSIDAD DE PRUEBA DE LA CAPITAL", "Oficial", "Universidad", [("Bogotá, D.C.", "Bogotá, D.C.")]),
]
NIVELES = [
    # nivel académico, nivel de formación, créditos (mín, máx), periodos, título
    ("Pregrado", "Universitario", (140, 180), 10, "PROFESIONAL EN"),
    ("Pregrado", "Tecnológico", (90, 110), 6, "TECNÓLOGO EN"),
    ("Pregrado", "Formación técnica profesional", (60, 80), 4, "TÉCNICO PROFESIONAL EN"),
    ("Posgrado", "Especialización universitaria", (24, 32), 2, "ESPECIALISTA EN"),
    ("Posgrado", "Maestría", (40, 60), 4, "MAGÍSTER EN"),
]
CAMPOS = [
    # campo amplio, específico, detallado, área, núcleo, nombre de programa
    ("Ingeniería, Industria y Construcción", "Ingeniería y profesiones afines", "Electrónica y automatización", "Ingeniería, arquitectura, urbanismo y afines", "Ingeniería electrónica", "INGENIERÍA ELECTRÓNICA"),
    ("Agropecuario, Silvicultura, Pesca y Veterinaria", "Agricultura", "Producción agrícola y ganadera", "Agronomía, veterinaria y afines", "Agronomía", "AGRONOMÍA"),
    ("Educación", "Educación", "Formación para docentes", "Ciencias de la educación", "Educación", "LICENCIATURA EN EDUCACIÓN BÁSICA"),
    ("Salud y Bienestar", "Salud", "Enfermería y partería", "Ciencias de la salud", "Enfermería", "ENFERMERÍA"),
    ("Administración de Empresas y Derecho", "Educación comercial y administración", "Gestión y administración", "Economía, administración, contaduría y afines", "Administración", "ADMINISTRACIÓN DE EMPRESAS"),
    ("Tecnologías de la Información y la Comunicación (TIC)", "Tecnologías de la información y la comunicación (TIC)", "Desarrollo y análisis de software y aplicaciones", "Ingeniería, arquitectura, urbanismo y afines", "Ingeniería de sistemas, telemática y afines", "INGENIERÍA DE SISTEMAS"),
]
MODALIDADES = ["Presencial"] * 7 + ["Virtual"] * 2 + ["A distancia"]


def programa(azar: random.Random, snies: int) -> list:
    """Una fila válida con forma de reporte SNIES."""
    cod, inst, sector, caracter, ubicaciones = azar.choice(INSTITUCIONES)
    nivel_acad, nivel, (cmin, cmax), periodos, titulo = azar.choice(NIVELES)
    amplio, especifico, detallado, area, nucleo, nombre = azar.choice(CAMPOS)
    depto, muni = azar.choice(ubicaciones)
    base = 1_800_000 if sector == "Oficial" else 5_500_000
    registro = datetime(azar.randint(2015, 2025), azar.randint(1, 12), azar.randint(1, 28), 9, 30)
    resolucion = datetime(azar.randint(2019, 2025), azar.randint(1, 12), azar.randint(1, 28))
    f = [None] * len(COLUMNAS)
    f[I["CÓDIGO_INSTITUCIÓN_PADRE"]] = int(cod)
    f[I["CÓDIGO_INSTITUCIÓN"]] = int(cod)
    f[I["NOMBRE_INSTITUCIÓN"]] = inst
    f[I["ESTADO_INSTITUCIÓN"]] = "Activa"
    f[I["CARÁCTER_ACADÉMICO"]] = caracter
    f[I["SECTOR"]] = sector
    f[I["CÓDIGO_SNIES_DEL_PROGRAMA"]] = snies
    f[I["NOMBRE_DEL_PROGRAMA"]] = nombre if nivel == "Universitario" else f"{nivel.upper()} EN {nombre}"
    f[I["TITULO_OTORGADO"]] = f"{titulo} {nombre}"
    f[I["ESTADO_PROGRAMA"]] = "Activo"
    f[I["RECONOCIMIENTO_DEL_MINISTERIO"]] = azar.choice(["Registro calificado", "Acreditación de alta calidad"])
    f[I["RESOLUCIÓN_DE_APROBACIÓN"]] = azar.randint(1000, 25000)
    f[I["FECHA_DE_RESOLUCIÓN"]] = resolucion
    f[I["FECHA_EJECUTORIA"]] = resolucion.replace(day=min(resolucion.day + 10, 28))
    f[I["VIGENCIA_AÑOS"]] = 7
    f[I["FECHA_DE_REGISTRO_EN_SNIES"]] = registro
    f[I["CINE_F_2013_AC_CAMPO_AMPLIO"]] = amplio
    f[I["CINE_F_2013_AC_CAMPO_ESPECÍFIC"]] = especifico
    f[I["CINE_F_2013_AC_CAMPO_DETALLADO"]] = detallado
    f[I["ÁREA_DE_CONOCIMIENTO"]] = area
    f[I["NÚCLEO_BÁSICO_DEL_CONOCIMIENTO"]] = nucleo
    f[I["NIVEL_ACADÉMICO"]] = nivel_acad
    f[I["NIVEL_DE_FORMACIÓN"]] = nivel
    f[I["MODALIDAD"]] = azar.choice(MODALIDADES)
    f[I["NÚMERO_CRÉDITOS"]] = azar.randint(cmin, cmax)
    f[I["NÚMERO_PERIODOS_DE_DURACIÓN"]] = periodos
    f[I["PERIODICIDAD"]] = "Semestral"
    f[I["SE_OFRECE_POR_CICLOS_PROPEDÉUT"]] = "No"
    f[I["PERIODICIDAD_ADMISIONES"]] = "Semestral"
    f[I["PROGRAMA_EN_CONVENIO"]] = "N"
    f[I["DEPARTAMENTO_OFERTA_PROGRAMA"]] = depto
    f[I["MUNICIPIO_OFERTA_PROGRAMA"]] = muni
    f[I["COSTO_MATRÍCULA_ESTUD_NUEVOS"]] = None if azar.random() < 0.15 else round(base * (1 + azar.random()), -3)
    return f


def guardar_xlsx(nombre: str, filas: list[list], hoja_extra: bool = True) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Programas"
    ws.append(COLUMNAS)
    for f in filas:
        ws.append(f)
    if hoja_extra:
        # El reporte real trae hojas adicionales; el pipeline debe elegir "Programas".
        wb.create_sheet("Cobertura").append(["CÓDIGO_SNIES_DEL_PROGRAMA", "MUNICIPIO"])
    wb.save(CARPETA / nombre)


def guardar_csv(nombre: str, filas: list[list]) -> None:
    def texto(v):
        if isinstance(v, datetime):
            return v.strftime("%d/%m/%Y")  # en CSV las fechas llegan como texto
        return "" if v is None else v

    with open(CARPETA / nombre, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(COLUMNAS)
        for f in filas:
            w.writerow([texto(v) for v in f])


def main() -> None:
    azar = random.Random(2026)
    base = [programa(azar, 990001 + i) for i in range(40)]

    # 01: carga normal.
    guardar_xlsx("01_valido.xlsx", base)

    # 02: los mismos 40 programas en CSV. Cargado después de 01 no debe agregar nada (idempotencia).
    guardar_csv("02_mismos_programas.csv", base)

    # 03: 20 programas nuevos con problemas típicos del archivo real.
    nuevos = [programa(azar, 990101 + i) for i in range(20)]
    nuevos[1][I["NÚMERO_CRÉDITOS"]] = 0                                # < mínimo
    nuevos[2][I["NÚMERO_CRÉDITOS"]] = 999                              # > máximo
    nuevos[3][I["NÚMERO_PERIODOS_DE_DURACIÓN"]] = 200                  # > máximo
    nuevos[4][I["FECHA_DE_REGISTRO_EN_SNIES"]] = datetime(2031, 6, 1)  # fecha futura
    nuevos[5][I["FECHA_DE_RESOLUCIÓN"]] = datetime(1940, 1, 1)         # anterior a 1950
    nuevos[6][I["FECHA_DE_REGISTRO_EN_SNIES"]] = "31/02/2020"          # fecha imposible
    nuevos[7][I["COSTO_MATRÍCULA_ESTUD_NUEVOS"]] = "abc"               # costo no numérico
    nuevos[8][I["FECHA_DE_REGISTRO_EN_SNIES"]] = 45253                 # número serial de Excel (válido: 2023-11-23)
    nuevos[9][I["NOMBRE_DEL_PROGRAMA"]] = "  INGENIERÍA\xa0DE   SISTEMAS  "  # espacios y espacio duro
    nuevos[9][I["VIGENCIA_AÑOS"]] = "n/a"                              # marcador de nulo
    anomalias = nuevos + [
        list(nuevos[0]),                                                 # fila duplicada: no debe duplicar el hecho
        ["", "", "", "", "", "", "", "N/A"],                             # sin código SNIES: rechazada
        ["", "", "", "", "", "", "", "ABC123"],                          # código SNIES no numérico: rechazada y auditada
        ["Fuente: SNIES - Ministerio de Educación Nacional"],            # nota al pie del reporte: rechazada
    ]
    guardar_xlsx("03_con_anomalias.xlsx", anomalias)

    # 04: actualización. 5 programas de 01 cambian su costo y llegan 3 nuevos.
    actualizados = [list(f) for f in base[:5]]
    for f in actualizados:
        f[I["COSTO_MATRÍCULA_ESTUD_NUEVOS"]] = 12_345_000
    guardar_xlsx("04_actualizacion.xlsx", actualizados + [programa(azar, 990201 + i) for i in range(3)])

    # 05: solo encabezados.
    guardar_xlsx("05_vacio.xlsx", [])

    # 06: texto con extensión .xlsx (archivo dañado o renombrado).
    (CARPETA / "06_corrupto.xlsx").write_text("Esto no es un libro de Excel.\n", encoding="utf-8")

    # 07: una hoja de cálculo cualquiera, que no es el reporte del SNIES.
    wb = Workbook()
    wb.active.title = "Notas"
    for f in [["Estudiante", "Nota 1", "Nota 2"], ["Ana", 4.5, 3.8], ["Luis", 3.2, 4.1], ["Sofía", 4.9, 4.7]]:
        wb.active.append(f)
    wb.save(CARPETA / "07_otra_hoja_de_calculo.xlsx")

    # 08: extensión no permitida.
    (CARPETA / "08_formato_no_permitido.txt").write_text("CÓDIGO_SNIES_DEL_PROGRAMA\n990001\n", encoding="utf-8")

    print(f"Archivos generados en {CARPETA}")


if __name__ == "__main__":
    main()
