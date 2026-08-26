# Resultados de mediciones de rendimiento (RNF)

- **Fecha:** 2026-08-24 12:30:47
- **Entorno:** Windows local con Docker Desktop; frontend Vite preview/dev (:5173) y backend Express (:5000)
- **Metodo:** 10 peticiones por endpoint tras 1 calentamiento; tiempos en milisegundos medidos con Stopwatch

| Endpoint | Muestras | Promedio (ms) | Min (ms) | P95 (ms) | Max (ms) |
|----------|----------|---------------|----------|----------|----------|
| GET / (frontend HTML) | 10 | 19.7 | 15.6 | 28.8 | 28.8 |
| GET /api/productos (catalogo) | 10 | 39.6 | 34.3 | 51.2 | 51.2 |
| GET /api/productos/1 (detalle) | 10 | 23 | 18.1 | 29.9 | 29.9 |
| GET /api/productos/categorias | 10 | 20.4 | 17.5 | 29.2 | 29.2 |
| POST /api/auth/login | 10 | 91.5 | 5.2 | 147.3 | 147.3 |
| GET /api/auth/perfil (autenticado) | 10 | 23.7 | 19.2 | 34 | 34 |

