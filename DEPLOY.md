# 🚀 DESPLIEGUE — CONSTRURAMSA Control de Gastos

Guía completa para desplegar la aplicación en **Vercel** con **CI/CD** vía **GitHub Actions**.

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Despliegue en Vercel](#despliegue-en-vercel)
3. **CI/CD con GitHub Actions**](#cicd-con-github-actions)
4. [Variables de Entorno](#variables-de-entorno)
5. [Healthcheck Post-Despliegue](#healthcheck-post-despliegue)
6. [Troubleshooting](#troubleshooting)

---

## 1. Requisitos Previos

| Herramienta | Propósito |
|-------------|-----------|
| [GitHub](https://github.com) | Repositorio de código |
| [Vercel](https://vercel.com) | Hosting y despliegue automático |
| Node.js 20+ | Entiempo de ejecución local |

---

## 2. Despliegue en Vercel

La aplicación es estática (HTML/JS puro), por lo que no requiere build step.

### Paso 1: Conectar el repositorio

1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Haz clic en **Add New Project** → **Import Git Repository**
3. Busca y selecciona: `salazaroliveros-prog/construramsa_control`
4. Configura:
   - **Framework Preset:** Other (o dejar en blanco)
   - **Build Command:** (vacío — no hay build step)
   - **Output Directory:** `.` (punto, raíz del proyecto)
   - **Install Command:** (vacío)
5. Haz clic en **Deploy**

### Paso 2: Despliegue automático

El archivo `vercel.json` ya tiene configurado:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  }
}
```

Esto significa que **cada vez que hagas `push` a la rama `main`, Vercel desplegará automáticamente.**

### Paso 3: Verificar el despliegue

1. En el dashboard de Vercel, ve a tu proyecto
2. Ve a la pestaña **Deployments**
3. El despliegue más reciente debería mostrar estado **Ready**
4. Copia la URL de producción (ej: `https://construramsa-control.vercel.app`)
5. Abre la URL y verifica que la aplicación cargue correctamente

---

## 3. CI/CD con GitHub Actions

> ⚠️ **Nota:** Debido a restricciones de seguridad de GitHub, el archivo de workflow no puede subirse vía API con el token OAuth actual. Debes crearlo manualmente desde la interfaz web de GitHub.

### Paso 1: Crear el workflow de CI

1. Ve a tu repositorio en GitHub
2. Haz clic en la pestaña **Actions**
3. Haz clic en **"set up a workflow yourself"**
4. Reemplaza todo el contenido con el siguiente archivo y haz commit:

**Archivo:** `.github/workflows/ci.yml`

```yaml
name: CI — CONSTRURAMSA Control de Gastos

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Ejecutar lint
        run: npm run lint

      - name: Ejecutar format check
        run: npm run format:check

      - name: Ejecutar pruebas de unidad
        run: npm run test-adapter && npm run test-reports

      - name: Ejecutar pruebas de exportación (CSV/PDF/XLSX)
        run: npm run test-report-exports && npm run test-export-validation

      - name: Ejecutar pruebas de sincronización
        run: npm run test-sync-validation

      - name: Verificar build estático
        run: npm run build

      - name: Subir artefactos de validación
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: report-validation
          path: export_validation_results.json
          retention-days: 7
```

### Paso 2: Verificar que CI pasa en verde

1. En GitHub, ve a la pestaña **Actions**
2. Deberías ver el workflow ejecutándose en cada push
3. Todos los jobs deben mostrar ✅ (verde)
4. Si algún job falla, revisa los logs y corrige el error antes de seguir

---

## 4. Variables de Entorno

Copia `.env.example` a `.env` localmente y rellena los valores:

```bash
cp .env.example .env
```

### En Vercel (Variables de Entorno del Proyecto)

Ve a tu proyecto en Vercel → **Settings** → **Environment Variables** y agrega:

| Variable | Valor de ejemplo | Descripción |
|----------|-----------------|-------------|
| `OD_CLIENT_ID` | `tu_client_id` | Client ID de Microsoft Entra ID |
| `OD_CLIENT_SECRET` | `tu_secret` | Client Secret de Azure AD |
| `OD_REFRESH_TOKEN` | `tu_refresh_token` | Refresh token de OneDrive |
| `GAS_URL` | `https://script.google.com/...` | URL de Google Apps Script |
| `GAS_TOKEN` | `tu_token` | Token de Apps Script |
| `SYNC_ENABLED` | `true` | Habilitar sincronización automática |
| `SESSION_SECRET` | `minimo_32_caracteres` | Secreto para sesiones |

> ⚠️ **Nunca subas el archivo `.env` al repositorio.** Está en `.gitignore`.

---

## 5. Healthcheck Post-Despliegue

Después de cada despliegue, verifica que la aplicación esté funcionando:

```bash
# 1. Verificar que la URL responde
curl -I https://tu-proyecto.vercel.app

# 2. Verificar que la aplicación carga (código 200)
curl -s -o /dev/null -w "%{http_code}" https://tu-proyecto.vercel.app

# 3. Ejecutar pruebas de exportación localmente
npm run test-report-exports && npm run test-export-validation

# 4. Ejecutar pruebas de sincronización
npm run test-sync-validation
```

Expected output: `HTTP/2 200` y todos los tests pasando.

---

## 6. Scripts Disponibles

| Comando | Propósito |
|---------|-----------|
| `npm start` | Iniciar servidor local en puerto 3000 |
| `npm run lint` | Ejecutar ESLint |
| `npm run format:check` | Verificar formato con Prettier |
| `npm run test-adapter` | Pruebas del adaptador de datos |
| `npm run test-reports` | Pruebas de generación de reportes (9 tipos) |
| `npm run test-report-exports` | Generar artifacts CSV/PDF/XLSX reales |
| `npm run test-export-validation` | Validar integridad de archivos exportados |
| `npm run test-sync-validation` | Validar sincronización en la nube |
| `npm run build` | Verificar build estático (no-op) |
| `npm test` | Ejecutar suite completa de pruebas |

---

## 7. Estructura de Exportación

La aplicación genera 9 tipos de reporte en 3 formatos:

| Reporte | PDF | CSV | XLSX |
|---------|-----|-----|------|
| Diario | ✅ | ✅ | ✅ |
| Semanal | ✅ | ✅ | ✅ |
| Mensual | ✅ | ✅ | ✅ |
| Categoría | ✅ | ✅ | ✅ |
| Asistencia | ✅ | ✅ | ✅ |
| Nómina | ✅ | ✅ | ✅ |
| Viajes | ✅ | ✅ | ✅ |
| Mantenimiento | ✅ | ✅ | ✅ |
| Ejecutivo (KPIs) | ✅ | ✅ | ✅ |

Todos los PDF incluyen:
- ✅ Membres corporativo CONSTRURAMSA
- ✅ Márgenes uniformes (12mm, 16mm inferior)
- ✅ Numeración "Página X de Y" en todas las hojas
- ✅ Cabeceras de tabla repetitivas en páginas múltiples
- ✅ Firma digital (Jefe de Proyectos, Visto Bueno, Gerente Comercial)

Todos los CSV incluyen:
- ✅ BOM UTF-8 para compatibilidad con Excel
- ✅ Cabeceras descriptivas
- ✅ Protección contra inyección de fórmulas

Todos los XLSX incluyen:
- ✅ Múltiples hojas por reporte (Metadatos, datos, resumen)
- ✅ Ancho de columnas automático
- ✅ Formato de moneda con separador de miles

---

## 7. Troubleshooting

### El despliegue de Vercel falla

| Problema | Solución |
|----------|----------|
| Build fails | Verifica que `vercel.json` tenga `outputDirectory: "."` |
| 404 en rutas | El rewrite SPA ya está configurado en `vercel.json` |
| Variables no se aplican | Agrega las variables en Vercel Settings → Environment Variables y redeploy |

### GitHub Actions falla

| Problema | Solución |
|----------|----------|
| `npm ci` falla | Ejecuta `npm install` localmente y commitea `package-lock.json` |
| Lint falla | Ejecuta `npm run lint:fix` localmente |
| Tests fallan | Ejecuta `npm test` localmente y corrige errores |

### Sincronización OneDrive no funciona

| Problema | Solución |
|----------|----------|
| Token expirado | Renueva el token desde la app o configura `OD_REFRESH_TOKEN` |
| No conectado | Verifica `OD_CLIENT_ID` y `OD_CLIENT_SECRET` en Vercel Env Vars |
| Sin archivo latest | Sube manualmente un backup desde la app (Exportar JSON) |

---

## 8. Contacto

**CONSTRURAMSA — Soluciones en Ingeniería y Arquitectura**  
📧 contacto@construramsa.com  
🌐 construramsa.com  
📱 +502 5997 9501
