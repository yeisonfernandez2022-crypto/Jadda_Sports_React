# 📱 JADDA SPORTS — App Móvil

> Cliente móvil de la tienda deportiva Jadda Sports. **React Native 0.81 + Expo 54 + Expo Router**, conectado a la misma API REST que la web.

![React Native](https://img.shields.io/badge/React%20Native-0.81-61dafb?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-54-000020?logo=expo&logoColor=white)
![Expo Router](https://img.shields.io/badge/Expo%20Router-File%20based-000020)

---

## 🧱 Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React Native | 0.81 | Framework nativo |
| Expo | 54 | Toolchain / SDK |
| Expo Router | 4.x | Routing basado en archivos |
| React Navigation | — | Tabs + stacks |
| Axios | — | HTTP client |
| @expo/vector-icons | — | Iconos (Ionicons) |
| AuthContext + AsyncStorage | — | Sesión persistente (`@jadda_usuario`) |

---

## 📁 Estructura

```
movil/
├── app/                    # Rutas (file-based)
│   ├── _layout.tsx         # AuthProvider + Stack raíz
│   ├── (tabs)/
│   │   ├── _layout.tsx     # Bottom tabs
│   │   ├── index.tsx       # Inicio
│   │   ├── catalogo.tsx    # Catálogo (búsqueda, filtros, orden)
│   │   ├── carrito.tsx     # Carrito
│   │   └── perfil.tsx      # Perfil (sesión, logout, config URL)
│   ├── producto/[id].tsx   # Detalle de producto (galería + variantes)
│   ├── login.tsx / registro.tsx / verificar-codigo.tsx
│   └── recuperar.tsx / restablecer.tsx
├── components/
│   ├── Header.tsx / Footer.tsx / ProductoCard.tsx
│   └── ui/
├── context/AuthContext.tsx # Sesión + AsyncStorage
├── constants/
│   ├── api.ts              # Axios instance + resolverImagen() (EXPO_PUBLIC_FRONT_URL)
│   └── theme.ts
└── assets/
```

---

## 🚀 Inicio rápido

**Móvil (único comando soportado):**
```bash
cd movil
pnpm install   # solo la primera vez, descarga dependencias
npx expo start --dev-client
```

Escanea el QR con el **APK (dev client)** en el teléfono o abre en emulador (Android/iOS).

> 💡 El QR se genera **diferente en cada arranque** — corre `npx expo start --dev-client` en `movil/` y escanea el QR de la terminal. Si no conecta por WiFi, añade `--tunnel`. Requiere `EXPO_PUBLIC_API_URL` en `movil/.env`. Para la web, usa exclusivamente `pnpm build; $env:MODE = "preview"; docker compose up` (después de `pnpm build`).

## 🔌 Conexión al backend

- La URL de la API se configura con la variable `EXPO_PUBLIC_API_URL` (ver `.env.example`).
- Para imágenes locales, `resolverImagen()` antepone `EXPO_PUBLIC_FRONT_URL` (default: `http://10.2.178.124:5173`) a las rutas `/images/...` del backend.

> ⚠️ Expo SDK 54: consulta siempre la documentación de la versión en https://docs.expo.dev/versions/v54.0.0/ antes de escribir código.

---

## 📊 Estado actual

| Pantalla | Estado |
|----------|--------|
| Inicio | ✅ Funcional |
| Catálogo | ✅ Funcional (búsqueda, filtros, orden) |
| Detalle de producto | ✅ Funcional (galería, características) |
| Login | ✅ Funcional (sesión + persistencia AsyncStorage) |
| Registro | ✅ Funcional |
| Verificar código | ✅ Funcional |
| Recuperar / restablecer contraseña | ✅ Funcional |
| Perfil | ✅ Funcional (info, cerrar sesión, config URL) |
| Carrito | 🚧 Placeholder (pendiente: carrito real, checkout) |
| Variantes / Reseñas / Favoritos | 🚧 No implementado |
