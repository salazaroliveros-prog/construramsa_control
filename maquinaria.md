Perfecto. Vamos a detallar la lógica matemática y estructural del Módulo de Maquinaria y Flota. Este módulo es crítico porque maneja variables operativas (horas de motor y odómetros) cruzadas con variables financieras (costos de combustible y mantenimiento).Al trabajar con LocalStorage, calcularemos los rendimientos en tiempo real de forma nativa para que se guarden optimizados en tu base de datos JSON.

Lógica del Módulo de Maquinaria y Flota1. Fórmulas Matemáticas y Cálculos AutomáticosPara evitar errores humanos en la obra, el usuario solo ingresará los datos básicos y la aplicación calculará automáticamente:Horas Trabajadas: Horómetro Final - Horómetro InicialRendimiento de Combustible: \(\frac{\text{Horas\ Trabajadas}}{\text{Galones\ Consumidos}}\) (Horas por galón para maquinaria pesada) o \(\frac{\text{Kilómetros Recorridos}}{\text{Galones\ Consumidos}}\) (para camiones de volteo).Costo Total de Combustible: Galones × Precio por GalónGasto Operativo Total del Día: Costo Combustible + Costo Mantenimiento

Código JavaScript para la Lógica de CálculosInyecta este bloque de funciones en la lógica de control de tu aplicación para procesar los formularios de maquinaria:

// Función para calcular campos en tiempo real mientras el usuario escribe en el formulario
function calcularMetricasMaquinaria() {
    const tipoVehiculo = document.getElementById('maq-tipo').value; // "retroexcavadora" o "camion"
    const valInicial = parseFloat(document.getElementById('maq-val-inicial').value) || 0;
    const valFinal = parseFloat(document.getElementById('maq-val-final').value) || 0;
    const galones = parseFloat(document.getElementById('maq-galones').value) || 0;
    const precioGalon = parseFloat(document.getElementById('maq-precio-galon').value) || 0;
    const costoMantenimiento = parseFloat(document.getElementById('maq-costo-mantenimiento').value) || 0;

    // 1. Calcular uso (Horas o Kilómetros)
    const usoTotal = valFinal - valInicial;
    if (usoTotal < 0) {
        // Validación por si el valor final es menor al inicial
        document.getElementById('maq-error-uso').innerText = "El valor final no puede ser menor al inicial";
        return;
    } else {
        document.getElementById('maq-error-uso').innerText = "";
    }

    // 2. Calcular costos de combustible
    const costoCombustibleTotal = galones * precioGalon;

    // 3. Calcular rendimiento
    let rendimiento = 0;
    if (galones > 0) {
        rendimiento = usoTotal / galones; // Hrs/Galón o Km/Galón
    }

    // 4. Calcular Gasto Total del registro
    const gastoTotalRegistro = costoCombustibleTotal + costoMantenimiento;

    // 5. Pintar resultados en la interfaz de forma dinámica
    document.getElementById('lbl-uso-total').innerText = usoTotal.toFixed(2) + (tipoVehiculo === 'retroexcavadora' ? ' Hrs' : ' Km');
    document.getElementById('lbl-costo-combustible').innerText = '$' + costoCombustibleTotal.toFixed(2);
    document.getElementById('lbl-rendimiento').innerText = rendimiento.toFixed(2) + (tipoVehiculo === 'retroexcavadora' ? ' Hrs/Gal' : ' Km/Gal');
    document.getElementById('lbl-gasto-total').innerText = '$' + gastoTotalRegistro.toFixed(2);
}

Maqueta del Formulario con Estilo GlasmorphicEste es el bloque HTML que tu agente de VS Code utilizará para estructurar visualmente el formulario adaptado a dispositivos móviles:

<div class="tarjeta-glass" id="modulo-maquinaria">
    <h2 style="color: var(--acento-cian); margin-top: 0;">🚜 Control de Maquinaria y Flota</h2>
    <p style="color: var(--texto-secundario); font-size: 13px;">Registra el uso, consumo de combustible y mantenimiento de las unidades.</p>
    
    <form id="form-maquinaria" oninput="calcularMetricasMaquinaria()">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label>Tipo de Unidad</label>
                <select id="maq-tipo" required>
                    <option value="retroexcavadora">Retroexcavadora (Horas)</option>
                    <option value="camion">Camión de Volteo (Km)</option>
                </select>
            </div>
            <div>
                <label>Código/Placa</label>
                <input type="text" id="maq-codigo" placeholder="Ej: RETRO-01" required>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label id="lbl-inicial">Horómetro/Odómetro Inicial</label>
                <input type="number" step="0.1" id="maq-val-inicial" required>
            </div>
            <div>
                <label id="lbl-final">Horómetro/Odómetro Final</label>
                <input type="number" step="0.1" id="maq-val-final" required>
            </div>
        </div>
        <span id="maq-error-uso" style="color: var(--alerta); font-size: 12px; display: block; margin-top: -10px; margin-bottom: 10px;"></span>

        <h3 style="color: var(--acento-purpura); font-size: 16px; border-bottom: 1px solid var(--glass-border); padding-bottom: 5px;">⛽ Combustible y Suministros</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label>Galones Suministrados</label>
                <input type="number" step="0.01" id="maq-galones" value="0">
            </div>
            <div>
                <label>Precio por Galón</label>
                <input type="number" step="0.01" id="maq-precio-galon" value="0">
            </div>
        </div>

        <h3 style="color: var(--acento-purpura); font-size: 16px; border-bottom: 1px solid var(--glass-border); padding-bottom: 5px;">🔧 Mantenimiento y Repuestos</h3>
        <div style="margin-bottom: 15px;">
            <label>Detalles del Mantenimiento / Piezas Cambiadas</label>
            <textarea id="maq-mantenimiento-detalles" rows="2" placeholder="Ej: Cambio de aceite hidráulico, filtro de motor..."></textarea>
        </div>
        <div style="margin-bottom: 20px;">
            <label>Costo del Mantenimiento ($)</label>
            <input type="number" step="0.01" id="maq-costo-mantenimiento" value="0">
        </div>

        <!-- PANEL DE CÁLCULO EN TIEMPO REAL (DISEÑO CRISTALIZADO DE PREVISUALIZACIÓN) -->
        <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--acento-cian); border-radius: 8px; padding: 15px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
            <div>Trabajado: <strong id="lbl-uso-total" style="color: var(--acento-cian);">0.00</strong></div>
            <div>Costo Combustible: <strong id="lbl-costo-combustible">$0.00</strong></div>
            <div>Rendimiento: <strong id="lbl-rendimiento" style="color: var(--exito);">0.00</strong></div>
            <div>Gasto Total: <strong id="lbl-gasto-total" style="color: #fff; font-size: 14px;">$0.00</strong></div>
        </div>

        <button type="submit" class="btn-primario" style="width: 100%;">💾 Guardar Registro de Maquinaria</button>
    </form>
</div>


Instrucción Adicional para enviar a tu Agente de VS Code:Cuando pegues el prompt maestro que armamos en el paso anterior, añade este párrafo final para asegurar que la lógica de la maquinaria quede exactamente como la necesitas:"Para el Módulo de Maquinaria y Flota, implementa la lógica dinámica de captura donde los campos de uso (Horas o Kilómetros), costos de combustible y rendimientos operativos se calculen en tiempo real utilizando eventos oninput en el formulario. Clasifica de manera estricta si el vehículo es una Retroexcavadora (métrica en Horas) o un Camión de Volteo (métrica en Kilómetros) tanto en la base de datos local como en los reportes imprimibles en PDF."