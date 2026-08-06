const db = require("../config/db");
(async () => {
  const [cnt] = await db.query("SELECT SUM(URL_IMAGEN LIKE '/images/%') AS locales, SUM(URL_IMAGEN NOT LIKE '/images/%') AS externas, COUNT(*) AS total FROM PRODUCTO_IMAGENES");
  console.log("IMAGENES:", JSON.stringify(cnt[0]));
  const [p45] = await db.query("SELECT * FROM PRODUCTOS WHERE ID = 45");
  console.log("Producto 45 existe:", p45.length > 0 ? "SÍ" : "NO");
  const [v45] = await db.query("SELECT * FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = 45");
  console.log("Variantes 45:", v45.length);
  const [m1] = await db.query("SELECT URL_IMAGEN FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = 1 ORDER BY ORDEN");
  console.log("Prod 1:", m1.map(x => x.URL_IMAGEN).join(" | "));
  const [m2] = await db.query("SELECT URL_IMAGEN FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = 2 ORDER BY ORDEN");
  console.log("Prod 2:", m2.map(x => x.URL_IMAGEN).join(" | "));
  process.exit(0);
})().catch(e => { console.error("ERR", e.message); process.exit(1); });