# ⚽ Jadda Sports

Jadda Sports es una aplicación web de tienda deportiva desarrollada con React + Vite en el frontend y Node.js + Express en el backend.  
El proyecto incluye autenticación tradicional y OAuth con Google y Facebook, manejo de JWT, recuperación de contraseña y verificación por correo electrónico.

---

# 🚀 Tecnologías Utilizadas

## Frontend
- React
- Vite
- TypeScript
- React Router DOM
- Axios
- Bootstrap
- AOS Animations
- Font Awesome
- React Icons

## Backend
- Node.js
- Express
- MySQL
- JWT (JSON Web Token)
- Passport.js
- OAuth Google
- OAuth Facebook
- Nodemailer
- Bcrypt
- Express Session

---

# 📂 Estructura del Proyecto

## Frontend

```bash
frontend/
│
├── public/
├── src/
│   ├── components/
│   │   └── Navbar.tsx
│   │
│   ├── css/
│   │   ├── catalogo.css
│   │   ├── Login.css
│   │   ├── Register.css
│   │   ├── principal.css
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── Catalogo.tsx
│   │   ├── Login.tsx
│   │   ├── Principal.tsx
│   │   ├── Register.tsx
│   │   ├── Recuperar.tsx
│   │   ├── ResetPassword.tsx
│   │   └── VerificarCodigo.tsx
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── package.json
└── vite.config.ts

backend/
│
├── config/
│   ├── db.js
│   ├── mailer.js
│   └── passport.js
│
├── controllers/
│   ├── authController.js
│   └── productoController.js
│
├── middlewares/
│   └── authMiddleware.js
│
├── routes/
│   ├── authRoutes.js
│   └── productoRoutes.js
│
├── server.js
└── package.json
