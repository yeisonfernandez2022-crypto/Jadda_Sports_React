/*
 * setup.js  — Inicialización automática de la base de datos.
 * Se ejecuta en cada arranque del backend (server.js lo require).
 * Crea todas las tablas con CREATE TABLE IF NOT EXISTS y
 * siembra datos de referencia con INSERT IGNORE (no duplica).
 *
 * Tiene un mecanismo de reintentos para esperar a que MySQL
 * esté lista en el arranque de Docker (hasta 10 intentos).
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuración separada del pool de db.js  — esta conexión es solo para setup
const DB_CONFIG = {
  host: process.env.DB_HOST || 'database',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'tu_password_secreto',
  database: process.env.DB_NAME || 'jadda_sports_db',
  charset: 'utf8mb4',
  multipleStatements: true,  // Necesario para ejecutar múltiples CREATE/INSERT en una sola llamada
};

const CREATE_TABLES_RAW = `

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
    TOKEN VARCHAR(6) DEFAULT NULL,
    TOKEN_EXPIRA DATETIME DEFAULT NULL,
    foto_url VARCHAR(255) DEFAULT NULL,
    AUTH_PROVIDER VARCHAR(50) DEFAULT 'local',
    PROVIDER_ID VARCHAR(255) DEFAULT NULL,
    EMAIL_PENDIENTE VARCHAR(100) DEFAULT NULL,
    ULTIMA_CONEXION DATETIME DEFAULT NULL,
    ULTIMA_IP VARCHAR(45) DEFAULT NULL,
    ULTIMA_UBICACION VARCHAR(100) DEFAULT NULL,
    DEBE_CAMBIAR_PASSWORD TINYINT DEFAULT 0,
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
`;

// =========================================================================
// DATOS DE REFERENCIA (seed)
// INSERT IGNORE evita duplicados si el setup se ejecuta múltiples veces.
// =========================================================================

const SEED_DATA = `
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
(98, 'N/A', 'Presentación', '5lb', 100),
(99, 'N/A', 'Presentación', '300g', 150),
(100, 'N/A', 'Presentación', '300g', 120),

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
-- IMÁGENES: 3 imágenes por producto (312 registros = 44 —3 + 60 —3)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO PRODUCTO_IMAGENES (ID_IMAGEN, ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES
(1,1,'/images/productos/Producto_01/img_1.jpg',1),
(2,1,'/images/productos/Producto_01/img_2.png',2),
(3,1,'/images/productos/Producto_01/img_3.png',3),
(4,2,'/images/productos/Producto_02/img_1.webp',1),
(5,2,'/images/productos/Producto_02/img_2.jpg',2),
(6,2,'/images/productos/Producto_02/img_3.jpg',3),
(7,3,'/images/productos/Producto_03/img_1.jpg',1),
(8,3,'/images/productos/Producto_03/img_2.jpg',2),
(9,3,'/images/productos/Producto_03/img_3.jpg',3),
(10,4,'/images/productos/Producto_04/img_1.webp',1),
(11,4,'/images/productos/Producto_04/img_2.jpg',2),
(12,4,'/images/productos/Producto_04/img_3.jpg',3),
(13,5,'/images/productos/Producto_05/img_1.png',1),
(14,5,'/images/productos/Producto_05/img_2.jpg',2),
(15,5,'/images/productos/Producto_05/img_3.jpg',3),
(16,6,'/images/productos/Producto_06/img_1.jpg',1),
(17,6,'/images/productos/Producto_06/img_2.jpg',2),
(18,6,'/images/productos/Producto_06/img_3.jpg',3),
(19,7,'/images/productos/Producto_07/img_1.png',1),
(20,7,'/images/productos/Producto_07/img_2.jpg',2),
(21,7,'/images/productos/Producto_07/img_3.jpeg',3),
(22,8,'/images/productos/Producto_08/img_1.jpg',1),
(23,8,'/images/productos/Producto_08/img_2.jpg',2),
(24,8,'/images/productos/Producto_08/img_3.webp',3),
(25,9,'/images/productos/Producto_09/img_1.png',1),
(26,9,'/images/productos/Producto_09/img_2.jpg',2),
(27,9,'/images/productos/Producto_09/img_3.jpg',3),
(28,10,'/images/productos/Producto_10/img_1.jpg',1),
(29,10,'/images/productos/Producto_10/img_2.webp',2),
(30,10,'/images/productos/Producto_10/img_3.jpg',3),
(31,11,'/images/productos/Producto_11/img_1.jpg',1),
(32,11,'/images/productos/Producto_11/img_2.jpg',2),
(33,11,'/images/productos/Producto_11/img_3.jpg',3),
(34,12,'/images/productos/Producto_12/img_1.png',1),
(35,12,'/images/productos/Producto_12/img_2.png',2),
(36,12,'/images/productos/Producto_12/img_3.jpg',3),
(37,13,'/images/productos/Producto_13/img_1.jpg',1),
(38,13,'/images/productos/Producto_13/img_2.jpg',2),
(39,13,'/images/productos/Producto_13/img_3.jpg',3),
(40,14,'/images/productos/Producto_14/img_1.webp',1),
(41,14,'/images/productos/Producto_14/img_2.jpg',2),
(42,14,'/images/productos/Producto_14/img_3.jpg',3),
(43,15,'/images/productos/Producto_15/img_1.jpeg',1),
(44,15,'/images/productos/Producto_15/img_2.jpg',2),
(45,15,'/images/productos/Producto_15/img_3.jpg',3),
(46,16,'/images/productos/Producto_16/img_1.jpg',1),
(47,16,'/images/productos/Producto_16/img_2.jpg',2),
(48,16,'/images/productos/Producto_16/img_3.webp',3),
(49,17,'/images/productos/Producto_17/img_1.jpg',1),
(50,17,'/images/productos/Producto_17/img_2.jpg',2),
(51,17,'/images/productos/Producto_17/img_3.jpg',3),
(52,18,'/images/productos/Producto_18/img_1.jpg',1),
(53,18,'/images/productos/Producto_18/img_2.jpg',2),
(54,18,'/images/productos/Producto_18/img_3.webp',3),
(55,19,'/images/productos/Producto_19/img_1.jpg',1),
(56,19,'/images/productos/Producto_19/img_2.jpg',2),
(57,19,'/images/productos/Producto_19/img_3.jpg',3),
(58,20,'/images/productos/Producto_20/img_1.jpg',1),
(59,20,'/images/productos/Producto_20/img_2.webp',2),
(60,20,'/images/productos/Producto_20/img_3.jpg',3),
(61,21,'/images/productos/Producto_21/img_1.jpg',1),
(62,21,'/images/productos/Producto_21/img_2.jpg',2),
(63,21,'/images/productos/Producto_21/img_3.jpg',3),
(64,22,'/images/productos/Producto_22/img_1.jpg',1),
(65,22,'/images/productos/Producto_22/img_2.jpg',2),
(66,22,'/images/productos/Producto_22/img_3.jpeg',3),
(67,23,'/images/productos/Producto_23/img_1.jpeg',1),
(68,23,'/images/productos/Producto_23/img_2.jpg',2),
(69,23,'/images/productos/Producto_23/img_3.jpg',3),
(70,24,'/images/productos/Producto_24/img_1.jpg',1),
(71,24,'/images/productos/Producto_24/img_2.jpg',2),
(72,24,'/images/productos/Producto_24/img_3.jpg',3),
(73,25,'/images/productos/Producto_25/img_1.jpg',1),
(74,25,'/images/productos/Producto_25/img_2.jpg',2),
(75,25,'/images/productos/Producto_25/img_3.jpg',3),
(76,26,'/images/productos/Producto_26/img_1.jpg',1),
(77,26,'/images/productos/Producto_26/img_2.jpg',2),
(78,26,'/images/productos/Producto_26/img_3.jpg',3),
(79,27,'/images/productos/Producto_27/img_1.jpg',1),
(80,27,'/images/productos/Producto_27/img_2.jpg',2),
(81,27,'/images/productos/Producto_27/img_3.jpg',3),
(82,28,'/images/productos/Producto_28/img_1.jpg',1),
(83,28,'/images/productos/Producto_28/img_2.jpg',2),
(84,28,'/images/productos/Producto_28/img_3.jpg',3),
(85,29,'/images/productos/Producto_29/img_1.webp',1),
(86,29,'/images/productos/Producto_29/img_2.webp',2),
(87,29,'/images/productos/Producto_29/img_3.webp',3),
(88,30,'/images/productos/Producto_30/img_1.webp',1),
(89,30,'/images/productos/Producto_30/img_2.png',2),
(90,30,'/images/productos/Producto_30/img_3.png',3),
(91,31,'/images/productos/Producto_31/img_1.jpg',1),
(92,31,'/images/productos/Producto_31/img_2.jpg',2),
(93,31,'/images/productos/Producto_31/img_3.jpg',3),
(94,32,'/images/productos/Producto_32/img_1.webp',1),
(95,32,'/images/productos/Producto_32/img_2.jpg',2),
(96,32,'/images/productos/Producto_32/img_3.jpg',3),
(97,33,'/images/productos/Producto_33/img_1.jpg',1),
(98,33,'/images/productos/Producto_33/img_2.jpg',2),
(99,33,'/images/productos/Producto_33/img_3.jpg',3),
(100,34,'/images/productos/Producto_34/img_1.jpg',1),
(101,34,'/images/productos/Producto_34/img_2.webp',2),
(102,34,'/images/productos/Producto_34/img_3.webp',3),
(103,35,'/images/productos/Producto_35/img_1.jpg',1),
(104,35,'/images/productos/Producto_35/img_2.webp',2),
(105,35,'/images/productos/Producto_35/img_3.jpg',3),
(106,36,'/images/productos/Producto_36/img_1.webp',1),
(107,36,'/images/productos/Producto_36/img_2.jpg',2),
(108,36,'/images/productos/Producto_36/img_3.jpg',3),
(109,37,'/images/productos/Producto_37/img_1.jpg',1),
(110,37,'/images/productos/Producto_37/img_2.jpg',2),
(111,37,'/images/productos/Producto_37/img_3.webp',3),
(112,38,'/images/productos/Producto_38/img_1.webp',1),
(113,38,'/images/productos/Producto_38/img_2.webp',2),
(114,38,'/images/productos/Producto_38/img_3.jpg',3),
(115,39,'/images/productos/Producto_39/img_1.jpg',1),
(116,39,'/images/productos/Producto_39/img_2.jpg',2),
(117,39,'/images/productos/Producto_39/img_3.jpg',3),
(118,40,'/images/productos/Producto_40/img_1.webp',1),
(119,40,'/images/productos/Producto_40/img_2.jpg',2),
(120,40,'/images/productos/Producto_40/img_3.jpg',3),
(121,41,'/images/productos/Producto_41/img_1.jpg',1),
(122,41,'/images/productos/Producto_41/img_2.webp',2),
(123,41,'/images/productos/Producto_41/img_3.jpg',3),
(124,42,'/images/productos/Producto_42/img_1.jpg',1),
(125,42,'/images/productos/Producto_42/img_2.jpg',2),
(126,42,'/images/productos/Producto_42/img_3.jpg',3),
(127,43,'/images/productos/Producto_43/img_1.webp',1),
(128,43,'/images/productos/Producto_43/img_2.jpg',2),
(129,43,'/images/productos/Producto_43/img_3.jpg',3),
(130,44,'/images/productos/Producto_44/img_1.jpg',1),
(131,44,'/images/productos/Producto_44/img_2.jpg',2),
(132,44,'/images/productos/Producto_44/img_3.jpg',3),
(133,45,'/images/productos/Producto_45/imagen_1.jpg',1),
(134,45,'/images/productos/Producto_45/imagen_2.jpg',2),
(135,45,'/images/productos/Producto_45/imagen_3.jpg',3),
(136,46,'/images/productos/Producto_46/imagen_1.jpg',1),
(137,46,'/images/productos/Producto_46/imagen_2.jpg',2),
(138,46,'/images/productos/Producto_46/imagen_3.jpg',3),
(139,47,'/images/productos/Producto_47/imagen_1.jpg',1),
(140,47,'/images/productos/Producto_47/imagen_2.jpg',2),
(141,47,'/images/productos/Producto_47/imagen_3.jpg',3),
(142,48,'/images/productos/Producto_48/imagen_1.png',1),
(143,48,'/images/productos/Producto_48/imagen_2.jpg',2),
(144,48,'/images/productos/Producto_48/imagen_3.jpg',3),
(145,49,'/images/productos/Producto_49/imagen_1.webp',1),
(146,49,'/images/productos/Producto_49/imagen_2.jpg',2),
(147,49,'/images/productos/Producto_49/imagen_3.jpg',3),
(148,50,'/images/productos/Producto_50/imagen_1.jpg',1),
(149,50,'/images/productos/Producto_50/imagen_2.jpg',2),
(150,50,'/images/productos/Producto_50/imagen_3.jpg',3),
(151,51,'/images/productos/Producto_51/imagen_1.jpg',1),
(152,51,'/images/productos/Producto_51/imagen_2.jpg',2),
(153,51,'/images/productos/Producto_51/imagen_3.jpg',3),
(154,52,'/images/productos/Producto_52/imagen_1.webp',1),
(155,52,'/images/productos/Producto_52/imagen_2.webp',2),
(156,52,'/images/productos/Producto_52/imagen_3.webp',3),
(157,53,'/images/productos/Producto_53/imagen_1.webp',1),
(158,53,'/images/productos/Producto_53/imagen_2.webp',2),
(159,53,'/images/productos/Producto_53/imagen_3.jpg',3),
(160,54,'/images/productos/Producto_54/imagen_1.webp',1),
(161,54,'/images/productos/Producto_54/imagen_2.jpg',2),
(162,54,'/images/productos/Producto_54/imagen_3.jpg',3),
(163,55,'/images/productos/Producto_55/imagen_1.jpg',1),
(164,55,'/images/productos/Producto_55/imagen_2.jpg',2),
(165,55,'/images/productos/Producto_55/imagen_3.jpg',3),
(166,56,'/images/productos/Producto_56/imagen_1.webp',1),
(167,56,'/images/productos/Producto_56/imagen_2.jpg',2),
(168,56,'/images/productos/Producto_56/imagen_3.jpg',3),
(169,57,'/images/productos/Producto_57/imagen_1.webp',1),
(170,57,'/images/productos/Producto_57/imagen_2.webp',2),
(171,57,'/images/productos/Producto_57/imagen_3.jpg',3),
(172,58,'/images/productos/Producto_58/imagen_1.jpg',1),
(173,58,'/images/productos/Producto_58/imagen_2.jpg',2),
(174,58,'/images/productos/Producto_58/imagen_3.jpg',3),
(175,59,'/images/productos/Producto_59/imagen_1.jpg',1),
(176,59,'/images/productos/Producto_59/imagen_2.jpg',2),
(177,59,'/images/productos/Producto_59/imagen_3.webp',3),
(178,60,'/images/productos/Producto_60/imagen_1.jpg',1),
(179,60,'/images/productos/Producto_60/imagen_2.jpg',2),
(180,60,'/images/productos/Producto_60/imagen_3.webp',3),
(181,61,'/images/productos/Producto_61/imagen_1.jpg',1),
(182,61,'/images/productos/Producto_61/imagen_2.jpg',2),
(183,61,'/images/productos/Producto_61/imagen_3.webp',3),
(184,62,'/images/productos/Producto_62/imagen_1.jpg',1),
(185,62,'/images/productos/Producto_62/imagen_2.jpg',2),
(186,62,'/images/productos/Producto_62/imagen_3.webp',3),
(187,63,'/images/productos/Producto_63/imagen_1.jpg',1),
(188,63,'/images/productos/Producto_63/imagen_2.jpg',2),
(189,63,'/images/productos/Producto_63/imagen_3.jpg',3),
(190,64,'/images/productos/Producto_64/imagen_1.jpg',1),
(191,64,'/images/productos/Producto_64/imagen_2.jpg',2),
(192,64,'/images/productos/Producto_64/imagen_3.jpg',3),
(193,65,'/images/productos/Producto_65/imagen_1.webp',1),
(194,65,'/images/productos/Producto_65/imagen_2.png',2),
(195,65,'/images/productos/Producto_65/imagen_3.jpg',3),
(196,66,'/images/productos/Producto_66/imagen_1.webp',1),
(197,66,'/images/productos/Producto_66/imagen_2.jpg',2),
(198,66,'/images/productos/Producto_66/imagen_3.webp',3),
(199,67,'/images/productos/Producto_67/imagen_1.jpg',1),
(200,67,'/images/productos/Producto_67/imagen_2.jpg',2),
(201,67,'/images/productos/Producto_67/imagen_3.jpg',3),
(202,68,'/images/productos/Producto_68/imagen_1.jpg',1),
(203,68,'/images/productos/Producto_68/imagen_2.jpg',2),
(204,68,'/images/productos/Producto_68/imagen_3.jpg',3),
(205,69,'/images/productos/Producto_69/imagen_1.jpg',1),
(206,69,'/images/productos/Producto_69/imagen_2.jpg',2),
(207,69,'/images/productos/Producto_69/imagen_3.jpg',3),
(208,70,'/images/productos/Producto_70/imagen_1.jpg',1),
(209,70,'/images/productos/Producto_70/imagen_2.jpg',2),
(210,70,'/images/productos/Producto_70/imagen_3.png',3),
(211,71,'/images/productos/Producto_71/imagen_1.jpg',1),
(212,71,'/images/productos/Producto_71/imagen_2.jpg',2),
(213,71,'/images/productos/Producto_71/imagen_3.jpg',3),
(214,72,'/images/productos/Producto_72/imagen_1.jpg',1),
(215,72,'/images/productos/Producto_72/imagen_2.webp',2),
(216,72,'/images/productos/Producto_72/imagen_3.webp',3),
(217,73,'/images/productos/Producto_73/imagen_1.jpg',1),
(218,73,'/images/productos/Producto_73/imagen_2.jpg',2),
(219,73,'/images/productos/Producto_73/imagen_3.jpg',3),
(220,74,'/images/productos/Producto_74/imagen_1.jpg',1),
(221,74,'/images/productos/Producto_74/imagen_2.jpg',2),
(222,74,'/images/productos/Producto_74/imagen_3.jpg',3),
(223,75,'/images/productos/Producto_75/imagen_1.webp',1),
(224,75,'/images/productos/Producto_75/imagen_2.jpg',2),
(225,75,'/images/productos/Producto_75/imagen_3.jpg',3),
(226,76,'/images/productos/Producto_76/imagen_1.jpg',1),
(227,76,'/images/productos/Producto_76/imagen_2.jpg',2),
(228,76,'/images/productos/Producto_76/imagen_3.jpg',3),
(229,77,'/images/productos/Producto_77/imagen_1.jpg',1),
(230,77,'/images/productos/Producto_77/imagen_2.jpg',2),
(231,77,'/images/productos/Producto_77/imagen_3.jpg',3),
(232,78,'/images/productos/Producto_78/imagen_1.webp',1),
(233,78,'/images/productos/Producto_78/imagen_2.jpg',2),
(234,78,'/images/productos/Producto_78/imagen_3.jpg',3),
(235,79,'/images/productos/Producto_79/imagen_1.jpg',1),
(236,79,'/images/productos/Producto_79/imagen_2.jpg',2),
(237,79,'/images/productos/Producto_79/imagen_3.jpg',3),
(238,80,'/images/productos/Producto_80/imagen_1.jpg',1),
(239,80,'/images/productos/Producto_80/imagen_2.jpg',2),
(240,80,'/images/productos/Producto_80/imagen_3.jpg',3),
(241,81,'/images/productos/Producto_81/imagen_1.jpg',1),
(242,81,'/images/productos/Producto_81/imagen_2.webp',2),
(243,81,'/images/productos/Producto_81/imagen_3.jpg',3),
(244,82,'/images/productos/Producto_82/imagen_1.jpg',1),
(245,82,'/images/productos/Producto_82/imagen_2.jpg',2),
(246,82,'/images/productos/Producto_82/imagen_3.jpg',3),
(247,83,'/images/productos/Producto_83/imagen_1.jpg',1),
(248,83,'/images/productos/Producto_83/imagen_2.jpg',2),
(249,83,'/images/productos/Producto_83/imagen_3.jpg',3),
(250,84,'/images/productos/Producto_84/imagen_1.jpg',1),
(251,84,'/images/productos/Producto_84/imagen_2.webp',2),
(252,84,'/images/productos/Producto_84/imagen_3.webp',3),
(253,85,'/images/productos/Producto_85/imagen_1.jpg',1),
(254,85,'/images/productos/Producto_85/imagen_2.jpg',2),
(255,85,'/images/productos/Producto_85/imagen_3.jpg',3),
(256,86,'/images/productos/Producto_86/imagen_1.jpg',1),
(257,86,'/images/productos/Producto_86/imagen_2.jpg',2),
(258,86,'/images/productos/Producto_86/imagen_3.jpg',3),
(259,87,'/images/productos/Producto_87/imagen_1.jpg',1),
(260,87,'/images/productos/Producto_87/imagen_2.webp',2),
(261,87,'/images/productos/Producto_87/imagen_3.jpg',3),
(262,88,'/images/productos/Producto_88/imagen_1.jpg',1),
(263,88,'/images/productos/Producto_88/imagen_2.webp',2),
(264,88,'/images/productos/Producto_88/imagen_3.jpg',3),
(265,89,'/images/productos/Producto_89/imagen_1.jpg',1),
(266,89,'/images/productos/Producto_89/imagen_2.jpg',2),
(267,89,'/images/productos/Producto_89/imagen_3.jpg',3),
(268,90,'/images/productos/Producto_90/imagen_1.webp',1),
(269,90,'/images/productos/Producto_90/imagen_2.webp',2),
(270,90,'/images/productos/Producto_90/imagen_3.webp',3),
(271,91,'/images/productos/Producto_91/imagen_1.jpg',1),
(272,91,'/images/productos/Producto_91/imagen_2.jpg',2),
(273,91,'/images/productos/Producto_91/imagen_3.webp',3),
(274,92,'/images/productos/Producto_92/imagen_1.jpg',1),
(275,92,'/images/productos/Producto_92/imagen_2.jpg',2),
(276,92,'/images/productos/Producto_92/imagen_3.jpg',3),
(277,93,'/images/productos/Producto_93/imagen_1.jpg',1),
(278,93,'/images/productos/Producto_93/imagen_2.jpg',2),
(279,93,'/images/productos/Producto_93/imagen_3.jpg',3),
(280,94,'/images/productos/Producto_94/imagen_1.jpg',1),
(281,94,'/images/productos/Producto_94/imagen_2.jpg',2),
(282,94,'/images/productos/Producto_94/imagen_3.jpg',3),
(283,95,'/images/productos/Producto_95/imagen_1.jpg',1),
(284,95,'/images/productos/Producto_95/imagen_2.jpg',2),
(285,95,'/images/productos/Producto_95/imagen_3.jpg',3),
(286,96,'/images/productos/Producto_96/imagen_1.jpg',1),
(287,96,'/images/productos/Producto_96/imagen_2.jpg',2),
(288,96,'/images/productos/Producto_96/imagen_3.jpg',3),
(289,97,'/images/productos/Producto_97/imagen_1.jpg',1),
(290,97,'/images/productos/Producto_97/imagen_2.jpg',2),
(291,97,'/images/productos/Producto_97/imagen_3.jpg',3),
(292,98,'/images/productos/Producto_98/imagen_1.jpg',1),
(293,98,'/images/productos/Producto_98/imagen_2.jpg',2),
(294,98,'/images/productos/Producto_98/imagen_3.jpg',3),
(295,99,'/images/productos/Producto_99/imagen_1.webp',1),
(296,99,'/images/productos/Producto_99/imagen_2.jpg',2),
(297,99,'/images/productos/Producto_99/imagen_3.jpg',3),
(298,100,'/images/productos/Producto_100/imagen_1.jpg',1),
(299,100,'/images/productos/Producto_100/imagen_2.jpg',2),
(300,100,'/images/productos/Producto_100/imagen_3.jpg',3),
(301,101,'/images/productos/Producto_101/imagen_1.jpg',1),
(302,101,'/images/productos/Producto_101/imagen_2.jpg',2),
(303,101,'/images/productos/Producto_101/imagen_3.jpg',3),
(304,102,'/images/productos/Producto_102/imagen_1.jpg',1),
(305,102,'/images/productos/Producto_102/imagen_2.webp',2),
(306,102,'/images/productos/Producto_102/imagen_3.jpg',3),
(307,103,'/images/productos/Producto_103/imagen_1.jpg',1),
(308,103,'/images/productos/Producto_103/imagen_2.jpg',2),
(309,103,'/images/productos/Producto_103/imagen_3.jpg',3),
(310,104,'/images/productos/Producto_104/imagen_1.jpg',1),
(311,104,'/images/productos/Producto_104/imagen_2.jpg',2),
(312,104,'/images/productos/Producto_104/imagen_3.jpg',3);


-- -------------------------------------------------------------------------
-- MÉTODOS DE PAGO: 15 opciones (efectivo, tarjetas, Nequi, PSE, etc.)
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
(15,'Bitcoin','Pago con criptomoneda');

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
`;

const DEMO_DATA = `
-- USUARIOS demo (23)
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (22,'Ana María','Gómez','ana.admin@jadda.com','ana_admin','3109990011','$2b$10$gYY7GQnoIFMqopO8.L1qY.kso5WiFstHKvIDx0CiARoS4jUORB2qu','2026-09-01 00:00:00',NULL,NULL,1,1,NULL,NULL,NULL,'local',NULL,NULL,NULL,NULL,NULL,0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (23,'Carlos','Pérez','carlos.admin@jadda.com','carlos_admin','3119990022','$2b$10$gYY7GQnoIFMqopO8.L1qY.kso5WiFstHKvIDx0CiARoS4jUORB2qu','2026-09-01 00:00:00',NULL,NULL,1,1,NULL,NULL,NULL,'local',NULL,NULL,NULL,NULL,NULL,0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (24,'Laura','Díaz','laura.admin@jadda.com','laura_admin','3129990033','$2b$10$gYY7GQnoIFMqopO8.L1qY.kso5WiFstHKvIDx0CiARoS4jUORB2qu','2026-09-01 00:00:00',NULL,NULL,1,1,NULL,NULL,NULL,'local',NULL,NULL,NULL,NULL,NULL,0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (25,'Camilo','Torres','camilo.torres@gmail.com','camilo.torres','3101110011','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-30 00:00:00','CC','1010010011',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:40:16','::1',NULL,0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (26,'Valentina','Ruiz','valentina.ruiz@gmail.com','valentina.ruiz','3112220022','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-27 00:00:00','CC','1020020022',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Medellín, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (27,'Santiago','Herrera','santiago.herrera@gmail.com','santiago.herrera','3203330033','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-31 00:00:00','CC','1030030033',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Cali, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (28,'Mariana','López','mariana.lopez@gmail.com','mariana.lopez','3154440044','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-22 00:00:00','CC','1040040044',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Barranquilla, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (29,'Andrés Felipe','Mora','andres.mora@gmail.com','andres.mora','3125550055','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-17 00:00:00','CC','1050050055',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Bucaramanga, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (30,'Daniela','Castro','daniela.castro@gmail.com','daniela.castro','3186660066','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-12 00:00:00','CC','1060060066',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Cartagena, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (31,'Felipe','Gutiérrez','felipe.gutierrez@gmail.com','felipe.gutierrez','3177770077','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-07 00:00:00','CC','1070070077',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Pereira, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (32,'Carolina','Rojas','carolina.rojas@gmail.com','carolina.rojas','3008880088','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-02 00:00:00','CC','1080080088',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Manizales, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (33,'Juan Pablo','Ríos','juan.rios@gmail.com','juan.rios','3019990099','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-29 00:00:00','CC','1090090099',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Cúcuta, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (34,'Sofía','Martínez','sofia.martinez@gmail.com','sofia.martinez','3021010101','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-25 00:00:00','CC','1100100101',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Pasto, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (35,'Mateo','Álvarez','mateo.alvarez@gmail.com','mateo.alvarez','3032020202','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-20 00:00:00','CC','1110200202',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Ibagué, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (36,'Isabella','Moreno','isabella.moreno@gmail.com','isabella.moreno','3043030303','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-14 00:00:00','CC','1120300303',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Villavicencio, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (37,'Nicolás','Vargas','nicolas.vargas@gmail.com','nicolas.vargas','3054040404','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-10 00:00:00','CC','1130400404',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Neiva, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (38,'Gabriela','Ortiz','gabriela.ortiz@gmail.com','gabriela.ortiz','3065050505','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-08-04 00:00:00','CC','1140500505',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Santa Marta, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (39,'Esteban','Jiménez','esteban.jimenez@gmail.com','esteban.jimenez','3076060606','$2b$10$lN58063f5FUGYFKIMMbh4.SNY.QDVHYABiM.eP8S0hCVMBx9eUOye','2026-07-28 00:00:00','CC','1150600606',4,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:10','181.50.10.1','Armenia, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (40,'Alejandro','Mendoza','alejandro.mendoza@vendedor.com','alejandro.mendoza','3124440011','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-08-10 00:00:00','CC','10499139642',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:43:13','::1',NULL,0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (41,'Fernanda','Castillo','fernanda.castillo@vendedor.com','fernanda.castillo','3135550022','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-08-02 00:00:00','CC','10561606469',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:43:13','::1',NULL,0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (42,'Jorge','Herrera','jorge.herrera@vendedor.com','jorge.herrera','3146660033','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-07-31 00:00:00','CC','10429049798',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:11','181.50.10.5','Cali, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (43,'Valeria','León','valeria.leon@vendedor.com','valeria.leon','3157770044','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-08-17 00:00:00','CC','10934884388',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:11','181.50.10.5','Bucaramanga, Colombia',0);
INSERT IGNORE INTO USUARIOS (ID_USUARIO,NOMBRE_USUARIO,APELLIDO_USUARIO,EMAIL,USUARIO,telefono,CONTRASENA,FECHA_REGISTRO,TIPO_DOCUMENTO,NUMERO_DOCUMENTO,ID_ROL,CONFIRMADO,TOKEN,TOKEN_EXPIRA,foto_url,AUTH_PROVIDER,PROVIDER_ID,EMAIL_PENDIENTE,ULTIMA_CONEXION,ULTIMA_IP,ULTIMA_UBICACION,DEBE_CAMBIAR_PASSWORD) VALUES (44,'Esteban','Rojas','esteban.rojas@vendedor.com','esteban.rojas','3168880055','$2b$10$4T5KgvkvK6L2/ukyCtthOuWg9hZq.si4KgldTTQ2JXsSPpee6YOTe','2026-08-05 00:00:00','CC','10669679450',6,1,NULL,NULL,NULL,'local',NULL,NULL,'2026-09-01 00:36:11','181.50.10.5','Barranquilla, Colombia',0);

-- DIRECCIONES demo (36)
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (12,25,'Calle 45 #12-34','Chapinero','Bogotá','Cundinamarca','110111','3101110011','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (13,25,'Oficina Calle 45 #12-34','Centro','Bogotá','Cundinamarca','110111','3101110011','Trabajo',0);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (14,26,'Cra 70 #30-10','Laureles','Medellín','Antioquia','050031','3112220022','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (15,26,'Oficina Cra 70 #30-10','Centro','Medellín','Antioquia','050031','3112220022','Trabajo',0);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (16,27,'Av 6N #25-45','Granada','Cali','Valle del Cauca','760001','3203330033','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (17,28,'Calle 72 #50-60','El Prado','Barranquilla','Atlántico','080001','3154440044','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (18,29,'Cra 27 #45-12','Cabecera','Bucaramanga','Santander','680001','3125550055','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (19,29,'Oficina Cra 27 #45-12','Centro','Bucaramanga','Santander','680001','3125550055','Trabajo',0);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (20,30,'Bocagrande Cra 2 #8-20','Bocagrande','Cartagena','Bolívar','130001','3186660066','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (21,31,'Av Circunvalar #12-30','Pinares','Pereira','Risaralda','660001','3177770077','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (22,32,'Calle 50 #23-40','Palanque','Manizales','Caldas','170001','3008880088','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (23,33,'Av 0 #12-45','Centro','Cúcuta','Norte de Santander','540001','3019990099','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (24,34,'Cra 26 #18-20','Las Cuadras','Pasto','Nariño','520001','3021010101','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (25,35,'Cra 5 #30-15','La Pola','Ibagué','Tolima','730001','3032020202','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (26,36,'Calle 15 #40-20','Barzal','Villavicencio','Meta','500001','3043030303','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (27,37,'Cra 7 #26-10','Centro','Neiva','Huila','410001','3054040404','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (28,38,'Cra 5 #22-30','El Rodadero','Santa Marta','Magdalena','470001','3065050505','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (29,39,'Av Bolívar #15-20','Centro','Armenia','Quindío','630001','3076060606','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (30,25,'Calle 45 #12-34','Chapinero','Bogotá','Cundinamarca','110111','3101110011','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (31,25,'Oficina Calle 45 #12-34','Centro','Bogotá','Cundinamarca','110111','3101110011','Trabajo',0);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (32,26,'Cra 70 #30-10','Laureles','Medellín','Antioquia','050031','3112220022','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (33,26,'Oficina Cra 70 #30-10','Centro','Medellín','Antioquia','050031','3112220022','Trabajo',0);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (34,27,'Av 6N #25-45','Granada','Cali','Valle del Cauca','760001','3203330033','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (35,28,'Calle 72 #50-60','El Prado','Barranquilla','Atlántico','080001','3154440044','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (36,29,'Cra 27 #45-12','Cabecera','Bucaramanga','Santander','680001','3125550055','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (37,29,'Oficina Cra 27 #45-12','Centro','Bucaramanga','Santander','680001','3125550055','Trabajo',0);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (38,30,'Bocagrande Cra 2 #8-20','Bocagrande','Cartagena','Bolívar','130001','3186660066','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (39,31,'Av Circunvalar #12-30','Pinares','Pereira','Risaralda','660001','3177770077','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (40,32,'Calle 50 #23-40','Palanque','Manizales','Caldas','170001','3008880088','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (41,33,'Av 0 #12-45','Centro','Cúcuta','Norte de Santander','540001','3019990099','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (42,34,'Cra 26 #18-20','Las Cuadras','Pasto','Nariño','520001','3021010101','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (43,35,'Cra 5 #30-15','La Pola','Ibagué','Tolima','730001','3032020202','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (44,36,'Calle 15 #40-20','Barzal','Villavicencio','Meta','500001','3043030303','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (45,37,'Cra 7 #26-10','Centro','Neiva','Huila','410001','3054040404','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (46,38,'Cra 5 #22-30','El Rodadero','Santa Marta','Magdalena','470001','3065050505','Casa',1);
INSERT IGNORE INTO DIRECCIONES (ID_DIRECCION,ID_USUARIO,DIRECCION,BARRIO,CIUDAD,DEPARTAMENTO,CODIGO_POSTAL,TELEFONO_CONTACTO,ETIQUETA,ES_PRINCIPAL) VALUES (47,39,'Av Bolívar #15-20','Centro','Armenia','Quindío','630001','3076060606','Casa',1);

-- USUARIOS_METODOS_PAGO demo (34)
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (9,25,4,'Camilo Torres','3101110011','Nequi','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (10,26,4,'Valentina Ruiz','3112220022','Nequi','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (11,27,4,'Santiago Herrera','3203330033','Nequi','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (12,27,3,'Santiago Herrera','3203330033','N/A','N/A',0,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (13,28,7,'Mariana López','3154440044','N/A','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (14,28,4,'Mariana López','3154440044','N/A','N/A',0,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (15,29,2,'Andrés Felipe Mora','3125550055','N/A','Débito',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (16,30,7,'Daniela Castro','3186660066','N/A','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (17,31,7,'Felipe Gutiérrez','3177770077','N/A','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (18,32,2,'Carolina Rojas','3008880088','N/A','Débito',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (19,33,3,'Juan Pablo Ríos','3019990099','N/A','Crédito',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (20,34,4,'Sofía Martínez','3021010101','Nequi','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (21,35,2,'Mateo Álvarez','3032020202','N/A','Débito',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (22,36,4,'Isabella Moreno','3043030303','Nequi','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (23,37,4,'Nicolás Vargas','3054040404','Nequi','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (24,38,4,'Gabriela Ortiz','3065050505','Nequi','N/A',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (25,39,2,'Esteban Jiménez','3076060606','N/A','Débito',1,'2026-09-01 00:36:10');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (26,25,1,'Camilo Torres','3101110011','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (27,26,5,'Valentina Ruiz','3112220022','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (28,27,2,'Santiago Herrera','3203330033','N/A','Débito',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (29,27,4,'Santiago Herrera','3203330033','N/A','N/A',0,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (30,28,7,'Mariana López','3154440044','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (31,28,4,'Mariana López','3154440044','N/A','N/A',0,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (32,29,1,'Andrés Felipe Mora','3125550055','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (33,30,7,'Daniela Castro','3186660066','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (34,31,1,'Felipe Gutiérrez','3177770077','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (35,32,1,'Carolina Rojas','3008880088','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (36,33,4,'Juan Pablo Ríos','3019990099','Nequi','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (37,34,2,'Sofía Martínez','3021010101','N/A','Débito',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (38,35,1,'Mateo Álvarez','3032020202','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (39,36,7,'Isabella Moreno','3043030303','N/A','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (40,37,4,'Nicolás Vargas','3054040404','Nequi','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (41,38,4,'Gabriela Ortiz','3065050505','Nequi','N/A',1,'2026-09-01 00:37:12');
INSERT IGNORE INTO USUARIOS_METODOS_PAGO (ID,ID_USUARIO,ID_METODO,TITULAR,TELEFONO,BANCO,TIPO,ES_PRINCIPAL,FECHA_CREADO) VALUES (42,39,7,'Esteban Jiménez','3076060606','N/A','N/A',1,'2026-09-01 00:37:12');

-- FAVORITOS demo (90)
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (30,25,5,'2026-08-26 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (31,25,15,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (32,25,45,'2026-08-23 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (33,26,23,'2026-08-24 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (34,26,2,'2026-08-29 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (35,26,55,'2026-08-24 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (36,27,98,'2026-08-28 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (37,27,12,'2026-08-24 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (38,27,15,'2026-08-14 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (39,28,5,'2026-08-30 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (40,28,12,'2026-08-31 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (41,28,39,'2026-08-16 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (42,29,1,'2026-08-15 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (43,29,5,'2026-08-30 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (44,29,33,'2026-08-22 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (45,30,15,'2026-08-26 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (46,30,10,'2026-08-27 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (47,30,98,'2026-08-26 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (48,31,5,'2026-08-18 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (49,31,1,'2026-08-31 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (50,31,45,'2026-08-23 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (51,32,12,'2026-08-22 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (52,32,33,'2026-08-18 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (53,32,30,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (54,33,7,'2026-08-26 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (55,33,24,'2026-08-20 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (56,33,3,'2026-08-22 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (57,34,5,'2026-08-18 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (58,34,1,'2026-08-14 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (59,34,7,'2026-08-30 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (60,35,55,'2026-08-27 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (61,35,2,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (62,35,45,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (63,36,1,'2026-08-15 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (64,36,45,'2026-08-28 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (65,36,23,'2026-08-22 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (66,37,3,'2026-08-30 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (67,37,33,'2026-08-19 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (68,37,15,'2026-08-18 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (69,38,24,'2026-08-28 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (70,38,55,'2026-08-15 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (71,38,5,'2026-08-18 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (72,39,1,'2026-08-31 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (73,39,55,'2026-08-15 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (74,39,84,'2026-09-01 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (75,25,5,'2026-09-01 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (76,25,98,'2026-09-01 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (77,25,3,'2026-08-16 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (78,26,80,'2026-08-17 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (79,26,5,'2026-08-30 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (80,26,55,'2026-08-20 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (81,27,12,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (82,27,3,'2026-08-31 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (83,27,2,'2026-08-24 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (84,28,3,'2026-08-17 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (85,28,10,'2026-08-13 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (86,28,5,'2026-08-16 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (87,29,1,'2026-08-17 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (88,29,30,'2026-08-27 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (89,29,2,'2026-08-20 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (90,30,39,'2026-08-30 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (91,30,2,'2026-08-17 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (92,30,45,'2026-08-19 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (93,31,23,'2026-08-27 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (94,31,5,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (95,31,2,'2026-08-15 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (96,32,45,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (97,32,39,'2026-08-13 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (98,32,30,'2026-08-13 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (99,33,84,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (100,33,3,'2026-08-27 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (101,33,12,'2026-08-22 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (102,34,24,'2026-08-26 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (103,34,55,'2026-08-18 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (104,34,5,'2026-09-01 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (105,35,33,'2026-08-28 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (106,35,45,'2026-08-15 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (107,35,5,'2026-08-14 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (108,36,33,'2026-08-23 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (109,36,39,'2026-08-27 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (110,36,12,'2026-08-26 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (111,37,1,'2026-08-21 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (112,37,2,'2026-08-15 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (113,37,3,'2026-08-21 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (114,38,33,'2026-08-20 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (115,38,98,'2026-09-01 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (116,38,39,'2026-08-24 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (117,39,5,'2026-08-20 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (118,39,23,'2026-08-25 00:00:00');
INSERT IGNORE INTO FAVORITOS (ID_FAVORITO,ID_USUARIO,ID_PRODUCTO,FECHA_AGREGADO) VALUES (119,39,55,'2026-08-15 00:00:00');

-- SOLICITUDES_VENDEDOR demo (7)
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (10,40,'Sport Andina Pro SAS','900333444','Alejandro Mendoza','sportandina@empresa.com','3124440011','Cundinamarca','Bogotá','Cra 15 #85-20','Fútbol, Baloncesto','Especialistas en fútbol y baloncesto profesional con productos premium','APROBADA',NULL,'2026-08-04 00:36:11','2026-08-27 00:36:11');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (11,41,'FitZone Colombia Ltda','900444555','Fernanda Castillo','fitzone@empresa.com','3135550022','Antioquia','Medellín','Calle 10 #40-30','Gimnasio, Suplementos, Hogar fitness','Equipamiento de fuerza y suplementación para resultados reales','APROBADA',NULL,'2026-08-09 00:36:11','2026-08-22 00:36:11');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (12,42,'Acuática Pro SAS','900555666','Jorge Herrera','acuatica@empresa.com','3146660033','Valle del Cauca','Cali','Av 3N #25-40','Natación, Ciclismo, Tecnología deportiva','Todo para agua y ruta con tecnología de punta','APROBADA',NULL,'2026-08-16 00:36:11','2026-08-25 00:36:11');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (13,43,'Extremo Total SAS','900666777','Valeria León','extremo@empresa.com','3157770044','Santander','Bucaramanga','Cra 27 #45-12','Deportes extremos, Protección, Accesorios','Adrenalina segura: equipamiento certificado para extremos','APROBADA',NULL,'2026-08-13 00:36:11','2026-08-24 00:36:11');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (14,44,'UrbanStyle Deportivo','900777888','Esteban Rojas','urbanstyle@empresa.com','3168880055','Atlántico','Barranquilla','Calle 72 #50-60','Ropa deportiva, Accesorios, Cardio','Moda y rendimiento para el día a día deportivo','APROBADA',NULL,'2026-08-17 00:36:11','2026-08-25 00:36:11');
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (15,NULL,'Andes Gear SAS','900888999','Roberto Silva','andesgear@empresa.com','3179990066','Cundinamarca','Bogotá','Calle 80 #15-10','Ciclismo, Deportes extremos','Equipamiento para ciclismo de montaña y escalada','PENDIENTE',NULL,'2026-09-01 00:36:11',NULL);
INSERT IGNORE INTO SOLICITUDES_VENDEDOR (ID_SOLICITUD,ID_USUARIO,NOMBRE_EMPRESA,NIT,NOMBRE_REPRESENTANTE,EMAIL_EMPRESA,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,DESCRIPCION,ESTADO,OBSERVACION_ADMIN,FECHA_CREACION,FECHA_PROCESADA) VALUES (16,NULL,'Caribe Fit Ltda','900999111','Lucía Herrera','caribefit@empresa.com','3180000077','Bolívar','Cartagena','Av San Martín #6-20','Natación, Ropa deportiva','Moda deportiva para clima cálido y natación','PENDIENTE',NULL,'2026-09-01 00:36:11',NULL);

-- VENDEDORES demo (5)
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (5,40,10,'Sport Andina Pro SAS','900333444','sportandina@empresa.com','3124440011','Cundinamarca','Bogotá','Cra 15 #85-20','Fútbol, Baloncesto','ACTIVO','2026-09-01 00:36:11');
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (6,41,11,'FitZone Colombia Ltda','900444555','fitzone@empresa.com','3135550022','Antioquia','Medellín','Calle 10 #40-30','Gimnasio, Suplementos, Hogar fitness','ACTIVO','2026-09-01 00:36:11');
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (7,42,12,'Acuática Pro SAS','900555666','acuatica@empresa.com','3146660033','Valle del Cauca','Cali','Av 3N #25-40','Natación, Ciclismo, Tecnología deportiva','ACTIVO','2026-09-01 00:36:11');
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (8,43,13,'Extremo Total SAS','900666777','extremo@empresa.com','3157770044','Santander','Bucaramanga','Cra 27 #45-12','Deportes extremos, Protección, Accesorios','ACTIVO','2026-09-01 00:36:11');
INSERT IGNORE INTO VENDEDORES (ID_VENDEDOR,ID_USUARIO,ID_SOLICITUD,NOMBRE_EMPRESA,NIT,EMAIL_VENDEDOR,TELEFONO,DEPARTAMENTO,CIUDAD,DIRECCION,CATEGORIAS,ESTADO,FECHA_REGISTRO) VALUES (9,44,14,'UrbanStyle Deportivo','900777888','urbanstyle@empresa.com','3168880055','Atlántico','Barranquilla','Calle 72 #50-60','Ropa deportiva, Accesorios, Cardio','ACTIVO','2026-09-01 00:36:11');

-- PRODUCTOS vendor assignment demo (40)
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='APROBADO' WHERE ID=6;
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='APROBADO' WHERE ID=7;
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='APROBADO' WHERE ID=8;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='APROBADO' WHERE ID=17;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='APROBADO' WHERE ID=18;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='APROBADO' WHERE ID=19;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='APROBADO' WHERE ID=20;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='APROBADO' WHERE ID=21;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='APROBADO' WHERE ID=22;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='APROBADO' WHERE ID=25;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='APROBADO' WHERE ID=26;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='APROBADO' WHERE ID=27;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='APROBADO' WHERE ID=28;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='APROBADO' WHERE ID=29;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='APROBADO' WHERE ID=30;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='APROBADO' WHERE ID=31;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='APROBADO' WHERE ID=32;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='APROBADO' WHERE ID=33;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='APROBADO' WHERE ID=34;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='APROBADO' WHERE ID=35;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='APROBADO' WHERE ID=38;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='APROBADO' WHERE ID=42;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=44;
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='APROBADO' WHERE ID=45;
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='APROBADO' WHERE ID=46;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='APROBADO' WHERE ID=47;
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='APROBADO' WHERE ID=51;
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=52;
UPDATE PRODUCTOS SET ID_VENDEDOR=5, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=53;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=61;
UPDATE PRODUCTOS SET ID_VENDEDOR=6, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=62;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='APROBADO' WHERE ID=67;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=68;
UPDATE PRODUCTOS SET ID_VENDEDOR=7, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=69;
UPDATE PRODUCTOS SET ID_VENDEDOR=8, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=75;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='APROBADO' WHERE ID=79;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='APROBADO' WHERE ID=80;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='APROBADO' WHERE ID=81;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=82;
UPDATE PRODUCTOS SET ID_VENDEDOR=9, ESTADO_PUBLICACION='PENDIENTE' WHERE ID=83;

-- VENTAS demo (40)
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (47,25,'2026-09-01 10:00:00','{"demo":true,"metodo":1}','232000.00','COMPLETADA',1,'DEMO-REF-1000');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (48,26,'2026-09-01 11:07:00','{"demo":true,"metodo":2}','552000.00','COMPLETADA',2,'DEMO-REF-1001');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (49,27,'2026-08-31 12:14:00','{"demo":true,"metodo":3}','2000000.00','COMPLETADA',3,'DEMO-REF-1002');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (50,28,'2026-08-30 13:21:00','{"demo":true,"metodo":4}','252000.00','COMPLETADA',4,'DEMO-REF-1003');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (51,29,'2026-08-29 14:28:00','{"demo":true,"metodo":5}','835000.00','COMPLETADA',5,'DEMO-REF-1004');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (52,30,'2026-08-28 15:35:00','{"demo":true,"metodo":7}','617000.00','COMPLETADA',7,'DEMO-REF-1005');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (53,31,'2026-08-27 16:42:00','{"demo":true,"metodo":1}','292000.00','COMPLETADA',1,'DEMO-REF-1006');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (54,32,'2026-08-26 17:49:00','{"demo":true,"metodo":2}','622000.00','COMPLETADA',2,'DEMO-REF-1007');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (55,33,'2026-08-25 18:56:00','{"demo":true,"metodo":3}','1070000.00','COMPLETADA',3,'DEMO-REF-1008');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (56,34,'2026-08-24 19:03:00','{"demo":true,"metodo":4}','232000.00','COMPLETADA',4,'DEMO-REF-1009');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (57,35,'2026-08-23 10:10:00','{"demo":true,"metodo":5}','672000.00','COMPLETADA',5,'DEMO-REF-1010');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (58,36,'2026-08-23 11:17:00','{"demo":true,"metodo":7}','2305000.00','COMPLETADA',7,'DEMO-REF-1011');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (59,37,'2026-08-22 12:24:00','{"demo":true,"metodo":1}','202000.00','COMPLETADA',1,'DEMO-REF-1012');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (60,38,'2026-08-21 13:31:00','{"demo":true,"metodo":2}','507000.00','COMPLETADA',2,'DEMO-REF-1013');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (61,39,'2026-08-20 14:38:00','{"demo":true,"metodo":3}','1165000.00','COMPLETADA',3,'DEMO-REF-1014');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (62,25,'2026-08-19 15:45:00','{"demo":true,"metodo":4}','182000.00','COMPLETADA',4,'DEMO-REF-1015');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (63,26,'2026-08-18 16:52:00','{"demo":true,"metodo":5}','1170000.00','COMPLETADA',5,'DEMO-REF-1016');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (64,27,'2026-08-17 17:59:00','{"demo":true,"metodo":7}','1030000.00','COMPLETADA',7,'DEMO-REF-1017');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (65,28,'2026-08-16 18:06:00','{"demo":true,"metodo":1}','662000.00','COMPLETADA',1,'DEMO-REF-1018');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (66,29,'2026-08-15 19:13:00','{"demo":true,"metodo":2}','552000.00','COMPLETADA',2,'DEMO-REF-1019');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (67,30,'2026-08-14 10:20:00','{"demo":true,"metodo":3}','307000.00','COMPLETADA',3,'DEMO-REF-1020');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (68,31,'2026-08-14 11:27:00','{"demo":true,"metodo":4}','82000.00','COMPLETADA',4,'DEMO-REF-1021');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (69,32,'2026-08-13 12:34:00','{"demo":true,"metodo":5}','1670000.00','COMPLETADA',5,'DEMO-REF-1022');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (70,33,'2026-08-12 13:41:00','{"demo":true,"metodo":7}','742000.00','COMPLETADA',7,'DEMO-REF-1023');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (71,34,'2026-08-11 14:48:00','{"demo":true,"metodo":1}','87000.00','COMPLETADA',1,'DEMO-REF-1024');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (72,35,'2026-08-10 15:55:00','{"demo":true,"metodo":2}','532000.00','COMPLETADA',2,'DEMO-REF-1025');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (73,36,'2026-08-09 16:02:00','{"demo":true,"metodo":3}','1410000.00','COMPLETADA',3,'DEMO-REF-1026');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (74,37,'2026-08-08 17:09:00','{"demo":true,"metodo":4}','102000.00','COMPLETADA',4,'DEMO-REF-1027');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (75,38,'2026-08-07 18:16:00','{"demo":true,"metodo":5}','900000.00','COMPLETADA',5,'DEMO-REF-1028');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (76,39,'2026-08-06 19:23:00','{"demo":true,"metodo":7}','3395000.00','COMPLETADA',7,'DEMO-REF-1029');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (77,25,'2026-08-31 10:30:00','{"demo":true,"metodo":1}','1450000.00','CANCELADA',1,'DEMO-REF-1030');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (78,26,'2026-08-13 11:37:00','{"demo":true,"metodo":2}','495000.00','CANCELADA',2,'DEMO-REF-1031');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (79,27,'2026-08-30 12:44:00','{"demo":true,"metodo":3}','1165000.00','CANCELADA',3,'DEMO-REF-1032');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (80,28,'2026-08-03 13:51:00','{"demo":true,"metodo":4}','480000.00','CANCELADA',4,'DEMO-REF-1033');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (81,29,'2026-08-21 14:58:00','{"demo":true,"metodo":5}','585000.00','CANCELADA',5,'DEMO-REF-1034');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (82,30,'2026-08-18 15:05:00','{"demo":true,"metodo":7}','567000.00','PENDIENTE',7,'DEMO-REF-1035');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (83,31,'2026-08-31 16:12:00','{"demo":true,"metodo":1}','292000.00','PENDIENTE',1,'DEMO-REF-1036');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (84,32,'2026-08-15 17:19:00','{"demo":true,"metodo":2}','860000.00','PENDIENTE',2,'DEMO-REF-1037');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (85,33,'2026-08-12 18:26:00','{"demo":true,"metodo":3}','1240000.00','ENVIADA',3,'DEMO-REF-1038');
INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO) VALUES (86,34,'2026-09-01 19:33:00','{"demo":true,"metodo":4}','232000.00','ENVIADA',4,'DEMO-REF-1039');

-- DETALLE_VENTAS demo (76)
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (54,47,1,1,1,'220000.00','220000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (55,48,2,16,1,'320000.00','320000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (56,48,6,54,2,'110000.00','220000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (57,49,6,54,2,'110000.00','220000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (58,49,7,55,1,'480000.00','480000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (59,49,10,84,2,'650000.00','1300000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (60,50,4,23,1,'240000.00','240000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (61,51,10,84,1,'650000.00','650000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (62,51,12,114,1,'185000.00','185000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (63,52,12,114,1,'185000.00','185000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (64,52,23,152,2,'210000.00','420000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (65,53,24,164,2,'140000.00','280000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (66,54,23,152,2,'210000.00','420000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (67,54,33,194,1,'190000.00','190000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (68,55,33,194,1,'190000.00','190000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (69,55,55,547,1,'520000.00','520000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (70,55,84,630,2,'180000.00','360000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (71,56,6,54,2,'110000.00','220000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (72,57,84,630,1,'180000.00','180000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (73,57,7,55,1,'480000.00','480000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (74,58,98,644,2,'360000.00','720000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (75,58,101,647,1,'1450000.00','1450000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (76,58,45,2675,1,'135000.00','135000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (77,59,17,130,2,'95000.00','190000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (78,60,45,2675,1,'135000.00','135000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (79,60,46,2711,2,'180000.00','360000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (80,61,46,2711,1,'180000.00','180000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (81,61,61,678,1,'85000.00','85000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (82,61,65,682,2,'450000.00','900000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (83,62,61,678,2,'85000.00','170000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (84,63,65,682,2,'450000.00','900000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (85,63,80,591,2,'135000.00','270000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (86,64,80,591,2,'135000.00','270000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (87,64,1,1,2,'220000.00','440000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (88,64,2,16,1,'320000.00','320000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (89,65,10,84,1,'650000.00','650000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (90,66,2,16,1,'320000.00','320000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (91,66,6,54,2,'110000.00','220000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (92,67,6,54,1,'110000.00','110000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (93,67,12,114,1,'185000.00','185000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (94,68,13,126,2,'35000.00','70000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (95,69,10,84,2,'650000.00','1300000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (96,69,12,114,2,'185000.00','370000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (97,70,12,114,2,'185000.00','370000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (98,70,15,128,1,'150000.00','150000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (99,70,23,152,1,'210000.00','210000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (100,71,16,129,1,'75000.00','75000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (101,72,23,152,2,'210000.00','420000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (102,72,50,258,1,'100000.00','100000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (103,73,33,194,1,'190000.00','190000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (104,73,55,547,2,'520000.00','1040000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (105,73,84,630,1,'180000.00','180000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (106,74,25,176,2,'45000.00','90000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (107,75,84,630,1,'180000.00','180000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (108,75,98,644,2,'360000.00','720000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (109,76,98,644,1,'360000.00','360000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (110,76,101,647,2,'1450000.00','2900000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (111,76,45,2675,1,'135000.00','135000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (112,77,101,647,1,'1450000.00','1450000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (113,78,45,2675,1,'135000.00','135000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (114,78,46,2711,2,'180000.00','360000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (115,79,46,2711,1,'180000.00','180000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (116,79,61,678,1,'85000.00','85000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (117,79,65,682,2,'450000.00','900000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (118,80,4,23,2,'240000.00','480000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (119,81,65,682,1,'450000.00','450000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (120,81,80,591,1,'135000.00','135000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (121,82,80,591,1,'135000.00','135000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (122,82,23,152,2,'210000.00','420000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (123,83,24,164,2,'140000.00','280000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (124,84,2,16,2,'320000.00','640000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (125,84,6,54,2,'110000.00','220000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (126,85,6,54,1,'110000.00','110000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (127,85,7,55,1,'480000.00','480000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (128,85,10,84,1,'650000.00','650000.00');
INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL) VALUES (129,86,6,54,2,'110000.00','220000.00');

-- ENVIOS demo (40)
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (45,47,'Calle 45 #12-34','Bogotá','Chapinero','Cundinamarca','110111','Demo envío poblado','3101110011','12000.00','PENDIENTE','2026-09-02 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (46,48,'Cra 70 #30-10','Medellín','Laureles','Antioquia','050031','Demo envío poblado','3112220022','12000.00','POR_EMPAQUETAR','2026-09-02 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (47,49,'Av 6N #25-45','Cali','Granada','Valle del Cauca','760001','Demo envío poblado','3203330033','0.00','EMPACADO','2026-09-01 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (48,50,'Calle 72 #50-60','Barranquilla','El Prado','Atlántico','080001','Demo envío poblado','3154440044','12000.00','EN_CAMINO','2026-08-31 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (49,51,'Cra 27 #45-12','Bucaramanga','Cabecera','Santander','680001','Demo envío poblado','3125550055','0.00','ENTREGADO','2026-08-30 00:00:00','2026-09-02 14:28:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (50,52,'Bocagrande Cra 2 #8-20','Cartagena','Bocagrande','Bolívar','130001','Demo envío poblado','3186660066','12000.00','PENDIENTE','2026-08-29 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (51,53,'Av Circunvalar #12-30','Pereira','Pinares','Risaralda','660001','Demo envío poblado','3177770077','12000.00','POR_EMPAQUETAR','2026-08-28 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (52,54,'Calle 50 #23-40','Manizales','Palanque','Caldas','170001','Demo envío poblado','3008880088','12000.00','EMPACADO','2026-08-27 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (53,55,'Av 0 #12-45','Cúcuta','Centro','Norte de Santander','540001','Demo envío poblado','3019990099','0.00','EN_CAMINO','2026-08-26 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (54,56,'Cra 26 #18-20','Pasto','Las Cuadras','Nariño','520001','Demo envío poblado','3021010101','12000.00','ENTREGADO','2026-08-25 00:00:00','2026-08-28 19:03:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (55,57,'Cra 5 #30-15','Ibagué','La Pola','Tolima','730001','Demo envío poblado','3032020202','12000.00','PENDIENTE','2026-08-24 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (56,58,'Calle 15 #40-20','Villavicencio','Barzal','Meta','500001','Demo envío poblado','3043030303','0.00','POR_EMPAQUETAR','2026-08-24 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (57,59,'Cra 7 #26-10','Neiva','Centro','Huila','410001','Demo envío poblado','3054040404','12000.00','EMPACADO','2026-08-23 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (58,60,'Cra 5 #22-30','Santa Marta','El Rodadero','Magdalena','470001','Demo envío poblado','3065050505','12000.00','EN_CAMINO','2026-08-22 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (59,61,'Av Bolívar #15-20','Armenia','Centro','Quindío','630001','Demo envío poblado','3076060606','0.00','ENTREGADO','2026-08-21 00:00:00','2026-08-24 14:38:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (60,62,'Calle 45 #12-34','Bogotá','Chapinero','Cundinamarca','110111','Demo envío poblado','3101110011','12000.00','PENDIENTE','2026-08-20 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (61,63,'Cra 70 #30-10','Medellín','Laureles','Antioquia','050031','Demo envío poblado','3112220022','0.00','POR_EMPAQUETAR','2026-08-19 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (62,64,'Av 6N #25-45','Cali','Granada','Valle del Cauca','760001','Demo envío poblado','3203330033','0.00','EMPACADO','2026-08-18 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (63,65,'Calle 72 #50-60','Barranquilla','El Prado','Atlántico','080001','Demo envío poblado','3154440044','12000.00','EN_CAMINO','2026-08-17 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (64,66,'Cra 27 #45-12','Bucaramanga','Cabecera','Santander','680001','Demo envío poblado','3125550055','12000.00','ENTREGADO','2026-08-16 00:00:00','2026-08-19 19:13:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (65,67,'Bocagrande Cra 2 #8-20','Cartagena','Bocagrande','Bolívar','130001','Demo envío poblado','3186660066','12000.00','PENDIENTE','2026-08-15 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (66,68,'Av Circunvalar #12-30','Pereira','Pinares','Risaralda','660001','Demo envío poblado','3177770077','12000.00','POR_EMPAQUETAR','2026-08-15 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (67,69,'Calle 50 #23-40','Manizales','Palanque','Caldas','170001','Demo envío poblado','3008880088','0.00','EMPACADO','2026-08-14 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (68,70,'Av 0 #12-45','Cúcuta','Centro','Norte de Santander','540001','Demo envío poblado','3019990099','12000.00','EN_CAMINO','2026-08-13 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (69,71,'Cra 26 #18-20','Pasto','Las Cuadras','Nariño','520001','Demo envío poblado','3021010101','12000.00','ENTREGADO','2026-08-12 00:00:00','2026-08-15 14:48:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (70,72,'Cra 5 #30-15','Ibagué','La Pola','Tolima','730001','Demo envío poblado','3032020202','12000.00','PENDIENTE','2026-08-11 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (71,73,'Calle 15 #40-20','Villavicencio','Barzal','Meta','500001','Demo envío poblado','3043030303','0.00','POR_EMPAQUETAR','2026-08-10 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (72,74,'Cra 7 #26-10','Neiva','Centro','Huila','410001','Demo envío poblado','3054040404','12000.00','EMPACADO','2026-08-09 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (73,75,'Cra 5 #22-30','Santa Marta','El Rodadero','Magdalena','470001','Demo envío poblado','3065050505','0.00','EN_CAMINO','2026-08-08 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (74,76,'Av Bolívar #15-20','Armenia','Centro','Quindío','630001','Demo envío poblado','3076060606','0.00','ENTREGADO','2026-08-07 00:00:00','2026-08-10 19:23:00');
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (75,77,'Calle 45 #12-34','Bogotá','Chapinero','Cundinamarca','110111','Demo envío poblado','3101110011','0.00','CANCELADO','2026-09-01 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (76,78,'Cra 70 #30-10','Medellín','Laureles','Antioquia','050031','Demo envío poblado','3112220022','0.00','CANCELADO','2026-08-14 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (77,79,'Av 6N #25-45','Cali','Granada','Valle del Cauca','760001','Demo envío poblado','3203330033','0.00','CANCELADO','2026-08-31 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (78,80,'Calle 72 #50-60','Barranquilla','El Prado','Atlántico','080001','Demo envío poblado','3154440044','0.00','CANCELADO','2026-08-04 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (79,81,'Cra 27 #45-12','Bucaramanga','Cabecera','Santander','680001','Demo envío poblado','3125550055','0.00','CANCELADO','2026-08-22 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (80,82,'Bocagrande Cra 2 #8-20','Cartagena','Bocagrande','Bolívar','130001','Demo envío poblado','3186660066','12000.00','PENDIENTE','2026-08-19 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (81,83,'Av Circunvalar #12-30','Pereira','Pinares','Risaralda','660001','Demo envío poblado','3177770077','12000.00','PENDIENTE','2026-09-01 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (82,84,'Calle 50 #23-40','Manizales','Palanque','Caldas','170001','Demo envío poblado','3008880088','0.00','PENDIENTE','2026-08-16 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (83,85,'Av 0 #12-45','Cúcuta','Centro','Norte de Santander','540001','Demo envío poblado','3019990099','0.00','EN_CAMINO','2026-08-13 00:00:00',NULL);
INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA) VALUES (84,86,'Cra 26 #18-20','Pasto','Las Cuadras','Nariño','520001','Demo envío poblado','3021010101','12000.00','EN_CAMINO','2026-09-02 00:00:00',NULL);

-- MOVIMIENTOS_STOCK recent (133)
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (3,15,'SALIDA',1,'2026-08-17 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (5,2,'SALIDA',2,'2026-08-17 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (6,1,'ENTRADA',1,'2026-08-24 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (7,50,'SALIDA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (8,1,'ENTRADA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (9,1,'SALIDA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (10,3,'SALIDA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (11,1,'ENTRADA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (12,3,'ENTRADA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (13,3,'SALIDA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (14,3,'ENTRADA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (15,3,'SALIDA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (16,3,'ENTRADA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (17,3,'SALIDA',3,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (18,3,'ENTRADA',3,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (19,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (20,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (21,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (22,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (23,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (24,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (25,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (26,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (27,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (28,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (29,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (30,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (31,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (32,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (33,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (34,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (35,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (36,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (37,3,'SALIDA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (38,3,'ENTRADA',4,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (39,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (40,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (41,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (42,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (43,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (44,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (45,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (46,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (47,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (48,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (49,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (50,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (51,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (52,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (53,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (54,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (55,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (56,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (57,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (58,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (59,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (60,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (61,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (62,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (63,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (64,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (65,3,'SALIDA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (66,3,'ENTRADA',4,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (67,1,'SALIDA',1,'2026-09-01 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (68,2,'SALIDA',1,'2026-09-01 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (69,6,'SALIDA',2,'2026-09-01 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (70,6,'SALIDA',2,'2026-08-31 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (71,7,'SALIDA',1,'2026-08-31 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (72,10,'SALIDA',2,'2026-08-31 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (73,4,'SALIDA',1,'2026-08-30 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (74,10,'SALIDA',1,'2026-08-29 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (75,12,'SALIDA',1,'2026-08-29 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (76,12,'SALIDA',1,'2026-08-28 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (77,23,'SALIDA',2,'2026-08-28 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (78,24,'SALIDA',2,'2026-08-27 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (79,23,'SALIDA',2,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (80,33,'SALIDA',1,'2026-08-26 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (81,33,'SALIDA',1,'2026-08-25 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (82,55,'SALIDA',1,'2026-08-25 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (83,84,'SALIDA',2,'2026-08-25 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (84,6,'SALIDA',2,'2026-08-24 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (85,84,'SALIDA',1,'2026-08-23 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (86,7,'SALIDA',1,'2026-08-23 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (87,98,'SALIDA',2,'2026-08-23 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (88,101,'SALIDA',1,'2026-08-23 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (89,45,'SALIDA',1,'2026-08-23 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (90,17,'SALIDA',2,'2026-08-22 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (91,45,'SALIDA',1,'2026-08-21 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (92,46,'SALIDA',2,'2026-08-21 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (93,46,'SALIDA',1,'2026-08-20 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (94,61,'SALIDA',1,'2026-08-20 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (95,65,'SALIDA',2,'2026-08-20 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (96,61,'SALIDA',2,'2026-08-19 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (97,65,'SALIDA',2,'2026-08-18 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (98,80,'SALIDA',2,'2026-08-18 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (99,80,'SALIDA',2,'2026-08-17 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (100,1,'SALIDA',2,'2026-08-17 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (101,2,'SALIDA',1,'2026-08-17 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (102,10,'SALIDA',1,'2026-08-16 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (103,2,'SALIDA',1,'2026-08-15 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (104,6,'SALIDA',2,'2026-08-15 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (105,6,'SALIDA',1,'2026-08-14 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (106,12,'SALIDA',1,'2026-08-14 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (107,13,'SALIDA',2,'2026-08-14 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (108,10,'SALIDA',2,'2026-08-13 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (109,12,'SALIDA',2,'2026-08-13 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (110,12,'SALIDA',2,'2026-08-12 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (111,15,'SALIDA',1,'2026-08-12 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (112,23,'SALIDA',1,'2026-08-12 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (113,16,'SALIDA',1,'2026-08-11 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (114,23,'SALIDA',2,'2026-08-10 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (115,50,'SALIDA',1,'2026-08-10 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (116,33,'SALIDA',1,'2026-08-09 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (117,55,'SALIDA',2,'2026-08-09 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (118,84,'SALIDA',1,'2026-08-09 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (119,25,'SALIDA',2,'2026-08-08 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (120,84,'SALIDA',1,'2026-08-07 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (121,98,'SALIDA',2,'2026-08-07 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (122,98,'SALIDA',1,'2026-08-06 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (123,101,'SALIDA',2,'2026-08-06 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (124,45,'SALIDA',1,'2026-08-06 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (125,80,'SALIDA',1,'2026-08-18 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (126,23,'SALIDA',2,'2026-08-18 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (127,24,'SALIDA',2,'2026-08-31 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (128,2,'SALIDA',2,'2026-08-15 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (129,6,'SALIDA',2,'2026-08-15 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (130,6,'SALIDA',1,'2026-08-12 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (131,7,'SALIDA',1,'2026-08-12 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (132,10,'SALIDA',1,'2026-08-12 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (133,6,'SALIDA',2,'2026-09-01 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (134,6,'ENTRADA',1,'2026-09-01 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (135,45,'ENTRADA',1,'2026-09-01 00:00:00');
INSERT IGNORE INTO MOVIMIENTOS_STOCK (ID_MOVIMIENTO,ID_PRODUCTO,TIPO_MOVIMIENTO,CANTIDAD,FECHA) VALUES (136,16,'ENTRADA',1,'2026-09-01 00:00:00');

-- DEVOLUCIONES demo (10)
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (24,28,50,4,1,'Producto defectuoso','Descripción demo: Producto defectuoso en la compra DEMO-REF-1003. Cliente solicita reembolso.','REEMBOLSO',NULL,'SOLICITADA','2026-08-31 00:36:13',NULL);
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (25,29,51,10,1,'Talla equivocada','Descripción demo: Talla equivocada en la compra DEMO-REF-1004. Cliente solicita devolucion.','DEVOLUCION',NULL,'SOLICITADA','2026-08-30 00:36:13',NULL);
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (26,33,55,33,1,'No era lo esperado','Descripción demo: No era lo esperado en la compra DEMO-REF-1008. Cliente solicita devolucion.','DEVOLUCION',NULL,'SOLICITADA','2026-08-26 00:36:13',NULL);
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (27,34,56,6,1,'Llegó golpeado','Descripción demo: Llegó golpeado en la compra DEMO-REF-1009. Cliente solicita reembolso.','REEMBOLSO',NULL,'APROBADA','2026-08-26 00:39:01','2026-08-27 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (28,38,60,45,1,'Color diferente al pedido','Descripción demo: Color diferente al pedido en la compra DEMO-REF-1013. Cliente solicita devolucion.','DEVOLUCION',NULL,'APROBADA','2026-08-23 00:39:01','2026-08-24 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (29,39,61,46,1,'Problema de calidad','Descripción demo: Problema de calidad en la compra DEMO-REF-1014. Cliente solicita devolucion.','DEVOLUCION',NULL,'RECHAZADA','2026-08-22 00:39:01','2026-08-23 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (30,28,65,10,1,'Solicitud de reembolso','Descripción demo: Solicitud de reembolso en la compra DEMO-REF-1018. Cliente solicita reembolso.','REEMBOLSO',NULL,'MAS_PRUEBAS','2026-08-18 00:39:01',NULL);
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (31,29,66,2,1,'Cambio por otra talla','Descripción demo: Cambio por otra talla en la compra DEMO-REF-1019. Cliente solicita devolucion.','DEVOLUCION',NULL,'ESCALADA','2026-08-17 00:39:01',NULL);
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (32,33,70,12,1,'Devolución por insatisfacción','Descripción demo: Devolución por insatisfacción en la compra DEMO-REF-1023. Cliente solicita devolucion.','DEVOLUCION',NULL,'SOLICITADA','2026-08-14 00:39:01',NULL);
INSERT IGNORE INTO DEVOLUCIONES (ID_DEVOLUCION,ID_USUARIO,ID_VENTA,ID_PRODUCTO,CANTIDAD,MOTIVO,DESCRIPCION,TIPO,OBSERVACION,ESTADO,FECHA_CREACION,FECHA_PROCESADA) VALUES (33,34,71,16,1,'Falla de fabricación','Descripción demo: Falla de fabricación en la compra DEMO-REF-1024. Cliente solicita reembolso.','REEMBOLSO',NULL,'APROBADA','2026-08-13 00:39:01','2026-08-14 00:39:01');

-- DEVOLUCIONES_EVIDENCIAS demo (15)
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (5,24,'imagen','/images/devoluciones/demo_24_1.jpg','2026-09-01 00:36:13');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (6,24,'imagen','/images/devoluciones/demo_24_2.jpg','2026-09-01 00:36:13');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (7,25,'imagen','/images/devoluciones/demo_25_1.jpg','2026-09-01 00:36:13');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (8,26,'imagen','/images/devoluciones/demo_26_1.jpg','2026-09-01 00:36:13');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (9,26,'imagen','/images/devoluciones/demo_26_2.jpg','2026-09-01 00:36:13');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (10,27,'imagen','/images/devoluciones/demo_27_1.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (11,28,'imagen','/images/devoluciones/demo_28_1.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (12,28,'imagen','/images/devoluciones/demo_28_2.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (13,29,'imagen','/images/devoluciones/demo_29_1.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (14,30,'imagen','/images/devoluciones/demo_30_1.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (15,30,'imagen','/images/devoluciones/demo_30_2.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (16,31,'imagen','/images/devoluciones/demo_31_1.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (17,32,'imagen','/images/devoluciones/demo_32_1.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (18,32,'imagen','/images/devoluciones/demo_32_2.jpg','2026-09-01 00:39:01');
INSERT IGNORE INTO DEVOLUCIONES_EVIDENCIAS (ID_EVIDENCIA,ID_DEVOLUCION,TIPO,RUTA,FECHA) VALUES (19,33,'imagen','/images/devoluciones/demo_33_1.jpg','2026-09-01 00:39:01');

-- RETOS_USUARIOS demo (22)
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (13,1,25,1,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (14,2,26,2,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (15,3,26,3,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (16,3,27,3,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (17,4,28,5,1,'RETO-DEMO-28-4');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (18,5,28,7,1,'RETO-DEMO-28-5');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (19,5,29,7,1,'RETO-DEMO-29-5');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (20,6,30,10,1,'RETO-DEMO-30-6');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (21,7,30,1,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (22,7,31,1,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (23,8,32,2,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (24,9,32,3,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (25,9,33,3,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (26,10,34,5,1,'RETO-DEMO-34-10');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (27,11,34,7,1,'RETO-DEMO-34-11');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (28,1,35,7,1,'RETO-DEMO-35-1');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (29,2,36,10,1,'RETO-DEMO-36-2');
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (30,3,36,1,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (31,3,37,1,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (32,4,38,2,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (33,5,38,3,0,NULL);
INSERT IGNORE INTO RETOS_USUARIOS (ID_RETO_USUARIO,ID_RETO,ID_USUARIO,PROGRESO,COMPLETADO,CUPON_GENERADO) VALUES (34,5,39,3,0,NULL);

-- RETO_EVIDENCIAS demo (11)
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (20,13,25,'imagen','/images/retos/demo_13.jpg',NULL,1,'pendiente',NULL,'2026-09-01 00:39:01');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (21,17,28,'imagen','/images/retos/demo_17.jpg',NULL,1,'pendiente',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (22,18,28,'imagen','/images/retos/demo_18_aprob.jpg',NULL,1,'aprobado',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (23,19,29,'imagen','/images/retos/demo_19_aprob.jpg',NULL,1,'aprobado',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (24,21,30,'imagen','/images/retos/demo_21.jpg',NULL,1,'pendiente',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (25,22,31,'imagen','/images/retos/demo_22.jpg',NULL,1,'pendiente',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (26,24,32,'imagen','/images/retos/demo_24_aprob.jpg',NULL,1,'aprobado',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (27,25,33,'imagen','/images/retos/demo_25_aprob.jpg',NULL,1,'aprobado',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (28,26,34,'imagen','/images/retos/demo_26.jpg',NULL,1,'pendiente',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (29,30,36,'imagen','/images/retos/demo_30.jpg',NULL,1,'pendiente',NULL,'2026-09-01 00:39:02');
INSERT IGNORE INTO RETO_EVIDENCIAS (ID_EVIDENCIA,ID_RETO_USUARIO,ID_USUARIO,TIPO,RUTA,RUTAS_EXTRA,CANTIDAD,ESTADO,OBSERVACION,FECHA_SUBIDA) VALUES (30,31,37,'imagen','/images/retos/demo_31.jpg',NULL,1,'pendiente',NULL,'2026-09-01 00:39:02');

-- RESENAS demo (12)
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (1,1,25,3,'Excelente producto, llegó rápido y tal cual la foto.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (2,2,26,4,'Muy buena calidad, lo recomiendo 100%.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (3,3,27,5,'Cumple con lo esperado, cómodo y resistente.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (4,5,28,3,'Buena relación calidad-precio, volvería a comprar.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (9,23,33,5,'Excelente producto, llegó rápido y tal cual la foto.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (10,24,34,3,'Muy buena calidad, lo recomiendo 100%.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (11,30,35,4,'Cumple con lo esperado, cómodo y resistente.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (12,33,36,5,'Buena relación calidad-precio, volvería a comprar.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (17,84,26,4,'Excelente producto, llegó rápido y tal cual la foto.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (18,98,27,5,'Muy buena calidad, lo recomiendo 100%.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (19,1,28,3,'Cumple con lo esperado, cómodo y resistente.','2026-09-01 00:39:02');
INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA) VALUES (20,2,29,4,'Buena relación calidad-precio, volvería a comprar.','2026-09-01 00:39:02');

-- NOTIFICACIONES demo (11)
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (137,20,'chat','💬 Nuevo mensaje','Que **** demora, esta ****** del envio y ese ****** del mensajero, pero la reputacion de la tienda es buena','/chats?chat=1',0,'2026-08-26 02:07:30');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (254,NULL,'pedido','¡Gracias por tu compra!','Tu compra demo ha sido registrada correctamente.','/perfil/compras',0,'2026-08-24 00:39:02');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (255,26,'pedido','Tu pedido está en camino','Tu pedido demo salió de bodega y está en tránsito.','/perfil/compras',1,'2026-08-31 00:39:02');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (256,27,'pedido','Pedido entregado con éxito','Tu pedido demo fue entregado. ¡Disfrútalo!','/perfil/compras',0,'2026-08-27 00:39:02');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (264,35,'pedido','¡Gracias por tu compra!','Tu compra demo ha sido registrada correctamente.','/perfil/compras',0,'2026-09-01 00:39:02');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (265,36,'pedido','Tu pedido está en camino','Tu pedido demo salió de bodega y está en tránsito.','/perfil/compras',1,'2026-08-26 00:39:02');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (266,NULL,'pedido','Pedido entregado con éxito','Tu pedido demo fue entregado. ¡Disfrútalo!','/perfil/compras',0,'2026-08-24 00:39:02');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (269,NULL,'pedido','¡Gracias por tu compra!','Tu compra demo ha sido registrada correctamente.','/perfil/compras',0,'2026-08-31 00:39:05');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (273,NULL,'pedido','Pedido entregado con éxito','Tu pedido demo fue entregado. ¡Disfrútalo!','/perfil/compras',0,'2026-08-27 00:39:05');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (274,NULL,'pedido','¡Gracias por tu compra!','Tu compra demo ha sido registrada correctamente.','/perfil/compras',0,'2026-08-27 00:41:27');
INSERT IGNORE INTO NOTIFICACIONES (ID_NOTIFICACION,ID_USUARIO,TIPO,TITULO,MENSAJE,RUTA,LEIDA,FECHA) VALUES (278,NULL,'pedido','Pedido entregado con éxito','Tu pedido demo fue entregado. ¡Disfrútalo!','/perfil/compras',0,'2026-08-31 00:41:28');

-- CHAT demo (8)
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (13,'VENDEDOR',25,5,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (14,'VENDEDOR',26,6,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (15,'VENDEDOR',27,7,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (16,'VENDEDOR',28,8,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (17,'VENDEDOR',29,9,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (18,'SOPORTE',30,NULL,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (19,'SOPORTE',31,NULL,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT (ID_CHAT,TIPO,ID_CLIENTE,ID_VENDEDOR,ID_DEVOLUCION,PARTE,ESTADO,FECHA_CREACION,ULTIMA_ACTIVIDAD) VALUES (20,'SOPORTE',32,NULL,NULL,NULL,'ACTIVA','2026-09-01 00:39:02','2026-09-01 00:39:02');

-- CHAT_MENSAJE demo (16)
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (42,13,25,'CLIENTE','Hola, estoy interesado en tus productos Sport Andina Pro SAS. ¿Tienes stock?',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (43,13,40,'VENDEDOR','¡Hola! Sí, tenemos disponibilidad. Escríbeme y te asesoro.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (44,14,26,'CLIENTE','Hola, estoy interesado en tus productos FitZone Colombia Ltda. ¿Tienes stock?',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (45,14,41,'VENDEDOR','¡Hola! Sí, tenemos disponibilidad. Escríbeme y te asesoro.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (46,15,27,'CLIENTE','Hola, estoy interesado en tus productos Acuática Pro SAS. ¿Tienes stock?',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (47,15,42,'VENDEDOR','¡Hola! Sí, tenemos disponibilidad. Escríbeme y te asesoro.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (48,16,28,'CLIENTE','Hola, estoy interesado en tus productos Extremo Total SAS. ¿Tienes stock?',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (49,16,43,'VENDEDOR','¡Hola! Sí, tenemos disponibilidad. Escríbeme y te asesoro.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (50,17,29,'CLIENTE','Hola, estoy interesado en tus productos UrbanStyle Deportivo. ¿Tienes stock?',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (51,17,44,'VENDEDOR','¡Hola! Sí, tenemos disponibilidad. Escríbeme y te asesoro.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (52,18,30,'CLIENTE','Hola equipo JADDA, tengo una duda sobre mi pedido demo.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (53,18,NULL,'ADMIN','¡Hola! Claro, cuéntanos y te ayudamos.',0,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (54,19,31,'CLIENTE','Hola equipo JADDA, tengo una duda sobre mi pedido demo.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (55,19,NULL,'ADMIN','¡Hola! Claro, cuéntanos y te ayudamos.',0,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (56,20,32,'CLIENTE','Hola equipo JADDA, tengo una duda sobre mi pedido demo.',1,'2026-09-01 00:39:02');
INSERT IGNORE INTO CHAT_MENSAJE (ID_MENSAJE,ID_CHAT,ID_AUTOR,ROL_AUTOR,MENSAJE,LEIDO,FECHA) VALUES (57,20,NULL,'ADMIN','¡Hola! Claro, cuéntanos y te ayudamos.',0,'2026-09-01 00:39:02');

-- AVISOS_STOCK demo (5)
INSERT IGNORE INTO AVISOS_STOCK (ID_AVISO,ID_VARIANTE,ID_USUARIO,FECHA_CREACION,ENVIADO) VALUES (1,1,25,'2026-09-01 00:39:02',0);
INSERT IGNORE INTO AVISOS_STOCK (ID_AVISO,ID_VARIANTE,ID_USUARIO,FECHA_CREACION,ENVIADO) VALUES (2,22,26,'2026-09-01 00:39:02',0);
INSERT IGNORE INTO AVISOS_STOCK (ID_AVISO,ID_VARIANTE,ID_USUARIO,FECHA_CREACION,ENVIADO) VALUES (3,26,27,'2026-09-01 00:39:02',0);
INSERT IGNORE INTO AVISOS_STOCK (ID_AVISO,ID_VARIANTE,ID_USUARIO,FECHA_CREACION,ENVIADO) VALUES (4,40,28,'2026-09-01 00:39:02',0);
INSERT IGNORE INTO AVISOS_STOCK (ID_AVISO,ID_VARIANTE,ID_USUARIO,FECHA_CREACION,ENVIADO) VALUES (5,54,29,'2026-09-01 00:39:02',0);

-- PLANES_USUARIO demo (6)
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (45,25,47,4,'2026-08-28 00:00:00',0);
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (46,26,48,2,'2026-09-01 00:00:00',1);
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (47,27,49,1,'2026-08-24 00:00:00',0);
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (48,28,50,3,'2026-08-29 00:00:00',1);
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (49,29,51,6,'2026-08-29 00:00:00',0);
INSERT IGNORE INTO PLANES_USUARIO (ID_PLAN,ID_USUARIO,ID_VENTA,ID_PLANTILLA,FECHA_INICIO,COMPLETADO) VALUES (50,30,52,4,'2026-08-31 00:00:00',1);

-- PQR demo (3)
INSERT IGNORE INTO PQR (ID_PQR,ID_USUARIO,TIPO,ASUNTO,DESCRIPCION,NUMERO_PEDIDO,FECHA,ESTADO) VALUES (1,25,'Consulta','Demo PQR 1','Descripción demo de PQR 1 del cliente camilo.torres@gmail.com',NULL,'2026-09-01 00:39:02','PENDIENTE');
INSERT IGNORE INTO PQR (ID_PQR,ID_USUARIO,TIPO,ASUNTO,DESCRIPCION,NUMERO_PEDIDO,FECHA,ESTADO) VALUES (2,26,'Reclamo','Demo PQR 2','Descripción demo de PQR 2 del cliente valentina.ruiz@gmail.com',NULL,'2026-09-01 00:39:02','PENDIENTE');
INSERT IGNORE INTO PQR (ID_PQR,ID_USUARIO,TIPO,ASUNTO,DESCRIPCION,NUMERO_PEDIDO,FECHA,ESTADO) VALUES (3,27,'Sugerencia','Demo PQR 3','Descripción demo de PQR 3 del cliente santiago.herrera@gmail.com',NULL,'2026-09-01 00:39:02','PENDIENTE');

-- DESCUENTOS demo (11)
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (9,'RETO-DEMO-28-4','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (10,'RETO-DEMO-28-5','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (11,'RETO-DEMO-29-5','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (12,'RETO-DEMO-30-6','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (13,'RETO-DEMO-34-10','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (14,'RETO-DEMO-34-11','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (15,'RETO-DEMO-35-1','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (16,'RETO-DEMO-36-2','5.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'100000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (50,'DEMO10','10.00','2026-09-01 00:00:00','2026-10-31 00:00:00',0,'150000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (51,'DEMO15','15.00','2026-09-01 00:00:00','2026-10-01 00:00:00',0,'200000');
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO,DESCRIPCION,PORCENTAJE,FECHA_INICIO,FECHA_FIN,USADO,MONTO_MINIMO) VALUES (52,'BIENVENIDO','5.00','2026-09-01 00:00:00','2026-11-30 00:00:00',0,NULL);

-- VARIANTES stock bajo demo (10)
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=1;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=2;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=3;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=4;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=5;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=6;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=7;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=8;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=9;
UPDATE PRODUCTO_VARIANTES SET STOCK=1 WHERE ID_VARIANTE=10;

`;



/*
 * setupDatabase  — Función principal de inicialización.
 *
 * Lógica:
 *   1. Conecta a MySQL sin especificar BD (para poder crearla).
 *   2. Crea la base de datos si no existe (CREATE DATABASE IF NOT EXISTS).
 *   3. Selecciona la BD y ejecuta CREATE_TABLES_RAW (32 tablas).
 *      Las migraciones idempotentes (MIGRACIONES) pueden crear más tablas
 *      sobre bases existentes (DEVOLUCIONES  — 33 en total; RETO_EVIDENCIAS,
 *      NOTIFICACIONES y AVISOS_STOCK ya viven en CREATE_TABLES_RAW).
 *   4. Ejecuta SEED_DATA con INSERT IGNORE (no duplica si ya existen).
 *
 * Reintentos: hasta 10 intentos con 3s de espera.
 *   Esto resuelve la race condition de Docker donde MySQL aún no acepta
 *   conexiones cuando el backend ya está corriendo.
 *
 * Seguridad: usa una conexión temporal (sin pool) que se cierra al finalizar.
 *   No interfiere con el pool de db.js.
 */
/**
 * seedAdminUser: crea/asegura la cuenta de administrador.
 * Se ejecuta en CADA arranque (incluso si las tablas ya existían),
 * porque sin admin no se puede usar el panel de administración.
 * Credenciales configurables con ADMIN_EMAIL / ADMIN_PASSWORD en .env.
 * Defaults: yeison / Losquiero7
 */
async function seedAdminUser(connection) {
  const email = process.env.ADMIN_EMAIL || 'yeison';
  const password = process.env.ADMIN_PASSWORD || 'Losquiero7';
  const hashed = await bcrypt.hash(password, 10);

  // 1. Si ya existe el admin con ese correo  — refresca contraseña y rol
  const [target] = await connection.query('SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = ?', [email]);
  if (target.length > 0) {
    await connection.query(
      'UPDATE USUARIOS SET CONTRASENA = ?, ID_ROL = 1, CONFIRMADO = 1 WHERE ID_USUARIO = ?',
      [hashed, target[0].ID_USUARIO]
    );
    console.log(` — Setup: Admin (${email}) asegurado con la contraseña del .env`);
    return;
  }

  // 2. Si existe otro admin con otro correo  — lo renombra al correo objetivo
  const [adminViejo] = await connection.query(
    'SELECT ID_USUARIO FROM USUARIOS WHERE ID_ROL = 1 ORDER BY ID_USUARIO ASC LIMIT 1'
  );
  if (adminViejo.length > 0) {
    await connection.query(
      'UPDATE USUARIOS SET EMAIL = ?, CONTRASENA = ?, CONFIRMADO = 1 WHERE ID_USUARIO = ?',
      [email, hashed, adminViejo[0].ID_USUARIO]
    );
    console.log(` — Setup: Admin existente actualizado  — ${email}`);
    return;
  }

  // 3. No hay ningún admin  — crea uno nuevo
  const usuarioLogin = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '_') + '_admin';
  await connection.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, CONFIRMADO, AUTH_PROVIDER)
     VALUES ('Administrador', 'Jadda', ?, ?, ?, CURDATE(), 1, 1, 'local')`,
    [email, usuarioLogin, hashed]
  );

  console.log(` — Setup: Usuario administrador creado (${email})`);
  console.log(`    — Contraseña: ${password}  — cámbiala tras el primer ingreso`);
}

/**
 * migrarTablasExistentes: aplica ALTER TABLE idempotentes sobre bases de
 * datos que ya existen (columnas agregadas en versiones posteriores del
 * esquema, p. ej. COSTO_ENVIO en ENVIOS para el cálculo de envío).
 * Se ejecuta en cada arranque cuando las tablas ya existen; verifica
 * INFORMATION_SCHEMA antes de cada ALTER, así que es seguro reiniciar.
 */
const MIGRACIONES = [
  {
    tabla: 'ENVIOS',
    columna: 'COSTO_ENVIO',
    alterSql:
      'ALTER TABLE ENVIOS ADD COLUMN COSTO_ENVIO DECIMAL(10,2) NOT NULL DEFAULT 0',
    mensaje: 'columna COSTO_ENVIO agregada a ENVIOS (cálculo de envío)',
  },
  {
    tabla: 'ENVIOS',
    columna: 'FECHA_ENTREGA',
    alterSql:
      'ALTER TABLE ENVIOS ADD COLUMN FECHA_ENTREGA DATETIME DEFAULT NULL',
    mensaje: 'columna FECHA_ENTREGA agregada a ENVIOS (plazo de devolución 3 días)',
  },
  {
    tabla: 'DESCUENTOS',
    columna: 'USADO',
    alterSql:
      'ALTER TABLE DESCUENTOS ADD COLUMN USADO TINYINT NOT NULL DEFAULT 0',
    mensaje: 'columna USADO agregada a DESCUENTOS (cupones de un solo uso)',
  },
  {
    tabla: 'RETO_EVIDENCIAS',
    columna: 'ID_EVIDENCIA',
    createSql: `CREATE TABLE IF NOT EXISTS RETO_EVIDENCIAS (
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
    )`,
    mensaje: 'tabla RETO_EVIDENCIAS creada (material de avances de retos)',
  },
  {
    tabla: 'RETO_EVIDENCIAS',
    columna: 'OBSERVACION',
    alterSql: 'ALTER TABLE RETO_EVIDENCIAS ADD COLUMN OBSERVACION VARCHAR(500) DEFAULT NULL',
    mensaje: 'columna OBSERVACION agregada a RETO_EVIDENCIAS (motivo opcional al aprobar/rechazar avances)',
  },
  {
    tabla: 'RETO_EVIDENCIAS',
    columna: 'RUTAS_EXTRA',
    alterSql: 'ALTER TABLE RETO_EVIDENCIAS ADD COLUMN RUTAS_EXTRA TEXT DEFAULT NULL',
    mensaje: 'columna RUTAS_EXTRA agregada a RETO_EVIDENCIAS (varios archivos por avance)',
  },
  {
    tabla: 'NOTIFICACIONES',
    columna: 'ID_NOTIFICACION',
    createSql: `CREATE TABLE IF NOT EXISTS NOTIFICACIONES (
      ID_NOTIFICACION INT PRIMARY KEY AUTO_INCREMENT,
      ID_USUARIO INT DEFAULT NULL,
      TIPO VARCHAR(30) NOT NULL,
      TITULO VARCHAR(200) NOT NULL,
      MENSAJE VARCHAR(500) DEFAULT NULL,
      RUTA VARCHAR(255) DEFAULT NULL,
      LEIDA TINYINT DEFAULT 0,
      FECHA DATETIME DEFAULT NOW(),
      FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
    )`,
    mensaje: 'tabla NOTIFICACIONES creada (campana de avisos)',
  },
  {
    tabla: 'AVISOS_STOCK',
    columna: 'ID_AVISO',
    createSql: `CREATE TABLE IF NOT EXISTS AVISOS_STOCK (
      ID_AVISO INT PRIMARY KEY AUTO_INCREMENT,
      ID_VARIANTE INT NOT NULL,
      ID_USUARIO INT NOT NULL,
      FECHA_CREACION DATETIME DEFAULT NOW(),
      ENVIADO TINYINT DEFAULT 0,
      UNIQUE KEY uq_aviso_variante_usuario (ID_VARIANTE, ID_USUARIO),
      FOREIGN KEY (ID_VARIANTE) REFERENCES PRODUCTO_VARIANTES(ID_VARIANTE) ON DELETE CASCADE,
      FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO) ON DELETE CASCADE
    )`,
    mensaje: 'tabla AVISOS_STOCK creada (alertas de reposición de stock)',
  },
  {
    tabla: 'DEVOLUCIONES',
    columna: 'ID_DEVOLUCION',
    createSql: `CREATE TABLE IF NOT EXISTS DEVOLUCIONES (
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
    )`,
    mensaje: 'tabla DEVOLUCIONES creada (solicitudes de devolución RF-033)',
  },
  {
    tabla: 'DEVOLUCIONES',
    columna: 'DESCRIPCION',
    alterSql: 'ALTER TABLE DEVOLUCIONES ADD COLUMN DESCRIPCION TEXT DEFAULT NULL',
    mensaje: 'columna DESCRIPCION agregada a DEVOLUCIONES (explicación del cliente)',
  },
  {
    tabla: 'DEVOLUCIONES',
    columna: 'TIPO',
    alterSql: "ALTER TABLE DEVOLUCIONES ADD COLUMN TIPO VARCHAR(20) NOT NULL DEFAULT 'DEVOLUCION'",
    mensaje: 'columna TIPO agregada a DEVOLUCIONES (DEVOLUCION | REEMBOLSO)',
  },
  {
    tabla: 'CHAT',
    columna: 'ID_CHAT',
    createSql: `CREATE TABLE IF NOT EXISTS CHAT (
      ID_CHAT INT PRIMARY KEY AUTO_INCREMENT,
      TIPO ENUM('SOPORTE','VENDEDOR','DEVOLUCION') NOT NULL,
      ID_CLIENTE INT DEFAULT NULL,
      ID_VENDEDOR INT DEFAULT NULL,
      ID_DEVOLUCION INT DEFAULT NULL,
      ESTADO VARCHAR(20) DEFAULT 'ACTIVA',
      FECHA_CREACION DATETIME DEFAULT NOW(),
      ULTIMA_ACTIVIDAD DATETIME DEFAULT NOW(),
      FOREIGN KEY (ID_CLIENTE) REFERENCES USUARIOS(ID_USUARIO),
      FOREIGN KEY (ID_VENDEDOR) REFERENCES VENDEDORES(ID_VENDEDOR)
    )`,
    mensaje: 'tabla CHAT creada (conversaciones usuario-vendedor-admin)',
  },
  {
    tabla: 'DESCUENTOS',
    columna: 'MONTO_MINIMO',
    alterSql: 'ALTER TABLE DESCUENTOS ADD COLUMN MONTO_MINIMO DECIMAL(12,0) DEFAULT NULL',
    mensaje: 'columna MONTO_MINIMO agregada a DESCUENTOS (compra mínima del cupón)',
  },
  {
    tabla: 'CHAT',
    columna: 'PARTE',
    alterSql: "ALTER TABLE CHAT ADD COLUMN PARTE VARCHAR(10) DEFAULT NULL",
    mensaje: 'columna PARTE agregada a CHAT (hilo de acuerdo vs hilos separados con JADDA)',
  },
  {
    tabla: 'CHAT_MENSAJE',
    columna: 'ID_MENSAJE',
    createSql: `CREATE TABLE IF NOT EXISTS CHAT_MENSAJE (
      ID_MENSAJE INT PRIMARY KEY AUTO_INCREMENT,
      ID_CHAT INT NOT NULL,
      ID_AUTOR INT DEFAULT NULL,
      ROL_AUTOR ENUM('CLIENTE','VENDEDOR','ADMIN','SISTEMA') NOT NULL,
      MENSAJE TEXT NOT NULL,
      LEIDO TINYINT DEFAULT 0,
      FECHA DATETIME DEFAULT NOW(),
      FOREIGN KEY (ID_CHAT) REFERENCES CHAT(ID_CHAT) ON DELETE CASCADE
    )`,
    mensaje: 'tabla CHAT_MENSAJE creada (mensajes del chat)',
  },
  {
    tabla: 'DEVOLUCIONES',
    columna: 'OBSERVACION',
    alterSql: 'ALTER TABLE DEVOLUCIONES ADD COLUMN OBSERVACION VARCHAR(500) DEFAULT NULL',
    mensaje: 'columna OBSERVACION agregada a DEVOLUCIONES (respuesta del admin)',
  },
  {
    tabla: 'DEVOLUCIONES_EVIDENCIAS',
    columna: 'ID_EVIDENCIA',
    createSql: `CREATE TABLE IF NOT EXISTS DEVOLUCIONES_EVIDENCIAS (
      ID_EVIDENCIA INT PRIMARY KEY AUTO_INCREMENT,
      ID_DEVOLUCION INT NOT NULL,
      TIPO VARCHAR(10) NOT NULL,
      RUTA VARCHAR(500) NOT NULL,
      FECHA DATETIME DEFAULT NOW(),
      FOREIGN KEY (ID_DEVOLUCION) REFERENCES DEVOLUCIONES(ID_DEVOLUCION) ON DELETE CASCADE
    )`,
    mensaje: 'tabla DEVOLUCIONES_EVIDENCIAS creada (fotos/videos de la solicitud)',
  },
  {
    tabla: 'USUARIOS',
    columna: 'EMAIL_PENDIENTE',
    alterSql:
      'ALTER TABLE USUARIOS ADD COLUMN EMAIL_PENDIENTE VARCHAR(100) DEFAULT NULL',
    mensaje: 'columna EMAIL_PENDIENTE agregada a USUARIOS (cambio seguro de correo)',
  },
  {
    tabla: 'USUARIOS',
    columna: 'ULTIMA_CONEXION',
    alterSql:
      'ALTER TABLE USUARIOS ADD COLUMN ULTIMA_CONEXION DATETIME DEFAULT NULL, ADD COLUMN ULTIMA_IP VARCHAR(45) DEFAULT NULL, ADD COLUMN ULTIMA_UBICACION VARCHAR(100) DEFAULT NULL',
    mensaje: 'columnas ULTIMA_CONEXION/ULTIMA_IP/ULTIMA_UBICACION agregadas a USUARIOS (última conexión)',
  },
  {
    tabla: 'DETALLE_VENTAS',
    columna: 'ID_VARIANTE',
    alterSql:
      'ALTER TABLE DETALLE_VENTAS ADD COLUMN ID_VARIANTE INT NULL, ADD CONSTRAINT fk_detalle_variante FOREIGN KEY (ID_VARIANTE) REFERENCES PRODUCTO_VARIANTES(ID_VARIANTE) ON DELETE SET NULL',
    mensaje: 'columna ID_VARIANTE agregada a DETALLE_VENTAS (variante comprada en mis pedidos)',
  },
  {
    tabla: 'USUARIOS',
    columna: 'DEBE_CAMBIAR_PASSWORD',
    alterSql:
      'ALTER TABLE USUARIOS ADD COLUMN DEBE_CAMBIAR_PASSWORD TINYINT DEFAULT 0',
    mensaje: 'columna DEBE_CAMBIAR_PASSWORD agregada a USUARIOS (contraseña temporal de vendedor)',
  },
  {
    tabla: 'SOLICITUDES_VENDEDOR',
    columna: 'ID_SOLICITUD',
    createSql: `CREATE TABLE IF NOT EXISTS SOLICITUDES_VENDEDOR (
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
    )`,
    mensaje: 'tabla SOLICITUDES_VENDEDOR creada (formulario ser vendedor)',
  },
  {
    tabla: 'VENDEDORES',
    columna: 'ID_VENDEDOR',
    createSql: `CREATE TABLE IF NOT EXISTS VENDEDORES (
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
    )`,
    mensaje: 'tabla VENDEDORES creada (cuentas de vendedores aprobados)',
  },
  {
    tabla: 'PRODUCTOS',
    columna: 'ID_VENDEDOR',
    alterSql:
      'ALTER TABLE PRODUCTOS ADD COLUMN ID_VENDEDOR INT NULL, ADD KEY idx_productos_vendedor (ID_VENDEDOR)',
    mensaje: 'columna ID_VENDEDOR agregada a PRODUCTOS (artículos publicados por vendedores)',
  },
  {
    tabla: 'PRODUCTOS',
    columna: 'ESTADO_PUBLICACION',
    alterSql:
      "ALTER TABLE PRODUCTOS ADD COLUMN ESTADO_PUBLICACION VARCHAR(10) DEFAULT NULL COMMENT 'NULL=Jadda, PENDIENTE/APROBADO/RECHAZADO para vendedores'",
    mensaje: 'columna ESTADO_PUBLICACION agregada a PRODUCTOS (aprobación de artículos de vendedores)',
  },
  {
    tabla: 'CHAT',
    columna: 'ID_PRODUCTO',
    alterSql:
      'ALTER TABLE CHAT ADD COLUMN ID_PRODUCTO INT NULL, ADD KEY idx_chat_producto (ID_PRODUCTO), ADD CONSTRAINT fk_chat_producto FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID) ON DELETE SET NULL',
    mensaje: 'columna ID_PRODUCTO agregada a CHAT (chat por producto: chat {producto} - {usuario})',
  },
];

const RETOS_ADICIONALES = `
INSERT IGNORE INTO RETOS (ID_RETO, TITULO, DESCRIPCION, META_TIPO, META_VALOR, RECOMPENSA_PORCENTAJE, FECHA_INICIO, FECHA_FIN) VALUES
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
`;

async function migrarTablasExistentes(connection) {
  for (const migracion of MIGRACIONES) {
    const [columnas] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [migracion.tabla, migracion.columna]
    );
    if (columnas.length === 0) {
      if (migracion.alterSql) {
        await connection.query(migracion.alterSql);
      } else if (migracion.createSql) {
        await connection.query(migracion.createSql);
      }
      console.log(` —️  Setup: Migración aplicada  — ${migracion.mensaje}`);
    }
  }
  await connection.query(RETOS_ADICIONALES);
  console.log(' —️  Setup: Retos adicionales asegurados (INSERT IGNORE).');

  // Rol Vendedor (ID 6) disponible en BD existentes (el seed solo corre en BD nuevas)
  await connection.query(
    "INSERT IGNORE INTO ROLES (ID_ROL, NOMBRE_ROL, DESCRIPCION) VALUES (6, 'Vendedor', 'Vende productos en la plataforma')"
  );
  console.log(' —️  Setup: Rol Vendedor (ID 6) asegurado.');

  // Vincula artículos a los vendedores aprobados según sus categorías (demo).
  // Idempotente: solo procesa vendedores que aún NO tienen ningún producto
  // (el vendedor puede publicar/despublicar después en su panel).
  const normTexto = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const [vendedoresSinProductos] = await connection.query(
    `SELECT v.ID_VENDEDOR, v.CATEGORIAS FROM VENDEDORES v
     WHERE NOT EXISTS (SELECT 1 FROM PRODUCTOS p WHERE p.ID_VENDEDOR = v.ID_VENDEDOR)`
  );
  if (vendedoresSinProductos.length > 0) {
    const [categorias] = await connection.query(
      'SELECT ID_CATEGORIA, NOMBRE_CATEGORIA FROM CATEGORIAS'
    );
    for (const ven of vendedoresSinProductos) {
      const seleccion = (ven.CATEGORIAS || '')
        .split(',')
        .map((c) => normTexto(c).trim())
        .filter(Boolean);
      const idsCategorias = categorias
        .filter((c) => seleccion.some((sel) => normTexto(c.NOMBRE_CATEGORIA).includes(sel)))
        .map((c) => c.ID_CATEGORIA);
      if (idsCategorias.length === 0) continue;
      const [productos] = await connection.query(
        `SELECT ID FROM PRODUCTOS WHERE ID_CATEGORIA IN (?) AND ID_VENDEDOR IS NULL ORDER BY ID LIMIT 8`,
        [idsCategorias]
      );
      for (const prod of productos) {
        await connection.query('UPDATE PRODUCTOS SET ID_VENDEDOR = ? WHERE ID = ?', [
          ven.ID_VENDEDOR,
          prod.ID,
        ]);
      }
      if (productos.length > 0) {
        console.log(
          ` —️  Setup: ${productos.length} artículos vinculados al vendedor #${ven.ID_VENDEDOR} (categorías: ${ven.CATEGORIAS})`
        );
      }
    }
  }

  // Índice único en CATEGORIAS.NOMBRE_CATEGORIA (RF-027): evita duplicados
  // por carrera de peticiones (check-then-insert sin UNIQUE). Idempotente:
  // consulta INFORMATION_SCHEMA.STATISTICS antes de crear el índice.
  const [stats] = await connection.query(
    `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CATEGORIAS' AND INDEX_NAME = 'uq_categoria_nombre'`
  );
  if (Number(stats[0].total) === 0) {
    try {
      await connection.query(
        'ALTER TABLE CATEGORIAS ADD CONSTRAINT uq_categoria_nombre UNIQUE (NOMBRE_CATEGORIA)'
      );
      console.log(" —️  Setup: Migración aplicada  — índice único uq_categoria_nombre en CATEGORIAS (RF-027)");
    } catch (err) {
      console.error(
        " —️  Setup: No se pudo crear el índice único en CATEGORIAS (¿existen duplicados?):",
        err.message
      );
    }
  }

  // Índice único en PRODUCTO_VARIANTES (evita duplicados exactos o en otro idioma con mismo stock duplicado)
  const [varStats] = await connection.query(
    `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PRODUCTO_VARIANTES' AND INDEX_NAME = 'uq_variante_producto'`
  );
  if (Number(varStats[0].total) === 0) {
    // Deduplicar variantes exactas duplicadas por re-ejecuciones previas (conserva MIN ID_VARIANTE)
    try {
      const [dupGroups] = await connection.query(
        `SELECT ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, MIN(ID_VARIANTE) as keep_id
         FROM PRODUCTO_VARIANTES GROUP BY ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO HAVING COUNT(*) > 1`
      );
      if (dupGroups.length > 0) {
        console.log(` —️  Setup: Deduplicando ${dupGroups.length} grupos de variantes duplicadas...`);
        for (const g of dupGroups) {
          // Actualiza referencias en DETALLE_VENTAS, CARRITO, AVISOS_STOCK al keep_id
          await connection.query(
            `UPDATE DETALLE_VENTAS SET ID_VARIANTE = ? WHERE ID_VARIANTE IN (
               SELECT ID_VARIANTE FROM (SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES 
               WHERE ID_PRODUCTO=? AND COLOR=? AND NOMBRE_ATRIBUTO=? AND ATRIBUTO=? AND ID_VARIANTE<>?) t)`,
            [g.keep_id, g.ID_PRODUCTO, g.COLOR, g.NOMBRE_ATRIBUTO, g.ATRIBUTO, g.keep_id]
          );
          await connection.query(
            `UPDATE CARRITO SET ID_VARIANTE = ? WHERE ID_VARIANTE IN (
               SELECT ID_VARIANTE FROM (SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES 
               WHERE ID_PRODUCTO=? AND COLOR=? AND NOMBRE_ATRIBUTO=? AND ATRIBUTO=? AND ID_VARIANTE<>?) t)`,
            [g.keep_id, g.ID_PRODUCTO, g.COLOR, g.NOMBRE_ATRIBUTO, g.ATRIBUTO, g.keep_id]
          );
          await connection.query(
            `UPDATE AVISOS_STOCK SET ID_VARIANTE = ? WHERE ID_VARIANTE IN (
               SELECT ID_VARIANTE FROM (SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES 
               WHERE ID_PRODUCTO=? AND COLOR=? AND NOMBRE_ATRIBUTO=? AND ATRIBUTO=? AND ID_VARIANTE<>?) t)`,
            [g.keep_id, g.ID_PRODUCTO, g.COLOR, g.NOMBRE_ATRIBUTO, g.ATRIBUTO, g.keep_id]
          );
          await connection.query(
            `DELETE FROM PRODUCTO_VARIANTES 
             WHERE ID_PRODUCTO=? AND COLOR=? AND NOMBRE_ATRIBUTO=? AND ATRIBUTO=? AND ID_VARIANTE<>?`,
            [g.ID_PRODUCTO, g.COLOR, g.NOMBRE_ATRIBUTO, g.ATRIBUTO, g.keep_id]
          );
        }
        console.log(` —️  Setup: Deduplicación completada (${dupGroups.length} grupos)`);
      }
    } catch (e) {
      console.warn(' —️  Setup: Deduplicación falló:', e.message);
    }
    try {
      await connection.query(
        'ALTER TABLE PRODUCTO_VARIANTES ADD UNIQUE KEY uq_variante_producto (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO)'
      );
      console.log(" —️  Setup: Migración aplicada  — índice único uq_variante_producto en PRODUCTO_VARIANTES (evita variantes duplicadas)");
    } catch (err) {
      console.error(
        " —️  Setup: No se pudo crear índice único en PRODUCTO_VARIANTES (¿existen duplicados?):",
        err.message
      );
    }
  }

  // Migración: URLs externas  — locales en PRODUCTO_IMAGENES + elimina producto 45 duplicado
  await migrarImagenesALocales(connection);

  // SOLICITUDES_VENDEDOR.ID_USUARIO nullable: el formulario "Ser vendedor" ya no exige
  // iniciar sesión (la solicitud se asocia al correo de la empresa; al aprobar se crea
  // el usuario vendedor). Idempotente: consulta IS_NULLABLE antes del MODIFY.
  const [solCol] = await connection.query(
    `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SOLICITUDES_VENDEDOR' AND COLUMN_NAME = 'ID_USUARIO'`
  );
  if (solCol.length > 0 && solCol[0].IS_NULLABLE === 'NO') {
    try {
      await connection.query(
        'ALTER TABLE SOLICITUDES_VENDEDOR MODIFY COLUMN ID_USUARIO INT NULL'
      );
      console.log(" —️  Setup: Migración aplicada  — ID_USUARIO nullable en SOLICITUDES_VENDEDOR (solicitud sin iniciar sesión)");
    } catch (err) {
      console.error(' —️  Setup: No se pudo hacer nullable ID_USUARIO en SOLICITUDES_VENDEDOR:', err.message);
    }
  }

  // Vendedor informal: NOMBRE_EMPRESA y NIT ya NO son obligatorios (cualquier persona
  // puede vender sin estar formalizada). Idempotente: consulta IS_NULLABLE antes del MODIFY.
  for (const [tabla, col] of [
    ['SOLICITUDES_VENDEDOR', 'NOMBRE_EMPRESA'],
    ['SOLICITUDES_VENDEDOR', 'NIT'],
    ['VENDEDORES', 'NOMBRE_EMPRESA'],
    ['VENDEDORES', 'NIT'],
  ]) {
    const [colInfo] = await connection.query(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tabla, col]
    );
    if (colInfo.length > 0 && colInfo[0].IS_NULLABLE === 'NO') {
      try {
        const tipo = col === 'NOMBRE_EMPRESA' ? 'VARCHAR(150)' : 'VARCHAR(20)';
        await connection.query(
          `ALTER TABLE ${tabla} MODIFY COLUMN ${col} ${tipo} DEFAULT NULL`
        );
        console.log(` —️  Setup: Migración aplicada  — ${col} nullable en ${tabla} (vendedor informal)`);
      } catch (err) {
        console.error(` —️  Setup: No se pudo hacer nullable ${col} en ${tabla}:`, err.message);
      }
    }
  }

  // RETO_EVIDENCIAS.RUTA / RUTAS_EXTRA nullable: el material ahora se conserva tras
  // aprobar/rechazar (el usuario puede volver a verlo), pero las tablas viejas se
  // crearon con RUTA NOT NULL. Idempotente: consulta IS_NULLABLE antes del MODIFY.
  for (const col of ['RUTA', 'RUTAS_EXTRA']) {
    const [evCol] = await connection.query(
      `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RETO_EVIDENCIAS' AND COLUMN_NAME = ?`,
      [col]
    );
    if (evCol.length > 0 && evCol[0].IS_NULLABLE === 'NO') {
      try {
        await connection.query(
          col === 'RUTA'
            ? 'ALTER TABLE RETO_EVIDENCIAS MODIFY COLUMN RUTA VARCHAR(255) DEFAULT NULL'
            : 'ALTER TABLE RETO_EVIDENCIAS MODIFY COLUMN RUTAS_EXTRA TEXT DEFAULT NULL'
        );
        console.log(` —️  Setup: Migración aplicada  — ${col} nullable en RETO_EVIDENCIAS`);
      } catch (err) {
        console.error(` —️  Setup: No se pudo hacer nullable ${col} en RETO_EVIDENCIAS:`, err.message);
      }
    }
  }
}

async function migrarImagenesALocales(connection) {
  // Solo si hay URLs externas (no empiezan por /images/)
  const [ext] = await connection.query(
    "SELECT COUNT(*) AS total FROM PRODUCTO_IMAGENES WHERE URL_IMAGEN NOT LIKE '/images/%'"
  );
  if (Number(ext[0].total) === 0) return;

  console.log(" —️  Setup: Migrando URLs de imágenes a rutas locales...");

  const fs = require('fs');
  const path = require('path');
  const uploadsDir = '/app/uploads';

  if (!fs.existsSync(uploadsDir)) {
    console.warn(" —️  Setup: /app/uploads no existe, omitiendo migración de imágenes");
    return;
  }

  const folders = fs.readdirSync(uploadsDir)
    .filter(f => f.startsWith('Producto_'))
    .sort((a, b) => parseInt(a.replace('Producto_','')) - parseInt(b.replace('Producto_','')));

  let actualizadas = 0;
  for (const folder of folders) {
    const productId = parseInt(folder.replace('Producto_',''));
    if (isNaN(productId)) continue;

    const folderPath = path.join(uploadsDir, folder);
    const files = fs.readdirSync(folderPath)
      .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/(?:img|imagen)_(\d+)/i)?.[1] || '99');
        const nb = parseInt(b.match(/(?:img|imagen)_(\d+)/i)?.[1] || '99');
        return na - nb;
      });

    for (let i = 0; i < files.length; i++) {
      const orden = i + 1;
      const localUrl = `/images/productos/${folder}/${files[i]}`;
      const [res] = await connection.query(
        'UPDATE PRODUCTO_IMAGENES SET URL_IMAGEN = ? WHERE ID_PRODUCTO = ? AND ORDEN = ?',
        [localUrl, productId, orden]
      );
      if (res.affectedRows > 0) actualizadas++;
    }
  }

  console.log(`>  Setup: Migracin imgenes completada ? ${actualizadas} URLs actualizadas`);
}

/**
 * CONTENIDOS_PRODUCTO: semilla inicial de descripciones profesionales +
 * características curadas (módulo backend/database/contenidos-producto.js).
 * La BD es la fuente de verdad: este módulo solo se aplica donde hace falta
 * (descripción vacía o aún la corta del seed; características que falten),
 * de modo que las ediciones realizadas desde el panel admin PERSISTEN.
 * Para re-sembrar TODO el catálogo manualmente, definir FORCE_CONTENIDOS=1
 * en el .env del backend (restaura el contenido del módulo).
 */
/**
 * Repara double-encoding latin1→utf8mb4 (MuÃ±equeras → Muñequeras) dejado por
 * inserciones vía cliente latin1 (Workbench/CLI sin --default-character-set=utf8mb4).
 * Es idempotente: solo toca filas con HEX LIKE '%C383C2%'.
 * Se ejecuta en cada arranque, sin necesidad de script externo.
 */
async function repararEncodingDoble(connection) {
  try {
    const [cProd] = await connection.query(
      `SELECT COUNT(*) AS t FROM PRODUCTOS WHERE HEX(NOMBRE) LIKE '%C383%' OR HEX(DESCRIPCION) LIKE '%C383%'`
    );
    const [cVar] = await connection.query(
      `SELECT COUNT(*) AS t FROM PRODUCTO_VARIANTES WHERE HEX(COLOR) LIKE '%C383%' OR HEX(NOMBRE_ATRIBUTO) LIKE '%C383%' OR HEX(ATRIBUTO) LIKE '%C383%' OR HEX(COLOR) LIKE '%EFBFBD%' OR HEX(NOMBRE_ATRIBUTO) LIKE '%EFBFBD%' OR HEX(ATRIBUTO) LIKE '%EFBFBD%'`
    );
    const totalProd = Number(cProd[0]?.t || 0);
    const totalVar = Number(cVar[0]?.t || 0);
    if (totalProd === 0 && totalVar === 0) {
      // Aún así revisar duplicados huérfanos (ej Botella 750ml con Única duplicada)
    } else {
      if (totalProd > 0) console.log(`⚠️  Setup: Detectado double-encoding en ${totalProd} producto(s), reparando...`);
      if (totalVar > 0) console.log(`⚠️  Setup: Detectado double-encoding en ${totalVar} variante(s), reparando...`);
    }
    // PRODUCTOS
    if (totalProd > 0) {
      await connection.query(
        `UPDATE PRODUCTOS SET NOMBRE = CONVERT(CAST(CONVERT(NOMBRE USING latin1) AS BINARY) USING utf8mb4) WHERE HEX(NOMBRE) LIKE '%C383%'`
      );
      await connection.query(
        `UPDATE PRODUCTOS SET DESCRIPCION = CONVERT(CAST(CONVERT(DESCRIPCION USING latin1) AS BINARY) USING utf8mb4) WHERE HEX(DESCRIPCION) LIKE '%C383%'`
      );
      await connection.query(
        `UPDATE CATEGORIAS SET NOMBRE_CATEGORIA = CONVERT(CAST(CONVERT(NOMBRE_CATEGORIA USING latin1) AS BINARY) USING utf8mb4) WHERE HEX(NOMBRE_CATEGORIA) LIKE '%C383%'`
      );
      await connection.query(
        `UPDATE CATEGORIAS SET DESCRIPCION = CONVERT(CAST(CONVERT(DESCRIPCION USING latin1) AS BINARY) USING utf8mb4) WHERE HEX(DESCRIPCION) LIKE '%C383%'`
      );
    }
    // VARIANTES — corrige las 3 columnas con tildes (Café, Tamaño, Única, Presentación)
    // Nota: no se puede hacer UPDATE masivo porque existe UNIQUE uq_variante_combo
    // (ID_PRODUCTO,COLOR,NOMBRE_ATRIBUTO,ATRIBUTO) → si ya existe la variante
    // correcta, el UPDATE violaría duplicado. Se corrige fila a fila.
    if (totalVar > 0) {
      const [rows] = await connection.query(
        `SELECT ID_VARIANTE, ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO,
                HEX(COLOR) AS hc, HEX(NOMBRE_ATRIBUTO) AS hn, HEX(ATRIBUTO) AS ha
         FROM PRODUCTO_VARIANTES
         WHERE HEX(COLOR) LIKE '%C383%' OR HEX(NOMBRE_ATRIBUTO) LIKE '%C383%' OR HEX(ATRIBUTO) LIKE '%C383%'
            OR HEX(COLOR) LIKE '%EFBFBD%' OR HEX(NOMBRE_ATRIBUTO) LIKE '%EFBFBD%' OR HEX(ATRIBUTO) LIKE '%EFBFBD%'`
      );
      let corregidas = 0, eliminadas = 0;
      for (const r of rows) {
        const isDouble = (hex) => hex && hex.includes('C383');
        const isCorrupt = (hex) => hex && hex.includes('EFBFBD');
        let decColor = r.COLOR, decNombre = r.NOMBRE_ATRIBUTO, decAtr = r.ATRIBUTO;
        // Decodifica solo columnas con double-encoding vía SQL (más fiable que Buffer para 0x9A etc.)
        // Para EFBFBD (�) el Buffer falla, se mapea directo a valores conocidos
        const fixEFBFBD = (val) => {
          if (!val || !val.includes('�')) return val;
          // 37 filas conocidas: �anica -> Única, � -> Ú etc.
          return val.replace(/�/g, 'Ú').replace('Úanica', 'Única').replace('ÚANICA', 'ÚNICA');
        };
        if (isDouble(r.hc)) {
          const [d] = await connection.query(`SELECT CONVERT(CAST(CONVERT(? USING latin1) AS BINARY) USING utf8mb4) AS v`, [r.COLOR]);
          decColor = d[0].v;
        } else if (isCorrupt(r.hc)) {
          decColor = fixEFBFBD(r.COLOR);
        }
        if (isDouble(r.hn)) {
          const [d] = await connection.query(`SELECT CONVERT(CAST(CONVERT(? USING latin1) AS BINARY) USING utf8mb4) AS v`, [r.NOMBRE_ATRIBUTO]);
          decNombre = d[0].v;
        } else if (isCorrupt(r.hn)) {
          decNombre = fixEFBFBD(r.NOMBRE_ATRIBUTO);
        }
        if (isDouble(r.ha)) {
          const [d] = await connection.query(`SELECT CONVERT(CAST(CONVERT(? USING latin1) AS BINARY) USING utf8mb4) AS v`, [r.ATRIBUTO]);
          decAtr = d[0].v;
        } else if (isCorrupt(r.ha)) {
          decAtr = fixEFBFBD(r.ATRIBUTO);
          // Mapeos específicos conocidos para variantes
          if (decAtr === 'Úanica') decAtr = 'Única';
          if (decAtr.toLowerCase() === '�anica' || decAtr === '�anica') decAtr = 'Única';
        }
        // Fallback: si aún contiene �, forzar a Única si el original era Única/Talla
        if (decAtr && decAtr.includes('�')) {
          if (String(r.ATRIBUTO).toLowerCase().includes('anica')) decAtr = 'Única';
          else decAtr = decAtr.replace(/�/g, '');
        }
        // ¿ya existe la variante correcta?
        const [existe] = await connection.query(
          `SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO=? AND COLOR=? AND NOMBRE_ATRIBUTO=? AND ATRIBUTO=? AND ID_VARIANTE != ? LIMIT 1`,
          [r.ID_PRODUCTO, decColor, decNombre, decAtr, r.ID_VARIANTE]
        );
        if (existe.length > 0) {
          const keep = existe[0].ID_VARIANTE;
          // Reasigna referencias huérfanas hacia la existente correcta
          try { await connection.query(`UPDATE CARRITO SET ID_VARIANTE=? WHERE ID_VARIANTE=?`, [keep, r.ID_VARIANTE]); } catch {}
          try { await connection.query(`UPDATE DETALLE_VENTAS SET ID_VARIANTE=? WHERE ID_VARIANTE=?`, [keep, r.ID_VARIANTE]); } catch {}
          try { await connection.query(`UPDATE AVISOS_STOCK SET ID_VARIANTE=? WHERE ID_VARIANTE=?`, [keep, r.ID_VARIANTE]); } catch {}
          await connection.query(`DELETE FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE=?`, [r.ID_VARIANTE]);
          eliminadas++;
        } else {
          try {
            await connection.query(
              `UPDATE PRODUCTO_VARIANTES SET COLOR=?, NOMBRE_ATRIBUTO=?, ATRIBUTO=? WHERE ID_VARIANTE=?`,
              [decColor, decNombre, decAtr, r.ID_VARIANTE]
            );
            corregidas++;
          } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
              // Carrera: otro proceso ya creó la correcta, eliminar esta
              try { await connection.query(`UPDATE CARRITO SET ID_VARIANTE=(SELECT ID_VARIANTE FROM (SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO=? AND COLOR=? AND NOMBRE_ATRIBUTO=? AND ATRIBUTO=? LIMIT 1) t) WHERE ID_VARIANTE=?`, [r.ID_PRODUCTO, decColor, decNombre, decAtr, r.ID_VARIANTE]); } catch {}
              await connection.query(`DELETE FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE=?`, [r.ID_VARIANTE]);
              eliminadas++;
            } else throw e;
          }
        }
      }
      if (corregidas > 0) console.log(`   · Variantes corregidas: ${corregidas}`);
      if (eliminadas > 0) console.log(`   · Variantes duplicadas eliminadas: ${eliminadas} (ej 83 Botella Ãšnica→Única, 98 PresentaciÃ³n→Presentación)`);
    }
    // Limpieza adicional de duplicados que pudieran quedar por inserts previos (misma lógica pero masiva)
    try {
      const [dups] = await connection.query(
        `SELECT ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, COUNT(*) AS c, MIN(ID_VARIANTE) AS keep_id, GROUP_CONCAT(ID_VARIANTE ORDER BY ID_VARIANTE) AS ids
         FROM PRODUCTO_VARIANTES
         GROUP BY ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO
         HAVING COUNT(*) > 1`
      );
      if (dups.length > 0) {
        console.log(`⚠️  Setup: Detectados ${dups.length} grupo(s) de variantes duplicadas residuales, limpiando...`);
        for (const g of dups) {
          const ids = String(g.ids).split(',').map(Number);
          const keep = Number(g.keep_id);
          const toDelete = ids.filter(id => id !== keep);
          if (toDelete.length === 0) continue;
          try { await connection.query(`UPDATE CARRITO SET ID_VARIANTE = ? WHERE ID_VARIANTE IN (?)`, [keep, toDelete]); } catch {}
          try { await connection.query(`UPDATE DETALLE_VENTAS SET ID_VARIANTE = ? WHERE ID_VARIANTE IN (?)`, [keep, toDelete]); } catch {}
          try { await connection.query(`UPDATE AVISOS_STOCK SET ID_VARIANTE = ? WHERE ID_VARIANTE IN (?)`, [keep, toDelete]); } catch {}
          await connection.query(`DELETE FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE IN (?)`, [toDelete]);
          console.log(`   · Producto ${g.ID_PRODUCTO} (${g.COLOR}/${g.NOMBRE_ATRIBUTO}=${g.ATRIBUTO}) → keep ${keep}, deleted ${toDelete.join(',')}`);
        }
      }
    } catch (e) {
      console.warn(`⚠️  Setup: No se pudo limpiar duplicados residuales (${e.code || e.message?.substring(0, 60)})`);
    }
    if (totalProd > 0 || totalVar > 0) console.log(`✅ Setup: Encoding reparado`);
  } catch (e) {
    console.warn(`⚠️  Setup: No se pudo reparar encoding (${e.code || e.message?.substring(0, 60)})`);
  }
}

const CONTENIDOS_PRODUCTO = require('./contenidos-producto');

/** Aplica los contenidos de producto (descripciones + características) de forma
 *  NO destructiva: solo actualiza productos cuya descripción sigue siendo un
 *  texto gestionado (el corto del seed o una versión anterior del módulo) y
 *  nunca pisa ediciones hechas desde el panel admin. Al actualizar una
 *  descripción se REEMPLAZA su ficha técnica vieja; en arranques normales solo
 *  se agregan características faltantes. Con FORCE_CONTENIDOS=1 reescribe todo. */
async function asegurarContenidosProducto(connection) {
  const forzar = process.env.FORCE_CONTENIDOS === '1';
  const [rows] = await connection.query('SELECT ID, DESCRIPCION FROM PRODUCTOS');
  const actuales = new Map(rows.map((r) => [r.ID, (r.DESCRIPCION || '').trim()]));
  let descActualizadas = 0;
  let caracReemplazadas = 0;
  let caracInsertadas = 0;

  for (const p of CONTENIDOS_PRODUCTO) {
    const actual = actuales.get(p.ID);
    if (actual === undefined) continue;

    const nuevo = (p.descripcion || '').trim();
    // original admite string o array de textos legados que el módulo puede actualizar
    const legados = (Array.isArray(p.original) ? p.original : [p.original]).map((t) => (t || '').trim());
    const gestionado = forzar || actual === '' || legados.includes(actual);
    if (!gestionado) continue; // editado desde el panel admin: se respeta

    const cambioDesc = actual !== nuevo;
    if (cambioDesc) {
      await connection.query('UPDATE PRODUCTOS SET DESCRIPCION = ? WHERE ID = ?', [nuevo, p.ID]);
      descActualizadas++;
      // Mejora de versión: sustituye la ficha técnica vieja por la curada
      await connection.query('DELETE FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?', [p.ID]);
      for (const c of p.caracteristicas || []) {
        await connection.query(
          'INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)',
          [p.ID, c.nombre, c.valor]
        );
        caracReemplazadas++;
      }
    } else {
      // Arranque normal: solo agrega las características que falten
      for (const c of p.caracteristicas || []) {
        const [existe] = await connection.query(
          'SELECT COUNT(*) AS t FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ? AND NOMBRE_ATRIBUTO = ? AND VALOR_ATRIBUTO = ?',
          [p.ID, c.nombre, c.valor]
        );
        if (Number(existe[0].t) === 0) {
          await connection.query(
            'INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)',
            [p.ID, c.nombre, c.valor]
          );
          caracInsertadas++;
        }
      }
    }
  }

  if (descActualizadas > 0 || caracReemplazadas > 0 || caracInsertadas > 0) {
    console.log(` — Setup: Contenido de productos sembrado${forzar ? ' (forzado)' : ''}  — ${descActualizadas} descripciones actualizadas, ${caracReemplazadas} características reemplazadas, ${caracInsertadas} agregadas`);
  }
}

async function setupDatabase() {
  const DB_NAME = process.env.DB_NAME || 'jadda_sports_db';
  const maxRetries = 10;
  const retryDelay = 3000;
  let connection;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'database',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'tu_password_secreto',
        charset: 'utf8mb4',
        multipleStatements: true,
        connectTimeout: 5000,
      });

      // Crea la BD solo si no existe (seguro en cada reinicio) — asegura utf8mb4
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
      await connection.query(`USE \`${DB_NAME}\``);

      // Verifica si las tablas ya existen para no crear de nuevo
      const [tables] = await connection.query(`SHOW TABLES LIKE 'CATEGORIAS'`);
      if (tables.length > 0) {
        await migrarTablasExistentes(connection);
        await repararEncodingDoble(connection);
        // Re-ejecutar SEED_DATA: INSERT IGNORE no duplica, solo agrega productos nuevos
        console.log(`⚡ Setup: Tablas existentes, sincronizando datos de referencia...`);
        try {
          const cleanSeed = SEED_DATA.replace(/\r/g, '').split('\n')
            .filter(line => !line.trimStart().startsWith('--'))
            .join('\n');
          // Execute statements individually; split large multi-row INSERTs
          let stmt = '';
          let executed = 0, failed = 0;
          for (const line of cleanSeed.split('\n')) {
            stmt += line + '\n';
            if (stmt.trimEnd().endsWith(';')) {
              const trimmed = stmt.trim();
              // Split multi-row INSERTs into batches of 10 rows
              if (/INSERT\s+IGNORE\s+INTO\s+PRODUCTO/i.test(trimmed) && trimmed.includes('),')) {
                const headerMatch = trimmed.match(/^(INSERT\s+IGNORE\s+INTO\s+\S+\s*\([^)]+\)\s*VALUES\s*\n)/i);
                if (headerMatch) {
                  const header = headerMatch[1];
                  const rowsStr = trimmed.substring(header.length);
                  const rows = rowsStr.split('\n').filter(r => r.trim().length > 0);
                  for (let i = 0; i < rows.length; i += 10) {
                    const batch = rows.slice(i, i + 10);
                    batch[batch.length - 1] = batch[batch.length - 1].replace(/,\s*$/, ';');
                    try {
                      await connection.query(header + batch.join('\n'));
                      executed++;
                    } catch (e) {
                      failed++;
                      if (failed <= 3) console.warn(`⚠️ Setup: Batch falló (${e.code || e.message.substring(0, 60)})`);
                    }
                  }
                } else {
                  try { await connection.query(trimmed); executed++; } catch (e) { failed++; }
                }
              } else {
                try {
                  await connection.query(trimmed);
                  executed++;
                } catch (e) {
                  failed++;
                  if (failed <= 3) console.warn(`⚠️ Setup: Statement falló (${e.code || e.message.substring(0, 60)})`);
                }
              }
              stmt = '';
            }
          }
          console.log(`✅ Setup: Seed ejecutado (${executed} ok, ${failed} fallidos)`);
        } catch (seedErr) {
          console.warn(`⚠️ Setup: Seed completo falló (${seedErr.code || seedErr.message.substring(0, 50)}), omitiendo`);
        }
        await asegurarContenidosProducto(connection);
        await seedAdminUser(connection);
        return;
      }

      console.log(` —️  Setup: Tablas y datos de referencia...`);
      await connection.query(CREATE_TABLES_RAW);
      await connection.query(SEED_DATA);
      await asegurarContenidosProducto(connection);
      await seedAdminUser(connection);

      console.log(` — Setup: Base de datos '${DB_NAME}' lista (tablas + datos de referencia)`);
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(` — Setup: Error definitivo - ${err.message}`);
        return;
      }
      console.log(` —️  Setup: MySQL no listo (intento ${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } finally {
      if (connection) {
        try { await connection.end(); } catch (e) { /* ignore */ }
      }
    }
  }
}

setupDatabase();
