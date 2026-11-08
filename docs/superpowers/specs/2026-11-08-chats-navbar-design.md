# Diseño — Bloque CHAT en el menú del navbar (2026-11-08)

## Objetivo
El menú del navbar muestra un bloque de chats con **fichas «Todos» / «No leídos»**, una **mini lista de conversaciones recientes** y al fondo el hipervínculo **«Ver todos los chats →»** que lleva a la página de chats.

## Dónde (reemplaza la fila "Mis chats" que hoy existe)
- **Escritorio**: dropdown del avatar, rama de **cliente** — reemplaza el `<Link to="/chats">Mis chats</Link>` con badge (`Navbar.tsx` L497-500).
- **Móvil**: panel hamburguesa, sección «Mi cuenta» — reemplaza la fila equivalente (`Navbar.tsx` L570-572).
- Las ramas **admin/vendedor** del dropdown y del panel móvil NO se tocan (nunca tuvieron esa fila; sus chats viven en el badge de su propia sidebar).

## Datos
- `GET /api/chat/conversaciones` (credentials include) **al abrir** el menú (dropdown o panel móvil) y cada 15 s mientras está abierto; un solo `useEffect` con `isMenuOpen || movilAbierto`.
- Shape de fila (mismo endpoint que ChatWidget): `ID_CHAT, TIPO (SOPORTE|VENDEDOR|DEVOLUCION), NO_LEIDOS, PRODUCTO_NOMBRE, CLIENTE_NOMBRE, VENDEDOR_EMPRESA`.
- Título: réplica de `tituloDe()` de ChatWidget — SOPORTE → «Soporte JADDA»; VENDEDOR → «chat {producto} - {empresa|cliente}»; DEVOLUCION → «chat devolucion {producto} - …».
- Coherencia con la página /chats: la mini lista **excluye TIPO=DEVOLUCION** (para cliente, Chats.tsx los saca de la lista general; se abren desde la devolución).
- **Eliminado**: estado `chatsSinLeer` + su polling-effect de `/api/chat/no-leidos` (solo servían al badge de la fila que desaparece; cada conversación trae su `NO_LEIDOS`).

## UI (funcional)
1. **Fichas**: 2 pills — «TODOS (N)» y «NO LEÍDOS (n)» — N = total conversaciones del filtro; n = las que tienen `NO_LEIDOS > 0`. La ficha activa va **rellena roja** (`#e63946`); estado local `fichaChat` ('todos' | 'noleidos'), se conserva entre aperturas.
2. **Mini lista**: máx **4** conversaciones recientes (Orden del backend por última actividad): fila compacta con título a 1 línea ellipsis + badge rojo con el nº de no leídos cuando es > 0.
   - Click en una conversación → `navigate('/chats?chat=ID_CHAT')` y cierra el menú (la página Chats ya abre ese hilo con `?chat=N`; el admin que aterriza en `/chats` es llevado a `/admin/chats` conservando el parámetro).
3. **Vacíos**: sin conversaciones → «No tienes chats aún»; ficha No leídos sin ninguno → «No tienes chats sin leer».
4. **Link al fondo**: «Ver todos los chats →», full-width centrado → navega a la página de chats por rol (cliente `/chats`; helper `rutaChatsPorRol` por robustez) y cierra el menú.

## CSS (Navbar.css, ~60 líneas)
`.nav-chat-bloque` (separador + padding compacto), `.nav-chat-fichas` (grid 2 col), `.nav-chat-ficha` (+ `.activa` fondo rojo), `.nav-chat-mini`, `.nav-chat-mini-item` (hover gris claro), `.nav-chat-mini-badge` (pill roja mini), `.nav-chat-empty`, `.nav-chat-ver-todos` (rojo, hover subrayado). El dropdown mide ~300px: todo cabe sin scroll.

## Qué NO cambia
- ChatWidget (panel flotante), FloatingChat (badge azul), API backend, esquema BD, la página /chats.
- Fila «Mis chats» se elimina en sus 2 sitios actuales (cliente escritorio + cliente móvil) — no queda duplicado de links.

## Verificación (gate mínimo del usuario: no tantas pruebas)
1. `npx tsc -b` exit 0.
2. 1 sonda Playwright msedge: usuario probe (registro API + cookie) → mensaje sin leer se siembra por SQL sobre su chat → abrir dropdown: fichas visibles, TODOS ≥1, ficha «NO LEÍDOS (1)» con badge en el item, click item navega a `/chats?chat=N`, link «Ver todos los chats» navega y cierra el menú, 0 errores de consola; purga del usuario probe.
