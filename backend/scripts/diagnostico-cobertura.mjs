// Diagnóstico: top archivos con más statements/branches sin cubrir (combinado)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const fusionar = (ruta) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));
const archivos = new Map();
for (const data of [fusionar('coverage/coverage-final.json'), fusionar('coverage/integration/coverage-final.json')]) {
  for (const [ruta, v] of Object.entries(data)) {
    const previo = archivos.get(ruta);
    if (!previo) { archivos.set(ruta, JSON.parse(JSON.stringify(v))); continue; }
    for (const clave of ['s', 'f', 'b']) {
      for (const id of Object.keys(v[clave] || {})) {
        if (clave === 'b') {
          const a = previo[clave][id] || [], b = v[clave][id] || [];
          previo[clave][id] = a.map((x, i) => Math.max(x, b[i] ?? 0));
        } else previo[clave][id] = Math.max(previo[clave][id] ?? 0, v[clave][id] ?? 0);
      }
    }
  }
}
const filas = [];
for (const v of archivos.values()) {
  const st = Object.values(v.s || {}), fn = Object.values(v.f || {}), br = Object.values(v.b || {}).flat();
  filas.push({
    file: v.path.replace(/\\/g, '/').replace(/^.*\/backend\//, ''),
    stU: st.filter((x) => x === 0).length,
    brU: br.filter((x) => x === 0).length,
    fnU: fn.filter((x) => x === 0).length,
  });
}
filas.sort((a, b) => (b.stU * 2 + b.brU) - (a.stU * 2 + a.brU));
let ts = 0, tb = 0;
for (const f of filas.slice(0, 30)) {
  ts += f.stU; tb += f.brU;
  console.log(`st ${String(f.stU).padStart(4)} br ${String(f.brU).padStart(4)} fn ${String(f.fnU).padStart(3)} | ${f.file}`);
}
console.log(`\nTotal sin cubrir (top 30): st ${ts} br ${tb}`);
