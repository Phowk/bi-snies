"""Inicialización automática y garantizada de la base de datos snies_dw."""
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "snies_dw")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "1234")


def get_admin_conn():
    return psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname="postgres",
        user=DB_USER,
        password=DB_PASSWORD,
        autocommit=True
    )


def inicializar_base_de_datos():
    """Crea la base de datos snies_dw si no existe y aplica el esquema dimensional completo."""
    print(f"[*] Verificando existencia de la base de datos '{DB_NAME}'...")
    try:
        with get_admin_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (DB_NAME,))
                if not cur.fetchone():
                    print(f"[*] Creando base de datos '{DB_NAME}'...")
                    cur.execute(f'CREATE DATABASE "{DB_NAME}";')
                    print(f"[+] Base de datos '{DB_NAME}' creada con éxito.")
                else:
                    print(f"[+] Base de datos '{DB_NAME}' ya existe.")
    except Exception as e:
        print(f"[!] Error al verificar o crear la base de datos: {e}")
        raise e

    # Conectar a snies_dw y aplicar schema.sql
    ruta_schema = os.path.join(os.path.dirname(__file__), "sql", "schema.sql")
    with open(ruta_schema, "r", encoding="utf-8") as f:
        ddl = f.read()

    print(f"[*] Aplicando DDL del cubo (6 dimensiones + hechos + auditoría) en '{DB_NAME}'...")
    with psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        autocommit=True
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(ddl)
    print(f"[+] Esquema del Cubo OLAP y subsistema ETL inicializado correctamente en '{DB_NAME}'.")


if __name__ == "__main__":
    inicializar_base_de_datos()
