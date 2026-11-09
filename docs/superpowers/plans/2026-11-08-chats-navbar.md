# Bloque CHAT en el menú del navbar — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la fila «Mis chats» del menú del navbar (dropdown escritorio + panel móvil, rama cliente) por un bloque con fichas «TODOS (N) / NO LEÍDOS (n)», mini lista de hasta 4 conversaciones y link «Ver todos los chats →».

**Architecture:** Solo frontend. Navbar.tsx obtiene el nuevo estado (`conversacionesChats`, `fichaChat`) con fetch al abrir el menú y polling 15s mientras abierto (reusando `leerListaJson`), calcula título/filtro/contadores como ChatWidget y renderiza UN marcado compartido (`bloqueChats`) en los 2 sitios. El estado `chatsSinLeer` + su polling de `/api/chat/no-leidos` se eliminan.

**Tech Stack:** React 19 + TypeScript + CSS (Navbar.css), FontAwesome ya cargado.

**Spec:** `docs/superpowers/specs/2026-11-08-chats-navbar-design.md`

## Global Constraints
- Commits SIN push — el usuario los envía.
- Gate de verificación del usuario: `npx tsc -b` (NO `tsc --noEmit`) + 1 sonda Playwright. «No hagas tantas pruebas».
- `noUnusedLocals` activo (TS6133): ni el estado `chatsSinLeer` ni sus efectos pueden quedar huérfanos.
- Copy exacto en español: «TODOS», «NO LEÍDOS», «Ver todos los chats», «No tienes chats sin leer», «No tienes chats aún».
- El bloque SOLO se renderiza en la rama cliente (dropdown + panel móvil); ramas admin/vendedor intactas.
- Título de conversación = réplica de `tituloDe()` de ChatWidget (sin retroendar el backend).

## Review Focus
1. Respuesta no-array / sin conexión → sin crash: `leerListaJson` garantiza `[]` y la UI muestra vacío. (Sonda no lo ejercita con red rota; verificar de código + compilación.)
2. `NO_LEIDOS` numérico o string de MySQL → pill correcta usando `Number(c.NO_LEIDOS) > 0` y tope «99+». (Sonda siembra badge=1 y assert su render.)
3. Ficha «NO LEÍDOS (n)» cuenta CONVERSACIONES con unread, no mensajes: con 1 chat y 1 mensaje sin leer la sonda exige «NO LEÍDOS (1)» + ítem con badge «1».
4. Click en un ítem deja el menú CERRADO y aterriza en `/chats?chat=N`; click en el link del fondo navega a `/chats` y cierra también. (Sonda.)
5. Solo se renderiza en rama cliente: admin/vendedor sin bloque (verificación de compilación + ausencia en el JSX de sus ramas).

---

### Task 1: Estado, helpers y bloque compartido en `Navbar.tsx`

**Files:**
- Modify: `frontend/src/components/Navbar.tsx` (estado L41-55; tipo arriba; bloque compartido; reemplazos L497-500 y L570-572)

**Interfaces:**
- Consumes: `leerListaJson` (ya importado), `useAuth` con `esAdmin/esVendedor` (ya destructurado), endpoint `GET /api/chat/conversaciones`.
- Produces: JSX-const `bloqueChats` insertado en los 2 sitios; clases `.nav-chat-*` que Task 2 estila.

- [x] **Step 1: Tipos** — añadir junto a los tipos existentes:

```ts
type ChatConversacionNavbar = {
  ID_CHAT: number; TIPO: string; NO_LEIDOS: number | string;
  PRODUCTO_NOMBRE?: string | null; CLIENTE_NOMBRE?: string | null; VENDEDOR_EMPRESA?: string | null;
  ID_PRODUCTO?: number | null; ID_DEVOLUCION?: number | null; PRODUCTO?: { NOMBRE?: string | null } | null;
};
```

- [x] **Step 2: Reemplazar estado+efecto de `chatsSinLeer`** (L41-55) por:

```ts
const [conversacionesChats, setConversacionesChats] = useState<ChatConversacionNavbar[]>([]);
const [fichaChat, setFichaChat] = useState<"todos" | "noleidos">("todos");
```
y un efecto que activa con `usuarioLogueado && (isMenuOpen || movilAbierto)`: carga inmediata `leerListaJson("/api/chat/conversaciones")` → `setConversacionesChats(lista)` + `setInterval(cargar, 15000)`; cleanup con `clearInterval` y bandera `cancelado`. Sin sesión: no monta nada (no hace falta limpiar un array: se conserva; al cerrar sesión el bloque no se muestra).

- [x] **Step 3: Helpers en el cuerpo del componente** (después de los efectos):

```ts
const tituloDeChat = (c) =>  // réplica EXACTA de tituloDe() de ChatWidget: SOPORTE → "Soporte JADDA";
// VENDEDOR → `chat ${producto} - ${otro}`; DEVOLUCION → `chat devolucion ${producto} - ${otro}`;
// producto = c.PRODUCTO_NOMBRE || c.PRODUCTO?.NOMBRE || `producto #${c.ID_PRODUCTO || c.ID_DEVOLUCION || ""}`
// otro = esVendedor ? CLIENTE_NOMBRE : (VENDEDOR_EMPRESA || "JADDA SPORTS") — fallback clásico ("cliente"/"vendedor")
const conversacionesFiltradas = conversacionesChats.filter((c) => c.TIPO !== "DEVOLUCION");
const totalChatsMini = conversacionesFiltradas.length;
const countChatsSinLeer = conversacionesFiltradas.filter((c) => Number(c.NO_LEIDOS) > 0).length;
const chatsParaLista = fichaChat === "noleidos" ? conversacionesFiltradas.filter((c) => Number(c.NO_LEIDOS) > 0) : conversacionesFiltradas;
const chatsMini = chatsParaLista.slice(0, 4);
const rutaChatsPorRol = esAdmin ? "/admin/chats" : esVendedor ? "/vendedor/chats" : "/chats";
```

- [x] **Step 4: JSX compartido** — const `bloqueChats` inmediatamente después:

```tsx
const bloqueChats = ( // fichas TODOS/NO LEÍDOS con counts, mini lista .chatsMini, link "Ver todos los chats"
  <div className="nav-chat-bloque">
    <div className="nav-chat-fichas">
      <button className={`nav-chat-ficha${fichaChat === "todos" ? " activa" : ""}`} onClick={() => setFichaChat("todos")}>TODOS ({totalChatsMini})</button>
      <button className={`nav-chat-ficha${fichaChat === "noleidos" ? " activa" : ""}`} onClick={() => setFichaChat("noleidos")}>NO LEÍDOS ({countChatsSinLeer})</button>
    </div>
    {chatsMini.length === 0 ? (
      <p className="nav-chat-empty">{fichaChat === "noleidos" ? "No tienes chats sin leer" : "No tienes chats aún"}</p>
    ) : (
      <div className="nav-chat-mini">
        {chatsMini.map((c) => (
          <button key={c.ID_CHAT} className="nav-chat-mini-item"
            onClick={() => { setIsMenuOpen(false); setMovilAbierto(false); navigate(`${rutaChatsPorRol}?chat=${c.ID_CHAT}`); }}>
            <span className="nav-chat-mini-titulo">{tituloDeChat(c)}</span>
            {Number(c.NO_LEIDOS) > 0 && <span className="nav-chat-mini-badge">{Number(c.NO_LEIDOS) > 99 ? "99+" : c.NO_LEIDOS}</span>}
          </button>
        ))}
      </div>
    )}
    <button className="nav-chat-ver-todos" onClick={() => { setIsMenuOpen(false); setMovilAbierto(false); navigate(rutaChatsPorRol); }}>
      Ver todos los chats <i className="fas fa-arrow-right" />
    </button>
  </div>
);
```

(con cada click de navegación cierra el menú correspondiente: ambos `set(false)`.)

- [x] **Step 5: Insertar el bloque** — reemplazar la fila `<Link to="/chats">Mis chats …` (escritorio, rama cliente) y la fila equivalente del panel móvil por `{bloqueChats}`.

- [x] **Step 6: Compilación**

Run: `docker exec jadda_frontend npx tsc -b`  (o `npx tsc -b` en workdir frontend)
Expected: exit 0 (TS6133 imposible: no queda `chatsSinLeer`).

### Task 2: CSS del bloque

**Files:**
- Modify: `frontend/src/css/Navbar.css` (append al final)

- [x] **Step 1: Estilos** (~60 líneas, dentro del ancho del dropdown ~300px):

```css
.nav-chat-bloque { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; border-top: 1px solid #f1f5f9; margin: 6px 0; }
.nav-chat-fichas { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
.nav-chat-ficha { border: 1px solid #e2e8f0; background: #fff; color: #334155; border-radius: 999px; font-size: .72rem; font-weight: 700; padding: 6px 4px; cursor: pointer; white-space: nowrap; }
.nav-chat-ficha.activa { background: #e63946; border-color: #e63946; color: #fff; }
.nav-chat-mini { display: flex; flex-direction: column; gap: 2px; }
.nav-chat-mini-item { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: 0; border-radius: 10px; padding: 8px 10px; cursor: pointer; text-align: left; }
.nav-chat-mini-item:hover { background: #f8fafc; }
.nav-chat-mini-titulo { flex: 1; min-width: 0; font-size: .8rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-chat-mini-badge { background: #e63946; color: #fff; border-radius: 999px; font-size: .62rem; font-weight: 700; padding: 2px 7px; flex: none; }
.nav-chat-empty { margin: 6px 0 8px; font-size: .75rem; color: #94a3b8; text-align: center; }
.nav-chat-ver-todos { display: block; width: 100%; margin-top: 6px; background: none; border: 0; color: #e63946; font-size: .78rem; font-weight: 700; cursor: pointer; text-align: center; padding: 6px; }
.nav-chat-ver-todos:hover { text-decoration: underline; }
```

- [x] **Step 2: Compilación de builds**

Run: `docker restart jadda_frontend` y esperar build verde
Expected: `✓ built in Xs` + proxy 200.

### Task 3: Sonda E2E + commit

**Files:**
- Create (temporal): `C:\Users\Yeison\AppData\Local\Temp\opencode\probe-chats-navbar.mjs`
- Commit: `frontend/src/components/Navbar.tsx`, `frontend/src/css/Navbar.css`, spec + plan.

- [x] **Step 1: Preparación de datos** (patrón de `probe-paginacion-compacta.mjs`):
  registro API con `telefono` de 10 dígitos + contraseña ≥8 → confirmar cuenta por SQL (`CONFIRMADO=1`) → login API capturando cookie `connect.sid` (contexto msedge con esa cookie).

- [x] **Step 2: Sembrar 1 chat con mensaje sin leer POR SQL** — columnas verificadas contra `setup.js` (`CHAT`: ID_CLIENTE, TIPO, ESTADO, ULTIMA_ACTIVIDAD; `CHAT_MENSAJE`: ID_CHAT, ROL_AUTOR, CONTENIDO, LEIDO) → INSERT CHAT (TIPO='SOPORTE', ESTADO='ACTIVA') + INSERT CHAT_MENSAJE con `LEIDO=0` (2ª conversación SIN mensajes opcional para probar ficha TODOS con badge ≠ de TODAS). Códigos de patrón: archivo `.sql` + `docker cp` + `mysql --default-character-set=utf8mb4 -N`.

- [x] **Step 3: Sonda UI** (sobre `http://localhost:5173`, msedge 1440px) asserts:
  1. abrir dropdown del avatar → `.nav-chat-bloque` visible con 2 fichas;
  2. «TODOS (N≥1)» y «NO LEÍDOS (1)» según siembra (si 2 chats con 1 unread: NO LEÍDOS (1));
  3. ficha NO LEÍDOS activa → ítem visible con badge «1» y título «Soporte JADDA» (o título siembra); TODOS lista ≤4;
  4. click ítem → URL `/chats?chat=N` + menú cerrado (`isMenuOpen` false ⇒ dropdown fuera del DOM);
  5. volver, re-abrir menú, click «Ver todos los chats →» → URL `/chats` + menú cerrado;
  6. 0 errores de consola no-401;
  7. purga completa (CHAT/CHAT_MENSAJE seed + USUARIO_QUEDA=0).

Run ascendente principal (`main().catch` con summary impreso afuera — patrón 317ce76; `main` SIEMPRE finalizado con `await main()` top-level).

- [x] **Step 4: Commits SIN push**

```bash
git add frontend/src/components/Navbar.tsx frontend/src/css/Navbar.css docs/superpowers/specs/2026-11-08-chats-navbar-design.md docs/superpowers/plans/2026-11-08-chats-navbar.md
git commit -m "feat(navbar): bloque de chats con fichas Todos/No leidos, mini lista y link a la pagina de chats"
```

---

## Self-Review

1. **Coverage**: fichas (T4), mini lista con límite 4 y badge (T4), link por rol (T4), fetch al abrir + 15s (T2), filtro DEVOLUCION (T3), eliminación chatsSinLeer (T2), vacíos (T4), CSS (T6), sonda (T3). Cobertura completa.
2. **Steps**: cada step decide una cosa exacta (firma/constructor CSS/prueba con número). No hay TBD.
3. **Tipos**: `ChatConversacionNavbar` usado de forma consistente; Number(NO_LEIDOS) constante en helpers y JSX.
4. **Review Focus**: los 5 modos mapeados a pasos de T-compilación o aserciones T3 (1,5 esperan observación de código; 2,3,2/3 lista, 4 en la sonda).
5. **Proporción**: spec ~60 líneas, plan ~150 — suficiente para convertir en código sin duplicar el código completo.
