Diagrama de Arquitectura — Jadda Sports

```mermaid
graph TB
    subgraph "🌐 Cliente Web"
        FRONTEND["Frontend React + Vite<br/>Puerto 5173"]
        NAVBAR["Navbar + AuthContext"]
        CART["FloatingCart + MiniCartMenu"]
        ROUTES["React Router:<br/>/, /catalogo, /login,<br/>/perfil, /admin, /pqr"]
    end

    subgraph "📱 App Móvil"
        MOBILE["React Native + Expo<br/>Expo SDK 54"]
        MOBILE_AUTH["AuthContext"]
        MOBILE_TABS["Bottom Tabs:<br/>Inicio, Catálogo,<br/>Carrito, Perfil"]
    end

    subgraph "⚙️ Backend API"
        BACKEND["Node.js + Express 5<br/>Puerto 5000"]
        SETUP["setup.js<br/>(Auto-create tables + seed)"]
        
        subgraph "Rutas API"
            AUTH["/api/auth<br/>(registro, login, logout)"]
            PRODUCTOS["/api/productos<br/>(CRUD, variantes, reseñas)"]
            CARRITO["/api/carrito<br/>(agregar, listar, eliminar)"]
            CHECKOUT["/api/checkout/procesar<br/>(transacción con SELECT ... FOR UPDATE)"]
            DIRECCIONES["/api/direcciones<br/>(CRUD direcciones)"]
            CUPONES["/api/cupones/validar"]
            FAVORITOS["/api/favoritos"]
            COMPRAS["/api/compras"]
            PQR["/api/pqr"]
            POSTVENTA["/api/devoluciones<br/>(multiproducto, evidencias,<br/>4 decisiones)"]
            CHAT["/api/chat<br/>(conversaciones, escalar)"]
            VENDEDOR["/api/vendedor<br/>(tienda, productos,<br/>ventas envío/estado, reportes)"]
            APOYO["/api/envio · /api/newsletter · /api/contacto ·<br/>/api/notificaciones · /api/historial · /api/planes ·<br/>/api/admin · /api/retos · /api/pqr"]
        end
        
        subgraph "Middleware"
            SESSION["express-session +<br/>MySQL Store"]
            PASSPORT["Passport.js<br/>(Local, Google, Facebook)"]
            BCRYPT["bcrypt"]
            SEGURIDAD["helmet · CSRF origen ·<br/>RateLimit · registroPeticiones ·<br/>trust proxy · fail-fast secretos"]
            STATIC["/images privadas con<br/>autorización por recurso"]
        end
    end

    subgraph "☁️ Media"
        CLOUD["Cloudinary (primario)<br/>jadda/productos · perfiles ·<br/>retos · devoluciones · estaticos"]
        DISCO["Fallback disco<br/>backend/uploads/*<br/>(bind-mounts frontend/public/images)"]
    end

    subgraph "🗄️ Base de Datos"
        DB["MySQL 8.0<br/>Docker Container<br/>Puerto 3306"]
    end

    subgraph "🐳 Infraestructura"
        DOCKER["Docker Compose"]
        VOLUME["Volume: mysql_data"]
    end

    FRONTEND -->|"HTTP :5000"| BACKEND
    MOBILE -->|"HTTP :5000"| BACKEND
    BACKEND -->|"mysql2 parametrizado"| DB
    SETUP -->|"CREATE TABLE + INSERT IGNORE"| DB
    BACKEND -->|"subidas (CLOUDINARY_URL)"| CLOUD
    CLOUD -.->|"si falla o sin credenciales"| DISCO
    DB -->|"persiste datos"| VOLUME
```

## Flujo de Autenticación

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant DB as MySQL

    U->>F: Rellena formulario registro
    F->>B: POST /api/auth/registro
    B->>DB: INSERT INTO USUARIOS
    B->>U: Email con código 6-dígitos
    U->>F: Ingresa código
    F->>B: POST /api/auth/confirmar
    B->>DB: UPDATE CONFIRMADO = 1
    B->>F: Cuenta activada
    U->>F: Login (email + password)
    F->>B: POST /api/auth/login
    B->>DB: SELECT * FROM USUARIOS
    B->>B: bcrypt.compare(password)
    B->>B: req.login() → sesión Passport
    B->>F: { nombre, usuario }
```

## Flujo de Compra

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant B as Backend
    participant DB as MySQL

    U->>F: Agrega producto al carrito
    F->>F: CartContext (frontend state)
    U->>F: Abre carrito flotante
    U->>F: Va a /resumencompra
    F->>F: Calcula subtotales + total
    U->>F: Agrega dirección
    F->>B: POST /api/direcciones
    B->>DB: INSERT INTO DIRECCIONES
    U->>F: Selecciona método de pago
    U->>F: Aplica cupón (opcional)
    F->>B: POST /api/cupones/validar
    B->>DB: SELECT FROM DESCUENTOS
    U->>F: Confirma compra
    F->>B: POST /api/checkout/procesar
    B->>DB: Transacción: SELECT ... FOR UPDATE (stock real por variante)
    B->>DB: UPDATE PRODUCTO_VARIANTES SET STOCK=STOCK-? AND STOCK>=? (409 si 0 filas)
    B->>DB: INSERT INTO VENTAS + DETALLE_VENTAS + ENVIOS
    B->>F: Compra exitosa (COMPLETADA; PENDIENTE_PAGO si PAYMENT_GATEWAY)
```
