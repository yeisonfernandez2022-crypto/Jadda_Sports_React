const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const ARCHIVO = path.join(__dirname, "..", "data", "newsletter.json");

fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });

const leerSuscritos = async () => {
  try {
    return JSON.parse(await readFile(ARCHIVO, "utf8"));
  } catch {
    return [];
  }
};

const guardarSuscritos = async (lista) => {
  await writeFile(ARCHIVO, JSON.stringify(lista, null, 2), "utf8");
};

/** POST /api/newsletter — Registra un correo en la lista de novedades. */
const suscribirNewsletter = async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, msg: "Correo inválido" });
  }
  try {
    const lista = await leerSuscritos();
    const normalizado = email.trim().toLowerCase();
    if (lista.some((s) => s.email === normalizado)) {
      return res.status(200).json({ ok: true, msg: "Ya estás suscrito" });
    }
    lista.push({ email: normalizado, fecha: new Date().toISOString() });
    await guardarSuscritos(lista);
    res.status(201).json({ ok: true, msg: "¡Suscripción exitosa!" });
  } catch (err) {
    console.error("Error al suscribir newsletter:", err);
    res.status(500).json({ ok: false, msg: "Error al suscribirse" });
  }
};

module.exports = { suscribirNewsletter };
