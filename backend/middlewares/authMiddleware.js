const jwt = require('jsonwebtoken');

exports.verificarToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send("Token requerido");

  jwt.verify(token, process.env.JWT_SECRET || "secreto", (err, decoded) => {
    if (err) return res.status(403).send("Token inválido");
    req.user = decoded;
    next();
  });
};