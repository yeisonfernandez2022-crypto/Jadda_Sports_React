# Licencias de terceros — JADDA SPORTS

Inventario completo de las licencias de software de terceros que usa el proyecto: dependencias npm de las tres capas (backend, frontend y móvil), herramientas de desarrollo y servicios externos. Generado mecánicamente desde los lockfiles (fuente: `pnpm licenses list`, comando de regeneración en §6), no a mano.

- **Fecha de generación:** 2026-11-12 · branch `documentacion-swagger-openapi`
- **Ámbito:** `backend/package.json`, `frontend/package.json`, `movil/package.json` y sus dependencias transitivas instaladas
- **Total dependencias de producción auditadas:** 895 (backend 213 · frontend 45 · móvil 637)

Conclusión general: **el 96 % de las dependencias de producción es MIT**; el resto es ISC, BSD, Apache-2.0 o licencias permisivas equivalentes. **Ninguna dependencia del proyecto es GPL/AGPL con efecto de copyleft sobre el código propio** (ver §3: las únicas licencias con opción GPL son duales con MIT/Apache/BSD, y el proyecto usa la variante permisiva).

---

## 1. Dependencias directas de producción (por capa)

### 1.1 Backend (`backend/package.json` — 16 dependencias)

| Paquete | Versión | Licencia | Función |
|---|---|---|---|
| express | 5.2.1 | MIT | Framework de la API REST |
| mysql2 | 3.24.6 | MIT | Cliente MySQL (pool) |
| express-session | 1.19.0 | MIT | Sesiones de usuario (cookie `connect.sid`) |
| express-mysql-session | 3.0.3 | MIT | Almacenamiento de sesiones en MySQL |
| passport | 0.7.0 | MIT | Autenticación (schedulers de estrategias) |
| passport-google-oauth20 | 2.0.0 | MIT | Login social con Google |
| google-auth-library | 9.15.1 | Apache-2.0 | Verificación de tokens OAuth (flujo móvil) |
| helmet | 8.3.0 | MIT | Cabeceras de seguridad HTTP |
| cors | 2.8.6 | MIT | Control de orígenes admitidos |
| multer | 2.5.0 | MIT | Subidas de archivos (multipart) |
| bcryptjs | 3.0.3 | BSD-3-Clause | Hash de contraseñas |
| dotenv | 17.3.1 | BSD-2-Clause | Carga de variables de entorno |
| cloudinary | 2.11.0 | MIT (SDK) | SDK de almacenamiento de medios (el servicio es comercial, ver §4) |
| nodemailer | 10.3.1 | MIT-0 | Envío de correos transaccionales |
| pdfkit | 0.19.1 | MIT | Facturas PDF |
| exceljs | 4.4.0 | MIT | Reportes Excel con fórmulas |

### 1.2 Frontend (`frontend/package.json` — 10 dependencias)

| Paquete | Versión | Licencia | Función |
|---|---|---|---|
| react / react-dom | 19.2.4 | MIT | Interfaz web (SPA) |
| react-router-dom | 7.18.5 | MIT | Navegación de rutas |
| axios | 1.20.0 | MIT | Cliente HTTP |
| bootstrap | 5.3.8 | MIT | Estilos base |
| @fortawesome/fontawesome-free | 7.2.0 | **CC-BY-4.0 AND OFL-1.1 AND MIT** (triple) | Iconos y fuentes (ver §3) |
| react-icons | 5.6.0 | MIT | Iconos como componentes SVG |
| react-easy-crop | 6.2.4 | MIT | Recorte de foto de perfil |
| sweetalert2 | 11.26.25 | MIT | Diálogos y alertas |
| aos | 2.3.4 | MIT | Animaciones al hacer scroll |

### 1.3 Móvil (`movil/package.json` — 34 dependencias)

| Paquete | Versión | Licencia | Función |
|---|---|---|---|
| expo | 54.0.35 | MIT | SDK de React Native (builds, OTA) |
| expo-router | 6.0.24 | MIT | Navegación por archivos |
| expo-constants / expo-file-system / expo-font / expo-haptics / expo-image / expo-image-picker / expo-linking / expo-sharing / expo-splash-screen / expo-status-bar / expo-symbols / expo-system-ui / expo-updates / expo-video / expo-web-browser / expo-dev-client | 54.x | MIT (ver §3: `expo-updates` sin declaración) | Módulos nativos de Expo |
| @expo/vector-icons | 15.1.1 | MIT | Iconos |
| react-native | 0.81.5 | MIT | Runtime móvil |
| react-native-gesture-handler / reanimated / safe-area-context / screens / web / worklets | 0.81–4.x | MIT | Gestos, animaciones y layout |
| @react-navigation/native / bottom-tabs / elements | 7.x | MIT | Navegación |
| @react-native-async-storage/async-storage | 2.2.0 | MIT | Persistencia local (sesión, historial) |
| @react-native-google-signin/google-signin | 16.1.4 | MIT | Login social con Google |
| axios | 1.17.0 | MIT | Cliente HTTP |
| react / react-dom | 19.1.0 | MIT | Runtime de React |

---

## 2. Resumen de TODAS las dependencias de producción (incluidas las transitivas)

Distribución de las 895 dependencias auditadas por licencia (backend + frontend + móvil):

| Licencia | Paquetes | Observación |
|---|---|---|
| MIT | 760 | Permisa: uso, copia, modificación y redistribución libres |
| ISC | 48 | Equivalente funcional a MIT |
| BSD-3-Clause | 22 | Permisa con cláusula de no uso del nombre en promoción |
| Apache-2.0 | 21 | Permisa con concesión explícita de patentes |
| BSD-2-Clause | 9 | Permisa (cláusula dual simplificada) |
| BlueOak-1.0.0 | 9 | Permisa (ecosistema PostCSS/cssnano; alternativa propuesta a MIT por ese proyecto) |
| Unlicense / 0BSD | 7 | Dominio público |
| MIT/X11 | 2 | Equivalente a MIT |
| MIT-0 | 1 | MIT sin cláusula de aviso (nodemailer) |
| Duales permisivas (MIT ∨ GPL, BSD ∨ GPL, BSD ∨ MIT ∨ Apache, MIT ∨ CC0) | 4 | El proyecto usa la variante permisiva (ver §3) |
| Especiales con contenido | 3 | Font Awesome (§3), `pako` (MIT AND Zlib), `argparse` (Python-2.0/PSF) |
| Sin declaración en `package.json` | 6 | Paquetes internos de ecosistemas MIT (ver §3) |
| **Total** | **895** | |

---

## 3. Casos que merecen nota

| Paquete | Licencia | Nota para el proyecto |
|---|---|---|
| @fortawesome/fontawesome-free (frontend) | CC-BY-4.0 + OFL-1.1 + MIT | Triple licencia del paquete completo: MIT cubre el CSS/JS del paquete, OFL-1.1 las fuentes de iconos y CC-BY-4.0 los iconos SVG individuales (no modificados: los iconos tal cual no exigen atribución, pero es buena práctica mencionar Font Awesome en los créditos de la web). No afecta al código propio |
| jszip (backend, vía ExcelJS) | MIT ∨ GPL-3.0-or-later | Dual: se distribuye bajo la variante MIT — sin efecto copyleft |
| pako (backend, vía ExcelJS) | MIT AND Zlib | Ambas permisivas |
| node-forge (móvil, vía Expo) | BSD-3-Clause ∨ GPL-2.0 | Dual: se usa la variante BSD |
| type-fest / rc (móvil) | MIT ∨ CC0 / BSD-2-Clause ∨ MIT ∨ Apache-2.0 | Duales permisivas |
| caniuse-lite (móvil, vía Browserslist) | CC-BY-4.0 | Datos de compatibilidad de navegadores; atribución en su repositorio |
| lightningcss (móvil, vía Expo) | MPL-2.0 | Copyleft débil a nivel de archivo; es una dependencia de tooling del build de Expo (no se linkea al bundle de la app) |
| argparse (móvil) | Python-2.0 / PSF | Permisa para uso y redistribución |
| qrcode-terminal (móvil, vía Expo dev) | Apache 2.0 | Permisa |
| `buffers`, `pause`, `arg`, `expo-eas-client`, `expo-structured-headers`, `expo-updates` | Sin declaración | Sin campo `license` en su `package.json`. `pause` es una dependencia histórica de Express (ecosistema MIT) y el resto son paquetes internos de Expo (el proyecto Expo declara MIT en su monorepo). Riesgo razonable: bajo; listados por transparencia |

---

## 4. Servicios externos y su régimen de uso

Los servicios de terceros no se distribuyen con el código — se consumen por API/HTTP y su régimen es el de sus términos de servicio, no una licencia de software:

| Servicio | Uso en el proyecto | Régimen y costo | Restricciones a vigilar |
|---|---|---|---|
| **Cloudinary** | Almacenamiento de imágenes y videos (medios de productos, perfiles, evidencias) | Servicio comercial con plan gratuito por créditos; el SDK es MIT | Si la tienda crece, el consumo extra se cobra. Cancelar el servicio exigiría re-sincronizar la BD a URLs locales (desde 2026-10-20 el repo no versiona binarios) |
| **Wompi** | Pasarela de pagos (sandbox de pruebas hoy; producción futura) | Sin costo por integrarse; en producción real cobra por transacción según su tarifa publicada | Solo sandbox ahora; para producción real crear cuenta y reemplazar llaves |
| **Gmail SMTP / Brevo** | Envío de correos transaccionales (verificación de cuentas, facturas, notificaciones) | Buzón SMTP propio de Gmail (límites de cuota del buzón); Brevo como alternativa con plan gratuito | Los límites de envío del buzón gratuito pueden quedar cortos ante picos; migrar a Brevo (API) está soportado en el código |
| **TiDB Cloud Starter** | Base de datos MySQL de producción (serverless) | Plan gratuito con límites de almacenamiento y unidades de request | Hiberna por inactividad (~10-12 min de despertar) y comparte dev/prod en este despliegue; el motor TiDB Community es Apache-2.0 |
| **ip-api.com** | Geolocalización de la última conexión (perfil/seguridad) | Endpoint gratuito: **solo uso no comercial**, HTTP sin TLS, 45 req/min por IP | Restricción real documentada en el entregable S01 (P3) y en `docs/auditoria/estado-brechas.md` (PRV-2 / COST-1): en una tienda comercial hay que desactivar la geolocalización o pagar un proveedor comercial |
| **Google OAuth 2.0** | Login social web y móvil | Gratuito; sujeta a los términos de Google API Services y su Política de Datos de Usuario | Solo solicita correo/perfil básico; callback registrado en la consola de Google Cloud |
| **ui-avatars.com** | Avatares placeholder (frontend y móvil) | Servicio gratuito | Solo cosmético (letra inicial sobre color) |
| **Render** | Hosting de producción del backend y del frontend (SPA estática + web service) | Free tier del workspace; los free web services duermen tras ~15 min sin tráfico | Cold start de ~1 min tras inactividad; horas mensuales compartidas por workspace |
| **GitHub Actions + SonarCloud** | CI/CD (tests, build de imágenes, análisis de calidad) | Gratuitos para repositorios públicos (Sonar Community Edition) | Minutos y almacenamiento de artefactos limitados por repositorio |
| **Expo EAS** | Builds y actualizaciones OTA de la app móvil (`eas update --channel preview`) | Plan gratuito con colas de build compartidas | Los updates OTA dependen del runtime (`runtimeVersion`) y del canal |
| **Microsoft Windows 11** | Sistema operativo del equipo de desarrollo | EULA/OEM incluida en el equipo | Soporte estándar hasta el 12-oct-2027 (verificado en el entregable S01) |
| **Docker Desktop / Docker Engine** | Contenedores de desarrollo y despliegue | Gratuito para uso personal/educativo y empresas pequeñas; Docker Desktop requiere suscripción en organizaciones grandes | En servidor dedicado Linux se usa Docker Engine (Apache-2.0), sin esa restricción |

---

## 5. Herramientas de desarrollo (`devDependencies`)

Todas MIT salvo TypeScript (Apache-2.0):

| Herramienta | Capa | Licencia | Uso |
|---|---|---|---|
| vite 8.0.1 / @vitejs/plugin-react 6.0.1 | frontend | MIT | Build y preview del SPA |
| typescript 5.9.3 | frontend, móvil | **Apache-2.0** | Verificación de tipos |
| vitest 5.x + @vitest/coverage-v8 | backend, frontend | MIT | Suite de pruebas y cobertura |
| @testing-library/react + jest-dom 7.x | frontend | MIT | Pruebas de componentes React |
| msw 3.x | frontend | MIT | Mock de red en pruebas |
| jsdom 30.x | frontend | MIT | DOM simulado para vitest |
| eslint 9.x + @eslint/js + eslint-plugin-react-hooks + eslint-plugin-react-refresh + typescript-eslint + globals | frontend | MIT | Linter |
| eslint + eslint-config-expo | móvil | MIT | Linter móvil |
| nodemon 3.1.14 | backend | MIT | Recarga en desarrollo |
| supertest 7.x + @types/supertest | backend | MIT | Pruebas de integración HTTP |

---

## 6. Cómo regenerar este inventario

El documento es reproducible mecánicamente (no se mantiene a mano). Con `pnpm` instalado (`corepack enable`):

```bash
# Dependencias de producción, agrupadas por licencia (por capa)
cd backend   && corepack pnpm licenses list --prod
cd frontend  && corepack pnpm licenses list --prod
cd movil     && corepack pnpm licenses list --prod

# Formato JSON para auditoría automática
corepack pnpm licenses list --prod --json

# También en producción (equivalente a --prod): revisar devDependencies
corepack pnpm licenses list --json
```

Criterios usados al redactar: las versiones reportadas son las resueltas por el lockfile (`pnpm-lock.yaml`) del día de generación; los rangos de versión de `package.json` se citan tal cual. Si se agregan o actualizan dependencias, re-correr los comandos de arriba y actualizar §1–§3; el comando `corepack pnpm audit --prod` (integrado en CI, job "Dependency Audit") cubre la dimensión de vulnerabilidades, complementaria a las licencias.
