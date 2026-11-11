"""Pipeline ETL robusto para el archivo oficial Programas - SIES.xlsx hacia el modelo de 6 dimensiones."""
import hashlib
import os
import re
from datetime import datetime, timedelta
from typing import Any
import pandas as pd
from app.db import get_raw_connection

# Mapa estándar de departamentos a regiones de Colombia
DEPARTAMENTO_A_REGION: dict[str, str] = {
    "NARIÑO": "Pacífica",
    "CAUCA": "Pacífica",
    "VALLE DEL CAUCA": "Pacífica",
    "CHOCÓ": "Pacífica",
    "ANTIOQUIA": "Andina",
    "BOGOTÁ, D.C.": "Andina",
    "BOGOTA D.C.": "Andina",
    "BOGOTÁ D.C.": "Andina",
    "BOGOTA": "Andina",
    "CUNDINAMARCA": "Andina",
    "BOYACÁ": "Andina",
    "CALDAS": "Andina",
    "RISARALDA": "Andina",
    "QUINDÍO": "Andina",
    "QUINDIO": "Andina",
    "TOLIMA": "Andina",
    "HUILA": "Andina",
    "SANTANDER": "Andina",
    "NORTE DE SANTANDER": "Andina",
    "ATLÁNTICO": "Caribe",
    "ATLANTICO": "Caribe",
    "BOLÍVAR": "Caribe",
    "BOLIVAR": "Caribe",
    "CESAR": "Caribe",
    "CÓRDOBA": "Caribe",
    "CORDOBA": "Caribe",
    "LA GUAJIRA": "Caribe",
    "MAGDALENA": "Caribe",
    "SUCRE": "Caribe",
    "META": "Orinoquía",
    "CASANARE": "Orinoquía",
    "ARAUCA": "Orinoquía",
    "VICHADA": "Orinoquía",
    "AMAZONAS": "Amazonía",
    "CAQUETÁ": "Amazonía",
    "CAQUETA": "Amazonía",
    "GUAVIARE": "Amazonía",
    "GUAINÍA": "Amazonía",
    "GUAINIA": "Amazonía",
    "PUTUMAYO": "Amazonía",
    "VAUPÉS": "Amazonía",
    "VAUPES": "Amazonía",
    "ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA": "Insular",
    "SAN ANDRÉS": "Insular",
    "SAN ANDRES": "Insular",
}


def resolver_region(depto: str | None) -> str:
    if not depto:
        return "No especificado"
    clean = re.sub(r"\s+", " ", depto).strip().upper()
    return DEPARTAMENTO_A_REGION.get(clean, "No especificado")


def es_marcador_nulo(val: Any) -> bool:
    if val is None or pd.isna(val):
        return True
    s = str(val).strip().lower()
    return s in {"", "nan", "nat", "null", "none", "n/a", "n.a.", "na", "no aplica", "sin clasificar"}


def limpiar_texto(val: Any, default: str = "No especificado") -> str:
    if es_marcador_nulo(val):
        return default
    s = str(val).replace("\xa0", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s if s else default


def limpiar_codigo(val: Any) -> str | None:
    if es_marcador_nulo(val):
        return None
    s = str(val).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s if s else None


def parsear_fecha(val: Any) -> tuple[datetime.date | None, str | None]:
    if es_marcador_nulo(val):
        return None, None

    # Si pandas ya lo leyó como datetime / Timestamp
    if isinstance(val, (datetime, pd.Timestamp)):
        d = val.date()
        if d < datetime(1950, 1, 1).date():
            return None, f"Fecha anterior a 1950 ({d})"
        if d > datetime.now().date() + timedelta(days=365):
            return None, f"Fecha futura no válida ({d})"
        return d, None

    s = str(val).strip()

    # Si es número serial de Excel (ej: 45253.0)
    try:
        num = float(s)
        if 1000 < num < 70000:
            d = (datetime(1899, 12, 30) + timedelta(days=num)).date()
            if d < datetime(1950, 1, 1).date():
                return None, f"Fecha anterior a 1950 ({d})"
            if d > datetime.now().date() + timedelta(days=365):
                return None, f"Fecha futura no válida ({d})"
            return d, None
    except (ValueError, TypeError):
        pass

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            d = datetime.strptime(s[:10], fmt).date()
            if d < datetime(1950, 1, 1).date():
                return None, f"Fecha anterior a 1950 ({d})"
            if d > datetime.now().date() + timedelta(days=365):
                return None, f"Fecha futura no válida ({d})"
            return d, None
        except (ValueError, TypeError):
            continue

    return None, f"Formato de fecha no reconocido: {s[:30]}"


def parsear_entero(val: Any, rango_min: int | None = None, rango_max: int | None = None) -> tuple[int | None, str | None]:
    if es_marcador_nulo(val):
        return None, None
    try:
        num = int(float(str(val).replace(",", ".").strip()))
        if rango_min is not None and num < rango_min:
            return None, f"Valor menor al mínimo ({num} < {rango_min})"
        if rango_max is not None and num > rango_max:
            return None, f"Valor mayor al máximo ({num} > {rango_max})"
        return num, None
    except Exception:
        return None, f"No es entero válido: {val}"


def parsear_decimal(val: Any) -> tuple[float | None, str | None]:
    if es_marcador_nulo(val):
        return None, None
    try:
        s = str(val).replace(",", ".").strip()
        num = float(s)
        return round(num, 2), None
    except Exception:
        return None, f"No es decimal válido: {val}"


def ejecutar_etl(ruta_archivo: str, id_carga: int) -> dict[str, Any]:
    """Carga y procesa Programas - SIES.xlsx o archivos CSV hacia staging y el DW."""
    conn = get_raw_connection()
    cur = conn.cursor()

    try:
        nombre_arch = os.path.basename(ruta_archivo).lower()
        if nombre_arch.endswith((".xlsx", ".xls")):
            # Seleccionar explícitamente la hoja 'Programas' si existe
            xl = pd.ExcelFile(ruta_archivo)
            hoja = "Programas" if "Programas" in xl.sheet_names else xl.sheet_names[0]
            df = xl.parse(sheet_name=hoja)
        else:
            df = pd.read_csv(ruta_archivo, encoding="utf-8-sig")

        total_filas = len(df)
        filas_staging = []
        errores_audit = []
        filas_rechazadas = 0

        # Mapeo posicional y por nombre insensible a tildes/caracteres
        # Col 0: Cod Inst Padre
        # Col 1: Cod Institucion
        # Col 2: Nombre Institucion
        # Col 3: Estado Institucion
        # Col 4: Caracter Academico
        # Col 5: Sector
        # Col 6: Registro Unico
        # Col 7: Codigo SNIES
        # Col 8: Codigo ICFES
        # Col 9: Nombre Programa
        # Col 10: Titulo Otorgado
        # Col 11: Estado Programa
        # Col 12: Justificacion
        # Col 13: Justificacion Detallada
        # Col 14: Reconocimiento Min
        # Col 15: Resolucion
        # Col 16: Fecha Resolucion
        # Col 17: Fecha Ejecutoria
        # Col 18: Vigencia Anios
        # Col 19: Fecha Registro SNIES
        # Col 20: CINE Amplio
        # Col 21: CINE Especifico
        # Col 22: CINE Detallado
        # Col 23: Area Conocimiento
        # Col 24: Nucleo Basico
        # Col 25: Nivel Academico
        # Col 26: Nivel Formacion
        # Col 27: Modalidad
        # Col 28: Numero Creditos
        # Col 29: Numero Periodos
        # Col 30: Periodicidad
        # Col 31: Ciclos Propedeuticos
        # Col 32: Periodicidad Admisiones
        # Col 33: Convenio
        # Col 34: Departamento Oferta
        # Col 35: Municipio Oferta
        # Col 36: Costo Matricula
        # Col 37: Vigencia Transitoria
        # Col 38: Observacion Decreto

        for idx, row in enumerate(df.itertuples(index=False), start=2):
            val_snies = row[7] if len(row) > 7 else None
            snies = limpiar_codigo(val_snies)

            # Descartar filas sin código SNIES o pies de página de notas
            if not snies or not re.match(r"^[0-9]+$", snies):
                filas_rechazadas += 1
                if not es_marcador_nulo(val_snies):
                    errores_audit.append((
                        id_carga, idx, str(val_snies)[:50], "codigo_snies", str(val_snies)[:100], "SNIES no numérico o nota de pie"
                    ))
                continue

            cod_inst = limpiar_codigo(row[1]) if len(row) > 1 else "-1"
            modalidad = limpiar_texto(row[27]) if len(row) > 27 else "No especificado"
            depto = limpiar_texto(row[34]) if len(row) > 34 else "No especificado"
            muni = limpiar_texto(row[35]) if len(row) > 35 else "No especificado"

            hash_fila = hashlib.sha256(
                f"{snies}|{cod_inst}|{modalidad}|{depto}|{muni}".encode("utf-8")
            ).hexdigest()

            f_res, err_res = parsear_fecha(row[16]) if len(row) > 16 else (None, None)
            if err_res:
                errores_audit.append((id_carga, idx, snies, "fecha_resolucion", str(row[16])[:50], err_res))

            f_eje, err_eje = parsear_fecha(row[17]) if len(row) > 17 else (None, None)
            if err_eje:
                errores_audit.append((id_carga, idx, snies, "fecha_ejecutoria", str(row[17])[:50], err_eje))

            f_snies, err_snies = parsear_fecha(row[19]) if len(row) > 19 else (None, None)
            if err_snies:
                errores_audit.append((id_carga, idx, snies, "fecha_registro_snies", str(row[19])[:50], err_snies))

            vig_anios, err_vig = parsear_decimal(row[18]) if len(row) > 18 else (None, None)
            if err_vig or (vig_anios is not None and (vig_anios < 0 or vig_anios > 30)):
                errores_audit.append((id_carga, idx, snies, "vigencia_anios", str(row[18])[:50], err_vig or "Vigencia fuera de rango (0-30)"))
                if vig_anios is not None and (vig_anios < 0 or vig_anios > 30):
                    vig_anios = None

            creditos, err_cred = parsear_entero(row[28], rango_min=1, rango_max=400) if len(row) > 28 else (None, None)
            if err_cred:
                errores_audit.append((id_carga, idx, snies, "numero_creditos", str(row[28])[:50], err_cred))

            periodos, err_per = parsear_entero(row[29], rango_min=1, rango_max=120) if len(row) > 29 else (None, None)
            if err_per:
                errores_audit.append((id_carga, idx, snies, "numero_periodos_duracion", str(row[29])[:50], err_per))

            costo, err_cost = parsear_decimal(row[36]) if len(row) > 36 else (None, None)
            if err_cost:
                errores_audit.append((id_carga, idx, snies, "costo_matricula_nuevos", str(row[36])[:50], err_cost))

            filas_staging.append((
                id_carga,
                limpiar_codigo(row[0]) if len(row) > 0 else None,
                cod_inst or "-1",
                limpiar_texto(row[2]) if len(row) > 2 else "No especificado",
                limpiar_texto(row[3]) if len(row) > 3 else "No especificado",
                limpiar_texto(row[4]) if len(row) > 4 else "No especificado",
                limpiar_texto(row[5]) if len(row) > 5 else "No especificado",
                limpiar_codigo(row[6]) if len(row) > 6 else None,
                snies,
                limpiar_codigo(row[8]) if len(row) > 8 else None,
                limpiar_texto(row[9], default="No registrado") if len(row) > 9 else "No registrado",
                limpiar_texto(row[10], default="No registrado") if len(row) > 10 else "No registrado",
                limpiar_texto(row[11]) if len(row) > 11 else "No especificado",
                limpiar_texto(row[12], default="") if len(row) > 12 else "",
                limpiar_texto(row[14]) if len(row) > 14 else "No especificado",
                limpiar_codigo(row[15]) if len(row) > 15 else None,
                f_res,
                f_eje,
                vig_anios,
                f_snies,
                limpiar_texto(row[20]) if len(row) > 20 else "No especificado",
                limpiar_texto(row[21]) if len(row) > 21 else "No especificado",
                limpiar_texto(row[22]) if len(row) > 22 else "No especificado",
                limpiar_texto(row[23]) if len(row) > 23 else "No especificado",
                limpiar_texto(row[24]) if len(row) > 24 else "No especificado",
                limpiar_texto(row[25]) if len(row) > 25 else "No especificado",
                limpiar_texto(row[26]) if len(row) > 26 else "No especificado",
                modalidad,
                creditos,
                periodos,
                limpiar_texto(row[30]) if len(row) > 30 else "No especificado",
                limpiar_texto(row[31], default="No") if len(row) > 31 else "No",
                depto,
                muni,
                costo,
                hash_fila
            ))

        # 1. Inserción masiva en staging
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
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        cur.executemany(sql_stg, filas_staging)

        # Inserción de anomalías detectadas
        if errores_audit:
            sql_err = """
                INSERT INTO audit.log_errores_etl (
                    id_carga, fila_origen, codigo_snies, columna, valor_original, motivo
                ) VALUES (%s, %s, %s, %s, %s, %s);
            """
            cur.executemany(sql_err, errores_audit)

        # 2. Poblado de las 6 Dimensiones
        # 2.1 dim_institucion
        cur.execute("""
            INSERT INTO dw.dim_institucion (codigo_institucion, nombre_institucion, sector, caracter_academico, estado_institucion)
            SELECT DISTINCT ON (codigo_institucion)
                codigo_institucion, nombre_institucion, sector, caracter_academico, estado_institucion
            FROM staging.stg_programas_raw
            WHERE id_carga = %s AND codigo_institucion IS NOT NULL AND codigo_institucion <> ''
            ORDER BY codigo_institucion, id_staging DESC
            ON CONFLICT (codigo_institucion) DO UPDATE SET
                nombre_institucion = EXCLUDED.nombre_institucion,
                sector = EXCLUDED.sector,
                caracter_academico = EXCLUDED.caracter_academico,
                estado_institucion = EXCLUDED.estado_institucion;
        """, (id_carga,))

        # 2.2 dim_ubicacion
        cur.execute("""
            INSERT INTO dw.dim_ubicacion (departamento, municipio, region)
            SELECT DISTINCT ON (departamento_oferta, municipio_oferta)
                departamento_oferta,
                municipio_oferta,
                CASE UPPER(departamento_oferta)
                    WHEN 'NARIÑO' THEN 'Pacífica'
                    WHEN 'CAUCA' THEN 'Pacífica'
                    WHEN 'VALLE DEL CAUCA' THEN 'Pacífica'
                    WHEN 'CHOCÓ' THEN 'Pacífica'
                    WHEN 'ANTIOQUIA' THEN 'Andina'
                    WHEN 'BOGOTÁ, D.C.' THEN 'Andina'
                    WHEN 'BOGOTA D.C.' THEN 'Andina'
                    WHEN 'CUNDINAMARCA' THEN 'Andina'
                    WHEN 'BOYACÁ' THEN 'Andina'
                    WHEN 'CALDAS' THEN 'Andina'
                    WHEN 'RISARALDA' THEN 'Andina'
                    WHEN 'QUINDÍO' THEN 'Andina'
                    WHEN 'TOLIMA' THEN 'Andina'
                    WHEN 'HUILA' THEN 'Andina'
                    WHEN 'SANTANDER' THEN 'Andina'
                    WHEN 'NORTE DE SANTANDER' THEN 'Andina'
                    WHEN 'ATLÁNTICO' THEN 'Caribe'
                    WHEN 'BOLÍVAR' THEN 'Caribe'
                    WHEN 'CESAR' THEN 'Caribe'
                    WHEN 'CÓRDOBA' THEN 'Caribe'
                    WHEN 'LA GUAJIRA' THEN 'Caribe'
                    WHEN 'MAGDALENA' THEN 'Caribe'
                    WHEN 'SUCRE' THEN 'Caribe'
                    WHEN 'META' THEN 'Orinoquía'
                    WHEN 'CASANARE' THEN 'Orinoquía'
                    WHEN 'ARAUCA' THEN 'Orinoquía'
                    WHEN 'VICHADA' THEN 'Orinoquía'
                    WHEN 'AMAZONAS' THEN 'Amazonía'
                    WHEN 'CAQUETÁ' THEN 'Amazonía'
                    WHEN 'GUAVIARE' THEN 'Amazonía'
                    WHEN 'GUAINÍA' THEN 'Amazonía'
                    WHEN 'PUTUMAYO' THEN 'Amazonía'
                    WHEN 'VAUPÉS' THEN 'Amazonía'
                    WHEN 'ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA' THEN 'Insular'
                    WHEN 'SAN ANDRÉS' THEN 'Insular'
                    ELSE 'No especificado'
                END AS region
            FROM staging.stg_programas_raw
            WHERE id_carga = %s
            ORDER BY departamento_oferta, municipio_oferta, id_staging DESC
            ON CONFLICT (departamento, municipio) DO UPDATE SET
                region = EXCLUDED.region;
        """, (id_carga,))

        # 2.3 dim_modalidad
        cur.execute("""
            INSERT INTO dw.dim_modalidad (modalidad)
            SELECT DISTINCT modalidad FROM staging.stg_programas_raw WHERE id_carga = %s
            ON CONFLICT (modalidad) DO NOTHING;
        """, (id_carga,))

        # 2.4 dim_area_conocimiento
        cur.execute("""
            INSERT INTO dw.dim_area_conocimiento (area_conocimiento, nucleo_basico, cine_campo_amplio, cine_campo_especifico, cine_campo_detallado)
            SELECT DISTINCT ON (area_conocimiento, nucleo_basico_conocimiento, cine_campo_amplio)
                area_conocimiento, nucleo_basico_conocimiento, cine_campo_amplio, cine_campo_especifico, cine_campo_detallado
            FROM staging.stg_programas_raw
            WHERE id_carga = %s
            ORDER BY area_conocimiento, nucleo_basico_conocimiento, cine_campo_amplio, id_staging DESC
            ON CONFLICT (area_conocimiento, nucleo_basico, cine_campo_amplio) DO NOTHING;
        """, (id_carga,))

        # 2.5 dim_tiempo
        cur.execute("""
            INSERT INTO dw.dim_tiempo (anio, semestre, periodo)
            SELECT DISTINCT
                EXTRACT(YEAR FROM fecha_registro_snies)::INT AS anio,
                CASE WHEN EXTRACT(MONTH FROM fecha_registro_snies) <= 6 THEN 1 ELSE 2 END AS semestre,
                CONCAT(EXTRACT(YEAR FROM fecha_registro_snies)::INT, '-',
                       CASE WHEN EXTRACT(MONTH FROM fecha_registro_snies) <= 6 THEN 1 ELSE 2 END) AS periodo
            FROM staging.stg_programas_raw
            WHERE id_carga = %s AND fecha_registro_snies IS NOT NULL
            ON CONFLICT (periodo) DO NOTHING;
        """, (id_carga,))

        # 2.6 dim_programa
        cur.execute("""
            INSERT INTO dw.dim_programa (
                codigo_snies, nombre_programa, titulo_otorgado, nivel_academico,
                nivel_formacion, modalidad, area_conocimiento, cine_campo_amplio,
                estado_programa, reconocimiento, periodicidad
            )
            SELECT DISTINCT ON (codigo_snies, modalidad)
                codigo_snies, nombre_programa, titulo_otorgado, nivel_academico,
                nivel_formacion, modalidad, area_conocimiento, cine_campo_amplio,
                estado_programa, reconocimiento_ministerio, periodicidad
            FROM staging.stg_programas_raw
            WHERE id_carga = %s
            ORDER BY codigo_snies, modalidad, id_staging DESC
            ON CONFLICT (codigo_snies, modalidad) DO UPDATE SET
                nombre_programa = EXCLUDED.nombre_programa,
                titulo_otorgado = EXCLUDED.titulo_otorgado,
                nivel_academico = EXCLUDED.nivel_academico,
                nivel_formacion = EXCLUDED.nivel_formacion,
                area_conocimiento = EXCLUDED.area_conocimiento,
                cine_campo_amplio = EXCLUDED.cine_campo_amplio,
                estado_programa = EXCLUDED.estado_programa,
                reconocimiento = EXCLUDED.reconocimiento,
                periodicidad = EXCLUDED.periodicidad;
        """, (id_carga,))

        # 3. Carga de Hechos con resolución de FKs hacia las dimensiones
        cur.execute("""
            INSERT INTO dw.fact_programa (
                sk_programa, sk_institucion, sk_ubicacion, sk_modalidad, sk_area, sk_tiempo,
                id_carga, numero_creditos, numero_periodos_duracion, costo_matricula_nuevos,
                vigencia_anios, fecha_resolucion, fecha_registro_snies, cantidad_programa, hash_fila
            )
            SELECT DISTINCT ON (s.hash_fila)
                COALESCE(p.sk_programa, -1),
                COALESCE(i.sk_institucion, -1),
                COALESCE(u.sk_ubicacion, -1),
                COALESCE(m.sk_modalidad, -1),
                COALESCE(a.sk_area, -1),
                COALESCE(t.sk_tiempo, -1),
                s.id_carga,
                s.numero_creditos,
                s.numero_periodos_duracion,
                s.costo_matricula_nuevos,
                s.vigencia_anios,
                s.fecha_resolucion,
                s.fecha_registro_snies,
                1,
                s.hash_fila
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
            ORDER BY s.hash_fila, s.id_staging DESC
            ON CONFLICT (hash_fila) DO UPDATE SET
                numero_creditos = EXCLUDED.numero_creditos,
                numero_periodos_duracion = EXCLUDED.numero_periodos_duracion,
                costo_matricula_nuevos = EXCLUDED.costo_matricula_nuevos,
                vigencia_anios = EXCLUDED.vigencia_anios,
                fecha_resolucion = EXCLUDED.fecha_resolucion,
                fecha_registro_snies = EXCLUDED.fecha_registro_snies,
                id_carga = EXCLUDED.id_carga;
        """, (id_carga,))

        filas_cargadas = cur.rowcount

        # 4. Actualizar log de auditoría
        cur.execute("""
            UPDATE audit.log_cargas
            SET estado = 'EXITOSO',
                fecha_fin = CURRENT_TIMESTAMP,
                total_filas_origen = %s,
                filas_cargadas_hechos = %s,
                filas_rechazadas = %s,
                mensaje_error = NULL
            WHERE id_carga = %s;
        """, (total_filas, filas_cargadas, filas_rechazadas, id_carga))

        conn.commit()
        return {
            "id_carga": id_carga,
            "estado": "EXITOSO",
            "total_filas_origen": total_filas,
            "filas_cargadas_hechos": filas_cargadas,
            "filas_rechazadas": filas_rechazadas,
            "anomalias_detectadas": len(errores_audit)
        }

    except Exception as e:
        conn.rollback()
        err_msg = str(e)
        try:
            with conn.cursor() as err_cur:
                err_cur.execute("""
                    UPDATE audit.log_cargas
                    SET estado = 'ERROR',
                        fecha_fin = CURRENT_TIMESTAMP,
                        mensaje_error = %s
                    WHERE id_carga = %s;
                """, (err_msg, id_carga))
                conn.commit()
        except Exception:
            pass
        raise e
    finally:
        cur.close()
        conn.close()
