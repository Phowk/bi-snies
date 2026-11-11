"""Prueba integral de la API FastAPI y el motor OLAP dinámico."""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class SmokeTestBackend(unittest.TestCase):

    def test_root(self):
        res = client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("en línea", res.json()["estado"].lower())

    def test_kpis(self):
        res = client.get("/api/analytics/kpis")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total_programas"], 0)
        self.assertGreater(data["total_instituciones"], 0)
        print(f"[+] Test KPIs: {data['total_programas']} programas, {data['total_instituciones']} instituciones")

    def test_metadata(self):
        res = client.get("/api/analytics/metadata")
        self.assertEqual(res.status_code, 200)
        meta = res.json()
        self.assertIn("departamento", meta["dimensions"])
        self.assertIn("total_programas", meta["metrics"])
        self.assertIn("group", meta["operations"])

    def test_presets(self):
        res = client.get("/api/analytics/presets")
        self.assertEqual(res.status_code, 200)
        presets = res.json()
        self.assertEqual(len(presets), 12)
        print(f"[+] Test Presets: {len(presets)} consultas académicas cargadas correctamente.")

    def test_query_dinamica_group(self):
        payload = {
            "operation": "group",
            "dimensions": ["nivel_formacion"],
            "metrics": ["total_programas"],
            "order_by": "total_programas",
            "order_dir": "DESC",
            "limit": 5
        }
        res = client.post("/api/analytics/query", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(len(data["data"]), 0)
        print("[+] Test Query Dinámica (Group):", data["data"][0])

    def test_query_dinamica_rollup(self):
        payload = {
            "operation": "rollup",
            "dimensions": ["region", "departamento"],
            "metrics": ["total_programas"],
            "filters": {"region": ["Pacífica"]},
            "limit": 10
        }
        res = client.post("/api/analytics/query", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(len(data["data"]), 0)
        self.assertIn("nivel_agregacion", data["data"][0])
        print("[+] Test Query Dinámica (Rollup): OK, nivel_agregacion verificado.")

    def test_pivot_dinamico(self):
        payload = {
            "row_dims": ["departamento"],
            "col_dim": "modalidad",
            "metric": "total_programas",
            "filters": {"departamento": ["Nariño", "Cauca"]},
            "limit": 5
        }
        res = client.post("/api/analytics/pivot", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("categories", data)
        self.assertGreater(len(data["rows"]), 0)
        print("[+] Test Pivot Dinámico:", data["categories"][:3])

    def test_compare_benchmarking(self):
        payload = {
            "mode": "benchmarking_institucion",
            "institucion_foco": "Nariño",
            "top_n": 5
        }
        res = client.post("/api/analytics/compare", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(len(data["data"]), 0)
        nombres = [r["nombre_institucion"] for r in data["data"]]
        self.assertTrue(any("NARI" in n.upper() for n in nombres))
        print("[+] Test Benchmarking:", nombres[:2])

    def test_drillthrough_json(self):
        payload = {
            "filters": {"departamento": ["Nariño"]},
            "page": 1,
            "page_size": 3,
            "format": "json"
        }
        res = client.post("/api/analytics/drillthrough", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total_items"], 0)
        self.assertEqual(len(data["items"]), 3)
        print("[+] Test Drillthrough JSON:", data["items"][0]["nombre_programa"])

    def test_filter_options(self):
        payload = {
            "target_dim": "departamento",
            "active_filters": {"region": ["Pacífica"]}
        }
        res = client.post("/api/analytics/filter-options", json=payload)
        self.assertEqual(res.status_code, 200)
        deptos = res.json()
        self.assertIn("Nariño", deptos)
        print("[+] Test Filtros en Cascada:", deptos)


if __name__ == "__main__":
    unittest.main()
