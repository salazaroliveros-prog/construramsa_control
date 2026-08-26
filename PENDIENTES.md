# Pendientes de implementación

## Prioridad crítica

- Implementar autenticación real con un proveedor de identidad y autorización por rol/proyecto. Actualmente la aplicación funciona como PWA local y guarda la información en `localStorage`.
- Migrar la persistencia a una API/base de datos compartida con control de concurrencia, auditoría y respaldo centralizado.
- Sustituir el almacenamiento local de credenciales o tokens por un flujo OAuth seguro gestionado en servidor.

## Prioridad alta

- Hospedar las librerías de exportación PDF/XLSX o incorporar una estrategia de carga offline para que las exportaciones no dependan del CDN.
- Añadir pruebas E2E para todos los formularios de mantenimiento, insumos, personal, viajes, configuración y restauración/importación.
- Configurar CI en GitHub para ejecutar pruebas, análisis estático y validación antes de aceptar cambios en `main`.
- Verificar en Vercel las variables de entorno, dominio, protección de ramas y estado de los despliegues automáticos.

## Mejoras futuras

- Incorporar edición y eliminación con auditoría de usuario, fecha y motivo.
- Añadir sincronización con resolución de conflictos para trabajo simultáneo desde varios dispositivos.
- Mejorar accesibilidad con una auditoría WCAG completa, navegación por teclado y pruebas con lector de pantalla.
- Añadir monitoreo de errores, métricas de rendimiento y alertas de fallos de sincronización/exportación.
- Añadir paginación y virtualización para datasets grandes.

## Estado de esta entrega

- Navegación, validaciones de formularios, vínculos contables, escape XSS, exportación CSV y pruebas smoke fueron corregidos o reforzados.
- El despliegue automático debe confirmarse mediante el primer push a GitHub y el estado del deployment asociado en Vercel.
