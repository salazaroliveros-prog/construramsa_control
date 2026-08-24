El Módulo de Personal, Asistencia y Horas Extra requiere precisión matemática y una interfaz muy ágil, ya que en la obra el pase de lista debe hacerse de forma rápida (generalmente en un dispositivo móvil) [LOCAL].Calcularemos automáticamente el salario diario devengado sumando el costo de las horas normales trabajadas y el costo de las horas extra, cruzando los datos con el catálogo de tarifas de cada trabajador.

 Lógica del Módulo de Personal y Asistencia1. Fórmulas de Cálculo AutomatizadoCada vez que se registre la asistencia de un trabajador, el sistema computará:Pago por Horas Normales: Si el estado es "Asistió", se asume la jornada estándar de la empresa (ej. 8 horas).\(\text{Pago\ Normal}=8\times \text{Tarifa\ Hora\ Normal}\)Pago por Horas Extra:\(\text{Pago\ Extra}=\text{Cantidad\ Horas\ Extra}\times \text{Tarifa\ Hora\ Extra}\)Sueldo Diario Total:\(\text{Sueldo\ Diario}=\text{Pago\ Normal}+\text{Pago\ Extra}\)Nómina Semanal: Sumatoria de los sueldos diarios de Lunes a Domingo para cada trabajador.

Código JavaScript para Procesar Asistencia y NóminaEste bloque se encarga de estructurar el pase de lista y guardar las métricas monetarias calculadas de forma limpia en el JSON local:

// Función para procesar y guardar la asistencia del día
function guardarAsistenciaDiaria(fechaSeleccionada) {
    const db = JSON.parse(localStorage.getItem('construramsa_db')) || {};
    const listaTrabajadores = db.personal?.trabajadores || [];
    
    // Estructura del registro diario
    const registroDia = {
        fecha: fechaSeleccionada,
        registros: []
    };

    listaTrabajadores.forEach(trabajador => {
        const estadoInput = document.querySelector(`input[name="asistencia-${trabajador.id}"]:checked`).value; // "asistio", "falto", "justificado"
        const horasExtraInput = parseFloat(document.getElementById(`horas-extra-${trabajador.id}`).value) || 0;
        
        let pagoNormal = 0;
        let pagoExtra = 0;

        // Si asistió, calcula el sueldo del día basándose en una jornada base de 8 horas
        if (estadoInput === "asistio") {
            pagoNormal = 8 * (parseFloat(trabajador.pago_hora_normal) || 0);
            pagoExtra = horasExtraInput * (parseFloat(trabajador.pago_hora_extra) || 0);
        }

        const totalSueldoDiario = pagoNormal + pagoExtra;

        // Inyectamos el desglose calculado al JSON
        registroDia.registros.push({
            trabajador_id: trabajador.id,
            nombre: trabajador.nombre,
            puesto: trabajador.puesto,
            estado: estadoInput,
            horas_extras_cantidad: horasExtraInput,
            calculos: {
                pago_normal: pagoNormal,
                pago_extra: pagoExtra,
                total_diario: totalSueldoDiario
            }
        });
    });

    // Guardar o actualizar en el histórico de asistencia
    if (!db.personal.asistencia) db.personal.asistencia = [];
    
    // Evitar duplicados eliminando si ya existía la fecha antes de guardarla de nuevo
    db.personal.asistencia = db.personal.asistencia.filter(a => a.fecha !== fechaSeleccionada);
    db.personal.asistencia.push(registroDia);
    
    localStorage.setItem('construramsa_db', JSON.stringify(db));
    alert(`Asistencia del día ${fechaSeleccionada} guardada y calculada con éxito.`);
}


Maqueta de la Interfaz del Pase de Lista (Mobile-First)Para entornos móviles, una tabla tradicional es difícil de usar. Romperemos el diseño en tarjetas compactas listas para usar en obra con un solo toque:

<div class="tarjeta-glass" id="modulo-asistencia">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="color: var(--acento-cian); margin: 0;">👷 Control de Asistencia y Nómina</h2>
        <!-- Selector de fecha nativo -->
        <input type="date" id="fecha-asistencia" style="width: auto; padding: 6px 12px;" value="2026-08-24">
    </div>

    <!-- Contenedor dinámico donde se listarán los trabajadores -->
    <div id="lista-asistencia-dinamica" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
        
        <!-- Ejemplo de Tarjeta de Empleado (Se replica dinámicamente con JS) -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 12px; padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div>
                    <h4 style="margin: 0; font-size: 15px; color: #fff;">Juan Pérez</h4>
                    <span style="font-size: 11px; color: var(--texto-secundario);">Operador de Retroexcavadora</span>
                </div>
                <div style="text-align: right; font-size: 11px; color: var(--acento-cian);">
                    Normal: $10/h | Extra: $15/h
                </div>
            </div>

            <!-- Selectores de asistencia rápidos tipo pastilla -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <label style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--exito); border-radius: 6px; padding: 8px; text-align: center; font-size: 12px; cursor: pointer; display: block;">
                    <input type="radio" name="asistencia-trab-01" value="asistio" checked style="width: auto; margin-right: 5px;"> Asistió
                </label>
                <label style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--alerta); border-radius: 6px; padding: 8px; text-align: center; font-size: 12px; cursor: pointer; display: block;">
                    <input type="radio" name="asistencia-trab-01" value="falto" style="width: auto; margin-right: 5px;"> Faltó
                </label>
                <label style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--texto-secundario); border-radius: 6px; padding: 8px; text-align: center; font-size: 12px; cursor: pointer; display: block;">
                    <input type="radio" name="asistencia-trab-01" value="justificado" style="width: auto; margin-right: 5px;"> Justif.
                </label>
            </div>

            <!-- Input de horas extra integrado -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <label style="font-size: 12px; white-space: nowrap; color: var(--texto-secundario);">Horas Extra:</label>
                <input type="number" id="horas-extra-trab-01" min="0" max="8" value="0" style="padding: 6px; text-align: center;">
            </div>
        </div>
        <!-- Fin Ejemplo -->

    </div>

    <button onclick="guardarAsistenciaDiaria(document.getElementById('fecha-asistencia').value)" class="btn-primario" style="width: 100%;">
        ✅ Cerrar y Guardar Planilla del Día
    </button>
</div>


Instrucción Adicional para enviar a tu Agente de VS Code:Añade este último párrafo al prompt maestro de tu asistente virtual:"Para el Módulo de Personal y Asistencia, diseña una interfaz mobile-first basada en tarjetas individuales para cada trabajador en lugar de tablas extensas. El sistema debe calcular de manera automática el costo total devengado diario multiplicando las horas normales (fijadas sobre una base de 8 horas) por la tarifa base, y sumando el cálculo de las horas extras ingresadas multiplicadas por su respectiva tarifa de hora extra. Estos cálculos monetarios acumulados deben reflejarse de forma transparente tanto en el JSON como en los consolidados semanales en PDF."