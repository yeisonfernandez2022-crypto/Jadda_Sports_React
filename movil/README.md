# Jadda Sports - App Móvil

App móvil de tienda deportiva con React Native + Expo 54 + Expo Router.

## Stack

- **Framework:** React Native 0.81, Expo 54
- **Routing:** Expo Router (file-based)
- **Navegación:** React Navigation (bottom tabs, stack)
- **HTTP:** Axios
- **Íconos:** @expo/vector-icons (Ionicons)
- **Auth:** AuthContext (context API) + AsyncStorage persistencia
- **API URL:** `constants/api.ts` (IP fija, editar manualmente al cambiar de red)

## Estructura

```
movil/
├── app/                    # Rutas (file-based)
│   ├── _layout.tsx         # Layout raíz (AuthProvider + Stack)
│   ├── (tabs)/
│   │   ├── _layout.tsx     # Bottom tabs layout
│   │   ├── index.tsx       # Inicio
│   │   ├── catalogo.tsx    # Catálogo
│   │   ├── carrito.tsx     # Carrito (placeholder)
│   │   └── perfil.tsx      # Perfil
│   ├── producto/[id].tsx   # Detalle producto
│   ├── login.tsx           # Inicio sesión
│   ├── registro.tsx        # Registro
│   ├── verificar-codigo.tsx
│   ├── recuperar.tsx       # Recuperar contraseña
│   └── restablecer.tsx     # Restablecer contraseña
├── components/             # Componentes compartidos
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── ProductoCard.tsx
│   └── ui/
├── context/
│   └── AuthContext.tsx      # Estado de autenticación + AsyncStorage
├── constants/
│   ├── api.ts               # Axios instance (IP fija)
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

Edita `constants/api.ts` con la IP del backend en tu red.

## Estado actual

| Pantalla | Estado |
|----------|--------|
| Inicio | Funcional |
| Catálogo | Funcional (búsqueda, filtros, orden) |
| Detalle producto | Funcional (galería, características) |
| Login | Funcional (con sesión, persistencia AsyncStorage) |
| Registro | Funcional |
| Verificar código | Funcional |
| Recuperar contraseña | Funcional (envío código + restablecer) |
| Perfil | Funcional (info usuario, cerrar sesión, config URL) |
| Carrito | Placeholder |
| Variantes | No implementado |
| Reseñas | No implementado |
| Checkout | No implementado |
| Favoritos | No implementado |
