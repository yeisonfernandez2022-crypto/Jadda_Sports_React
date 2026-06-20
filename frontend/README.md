# Frontend - Jadda Sports Web

Tienda deportiva web construida con React 19 + TypeScript + Vite.

## Stack

- **Framework:** React 19, TypeScript
- **Build:** Vite 8
- **Routing:** React Router 7
- **Estilos:** Bootstrap 5, CSS Modules, FontAwesome
- **HTTP:** Axios
- **Auth:** @react-oauth/google, jwt-decode
- **UI:** react-icons, sweetalert2, AOS

## Estructura

```
frontend/
├── src/
│   ├── components/     # Componentes reutilizables
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── FloatingCart.tsx
│   │   ├── MiniCartMenu.tsx
│   │   └── ...
│   ├── pages/          # Páginas
│   │   ├── Principal.tsx
│   │   ├── Catalogo.tsx
│   │   ├── ProductDetailPage.tsx
│   │   ├── Login.tsx / Register.tsx
│   │   ├── Carrito.tsx
│   │   ├── CompraExitosa.tsx
│   │   ├── Pqr.tsx
│   │   └── ...
│   ├── context/        # Contextos (Auth, Cart)
│   ├── css/            # Archivos CSS
│   ├── App.tsx
│   └── main.tsx
├── public/
└── index.html
```

## Inicio rápido

```bash
pnpm install
pnpm run dev
```

Abre en `http://localhost:5173`. Requiere el backend corriendo.

## Build

```bash
pnpm build
```

Genera el bundle en `dist/`.

## Docker

Contenedor con Vite dev server. Ver `docker-compose.yml` en la raíz.
