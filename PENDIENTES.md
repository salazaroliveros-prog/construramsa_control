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
