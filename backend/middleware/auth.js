// auth.js - middleware para verificar el token JWT

const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'papelyluna2026secreto';

function verificarToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'No autorizado. Inicia sesión primero.' });

  const token = auth.split(' ')[1]; // formato: Bearer <token>

  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

// solo dejar pasar a admins
function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden hacer esto.' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };
