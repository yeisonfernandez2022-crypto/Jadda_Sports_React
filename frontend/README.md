# 🖥️ Frontend — JADDA SPORTS Web

> Tienda web de artículos deportivos: **React 19 + TypeScript + Vite 8**, con panel administrativo completo, diseño responsivo y 0 dependencias de estado externas (Context API).

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-7952b3?logo=bootstrap&logoColor=white)
![React Router](https://img.shields.io/badge/React%20Router-7-ca4245?logo=reactrouter&logoColor=white)

---

## 🧱 Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 19.2 | UI components |
| TypeScript | 5.9 | Tipado estático |
| Vite | 8.0 | Build tool / dev server |
| React Router | 7.13 | Enrutamiento SPA (rutas lazy) |
| Bootstrap | 5.3 | Estilos base |
| Axios | 1.15 | HTTP client |
| SweetAlert2 | 11 | Alertas / modales / confirmaciones |
| react-icons | 5.6 | Iconos vectoriales |
| FontAwesome | 6 | Iconos por CSS (`<i className="fas fa-...">`) |
| AOS | 2.3 | Animaciones de scroll |

---

## 📁 Estructura

```
frontend/
├── src/
│   ├── admin/                      # Panel administrativo
│   │   ├── AdminNavbar.tsx         # Sidebar oscuro con badges de pendientes
│   │   ├── AdminDashboard.tsx      # KPIs, gráfica 30 días, top 5, pendientes
│   │   ├── AdminProductos.tsx      # Tabla con búsqueda, filtro, orden, paginación
│   │   ├── EditarProductoAdmin.tsx # Editor con galería ordenable + vista previa
│   │   ├── SubirImagenes.tsx       # Subida desde PC + pegar URL + reordenar
│   │   ├── AdminOrdenes.tsx        # Órdenes con estados y factura
│   │   ├── AdminUsuarios.tsx       # Listado de usuarios
│   │   ├── AdminRetos.tsx          # Evidencias por aprobar/rechazar
│   │   ├── AdminDevoluciones.tsx   # Devoluciones por procesar
│   │   ├── AdminCategorias.tsx     # CRUD de categorías
│   │   ├── AdminReportes.tsx       # Reportes de ventas y más vendidos
│   │   ├── AdminProductoCaracteristicas.tsx
│   │   └── AdminFooter.tsx
│   ├── components/                 # Componentes reutilizables
│   │   ├── Navbar.tsx              # Navegación con mega-menú de catálogo
│   │   ├── Footer.tsx              # Footer compacto con newsletter
│   │   ├── FloatingCart.tsx        # Carrito flotante (botón fijo)
│   │   ├── MiniCartMenu.tsx        # Menú del carrito posicionado sobre el botón
│   │   ├── SelectorVarianteModal.tsx
│   │   ├── ErrorBoundary.tsx / LoadingPage.tsx
│   │   └── ScrollToTop.tsx
│   ├── context/                    # State management
│   │   ├── AuthContext.tsx         # Sesión, perfil, foto, refreshPerfil()
│   │   └── CartContext.tsx         # Carrito, totales, CRUD, sincronización
│   ├── css/                        # Estilos globales y por página
│   ├── pages/                      # Páginas públicas y de usuario
│   │   ├── Principal.tsx           # Home: héroe, categorías, recomendados
│   │   ├── Catalogo.tsx            # Filtros, búsqueda, orden, slider de precio
│   │   ├── ProductDetailPage.tsx   # Galería, variantes, aviso stock, compartir
│   │   ├── ResumenCompra.tsx       # Checkout (envío, pago, cupón)
│   │   ├── CompraExitosa.tsx       # Post-compra con reseña
│   │   ├── Perfil.tsx / PerfilEditar.tsx / Seguridad.tsx
│   │   ├── DireccionesPerfil.tsx / PerfilMetodosPago.tsx
│   │   ├── MisCompras.tsx          # Detalle 2 columnas + factura PDF
│   │   ├── Favoritos.tsx / Historial.tsx
│   │   ├── Retos.tsx               # Evidencias con subida multipart + barra de progreso
│   │   ├── Planes.tsx / Pqr.tsx / AyudaSoporte.tsx / SobreNosotros.tsx
│   │   ├── AuthModal.tsx           # Login/registro/verificación (modal)
│   │   ├── NotFound.tsx            # 404 con "Volver al inicio"
│   │   └── ErrorFallback.tsx       # "¡Oops!" con botón Reintentar
│   ├── App.tsx                     # Layout + routing + admin route guard
│   └── main.tsx                    # Entry point
├── public/
│   ├── images/productos/           # 44 carpetas Producto_NN (3 imágenes c/u)
│   ├── images/perfiles/            # Fotos de perfil (mount Docker)
│   └── images/retos/               # Evidencias de retos (mount Docker)
```

---

## 🧭 Páginas y rutas

| Ruta | Página | Acceso |
|------|--------|--------|
| `/` | Principal | Público |
| `/catalogo` | Catálogo | Público |
| `/producto/:id` | Detalle de producto | Público |
| `/categorias` | Categorías | Público |
| `/login` / `/registro` | Autenticación (modal) | Público |
| `/recuperar` / `/reset-password/:token` | Recuperar contraseña | Público |
| `/verificar-codigo` | Confirmar cuenta | Público |
| `/resumencompra` | Checkout | Protegida |
| `/compra-exitosa/:id` | Post-compra | Protegida |
| `/perfil` · `/perfil/seguridad` · `/perfil/direcciones` · `/perfil/compras` · `/perfil/metodos-pago` · `/PerfilEditar` | Perfil | Protegida |
| `/favoritos` · `/historial` · `/mis-planes` · `/retos` · `/pqr` | Secciones de usuario | Protegida |
| `/ayuda_soporte` · `/sobre-nosotros` | Información | Público |
| `/admin` | Dashboard | Admin |
| `/admin/productos` · `/admin/editar/:id` | Productos + editor | Admin |
| `/admin/ordenes` · `/admin/usuarios` | Órdenes / Usuarios | Admin |
| `/admin/retos` · `/admin/devoluciones` · `/admin/categorias` · `/admin/reportes` | Gestión | Admin |
| `/admin/caracteristicas/:idProducto` | Ficha técnica | Admin |
| `*` | NotFound (404) | Público |

> Las rutas `/admin/*` usan `AdminRoute` (redirige a `/` si no eres admin) y el backend refuerza con `esAdmin` (401/403).

---

## 🚀 Inicio rápido

```bash
pnpm install
pnpm run dev     # Dev server en :5173
pnpm build       # Build producción en dist/ (tsc -b && vite build)
```

Requiere el backend corriendo en `http://localhost:5000`. En Docker, `/api` y `/images/perfiles` se proxean al contenedor backend (`vite.config.ts`).

---

## 🔐 Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del backend (default: `http://localhost:5000`) |

---

## 🐳 Docker

El frontend corre en un contenedor Vite dev server (ver `docker-compose.yml` en la raíz). Si aparecen errores de parseo viejos (el dev server cachea):

```bash
docker restart jadda_frontend
```

> ⚠️ Las subidas de imágenes (productos, perfiles, retos) solo persisten en Docker: el backend escribe directamente en `public/images/...` vía bind-mounts.
