/**
 * Transforma los seeds de backend/database/setup.js de rutas locales (/images/...)
 * a URLs Cloudinary usando la BD dev viva como fuente de verdad.
 *  - PRODUCTO_IMAGENES: /images/productos/Producto_NN/img_K.ext -> URL viva por (ID,ORDEN)
 *  - RETO_EVIDENCIAS / DEVOLUCIONES_EVIDENCIAS seeds demo -> NULL (los archivos demo no existen)
 *  - USUARIOS foto_url del admin -> URL viva del TSV de la foto
 * Aborta SIN escribir si alguna línea no encaja.
 *
 * Uso:
 *   node scripts/migracion-cloudinary/transformar-seeds.js [ruta-setup] [tsv-productos] [tsv-foto]
 * Default: backend/database/setup.js del repo y TSVs en %TEMP%\opencode
 * (ver scripts/migracion-cloudinary/README.md para generarlos).
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const SETUP = process.argv[2] || path.join(RAIZ, 'backend', 'database', 'setup.js');
const TEMP = process.env.TEMP || 'C:/Users/Yeison/AppData/Local/Temp';
const TSV = process.argv[3] || path.join(TEMP, 'opencode', 'imag-producto.tsv');
const TSV_ADMIN = process.argv[4] || path.join(TEMP, 'opencode', 'foto-admin.tsv');

// --- datos ---
const producto = new Map(); // `${id}:${orden}` -> url
for (const linea of fs.readFileSync(TSV, 'utf8').split('\n').slice(1)) {
  const [id, orden, url] = linea.replace(/\r$/, '').split('\t');
  if (!id || !url) continue;
  producto.set(`${Number(id)}:${Number(orden)}`, url);
}
const fotoAdmin = fs.readFileSync(TSV_ADMIN, 'utf8').split('\n')[1].split('\t')[1].trim();
console.log(`map producto: ${producto.size} entradas; foto admin: ${fotoAdmin.slice(0, 70)}...`);

let contenido = fs.readFileSync(SETUP, 'utf8');
const lineas = contenido.split(/\r?\n/);
let productosOk = 0;
let omitidos = 0;
let retosNull = 0;
let devolNull = 0;
let fotoOk = 0;
const errores = [];

for (let i = 0; i < lineas.length; i++) {
  const l = lineas[i];

  // PRODUCTO_IMAGENES: (ID,PROD,'/images/productos/Producto_01/img_1.jpg',1),
  // Los seeds demo usan imagen_K.ext y ids de 3 dígitos (Producto_100..).
  const mProd = l.match(/^\((\d+),(\d+),'(\/images\/productos\/Producto_(\d{2,3})\/(?:img|imagen)_(\d)\.\w+)',(\d+)\)[,;]$/);
  if (mProd) {
    const id = Number(mProd[2]);
    const orden = Number(mProd[5]);
    const url = producto.get(`${id}:${orden}`);
    if (!url) {
      if (id >= 45) {
        // Producto DEMO: la BD viva tampoco tiene esa imagen (el archivo nunca
        // existió) → omitir la fila para quedar idéntico al estado real.
        lineas[i] = null;
        omitidos++;
        continue;
      }
      errores.push(`L${i + 1}: sin URL viva para producto ${id} orden ${orden} — ${l.slice(0, 80)}`);
      continue;
    }
    const esUltima = l.endsWith(';');
    lineas[i] = `(${mProd[1]},${mProd[2]},'${url}',${mProd[6]})${esUltima ? ';' : ','}`;
    productosOk++;
    continue;
  }

  if (l.includes('INSERT IGNORE INTO RETO_EVIDENCIAS') && l.includes("'/images/")) {
    const nuevo = l.replace(/,'imagen','\/images\/[^']*'/, ",'imagen',NULL");
    if (nuevo === l) {
      errores.push(`L${i + 1}: RETO con /images/ no encaja: ${l.slice(0, 110)}`);
      continue;
    }
    lineas[i] = nuevo;
    retosNull++;
    continue;
  }

  if (l.includes('INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS') && l.includes("'/images/")) {
    const nuevo = l.replace(/,'imagen','\/images\/[^']*'/, ",'imagen',NULL");
    if (nuevo === l) {
      errores.push(`L${i + 1}: DEVOL con /images/ no encaja: ${l.slice(0, 110)}`);
      continue;
    }
    lineas[i] = nuevo;
    devolNull++;
    continue;
  }

  if (l.startsWith('INSERT IGNORE INTO USUARIOS ') && l.includes("'/images/")) {
    const nuevo = l.replace("'/images/usuarios/admin_admin/perfil/perfil.png'", `'${fotoAdmin}'`);
    if (nuevo === l) {
      errores.push(`L${i + 1}: USUARIO con /images/ no encaja: ${l.slice(0, 110)}`);
      continue;
    }
    lineas[i] = nuevo;
    fotoOk++;
    continue;
  }
}

if (errores.length) {
  console.error('ERRORES (abortando sin escribir):');
  for (const e of errores) console.error(' ' + e);
  process.exit(1);
}

fs.writeFileSync(SETUP, lineas.filter((x) => x !== null).join('\n'), 'utf8');
const porLinea = (fs.readFileSync(SETUP, 'utf8').split('\n').findIndex((x) => x.includes("/images/")) + 1) || -1;
const nube = (fs.readFileSync(SETUP, 'utf8').match(/cloudinary/g) || []).length;
console.log(
  `productos: ${productosOk} · omitidas: ${omitidos} · reto->NULL: ${retosNull} · ` +
  `devol->NULL: ${devolNull} · foto admin: ${fotoOk} · menciones cloudinary: ${nube} · ` +
  `quedan /images/ en líneas: ${porLinea < 0 ? 'ninguna' : porLinea}`
);
