# 01 · Preparación de la Plataforma e Infraestructura

**Proyecto:** JADDA SPORTS
**Documento:** Verificación de cumplimiento de características mínimas de hardware y software
**Fecha de verificación:** 2026-08-24 (valores medidos en la máquina de producción local)

---

## 1. Alcance

La solución se despliega **en ambiente local con Docker Compose** (decisión de implantación): tres contenedores — base de datos MySQL 8, backend Express/Node y frontend Vite. Este documento verifica que el equipo anfitrión cumple los requisitos mínimos para ejecutarlos.

## 2. Requisitos de hardware

| Recurso | Mínimo requerido | Equipo de producción | ¿Cumple? |
|---------|------------------|----------------------|----------|
| Procesador | 4 núcleos (virtualización activa) | Intel Core i5-11400H — **6 núcleos / 12 hilos** @ 2.70 GHz | ✅ |
| Memoria RAM | 8 GB (Docker Desktop + 3 contenedores) | **23,8 GB** totales (7,6 GB libres en operación) | ✅ |
| Disco disponible | 20 GB (imágenes Docker ~2 GB + volumen BD + imágenes del catálogo) | **124,3 GB libres** de 475,6 GB | ✅ |
| Red | Conexión local LAN para clientes móviles | Wi-Fi/Ethernet estándar | ✅ |

## 3. Requisitos de software

| Componente | Versión mínima | Instalado / verificado | ¿Cumple? |
|------------|----------------|------------------------|----------|
| Sistema operativo anfitrión | Windows 10 64-bit (WSL2) | **Windows 11 Home** build 10.0.26200 | ✅ |
| Docker Engine | ≥ 24 | **Docker version 29.5.2** | ✅ |
| Docker Compose | v2.x | **v5.1.3** | ✅ |
| Motor de base de datos | MySQL 8.0 | **mysql:8.0 → 8.0.46** (contenedor `jadda_mysql`) | ✅ |
| Runtime backend | Node.js ≥ 18 | **Node v22.23.0** dentro del contenedor (`jadda_backend`) | ✅ |
| Gestor de paquetes backend | pnpm ≥ 8 | **pnpm 11.8.0** | ✅ |
| Servidor frontend | Node/Vite 5+ (build y preview) | Vite dentro de `jadda_frontend` (build `pnpm build` verificado en cada despliegue) | ✅ |
| App móvil (opcional) | Expo Go SDK 54 / Android | Código en `movil/`; no requerido para el despliegue web | ➖ |

## 4. Verificación de servicios y puertos

Contenedores al momento de la verificación:

```
NAMES            STATUS        PORTS
jadda_frontend   Up 2 days     0.0.0.0:5173->5173/tcp
jadda_backend    Up 2 days     0.0.0.0:5000->5000/tcp
jadda_mysql      Up 2 days     0.0.0.0:3306->3306/tcp
```

Puertos en escucha confirmados en el anfitrión:

| Puerto | Servicio | Estado |
|--------|----------|--------|
| 3306 | MySQL (solo administración; no exponer fuera de la LAN) | ✅ Escuchando |
| 5000 | API Express | ✅ Escuchando |
| 5173 | Frontend web (acceso de usuarios) | ✅ Escuchando |

## 5. Compatibilidad de clientes

| Cliente | Navegador/SO mínimo | Verificado |
|---------|--------------------|------------|
| Web escritorio | Chrome/Edge/Firefox actuales (ES2020+) | ✅ Pruebas E2E con Playwright sobre Chrome a 1440px |
| Web móvil responsive | Chrome Android / Safari iOS | ✅ Pruebas a 375px sin overflow horizontal |
| App móvil | Android 8+ vía Expo Go o APK | ✅ Compilación JS verificada (TypeScript sin errores) |

## 6. Riesgos de plataforma identificados

| Riesgo | Mitigación |
|--------|-----------|
| Virtualización (VT-x) deshabilitada en BIOS → Docker no arranca | Verificar `wsl --status`; habilitar VT-x en BIOS |
| Puertos 3306/5000/5173 ocupados por otro servicio | Liberar puerto o cambiar mapeo en `docker-compose.yml` |
| Apagado brusco del equipo → volumen MySQL corrupto | Respaldos diarios (02-plan-migracion-respaldos.md); `restart: always` reinicia contenedores |
| Espacio en disco consumido por respaldos e imágenes Docker | Rotación automática de backups (7 días); `docker system prune` periódico |

## 7. Conclusión

El equipo de producción **cumple holgadamente** los requisitos mínimos de hardware y software para ejecutar la plataforma JADDA SPORTS en su modalidad de despliegue local con Docker.
