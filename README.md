# CONSTRURAMSA - Control de Obra

Aplicación Web Progresiva (PWA) para el control de gastos y gestión de obra de CONSTRURAMSA.

## Características

- **100% Offline**: Funciona completamente sin conexión a internet usando LocalStorage
- **Diseño Glasmorphism Premium**: Interfaz moderna con efectos de cristal y paleta de colores corporativa
- **Sistema Monetario en Quetzales (Q)**: Todos los montos expresados en moneda nacional de Guatemala
- **Módulos Completos**:
  - 💰 Caja Chica e Insumos con validación de saldo
  - 🚜 Maquinaria y Flota con cálculos automáticos de rendimiento
  - 👷 Personal, Asistencia y Nómina con cálculo de horas extra
  - 📋 Adquisiciones y Proveedores con cotizaciones
- **Reportes Profesionales**: Generación de PDF y CSV con membrete corporativo
- **Compartir por WhatsApp**: Integración con Web Share API para enviar reportes
- **Respaldo de Datos**: Exportación e importación de base de datos JSON
- **Integración con JSON Existente**: Compatibilidad completa con `construramsa_db.json`

## Instalación

### Requisitos
- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Para instalación como app: Android 5+ o iOS 11.3+

### Instalación como PWA
1. Abra la aplicación en su navegador
2. En Android: Tap en "Agregar a pantalla de inicio"
3. En iOS: Tap en el botón de compartir y luego "Agregar a pantalla de inicio"

## Iconos

La aplicación utiliza el archivo `icon.svg` como icono principal. Este archivo se usa tanto para:
- Icono de la pestaña del navegador
- Icono de la aplicación instalada como PWA
- Logo en los reportes generados

## Uso

### Configuración Inicial
1. **Datos Existente**: Si existe el archivo `construramsa_db.json`, la aplicación lo cargará automáticamente
2. **Configuración**: Configure el presupuesto inicial de caja chica en el módulo de Configuración
3. **Logo**: El icono `icon.svg` se carga automáticamente para la app y reportes
4. **Personal**: Agregue trabajadores al catálogo en el módulo de Personal
5. **Proveedores**: Registre proveedores en el módulo de Adquisiciones

### Flujo de Trabajo
1. **Caja Chica**: Registre ingresos (aperturas) y egresos diarios en Quetzales (Q)
2. **Maquinaria**: Registre uso de equipo, combustible y mantenimiento
3. **Personal**: Realice el pase de lista diario y registre horas extra
4. **Adquisiciones**: Registre y apruebe cotizaciones de materiales
5. **Reportes**: Genere y comparta reportes por WhatsApp o correo

## Estructura de Archivos

- `index.html` - Aplicación principal (contiene HTML, CSS y JavaScript)
- `icon.svg` - Icono corporativo de CONSTRURAMSA
- `construramsa_db.json` - Base de datos inicial existente (se carga automáticamente)
- `manifest.json` - Configuración de la PWA
- `sw.js` - Service Worker para funcionalidad offline
- `generar-iconos.html` - Herramienta para generar iconos PWA alternativos
- `README.md` - Este archivo de documentación

## Estructura de Base de Datos

La aplicación utiliza la siguiente estructura de datos (compatible con `construramsa_db.json`):

```json
{
  "configuracion": {
    "nombre_empresa": "CONSTRURAMSA",
    "eslogan": "SOLUCIONES EN INGENIERÍA Y ARQUITECTURA",
    "logo_base64": "",
    "presupuesto_inicial_caja": 0
  },
  "caja_chica": [],
  "maquinaria_flota": {
    "vehiculos": [],
    "registros": []
  },
  "personal": {
    "trabajadores": [],
    "asistencia": []
  },
  "adquisiciones": {
    "proveedores": [],
    "cotizaciones_compras": []
  }
}
```

## Tecnologías

- HTML5, CSS3, JavaScript (ES6+)
- LocalStorage para persistencia de datos
- html2pdf.js para generación de PDF
- Web Share API para compartir archivos
- Service Workers para funcionalidad offline
- Sistema de migración automática para compatibilidad con datos existentes

## Sistema Monetario

**Todos los montos están expresados en Quetzales (Q)**, la moneda nacional de Guatemala:
- Formato: Q0.00 (ejemplo: Q150.50)
- Aplicado en: Caja chica, maquinaria, nómina, adquisiciones y reportes
- Reportes CSV y PDF incluyen indicador de moneda (Q)

## Respaldo de Datos

La aplicación incluye funciones para:
- **Exportar**: Descargar toda la base de datos en formato JSON
- **Importar con Fusión**: Fusionar datos importados con los existentes sin perder información histórica
- **Carga Automática**: Si existe `construramsa_db.json`, se carga al iniciar la app

### Flujo de Trabajo de Campo a Oficina

**Desde el Campo:**
1. Trabajador de campo registra datos del día (caja chica, maquinaria, asistencia, etc.)
2. Exporta la base de datos JSON mediante el botón "📤 Exportar JSON"
3. Comparte el archivo por WhatsApp o correo electrónico

**En la Oficina:**
1. Persona en oficina recibe el archivo JSON
2. Importa el archivo mediante el botón "📥 Importar JSON"
3. **El sistema fusiona automáticamente** los datos:
   - Nuevos registros se agregan
   - Registros existentes se actualizan
   - **Datos de días anteriores se conservan** (no se reemplazan)
4. Los datos de campo y oficina quedan consolidados

### Estrategia de Fusión de Datos

El sistema de importación utiliza una estrategia de fusión inteligente:

- **Caja Chica**: Fusiona por ID único
- **Maquinaria**: Fusiona vehículos y registros por ID
- **Personal**: Fusiona catálogo de trabajadores por ID
- **Asistencia**: Fusiona por fecha + trabajador_id (evita duplicados del mismo día)
- **Proveedores**: Fusiona por ID
- **Cotizaciones**: Fusiona por ID

**Beneficios:**
- ✅ No se pierde información de días anteriores
- ✅ Múltiples trabajadores pueden enviar datos simultáneamente
- ✅ Los datos se consolidan automáticamente sin conflictos
- ✅ Permite colaboración entre campo y oficina

Se recomienda realizar respaldos regularmente y compartirlos por WhatsApp para redundancia.

## Migración y Compatibilidad

La aplicación incluye un sistema de migración automática que:
- Mantiene compatibilidad con estructuras de datos antiguas
- Actualiza automáticamente la base de datos al formato más reciente
- Preserva todos los datos existentes durante las migraciones
- Soporta tanto el formato nuevo como el antiguo de `construramsa_db.json`

## Soporte

Para soporte técnico o reporte de problemas, contacte al equipo de desarrollo de CONSTRURAMSA.

---

**Versión**: 1.0.0  
**Desarrollado para**: CONSTRURAMSA - Soluciones en Ingeniería y Arquitectura  
**Moneda**: Quetzales (Q) - Guatemala