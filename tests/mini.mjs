import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require2 = createRequire(path.join(__dirname, "index.js"));

function extraerChromium(mod) {
  const m = mod?.default && mod.default.chromium ? mod.default : mod;
  return m?.chromium?.launch ? m.chromium : null;
}
async function cargarBrowser() {
  try {
    const mod = await import("playwright-core");
    const c = extraerChromium(mod);
    console.log("esm c:", typeof c?.launch);
    if (c) return { chromium: c };
  } catch (e) { console.log("esm err", String(e).slice(0,60)); }
  try {
    const require3 = createRequire(path.join(__dirname, "package.json"));
    const c = extraerChromium(require3("playwright-core"));
    console.log("cjs c:", typeof c?.launch);
    if (c) return { chromium: c };
  } catch (e) { console.log("cjs err"); }
  return { chromium: null };
}

const { chromium } = await cargarBrowser();
console.log("final launch:", typeof chromium?.launch);
if (chromium) {
  const b = await chromium.launch({ channel: "msedge", headless: true });
  console.log("LANZADO OK");
  await b.close();
}
