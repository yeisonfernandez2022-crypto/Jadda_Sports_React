# 📱 Documentación — App Móvil JADDA SPORTS

> Documentación del cliente móvil (React Native 0.81 + Expo 54 + Expo Router). Consume la **misma API REST y base de datos (TiDB Cloud)** que la web — no hay lógica de negocio duplicada: todo cálculo, estado y stock viven en el backend.

---

## Índice

| Documento | Contenido |
|-----------|-----------|
| [`RFs-movil.md`](RFs-movil.md) | RFs implementados en móvil: cobertura completa (tabla), detalle de los 12 principales y bloques compactos del resto + **pendientes específicos** (corte 2026-11-11) |

---

## Stack

| Tecnología | Uso |
|-----------|-----|
| React Native 0.81 + Expo 54 (Expo Router, file-based) | Navegación por archivos con bottom tabs |
| Axios | HTTP client (instancia con cookie de sesión del backend) |
| AsyncStorage (`@jadda_usuario`) | Sesión persistente (AuthContext restaura + `refreshPerfil()`) |
| Contextos | `AuthContext` · `CartContext` · `FavoritosContext` · `AvisoLoginContext` (toast «Iniciar sesión») |
| `movil/utils/buscador.ts` | Búsqueda unificada client-side (port del util web) |
| `movil/styles/weblike.ts` | Tokens de diseño JADDA (navy/rojo/fondo, radios) |

---

## Estructura

```
movil/
├── app/                    # Rutas (Expo Router)
│   ├── (tabs)/             # Bottom tabs: index · catalogo · carrito · favoritos · perfil
│   ├── producto/[id].tsx   # Detalle (carrusel arrastrable, variantes, reseñas, TE PUEDE INTERESAR)
│   ├── checkout.tsx · compra-exitosa.tsx
│   ├── login · registro · verificar-codigo · recuperar · restablecer
│   ├── perfil/             # editar · seguridad · compras · direcciones · metodos-pago · devolucion · reembolso
│   ├── retos.tsx · mis-planes.tsx · chat/[id].tsx · ser-vendedor.tsx
│   ├── vendedor/           # index · productos · nuevo · editar/[id] · ventas · ordenes · devoluciones · reportes · tienda · chats
│   └── contacto · pqr · ayuda-soporte · sobre-nosotros · preguntas-frecuentes · legal
├── components/             # Header · ProductoItem · BellNotificaciones · AvisoLogin · Footer
├── context/ · hooks/ · utils/ · styles/ · constants/
└── docs/                   # Esta documentación
```

---

## Cómo correr (desarrollo)

```bash
cd movil
pnpm install                     # solo la primera vez
npx expo start --dev-client      # escanea el QR con el APK dev-client del teléfono
```

- Si no conecta por WiFi añade `--tunnel`.
- El backend debe estar accesible desde el teléfono (`EXPO_PUBLIC_API_URL`); en LAN típica: `http://<IP-del-PC>:5000`.
- Verificación de tipos: `corepack pnpm exec tsc --noEmit` (exit 0 esperado).

## Producción / OTA (EAS)

- Builds con **EAS Build**; actualizaciones JS sin store con **`eas update --channel preview`** (los bundles quedan en `movil/dist/`).
- URLs públicas fijas en `movil/.env.production`: `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_FRONT_URL` (apuntan a los servicios de Render) — no contienen secretos.

---

## Variables de entorno (`movil/.env`, gitignoreado)

| Variable | Uso |
|----------|-----|
| `EXPO_PUBLIC_API_URL` | URL del backend (dev: LAN; prod: `https://jadda-backend.onrender.com`) |
| `EXPO_PUBLIC_FRONT_URL` | URL del frontend web (para resolver imágenes `/images/...`) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Client ID de Google para el login social |

> Placeholder en `movil/.env.example`; valores reales nunca en el repo. La BD ya no se configura desde la app: vive en TiDB Cloud detrás del backend.

---

## Estado rápido

- ✅ Tienda completa: catálogo/buscador unificado · producto con carrusel arrastrable · carrito + checkout (4 métodos propios + cupones) · favoritos · perfil weblike con subpáginas · devoluciones/reembolsos · retos (ver/unirse) · planes · notificaciones in-app · chat de devoluciones · panel de vendedor.
- ⚠️ Parciales y ❌ pendientes: tabla completa en [`RFs-movil.md`](RFs-movil.md) (reseñas-escritura, avance de retos, foto de perfil, chat de soporte, Wompi, push).
