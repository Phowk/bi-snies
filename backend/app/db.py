"""Gestión de configuración y pool de conexiones PostgreSQL con psycopg 3."""
import os
from contextlib import contextmanager
from typing import Generator
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "snies_dw"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "1234"),
}

_pool: ConnectionPool | None = None


def get_conninfo(dbname: str | None = None) -> str:
    db = dbname or DB_CONFIG["dbname"]
    return (
        f"host={DB_CONFIG['host']} "
        f"port={DB_CONFIG['port']} "
        f"dbname={db} "
        f"user={DB_CONFIG['user']} "
        f"password={DB_CONFIG['password']}"
    )


def asegurar_base_de_datos() -> None:
    """Verifica y crea automáticamente la base de datos y esquemas del cubo si no existen."""
    try:
        # 1. Verificar si la BD existe
        with psycopg.connect(get_conninfo(dbname="postgres"), autocommit=True) as admin_conn:
            with admin_conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (DB_CONFIG["dbname"],))
                if not cur.fetchone():
                    print(f"[*] Base de datos '{DB_CONFIG['dbname']}' no existe. Creándola...")
                    cur.execute(f'CREATE DATABASE "{DB_CONFIG["dbname"]}";')
                    print(f"[+] Base de datos '{DB_CONFIG['dbname']}' creada.")

        # 2. Aplicar schema.sql si las tablas no existen
        with psycopg.connect(get_conninfo(), autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'dw' AND table_name = 'fact_programa';
                """)
                if not cur.fetchone():
                    print("[*] Inicializando tablas del Cubo OLAP y esquemas (staging, dw, audit)...")
                    base_dir = os.path.dirname(os.path.dirname(__file__))
                    schema_path = os.path.join(base_dir, "sql", "schema.sql")
                    with open(schema_path, "r", encoding="utf-8") as f:
                        ddl = f.read()
                    cur.execute(ddl)
                    print("[+] Estructuras del Cubo y miembros desconocidos (-1) creados con éxito.")
    except Exception as e:
        print(f"[!] Error en auto-inicialización de la base de datos: {e}")
        raise e


def init_pool(min_size: int = 1, max_size: int = 10) -> ConnectionPool:
    global _pool
    asegurar_base_de_datos()
    if _pool is None or _pool.closed:
        _pool = ConnectionPool(
            conninfo=get_conninfo(),
            min_size=min_size,
            max_size=max_size,
            open=True,
            kwargs={"row_factory": dict_row}
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None and not _pool.closed:
        _pool.close()
        _pool = None


import atexit
atexit.register(close_pool)


def get_raw_connection():
    """Retorna una conexión directa con row_factory dict_row."""
    asegurar_base_de_datos()
    return psycopg.connect(get_conninfo(), row_factory=dict_row)


@contextmanager
def get_cursor(commit: bool = False) -> Generator:
    """Provee un cursor con dict_row desde el pool."""
    pool = init_pool()
    conn = pool.getconn()
    try:
        cur = conn.cursor()
        try:
            yield cur
            if commit:
                conn.commit()
        finally:
            cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


@contextmanager
def get_tx() -> Generator:
    """Provee una conexión con transacción garantizada."""
    pool = init_pool()
    conn = pool.getconn()
    try:
        with conn.transaction():
            yield conn
    finally:
        pool.putconn(conn)
