/*
 * setup.js — Inicialización automática de la base de datos.
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

// Configuración separada del pool de db.js — esta conexión es solo para setup
const DB_CONFIG = {
  host: process.env.DB_HOST || 'database',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'tu_password_secreto',
  database: process.env.DB_NAME || 'jadda_sports_db',
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
    DESCRIPCION VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS DESCUENTOS (
    ID_DESCUENTO INT PRIMARY KEY AUTO_INCREMENT,
    DESCRIPCION VARCHAR(255),
    PORCENTAJE DECIMAL(5,2),
    FECHA_INICIO DATE,
    FECHA_FIN DATE,
    USADO TINYINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS PRODUCTOS (
    ID INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE VARCHAR(255),
    MARCA VARCHAR(100),
    PRECIO DECIMAL(10,2),
    DESCRIPCION TEXT,
    ID_PROVEEDOR INT,
    ID_CATEGORIA INT,
    ID_DESCUENTO INT
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
-- INVENTARIO, EMPLEADOS Y MÉTODOS DE PAGO
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS INVENTARIO (
    ID_INVENTARIO INT PRIMARY KEY AUTO_INCREMENT,
    ID_PRODUCTO INT,
    CANTIDAD INT,
    FECHA_INGRESO DATE,
    FECHA_ACTUALIZACION DATE,
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID)
);

CREATE TABLE IF NOT EXISTS EMPLEADOS (
    ID_EMPLEADO INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE_EMPLEADO VARCHAR(100),
    APELLIDO_EMPLEADO VARCHAR(100),
    CARGO VARCHAR(100),
    FECHA_CONTRATACION DATE,
    TELEFONO VARCHAR(15),
    EMAIL VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS METODOS_PAGO (
    ID_METODO INT PRIMARY KEY AUTO_INCREMENT,
    NOMBRE_METODO VARCHAR(50) NOT NULL,
    DESCRIPCION VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS VENTAS (
    ID_VENTA INT PRIMARY KEY AUTO_INCREMENT,
    ID_CLIENTE INT,
    ID_EMPLEADO INT NULL,
    FECHA_VENTA DATETIME,
    DATOS_PAGO JSON DEFAULT NULL,
    TOTAL DECIMAL(10,2),
    ESTADO VARCHAR(50) DEFAULT 'COMPLETADA',
    ID_METODO INT,
    REFERENCIA_PAGO VARCHAR(100) DEFAULT NULL,
    FOREIGN KEY (ID_EMPLEADO) REFERENCES EMPLEADOS(ID_EMPLEADO),
    FOREIGN KEY (ID_METODO) REFERENCES METODOS_PAGO(ID_METODO)
);

-- -------------------------------------------------------------------------
-- VENTAS, DETALLE, ENVÍOS Y MOVIMIENTOS DE STOCK
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS DETALLE_VENTAS (
    ID_DETALLE INT PRIMARY KEY AUTO_INCREMENT,
    ID_VENTA INT,
    ID_PRODUCTO INT,
    CANTIDAD INT,
    PRECIO_UNITARIO DECIMAL(10,2),
    SUBTOTAL DECIMAL(10,2),
    FOREIGN KEY (ID_VENTA) REFERENCES VENTAS(ID_VENTA),
    FOREIGN KEY (ID_PRODUCTO) REFERENCES PRODUCTOS(ID)
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
  RUTA VARCHAR(255) NOT NULL,
  RUTAS_EXTRA TEXT DEFAULT NULL,
  CANTIDAD INT NOT NULL DEFAULT 1,
  ESTADO VARCHAR(20) DEFAULT 'pendiente',
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
(5, 'Invitado', 'Acceso limitado');

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
(1, 'Fútbol', 'Productos relacionados con fútbol'),
(2, 'Baloncesto', 'Artículos de baloncesto'),
(3, 'Running', 'Productos para correr'),
(4, 'Gimnasio', 'Equipos y accesorios fitness'),
(5, 'Natación', 'Artículos para nadar'),
(6, 'Ciclismo', 'Accesorios y ropa ciclismo'),
(7, 'Deportes extremos', 'Equipos especializados'),
(8, 'Ropa deportiva', 'Prendas deportivas'),
(9, 'Accesorios', 'Complementos deportivos'),
(10, 'Protección', 'Elementos de seguridad'),
(11, 'Cardio', 'Equipos cardiovasculares'),
(12, 'Hogar fitness', 'Equipos domésticos'),
(13, 'Suplementos', 'Nutrición deportiva'),
(14, 'Tecnología deportiva', 'Relojes y gadgets'),
(15, 'Ofertas', 'Productos con descuento');

-- -------------------------------------------------------------------------
-- DESCUENTOS: 2 descuentos de ejemplo (temporada + cupón JADDA10)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO DESCUENTOS (ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN) VALUES
(1, 'Descuento temporada fútbol', 10, '2025-06-01', '2025-07-01'),
(2, 'JADDA10', 10, '2025-01-01', '2026-12-31');

-- -------------------------------------------------------------------------
-- PRODUCTOS: 45 productos de ejemplo en todas las categorías
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
(10, 'Zapatillas Ultraboost Light', 'Adidas', 650000, 'Retorno de energía ligero', 2, 3, NULL),
(11, 'Tenis Speedcross 6', 'Salomon', 590000, 'Ideal para trail running', 2, 3, NULL),
(12, 'Joggers Sport Tech', 'Nike', 185000, 'Corte ajustado', 1, 3, NULL),
(13, 'Cuerda para saltar', 'Everlast', 35000, 'Cuerda ajustable', 1, 4, NULL),
(14, 'Pesas 5kg', 'BodyFit', 50000, 'Recubiertas', 2, 4, NULL),
(15, 'Mancuernas 20kg', 'BodyFit', 150000, 'Set completo', 2, 4, NULL),
(16, 'Colchoneta Yoga Pro', 'Everlast', 75000, 'Antideslizante 6mm', 1, 4, NULL),
(17, 'Gafas de Natación Pro', 'Speedo', 95000, 'Antiempañante y UV', 2, 5, NULL),
(18, 'Gorro de Natación Silicona', 'Speedo', 25000, 'Ajuste hidrodinámico', 1, 5, NULL),
(19, 'Casco Ciclismo Ruta', 'Bell', 250000, 'Certificación seguridad', 2, 6, NULL),
(20, 'Guantes Ciclismo Gel', 'Giant', 85000, 'Acolchado anti-vibración', 1, 6, NULL),
(21, 'Casco Escalada', 'Black Diamond', 320000, 'Ultra ligero', 1, 7, NULL),
(22, 'Cuerda Escalada 50m', 'Petzl', 850000, 'Resistencia alta', 2, 7, NULL),
(23, 'Chaqueta Rompevientos', 'Adidas', 210000, 'Protección contra viento', 2, 8, NULL),
(24, 'Leggings Lux High-Rise', 'Reebok', 140000, 'Tela absorción humedad', 1, 8, NULL),
(25, 'Termo deportivo', 'Nike', 45000, 'Acero inoxidable', 2, 9, NULL),
(26, 'Gorra deportiva', 'Puma', 40000, 'Ajustable', 2, 9, NULL),
(27, 'Protector bucal', 'Everlast', 25000, 'Protección dental', 1, 10, NULL),
(28, 'Rodilleras', 'Reebok', 60000, 'Soporte deportivo', 1, 10, NULL),
(29, 'Elíptica doméstica', 'ProFit', 1800000, 'Equipo cardio', 1, 11, NULL),
(30, 'Reloj Inteligente Sport', 'Garmin', 1200000, 'Monitoreo ritmo cardíaco', 2, 11, NULL),
(31, 'Steps Aeróbicos', 'ProFit', 160000, 'Altura ajustable 3 niveles', 1, 12, NULL),
(32, 'Rueda Abdominal Dual', 'BodyFit', 42000, 'Core reforzado', 2, 12, NULL),
(33, 'Proteína Whey 2lb', 'Optimum', 190000, 'Proteína de suero pura', 1, 13, NULL),
(34, 'Creatina Micronizada', 'Muscletech', 95000, 'Fuerza explosiva', 2, 13, NULL),
(35, 'Banda de Frecuencia', 'Polar', 280000, 'Conectividad Bluetooth', 1, 14, NULL),
(36, 'Toalla Microfibra', 'Jadda', 35000, 'Secado rápido', 1, 15, NULL),
(37, 'Kit Boxeo Iniciación', 'Everlast', 350000, 'Pack completo', 1, 15, NULL),
(38, 'Balón medicinal 5kg', 'Everlast', 120000, 'Entrenamiento funcional', 1, 4, NULL),
(39, 'Camiseta Entrenamiento', 'Nike', 115000, 'Dri-FIT', 1, 8, NULL),
(40, 'Shorts Tennis', 'Adidas', 95000, 'Movilidad lateral', 2, 3, NULL),
(41, 'Polo Tennis', 'Fila', 110000, 'Protección UV', 2, 3, NULL),
(42, 'Guantes Gimnasio', 'Everlast', 45000, 'Ventilación', 1, 4, NULL),
(43, 'Bolsa Hidratación 2L', 'Salomon', 125000, 'Compatible running', 2, 3, NULL),
(44, 'Muñequeras', 'Reebok', 25000, 'Algodón', 1, 10, NULL);

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
-- IMÁGENES: 3 imágenes por producto (132 registros, producto 45 eliminado)
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
(132,44,'/images/productos/Producto_44/img_3.jpg',3);


-- -------------------------------------------------------------------------
-- INVENTARIO INICIAL: 15 productos con stock de apertura
-- -------------------------------------------------------------------------
INSERT IGNORE INTO INVENTARIO (ID_INVENTARIO, ID_PRODUCTO, CANTIDAD, FECHA_INGRESO, FECHA_ACTUALIZACION) VALUES
(1,1,60,'2025-01-01','2025-01-10'),
(2,2,40,'2025-01-02','2025-01-10'),
(3,3,25,'2025-01-03','2025-01-10'),
(4,4,50,'2025-01-04','2025-01-10'),
(5,5,100,'2025-01-05','2025-01-10'),
(6,6,70,'2025-01-06','2025-01-10'),
(7,7,150,'2025-01-07','2025-01-10'),
(8,8,90,'2025-01-08','2025-01-10'),
(9,9,80,'2025-01-09','2025-01-10'),
(10,10,120,'2025-01-10','2025-01-10'),
(11,11,30,'2025-01-11','2025-01-11'),
(12,12,60,'2025-01-12','2025-01-12'),
(13,13,8,'2025-01-13','2025-01-13'),
(14,14,20,'2025-01-14','2025-01-14'),
(15,15,55,'2025-01-15','2025-01-15');

-- -------------------------------------------------------------------------
-- EMPLEADOS: 12 empleados de ejemplo (vendedores, cajeros, admin, etc.)
-- -------------------------------------------------------------------------
INSERT IGNORE INTO EMPLEADOS (ID_EMPLEADO, NOMBRE_EMPLEADO, APELLIDO_EMPLEADO, CARGO, FECHA_CONTRATACION, TELEFONO, EMAIL) VALUES
(1,'Ricardo','López','Vendedor','2022-05-01','3021112233','ricardo@tienda.com'),
(2,'Andrea','Reyes','Cajero','2023-02-10','3022223344','andrea@tienda.com'),
(3,'Fernando','Muñoz','Administrador','2021-03-15','3023334455','fernando@tienda.com'),
(4,'Sandra','Ramírez','Contadora','2020-06-20','3024445566','sandra@tienda.com'),
(5,'David','Torres','Bodeguero','2024-01-05','3025556677','david@tienda.com'),
(6,'Lorena','Medina','Vendedor','2023-08-08','3026667788','lorena@tienda.com'),
(7,'Carlos','Martínez','Soporte','2022-09-12','3027778899','carlos@tienda.com'),
(8,'Natalia','Ortiz','Vendedor','2024-02-14','3031112233','natalia@tienda.com'),
(9,'Javier','Gómez','Logística','2021-11-11','3032223344','javier@tienda.com'),
(10,'Marta','Herrera','Cajero','2023-06-10','3033334455','marta@tienda.com'),
(11,'Sebastián','Moreno','Vendedor','2022-03-17','3034445566','sebastian@tienda.com'),
(12,'Paula','Rojas','Cajero','2024-01-09','3035556677','paula@tienda.com');

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
(1, 'Semana Activa', 'Completa 5 sesiones de entrenamiento de al menos 30 minutos en una semana', 'sesiones', 5, 10.00, '2026-01-01', '2026-12-31'),
(2, 'Maratón de Km', 'Acumula 15 kilómetros corriendo o caminando', 'km', 15, 15.00, '2026-01-01', '2026-12-31'),
(3, 'Racha Imparable', 'Entrena 7 días consecutivos sin saltarte ninguno', 'dias', 7, 20.00, '2026-01-01', '2026-12-31'),
(4, 'Reto Fuerza', 'Completa 10 sesiones de gimnasio o pesas', 'sesiones', 10, 12.00, '2026-01-01', '2026-12-31'),
(5, 'Primer Kilómetro', 'Corre o camina tu primer kilómetro del reto', 'km', 1, 5.00, '2026-01-01', '2026-12-31'),
(6, 'Flexiones Total', 'Completa 100 flexiones acumuladas', 'sesiones', 100, 8.00, '2026-01-01', '2026-12-31'),
(7, 'Aguanta el Core', 'Haz 30 planchas de 1 minuto en el mes', 'sesiones', 30, 10.00, '2026-01-01', '2026-12-31'),
(8, 'Medio Maratón', 'Acumula 21 kilómetros de carrera', 'km', 21, 25.00, '2026-01-01', '2026-12-31'),
(9, 'Semana Sin Azúcar', 'Reporta 7 días sin consumir azúcar añadida', 'dias', 7, 10.00, '2026-01-01', '2026-12-31'),
(10, 'Hidratación Total', 'Registra 14 días tomando al menos 2 litros de agua', 'dias', 14, 8.00, '2026-01-01', '2026-12-31'),
(11, 'Ciclismo de Fondo', 'Acumula 50 kilómetros en bicicleta', 'km', 50, 15.00, '2026-01-01', '2026-12-31'),
(12, 'Sentadillas Legendarias', 'Completa 200 sentadillas acumuladas', 'sesiones', 200, 10.00, '2026-01-01', '2026-12-31'),
(13, 'Salto de Cuerda', 'Acumula 15 sesiones de salto de cuerda de 10 minutos', 'sesiones', 15, 12.00, '2026-01-01', '2026-12-31'),
(14, 'Estiramiento Diario', 'Estira 10 días seguidos para mejorar movilidad', 'dias', 10, 8.00, '2026-01-01', '2026-12-31'),
(15, '30 Minutos Diarios', 'Entrena 30 minutos al día durante 10 días', 'dias', 10, 12.00, '2026-01-01', '2026-12-31'),
(16, 'Reto Natación', 'Acumula 5 kilómetros de natación', 'km', 5, 15.00, '2026-01-01', '2026-12-31');

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

/*
 * setupDatabase — Función principal de inicialización.
 *
 * Lógica:
 *   1. Conecta a MySQL sin especificar BD (para poder crearla).
 *   2. Crea la base de datos si no existe (CREATE DATABASE IF NOT EXISTS).
 *   3. Selecciona la BD y ejecuta CREATE_TABLES_RAW (22 tablas).
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

  // 1. Si ya existe el admin con ese correo → refresca contraseña y rol
  const [target] = await connection.query('SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = ?', [email]);
  if (target.length > 0) {
    await connection.query(
      'UPDATE USUARIOS SET CONTRASENA = ?, ID_ROL = 1, CONFIRMADO = 1 WHERE ID_USUARIO = ?',
      [hashed, target[0].ID_USUARIO]
    );
    console.log(`✅ Setup: Admin (${email}) asegurado con la contraseña del .env`);
    return;
  }

  // 2. Si existe otro admin con otro correo → lo renombra al correo objetivo
  const [adminViejo] = await connection.query(
    'SELECT ID_USUARIO FROM USUARIOS WHERE ID_ROL = 1 ORDER BY ID_USUARIO ASC LIMIT 1'
  );
  if (adminViejo.length > 0) {
    await connection.query(
      'UPDATE USUARIOS SET EMAIL = ?, CONTRASENA = ?, CONFIRMADO = 1 WHERE ID_USUARIO = ?',
      [email, hashed, adminViejo[0].ID_USUARIO]
    );
    console.log(`✅ Setup: Admin existente actualizado → ${email}`);
    return;
  }

  // 3. No hay ningún admin → crea uno nuevo
  const usuarioLogin = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '_') + '_admin';
  await connection.query(
    `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, CONFIRMADO, AUTH_PROVIDER)
     VALUES ('Administrador', 'Jadda', ?, ?, ?, CURDATE(), 1, 1, 'local')`,
    [email, usuarioLogin, hashed]
  );

  console.log(`✅ Setup: Usuario administrador creado (${email})`);
  console.log(`   🔐 Contraseña: ${password} — cámbiala tras el primer ingreso`);
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
      RUTA VARCHAR(255) NOT NULL,
      RUTAS_EXTRA TEXT DEFAULT NULL,
      CANTIDAD INT NOT NULL DEFAULT 1,
      ESTADO VARCHAR(20) DEFAULT 'pendiente',
      FECHA_SUBIDA DATETIME DEFAULT NOW(),
      FOREIGN KEY (ID_RETO_USUARIO) REFERENCES RETOS_USUARIOS(ID_RETO_USUARIO),
      FOREIGN KEY (ID_USUARIO) REFERENCES USUARIOS(ID_USUARIO)
    )`,
    mensaje: 'tabla RETO_EVIDENCIAS creada (material de avances de retos)',
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
];

const RETOS_ADICIONALES = `
INSERT IGNORE INTO RETOS (ID_RETO, TITULO, DESCRIPCION, META_TIPO, META_VALOR, RECOMPENSA_PORCENTAJE, FECHA_INICIO, FECHA_FIN) VALUES
(5, 'Primer Kilómetro', 'Corre o camina tu primer kilómetro del reto', 'km', 1, 5.00, '2026-01-01', '2026-12-31'),
(6, 'Flexiones Total', 'Completa 100 flexiones acumuladas', 'sesiones', 100, 8.00, '2026-01-01', '2026-12-31'),
(7, 'Aguanta el Core', 'Haz 30 planchas de 1 minuto en el mes', 'sesiones', 30, 10.00, '2026-01-01', '2026-12-31'),
(8, 'Medio Maratón', 'Acumula 21 kilómetros de carrera', 'km', 21, 25.00, '2026-01-01', '2026-12-31'),
(9, 'Semana Sin Azúcar', 'Reporta 7 días sin consumir azúcar añadida', 'dias', 7, 10.00, '2026-01-01', '2026-12-31'),
(10, 'Hidratación Total', 'Registra 14 días tomando al menos 2 litros de agua', 'dias', 14, 8.00, '2026-01-01', '2026-12-31'),
(11, 'Ciclismo de Fondo', 'Acumula 50 kilómetros en bicicleta', 'km', 50, 15.00, '2026-01-01', '2026-12-31'),
(12, 'Sentadillas Legendarias', 'Completa 200 sentadillas acumuladas', 'sesiones', 200, 10.00, '2026-01-01', '2026-12-31'),
(13, 'Salto de Cuerda', 'Acumula 15 sesiones de salto de cuerda de 10 minutos', 'sesiones', 15, 12.00, '2026-01-01', '2026-12-31'),
(14, 'Estiramiento Diario', 'Estira 10 días seguidos para mejorar movilidad', 'dias', 10, 8.00, '2026-01-01', '2026-12-31'),
(15, '30 Minutos Diarios', 'Entrena 30 minutos al día durante 10 días', 'dias', 10, 12.00, '2026-01-01', '2026-12-31'),
(16, 'Reto Natación', 'Acumula 5 kilómetros de natación', 'km', 5, 15.00, '2026-01-01', '2026-12-31');
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
      console.log(`⚙️  Setup: Migración aplicada — ${migracion.mensaje}`);
    }
  }
  await connection.query(RETOS_ADICIONALES);
  console.log('⚙️  Setup: Retos adicionales asegurados (INSERT IGNORE).');
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
        multipleStatements: true,
        connectTimeout: 5000,
      });

      // Crea la BD solo si no existe (seguro en cada reinicio)
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
      await connection.query(`USE \`${DB_NAME}\``);

      // Verifica si las tablas ya existen para no ejecutar todo en cada reinicio
      const [tables] = await connection.query(`SHOW TABLES LIKE 'CATEGORIAS'`);
      if (tables.length > 0) {
        console.log(`⚙️  Setup: Tablas ya existen, omitiendo creación y seed.`);
        await migrarTablasExistentes(connection);
        await seedAdminUser(connection);
        return;
      }

      console.log(`⚙️  Setup: Tablas y datos de referencia...`);
      await connection.query(CREATE_TABLES_RAW);
      await connection.query(SEED_DATA);
      await seedAdminUser(connection);

      console.log(`✅ Setup: Base de datos '${DB_NAME}' lista (tablas + datos de referencia)`);
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`❌ Setup: Error definitivo - ${err.message}`);
        return;
      }
      console.log(`⚠️  Setup: MySQL no listo (intento ${attempt}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } finally {
      if (connection) {
        try { await connection.end(); } catch (e) { /* ignore */ }
      }
    }
  }
}

setupDatabase();
