const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');

router.post('/registro', authController.registro);
router.post('/login', authController.login);
router.get('/confirmar/:token', authController.confirmarCuenta);
router.post('/recuperar-password', authController.recuperarPassword);
router.post('/update-password', authController.actualizarPassword);

// Rutas Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    const nombre = encodeURIComponent(req.user.nombre);
    res.redirect(`http://localhost:5173/principal?user=${nombre}`);
});

// Rutas FACEBOOK
router.get('/facebook', 
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login' }), 
  (req, res) => {
    const nombre = encodeURIComponent(req.user.nombre);
    res.redirect(`http://localhost:5173/principal?user=${nombre}`);
});

module.exports = router;