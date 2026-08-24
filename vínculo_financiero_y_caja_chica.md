Vínculo Financiero y Caja Chica (Lógica de Descuento Automático)La aplicación debe verificar que haya fondos suficientes en la caja chica antes de permitir registrar cualquier gasto en los otros módulos (combustible, repuestos o materiales).

// Función global para verificar saldo y restar de Caja Chica
function procesarGastoCajaChica(monto, categoria, descripcion) {
    const db = JSON.parse(localStorage.getItem('construramsa_db')) || {};
    
    // 1. Calcular el saldo actual disponible
    let saldoActual = db.configuracion.presupuesto_inicial_caja || 0;
    db.caja_chica.forEach(movimiento => {
        if (movimiento.tipo === 'ingreso') saldoActual += movimiento.monto;
        if (movimiento.tipo === 'egreso') saldoActual -= movimiento.monto;
    });

    // 2. Validar si hay fondos
    if (monto > saldoActual) {
        alert(`❌ Fondos insuficientes en Caja Chica. Saldo disponible: $${saldoActual.toFixed(2)}. El gasto de $${monto.toFixed(2)} no puede procesarse.`);
        return false; // Detiene el guardado en el módulo correspondiente
    }

    // 3. Registrar automáticamente el egreso en el módulo de Caja Chica
    db.caja_chica.push({
        id: "caja-" + Date.now(),
        fecha: new Date().toISOString().split('T')[0],
        tipo: "egreso",
        categoria: categoria, // Ej: "Combustible", "Materiales", "Repuestos"
        descripcion: descripcion,
        monto: monto,
        responsable: "Sistema Automático"
    });

    localStorage.setItem('construramsa_db', JSON.stringify(db));
    return true; // Permite continuar con el guardado
}

Módulo de Proveedores y Comparativa de Cotizaciones (HTML/UI)Este módulo evalúa las cotizaciones antes de convertirlas en compras reales afectando la caja chica:

<div class="tarjeta-glass" id="modulo-adquisiciones">
    <h2 style="color: var(--acento-cian); margin-top: 0;">📋 Adquisiciones y Cotizaciones</h2>
    
    <!-- Formulario de Registro de Cotización -->
    <form id="form-cotizacion" style="margin-bottom: 25px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label>Proveedor</label>
                <select id="cot-proveedor" required>
                    <!-- Se llena dinámicamente desde el directorio de proveedores -->
                    <option value="prov-01">Materiales El Progreso</option>
                    <option value="prov-02">Ferretería Central</option>
                </select>
            </div>
            <div>
                <label>Material / Insumo</label>
                <input type="text" id="cot-material" placeholder="Ej: 50 sacos de Cemento" required>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label>Precio Unitario ($)</label>
                <input type="number" step="0.01" id="cot-precio" required>
            </div>
            <div>
                <label>Cantidad</label>
                <input type="number" id="cot-cantidad" required>
            </div>
        </div>
        <button type="submit" class="btn-primario" style="width: 100%;">📊 Registrar Cotización</button>
    </form>

    <!-- CUADRO COMPARATIVO / TABLA DE DECISIONES DE COMPRA -->
    <h3 style="color: var(--texto-principal); font-size: 16px;">🔍 Cuadro Comparativo de Ofertas</h3>
    <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="border-bottom: 2px solid var(--glass-border);">
                    <th style="padding: 10px; text-align: left;">Material</th>
                    <th style="padding: 10px; text-align: left;">Proveedor</th>
                    <th style="padding: 10px; text-align: right;">Total ($)</th>
                    <th style="padding: 10px; text-align: center;">Estado</th>
                    <th style="padding: 10px; text-align: center;">Acción</th>
                </tr>
            </thead>
            <tbody id="tabla-cotizaciones-cuerpo">
                <!-- Ejemplo Renderizado por JS con Glasmorphism -->
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px;">Varillas de Hierro 3/8</td>
                    <td style="padding: 10px; color: var(--texto-secundario);">Ferretería Central</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">$420.00</td>
                    <td style="padding: 10px; text-align: center;"><span style="color: #f59e0b;">Pendiente</span></td>
                    <td style="padding: 10px; text-align: center;">
                        <!-- Al hacer clic, aprueba, descuenta de caja chica y genera la orden -->
                        <button class="btn-primario" style="padding: 4px 8px; font-size: 11px; background: var(--exito);">Aprobar y Comprar</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>


Motor de Agrupación de Tiempos (Lógica de Reportes Semanales)Para cumplir con la solicitud exacta de agrupar informes de Lunes a Domingo, JavaScript necesita calcular dinámicamente los rangos de fechas de la semana en ejecución:

// Obtiene el rango de fechas (Lunes a Domingo) de la semana de una fecha dada
function obtenerRangoSemana(fechaInput) {
    const fecha = new Date(fechaInput + 'T00:00:00');
    const diaSemana = fecha.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    
    // Ajustar para que el Lunes sea el primer día (1) y Domingo el último (7)
    const distanciaAlLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    
    const lunes = new Date(fecha);
    lunes.setDate(fecha.getDate() + distanciaAlLunes);
    
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    
    // Formato YYYY-MM-DD para filtrar el LocalStorage
    return {
        inicio: lunes.toISOString().split('T')[0],
        fin: domingo.toISOString().split('T')[0]
    };
}

// Filtrar la base de datos para el informe semanal
function generarInformeSemanal(fechaCualquieraDeLaSemana) {
    const rango = obtenerRangoSemana(fechaCualquieraDeLaSemana);
    const db = JSON.parse(localStorage.getItem('construramsa_db')) || {};
    
    // Filtrar transacciones entre el Lunes (rango.inicio) y Domingo (rango.fin)
    const gastosSemanales = db.caja_chica.filter(g => g.fecha >= rango.inicio && g.fecha <= rango.fin);
    const maquinasSemanales = db.maquinaria_flota.registros.filter(m => m.fecha >= rango.inicio && m.fecha <= rango.fin);
    const asistenciaSemanal = db.personal.asistencia.filter(a => a.fecha >= rango.inicio && a.fecha <= rango.fin);

    // Con estos tres arreglos limpios, JS construye las tablas consolidadas del membrete de impresión
    console.log(`Informe procesado desde el lunes ${rango.inicio} hasta el domingo ${rango.fin}`);
    return { gastosSemanales, maquinasSemanales, asistenciaSemanal, rango };
}


Prompt Maestro Definitivo (Completo y Corregido)Pega este bloque de texto consolidado en tu agente de VS Code. Incluye de forma estricta todo lo solicitado y lo corregido para garantizar el éxito total del desarrollo:

Actúa como un Ingeniero de Software Senior y Experto en UI/UX Frontend. Compila una aplicación PWA en un único archivo index.html autocontenido, completamente funcional offline mediante LocalStorage. El sistema debe gestionar el control de gastos de una obra de construcción activa.

1. IDENTIDAD CORPORATIVA (GLASMORPHISM PREMIUM)
- Empresa: CONSTRURAMSA
- Eslogan: SOLUCIONES EN INGENIERÍA Y ARQUITECTURA
- Estilo: Tema oscuro moderno (#090a0f). Elementos flotantes translúcidos con la clase '.tarjeta-glass' (background: rgba(20,24,35,0.45); backdrop-filter: blur(16px);) y bordes con sutiles degradados en Azul Cian (#00A4E4), Azul Eléctrico (#004B93) y Púrpura (#6F2DBD).
- Logotipo Dinámico: Campo de configuración para cargar imagen local (guardada en Base64). El logo debe aparecer fijo en el header de la app y automáticamente en el encabezado/membrete de impresión de los reportes.

2. ARQUITECTURA MODULAR DE DATOS E INTERFAZ (Mobile-First y Desktop)
Diseña formularios interactivos y tablas dinámicas para los siguientes módulos:
- Caja Chica: Registro de ingresos y balance de caja. Validación obligatoria en tiempo real: ningún gasto de otros módulos puede procesarse si supera el saldo disponible de caja chica. Cada compra aprobada debe restar fondos de este saldo automáticamente.
- Maquinaria y Flota: Registro para Retroexcavadoras (Métrica de Horómetro/Horas) y Camiones de Volteo (Métrica de Odómetro/Kilómetros). Captura automática vía 'oninput' para calcular horas/km trabajados, galones consumidos, precio por galón, rendimiento operativo y bitácora de mantenimientos o repuestos con su costo.
- Personal, Asistencia y Horas Extra: Formato de pase de lista diario mediante tarjetas individuales compactas optimizadas para celular. Lógica matemática nativa para calcular el sueldo del día (Jornada base de 8 horas * Tarifa normal) + (Cantidad de horas extra * Tarifa extra). Acumulador para nómina semanal de Lunes a Domingo.
- Adquisiciones y Proveedores: Catálogo de proveedores con teléfono y especialidad. Cuadro comparativo de cotizaciones de materiales con botones de acción para cambiar estado a 'Aprobada' (lo que efectúa el egreso en Caja Chica) o 'Rechazada'.

3. MOTOR DE REPORTES E INTEGRACIÓN CON WHATSAPP
Desarrolla una plantilla HTML oculta y optimizada para impresión (Fondo blanco absoluto #ffffff, textos negros, alta legibilidad). Al presionar el botón "Enviar por WhatsApp", el sistema utilizará la API 'navigator.share' para compilar en segundo plano y adjuntar en el mensaje de WhatsApp o correo electrónico dos archivos reales adjuntos listos para imprimir:
- Un archivo estructurado de datos (.CSV).
- Un documento visual profesional (.PDF) utilizando la librería html2pdf.js desde CDN, el cual debe integrar rigurosamente el membrete de CONSTRURAMSA, su eslogan, la fecha de emisión, las firmas de responsabilidad al pie de página y el logotipo cargado a la izquierda.
Opciones de reportes: Reporte Diario de Gastos, Informe Semanal Consolidado (Lunes a Domingo), Reporte de Asistencia Diario y Semanal con desglose de Horas Extra.

4. RESPALDO Y COMPILACIÓN
Añade botones para "Exportar Base de Datos JSON" e "Importar Base de Datos JSON" para compartir la información completa de la app entre dispositivos móviles o computadoras. Entrega todo el código HTML, CSS y JavaScript estructurado, modularizado y exhaustivamente comentado.
