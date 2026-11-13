/**
 * cobertura-combinada.mjs — Fusiona la cobertura de las DOS suites backend
 * (unitarias con mocks + integración con MySQL real) y aplica el umbral de
 * cobertura sobre el total.
 *
 * Por qué existe: los controladores de JADDA se ejercitan de verdad en la
 * suite de integración (supertest + MySQL real); medir solo las unitarias
 * dejaría ese código fuera del denominador. El CI corre ambas suites con
 * cobertura (JSON istanbul) y este script las fusiona y verifica el umbral.
 *
 * Uso: node scripts/cobertura-combinada.mjs [umbral]   (default 80)
 *
 * Salida: tabla por carpeta + totales; exit 1 si el umbral no se cumple en
 * statements/branches/functions/lines.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const UMbral = Number(process.argv[2] || process.env.COBERTURA_UMBRAL || 80);

function cargar(rutaRelativa, etiqueta) {
  const ruta = join(RAIZ, rutaRelativa);
  if (!existsSync(ruta)) {
    console.error(`✗ No existe el reporte de cobertura de ${etiqueta}: ${rutaRelativa}`);
    console.error('  Corre primero la suite correspondiente con --coverage.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

const unit = cargar('coverage/coverage-final.json', 'unitarias');
const integracion = cargar('coverage-integration/coverage-final.json', 'integración');

// Los archivos compartidos tienen la MISMA instrumentación (maps idénticos
// para el mismo código fuente): la fusión suma los contadores por clave.
const archivos = new Map();
let divergencias = 0;

function registrar(data, etiqueta) {
  for (const [ruta, v] of Object.entries(data)) {
    const previo = archivos.get(ruta);
    if (!previo) {
      archivos.set(ruta, JSON.parse(JSON.stringify(v)));
      continue;
    }
    const misma = JSON.stringify(previo.statementMap) === JSON.stringify(v.statementMap)
      && JSON.stringify(previo.fnMap) === JSON.stringify(v.fnMap)
      && JSON.stringify(previo.branchMap) === JSON.stringify(v.branchMap);
    if (!misma) {
      divergencias += 1;
      console.error(`⚠ Instrumentación divergente en ${ruta} (${etiqueta}) — se conservan los máximos por clave.`);
      for (const clave of ['s', 'f', 'b']) {
        const a = previo[clave] || {};
        const bb = v[clave] || {};
        for (const id of new Set([...Object.keys(a), ...Object.keys(bb)])) {
          if (clave === 'b') {
            const va = Array.isArray(a[id]) ? a[id] : [];
            const vb = Array.isArray(bb[id]) ? bb[id] : [];
            previo[clave][id] = va.map((x, i) => Math.max(x, vb[i] ?? 0));
          } else {
            previo[clave][id] = Math.max(a[id] ?? 0, bb[id] ?? 0);
          }
        }
      }
      continue;
    }
    for (const clave of ['s', 'f', 'b']) {
      const a = previo[clave] || {};
      const bb = v[clave] || {};
      for (const id of Object.keys(bb)) {
        if (clave === 'b') {
          const va = Array.isArray(a[id]) ? a[id] : [];
          const vb = Array.isArray(bb[id]) ? bb[id] : [];
          previo[clave][id] = va.map((x, i) => x + (vb[i] ?? 0));
        } else {
          previo[clave][id] = (a[id] ?? 0) + (bb[id] ?? 0);
        }
      }
    }
  }
}

registrar(unit, 'unitarias');
registrar(integracion, 'integración');

if (divergencias > 0) {
  console.error(`⚠ ${divergencias} archivo(s) con instrumentación divergente (revisar).`);
}

// Totales y desglose por carpeta
const total = { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
const carpetas = new Map();

for (const v of archivos.values()) {
  const st = Object.values(v.s || {});
  const fn = Object.values(v.f || {});
  const br = Object.values(v.b || {}).flat();
  const lineas = new Set();
  for (const loc of Object.values(v.statementMap || {})) {
    const ini = loc.start?.line ?? 0;
    const fin = loc.end?.line ?? ini;
    for (let l = ini; l <= fin; l += 1) lineas.add(l);
  }
  const sCov = st.filter((x) => x > 0).length;
  const fCov = fn.filter((x) => x > 0).length;
  const bCov = br.filter((x) => x > 0).length;
  const norm = (ruta) => ruta.replace(/\\/g, '/').replace(/^.*\/backend\//, '');
  const ruta = norm(v.path);
  const carpeta = ruta.split('/').slice(0, 2).join('/'); // p.ej. controllers/…
  const c = carpetas.get(carpeta) || { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
  c.statements[0] += sCov; c.statements[1] += st.length;
  c.functions[0] += fCov; c.functions[1] += fn.length;
  c.branches[0] += bCov; c.branches[1] += br.length;
  c.lines[0] += [...lineas].filter((l) => Object.values(v.s || {}).some((x, i) => x > 0 && ((v.statementMap[i]?.start?.line ?? -1) === l))).length;
  carpetas.set(carpeta, c);
}

// Recalcular líneas por carpeta de forma consistente (por statement map global)
const carpetasLineas = new Map();
for (const v of archivos.values()) {
  const norm = (ruta) => ruta.replace(/\\/g, '/').replace(/^.*\/backend\//, '');
  const carpeta = norm(v.path).split('/').slice(0, 2).join('/');
  const porLinea = new Map();
  for (const [id, loc] of Object.entries(v.statementMap || {})) {
    const ini = loc.start?.line ?? 0;
    const fin = loc.end?.line ?? ini;
    const cubierto = (v.s?.[id] ?? 0) > 0;
    for (let l = ini; l <= fin; l += 1) {
      porLinea.set(l, Math.max(porLinea.get(l) ?? 0, cubierto ? 1 : 0));
    }
  }
  const c = carpetasLineas.get(carpeta) || { cov: 0, tot: 0 };
  c.cov += [...porLinea.values()].filter(Boolean).length;
  c.tot += porLinea.size;
  carpetasLineas.set(carpeta, c);
}

for (const v of archivos.values()) {
  const st = Object.values(v.s || {});
  const fn = Object.values(v.f || {});
  const br = Object.values(v.b || {}).flat();
  total.statements[0] += st.filter((x) => x > 0).length; total.statements[1] += st.length;
  total.functions[0] += fn.filter((x) => x > 0).length; total.functions[1] += fn.length;
  total.branches[0] += br.filter((x) => x > 0).length; total.branches[1] += br.length;
}

const lineasTotales = { cov: 0, tot: 0 };
for (const c of carpetasLineas.values()) { lineasTotales.cov += c.cov; lineasTotales.tot += c.tot; }

const pct = ([c, t]) => (t === 0 ? 100 : (100 * c) / t);
const fmt = ([c, t]) => `${pct([c, t]).toFixed(2).padStart(6)}% (${String(c).padStart(4)}/${String(t).padStart(4)})`;

console.log('\n===== Cobertura combinada backend (unitarias + integración) =====');
const orden = [...carpetas.keys()].sort();
for (const carpeta of orden) {
  const c = carpetas.get(carpeta);
  const l = carpetasLineas.get(carpeta) || { cov: 0, tot: 0 };
  console.log(
    `${carpeta.padEnd(30)} st ${fmt(c.statements)} | br ${fmt(c.branches)} | fn ${fmt(c.functions)} | líneas ${fmt([l.cov, l.tot])}`,
  );
}
console.log('-----------------------------------------------------------------');
console.log(`TOTAL backend      st ${fmt(total.statements)} | br ${fmt(total.branches)} | fn ${fmt(total.functions)} | líneas ${fmt([lineasTotales.cov, lineasTotales.tot])}`);
console.log(`Umbral exigido: ${UMbral}% en statements/branches/functions/lines\n`);

const fallas = [];
if (pct(total.statements) < UMbral) fallas.push(`statements ${pct(total.statements).toFixed(2)}%`);
if (pct(total.branches) < UMbral) fallas.push(`branches ${pct(total.branches).toFixed(2)}%`);
if (pct(total.functions) < UMbral) fallas.push(`functions ${pct(total.functions).toFixed(2)}%`);
if ((100 * lineasTotales.cov) / lineasTotales.tot < UMbral) fallas.push(`lines ${((100 * lineasTotales.cov) / lineasTotales.tot).toFixed(2)}%`);

if (fallas.length > 0) {
  console.error(`✗ COBERTURA INSUFICIENTE: ${fallas.join(' · ')}`);
  process.exit(1);
}
console.log('✓ Umbral de cobertura cumplido.');
