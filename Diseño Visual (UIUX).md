Diseño Visual (UI/UX) y Hoja de EstilosPara lograr un acabado de Glasmorphism premium, utilizaremos una paleta oscura inspirada en el logo con acentos brillantes (Cian, Azul y Púrpura). El cristal se genera mediante transparencias controladas y desenfoque de fondo (backdrop-filter).1. Variables de Color y Base Estilística (CSS)Aplica estas variables para centralizar los colores de la corporación:

:root {
  /* Paleta Construramsa */
  --bg-principal: #090a0f;
  --glass-bg: rgba(20, 24, 35, 0.45);
  --glass-border: rgba(0, 164, 228, 0.15);
  --glass-glow: rgba(111, 45, 189, 0.1);
  
  /* Colores de Acento */
  --acento-cian: #00A4E4;
  --acento-azul: #004B93;
  --acento-purpura: #6F2DBD;
  --texto-principal: #f3f4f6;
  --texto-secundario: #9ca3af;
  --exito: #10b981;
  --alerta: #ef4444;
}

body {
  background-color: var(--bg-principal);
  background-image: 
    radial-gradient(at 0% 0%, rgba(0, 75, 147, 0.2) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(111, 45, 189, 0.15) 0px, transparent 50%);
  color: var(--texto-principal);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 0;
}

El Contenedor de Cristal (Efecto Glasmorphism)Cada módulo, formulario y tarjeta informativa utilizará este estilo de "tarjeta de vidrio":

.tarjeta-glass {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  box-shadow: inset 0 0 12px var(--glass-glow);
  transition: all 0.3s ease;
}

.tarjeta-glass:hover {
  border-color: rgba(0, 164, 228, 0.3);
  box-shadow: 0 8px 32px 0 rgba(0, 164, 228, 0.1);
}


Componentes de Interfaz Adaptables (Mobile-First)Inputs Estilizados: Los campos de texto y selectores no deben romper la estética.

input, select, textarea {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  padding: 12px;
  width: 100%;
  box-sizing: border-box;
}
input:focus {
  border-color: var(--acento-cian);
  outline: none;
  box-shadow: 0 0 8px rgba(0, 164, 228, 0.4);
}


Botones de Acción Rápida:

.btn-primario {
  background: linear-gradient(135deg, var(--acento-azul), var(--acento-cian));
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  padding: 12px 24px;
  cursor: pointer;
  transition: transform 0.2s;
}
.btn-primario:active {
  transform: scale(0.98);
}

"Usa la estructura JSON provista para armar los métodos de LocalStorage (saveData, loadData) y aplica las variables CSS junto con la clase .tarjeta-glass para maquetar toda la aplicación PWA en un archivo unificado."

