# Jadda Sports - App Móvil

App móvil de tienda deportiva con React Native + Expo 54 + Expo Router.

## Stack

- **Framework:** React Native 0.81, Expo 54
- **Routing:** Expo Router (file-based)
- **Navegación:** React Navigation (bottom tabs, stack)
- **HTTP:** Axios
- **Íconos:** @expo/vector-icons (Ionicons)
- **Auth:** AuthContext (context API)

## Estructura

```
movil/
├── app/                    # Rutas (file-based)
│   ├── _layout.tsx         # Layout raíz (AuthProvider + Stack)
│   ├── (tabs)/
│   │   ├── _layout.tsx     # Bottom tabs layout
│   │   ├── index.tsx       # Inicio
│   │   ├── catalogo.tsx    # Catálogo
│   │   ├── carrito.tsx     # Carrito
│   │   └── perfil.tsx      # Perfil
│   ├── producto/[id].tsx   # Detalle producto
│   ├── login.tsx           # Inicio sesión
│   ├── registro.tsx        # Registro
│   └── verificar-codigo.tsx
├── components/             # Componentes compartidos
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── ProductoCard.tsx
│   └── ui/
├── context/
│   └── AuthContext.tsx      # Estado de autenticación
├── constants/
│   ├── api.ts               # Axios instance
│   └── theme.ts
└── assets/
```

## Inicio rápido

```bash
pnpm install
npx expo start
```

Escanea el QR con Expo Go o abre en emulador.

## Conexión al backend

Edita `constants/api.ts` con la IP de tu servidor backend.

## Estado actual

| Pantalla | Estado |
|----------|--------|
| Inicio | Lista |
| Catálogo | Listo (búsqueda, filtros, orden) |
| Detalle producto | Listo (galería, características) |
| Login | Listo |
| Registro | Listo |
| Carrito | Placeholder |
| Perfil | Placeholder |
| Variantes | No implementado |
| Reseñas | No implementado |
| Checkout | No implementado |
| Favoritos | No implementado |
