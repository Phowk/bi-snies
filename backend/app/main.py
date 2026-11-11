"""Punto de entrada de la API FastAPI para el Sistema ETL & Analítica SNIES."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import close_pool, init_pool
from app.routers import analytics, etl


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización del pool de base de datos
    init_pool()
    yield
    # Cierre ordenado de conexiones
    close_pool()


app = FastAPI(
    title="API Sistema ETL & Cubo OLAP SNIES",
    description=(
        "Backend para el procesamiento analítico y carga automática de la bodega de datos de "
        "programas académicos del SNIES (Universidad de Nariño - Inteligencia de Negocios 2026)."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# Configuración de CORS
origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers
app.include_router(etl.router)
app.include_router(analytics.router)


@app.get("/", tags=["General"])
def root():
    return {
        "sistema": "Sistema ETL y Cubo OLAP SNIES - Universidad de Nariño",
        "estado": "En línea",
        "documentacion": "/docs",
        "version": "1.0.0"
    }
