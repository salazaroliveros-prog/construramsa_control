# Pendientes de implementación

## Prioridad crítica

- Implementar autenticación real con un proveedor de identidad y autorización por rol/proyecto. Actualmente la aplicación funciona como PWA local y guarda la información en `localStorage`.
- Migrar la persistencia a una API/base de datos compartida con control de concurrencia, auditoría y respaldo centralizado.
- Sustituir el almacenamiento local de credenciales o tokens por un flujo OAuth seguro gestionado en servidor.

## Prioridad alta

- Verificar en Vercel las variables de entorno, dominio, protección de ramas y estado de los despliegues automáticos.

## Mejoras futuras

- Incorporar edición y eliminación con auditoría de usuario, fecha y motivo.
- Añadir sincronización con resolución de conflictos para trabajo simultáneo desde varios dispositivos.
- Mejorar accesibilidad con una auditoría WCAG completa, navegación por teclado y pruebas con lector de pantalla.
- Añadir monitoreo de errores, métricas de rendimiento y alertas de fallos de sincronización/exportación.
- Añadir paginación y virtualización para datasets grandes.

## Estado de esta entrega

- Navegación, validaciones de formularios, vínculos contables, escape XSS, exportaciones PDF/CSV/XLSX offline y pruebas smoke fueron corregidos o reforzados.
- La suite E2E CRUD cubre los módulos operativos, configuración e importación/fusión JSON; GitHub Actions ejecuta `npm test` con Chromium.
- Vercel incorpora políticas CSP y Permissions-Policy; falta confirmar el deployment remoto después del push.
- El despliegue automático debe confirmarse mediante el primer push a GitHub y el estado del deployment asociado en Vercel.

## Auditoría de consistencia (implementada)

- **`check_versions.js`** (`npm run audit:versions`): valida que la versión de `package.json` esté alineada en `index.html` (APP_VERSION, `db.version` en inicializarDB/migrarDB, UI "Versión:"), `sw.js` (CACHE_NAME, cabecera) y `manifest.json`.
- **`check_assets.js`** (`npm run audit:assets`): verifica que todos los recursos locales referenciados en `sw.js` (precache), `manifest.json` (iconos) e `index.html` (src/href estáticos) existan en el repositorio.
- `npm test` ahora ejecuta `npm run audit` (versiones + assets) antes de la suite E2E, por lo que GitHub Actions también valida consistencia e integridad en cada push.
- Tokens OIDC locales (`.env.local`) quedan fuera del repositorio y se eliminaron del entorno local de desarrollo (higiene).
