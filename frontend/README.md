# Frontend — JADDA SPORTS Web

Aplicación web de tienda deportiva construida con React 19, TypeScript y Vite 8.

---

## Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 19 | UI components |
| TypeScript | 5.x | Tipado estático |
| Vite | 8 | Build tool / dev server |
| React Router | 7 | Enrutamiento SPA |
| Bootstrap | 5 | Estilos base |
| Axios | 1.x | HTTP client |
| SweetAlert2 | 11 | Alertas / modales |
| react-icons | 5 | Iconos vectoriales |
| FontAwesome | 6 | Iconos por CSS |
| AOS | 2 | Animaciones scroll |

---

## Estructura

```
frontend/
├── src/
│   ├── admin/                    # Panel administrativo
│   │   ├── AdminDashboard.tsx    # Dashboard con stats
│   │   ├── AdminProductos.tsx    # CRUD productos
│   │   ├── AdminOrdenes.tsx      # Gestión de órdenes
│   │   ├── AdminUsuarios.tsx     # Listado de usuarios
│   │   ├── AdminNavbar.tsx       # Navbar admin
│   │   ├── AdminFooter.tsx       # Footer admin
│   │   ├── EditarProductoAdmin.tsx
│   │   └── AdminProductoCaracteristicas.tsx
│   ├── components/               # Componentes reutilizables
│   │   ├── Navbar.tsx            # Barra de navegación principal
│   │   ├── Footer.tsx            # Footer compacto
│   │   ├── FloatingCart.tsx      # Carrito flotante (drag)
│   │   ├── MiniCartMenu.tsx      # Menú desplegable del carrito
│   │   └── ScrollToTop.tsx       # Scroll automático al navegar
│   ├── context/                  # State management
│   │   ├── AuthContext.tsx        # Autenticación (usuario, sesión)
│   │   └── CartContext.tsx        # Carrito (items, totales, CRUD)
│   ├── css/                      # Estilos globales y por página
│   ├── pages/                    # Páginas/rutas
│   │   ├── Principal.tsx         # Home con héroe, banners, categorías
│   │   ├── Catalogo.tsx          # Catálogo con búsqueda y filtros
│   │   ├── Categorias.tsx        # Navegación por categorías
│   │   ├── ProductDetailPage.tsx # Detalle del producto + reseñas
│   │   ├── Login.tsx / Register.tsx
│   │   ├── Recuperar.tsx / ResetPassword.tsx
│   │   ├── VerificarCodigo.tsx   # Confirmación de cuenta
│   │   ├── ResumenCompra.tsx     # Checkout (pago + dirección)
│   │   ├── CompraExitosa.tsx     # Post-compra (reseña, relacionados)
│   │   ├── Perfil.tsx            # Dashboard de perfil
│   │   ├── PerfilEditar.tsx      # Editar datos personales
│   │   ├── Seguridad.tsx         # Cambiar contraseña
│   │   ├── DireccionesPerfil.tsx # CRUD direcciones
│   │   ├── MisCompras.tsx        # Historial de órdenes
│   │   ├── Favoritos.tsx         # Lista de favoritos
│   │   ├── Historial.tsx         # Productos vistos
│   │   ├── Planes.tsx            # Planes de entrenamiento
│   │   ├── Retos.tsx             # Retos deportivos
│   │   ├── Pqr.tsx               # PQRS
│   │   ├── AyudaSoporte.tsx      # FAQ / soporte
│   │   └── SobreNosotros.tsx     # Información del equipo
│   ├── App.tsx                   # Layout + routing
│   └── main.tsx                  # Entry point
├── public/
│   └── index.html
```

---

## Páginas y Rutas

| Ruta | Página | Acceso |
|------|--------|--------|
| `/` | Principal | Público |
| `/catalogo` | Catálogo | Público |
| `/producto/:id` | Detalle producto | Público |
| `/categorias` | Categorías | Público |
| `/login` | Inicio de sesión | Público |
| `/registro` | Registro | Público |
| `/recuperar` | Recuperar contraseña | Público |
| `/reset-password/:token` | Reset password | Público |
| `/verificar-codigo` | Confirmar cuenta | Público |
| `/resumencompra` | Checkout | Protegido |
| `/compra-exitosa/:id` | Post-compra | Protegido |
| `/perfil` | Perfil dashboard | Protegido |
| `/perfil/seguridad` | Cambiar contraseña | Protegido |
| `/perfil/direcciones` | Direcciones | Protegido |
| `/perfil/compras` | Mis compras | Protegido |
| `/perfil/metodos-pago` | Métodos de pago (CRUD + principal) | Protegido |
| `/PerfilEditar` | Editar perfil | Protegido |
| `/favoritos` | Favoritos | Protegido |
| `/historial` | Historial | Protegido |
| `/mis-planes` | Planes entrenamiento | Protegido |
| `/retos` | Retos deportivos | Protegido |
| `/pqr` | PQRS | Protegido |
| `/ayuda_soporte` | Ayuda | Público |
| `/sobre-nosotros` | Sobre nosotros | Público |
| `/admin` | Admin dashboard | Protegida (rol admin) |
| `/admin/productos` | Admin productos | Protegida (rol admin) |
| `/admin/ordenes` | Admin órdenes | Protegida (rol admin) |
| `/admin/usuarios` | Admin usuarios | Protegida (rol admin) |
| `/admin/retos` | Admin retos (evidencias) | Protegida (rol admin) |
| `/admin/devoluciones` | Admin devoluciones | Protegida (rol admin) |
| `/admin/categorias` | Admin categorías (CRUD) | Protegida (rol admin) |
| `/admin/reportes` | Reportes y más vendidos | Protegida (rol admin) |

> \* Las rutas `/admin/*` usan `AdminRoute` en el frontend (redirige a `/` si no eres admin) y `esAdmin` en el backend (401/403).

---

## Inicio Rápido

```bash
pnpm install
pnpm run dev     # Dev server en :5173
pnpm build       # Build producción en dist/
```

Requiere el backend corriendo en `http://localhost:5000`.

---

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del backend (default: `http://localhost:5000`) |

---

## Docker

El frontend se ejecuta en un contenedor Vite dev server. Ver `docker-compose.yml` en la raíz del proyecto. Si hay errores de parseo estale, ejecutar:

```bash
docker restart jadda_frontend
```
