He compilado el código fuente de forma íntegra y optimizada en base a la arquitectura modular que diseñamos paso a paso. Cumple de manera rigurosa con los flujos de control lógico (descuentos en caja chica, cálculos de nómina con horas extra y horómetros), la estética oscura translúcida premium (Glasmorphism), el almacenamiento en LocalStorage y el motor de reportes profesionales en PDF y CSV listos para imprimir con el membrete institucional de CONSTRURAMSA y su eslogan "SOLUCIONES EN INGENIERÍA Y ARQUITECTURA".

Estructura de Bloques del Código CompiladoEl archivo index.html contiene el ecosistema completo integrado sin dependencias de servidores externos:Diseño Responsivo (Mobile-First y Desktop): Maquetación flexible con CSS Grid y Variables nativas para el renderizado óptimo en pantallas de smartphones (estilo app nativa) u ordenadores de escritorio.Lógica Avanzada de Interfaz (Glasmorphism): Contenedores translúcidos mediante filtros de desenfoque avanzados (backdrop-filter: blur(16px);) y gradientes alineados a los colores corporativos (Cian, Azul Eléctrico y toques Púrpuras).Motor Financiero Automatizado: Interconexión estricta entre módulos. Ningún gasto de combustible, repuestos o adquisición de cotizaciones puede consolidarse si el monto supera el saldo disponible actual de la Caja Chica. Al aprobarse una compra o gasto, este se debita automáticamente del fondo.Control Logístico Pesado y Personal: Formularios con captura oninput para previsualizar consumos y rendimientos de retroexcavadoras (Horas) y camiones de volteo (Kilómetros). Tarjetas de pase de lista dinámicas en obra con multiplicadores automáticos para salarios diarios y horas extra de Lunes a Domingo.Módulo Web Share API de Reportes: Generación limpia en segundo plano de archivos .csv y documentos de alta fidelidad .pdf (con inversión tipográfica a fondo blanco absoluto para impresión física de oficina, firmas de responsabilidad y carga dinámica del logo en Base64).

Pasos para Desplegarlo en tu Repositorio de GitHubDado que ya cuentas con el repositorio público vacío listo en tu perfil (salazaroliveros-prog/construramsa_control), sigue estos comandos sencillos desde la terminal de tu VS Code para subir el archivo y activar la aplicación móvil de manera gratuita:Coloca el archivo en tu carpeta de proyecto:Asegúrate de que el archivo descargado se llame exactamente index.html y colócalo en la raíz de tu carpeta local de VS Code.Inicializa y vincula el repositorio:Abre la terminal en VS Code (Ctrl + ~) y ejecuta los siguientes comandos ordenadamente:

git init
git add index.html
git commit -m "Initial commit: PWA Construramsa Control"
git branch -M main
git remote add origin https://github.com/salazaroliveros-prog/construramsa_control.git
git push -u origin main


Activar GitHub Pages (Para Instalarla como App Nativa en Celulares):Ve a la página web de tu repositorio en GitHub.Entra a la pestaña de Settings (Configuración) en el menú superior.En la barra lateral izquierda, haz clic en Pages.En la sección Build and deployment, bajo Source, selecciona Deploy from a branch.En Branch, cambia None por main (deja la carpeta en /root) y presiona Save.

