## Para que la conexión a la base de datos sea exitosa, es necesario crear un archivo .env en la carpeta backend con las siguientes líneas:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=snies_dw
DB_USER=postgres
DB_PASSWORD=[Contraseña de PostgreSQL local]
DB_MIN_CONN=1
DB_MAX_CONN=10
API_HOST=localhost
API_PORT=8000
CORS_ORIGINS=*
```
