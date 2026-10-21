/*
 * Prueba de carga con k6 — JADDA SPORTS (fase 3: O-3 / ESC-2 / MC-12).
 *
 * Escenario: navegación pública (catálogo) con usuarios concurrentes.
 * Endpoint mix con pesos ~reales de la SPA: catálogo + categorías + detalle.
 *
 * Cómo correrlo (el backend NO necesita cambios; la sonda /health queda fuera):
 *
 *   docker run --rm -v "<ruta-del-repo>/scripts:/scripts" -e BASE_URL=http://host.docker.internal:5000 grafana/k6:latest run /scripts/prueba-carga.js
 *
 * Windows PowerShell (repo Jadda_Sports_React):
 *   docker run --rm -v "C:\Users\sena\Jadda_Sports_React\scripts:/scripts" -e BASE_URL=http://host.docker.internal:5000 grafana/k6:latest run /scripts/prueba-carga.js
 *
 * NAT de Docker Desktop: las peticiones llegan al backend con una IP privada
 * (173.x/192.168.65.x del bridge) — el límite global por IP las tiene como
 * exentas locales, así que la prueba mide la aplicación y no el techo 429.
 *
 * Umbrales (ciclo de vida: se declaran ANTES de correr y se miden, no se
 * inventan): p95 del catálogo < 500 ms y errores < 2 % en el host de desarrollo.
 * El valor absoluto depende del hardware del host (documentado en
 * docs/calidad/resultados-mediciones.md §2) — sirve como línea base interna,
 * NO como garantía universal.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:5000';

export const options = {
  // O-3: la línea base se reporta en p50/p95/p99 (summaryTrendStats) para los
  // tres subconjuntos que importan (totales y por endpoint).
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    navegacion_publica: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 5 },  // rampa de entrada
        { duration: '30s', target: 5 },  // meseta: 5 usuarios navegando
        { duration: '5s', target: 0 },   // drenaje
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],          // menos del 2 % de errores
    'http_req_duration{endpoint:catalogo}': ['p(95)<500'],  // catálogo p95 < 500 ms
    'http_req_duration{endpoint:detalle}': ['p(95)<300'],
  },
};

function etiqueta(t) { return { headers: {}, tags: { endpoint: t } }; }

export default function () {
  // 1) Catálogo (la más pesada del sistema: GROUP BY + subconsultas)
  const catalogo = http.get(`${BASE_URL}/api/productos`, etiqueta('catalogo'));
  // 2) Detalle de un producto al azar (1..44 sembrados)
  const id = Math.floor(Math.random() * 40) + 1;
  const detalle = http.get(`${BASE_URL}/api/productos/${id}`, etiqueta('detalle'));
  // 3) Categorías (cacheable, ligera)
  const categorias = http.get(`${BASE_URL}/api/productos/categorias`, etiqueta('categorias'));

  check(catalogo, { 'catálogo 200': (r) => r.status === 200 });
  check(detalle, { 'detalle 200 o 404 si el id no existe': (r) => r.status === 200 || r.status === 404 });
  check(categorias, { 'categorías 200': (r) => r.status === 200 });

  // Pausa entre "páginas vistadas" (navegación realista de un visitante)
  sleep(0.5);
}
