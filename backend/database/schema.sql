-- =====================================================================
-- JADDA SPORTS — schema.sql (GENERADO AUTOMÁTICAMENTE)
-- Fuente: backend/database/exportarSchema.js (lee setup.js, no edites a mano)
--
-- Importable en MySQL Workbench para crear la base desde cero
-- Incluye: estructura completa (38 tablas) + datos de referencia (SEED_DATA)
--          + datos DEMO poblados (DEMO_DATA: usuarios, vendedores, ventas, devoluciones, etc.)
--          Listo para abrir en Workbench y generar el modelo relacional
--          (Database > Reverse Engineer).
--
-- Para BASES EXISTENTES no hace falta importar este archivo: al reiniciar el
-- backend (docker restart jadda_backend), setup.js aplica automáticamente
-- las migraciones idempotentes y el DEMO_DATA (INSERT IGNORE).
-- =====================================================================

SET FOREIGN_KEY_CHECKS=0;


-- =========================================================================
-- TABLAS DE USUARIOS Y ROLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS ROLES (
    ID_ROL INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE_ROL VARCHAR(50),
    DESCRIPCION VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS USUARIOS (
    ID_USUARIO INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE_USUARIO VARCHAR(100) NOT NULL,
    APELLIDO_USUARIO VARCHAR(100) NOT NULL,
    EMAIL VARCHAR(100) UNIQUE NOT NULL,
    USUARIO VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(255),
    CONTRASENA VARCHAR(255) NOT NULL,
    FECHA_REGISTRO DATE,
    TIPO_DOCUMENTO VARCHAR(5),
    NUMERO_DOCUMENTO VARCHAR(20),
    ID_ROL INT,
    CONFIRMADO TINYINT DEFAULT 0,
    -- TOKEN ahora guarda el HASH bcrypt del código OTP (60 chars) — no un código plano de 6
    TOKEN VARCHAR(255) DEFAULT NULL,
    TOKEN_EXPIRA DATETIME DEFAULT NULL,
    foto_url VARCHAR(255) DEFAULT NULL,
    AUTH_PROVIDER VARCHAR(50) DEFAULT 'local',
    PROVIDER_ID VARCHAR(255) DEFAULT NULL,
    EMAIL_PENDIENTE VARCHAR(100) DEFAULT NULL,
    ULTIMA_CONEXION DATETIME DEFAULT NULL,
    ULTIMA_IP VARCHAR(45) DEFAULT NULL,
    ULTIMA_UBICACION VARCHAR(100) DEFAULT NULL,
    DEBE_CAMBIAR_PASSWORD TINYINT DEFAULT 0,
    -- Fuerza bruta por cuenta: intentos fallidos de código y login
    INTENTOS_CODIGO INT NOT NULL DEFAULT 0,
    VENTANA_CODIGO DATETIME DEFAULT NULL,
    INTENTOS_LOGIN INT NOT NULL DEFAULT 0,
    VENTANA_LOGIN DATETIME DEFAULT NULL,
    FOREIGN KEY (ID_ROL) REFERENCES ROLES(ID_ROL)
);

-- -------------------------------------------------------------------------
-- DIRECCIONES DE USUARIO
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS DIRECCIONES (
  ID_DIRECCION INT AUTO_INCREMENT PRIMARY KEY,
  ID_USUARIO INT NOT NULL,
  DIRECCION VARCHAR(255) NOT NULL,
  BARRIO VARCHAR(100),
  CIUDAD VARCHAR(100) NOT NULL,
  DEPARTAMENTO VARCHAR(100) NOT NULL,
  CODIGO_POSTAL VARCHAR(20),
  TELEFONO_CONTACTO VARCHAR(20),
  ETIQUETA VARCHAR(50) DEFAULT NULL,
  ES_PRINCIPAL TINYINT(1) DEFAULT 0,
    FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
);

-- -------------------------------------------------------------------------
-- PROVEEDORES, CATEGORÍAS, DESCUENTOS Y PRODUCTOS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PROVEEDORES (
    ID_PROVEEDOR INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE_PROVEEDOR VARCHAR(200),
    TELEFONO_PROVEEDOR VARCHAR(15),
    EMAIL_PROVEEDOR VARCHAR(100),
    DIRECCION_PROVEEDOR VARCHAR(255),
    CONTACTO_PROVEEDOR VARCHAR(100),
    NIT VARCHAR(15)
);

CREATE TABLE IF NOT EXISTS CATEGORIAS (
    ID_CATEGORIA INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE_CATEGORIA VARCHAR(100) NOT NULL,
    DESCRIPCION VARCHAR(100),
    CONSTRAINT uq_categoria_nombre UNIQUE (NOMBRE_CATEGORIA)
);

CREATE TABLE IF NOT EXISTS DESCUENTOS (
    ID_DESCUENTO INT PRIMARY KEY AUTO_INCREMENT,
    DESCRIPCION VARCHAR(255),
    PORCENTAJE DECIMAL(5,2),
    FECHA_INICIO DATE,
    FECHA_FIN DATE,
    USADO TINYINT NOT NULL DEFAULT 0,
    MONTO_MINIMO DECIMAL(12,0) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS PRODUCTOS (
    ID INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE VARCHAR(255),
    MARCA VARCHAR(100),
    PRECIO DECIMAL(10,2),
    DESCRIPCION TEXT,
    ID_PROVEEDOR INT,
    ID_CATEGORIA INT,
    ID_DESCUENTO INT,
    ID_VENDEDOR INT NULL,
    ESTADO_PUBLICACION VARCHAR(10) NULL
);

-- -------------------------------------------------------------------------
-- VARIANTES, IMÁGENES Y CARACTERÍSTICAS DE PRODUCTOS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PRODUCTO_VARIANTES (
    ID_VARIANTE INT AUTO_INCREMENT PRIMARY KEY,
    ID_PRODUCTO INT NOT NULL,
    COLOR VARCHAR(50),
    NOMBRE_ATRIBUTO VARCHAR(50),
    ATRIBUTO VARCHAR(50),
    STOCK INT,
    UNIQUE KEY uq_variante_producto (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO),
    FOREIGN KEY (ID_PRODUCTO)
        REFERENCES PRODUCTOS(ID)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PRODUCTO_IMAGENES (
    ID_IMAGEN INT AUTO_INCREMENT PRIMARY KEY,
    ID_PRODUCTO INT NOT NULL,
    URL_IMAGEN VARCHAR(255) NOT NULL,
    ORDEN INT DEFAULT 1,
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PRODUCTO_CARACTERISTICAS (
    ID_CARACTERISTICA INT AUTO_INCREMENT PRIMARY KEY,
    ID_PRODUCTO INT NOT NULL,
    NOMBRE_ATRIBUTO VARCHAR(100) NOT NULL,
    VALOR_ATRIBUTO VARCHAR(255) NOT NULL,
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID) ON DELETE CASCADE
);

-- -------------------------------------------------------------------------
-- MÉTODOS DE PAGO
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS METODOS_PAGO (
    ID_METODO INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE_METODO VARCHAR(50) NOT NULL,
    DESCRIPCION VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS VENTAS (
    ID_VENTA INT PRIMARY KEY AUTO_INCREMENT,
    ID_CLIENTE INT,
    FECHA_VENTA DATETIME,
    DATOS_PAGO JSON DEFAULT NULL,
    TOTAL DECIMAL(10,2),
    ESTADO VARCHAR(50) DEFAULT 'COMPLETADA',
    ID_METODO INT,
    REFERENCIA_PAGO VARCHAR(100) DEFAULT NULL,
    -- Fase 6 (pasarela): límite de la ventana de pago. VENTAS PENDIENTE_PAGO
    -- expiran a esta hora (pull/job cancelan + reingresan stock). NULL en
    -- ventas legacy y sin pasarela → fallback FECHA_VENTA + ventana.
    FECHA_EXPIRA_PAGO DATETIME DEFAULT NULL,
    -- Fase 3 (ESC-3): dashboards/reportes/top hacen rangos por FECHA_VENTA y
    -- el perfil/mis compras filtra por ID_CLIENTE — EXPLAIN mostraba type ALL
    -- con key NULL en esas bandas.
    INDEX idx_ventas_fecha (FECHA_VENTA),
    INDEX idx_ventas_cliente (ID_CLIENTE),
    FOREIGN KEY (ID_METODO) REFERENCES METODOS_PAGO(ID_METODO)
);

-- -------------------------------------------------------------------------
-- VENTAS, DETALLE, ENVÍOS Y MOVIMIENTOS DE STOCK
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS DETALLE_VENTAS (
    ID_DETALLE INT PRIMARY KEY AUTO_INCREMENT,
    ID_VENTA INT,
    ID_PRODUCTO INT,
    ID_VARIANTE INT NULL,
    CANTIDAD INT,
    PRECIO_UNITARIO DECIMAL(10,2),
    SUBTOTAL DECIMAL(10,2),
    FOREIGN KEY (ID_VENTA) REFERENCES VENTAS(ID_VENTA),
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID),
    FOREIGN KEY (ID_VARIANTE) REFERENCES PRODUCTO_VARIANTES(ID_VARIANTE) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ENVIOS (
    ID_ENVIO INT PRIMARY KEY AUTO_INCREMENT,
    ID_VENTA INT,
    DIRECCION_ENVIO VARCHAR(255),
    CIUDAD VARCHAR(100),
    BARRIO VARCHAR(100) DEFAULT NULL,
  DEPARTAMENTO VARCHAR(100) DEFAULT NULL,
  CODIGO_POSTAL VARCHAR(20) DEFAULT NULL,
  OBSERVACIONES TEXT DEFAULT NULL,
  TELEFONO_CONTACTO VARCHAR(20) DEFAULT NULL,
    COSTO_ENVIO DECIMAL(10,2) DEFAULT 0,
    ESTADO_ENVIO VARCHAR(50),
    FECHA_ENVIO DATE,
    FECHA_ENTREGA DATETIME DEFAULT NULL,
    FOREIGN KEY (ID_VENTA) REFERENCES VENTAS(ID_VENTA)
);

CREATE TABLE IF NOT EXISTS MOVIMIENTOS_STOCK (
    ID_MOVIMIENTO INT PRIMARY KEY AUTO_INCREMENT,
    ID_PRODUCTO INT,
    TIPO_MOVIMIENTO VARCHAR(50),
    CANTIDAD INT,
    FECHA DATE,
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID)
);

-- -------------------------------------------------------------------------
-- FAVORITOS, HISTORIAL, CARRITO Y RESEÑAS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS FAVORITOS (
    ID_FAVORITO INT PRIMARY KEY AUTO_INCREMENT,
    ID_USUARIO INT,
    ID_PRODUCTO INT,
    FECHA_AGREGADO DATE,
    FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO),
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID)
);

CREATE TABLE IF NOT EXISTS HISTORIAL (
    ID_HISTORIAL INT PRIMARY KEY AUTO_INCREMENT,
    ID_USUARIO INT,
    ID_PRODUCTO INT,
    FECHA_VISTO DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO),
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID)
);

CREATE TABLE IF NOT EXISTS CARRITO (
    ID_CARRITO INT PRIMARY KEY AUTO_INCREMENT,
    ID_USUARIO INT NOT NULL,
    ID_PRODUCTO INT NOT NULL,
    ID_VARIANTE INT NULL,
    CANTIDAD INT NOT NULL DEFAULT 1,
    FECHA_AGREGADO TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO) ON DELETE CASCADE,
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID) ON DELETE CASCADE,
    FOREIGN KEY (ID_VARIANTE) REFERENCES PRODUCTO_VARIANTES(ID_VARIANTE) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS RESENAS (
    ID_RESENA INT AUTO_INCREMENT PRIMARY KEY,
    ID_PRODUCTO INT NOT NULL,
    ID_USUARIO INT NOT NULL,
    CALIFICACION INT CHECK (CALIFICACION BETWEEN 1 AND 5),
    COMENTARIO TEXT,
    FECHA TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID) ON DELETE CASCADE,
    FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO) ON DELETE CASCADE
);

-- -------------------------------------------------------------------------
-- PQR, SESIONES, RETOS, PLANES DE ENTRENAMIENTO Y MÉTODOS DE PAGO POR USUARIO
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PQR (
  ID_PQR INT AUTO_INCREMENT PRIMARY KEY,
  ID_USUARIO INT NOT NULL,
  TIPO VARCHAR(50) NOT NULL,
  ASUNTO VARCHAR(255) NOT NULL,
  DESCRIPCION TEXT NOT NULL,
  NUMERO_PEDIDO VARCHAR(50) DEFAULT NULL,
  FECHA DATETIME NOT NULL,
  ESTADO VARCHAR(50) DEFAULT 'PENDIENTE',
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT,
  PRIMARY KEY (session_id)
);

CREATE TABLE IF NOT EXISTS RETOS (
  ID_RETO INT PRIMARY KEY AUTO_INCREMENT,
  TITULO VARCHAR(200) NOT NULL,
  DESCRIPCION TEXT,
  META_TIPO VARCHAR(50) NOT NULL,
  META_VALOR INT NOT NULL,
  RECOMPENSA_PORCENTAJE DECIMAL(5,2) NOT NULL,
  FECHA_INICIO DATE NOT NULL,
  FECHA_FIN DATE NOT NULL,
  ACTIVO TINYINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS RETOS_USUARIOS (
  ID_RETO_USUARIO INT PRIMARY KEY AUTO_INCREMENT,
  ID_RETO INT NOT NULL,
  ID_USUARIO INT NOT NULL,
  PROGRESO INT DEFAULT 0,
  COMPLETADO TINYINT DEFAULT 0,
  CUPON_GENERADO VARCHAR(50) DEFAULT NULL,
  FOREIGN KEY (ID_RETO) REFERENCES RETOS(ID_RETO),
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
);

CREATE TABLE IF NOT EXISTS RETO_EVIDENCIAS (
  ID_EVIDENCIA INT PRIMARY KEY AUTO_INCREMENT,
  ID_RETO_USUARIO INT NOT NULL,
  ID_USUARIO INT NOT NULL,
  TIPO VARCHAR(10) NOT NULL,
  RUTA VARCHAR(255) DEFAULT NULL,
  RUTAS_EXTRA TEXT DEFAULT NULL,
  CANTIDAD INT NOT NULL DEFAULT 1,
  ESTADO VARCHAR(20) DEFAULT 'pendiente',
  OBSERVACION VARCHAR(500) DEFAULT NULL,
  FECHA_SUBIDA DATETIME DEFAULT NOW(),
  FOREIGN KEY (ID_RETO_USUARIO) REFERENCES RETOS_USUARIOS(ID_RETO_USUARIO),
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
);

CREATE TABLE IF NOT EXISTS NOTIFICACIONES (
  ID_NOTIFICACION INT PRIMARY KEY AUTO_INCREMENT,
  ID_USUARIO INT DEFAULT NULL,
  TIPO VARCHAR(30) NOT NULL,
  TITULO VARCHAR(200) NOT NULL,
  MENSAJE VARCHAR(500) DEFAULT NULL,
  RUTA VARCHAR(255) DEFAULT NULL,
  LEIDA TINYINT DEFAULT 0,
  FECHA DATETIME DEFAULT NOW(),
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
);

-- Orden FK importante: DEVOLUCIONES/VENDEDORES antes de CHAT (CHAT los referencia).
CREATE TABLE IF NOT EXISTS DEVOLUCIONES (
  ID_DEVOLUCION INT PRIMARY KEY AUTO_INCREMENT,
  ID_USUARIO INT NOT NULL,
  ID_VENTA INT NOT NULL,
  ID_PRODUCTO INT NOT NULL,
  CANTIDAD INT NOT NULL DEFAULT 1,
  MOTIVO VARCHAR(500) DEFAULT NULL,
  DESCRIPCION TEXT DEFAULT NULL,
  TIPO VARCHAR(20) NOT NULL DEFAULT 'DEVOLUCION',
  OBSERVACION VARCHAR(500) DEFAULT NULL,
  ESTADO VARCHAR(20) DEFAULT 'SOLICITADA',
  FECHA_CREACION DATETIME DEFAULT NOW(),
  FECHA_PROCESADA DATETIME DEFAULT NULL,
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO),
  FOREIGN KEY (ID_VENTA) REFERENCES VENTAS(ID_VENTA),
  FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID)
);

CREATE TABLE IF NOT EXISTS DEVOLUCIONES_EVIDENCIAS (
  ID_EVIDENCIA INT PRIMARY KEY AUTO_INCREMENT,
  ID_DEVOLUCION INT NOT NULL,
  TIPO VARCHAR(10) NOT NULL,
  RUTA VARCHAR(500) NOT NULL,
  FECHA DATETIME DEFAULT NOW(),
  FOREIGN KEY (ID_DEVOLUCION) REFERENCES DEVOLUCIONES(ID_DEVOLUCION) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SOLICITUDES_VENDEDOR (
  ID_SOLICITUD INT PRIMARY KEY AUTO_INCREMENT,
  ID_USUARIO INT NULL,
  NOMBRE_EMPRESA VARCHAR(150) DEFAULT NULL,
  NIT VARCHAR(20) DEFAULT NULL,
  NOMBRE_REPRESENTANTE VARCHAR(150) NOT NULL,
  EMAIL_EMPRESA VARCHAR(100) NOT NULL,
  TELEFONO VARCHAR(30) NOT NULL,
  DEPARTAMENTO VARCHAR(60) NOT NULL,
  CIUDAD VARCHAR(60) NOT NULL,
  DIRECCION VARCHAR(200) DEFAULT NULL,
  CATEGORIAS VARCHAR(255) DEFAULT NULL,
  DESCRIPCION TEXT DEFAULT NULL,
  ESTADO VARCHAR(20) DEFAULT 'PENDIENTE',
  OBSERVACION_ADMIN VARCHAR(500) DEFAULT NULL,
  FECHA_CREACION DATETIME DEFAULT NOW(),
  FECHA_PROCESADA DATETIME DEFAULT NULL,
  UNIQUE KEY uq_solicitud_usuario (ID_USUARIO),
  UNIQUE KEY uq_solicitud_nit (NIT),
  UNIQUE KEY uq_solicitud_email (EMAIL_EMPRESA),
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
);

CREATE TABLE IF NOT EXISTS VENDEDORES (
  ID_VENDEDOR INT PRIMARY KEY AUTO_INCREMENT,
  ID_USUARIO INT NOT NULL,
  ID_SOLICITUD INT NOT NULL,
  NOMBRE_EMPRESA VARCHAR(150) DEFAULT NULL,
  NIT VARCHAR(20) DEFAULT NULL,
  EMAIL_VENDEDOR VARCHAR(100) NOT NULL,
  TELEFONO VARCHAR(30) DEFAULT NULL,
  DEPARTAMENTO VARCHAR(60) DEFAULT NULL,
  CIUDAD VARCHAR(60) DEFAULT NULL,
  DIRECCION VARCHAR(200) DEFAULT NULL,
  CATEGORIAS VARCHAR(255) DEFAULT NULL,
  ESTADO VARCHAR(20) DEFAULT 'ACTIVO',
  FECHA_REGISTRO DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_vendedor_usuario (ID_USUARIO),
  UNIQUE KEY uq_vendedor_solicitud (ID_SOLICITUD),
  UNIQUE KEY uq_vendedor_nit (NIT),
  UNIQUE KEY uq_vendedor_email (EMAIL_VENDEDOR),
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO),
  FOREIGN KEY (ID_SOLICITUD) REFERENCES SOLICITUDES_VENDEDOR(ID_SOLICITUD)
);

CREATE TABLE IF NOT EXISTS CHAT (
  ID_CHAT INT PRIMARY KEY AUTO_INCREMENT,
  TIPO ENUM('SOPORTE','VENDEDOR','DEVOLUCION') NOT NULL,
  ID_CLIENTE INT DEFAULT NULL,
  ID_VENDEDOR INT DEFAULT NULL,
  ID_PRODUCTO INT DEFAULT NULL,
  ID_DEVOLUCION INT DEFAULT NULL,
  PARTE VARCHAR(10) DEFAULT NULL,
  ESTADO VARCHAR(20) DEFAULT 'ACTIVA',
  FECHA_CREACION DATETIME DEFAULT NOW(),
  ULTIMA_ACTIVIDAD DATETIME DEFAULT NOW(),
  FOREIGN KEY (ID_CLIENTE) REFERENCES USUARIOS(ID_USUARIO),
  FOREIGN KEY (ID_VENDEDOR) REFERENCES VENDEDORES(ID_VENDEDOR),
  FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS CHAT_MENSAJE (
  ID_MENSAJE INT PRIMARY KEY AUTO_INCREMENT,
  ID_CHAT INT NOT NULL,
  ID_AUTOR INT DEFAULT NULL,
  ROL_AUTOR ENUM('CLIENTE','VENDEDOR','ADMIN','SISTEMA') NOT NULL,
  MENSAJE TEXT NOT NULL,
  LEIDO TINYINT DEFAULT 0,
  FECHA DATETIME DEFAULT NOW(),
  FOREIGN KEY (ID_CHAT) REFERENCES CHAT(ID_CHAT) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PLANTILLAS_PLANES (
  ID_PLANTILLA INT PRIMARY KEY AUTO_INCREMENT,
  ID_CATEGORIA INT,
  TITULO VARCHAR(200) NOT NULL,
  DESCRIPCION TEXT,
  DURACION_DIAS INT DEFAULT 14,
  NIVEL VARCHAR(50) DEFAULT 'Principiante',
  CONTENIDO JSON,
  FOREIGN KEY (ID_CATEGORIA) REFERENCES CATEGORIAS(ID_CATEGORIA)
);

CREATE TABLE IF NOT EXISTS PLANES_USUARIO (
  ID_PLAN INT PRIMARY KEY AUTO_INCREMENT,
  ID_USUARIO INT NOT NULL,
  ID_VENTA INT,
  ID_PLANTILLA INT NOT NULL,
  FECHA_INICIO DATE,
  COMPLETADO TINYINT DEFAULT 0,
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO),
  FOREIGN KEY (ID_VENTA) REFERENCES VENTAS(ID_VENTA),
  FOREIGN KEY (ID_PLANTILLA) REFERENCES PLANTILLAS_PLANES(ID_PLANTILLA)
);

CREATE TABLE IF NOT EXISTS USUARIOS_METODOS_PAGO (
  ID INT PRIMARY KEY AUTO_INCREMENT,
  ID_USUARIO INT NOT NULL,
  ID_METODO INT NOT NULL,
  TITULAR VARCHAR(100) DEFAULT NULL,
  TELEFONO VARCHAR(20) DEFAULT NULL,
  BANCO VARCHAR(100) DEFAULT NULL,
  TIPO VARCHAR(20) DEFAULT NULL,
  ES_PRINCIPAL TINYINT DEFAULT 0,
  FECHA_CREADO DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO),
  FOREIGN KEY (ID_METODO) REFERENCES METODOS_PAGO(ID_METODO)
);

CREATE TABLE IF NOT EXISTS AVISOS_STOCK (
  ID_AVISO INT PRIMARY KEY AUTO_INCREMENT,
  ID_VARIANTE INT NOT NULL,
  ID_USUARIO INT NOT NULL,
  FECHA_CREACION DATETIME DEFAULT NOW(),
  ENVIADO TINYINT DEFAULT 0,
  UNIQUE KEY uq_aviso_variante_usuario (ID_VARIANTE, ID_USUARIO),
  FOREIGN KEY (ID_VARIANTE) REFERENCES PRODUCTO_VARIANTES(ID_VARIANTE) ON DELETE CASCADE,
  FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO) ON DELETE CASCADE
);

-- Pasarela de pagos (Fase 6): idempotencia de eventos webhook de Wompi
CREATE TABLE IF NOT EXISTS PAGOS_EVENTOS (
  ID_EVENTO INT PRIMARY KEY AUTO_INCREMENT,
  PROVEEDOR VARCHAR(20) NOT NULL,
  EXTERNO_ID VARCHAR(100) NOT NULL,
  EVENTO VARCHAR(60) NOT NULL,
  CHECKSUM VARCHAR(64) NOT NULL,
  ID_VENTA INT DEFAULT NULL,
  ESTADO_PROCESADO VARCHAR(40) DEFAULT 'RECIBIDO',
  FECHA_RECEPCION DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_pagos_evento (EXTERNO_ID, CHECKSUM)
);

-- Newsletter persistida en MySQL (antes archivos JSON en backend/data)
CREATE TABLE IF NOT EXISTS NEWSLETTER_SUSCRIPTOS (
  ID INT PRIMARY KEY AUTO_INCREMENT,
  EMAIL VARCHAR(255) NOT NULL,
  ACTIVO TINYINT DEFAULT 1,
  FECHA_SUSCRIPCION DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_newsletter_email (EMAIL)
);

CREATE TABLE IF NOT EXISTS NEWSLETTER_ENVIOS (
  ID INT PRIMARY KEY AUTO_INCREMENT,
  TEMA VARCHAR(150) DEFAULT NULL,
  ENVIADOS INT DEFAULT 0,
  FALLIDOS INT DEFAULT 0,
  FECHA_ENVIO DATETIME DEFAULT NOW()
);


-- -------------------------------------------------------------------------
-- ROLES: 5 roles predefinidos (Administrador a Invitado)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO ROLES (ID_ROL, NOMBRE_ROL, DESCRIPCION) VALUES
(1, 'Administrador', 'Control total del sistema'),
(2, 'Empleado', 'Trabajador de la tienda'),
(3, 'Proveedor', 'Suministra productos'),
(4, 'Usuario', 'Persona registrada'),
(5, 'Invitado', 'Acceso limitado'),
(6, 'Vendedor', 'Vende productos en la plataforma');

-- -------------------------------------------------------------------------
-- PROVEEDORES: 15 marcas deportivas (Nike, Adidas, Puma, etc.)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PROVEEDORES (ID_PROVEEDOR, NOMBRE_PROVEEDOR, TELEFONO_PROVEEDOR, EMAIL_PROVEEDOR, DIRECCION_PROVEEDOR, CONTACTO_PROVEEDOR, NIT) VALUES
(1, 'Nike Colombia SAS', '3101112233', 'ventas@nike.com', 'Bogotá D.C.', 'Carlos Pérez', '900123001'),
(2, 'Adidas Colombia Ltda', '3102223344', 'contacto@adidas.com', 'Medellín', 'Laura Méndez', '900123002'),
(3, 'Puma Sports SAS', '3103334455', 'info@puma.com', 'Cali', 'Andrés Gil', '900123003'),
(4, 'Reebok Latam SAS', '3104445566', 'ventas@reebok.com', 'Barranquilla', 'Sofía Ramírez', '900123004'),
(5, 'BodyFit Equipos SAS', '3105556677', 'contacto@bodyfit.com', 'Bogotá D.C.', 'Miguel Castro', '900123005'),
(6, 'Spalding Colombia', '3106667788', 'ventas@spalding.com', 'Cartagena', 'Daniel Ortiz', '900123006'),
(7, 'Everlast Colombia', '3107778899', 'info@everlast.com', 'Bucaramanga', 'María Torres', '900123007'),
(8, 'ProFit Machines SAS', '3111112233', 'contacto@profit.com', 'Bogotá D.C.', 'Fernando Ríos', '900123008'),
(9, 'Under Armour SAS', '3112223344', 'ventas@underarmour.com', 'Cali', 'Camila Soto', '900123009'),
(10, 'New Balance Colombia', '3113334455', 'info@newbalance.com', 'Medellín', 'Ricardo León', '900123010'),
(11, 'Wilson Sports SAS', '3114445566', 'ventas@wilson.com', 'Bogotá D.C.', 'Natalia Peña', '900123011'),
(12, 'Asics Colombia SAS', '3115556677', 'contacto@asics.com', 'Pereira', 'Javier Mora', '900123012'),
(13, 'Kappa Sports SAS', '3116667788', 'info@kappa.com', 'Bogotá D.C.', 'Valentina Ruiz', '900123013'),
(14, 'Umbro Colombia', '3117778899', 'ventas@umbro.com', 'Cali', 'Sebastián Díaz', '900123014'),
(15, 'Decathlon Proveedores SAS', '3121112233', 'contacto@decathlon.com', 'Bogotá D.C.', 'Paola Vega', '900123015');

-- -------------------------------------------------------------------------
-- CATEGORÍAS: 15 categorías (Fútbol, Baloncesto, Running, ...)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO CATEGORIAS (ID_CATEGORIA, NOMBRE_CATEGORIA, DESCRIPCION) VALUES
(1, 'Fútbol', 'Balones, guantes, espinilleras y todo lo que necesitas para dominar la cancha'),
(2, 'Baloncesto', 'Balones, aros y accesorios para llevar tu juego a otro nivel dentro y fuera de la cancha'),
(3, 'Running', 'Tenis, ropa y accesorios ligeros diseñados para acompañarte en cada kilómetro'),
(4, 'Gimnasio', 'Pesas, mancuernas y accesorios de fuerza para potenciar tus entrenamientos'),
(5, 'Natación', 'Gafas, gorros y trajes de baño de alto rendimiento para entrenar en el agua'),
(6, 'Ciclismo', 'Guantes, cascos y ropa técnica para rodar con comodidad y seguridad'),
(7, 'Deportes extremos', 'Equipos especializados para skate, escalada y aventura con máxima resistencia'),
(8, 'Ropa deportiva', 'Camisetas, buzos y leggings cómodos y transpirables para cualquier actividad'),
(9, 'Accesorios', 'Morrales, botellas, muñequeras y complementos que no pueden faltar'),
(10, 'Protección', 'Caneleteras, coderas y elementos de seguridad para entrenar sin preocupaciones'),
(11, 'Cardio', 'Elípticas, caminadoras y bicicletas para mejorar tu resistencia desde casa o el gym'),
(12, 'Hogar fitness', 'Máquinas y equipos compactos para armar tu gimnasio ideal en casa'),
(13, 'Suplementos', 'Proteínas, vitaminas y nutrición deportiva para alcanzar tus metas'),
(14, 'Tecnología deportiva', 'Relojes GPS, pulseras y gadgets para medir tu rendimiento al detalle'),
(15, 'Ofertas', 'Los mejores descuentos del momento en artículos deportivos seleccionados');

-- -------------------------------------------------------------------------
-- DESCUENTOS: 2 descuentos de ejemplo (temporada + cupón JADDA10)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN) VALUES
(1, 'Descuento temporada fútbol', 10, '2025-06-01', '2025-07-01'),
(2, 'JADDA10', 10, '2025-01-01', '2026-12-31');

-- -------------------------------------------------------------------------
-- PRODUCTOS: 44 productos base (ID 1-44) + 60 productos nuevos (ID 45-104)
-- NOTA DESCRIPCION:
--  • ID 1-44: el texto aquí es CORTO/LEGADO (ej 'Guayos para césped natural').
--    Al arrancar, backend/database/contenidos-producto.js lo REEMPLAZA por el copy
--    profesional largo (y su ficha técnica). Edita contenidos-producto.js para 1-44,
--    no este bloque. Ver original[] en ese archivo.
--  • ID 45-104: no están en contenidos-producto.js, así que este INSERT sí es la
--    descripción final. Como es INSERT IGNORE, una vez insertado solo se cambia
--    con UPDATE manual o añadiendo entrada a contenidos-producto.js.
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PRODUCTOS (ID, NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_PROVEEDOR, ID_CATEGORIA, ID_DESCUENTO) VALUES
(1, 'Guayos profesionales', 'Adidas', 220000, 'Guayos para césped natural', 1, 1, NULL),
(2, 'Balón Al Rihla Pro', 'Adidas', 320000, 'Balón oficial', 2, 1, NULL),
(3, 'Espinilleras', 'Nike', 70000, 'Protección fútbol', 1, 1, NULL),
(4, 'Guantes de Portero Future', 'Puma', 240000, 'Látex de alto agarre', 1, 1, NULL),
(5, 'Camiseta Selección', 'Adidas', 150000, 'Edición especial', 1, 1, NULL),
(6, 'Balón baloncesto', 'Spalding', 110000, 'Balón oficial NBA', 2, 2, NULL),
(7, 'Tenis Lebron Witness', 'Nike', 480000, 'Amortiguación reactiva', 1, 2, NULL),
(8, 'Malla porta balones', 'Spalding', 30000, 'Capacidad 10 balones', 2, 2, NULL),
(9, 'Sudadera deportiva', 'Nike', 120000, 'Sudadera térmica', 1, 3, NULL),
(10, 'Zapatillas Ultraboost Ligero', 'Adidas', 650000, 'Retorno de energía ligero', 2, 3, NULL),
(11, 'Tenis Speedcross 6', 'Salomon', 590000, 'Ideal para correr por senderos', 2, 3, NULL),
(12, 'Pantalón Jogger Deportivo Tech', 'Nike', 185000, 'Corte ajustado', 1, 3, NULL),
(13, 'Cuerda para saltar', 'Everlast', 35000, 'Cuerda ajustable', 1, 4, NULL),
(14, 'Pesas 5kg', 'BodyFit', 50000, 'Recubiertas', 2, 4, NULL),
(15, 'Mancuernas 20kg', 'BodyFit', 150000, 'Kit completo', 2, 4, NULL),
(16, 'Colchoneta Yoga Pro', 'Everlast', 75000, 'Antideslizante 6mm', 1, 4, NULL),
(17, 'Gafas de Natación Pro', 'Speedo', 95000, 'Antiempañante y UV', 2, 5, NULL),
(18, 'Gorro de Natación Silicona', 'Speedo', 25000, 'Ajuste hidrodinámico', 1, 5, NULL),
(19, 'Casco Ciclismo Ruta', 'Bell', 250000, 'Certificación seguridad', 2, 6, NULL),
(20, 'Guantes Ciclismo Gel', 'Giant', 85000, 'Acolchado anti-vibración', 1, 6, NULL),
(21, 'Casco Escalada', 'Black Diamond', 320000, 'Ultra ligero', 1, 7, NULL),
(22, 'Cuerda Escalada 50m', 'Petzl', 850000, 'Resistencia alta', 2, 7, NULL),
(23, 'Chaqueta Rompevientos', 'Adidas', 210000, 'Protección contra viento', 2, 8, NULL),
(24, 'Leggings Lux Tiro Alto', 'Reebok', 140000, 'Tela absorción humedad', 1, 8, NULL),
(25, 'Termo deportivo', 'Nike', 45000, 'Acero inoxidable', 2, 9, NULL),
(26, 'Gorra deportiva', 'Puma', 40000, 'Ajustable', 2, 9, NULL),
(27, 'Protector bucal', 'Everlast', 25000, 'Protección dental', 1, 10, NULL),
(28, 'Rodilleras', 'Reebok', 60000, 'Soporte deportivo', 1, 10, NULL),
(29, 'Elíptica doméstica', 'ProFit', 1800000, 'Equipo cardio', 1, 11, NULL),
(30, 'Reloj Inteligente Deportivo', 'Garmin', 1200000, 'Monitoreo ritmo cardíaco', 2, 11, NULL),
(31, 'Plataforma Aeróbica', 'ProFit', 160000, 'Altura ajustable 3 niveles', 1, 12, NULL),
(32, 'Rueda Abdominal Dual', 'BodyFit', 42000, 'Core reforzado', 2, 12, NULL),
(33, 'Proteína de Suero 2lb', 'Optimum', 190000, 'Proteína de suero pura', 1, 13, NULL),
(34, 'Creatina Micronizada', 'Muscletech', 95000, 'Fuerza explosiva', 2, 13, NULL),
(35, 'Banda de Frecuencia', 'Polar', 280000, 'Conectividad Bluetooth', 1, 14, NULL),
(36, 'Toalla Microfibra', 'Jadda', 35000, 'Secado rápido', 1, 15, NULL),
(37, 'Kit Boxeo Iniciación', 'Everlast', 350000, 'Pack completo', 1, 15, NULL),
(38, 'Balón medicinal 5kg', 'Everlast', 120000, 'Entrenamiento funcional', 1, 4, NULL),
(39, 'Camiseta Entrenamiento', 'Nike', 115000, 'Dri-FIT', 1, 8, NULL),
(40, 'Short de Tenis', 'Adidas', 95000, 'Movilidad lateral', 2, 3, NULL),
(41, 'Polo de Tenis', 'Fila', 110000, 'Protección UV', 2, 3, NULL),
(42, 'Guantes Gimnasio', 'Everlast', 45000, 'Ventilación', 1, 4, NULL),
(43, 'Bolsa Hidratación 2L', 'Salomon', 125000, 'Compatible para correr', 2, 3, NULL),
(44, 'Muñequeras', 'Reebok', 25000, 'Algodón', 1, 10, NULL),
(45, 'Balón de Fútbol Entrenamiento', 'Adidas', 135000, 'Balón resistente para entrenamientos', 1, 1, NULL),
(46, 'Balón de Fútbol Premier', 'Nike', 180000, 'Balón de fútbol para competición', 2, 1, NULL),
(47, 'Guayos Predator Precisión', 'Adidas', 420000, 'Guayos profesionales para césped natural', 1, 1, NULL),
(48, 'Guayos Mercurial Vapor', 'Nike', 450000, 'Guayos ligeros para velocidad', 2, 1, NULL),
(49, 'Guantes de Portero Profesional', 'Puma', 310000, 'Guantes profesionales con gran agarre', 1, 1, NULL),
(50, 'Medias Antideslizantes Fútbol', 'Adidas', 55000, 'Medias deportivas con zonas de agarre', 2, 1, NULL),
(51, 'Balón de Baloncesto Urbano', 'Spalding', 95000, 'Balón resistente para exteriores', 2, 2, NULL),
(52, 'Balón de Baloncesto para Interior', 'Nike', 145000, 'Balón para cancha cubierta', 1, 2, NULL),
(53, 'Aro de Baloncesto Portátil', 'Spalding', 650000, 'Aro ajustable para entrenamiento', 2, 2, NULL),
(54, 'Muñequeras Baloncesto', 'Nike', 45000, 'Muñequeras absorbentes para jugadores', 1, 2, NULL),
(55, 'Tenis Pegasus para Correr', 'Nike', 520000, 'Tenis para entrenamiento diario', 1, 3, NULL),
(56, 'Tenis Adizero para Correr', 'Adidas', 580000, 'Tenis ligeros para velocidad', 2, 3, NULL),
(57, 'Tenis Floatride para Correr', 'Reebok', 390000, 'Amortiguación para largas distancias', 1, 3, NULL),
(58, 'Camiseta Transpirable para Correr', 'Puma', 95000, 'Camiseta transpirable para correr', 2, 3, NULL),
(59, 'Pantaloneta para Correr de Alto Rendimiento', 'Nike', 110000, 'Short ligero para entrenamiento', 1, 3, NULL),
(60, 'Medias de Compresión para Correr', 'Adidas', 65000, 'Medias deportivas de compresión', 2, 3, NULL),
(61, 'Pesa Rusa 8kg', 'BodyFit', 85000, 'Pesa rusa para entrenamiento funcional', 1, 4, NULL),
(62, 'Pesa Rusa 12kg', 'BodyFit', 115000, 'Peso ruso para ejercicios de fuerza', 2, 4, NULL),
(63, 'Banda Elástica Resistencia', 'Everlast', 45000, 'Banda para entrenamiento muscular', 1, 4, NULL),
(64, 'Kit de Bandas Elásticas', 'BodyFit', 90000, 'Kit de cinco bandas de resistencia', 2, 4, NULL),
(65, 'Barra Olímpica', 'BodyFit', 450000, 'Barra para levantamiento de pesas', 1, 4, NULL),
(66, 'Discos Olímpicos 10kg', 'BodyFit', 180000, 'Disco de peso para entrenamiento', 2, 4, NULL),
(67, 'Aletas de Natación para Entrenamiento', 'Speedo', 115000, 'Aletas para entrenamiento acuático', 2, 5, NULL),
(68, 'Tabla de Natación para Entrenamiento', 'Speedo', 75000, 'Tabla para ejercicios de piernas', 1, 5, NULL),
(69, 'Flotador de Natación para Piernas', 'Speedo', 65000, 'Accesorio para entrenamiento de brazos', 2, 5, NULL),
(70, 'Traje de Natación Deportivo', 'Speedo', 220000, 'Traje de baño para entrenamiento', 1, 5, NULL),
(71, 'Casco Ciclismo Urbano', 'Bell', 190000, 'Casco ligero para ciclismo urbano', 2, 6, NULL),
(72, 'Casco Ciclismo Montaña', 'Giant', 280000, 'Casco para ciclismo de montaña', 1, 6, NULL),
(73, 'Luz LED Bicicleta', 'Giant', 65000, 'Luz recargable para bicicleta', 2, 6, NULL),
(74, 'Porta Botella Bicicleta', 'Giant', 45000, 'Soporte para botella deportiva', 1, 6, NULL),
(75, 'Arnés Escalada Deportivo', 'Petzl', 380000, 'Arnés ajustable para escalada', 2, 7, NULL),
(76, 'Mosquetón Seguridad', 'Black Diamond', 120000, 'Mosquetón de alta resistencia', 1, 7, NULL),
(77, 'Magnesiera Escalada', 'Black Diamond', 85000, 'Bolsa para magnesio de escalada', 2, 7, NULL),
(78, 'Cintas Exprés de Escalada', 'Petzl', 180000, 'Set de cintas para escalada', 1, 7, NULL),
(79, 'Pantalón Deportivo', 'Adidas', 160000, 'Pantalón cómodo para entrenamiento', 1, 8, NULL),
(80, 'Camiseta Compresión', 'Nike', 135000, 'Camiseta ajustada de compresión', 2, 8, NULL),
(81, 'Blusa Deportiva', 'Reebok', 105000, 'Blusa deportiva de alta comodidad', 1, 8, NULL),
(82, 'Pantaloneta Deportiva', 'Puma', 90000, 'Short ligero para entrenamiento', 2, 8, NULL),
(83, 'Botella Deportiva 750ml', 'Nike', 55000, 'Botella reutilizable para entrenamiento', 1, 9, NULL),
(84, 'Mochila Deportiva', 'Adidas', 180000, 'Mochila para gimnasio y entrenamiento', 2, 9, NULL),
(85, 'Canguro Deportivo', 'Puma', 75000, 'Riñonera para actividades deportivas', 1, 9, NULL),
(86, 'Banda para Cabeza', 'Nike', 35000, 'Banda absorbente para entrenamiento', 2, 9, NULL),
(87, 'Tobillera Deportiva', 'Reebok', 55000, 'Soporte para tobillo durante ejercicio', 1, 10, NULL),
(88, 'Codera Deportiva', 'Everlast', 60000, 'Protección y soporte para codo', 2, 10, NULL),
(89, 'Faja Deportiva', 'Reebok', 95000, 'Soporte lumbar para entrenamiento', 1, 10, NULL),
(90, 'Vendaje Deportivo', 'Everlast', 30000, 'Vendaje elástico para entrenamiento', 2, 10, NULL),
(91, 'Bicicleta Estática', 'ProFit', 1250000, 'Bicicleta para entrenamiento cardiovascular', 1, 11, NULL),
(92, 'Caminadora Eléctrica', 'ProFit', 2800000, 'Caminadora para entrenamiento en casa', 2, 11, NULL),
(93, 'Bicicleta Estática de Spinning', 'ProFit', 1750000, 'Bicicleta profesional de spinning', 1, 11, NULL),
(94, 'Plataforma Aeróbica Profesional', 'ProFit', 210000, 'Plataforma ajustable para entrenamiento', 2, 12, NULL),
(95, 'Balón Bosu', 'BodyFit', 320000, 'Plataforma para equilibrio y estabilidad', 1, 12, NULL),
(96, 'Cuerda de Batalla 10m', 'BodyFit', 250000, 'Cuerda para entrenamiento funcional', 2, 12, NULL),
(97, 'Disco Deslizante para Entrenamiento', 'BodyFit', 45000, 'Discos para entrenamiento funcional', 1, 12, NULL),
(98, 'Proteína de Suero 5lb', 'Optimum', 360000, 'Proteína de suero para recuperación muscular', 1, 13, NULL),
(99, 'Aminoácidos BCAA 300g', 'Muscletech', 125000, 'Suplemento para recuperación deportiva', 2, 13, NULL),
(100, 'Pre Entrenamiento 300g', 'Muscletech', 145000, 'Suplemento para energía durante el entrenamiento', 1, 13, NULL),
(101, 'Reloj Deportivo GPS', 'Garmin', 1450000, 'Reloj con GPS y monitoreo deportivo', 2, 14, NULL),
(102, 'Sensor de Velocidad Ciclismo', 'Garmin', 280000, 'Sensor para medir velocidad y distancia', 1, 14, NULL),
(103, 'Mochila Boxeo', 'Everlast', 180000, 'Bolso deportivo para equipo de boxeo', 1, 15, NULL),
(104, 'Cuerda de Boxeo Profesional', 'Everlast', 55000, 'Cuerda rápida para entrenamiento de boxeo', 2, 15, NULL);

-- -------------------------------------------------------------------------
-- VARIANTES: colores + tallas/tamaños con stock individual
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES

(1,'Blanco','Talla','39',6),
(1,'Blanco','Talla','40',12),
(1,'Blanco','Talla','41',18),
(1,'Blanco','Talla','42',22),
(1,'Blanco','Talla','43',10),
(1,'Negro','Talla','39',5),
(1,'Negro','Talla','40',10),
(1,'Negro','Talla','41',15),
(1,'Negro','Talla','42',20),
(1,'Negro','Talla','43',8),
(1,'Rojo','Talla','39',4),
(1,'Rojo','Talla','40',8),
(1,'Rojo','Talla','41',12),
(1,'Rojo','Talla','42',15),
(1,'Rojo','Talla','43',6),

(2,'Blanco/Multicolor','Tamaño','Talla 5',20),

(3,'Negro','Talla','S',20),
(3,'Negro','Talla','M',30),
(3,'Negro','Talla','L',18),
(3,'Blanco','Talla','S',15),
(3,'Blanco','Talla','M',25),
(3,'Blanco','Talla','L',12),

(4,'Naranja','Talla','7',3),
(4,'Naranja','Talla','8',6),
(4,'Naranja','Talla','9',12),
(4,'Naranja','Talla','10',8),
(4,'Naranja','Talla','11',4),
(4,'Negro','Talla','7',4),
(4,'Negro','Talla','8',8),
(4,'Negro','Talla','9',14),
(4,'Negro','Talla','10',10),
(4,'Negro','Talla','11',5),
(4,'Rojo','Talla','7',2),
(4,'Rojo','Talla','8',5),
(4,'Rojo','Talla','9',10),
(4,'Rojo','Talla','10',7),
(4,'Rojo','Talla','11',3),

(5,'Amarillo','Talla','S',12),
(5,'Amarillo','Talla','M',20),
(5,'Amarillo','Talla','L',35),
(5,'Amarillo','Talla','XL',14),
(5,'Blanco','Talla','S',10),
(5,'Blanco','Talla','M',18),
(5,'Blanco','Talla','L',28),
(5,'Blanco','Talla','XL',12),
(5,'Negro','Talla','S',8),
(5,'Negro','Talla','M',15),
(5,'Negro','Talla','L',25),
(5,'Negro','Talla','XL',10),
(5,'Rojo','Talla','S',9),
(5,'Rojo','Talla','M',16),
(5,'Rojo','Talla','L',30),
(5,'Rojo','Talla','XL',11),

(6,'Naranja','Tamaño','Talla 7',50),

(7,'Negro','Talla','40',4),
(7,'Negro','Talla','41',10),
(7,'Negro','Talla','42',18),
(7,'Negro','Talla','43',6),
(7,'Rojo','Talla','40',3),
(7,'Rojo','Talla','41',8),
(7,'Rojo','Talla','42',14),
(7,'Rojo','Talla','43',5),
(7,'Blanco','Talla','40',5),
(7,'Blanco','Talla','41',12),
(7,'Blanco','Talla','42',20),
(7,'Blanco','Talla','43',8),
(7,'Azul','Talla','40',4),
(7,'Azul','Talla','41',9),
(7,'Azul','Talla','42',16),
(7,'Azul','Talla','43',6),

(8,'Negro','Tamaño','Única',100),

(9,'Gris','Talla','S',18),
(9,'Gris','Talla','M',28),
(9,'Gris','Talla','L',50),
(9,'Gris','Talla','XL',22),
(9,'Negro','Talla','S',15),
(9,'Negro','Talla','M',25),
(9,'Negro','Talla','L',40),
(9,'Negro','Talla','XL',18),
(9,'Azul','Talla','S',12),
(9,'Azul','Talla','M',22),
(9,'Azul','Talla','L',35),
(9,'Azul','Talla','XL',16),

(10,'Gris','Talla','38',5),
(10,'Gris','Talla','39',20),
(10,'Gris','Talla','40',12),
(10,'Gris','Talla','41',8),
(10,'Gris','Talla','42',6),
(10,'Negro','Talla','38',6),
(10,'Negro','Talla','39',18),
(10,'Negro','Talla','40',15),
(10,'Negro','Talla','41',10),
(10,'Negro','Talla','42',8),
(10,'Blanco','Talla','38',7),
(10,'Blanco','Talla','39',22),
(10,'Blanco','Talla','40',14),
(10,'Blanco','Talla','41',9),
(10,'Blanco','Talla','42',7),

(11,'Azul','Talla','40',5),
(11,'Azul','Talla','41',9),
(11,'Azul','Talla','42',12),
(11,'Azul','Talla','43',8),
(11,'Azul','Talla','44',4),
(11,'Negro','Talla','40',6),
(11,'Negro','Talla','41',10),
(11,'Negro','Talla','42',15),
(11,'Negro','Talla','43',10),
(11,'Negro','Talla','44',5),
(11,'Rojo','Talla','40',4),
(11,'Rojo','Talla','41',7),
(11,'Rojo','Talla','42',10),
(11,'Rojo','Talla','43',6),
(11,'Rojo','Talla','44',3),

(12,'Azul Oscuro','Talla','S',14),
(12,'Azul Oscuro','Talla','M',35),
(12,'Azul Oscuro','Talla','L',20),
(12,'Azul Oscuro','Talla','XL',10),
(12,'Negro','Talla','S',12),
(12,'Negro','Talla','M',28),
(12,'Negro','Talla','L',18),
(12,'Negro','Talla','XL',8),
(12,'Gris','Talla','S',10),
(12,'Gris','Talla','M',25),
(12,'Gris','Talla','L',15),
(12,'Gris','Talla','XL',7),

(13,'Negro','Tamaño','Única',100),

(14,'Gris','Peso','5kg',60),

(15,'Negro','Peso','20kg',20),

(16,'Morado','Tamaño','Única',40),

(17,'Humo','Tamaño','Única',40),

(18,'Azul','Tamaño','Única',100),

(19,'Negro','Talla','S',6),
(19,'Negro','Talla','M',18),
(19,'Negro','Talla','L',10),
(19,'Rojo','Talla','S',4),
(19,'Rojo','Talla','M',12),
(19,'Rojo','Talla','L',8),
(19,'Azul','Talla','S',5),
(19,'Azul','Talla','M',14),
(19,'Azul','Talla','L',9),

(20,'Rojo','Talla','M',12),
(20,'Rojo','Talla','L',35),
(20,'Rojo','Talla','XL',8),
(20,'Negro','Talla','M',15),
(20,'Negro','Talla','L',40),
(20,'Negro','Talla','XL',10),
(20,'Azul','Talla','M',10),
(20,'Azul','Talla','L',30),
(20,'Azul','Talla','XL',6),

(21,'Naranja','Tamaño','Única',10),

(22,'Azul','Longitud','50m',5),

(23,'Blanco','Talla','S',8),
(23,'Blanco','Talla','M',14),
(23,'Blanco','Talla','L',25),
(23,'Blanco','Talla','XL',20),
(23,'Negro','Talla','S',10),
(23,'Negro','Talla','M',18),
(23,'Negro','Talla','L',30),
(23,'Negro','Talla','XL',22),
(23,'Azul','Talla','S',6),
(23,'Azul','Talla','M',12),
(23,'Azul','Talla','L',22),
(23,'Azul','Talla','XL',18),

(24,'Vino Tinto','Talla','S',30),
(24,'Vino Tinto','Talla','M',18),
(24,'Vino Tinto','Talla','L',10),
(24,'Vino Tinto','Talla','XL',6),
(24,'Negro','Talla','S',35),
(24,'Negro','Talla','M',22),
(24,'Negro','Talla','L',14),
(24,'Negro','Talla','XL',8),
(24,'Gris','Talla','S',25),
(24,'Gris','Talla','M',15),
(24,'Gris','Talla','L',8),
(24,'Gris','Talla','XL',5),

(25,'Rojo','Capacidad','1L',90),

(26,'Blanco','Tamaño','Única',120),

(27,'Transparente','Tamaño','Única',150),

(28,'Negro','Talla','S',25),
(28,'Negro','Talla','M',85),
(28,'Negro','Talla','L',30),
(28,'Azul','Talla','S',18),
(28,'Azul','Talla','M',50),
(28,'Azul','Talla','L',20),
(28,'Rojo','Talla','S',15),
(28,'Rojo','Talla','M',40),
(28,'Rojo','Talla','L',18),

(29,'Negro','Tamaño','Única',8),

(30,'Negro','Tamaño','Única',5),

(31,'Gris','Altura','3 niveles',12),
(31,'Negro','Altura','3 niveles',12),

(32,'Negro','Modelo','Dual',20),
(32,'Rojo','Modelo','Dual',25),

(33,'Vainilla','Presentación','2lb',30),

(34,'Sin sabor','Presentación','300g',50),

(35,'Negro','Conectividad','Bluetooth',12),

(36,'Azul Rey','Tamaño','L',150),

(37,'Rojo','Peso','10oz',6),
(37,'Rojo','Peso','12oz',12),
(37,'Rojo','Peso','14oz',6),
(37,'Negro','Peso','10oz',8),
(37,'Negro','Peso','12oz',15),
(37,'Negro','Peso','14oz',8),
(37,'Azul','Peso','10oz',5),
(37,'Azul','Peso','12oz',10),
(37,'Azul','Peso','14oz',5),

(38,'Gris','Peso','5kg',20),

(39,'Verde Lima','Talla','S',50),
(39,'Verde Lima','Talla','M',25),
(39,'Verde Lima','Talla','L',18),
(39,'Verde Lima','Talla','XL',10),
(39,'Blanco','Talla','S',40),
(39,'Blanco','Talla','M',20),
(39,'Blanco','Talla','L',15),
(39,'Blanco','Talla','XL',8),
(39,'Negro','Talla','S',35),
(39,'Negro','Talla','M',18),
(39,'Negro','Talla','L',12),
(39,'Negro','Talla','XL',6),

(40,'Negro','Talla','S',20),
(40,'Negro','Talla','M',45),
(40,'Negro','Talla','L',25),
(40,'Negro','Talla','XL',12),
(40,'Blanco','Talla','S',18),
(40,'Blanco','Talla','M',38),
(40,'Blanco','Talla','L',22),
(40,'Blanco','Talla','XL',10),
(40,'Azul','Talla','S',15),
(40,'Azul','Talla','M',35),
(40,'Azul','Talla','L',20),
(40,'Azul','Talla','XL',8),

(41,'Blanco','Talla','M',12),
(41,'Blanco','Talla','L',28),
(41,'Blanco','Talla','XL',14),
(41,'Negro','Talla','M',10),
(41,'Negro','Talla','L',24),
(41,'Negro','Talla','XL',12),
(41,'Azul','Talla','M',8),
(41,'Azul','Talla','L',20),
(41,'Azul','Talla','XL',10),

(42,'Gris','Talla','S',20),
(42,'Gris','Talla','M',30),
(42,'Gris','Talla','L',15),
(42,'Negro','Talla','S',25),
(42,'Negro','Talla','M',35),
(42,'Negro','Talla','L',18),
(42,'Rojo','Talla','S',15),
(42,'Rojo','Talla','M',25),
(42,'Rojo','Talla','L',12),

(43,'Azul','Capacidad','2L',20),

(44,'Blanco','Tamaño','Única',200);

-- -------------------------------------------------------------------------
-- VARIANTES NUEVAS: 161 variantes para productos IDs 45-104 (60 productos, tallas/colores según tipo)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES

-- Producto 47: Guayos Predator Accuracy (6 tallas x 2 colores = 12 variantes)
(47, 'Café', 'Talla', '39', 50),
(47, 'Café', 'Talla', '40', 45),
(47, 'Café', 'Talla', '41', 40),
(47, 'Café', 'Talla', '42', 35),
(47, 'Café', 'Talla', '43', 30),
(47, 'Café', 'Talla', '44', 25),
(47, 'Negro', 'Talla', '39', 48),
(47, 'Negro', 'Talla', '40', 42),
(47, 'Negro', 'Talla', '41', 38),
(47, 'Negro', 'Talla', '42', 33),
(47, 'Negro', 'Talla', '43', 28),
(47, 'Negro', 'Talla', '44', 20),

-- Producto 48: Guayos Mercurial Vapor (6 tallas x 2 colores = 12 variantes)
(48, 'Café', 'Talla', '39', 48),
(48, 'Café', 'Talla', '40', 42),
(48, 'Café', 'Talla', '41', 38),
(48, 'Café', 'Talla', '42', 33),
(48, 'Café', 'Talla', '43', 28),
(48, 'Café', 'Talla', '44', 20),
(48, 'Negro', 'Talla', '39', 45),
(48, 'Negro', 'Talla', '40', 40),
(48, 'Negro', 'Talla', '41', 35),
(48, 'Negro', 'Talla', '42', 30),
(48, 'Negro', 'Talla', '43', 25),
(48, 'Negro', 'Talla', '44', 18),

-- Producto 55: Tenis Pegasus para Correr (6 tallas x 2 colores = 12 variantes)
(55, 'Blanco', 'Talla', '40', 30),
(55, 'Blanco', 'Talla', '41', 28),
(55, 'Blanco', 'Talla', '42', 25),
(55, 'Blanco', 'Talla', '43', 22),
(55, 'Blanco', 'Talla', '44', 20),
(55, 'Blanco', 'Talla', '45', 18),
(55, 'Negro', 'Talla', '40', 25),
(55, 'Negro', 'Talla', '41', 23),
(55, 'Negro', 'Talla', '42', 20),
(55, 'Negro', 'Talla', '43', 18),
(55, 'Negro', 'Talla', '44', 16),
(55, 'Negro', 'Talla', '45', 14),

-- Producto 56: Tenis Adizero para Correr (6 tallas x 2 colores = 12 variantes)
(56, 'Blanco', 'Talla', '40', 28),
(56, 'Blanco', 'Talla', '41', 26),
(56, 'Blanco', 'Talla', '42', 23),
(56, 'Blanco', 'Talla', '43', 20),
(56, 'Blanco', 'Talla', '44', 18),
(56, 'Blanco', 'Talla', '45', 15),
(56, 'Negro', 'Talla', '40', 24),
(56, 'Negro', 'Talla', '41', 22),
(56, 'Negro', 'Talla', '42', 19),
(56, 'Negro', 'Talla', '43', 16),
(56, 'Negro', 'Talla', '44', 14),
(56, 'Negro', 'Talla', '45', 12),

-- Producto 57: Tenis Floatride para Correr (6 tallas x 2 colores = 12 variantes)
(57, 'Blanco', 'Talla', '40', 35),
(57, 'Blanco', 'Talla', '41', 32),
(57, 'Blanco', 'Talla', '42', 28),
(57, 'Blanco', 'Talla', '43', 25),
(57, 'Blanco', 'Talla', '44', 22),
(57, 'Blanco', 'Talla', '45', 20),
(57, 'Negro', 'Talla', '40', 30),
(57, 'Negro', 'Talla', '41', 27),
(57, 'Negro', 'Talla', '42', 23),
(57, 'Negro', 'Talla', '43', 20),
(57, 'Negro', 'Talla', '44', 17),
(57, 'Negro', 'Talla', '45', 15),

-- Producto 79: Pantalón Deportivo (4 tallas x 2 colores = 8 variantes)
(79, 'Negro', 'Talla', 'S', 20),
(79, 'Negro', 'Talla', 'M', 25),
(79, 'Negro', 'Talla', 'L', 30),
(79, 'Negro', 'Talla', 'XL', 15),
(79, 'Gris', 'Talla', 'S', 18),
(79, 'Gris', 'Talla', 'M', 22),
(79, 'Gris', 'Talla', 'L', 27),
(79, 'Gris', 'Talla', 'XL', 12),

-- Producto 80: Camiseta Compresión (4 tallas x 2 colores = 8 variantes)
(80, 'Negro', 'Talla', 'S', 30),
(80, 'Negro', 'Talla', 'M', 35),
(80, 'Negro', 'Talla', 'L', 40),
(80, 'Negro', 'Talla', 'XL', 25),
(80, 'Blanco', 'Talla', 'S', 28),
(80, 'Blanco', 'Talla', 'M', 33),
(80, 'Blanco', 'Talla', 'L', 38),
(80, 'Blanco', 'Talla', 'XL', 22),

-- Producto 81: Blusa Deportiva (4 tallas x 2 colores = 8 variantes)
(81, 'Negro', 'Talla', 'S', 25),
(81, 'Negro', 'Talla', 'M', 30),
(81, 'Negro', 'Talla', 'L', 35),
(81, 'Negro', 'Talla', 'XL', 20),
(81, 'Blanco', 'Talla', 'S', 23),
(81, 'Blanco', 'Talla', 'M', 28),
(81, 'Blanco', 'Talla', 'L', 33),
(81, 'Blanco', 'Talla', 'XL', 18),

-- Producto 82: Short Deportivo (4 tallas x 2 colores = 8 variantes)
(82, 'Negro', 'Talla', 'S', 22),
(82, 'Negro', 'Talla', 'M', 27),
(82, 'Negro', 'Talla', 'L', 32),
(82, 'Negro', 'Talla', 'XL', 18),
(82, 'Azul', 'Talla', 'S', 20),
(82, 'Azul', 'Talla', 'M', 25),
(82, 'Azul', 'Talla', 'L', 30),
(82, 'Azul', 'Talla', 'XL', 15),

-- Producto 45: Balón Entrenamiento (1 variante)
(45, 'Multicolor', 'Talla', '5', 30),

-- Producto 49: Guantes Portero (1 variante)
(49, 'Negro', 'Talla', 'Única', 20),

-- Productos 67-70: Natación (1 variante cada uno)
(67, 'Amarillo', 'Talla', 'Única', 25),
(68, 'Verde', 'Talla', 'Única', 25),
(69, 'Naranja', 'Talla', 'Única', 25),
(70, 'Azul', 'Talla', 'Única', 25),

-- Productos 71-74: Cascos ciclismo (1 variante cada uno)
(71, 'Rojo', 'Talla', 'Única', 15),
(72, 'Azul', 'Talla', 'Única', 15),
(73, 'Negro', 'Talla', 'Única', 20),
(74, 'Plata', 'Talla', 'Única', 20),

-- Productos 75-78: Equipamiento escalada (1 variante cada uno)
(75, 'Rojo', 'Talla', 'Única', 10),
(76, 'Negro', 'Talla', 'Única', 10),
(77, 'Amarillo', 'Talla', 'Única', 10),
(78, 'Blanco', 'Talla', 'Única', 10),

-- Productos 83-86: Accesorios (1 variante cada uno)
(83, 'Rojo', 'Talla', 'Única', 50),
(84, 'Azul', 'Talla', 'Única', 50),
(85, 'Verde', 'Talla', 'Única', 40),
(86, 'Naranja', 'Talla', 'Única', 40),

-- Productos 87-90: Protección (1 variante cada uno)
(87, 'Negro', 'Talla', 'Única', 30),
(88, 'Azul', 'Talla', 'Única', 30),
(89, 'Rojo', 'Talla', 'Única', 25),
(90, 'Verde', 'Talla', 'Única', 25),

-- Productos 91-93: Cardio (1 variante cada uno)
(91, 'Negro', 'Talla', 'Única', 15),
(92, 'Plateado', 'Talla', 'Única', 12),
(93, 'Negro', 'Talla', 'Única', 15),

-- Productos 94-97: Hogar fitness (1 variante cada uno)
(94, 'Negro', 'Talla', 'Única', 8),
(95, 'Azul', 'Talla', 'Única', 8),
(96, 'Rojo', 'Talla', 'Única', 8),
(97, 'Gris', 'Talla', 'Única', 8),

-- Productos 98-100: Suplementos (presentación por peso)
(98, 'Vainilla', 'Presentación', '5lb', 100),
(99, 'Limón', 'Presentación', '300g', 150),
(100, 'Frutos Rojos', 'Presentación', '300g', 120),

-- Productos 101-102: Tecnología (1 variante cada uno)
(101, 'Negro', 'Talla', 'Única', 25),
(102, 'Plateado', 'Talla', 'Única', 20),

-- Productos 103-104: Ofertas (1 variante cada uno)
(103, 'Rojo', 'Talla', 'Única', 15),
(104, 'Azul', 'Talla', 'Única', 12),

-- Producto 46: Balón de Fútbol Premier (balón reglamentario Talla 5)
(46, 'Blanco', 'Tamaño', 'Talla 5', 30),

-- Producto 50: Medias Antideslizantes Fútbol (S/M/L)
(50, 'Negro', 'Talla', 'S', 22),
(50, 'Negro', 'Talla', 'M', 30),
(50, 'Negro', 'Talla', 'L', 18),

-- Producto 51: Balón de Baloncesto Urbano (Talla 7)
(51, 'Naranja', 'Tamaño', 'Talla 7', 35),

-- Producto 52: Balón de Baloncesto para Interior (Talla 7)
(52, 'Marrón', 'Tamaño', 'Talla 7', 30),

-- Producto 53: Aro de Baloncesto Portátil (única)
(53, 'Naranja', 'Tamaño', 'Única', 8),

-- Producto 54: Muñequeras Baloncesto (única)
(54, 'Negro', 'Tamaño', 'Única', 40),

-- Producto 58: Camiseta Transpirable para Correr (S/M/L/XL x 2 colores)
(58, 'Negro', 'Talla', 'S', 22),
(58, 'Negro', 'Talla', 'M', 30),
(58, 'Negro', 'Talla', 'L', 35),
(58, 'Negro', 'Talla', 'XL', 18),
(58, 'Blanco', 'Talla', 'S', 20),
(58, 'Blanco', 'Talla', 'M', 28),
(58, 'Blanco', 'Talla', 'L', 32),
(58, 'Blanco', 'Talla', 'XL', 15),

-- Producto 59: Pantaloneta para Correr de Alto Rendimiento (S/M/L/XL x 2 colores)
(59, 'Negro', 'Talla', 'S', 20),
(59, 'Negro', 'Talla', 'M', 28),
(59, 'Negro', 'Talla', 'L', 32),
(59, 'Negro', 'Talla', 'XL', 16),
(59, 'Azul', 'Talla', 'S', 18),
(59, 'Azul', 'Talla', 'M', 26),
(59, 'Azul', 'Talla', 'L', 30),
(59, 'Azul', 'Talla', 'XL', 14),

-- Producto 60: Medias de Compresión para Correr (S/M/L)
(60, 'Negro', 'Talla', 'S', 20),
(60, 'Negro', 'Talla', 'M', 28),
(60, 'Negro', 'Talla', 'L', 18),

-- Producto 61: Pesa Rusa 8kg (peso fijo)
(61, 'Negro', 'Peso', '8kg', 35),

-- Producto 62: Pesa Rusa 12kg (peso fijo)
(62, 'Negro', 'Peso', '12kg', 30),

-- Producto 63: Banda Elástica Resistencia (única)
(63, 'Rojo', 'Tamaño', 'Única', 40),

-- Producto 64: Kit de Bandas Elásticas (set 5 bandas)
(64, 'Multicolor', 'Tamaño', 'Única', 25),

-- Producto 65: Barra Olímpica (única)
(65, 'Plateado', 'Tamaño', 'Única', 12),

-- Producto 66: Discos Olímpicos 10kg (peso 10kg)
(66, 'Negro', 'Peso', '10kg', 30);

-- -------------------------------------------------------------------------
-- VARIANTES COMPLETAS: +189 variantes para los artículos que tenían una sola
-- opción (tallas, pesos, colores, capacidades, longitudes y presentaciones
-- según cada tipo de producto; respeta el NOMBRE_ATRIBUTO existente de cada
-- artículo para agrupar bien en el selector). INSERT IGNORE: idempotente.
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES

-- Producto 2: Balón Al Rihla Pro (tamaños + colores)
(2, 'Naranja/Blanco', 'Tamaño', 'Talla 4', 25),
(2, 'Negro', 'Tamaño', 'Talla 5', 18),
(2, 'Verde Limón', 'Tamaño', 'Talla 5', 22),

-- Producto 6: Balón baloncesto (tamaños + colores)
(6, 'Azul/Blanco', 'Tamaño', 'Talla 7', 15),
(6, 'Marrón', 'Tamaño', 'Talla 7', 12),
(6, 'Naranja', 'Tamaño', 'Talla 6', 18),

-- Producto 8: Malla porta balones (colores)
(8, 'Azul', 'Tamaño', 'Única', 80),
(8, 'Rojo', 'Tamaño', 'Única', 60),

-- Producto 13: Cuerda para saltar (colores + longitudes)
(13, 'Azul', 'Tamaño', '2.5m', 40),
(13, 'Rojo', 'Tamaño', '3m', 35),
(13, 'Morado', 'Tamaño', 'Única', 50),

-- Productos 14-15: Pesas y Mancuernas (colores)
(14, 'Negro', 'Peso', '5kg', 40),
(14, 'Azul', 'Peso', '5kg', 35),
(15, 'Gris', 'Peso', '20kg', 15),
(15, 'Azul', 'Peso', '20kg', 12),

-- Productos 16-18: Yoga y Natación (colores)
(16, 'Azul', 'Tamaño', 'Única', 35),
(16, 'Verde', 'Tamaño', 'Única', 30),
(16, 'Negro', 'Tamaño', 'Única', 28),
(16, 'Rosado', 'Tamaño', 'Única', 26),
(17, 'Azul', 'Tamaño', 'Única', 30),
(17, 'Negro', 'Tamaño', 'Única', 35),
(17, 'Transparente', 'Tamaño', 'Única', 28),
(18, 'Negro', 'Tamaño', 'Única', 60),
(18, 'Rosa', 'Tamaño', 'Única', 55),
(18, 'Naranja', 'Tamaño', 'Única', 58),

-- Productos 21-22: Escalada (colores + longitudes)
(21, 'Rojo', 'Tamaño', 'Única', 12),
(21, 'Blanco', 'Tamaño', 'Única', 10),
(21, 'Azul', 'Tamaño', 'Única', 9),
(22, 'Negro', 'Longitud', '50m', 15),
(22, 'Rojo', 'Longitud', '60m', 10),
(22, 'Blanco', 'Longitud', '70m', 8),

-- Productos 25-27: Accesorios y protección (colores + capacidades + tallas)
(25, 'Negro', 'Capacidad', '1L', 45),
(25, 'Azul', 'Capacidad', '1L', 40),
(25, 'Verde', 'Capacidad', '750ml', 38),
(25, 'Plata', 'Capacidad', '500ml', 30),
(26, 'Negro', 'Tamaño', 'Única', 90),
(26, 'Azul Marino', 'Tamaño', 'Única', 80),
(26, 'Rojo', 'Tamaño', 'Única', 75),
(26, 'Verde', 'Tamaño', 'Única', 60),
(27, 'Naranja', 'Tamaño', 'Adulto', 60),
(27, 'Azul', 'Tamaño', 'Adulto', 55),
(27, 'Rojo', 'Tamaño', 'Niño', 40),

-- Productos 29-30: Cardio (colores + tamaños de pantalla)
(29, 'Plata', 'Tamaño', 'Única', 6),
(29, 'Gris', 'Tamaño', 'Única', 5),
(30, 'Plata', 'Tamaño', '45mm', 4),
(30, 'Oro Rosa', 'Tamaño', '44mm', 3),
(30, 'Blanco', 'Tamaño', '42mm', 4),

-- Productos 31-32: Hogar fitness (colores + niveles)
(31, 'Verde', 'Altura', '3 niveles', 10),
(31, 'Rojo', 'Altura', '3 niveles', 9),
(31, 'Gris', 'Altura', '2 niveles', 8),
(32, 'Azul', 'Modelo', 'Dual', 18),
(32, 'Gris', 'Modelo', 'Dual', 15),

-- Productos 33-34: Suplementos (sabores + presentaciones)
(33, 'Chocolate', 'Presentación', '2lb', 30),
(33, 'Fresa', 'Presentación', '2lb', 25),
(34, 'Sin sabor', 'Presentación', '500g', 30),
(34, 'Sabor limón', 'Presentación', '300g', 20),
(34, 'Sin sabor', 'Presentación', '1kg', 18),

-- Productos 35-36: Tecnología y ofertas (colores + tamaños)
(35, 'Azul', 'Conectividad', 'Bluetooth', 10),
(35, 'Gris', 'Conectividad', 'Bluetooth', 9),
(36, 'Verde', 'Tamaño', 'L', 80),
(36, 'Gris', 'Tamaño', 'L', 70),
(36, 'Rosa', 'Tamaño', 'M', 60),
(36, 'Negro', 'Tamaño', 'XL', 50),

-- Productos 38, 43-44: Gimnasio y running (pesos + capacidades + colores)
(38, 'Negro', 'Peso', '3kg', 20),
(38, 'Negro', 'Peso', '8kg', 12),
(38, 'Gris', 'Peso', '10kg', 10),
(43, 'Verde', 'Capacidad', '2L', 20),
(43, 'Negro', 'Capacidad', '2L', 25),
(43, 'Azul', 'Capacidad', '1.5L', 30),
(43, 'Rojo', 'Capacidad', '3L', 15),
(44, 'Negro', 'Tamaño', 'Única', 100),
(44, 'Azul', 'Tamaño', 'Única', 90),
(44, 'Verde', 'Tamaño', 'Única', 80),
(44, 'Rojo', 'Tamaño', 'Única', 75),

-- Productos 45-46: Balones de fútbol (tallas + colores)
(45, 'Blanco', 'Talla', '5', 25),
(45, 'Amarillo', 'Talla', '5', 20),
(45, 'Multicolor', 'Talla', '4', 18),
(46, 'Blanco/Negro', 'Tamaño', 'Talla 5', 22),
(46, 'Verde', 'Tamaño', 'Talla 5', 15),
(46, 'Blanco', 'Tamaño', 'Talla 4', 12),

-- Productos 49, 51-54: Portero y baloncesto (tallas + colores)
(49, 'Verde', 'Talla', '9', 12),
(49, 'Azul', 'Talla', '8', 12),
(49, 'Negro', 'Talla', '10', 10),
(51, 'Azul', 'Tamaño', 'Talla 7', 20),
(51, 'Naranja', 'Tamaño', 'Talla 6', 22),
(52, 'Naranja', 'Tamaño', 'Talla 7', 20),
(52, 'Marrón', 'Tamaño', 'Talla 6', 15),
(53, 'Rojo', 'Tamaño', 'Única', 10),
(53, 'Blanco', 'Tamaño', 'Única', 12),
(54, 'Blanco', 'Tamaño', 'Única', 30),
(54, 'Rojo', 'Tamaño', 'Única', 25),
(54, 'Azul', 'Tamaño', 'Única', 22),

-- Productos 61-65: Gimnasio (colores)
(61, 'Rojo', 'Peso', '8kg', 25),
(61, 'Verde Neón', 'Peso', '8kg', 20),
(61, 'Gris', 'Peso', '8kg', 22),
(62, 'Rojo', 'Peso', '12kg', 20),
(62, 'Verde Neón', 'Peso', '12kg', 18),
(62, 'Gris', 'Peso', '12kg', 19),
(63, 'Azul', 'Tamaño', 'Única', 30),
(63, 'Negro', 'Tamaño', 'Única', 25),
(63, 'Verde', 'Tamaño', 'Única', 22),
(64, 'Azul', 'Tamaño', 'Única', 20),
(64, 'Negro', 'Tamaño', 'Única', 18),
(65, 'Negro', 'Tamaño', 'Única', 6),
(65, 'Dorado', 'Tamaño', 'Única', 5),

-- Productos 66-70: Discos y natación (pesos + tallas + colores)
(66, 'Negro', 'Peso', '5kg', 25),
(66, 'Negro', 'Peso', '15kg', 20),
(67, 'Azul', 'Talla', '38', 20),
(67, 'Azul', 'Talla', '40', 22),
(67, 'Azul', 'Talla', '42', 20),
(67, 'Negro', 'Talla', '44', 18),
(68, 'Azul', 'Talla', 'Única', 20),
(68, 'Rosa', 'Talla', 'Única', 18),
(69, 'Azul', 'Talla', 'Única', 20),
(69, 'Verde', 'Talla', 'Única', 18),
(70, 'Negro', 'Talla', 'S', 18),
(70, 'Negro', 'Talla', 'M', 20),
(70, 'Negro', 'Talla', 'L', 16),
(70, 'Azul', 'Talla', 'M', 15),

-- Productos 71-78: Ciclismo y escalada (tallas + colores + longitudes)
(71, 'Negro', 'Talla', 'S', 10),
(71, 'Negro', 'Talla', 'M', 12),
(71, 'Negro', 'Talla', 'L', 8),
(71, 'Azul', 'Talla', 'M', 9),
(72, 'Verde', 'Talla', 'S', 8),
(72, 'Verde', 'Talla', 'M', 10),
(72, 'Verde', 'Talla', 'L', 7),
(73, 'Rojo', 'Talla', 'Única', 15),
(73, 'Blanco', 'Talla', 'Única', 15),
(74, 'Negro', 'Talla', 'Única', 18),
(74, 'Rojo', 'Talla', 'Única', 15),
(75, 'Negro', 'Talla', 'S', 8),
(75, 'Negro', 'Talla', 'M', 10),
(75, 'Negro', 'Talla', 'L', 6),
(76, 'Plateado', 'Talla', 'Única', 12),
(76, 'Rojo', 'Talla', 'Única', 10),
(77, 'Negro', 'Talla', 'Única', 8),
(77, 'Rojo', 'Talla', 'Única', 7),
(78, 'Blanco', 'Longitud', '12cm', 12),
(78, 'Blanco', 'Longitud', '18cm', 10),

-- Productos 83-90: Accesorios y protección (colores + tallas)
(83, 'Negro', 'Talla', 'Única', 40),
(83, 'Azul', 'Talla', 'Única', 35),
(83, 'Plata', 'Talla', 'Única', 30),
(84, 'Negro', 'Talla', 'Única', 35),
(84, 'Rojo', 'Talla', 'Única', 28),
(84, 'Gris', 'Talla', 'Única', 30),
(85, 'Negro', 'Talla', 'Única', 30),
(85, 'Azul', 'Talla', 'Única', 25),
(86, 'Negro', 'Talla', 'Única', 35),
(86, 'Azul', 'Talla', 'Única', 30),
(86, 'Verde', 'Talla', 'Única', 28),
(87, 'Negro', 'Talla', 'S', 25),
(87, 'Negro', 'Talla', 'M', 30),
(87, 'Negro', 'Talla', 'L', 20),
(88, 'Negro', 'Talla', 'M', 25),
(88, 'Negro', 'Talla', 'L', 20),
(89, 'Negro', 'Talla', 'M', 20),
(89, 'Negro', 'Talla', 'L', 18),
(90, 'Blanco', 'Talla', 'Única', 30),
(90, 'Azul', 'Talla', 'Única', 25),

-- Productos 91-97: Cardio, hogar fitness (colores + longitudes)
(91, 'Gris', 'Talla', 'Única', 10),
(91, 'Rojo', 'Talla', 'Única', 8),
(92, 'Negro', 'Talla', 'Única', 8),
(92, 'Gris', 'Talla', 'Única', 7),
(93, 'Rojo', 'Talla', 'Única', 10),
(93, 'Plata', 'Talla', 'Única', 8),
(94, 'Gris', 'Talla', 'Única', 6),
(94, 'Azul', 'Talla', 'Única', 6),
(95, 'Negro', 'Talla', 'Única', 6),
(95, 'Morado', 'Talla', 'Única', 5),
(96, 'Negro', 'Longitud', '10m', 10),
(96, 'Rojo', 'Longitud', '10m', 8),
(97, 'Azul', 'Talla', 'Única', 10),
(97, 'Negro', 'Talla', 'Única', 10),

-- Productos 98-104: Suplementos y ofertas (sabores + colores)
(98, 'Chocolate', 'Presentación', '5lb', 50),
(98, 'Cookies', 'Presentación', '5lb', 40),
(99, 'Fresa', 'Presentación', '300g', 80),
(99, 'Mora', 'Presentación', '300g', 75),
(99, 'Sandía', 'Presentación', '300g', 60),
(100, 'Limón', 'Presentación', '300g', 55),
(100, 'Sandía', 'Presentación', '300g', 48),
(101, 'Plata', 'Talla', 'Única', 15),
(101, 'Caqui', 'Talla', 'Única', 12),
(101, 'Blanco', 'Talla', 'Única', 10),
(102, 'Negro', 'Talla', 'Única', 18),
(102, 'Azul', 'Talla', 'Única', 15),
(103, 'Negro', 'Talla', 'Única', 12),
(103, 'Azul', 'Talla', 'Única', 10),
(104, 'Rojo', 'Talla', 'Única', 10),
(104, 'Negro', 'Talla', 'Única', 9);

-- -------------------------------------------------------------------------
-- IMÁGENES: 3 imágenes por producto (310 registros), URLs de Cloudinary
-- (el proyecto ya no guarda assets de media en el repo; los assets de las
-- subidas nuevas se guardan en Cloudinary o en disco vía utils/cloudinary.js)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PRODUCTO_IMAGENES (ID_IMAGEN, ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES
(1,1,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558819/jadda/productos/producto-01/img_1.webp',1),
(2,1,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558820/jadda/productos/producto-01/img_2.png',2),
(3,1,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558821/jadda/productos/producto-01/img_3.png',3),
(4,2,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558821/jadda/productos/producto-02/img_1.webp',1),
(5,2,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558822/jadda/productos/producto-02/img_2.jpg',2),
(6,2,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558822/jadda/productos/producto-02/img_3.webp',3),
(7,3,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558822/jadda/productos/producto-03/img_1.webp',1),
(8,3,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558822/jadda/productos/producto-03/img_2.jpg',2),
(9,3,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558823/jadda/productos/producto-03/img_3.jpg',3),
(10,4,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558823/jadda/productos/producto-04/img_1.webp',1),
(11,4,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558823/jadda/productos/producto-04/img_2.webp',2),
(12,4,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558823/jadda/productos/producto-04/img_3.jpg',3),
(13,5,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558824/jadda/productos/producto-05/img_1.png',1),
(14,5,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558824/jadda/productos/producto-05/img_2.jpg',2),
(15,5,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558824/jadda/productos/producto-05/img_3.jpg',3),
(16,6,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558824/jadda/productos/producto-06/img_1.jpg',1),
(17,6,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558825/jadda/productos/producto-06/img_2.jpg',2),
(18,6,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558825/jadda/productos/producto-06/img_3.webp',3),
(19,7,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558825/jadda/productos/producto-07/img_1.jpg',1),
(20,7,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558825/jadda/productos/producto-07/img_2.jpg',2),
(21,7,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558826/jadda/productos/producto-07/img_3.jpg',3),
(22,8,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558826/jadda/productos/producto-08/img_1.jpg',1),
(23,8,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558826/jadda/productos/producto-08/img_2.jpg',2),
(24,8,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558826/jadda/productos/producto-08/img_3.webp',3),
(25,9,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558827/jadda/productos/producto-09/img_1.jpg',1),
(26,9,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558827/jadda/productos/producto-09/img_2.jpg',2),
(27,9,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558827/jadda/productos/producto-09/img_3.jpg',3),
(28,10,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558828/jadda/productos/producto-10/img_1.jpg',1),
(29,10,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558828/jadda/productos/producto-10/img_2.webp',2),
(30,10,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558828/jadda/productos/producto-10/img_3.jpg',3),
(31,11,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558833/jadda/productos/producto-11/img_1.jpg',1),
(32,11,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558833/jadda/productos/producto-11/img_2.jpg',2),
(33,11,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558834/jadda/productos/producto-11/img_3.jpg',3),
(34,12,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558834/jadda/productos/producto-12/img_1.jpg',1),
(35,12,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558834/jadda/productos/producto-12/img_2.jpg',2),
(36,12,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558834/jadda/productos/producto-12/img_3.webp',3),
(37,13,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558835/jadda/productos/producto-13/img_1.webp',1),
(38,13,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558835/jadda/productos/producto-13/img_2.webp',2),
(39,13,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558835/jadda/productos/producto-13/img_3.webp',3),
(40,14,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558836/jadda/productos/producto-14/img_1.webp',1),
(41,14,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558836/jadda/productos/producto-14/img_2.webp',2),
(42,14,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558836/jadda/productos/producto-14/img_3.webp',3),
(43,15,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558836/jadda/productos/producto-15/img_1.jpg',1),
(44,15,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558837/jadda/productos/producto-15/img_2.webp',2),
(45,15,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558837/jadda/productos/producto-15/img_3.webp',3),
(46,16,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558837/jadda/productos/producto-16/img_1.webp',1),
(47,16,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558837/jadda/productos/producto-16/img_2.webp',2),
(48,16,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558838/jadda/productos/producto-16/img_3.webp',3),
(49,17,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558838/jadda/productos/producto-17/img_1.webp',1),
(50,17,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558838/jadda/productos/producto-17/img_2.webp',2),
(51,17,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558838/jadda/productos/producto-17/img_3.webp',3),
(52,18,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558839/jadda/productos/producto-18/img_1.webp',1),
(53,18,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558839/jadda/productos/producto-18/img_2.webp',2),
(54,18,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558839/jadda/productos/producto-18/img_3.webp',3),
(55,19,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558839/jadda/productos/producto-19/img_1.jpg',1),
(56,19,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558840/jadda/productos/producto-19/img_2.webp',2),
(57,19,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558840/jadda/productos/producto-19/img_3.jpg',3),
(58,20,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558840/jadda/productos/producto-20/img_1.jpg',1),
(59,20,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558840/jadda/productos/producto-20/img_2.webp',2),
(60,20,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558841/jadda/productos/producto-20/img_3.webp',3),
(61,21,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558841/jadda/productos/producto-21/img_1.webp',1),
(62,21,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558841/jadda/productos/producto-21/img_2.webp',2),
(63,21,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558841/jadda/productos/producto-21/img_3.webp',3),
(64,22,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558842/jadda/productos/producto-22/img_1.webp',1),
(65,22,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558843/jadda/productos/producto-22/img_2.webp',2),
(66,22,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558842/jadda/productos/producto-22/img_3.jpg',3),
(67,23,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558842/jadda/productos/producto-23/img_1.jpg',1),
(68,23,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558843/jadda/productos/producto-23/img_2.webp',2),
(69,23,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558843/jadda/productos/producto-23/img_3.jpg',3),
(70,24,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558843/jadda/productos/producto-24/img_1.jpg',1),
(71,24,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558844/jadda/productos/producto-24/img_2.jpg',2),
(72,24,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558844/jadda/productos/producto-24/img_3.jpg',3),
(73,25,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558844/jadda/productos/producto-25/img_1.jpg',1),
(74,25,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558844/jadda/productos/producto-25/img_2.jpg',2),
(75,25,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558845/jadda/productos/producto-25/img_3.jpg',3),
(76,26,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558845/jadda/productos/producto-26/img_1.webp',1),
(77,26,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558845/jadda/productos/producto-26/img_2.webp',2),
(78,26,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558845/jadda/productos/producto-26/img_3.jpg',3),
(79,27,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558846/jadda/productos/producto-27/img_1.webp',1),
(80,27,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558846/jadda/productos/producto-27/img_2.jpg',2),
(81,27,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558846/jadda/productos/producto-27/img_3.jpg',3),
(82,28,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558846/jadda/productos/producto-28/img_1.jpg',1),
(83,28,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558847/jadda/productos/producto-28/img_2.jpg',2),
(84,28,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558847/jadda/productos/producto-28/img_3.jpg',3),
(85,29,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558847/jadda/productos/producto-29/img_1.webp',1),
(86,29,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558848/jadda/productos/producto-29/img_2.webp',2),
(87,29,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558847/jadda/productos/producto-29/img_3.webp',3),
(88,30,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558848/jadda/productos/producto-30/img_1.webp',1),
(89,30,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558848/jadda/productos/producto-30/img_2.png',2),
(90,30,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558848/jadda/productos/producto-30/img_3.png',3),
(91,31,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558848/jadda/productos/producto-31/img_1.webp',1),
(92,31,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558849/jadda/productos/producto-31/img_2.jpg',2),
(93,31,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558849/jadda/productos/producto-31/img_3.jpg',3),
(94,32,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558849/jadda/productos/producto-32/img_1.webp',1),
(95,32,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558849/jadda/productos/producto-32/img_2.jpg',2),
(96,32,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558850/jadda/productos/producto-32/img_3.jpg',3),
(97,33,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558850/jadda/productos/producto-33/img_1.jpg',1),
(98,33,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558850/jadda/productos/producto-33/img_2.jpg',2),
(99,33,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558850/jadda/productos/producto-33/img_3.jpg',3),
(100,34,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558851/jadda/productos/producto-34/img_1.jpg',1),
(101,34,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558851/jadda/productos/producto-34/img_2.jpg',2),
(102,34,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558851/jadda/productos/producto-34/img_3.webp',3),
(103,35,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558851/jadda/productos/producto-35/img_1.jpg',1),
(104,35,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558852/jadda/productos/producto-35/img_2.webp',2),
(105,35,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558852/jadda/productos/producto-35/img_3.jpg',3),
(106,36,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558852/jadda/productos/producto-36/img_1.webp',1),
(107,36,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558852/jadda/productos/producto-36/img_2.jpg',2),
(108,36,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558853/jadda/productos/producto-36/img_3.jpg',3),
(109,37,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558853/jadda/productos/producto-37/img_1.jpg',1),
(110,37,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558853/jadda/productos/producto-37/img_2.jpg',2),
(111,37,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558853/jadda/productos/producto-37/img_3.webp',3),
(112,38,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558853/jadda/productos/producto-38/img_1.webp',1),
(113,38,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558855/jadda/productos/producto-38/img_2.webp',2),
(114,38,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558854/jadda/productos/producto-38/img_3.jpg',3),
(115,39,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558854/jadda/productos/producto-39/img_1.jpg',1),
(116,39,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558854/jadda/productos/producto-39/img_2.jpg',2),
(117,39,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558855/jadda/productos/producto-39/img_3.jpg',3),
(118,40,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558856/jadda/productos/producto-40/img_1.webp',1),
(119,40,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558856/jadda/productos/producto-40/img_2.jpg',2),
(120,40,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558856/jadda/productos/producto-40/img_3.png',3),
(121,41,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558856/jadda/productos/producto-41/img_1.jpg',1),
(122,41,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558857/jadda/productos/producto-41/img_2.webp',2),
(123,41,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558857/jadda/productos/producto-41/img_3.jpg',3),
(124,42,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558857/jadda/productos/producto-42/img_1.jpg',1),
(125,42,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558857/jadda/productos/producto-42/img_2.jpg',2),
(126,42,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558858/jadda/productos/producto-42/img_3.jpg',3),
(127,43,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558858/jadda/productos/producto-43/img_1.webp',1),
(128,43,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558859/jadda/productos/producto-43/img_2.jpg',2),
(129,43,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558859/jadda/productos/producto-43/img_3.jpg',3),
(130,44,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558859/jadda/productos/producto-44/img_1.jpg',1),
(131,44,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558859/jadda/productos/producto-44/img_2.jpg',2),
(132,44,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558859/jadda/productos/producto-44/img_3.jpg',3),
(133,45,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558860/jadda/productos/producto-45/imagen_1.jpg',1),
(134,45,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558859/jadda/productos/producto-45/imagen_2.jpg',2),
(135,45,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558860/jadda/productos/producto-45/imagen_3.jpg',3),
(136,46,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558860/jadda/productos/producto-46/imagen_1.jpg',1),
(139,47,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558861/jadda/productos/producto-47/imagen_1.jpg',1),
(140,47,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558861/jadda/productos/producto-47/imagen_2.avif',2),
(141,47,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558862/jadda/productos/producto-47/imagen_3.jpg',3),
(142,48,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558862/jadda/productos/producto-48/imagen_1.png',1),
(143,48,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558862/jadda/productos/producto-48/imagen_2.jpg',2),
(144,48,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558862/jadda/productos/producto-48/imagen_3.jpg',3),
(145,49,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558862/jadda/productos/producto-49/imagen_1.webp',1),
(146,49,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558863/jadda/productos/producto-49/imagen_2.jpg',2),
(147,49,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558863/jadda/productos/producto-49/imagen_3.jpg',3),
(148,50,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558863/jadda/productos/producto-50/imagen_1.jpg',1),
(149,50,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558864/jadda/productos/producto-50/imagen_2.jpg',2),
(150,50,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558864/jadda/productos/producto-50/imagen_3.jpg',3),
(151,51,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558864/jadda/productos/producto-51/imagen_1.jpg',1),
(152,51,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558864/jadda/productos/producto-51/imagen_2.jpg',2),
(153,51,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558865/jadda/productos/producto-51/imagen_3.jpg',3),
(154,52,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558865/jadda/productos/producto-52/imagen_1.webp',1),
(155,52,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558865/jadda/productos/producto-52/imagen_2.webp',2),
(156,52,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558865/jadda/productos/producto-52/imagen_3.webp',3),
(157,53,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558866/jadda/productos/producto-53/imagen_1.webp',1),
(158,53,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558866/jadda/productos/producto-53/imagen_2.webp',2),
(159,53,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558866/jadda/productos/producto-53/imagen_3.jpg',3),
(160,54,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558866/jadda/productos/producto-54/imagen_1.webp',1),
(161,54,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558867/jadda/productos/producto-54/imagen_2.jpg',2),
(162,54,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558868/jadda/productos/producto-54/imagen_3.jpg',3),
(163,55,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558868/jadda/productos/producto-55/imagen_1.jpg',1),
(164,55,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558868/jadda/productos/producto-55/imagen_2.jpg',2),
(165,55,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558868/jadda/productos/producto-55/imagen_3.jpg',3),
(166,56,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558869/jadda/productos/producto-56/imagen_1.webp',1),
(167,56,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558869/jadda/productos/producto-56/imagen_2.jpg',2),
(168,56,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558869/jadda/productos/producto-56/imagen_3.jpg',3),
(169,57,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558870/jadda/productos/producto-57/imagen_1.webp',1),
(170,57,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558870/jadda/productos/producto-57/imagen_2.webp',2),
(171,57,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558870/jadda/productos/producto-57/imagen_3.jpg',3),
(172,58,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558870/jadda/productos/producto-58/imagen_1.jpg',1),
(173,58,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558871/jadda/productos/producto-58/imagen_2.jpg',2),
(174,58,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558871/jadda/productos/producto-58/imagen_3.jpg',3),
(175,59,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558871/jadda/productos/producto-59/imagen_1.jpg',1),
(176,59,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558872/jadda/productos/producto-59/imagen_2.jpg',2),
(177,59,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558872/jadda/productos/producto-59/imagen_3.webp',3),
(178,60,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558872/jadda/productos/producto-60/imagen_1.jpg',1),
(179,60,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558872/jadda/productos/producto-60/imagen_2.jpg',2),
(180,60,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558873/jadda/productos/producto-60/imagen_3.webp',3),
(181,61,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558873/jadda/productos/producto-61/imagen_1.jpg',1),
(182,61,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558873/jadda/productos/producto-61/imagen_2.jpg',2),
(183,61,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558874/jadda/productos/producto-61/imagen_3.webp',3),
(184,62,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558874/jadda/productos/producto-62/imagen_1.jpg',1),
(185,62,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558874/jadda/productos/producto-62/imagen_2.jpg',2),
(186,62,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558874/jadda/productos/producto-62/imagen_3.webp',3),
(187,63,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558875/jadda/productos/producto-63/imagen_1.jpg',1),
(188,63,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558875/jadda/productos/producto-63/imagen_2.jpg',2),
(189,63,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558875/jadda/productos/producto-63/imagen_3.jpg',3),
(190,64,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558875/jadda/productos/producto-64/imagen_1.jpg',1),
(191,64,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558876/jadda/productos/producto-64/imagen_2.jpg',2),
(192,64,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558876/jadda/productos/producto-64/imagen_3.jpg',3),
(193,65,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558876/jadda/productos/producto-65/imagen_1.webp',1),
(194,65,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558876/jadda/productos/producto-65/imagen_2.png',2),
(195,65,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558877/jadda/productos/producto-65/imagen_3.jpg',3),
(196,66,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558877/jadda/productos/producto-66/imagen_1.webp',1),
(197,66,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558877/jadda/productos/producto-66/imagen_2.jpg',2),
(198,66,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558877/jadda/productos/producto-66/imagen_3.webp',3),
(199,67,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558878/jadda/productos/producto-67/imagen_1.jpg',1),
(200,67,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558878/jadda/productos/producto-67/imagen_2.jpg',2),
(201,67,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558878/jadda/productos/producto-67/imagen_3.jpg',3),
(202,68,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558878/jadda/productos/producto-68/imagen_1.jpg',1),
(203,68,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558879/jadda/productos/producto-68/imagen_2.jpg',2),
(204,68,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558879/jadda/productos/producto-68/imagen_3.jpg',3),
(205,69,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558879/jadda/productos/producto-69/imagen_1.jpg',1),
(206,69,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558879/jadda/productos/producto-69/imagen_2.jpg',2),
(207,69,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558879/jadda/productos/producto-69/imagen_3.jpg',3),
(208,70,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558880/jadda/productos/producto-70/imagen_1.jpg',1),
(209,70,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558880/jadda/productos/producto-70/imagen_2.jpg',2),
(210,70,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558880/jadda/productos/producto-70/imagen_3.png',3),
(211,71,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558881/jadda/productos/producto-71/imagen_1.jpg',1),
(212,71,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558881/jadda/productos/producto-71/imagen_2.jpg',2),
(213,71,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558881/jadda/productos/producto-71/imagen_3.jpg',3),
(214,72,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558881/jadda/productos/producto-72/imagen_1.jpg',1),
(215,72,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558881/jadda/productos/producto-72/imagen_2.webp',2),
(216,72,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558882/jadda/productos/producto-72/imagen_3.webp',3),
(217,73,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558882/jadda/productos/producto-73/imagen_1.jpg',1),
(218,73,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558882/jadda/productos/producto-73/imagen_2.jpg',2),
(219,73,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558883/jadda/productos/producto-73/imagen_3.jpg',3),
(220,74,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558883/jadda/productos/producto-74/imagen_1.jpg',1),
(221,74,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558883/jadda/productos/producto-74/imagen_2.jpg',2),
(222,74,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558883/jadda/productos/producto-74/imagen_3.jpg',3),
(223,75,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558884/jadda/productos/producto-75/imagen_1.webp',1),
(224,75,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558884/jadda/productos/producto-75/imagen_2.jpg',2),
(225,75,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558884/jadda/productos/producto-75/imagen_3.jpg',3),
(226,76,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558884/jadda/productos/producto-76/imagen_1.jpg',1),
(227,76,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558884/jadda/productos/producto-76/imagen_2.jpg',2),
(228,76,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558885/jadda/productos/producto-76/imagen_3.jpg',3),
(229,77,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558885/jadda/productos/producto-77/imagen_1.jpg',1),
(230,77,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558885/jadda/productos/producto-77/imagen_2.jpg',2),
(231,77,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558885/jadda/productos/producto-77/imagen_3.jpg',3),
(232,78,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558886/jadda/productos/producto-78/imagen_1.webp',1),
(233,78,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558886/jadda/productos/producto-78/imagen_2.jpg',2),
(234,78,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558886/jadda/productos/producto-78/imagen_3.jpg',3),
(235,79,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558887/jadda/productos/producto-79/imagen_1.jpg',1),
(236,79,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558887/jadda/productos/producto-79/imagen_2.jpg',2),
(237,79,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558887/jadda/productos/producto-79/imagen_3.jpg',3),
(238,80,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558887/jadda/productos/producto-80/imagen_1.jpg',1),
(239,80,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558888/jadda/productos/producto-80/imagen_2.jpg',2),
(240,80,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558888/jadda/productos/producto-80/imagen_3.jpg',3),
(241,81,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558888/jadda/productos/producto-81/imagen_1.jpg',1),
(242,81,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558889/jadda/productos/producto-81/imagen_2.webp',2),
(243,81,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558889/jadda/productos/producto-81/imagen_3.jpg',3),
(244,82,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558889/jadda/productos/producto-82/imagen_1.jpg',1),
(245,82,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558889/jadda/productos/producto-82/imagen_2.jpg',2),
(246,82,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558890/jadda/productos/producto-82/imagen_3.jpg',3),
(247,83,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558890/jadda/productos/producto-83/imagen_1.jpg',1),
(248,83,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558890/jadda/productos/producto-83/imagen_2.jpg',2),
(249,83,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558890/jadda/productos/producto-83/imagen_3.jpg',3),
(250,84,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558890/jadda/productos/producto-84/imagen_1.jpg',1),
(251,84,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558891/jadda/productos/producto-84/imagen_2.webp',2),
(252,84,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558891/jadda/productos/producto-84/imagen_3.webp',3),
(253,85,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558891/jadda/productos/producto-85/imagen_1.jpg',1),
(254,85,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558892/jadda/productos/producto-85/imagen_2.jpg',2),
(255,85,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558892/jadda/productos/producto-85/imagen_3.jpg',3),
(256,86,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558892/jadda/productos/producto-86/imagen_1.avif',1),
(257,86,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558893/jadda/productos/producto-86/imagen_2.jpg',2),
(258,86,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558893/jadda/productos/producto-86/imagen_3.jpg',3),
(259,87,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558893/jadda/productos/producto-87/imagen_1.jpg',1),
(260,87,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558894/jadda/productos/producto-87/imagen_2.webp',2),
(261,87,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558894/jadda/productos/producto-87/imagen_3.jpg',3),
(262,88,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558894/jadda/productos/producto-88/imagen_1.jpg',1),
(263,88,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558894/jadda/productos/producto-88/imagen_2.webp',2),
(264,88,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558895/jadda/productos/producto-88/imagen_3.jpg',3),
(265,89,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558895/jadda/productos/producto-89/imagen_1.jpg',1),
(266,89,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558895/jadda/productos/producto-89/imagen_2.jpg',2),
(267,89,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558895/jadda/productos/producto-89/imagen_3.jpg',3),
(268,90,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558896/jadda/productos/producto-90/imagen_1.webp',1),
(269,90,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558896/jadda/productos/producto-90/imagen_2.webp',2),
(270,90,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558896/jadda/productos/producto-90/imagen_3.webp',3),
(271,91,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558896/jadda/productos/producto-91/imagen_1.jpg',1),
(272,91,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558897/jadda/productos/producto-91/imagen_2.jpg',2),
(273,91,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558897/jadda/productos/producto-91/imagen_3.webp',3),
(274,92,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558897/jadda/productos/producto-92/imagen_1.jpg',1),
(275,92,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558897/jadda/productos/producto-92/imagen_2.jpg',2),
(276,92,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558898/jadda/productos/producto-92/imagen_3.jpg',3),
(277,93,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558898/jadda/productos/producto-93/imagen_1.jpg',1),
(278,93,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558898/jadda/productos/producto-93/imagen_2.jpg',2),
(279,93,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558898/jadda/productos/producto-93/imagen_3.jpg',3),
(280,94,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558899/jadda/productos/producto-94/imagen_1.jpg',1),
(281,94,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558899/jadda/productos/producto-94/imagen_2.jpg',2),
(282,94,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558899/jadda/productos/producto-94/imagen_3.jpg',3),
(283,95,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558899/jadda/productos/producto-95/imagen_1.jpg',1),
(284,95,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558900/jadda/productos/producto-95/imagen_2.jpg',2),
(285,95,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558900/jadda/productos/producto-95/imagen_3.jpg',3),
(286,96,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558900/jadda/productos/producto-96/imagen_1.jpg',1),
(287,96,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558900/jadda/productos/producto-96/imagen_2.jpg',2),
(288,96,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558901/jadda/productos/producto-96/imagen_3.jpg',3),
(289,97,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558901/jadda/productos/producto-97/imagen_1.jpg',1),
(290,97,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558901/jadda/productos/producto-97/imagen_2.jpg',2),
(291,97,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558901/jadda/productos/producto-97/imagen_3.jpg',3),
(292,98,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558902/jadda/productos/producto-98/imagen_1.jpg',1),
(293,98,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558902/jadda/productos/producto-98/imagen_2.jpg',2),
(294,98,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558902/jadda/productos/producto-98/imagen_3.jpg',3),
(295,99,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558903/jadda/productos/producto-99/imagen_1.webp',1),
(296,99,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558903/jadda/productos/producto-99/imagen_2.jpg',2),
(297,99,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558903/jadda/productos/producto-99/imagen_3.jpg',3),
(298,100,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558829/jadda/productos/producto-100/imagen_1.jpg',1),
(299,100,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558829/jadda/productos/producto-100/imagen_2.jpg',2),
(300,100,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558829/jadda/productos/producto-100/imagen_3.jpg',3),
(301,101,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558830/jadda/productos/producto-101/imagen_1.jpg',1),
(302,101,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558829/jadda/productos/producto-101/imagen_2.jpg',2),
(303,101,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558830/jadda/productos/producto-101/imagen_3.jpg',3),
(304,102,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558830/jadda/productos/producto-102/imagen_1.jpg',1),
(305,102,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558830/jadda/productos/producto-102/imagen_2.webp',2),
(306,102,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558831/jadda/productos/producto-102/imagen_3.jpg',3),
(307,103,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558831/jadda/productos/producto-103/imagen_1.jpg',1),
(308,103,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558832/jadda/productos/producto-103/imagen_2.jpg',2),
(309,103,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558832/jadda/productos/producto-103/imagen_3.jpg',3),
(310,104,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558833/jadda/productos/producto-104/imagen_1.jpg',1),
(311,104,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558832/jadda/productos/producto-104/imagen_2.jpg',2),
(312,104,'https://res.cloudinary.com/nggcplfk/image/upload/v1792558832/jadda/productos/producto-104/imagen_3.jpg',3);


-- -------------------------------------------------------------------------
-- MÉTODOS DE PAGO: catálogo (la APP de checkout ofrece débito/crédito/Wompi;
-- el resto queda como catálogo histórico para datos demo y registros viejos)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO METODOS_PAGO (ID_METODO, NOMBRE_METODO, DESCRIPCION) VALUES
(1,'Efectivo','Pago en dinero físico'),
(2,'Tarjeta débito','Pago con tarjeta débito'),
(3,'Tarjeta crédito','Pago con tarjeta crédito'),
(4,'Nequi','Billetera digital'),
(5,'Daviplata','Billetera digital Davivienda'),
(6,'Bancolombia','Transferencia Bancolombia'),
(7,'PSE','Pagos seguros en línea'),
(8,'PayPal','Plataforma internacional'),
(9,'Transferencia BBVA','Transferencia bancaria'),
(10,'Contra entrega','Pago al recibir'),
(11,'Apple Pay','Pago móvil Apple'),
(12,'Google Pay','Pago móvil Google'),
(13,'Crédito tienda','Financiación interna'),
(14,'QR Bancario','Pago por código QR'),
(15,'Bitcoin','Pago con criptomoneda'),
(16,'Wompi','Pasarela de pagos Wompi (tarjeta, Nequi, PSE y Bancolombia se eligen dentro de su checkout)');

-- -------------------------------------------------------------------------
-- MOVIMIENTOS DE STOCK: 2 movimientos de ejemplo (salidas)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO, ID_PRODUCTO, TIPO_MOVIMIENTO, CANTIDAD, FECHA) VALUES
(1,1,'SALIDA',2,'2025-06-01'),
(2,2,'SALIDA',1,'2025-06-02');

-- -------------------------------------------------------------------------
-- RETOS: 16 retos gamificados (sesiones, kilómetros, racha, fuerza, etc.)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO RETOS (ID_RETO, TITULO, DESCRIPCION, META_TIPO, META_VALOR, RECOMPENSA_PORCENTAJE, FECHA_INICIO, FECHA_FIN) VALUES
(1, 'Semana Activa', 'Completa 5 sesiones de entrenamiento de al menos 30 minutos en una semana', 'sesiones', 5, 5.00, '2026-01-01', '2026-12-31'),
(2, 'Maratón de Km', 'Acumula 15 kilómetros corriendo o caminando', 'km', 15, 8.00, '2026-01-01', '2026-12-31'),
(3, 'Racha Imparable', 'Entrena 7 días consecutivos sin saltarte ninguno', 'dias', 7, 10.00, '2026-01-01', '2026-12-31'),
(4, 'Reto Fuerza', 'Completa 10 sesiones de gimnasio o pesas', 'sesiones', 10, 6.00, '2026-01-01', '2026-12-31'),
(5, 'Primer Kilómetro', 'Corre o camina tu primer kilómetro del reto', 'km', 1, 3.00, '2026-01-01', '2026-12-31'),
(6, 'Flexiones Total', 'Completa 100 flexiones acumuladas', 'sesiones', 100, 4.00, '2026-01-01', '2026-12-31'),
(7, 'Aguanta el Core', 'Haz 30 planchas de 1 minuto en el mes', 'sesiones', 30, 5.00, '2026-01-01', '2026-12-31'),
(8, 'Medio Maratón', 'Acumula 21 kilómetros de carrera', 'km', 21, 10.00, '2026-01-01', '2026-12-31'),
(9, 'Semana Sin Azúcar', 'Reporta 7 días sin consumir azúcar añadida', 'dias', 7, 5.00, '2026-01-01', '2026-12-31'),
(10, 'Hidratación Total', 'Registra 14 días tomando al menos 2 litros de agua', 'dias', 14, 5.00, '2026-01-01', '2026-12-31'),
(11, 'Ciclismo de Fondo', 'Acumula 50 kilómetros en bicicleta', 'km', 50, 8.00, '2026-01-01', '2026-12-31'),
(12, 'Sentadillas Legendarias', 'Completa 200 sentadillas acumuladas', 'sesiones', 200, 5.00, '2026-01-01', '2026-12-31'),
(13, 'Salto de Cuerda', 'Acumula 15 sesiones de salto de cuerda de 10 minutos', 'sesiones', 15, 6.00, '2026-01-01', '2026-12-31'),
(14, 'Estiramiento Diario', 'Estira 10 días seguidos para mejorar movilidad', 'dias', 10, 4.00, '2026-01-01', '2026-12-31'),
(15, '30 Minutos Diarios', 'Entrena 30 minutos al día durante 10 días', 'dias', 10, 6.00, '2026-01-01', '2026-12-31'),
(16, 'Reto Natación', 'Acumula 5 kilómetros de natación', 'km', 5, 8.00, '2026-01-01', '2026-12-31');

-- -------------------------------------------------------------------------
-- PLANTILLAS DE PLANES: 9 planes de entrenamiento (14-21 días)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PLANTILLAS_PLANES (ID_PLANTILLA, ID_CATEGORIA, TITULO, DESCRIPCION, DURACION_DIAS, NIVEL, CONTENIDO) VALUES
(1, 3, 'De Couch a 5K', 'Plan progresivo para empezar a correr desde cero', 21, 'Principiante', '[{\"dia\":1,\"actividad\":\"Caminata 20 min\",\"series\":1},{\"dia\":2,\"actividad\":\"Descanso activo - estiramientos\",\"series\":1},{\"dia\":3,\"actividad\":\"Caminata 25 min + trote 5 min\",\"series\":1},{\"dia\":4,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":5,\"actividad\":\"Trote 15 min + caminata 10 min\",\"series\":1},{\"dia\":6,\"actividad\":\"Caminata 30 min\",\"series\":1},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(2, 2, 'Salto y Velocidad', 'Mejora tu salto vertical y rapidez en la cancha', 14, 'Intermedio', '[{\"dia\":1,\"actividad\":\"Saltos a la cuerda 10 min\",\"series\":3},{\"dia\":2,\"actividad\":\"Sentadillas + saltos\",\"series\":4},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"Sprints 30m\",\"series\":6},{\"dia\":5,\"actividad\":\"Saltos en cajón\",\"series\":4},{\"dia\":6,\"actividad\":\"Estocadas con salto\",\"series\":3},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(3, 4, 'Full Body Principiantes', 'Rutina completa de gimnasio para empezar con buen pie', 14, 'Principiante', '[{\"dia\":1,\"actividad\":\"Press banca + Remo\",\"series\":3},{\"dia\":2,\"actividad\":\"Sentadilla + Peso muerto\",\"series\":3},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"Hombros + Bíceps\",\"series\":3},{\"dia\":5,\"actividad\":\"Espalda + Tríceps\",\"series\":3},{\"dia\":6,\"actividad\":\"Cardio 20 min + abdomen\",\"series\":3},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(4, 1, 'Resistencia y Agilidad', 'Entrenamiento para futbolistas enfocado en condición física', 14, 'Intermedio', '[{\"dia\":1,\"actividad\":\"Trote continuo 20 min\",\"series\":1},{\"dia\":2,\"actividad\":\"Circuitos de agilidad (conos)\",\"series\":4},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"Sprints con cambios de dirección\",\"series\":6},{\"dia\":5,\"actividad\":\"Pases y control de balón\",\"series\":4},{\"dia\":6,\"actividad\":\"Partido reducido 30 min\",\"series\":1},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(5, 6, 'Fondo de Pierna', 'Plan para ciclistas que buscan aumentar resistencia', 14, 'Intermedio', '[{\"dia\":1,\"actividad\":\"Ruta plana 20 km\",\"series\":1},{\"dia\":2,\"actividad\":\"Series de pedaleo rápido\",\"series\":5},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"Subidas 10 km\",\"series\":1},{\"dia\":5,\"actividad\":\"Ruta recreativa 30 km\",\"series\":1},{\"dia\":6,\"actividad\":\"Estiramientos + Core\",\"series\":3},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(6, 5, 'Técnica y Respiración', 'Plan de natación para mejorar técnica y capacidad pulmonar', 14, 'Principiante', '[{\"dia\":1,\"actividad\":\"Técnica de brazada 200m\",\"series\":4},{\"dia\":2,\"actividad\":\"Ejercicios de respiración\",\"series\":5},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"Patada con tabla 300m\",\"series\":3},{\"dia\":5,\"actividad\":\"Estilo libre 500m\",\"series\":1},{\"dia\":6,\"actividad\":\"Combinado 400m\",\"series\":1},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(7, 8, 'Ropa Activa', 'Plan con ejercicios que puedes hacer con ropa deportiva ligera', 14, 'Principiante', '[{\"dia\":1,\"actividad\":\"Saltos de tijera 3 min\",\"series\":3},{\"dia\":2,\"actividad\":\"Burpees 10 rep\",\"series\":3},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"Plancha 30 seg\",\"series\":4},{\"dia\":5,\"actividad\":\"Flexiones 12 rep\",\"series\":3},{\"dia\":6,\"actividad\":\"Cardio libre 20 min\",\"series\":1},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(8, 11, 'Cardio Quema Grasa', 'Plan cardiovascular para mejorar resistencia y quemar calorías', 14, 'Intermedio', '[{\"dia\":1,\"actividad\":\"Trote 20 min\",\"series\":1},{\"dia\":2,\"actividad\":\"Bicicleta 30 min\",\"series\":1},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"HIIT 15 min\",\"series\":1},{\"dia\":5,\"actividad\":\"Natación 30 min\",\"series\":1},{\"dia\":6,\"actividad\":\"Caminata rápida 40 min\",\"series\":1},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]'),
(9, 12, 'Home Fitness', 'Rutina para hacer en casa sin equipo especializado', 14, 'Principiante', '[{\"dia\":1,\"actividad\":\"Sentadillas 15 rep\",\"series\":3},{\"dia\":2,\"actividad\":\"Flexiones 10 rep\",\"series\":3},{\"dia\":3,\"actividad\":\"Descanso\",\"series\":0},{\"dia\":4,\"actividad\":\"Plancha 30 seg\",\"series\":3},{\"dia\":5,\"actividad\":\"Zancadas 12 rep\",\"series\":3},{\"dia\":6,\"actividad\":\"Saltos 30 seg\",\"series\":3},{\"dia\":7,\"actividad\":\"Descanso\",\"series\":0}]');

-- =====================================================================
-- DATOS DEMO POBLADOS (dashboard con ventas, reembolsos, chats, etc.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- DEMO_DATA: datos de demostracion auto-sembrados (INSERT IGNORE).
-- Solo clientes y vendedores; el admin lo crea seedAdminUser (env).
-- Ids explicitos y coherentes entre tablas (sin huerfanos ni PKs repetidos).
-- ---------------------------------------------------------------------
-- USUARIOS demo (16): 12 compradores (22-33) + 4 vendedores (34-37)
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (22,'Camilo','Torres','camilo.torres@gmail.com','camilo.torres','3101110011','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-30 00:00:00','CC','1010010011',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:40:16','181.50.10.1','Bogota, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (23,'Valentina','Ruiz','valentina.ruiz@gmail.com','valentina.ruiz','3112220022','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-27 00:00:00','CC','1020020022',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Medellin, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (24,'Santiago','Herrera','santiago.herrera@gmail.com','santiago.herrera','3203330033','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-31 00:00:00','CC','1030030033',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Cali, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (25,'Mariana','Lopez','mariana.lopez@gmail.com','mariana.lopez','3154440044','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-22 00:00:00','CC','1040040044',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Barranquilla, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (26,'Andres','Mora','andres.mora@gmail.com','andres.mora','3125550055','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-17 00:00:00','CC','1050050055',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Bucaramanga, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (27,'Daniela','Castro','daniela.castro@gmail.com','daniela.castro','3186660066','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-12 00:00:00','CC','1060060066',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Cartagena, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (28,'Carolina','Rojas','carolina.rojas@gmail.com','carolina.rojas','3008880088','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-02 00:00:00','CC','1070070077',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Manizales, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (29,'Sofia','Martinez','sofia.martinez@gmail.com','sofia.martinez','3021010101','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-25 00:00:00','CC','1080080088',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Pereira, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (30,'Felipe','Gutierrez','felipe.gutierrez@gmail.com','felipe.gutierrez','3177770077','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-07 00:00:00','CC','1090090099',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Ibague, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (31,'Mateo','Alvarez','mateo.alvarez@gmail.com','mateo.alvarez','3032020202','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-20 00:00:00','CC','1100200202',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Villavicencio, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (32,'Isabella','Moreno','isabella.moreno@gmail.com','isabella.moreno','3043030303','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-14 00:00:00','CC','1110300303',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Neiva, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (33,'Nicolas','Vargas','nicolas.vargas@gmail.com','nicolas.vargas','3054040404','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-10 00:00:00','CC','1120400404',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Armenia, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (34,'Alejandro','Mendoza','alejandro.mendoza@vendedor.com','alejandro.mendoza','3124440011','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-07-15 00:00:00','CC','10499139642',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:43:13','181.50.10.5','Medellin, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (35,'Fernanda','Castillo','fernanda.castillo@vendedor.com','fernanda.castillo','3135550022','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-07-20 00:00:00','CC','10561606469',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:11','181.50.10.5','Bogota, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (36,'Jorge','Herrera','jorge.herrera@vendedor.com','jorge.herrera','3146660033','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-07-22 00:00:00','CC','10429049798',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:11','181.50.10.5','Cali, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (37,'Valeria','Leon','valeria.leon@vendedor.com','valeria.leon','3157770044','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-07-25 00:00:00','CC','10934884388',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:11','181.50.10.5','Bucaramanga, Colombia',0);
-- DIRECCIONES demo (6)
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (12,22,'Cra 15 #88-45','Chapinero','Bogota','Cundinamarca','110221','3101110011','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (13,26,'Cll 67 #12-30','Kennedy','Bogota','Cundinamarca','110811','3125550055','Trabajo',0);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (14,23,'Cra 43A #18-22','La Mota','Medellin','Antioquia','050031','3112220022','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (15,24,'Av 6N #28-50','Granada','Cali','Valle del Cauca','760042','3203330033','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (16,25,'Cll 77B #57-13','Alto Prado','Barranquilla','Atlantico','080020','3154440044','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (17,27,'Cll 31 #19-45','Pie de la Popa','Cartagena','Bolivar','130003','3186660066','Casa',1);
-- USUARIOS_METODOS_PAGO demo (5)
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (1,22,4,'Camilo Torres','3101110011',NULL,'billetera',1,'2026-08-31 10:00:00');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (2,23,3,'Valentina Ruiz','3112220022','Bancolombia','credito',1,'2026-08-31 10:05:00');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (3,24,1,'Santiago Herrera',NULL,NULL,'efectivo',1,'2026-08-31 10:10:00');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (4,25,4,'Mariana Lopez','3154440044',NULL,'billetera',1,'2026-08-31 10:15:00');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (5,26,3,'Andres Mora','3125550055','Davivienda','credito',1,'2026-08-31 10:20:00');
-- SOLICITUDES_VENDEDOR demo (6): 4 APROBADAS (vendedores 34-37) + publica PENDIENTE + publica RECHAZADA
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (1,34,'Deportes Andinos SAS','901123456-1','Alejandro Mendoza','alejandro.mendoza@vendedor.com','3124440011','Antioquia','Medellin','Calle 10 Sur #25-30','Futbol;Ropa deportiva','Tienda de guayos y balones','APROBADA',NULL,'2026-07-14 09:00:00','2026-07-15 15:20:00');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (2,35,'Fitness Lumen SAS','901234567-8','Fernanda Castillo','fernanda.castillo@vendedor.com','3135550022','Cundinamarca','Bogota','Cra 11 #93-44','Gimnasio;Cardio','Articulos para gimnasio y cardio','APROBADA',NULL,'2026-07-19 11:00:00','2026-07-20 09:40:00');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (3,36,'Textiles Norte Ltda','901234568-5','Jorge Herrera','jorge.herrera@vendedor.com','3146660033','Valle del Cauca','Cali','Av 4N #5-40','Ropa deportiva','Ropa tecnica para correr','APROBADA',NULL,'2026-07-21 14:00:00','2026-07-22 10:05:00');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (4,37,'Marca Vital SAS','901234569-2','Valeria Leon','valeria.leon@vendedor.com','3157770044','Santander','Bucaramanga','Cll 36 #10-18','Tenis;Accesorios','Accesorios deportivos varios','APROBADA',NULL,'2026-07-24 08:30:00','2026-07-25 11:10:00');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (5,NULL,'Suministros Delta SAS','900123456-1','Luis Contreras','ventas.delta@correo.com','6011234567','Cundinamarca','Bogota','Cra 30 #45-80','Futbol;Cardio;Gimnasio','Distribuidor de material deportivo','PENDIENTE',NULL,'2026-09-02 16:12:00',NULL);
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (6,NULL,'Bicicletas Rueda Sur','830034561-1','Pedro Salas','pedro.ruedasur@correo.com','6025551234','Valle del Cauca','Cali','Cra 72 #5-25','Accesorios','Tienda de ciclistas urbanos','RECHAZADA','NIT no verificable en la DIAN','2026-08-28 10:45:00','2026-08-30 13:30:00');
-- VENDEDORES demo (4)
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (1,34,1,'Deportes Andinos SAS','901123456-1','alejandro.mendoza@vendedor.com','3124440011','Antioquia','Medellin','Calle 10 Sur #25-30','Futbol;Ropa deportiva','ACTIVO','2026-07-15 15:20:00');
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (2,35,2,'Fitness Lumen SAS','901234567-8','fernanda.castillo@vendedor.com','3135550022','Cundinamarca','Bogota','Cra 11 #93-44','Gimnasio;Cardio','ACTIVO','2026-07-20 09:40:00');
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (3,36,3,'Textiles Norte Ltda','901234568-5','jorge.herrera@vendedor.com','3146660033','Valle del Cauca','Cali','Av 4N #5-40','Ropa deportiva','ACTIVO','2026-07-22 10:05:00');
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (4,37,4,'Marca Vital SAS','901234569-2','valeria.leon@vendedor.com','3157770044','Santander','Bucaramanga','Cll 36 #10-18','Tenis;Accesorios','ACTIVO','2026-07-25 11:10:00');
-- VENTAS demo (12): totales = SUM(detalle) + COSTO_ENVIO del envio correspondiente
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (1,22,'2026-08-06 11:30:00','{"tipo":"tarjeta","franquicia":"VISA","ultimos":"1111"}',149000,'COMPLETADA',3,'SIM_1786270500001_a');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (2,23,'2026-08-09 15:10:00','{"tipo":"Nequi","telefono":"3112220022"}',121000,'COMPLETADA',4,'SIM_1786270500002_b');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (3,24,'2026-08-14 09:45:00',NULL,86000,'COMPLETADA',1,'SIM_1786270500003_c');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (4,23,'2026-08-18 17:20:00','{"tipo":"tarjeta","franquicia":"VISA","ultimos":"2222"}',198000,'COMPLETADA',3,'SIM_1786270500004_d');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (5,25,'2026-08-22 12:05:00','{"tipo":"Nequi","telefono":"3154440044"}',154000,'COMPLETADA',4,'SIM_1786270500005_e');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (6,22,'2026-08-30 10:40:00',NULL,74000,'PENDIENTE',10,NULL);
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (7,27,'2026-09-03 14:55:00','{"tipo":"tarjeta","franquicia":"VISA","ultimos":"3333"}',92000,'CANCELADA',3,'SIM_1786270500006_f');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (8,28,'2026-09-10 16:30:00','{"tipo":"transferencia","banco":"Bancolombia"}',178000,'COMPLETADA',6,'SIM_1786270500007_g');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (9,29,'2026-09-15 11:15:00','{"tipo":"Nequi","telefono":"3021010101"}',145000,'COMPLETADA',4,'SIM_1786270500008_h');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (10,30,'2026-09-20 13:50:00','{"tipo":"tarjeta","franquicia":"Mastercard","ultimos":"4444"}',127000,'COMPLETADA',3,'SIM_1786270500009_i');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (11,31,'2026-09-24 18:35:00',NULL,114000,'PENDIENTE_PAGO',4,NULL);
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (12,33,'2026-09-25 10:25:00',NULL,88000,'COMPLETADA',1,'SIM_1786270500010_j');
-- DETALLE_VENTAS demo (23): suma exacta por venta
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (1,1,1,1,1,68000,68000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (2,1,2,3,1,72000,72000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (3,2,3,5,1,64000,64000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (4,2,5,7,1,48000,48000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (5,3,6,9,1,80000,80000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (6,4,23,11,2,64000,128000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (7,4,24,13,1,61000,61000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (8,5,30,15,1,85000,85000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (9,5,33,17,1,60000,60000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (10,6,5,19,1,68000,68000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (11,7,61,21,1,55000,55000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (12,7,65,23,1,28000,28000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (13,8,55,25,1,83000,83000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (14,8,2,3,1,64000,64000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (15,8,6,9,1,22000,22000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (16,9,12,27,1,68000,68000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (17,9,16,29,1,68000,68000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (18,10,55,25,1,84000,84000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (19,10,2,3,1,34000,34000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (20,11,12,27,1,68000,68000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (21,11,13,31,1,40000,40000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (22,12,5,19,1,64000,64000);
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (23,12,6,9,1,18000,18000);
-- ENVIOS demo (12): estados espejo de las ventas, COSTO_ENVIO coherente con el total
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (1,1,'Cra 15 #88-45','Bogota','Chapinero','Cundinamarca','110221','Dejar en porteria','3101110011',9000,'ENTREGADO','2026-08-07','2026-08-10 14:20:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (2,2,'Cra 43A #18-22','Medellin','La Mota','Antioquia','050031',NULL,'3112220022',9000,'ENTREGADO','2026-08-10','2026-08-13 11:30:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (3,3,'Av 6N #28-50','Cali','Granada','Valle del Cauca','760042',NULL,'3203330033',6000,'ENTREGADO','2026-08-15','2026-08-18 09:10:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (4,4,'Cra 43A #18-22','Medellin','La Mota','Antioquia','050031',NULL,'3112220022',9000,'ENTREGADO','2026-08-19','2026-08-22 15:45:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (5,5,'Cll 77B #57-13','Barranquilla','Alto Prado','Atlantico','080020','Llamar antes de llegar','3154440044',9000,'EN_CAMINO','2026-08-23',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (6,6,'Cra 15 #88-45','Bogota','Chapinero','Cundinamarca','110221',NULL,'3101110011',6000,'PENDIENTE',NULL,NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (7,7,'Cll 31 #19-45','Cartagena','Pie de la Popa','Bolivar','130003',NULL,'3186660066',9000,'CANCELADO','2026-09-04',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (8,8,'Cra 4 #37-16','Cartagena','Manga','Bolivar','130002',NULL,'3008880088',9000,'POR_EMPAQUETAR','2026-09-11',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (9,9,'Cra 9 #17-28','Pereira','Alfonso Lopez','Risaralda','660003',NULL,'3021010101',9000,'EMPACADO','2026-09-16',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (10,10,'Av 3 #40-22','Ibague','La Estacion','Tolima','730001',NULL,'3177770077',9000,'EN_CAMINO','2026-09-21',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (11,11,'Av 8 #31-90','Villavicencio','La Esperanza','Meta','500006',NULL,'3032020202',6000,'PENDIENTE',NULL,NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (12,12,'Cra 19 #2-34','Armenia','Centro','Quindio','630004',NULL,'3054040404',6000,'EN_CAMINO','2026-09-26',NULL);
-- MOVIMIENTOS_STOCK demo (6)
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (1,1,'SALIDA',1,'2026-08-06');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (2,2,'SALIDA',1,'2026-08-06');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (3,3,'SALIDA',1,'2026-08-09');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (4,1,'ENTRADA',1,'2026-08-15');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (5,6,'SALIDA',2,'2026-08-14');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (6,2,'ENTRADA',2,'2026-08-20');
-- DEVOLUCIONES demo (3): siempre del dueno de la venta
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (1,22,1,1,1,'El producto llego diferente al de la foto','El tono del balon no coincide con la foto que vi al comprarlo','DEVOLUCION',NULL,'APROBADA','2026-08-12 09:20:00','2026-08-14 10:05:00');
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (2,23,4,23,1,'La talla quedo pequena','Las 36 quedan muy ajustadas, quiero una talla mas','REEMBOLSO','Adjunta imagenes del articulo y la etiqueta para continuar','MAS_PRUEBAS','2026-09-18 14:40:00',NULL);
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (3,22,6,5,1,'Llego deteriorado','La caja llego aplastada y una agujeta de la bolsa rota','DEVOLUCION',NULL,'SOLICITADA','2026-09-26 10:10:00',NULL);
-- DEVOLUCIONES_EVIDENCIAS demo (3)
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (1,1,'imagen','/images/devoluciones/demo-1.png','2026-08-12 09:25:00');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (2,2,'imagen','/images/devoluciones/demo-2.png','2026-09-20 15:10:00');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (3,3,'imagen','/images/devoluciones/demo-3.png','2026-09-26 10:20:00');
-- RETOS_USUARIOS demo (4)
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (1,1,24,5,1,'RETO-DEMO-2026');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (2,2,22,7,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (3,3,27,3,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (4,12,31,0,0,NULL);
-- RETO_EVIDENCIAS demo (4)
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (1,1,24,'imagen','/images/usuarios/santiago.herrera/retos/r1/demo-1.jpg',NULL,1,'aprobado',NULL,'2026-08-20 10:00:00');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (2,2,22,'imagen','/images/usuarios/camilo.torres/retos/r2/demo-1.jpg',NULL,1,'pendiente',NULL,'2026-08-28 12:30:00');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (3,3,27,'imagen',NULL,NULL,1,'rechazado','La foto no corresponde al reto, parece una foto de la oficina','2026-09-02 16:45:00');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (4,4,31,'imagen',NULL,NULL,1,'pendiente',NULL,'2026-09-10 09:15:00');
-- RESENAS demo (6): solo productos realmente comprados por quien opina
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (1,1,22,5,'Excelente balon, muy buen agarre en cancha sintetica','2026-08-16 18:10:00');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (2,3,23,4,'Buen equipo, llego rapido y en buen estado','2026-08-19 20:45:00');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (3,6,24,5,'Llego antes de lo esperado y se ve resistente','2026-08-21 16:05:00');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (4,33,25,5,'Me gusto la calidad, la volveria a comprar','2026-08-29 07:55:00');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (5,12,29,4,'Buen material, esperaba mas colores','2026-09-05 19:20:00');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (6,61,27,5,'La talla es fiel a la guia, muy recomendado','2026-09-21 21:30:00');
-- NOTIFICACIONES demo (6)
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (1,22,'pedido','Tu pedido esta en camino','Tu pedido de la venta 1 salio del almacen','/perfil/compras',1,'2026-08-07 10:00:00');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (2,22,'devolucion','Devolucion aprobada','Tu solicitud de devolucion de la venta 1 fue aprobada','/perfil/devolucion/1',0,'2026-08-14 10:10:00');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (3,23,'pedido','Tu pedido llego','Tu pedido de la venta 4 fue entregado','/perfil/compras',1,'2026-08-22 15:50:00');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (4,24,'reto','Avance aprobado','Tu avance del reto Semana Activa fue aprobado','/mis-retos',0,'2026-08-21 11:00:00');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (5,23,'devolucion','Necesitamos mas evidencias','Adjunta mas fotos del articulo para continuar con tu devolucion','/perfil/devolucion/4',0,'2026-09-20 12:00:00');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (6,22,'pqr','Tu solicitud fue respondida','El equipo respondio tu PQR sobre la factura','/pqr',1,'2026-09-06 09:30:00');
-- CHAT demo (2)
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_PRODUCTO,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (1,'SOPORTE',22,NULL,NULL,NULL,NULL,'CERRADA','2026-08-08 09:00:00','2026-08-08 09:40:00');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_PRODUCTO,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (2,'VENDEDOR',22,1,1,NULL,NULL,'ACTIVA','2026-09-22 10:15:00','2026-09-22 10:40:00');
-- CHAT_MENSAJE demo (5)
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (1,1,22,'CLIENTE','Hola, necesito ayuda con la factura de mi pedido',1,'2026-08-08 09:02:00');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (2,1,NULL,'ADMIN','Con gusto, cual es el numero de tu pedido para revisarlo',1,'2026-08-08 09:20:00');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (3,1,NULL,'SISTEMA','Chat cerrado por el equipo de JADDA',1,'2026-08-08 09:40:00');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (4,2,22,'CLIENTE','Buenas, los guayos de la foto tienen garantia',0,'2026-09-22 10:17:00');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (5,2,34,'VENDEDOR','Si, traen 6 meses de garantia por defectos de fabrica, escribe cuando quieras',0,'2026-09-22 10:38:00');
-- AVISOS_STOCK demo (2)
INSERT IGNORE INTO AVISOS_STOCK (ID_AVISO,ID_VARIANTE,ID_USUARIO,FECHA_CREACION,ENVIADO) VALUES (1,3,27,'2026-09-04 10:00:00',0);
INSERT IGNORE INTO AVISOS_STOCK (ID_AVISO,ID_VARIANTE,ID_USUARIO,FECHA_CREACION,ENVIADO) VALUES (2,7,22,'2026-09-12 14:20:00',0);
-- PLANES_USUARIO demo (2)
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (1,22,1,1,'2026-08-06',0);
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (2,24,3,4,'2026-08-14',1);
-- PQR demo (2)
INSERT IGNORE INTO PQR (ID_PQR,ID_USUARIO,TIPO,ASUNTO,DESCRIPCION,NUMERO_PEDIDO,FECHA,ESTADO) VALUES (1,22,'PETICION','Solicitud de factura con NIT','Buenas tardes, necesito la factura de mi pedido con NIT de la empresa','00012345','2026-09-05 10:30:00','RESUELTO');
INSERT IGNORE INTO PQR (ID_PQR,ID_USUARIO,TIPO,ASUNTO,DESCRIPCION,NUMERO_PEDIDO,FECHA,ESTADO) VALUES (2,25,'QUEJA','Embalaje deficiente','El paquete llego con la caja abierta por una esquina, el producto bien','00054321','2026-09-18 17:05:00','PENDIENTE');
-- FAVORITOS demo (12)
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (1,22,1,'2026-08-05');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (2,22,5,'2026-08-12');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (3,23,2,'2026-08-08');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (4,23,6,'2026-08-15');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (5,24,3,'2026-08-14');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (6,25,5,'2026-08-22');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (7,26,12,'2026-09-02');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (8,27,2,'2026-09-10');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (9,28,23,'2026-09-12');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (10,29,30,'2026-09-16');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (11,30,1,'2026-09-20');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (12,33,5,'2026-09-25');
-- DESCUENTOS demo (2; ids 5-6 porque la semilla ocupa 1-2); el 6 es el cupon del reto 1
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (5,'Descuento temporada gimnasio',10,'2026-08-01','2026-08-31',0,200000);
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (6,'RETO-DEMO-2026',10,'2026-08-15','2026-09-14',0,50000);

SET FOREIGN_KEY_CHECKS=1;
