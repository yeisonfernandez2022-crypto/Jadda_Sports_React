# Diseño T13 — Móvil UX (lote post-EAS)

**Fecha:** 2026-11-11 · **Estado:** borrador para aprobación · **Publicación:** OTA (solo JS, sin APK nueva)

## Objetivo
6 mejoras UX del app móvil (Expo SDK 54) pedidas por el usuario tras publicar la APK (T1–T12).

## Decisiones del usuario (2026-11-11)
1. **Banner:** generar 4 banners nuevos más cuadrados con IA (mockups aprobados por el usuario ANTES de subir a Cloudinary).
2. **Restyle perfil:** las 5 subpáginas (seguridad, mis compras, direcciones, editar, métodos de pago).
3. **Producto sin sesión:** «te puede interesar» = relacionados de la categoría (endpoint existente).

## Ítems

### 1. Banner de inicio más grande, sin recortes
- **Diagnóstico:** los 4 assets son 1757×380 (4.62:1) con texto/CTA en los bordes → `contain` a ancho completo = ~84px de tira; `cover` a ~200px recorta ~50% del ancho. Imposible «grande sin recortar» con estos assets.
- **Enfoque:** 4 imágenes nuevas ~3:2 generadas desde los originales (conservando productos, paleta y textos). El carrusel con paginación y puntos de `index.tsx` (ScrollView `pagingEnabled` + `onScroll` + getSize clamp 100–340) se conserva; solo cambian las URLs y el alto real (con 3:2 a lo ancho ≈ 260px, dentro del clamp).
- **Archivos:** `movil/app/(tabs)/index.tsx` (solo `BANNERS.src`).
- **Flujo:** mockups → OK del usuario → subida a `jadda/estaticos/banner-movil-1..4.png` con script temp (credenciales `backend/.env`, precede de la migración 2026-10-20) → URLs al código.

### 2. Buscador («hola» → 0 + sugerencias en vivo)
- **Diagnóstico:** el móvil pide `/api/productos?search=` (prefijo de campo) por tecla → «hola» daba 17. El web ya lo arregló (2026-11-10) con `frontend/src/utils/buscador.ts`.
- **Enfoque:** portar `buscador.ts` → `movil/utils/buscador.ts` (verbatim, sin dependencias). `Header.tsx` descarga la lista completa una vez y filtra EN VIVO con `filtrarProductos` para el dropdown; fuera el fetch `?search=`. `catalogo.tsx` reemplaza su `includes` suelto por `filtrarProductos(data, search)`. Enter → `/catalogo?search=` (igual que hoy). Sin cambios backend (el endpoint `?search=` queda sin consumidor público).

### 3. Carrito «TE PUEDE GUSTAR» en vertical con cards estándar
- **Diagnóstico:** hoy mini-cards horizontales de 150px (`RecomendadoCard`).
- **Enfoque:** grid vertical de 2 columnas con `ProductoItem` (card estándar con botón de carrito + modal de variante), excluyendo lo que ya está en el carrito. Fuente igual: favoritos → `/api/productos/recomendados` → al azar.
- **Archivos:** `movil/app/(tabs)/carrito.tsx` (fuera el uso de `RecomendadoCard`; el componente no se borra).

### 4. Inicio: ofertas primero
- Swap en `index.tsx`: sección OFERTAS arriba de PRODUCTOS. Trivial.

### 5. Perfil: subpáginas estilo web (5 páginas)
- **Diagnóstico:** hoy son listas planas sin jerarquía (seguridad 188 / compras 609 / direcciones 420 / editar 346 / metodos-pago 468 líneas).
- **Enfoque:** sistema visual compartido nuevo `movil/styles/weblike.ts` (cards blancas con sombra, headers con icono, badges de estado, botones rojo sólido / navy outline) aplicado a las 5 páginas. **Solo visual** — lógica, estados y llamadas intactas.
- **Fuera del restyle:** `perfil/devolucion/[idVenta].tsx` y `perfil/reembolso/[id].tsx`.

### 6. Producto: galería arrastrable + «te puede interesar»
- **Galería:** hoy 1 imagen + miniaturas. Nuevo: carrusel horizontal `pagingEnabled` sincronizado con miniaturas (tocar miniatura → salta; arrastrar → actualiza la activa).
- **«TE PUEDE INTERESAR»** tras las reseñas: con sesión `GET /api/productos/recomendados` (señales visto×1 / favorito×2 / comprado×3); sin sesión `GET /api/productos/:id/relacionados`. Grid 2 columnas con `ProductoItem`, excluyendo el producto actual.
- **Archivo:** `movil/app/producto/[id].tsx`.

## Fuera de alcance
- Cambios backend (ninguno).
- APK nueva (todo es OTA JS).
- Restyle de devolución/reembolso móvil.

## Verificación
- Gate: `corepack pnpm exec tsc --noEmit` en `movil/` exit 0.
- OTA: receta standing (`EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_FRONT_URL` de prod + `CI=1`, `eas update --channel preview --message "<ASCII>"`) + verificar bundles con `%TEMP%\opencode\verificar-bundle-t12.cjs`.
- Prueba del usuario: abrir la app ×2 y recorrer el checklist por ítem.
