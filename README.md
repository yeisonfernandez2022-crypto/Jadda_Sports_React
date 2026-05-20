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
```

---

## Backend

```bash
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
```

---

# ✨ Funcionalidades

- ✅ Registro de usuarios
- ✅ Inicio de sesión
- ✅ Autenticación con JWT
- ✅ Login con Google
- ✅ Login con Facebook
- ✅ Recuperación de contraseña
- ✅ Verificación mediante correo electrónico
- ✅ Catálogo de productos
- ✅ Página principal dinámica
- ✅ Backend API REST
- ✅ Protección de rutas con middleware

---

# 🔐 Autenticación

El sistema utiliza:

- JWT para autenticación segura
- Passport.js para OAuth
- Google OAuth 2.0
- Facebook OAuth

---

# 🛢️ Base de Datos

El proyecto utiliza:

```txt
MySQL
```

Conexión gestionada mediante:

```js
mysql2
```

---

# ⚙️ Instalación

## 1. Clonar el repositorio

```bash
git clone https://github.com/tuusuario/jadda-sports.git
```

---

## 2. Instalar dependencias

### Frontend

```bash
cd frontend
npm install
```

### Backend

```bash
cd backend
npm install
```

---

# ▶️ Ejecutar el Proyecto

## Frontend

```bash
npm run dev
```

## Backend

```bash
npm start
```

---

# 🔑 Variables de Entorno

Crear un archivo `.env` en el backend con variables similares a:

```env
JWT_SECRET=
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

---

# 📌 Estado del Proyecto

Actualmente el proyecto incluye autenticación y catálogo de productos.  
Próximamente se implementarán nuevas funcionalidades como:

- 🛒 Carrito de compras
- 👨‍💼 Panel administrador
- 💳 Pasarela de pagos
- ❤️ Lista de favoritos
- 📦 Gestión avanzada de productos

---

# 👨‍💻 Autor

Desarrollado por el equipo de Jadda Sports.
Yeison Fernandez
Duglas Montenegro
Miguel Castro
Juan Arias

---

# 📄 Licencia

Este proyecto es de uso educativo y de aprendizaje.
