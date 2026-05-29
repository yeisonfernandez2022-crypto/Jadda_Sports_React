const jwt = require('jsonwebtoken');

// Tu función anterior para JWT (si la necesitas)
exports.verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send("Token requerido");

  jwt.verify(token, process.env.JWT_SECRET || "secreto", (err, decoded) => {
    if (err) return res.status(403).send("Token inválido");
    req.user = decoded;
    next();
  });
};

// NUEVA FUNCIÓN PARA PASSPORT (La que necesitamos en el carrito)
exports.verificarSesion = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ ok: false, msg: "No autorizado" });
};