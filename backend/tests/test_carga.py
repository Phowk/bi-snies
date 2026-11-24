"""Prueba de extremo a extremo de la carga ETL con los archivos de tests/fixtures.

Usa una base de datos aparte (snies_dw_pruebas) que borra y recrea al empezar: nunca toca snies_dw.
Ejecutar desde backend/ en su propio proceso:
    .venv/Scripts/python -m unittest tests.test_carga -v

Los casos van en orden (01 → 08) porque cada carga parte del estado que dejó la anterior.
"""
import os
import sys
import unittest
from pathlib import Path

BD_PRUEBAS = "snies_dw_pruebas"
# Debe fijarse antes de importar la app: app.db lee la configuración al importarse (load_dotenv no la pisa).
os.environ["DB_NAME"] = BD_PRUEBAS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db  # noqa: E402
from app.main import app  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


class CargaEtl(unittest.TestCase):
    client: TestClient

    @classmethod
    def setUpClass(cls):
        # Salvaguarda: si otro módulo importó la app antes con la base real, no seguir.
        if db.DB_CONFIG["dbname"] != BD_PRUEBAS:
            raise unittest.SkipTest(
                f"La app ya apunta a '{db.DB_CONFIG['dbname']}'. Ejecute este archivo solo: python -m unittest tests.test_carga"
            )
        if not (FIXTURES / "01_valido.xlsx").exists():
            raise unittest.SkipTest("Faltan los archivos de prueba: ejecute tests/fixtures/generar_fixtures.py")
        with psycopg.connect(db.get_conninfo(dbname="postgres"), autocommit=True) as admin:
            admin.execute(f'DROP DATABASE IF EXISTS "{BD_PRUEBAS}" WITH (FORCE);')
        cls.client = TestClient(app)
        cls.client.__enter__()  # arranca el lifespan: crea la base y el esquema

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, "client"):
            cls.client.__exit__(None, None, None)

    # ------------------------------------------------------------------ utilidades

    def subir(self, nombre: str) -> dict:
        """Sube un archivo como lo hace el frontend. TestClient ejecuta la tarea en segundo plano antes de volver."""
        with open(FIXTURES / nombre, "rb") as fh:
            r = self.client.post("/api/etl/upload", files={"archivo": (nombre, fh)})
        self.assertEqual(r.status_code, 202, r.text)
        carga = self.client.get(f"/api/etl/cargas/{r.json()['id_carga']}").json()
        self.assertNotEqual(carga["estado"], "EN_PROCESO")
        return carga

    def total_programas(self) -> int:
        return self.client.get("/api/olap/kpis").json()["total_programas"]

    def consulta(self, sql: str, *params):
        with db.get_cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def motivos(self, id_carga: int) -> set[tuple[str, str]]:
        items = self.client.get(f"/api/etl/cargas/{id_carga}/errores").json()["items"]
        return {(e["columna"], e["motivo"]) for e in items}

    # ------------------------------------------------------------------ casos

    def test_01_archivo_valido(self):
        c = self.subir("01_valido.xlsx")
        self.assertEqual(c["estado"], "EXITOSO", c["mensaje_error"])
        self.assertEqual((c["total_filas_origen"], c["filas_cargadas_hechos"], c["filas_rechazadas"]), (40, 40, 0))
        self.assertEqual(c["nombre_archivo"], "01_valido.xlsx")
        self.assertGreater(c["peso_archivo_kb"], 0)
        self.assertEqual(self.motivos(c["id_carga"]), set())
        self.assertEqual(self.total_programas(), 40)
        # Las consultas que buscan a la Universidad de Nariño la encuentran.
        self.assertTrue(self.client.get("/api/olap/cs2").json())
        self.assertTrue(any("NARIÑO" in r["nombre_institucion"] for r in self.client.get("/api/olap/cc5").json()))

    def test_02_mismo_contenido_en_csv_no_duplica(self):
        c = self.subir("02_mismos_programas.csv")
        self.assertEqual(c["estado"], "EXITOSO", c["mensaje_error"])
        self.assertEqual((c["total_filas_origen"], c["filas_rechazadas"]), (40, 0))
        self.assertEqual(self.total_programas(), 40, "volver a cargar los mismos programas no debe sumar")

    def test_03_anomalias(self):
        c = self.subir("03_con_anomalias.xlsx")
        self.assertEqual(c["estado"], "EXITOSO", c["mensaje_error"])
        # 24 filas: 20 programas + 1 duplicado + 3 sin código SNIES válido.
        self.assertEqual((c["total_filas_origen"], c["filas_cargadas_hechos"], c["filas_rechazadas"]), (24, 20, 3))
        self.assertEqual(self.total_programas(), 60)

        columnas = {col for col, _ in self.motivos(c["id_carga"])}
        self.assertEqual(columnas, {
            "numero_creditos", "numero_periodos_duracion", "fecha_registro_snies",
            "fecha_resolucion", "costo_matricula_nuevos", "codigo_snies",
        })
        textos = " | ".join(m for _, m in self.motivos(c["id_carga"]))
        for esperado in ("menor al mínimo", "mayor al máximo", "Fecha futura", "anterior a 1950",
                         "Formato de fecha no reconocido", "No es decimal", "SNIES no numérico"):
            self.assertIn(esperado, textos)

        # La fila duplicada no duplica el hecho.
        dup = self.consulta("SELECT COUNT(*) AS n FROM dw.fact_programa f JOIN dw.dim_programa p USING (sk_programa) WHERE p.codigo_snies = '990101'")
        self.assertEqual(dup[0]["n"], 1)
        # El número serial de Excel se convierte en fecha.
        serial = self.consulta("SELECT f.fecha_registro_snies::text AS d FROM dw.fact_programa f JOIN dw.dim_programa p USING (sk_programa) WHERE p.codigo_snies = '990109'")
        self.assertEqual(serial[0]["d"], "2023-11-23")
        # Los espacios sobrantes se limpian.
        nombre = self.consulta("SELECT nombre_programa FROM dw.dim_programa WHERE codigo_snies = '990110'")
        self.assertEqual(nombre[0]["nombre_programa"], "INGENIERÍA DE SISTEMAS")
        # Los valores fuera de rango quedan nulos en lugar de contaminar los promedios.
        creditos = self.consulta("SELECT f.numero_creditos FROM dw.fact_programa f JOIN dw.dim_programa p USING (sk_programa) WHERE p.codigo_snies IN ('990102', '990103')")
        self.assertEqual([r["numero_creditos"] for r in creditos], [None, None])

    def test_04_actualizacion(self):
        c = self.subir("04_actualizacion.xlsx")
        self.assertEqual(c["estado"], "EXITOSO", c["mensaje_error"])
        self.assertEqual(self.total_programas(), 63, "solo los 3 programas nuevos suman")
        costo = self.consulta("SELECT f.costo_matricula_nuevos::float AS v FROM dw.fact_programa f JOIN dw.dim_programa p USING (sk_programa) WHERE p.codigo_snies = '990001'")
        self.assertEqual(costo[0]["v"], 12_345_000)

    def test_05_vacio_falla_con_mensaje_claro(self):
        c = self.subir("05_vacio.xlsx")
        self.assertEqual(c["estado"], "ERROR")
        self.assertIn("no contiene programas válidos", c["mensaje_error"])
        self.assertEqual(self.total_programas(), 63)

    def test_06_corrupto_falla_sin_modificar_la_bodega(self):
        c = self.subir("06_corrupto.xlsx")
        self.assertEqual(c["estado"], "ERROR")
        self.assertTrue(c["mensaje_error"])
        self.assertEqual(self.total_programas(), 63)

    def test_07_otra_hoja_de_calculo_falla(self):
        c = self.subir("07_otra_hoja_de_calculo.xlsx")
        self.assertEqual(c["estado"], "ERROR")
        self.assertIn("no contiene programas válidos", c["mensaje_error"])
        self.assertEqual(self.total_programas(), 63)

    def test_08_extension_no_permitida_se_rechaza_al_subir(self):
        with open(FIXTURES / "08_formato_no_permitido.txt", "rb") as fh:
            r = self.client.post("/api/etl/upload", files={"archivo": ("08_formato_no_permitido.txt", fh)})
        self.assertEqual(r.status_code, 400)
        self.assertIn("Formato inválido", r.json()["detail"])

    def test_09_historial(self):
        cargas = self.client.get("/api/etl/cargas").json()
        self.assertEqual([c["estado"] for c in reversed(cargas)], ["EXITOSO"] * 4 + ["ERROR"] * 3)


if __name__ == "__main__":
    unittest.main()
