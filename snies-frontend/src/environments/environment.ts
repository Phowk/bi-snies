export const environment = {
  /** Prefijo de la API FastAPI. En desarrollo, proxy.conf.json lo redirige a http://localhost:8000 */
  apiUrl: '/api',
  /** true: responde con datos simulados en el navegador (sin backend). Cambiar a false cuando FastAPI esté listo. */
  useMock: true,
};
