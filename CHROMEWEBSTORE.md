# Ficha de Chrome Web Store — EM Flights

> Última actualización: 2026-10-12 | Versión: 2.2.0

---

## 1. Metadatos de la Ficha

* **Nombre de la extensión:** EM Flights
* **Descripción corta (máx. 132 caracteres):**  
  Calculadora de margen comercial real para GWC con canje de Millas Itaú Volar y cotización de vuelos por pasajero.
* **Categoría:** Productividad (Productivity)
* **Propósito único (Single Purpose):**  
  Calcular el precio final de venta, margen comercial y descuento por canje de Millas Itaú en tarifas aéreas para cotizaciones de viajes.
* **Idioma principal:** Español (Latinoamérica)

---

## 2. Descripción Detallada (Chrome Developer Dashboard)

```text
EM Flights es la calculadora de margen comercial definitiva para agentes de viajes y profesionales del turismo que cotizan vuelos en la plataforma GWC y portales de consolidación.

CÓMO FUNCIONA:

1. Abre una búsqueda de vuelos en GWC (o pulsa "Abrir Calculadora Manual" desde el icono de la extensión en cualquier web).
2. Haz clic sobre el precio neto de cualquier vuelo en GWC para capturar la tarifa y cantidad de pasajeros automáticamente.
3. Se abrirá la calculadora flotante en el centro de tu pantalla mostrando el Total a Cobrar y la ganancia neta en tiempo real.
4. Ajusta el margen comercial, el BOK/costo financiero o los pasajeros con los botones rápidos o escribiendo directamente.
5. Activa el conmutador de Millas Itaú si el cliente desea canjear millas y selecciona la cantidad deseada.
6. Haz clic directamente sobre el precio total o sobre el precio por pasajero para copiar el texto listo para enviar al cliente.

CARACTERÍSTICAS PRINCIPALES:

- Cálculo instantáneo de margen comercial real según el estándar de la industria: Neto / (1 - (Margen% + BOK%)/100).
- Canje de Millas Itaú Volar integrado: deducción automática del valor de las millas directamente sobre el total del billete.
- Tope Inteligente de Millas: cálculo automático de "Millas necesarias" para cubrir el pasaje, evitando ingresar más millas de las requeridas para el 100% del billete.
- Desglose claro de cotización: visualización en destaque del Total a Cobrar, Precio de Venta y Millas a Descontar (con su equivalente en USD).
- Copiado al portapapeles con 1 clic: clic en el precio total copia el total listo para cotizar; clic en el precio por pasajero copia el valor unitario.
- Calculadora Manual Universal: cotiza cualquier tarifa aérea desde cualquier pestaña o sitio web directamente desde el popup.
- Detección automática de pasajeros en GWC: reconoce adultos, menores y bebés del formulario de búsqueda, con ajuste manual siempre habilitado.
- Redondeo exacto sin discrepancias de 1 USD entre los valores desglosados y el total a cobrar.
- Ventana flotante interactiva: se abre centrada, puede arrastrarse y redimensionarse a gusto.
- Chips de acceso rápido para márgenes comunes (8%, 10%, 14%, 20%) y paquetes de millas (0, 5K, 10K, 15K, 20K).
- Panel de configuración en popup: personaliza el valor de la milla y el mínimo requerido de canje con guardado automático.
- Funcionamiento 100% local: no requiere registro, no envía datos a servidores externos y protege la privacidad de tus cotizaciones.

CONFIGURACIÓN Y PARÁMETROS:

- Pasajeros: 1–30 pasajeros.
- Margen operativo: 0–95%.
- BOK / Costo Financiero: 0–95%.
- Valor Milla Itaú: Configurable (por defecto USD 0,0125).
- Mínimo de Millas: Configurable (por defecto 5.000 millas).

PRIVACIDAD Y SEGURIDAD:

EM Flights no recopila datos personales, no realiza seguimiento de navegación ni se conecta a servidores externos. Todo el procesamiento de cálculos se realiza exclusivamente dentro de tu navegador de forma privada y segura. La configuración de usuario se almacena localmente y se sincroniza en tu cuenta mediante Chrome Storage.

HISTORIAL DE VERSIONES:

Versión 2.2.0:
- Integración completa de Canje de Millas Itaú Volar con conmutador en tiempo real.
- Indicador de "Millas necesarias" con tope inteligente máximo para evitar desbordes de canje.
- Desglose dinámico en la tarjeta azul: Precio de venta, Millas a descontar y Total a cobrar.
- Copiado independiente al portapapeles haciendo clic directo en el precio total o por pasajero.
- Modo Calculadora Manual disponible en cualquier sitio web desde el popup de la extensión.
- Detección automática de pasajeros en GWC (adultos, niños e infantes) con edición manual siempre abierta.
- Rediseño visual ultra compacto en Modo Claro con estética moderna y refinada.
- Redondeo matemático exacto sin discrepancias de 1 USD.
- Panel de configuración de valor y mínimo de millas en popup con sincronización instantánea.

Versión 1.2.1:
- Calculadora flotante redimensionable en ancho y alto.
- Ajuste automático de los elementos interiores.
- Apertura inicial centrada en la pantalla.
- Conservación de la posición al seleccionar otro precio.
- Detección de precios más estable.
- Compatibilidad con gwc.glas.travel y dominios Netviax.
- Mejor gestión del contexto después de actualizar o recargar la extensión.
- Mejoras generales de estabilidad y experiencia de uso.

Versión 1.2.0:
- Nuevo diseño premium con interfaz estilo “Liquid Glass”.
- Entrada manual de márgenes y número de pasajeros mediante teclado.
- Cálculo de margen real con la fórmula estándar de la industria.
- Cálculos realizados 100% localmente en el navegador.
- Sin servidores externos ni recolección de datos sensibles.
- Rediseño del icono.

¿Preguntas o sugerencias? Contáctanos en egidiomaga@gmail.com.
```

---

## 3. Justificación de Permisos (Permissions Justification)

Para la pestaña de privacidad en la consola de Google Chrome Developer:

| Permiso | Justificación para el equipo de revisión de Google |
| :--- | :--- |
| **`storage`** | Necesario para guardar las preferencias del agente de viajes (valor por milla Itaú, mínimo de millas para canje y estado activo de la calculadora) sincronizadas en su perfil de Chrome mediante `chrome.storage.sync`. |
| **`activeTab`** | Necesario para permitir que el agente abra la Calculadora Manual en cualquier pestaña activa únicamente cuando hace clic explícito en el botón "Abrir Calculadora Manual" desde el popup de la extensión. |
| **`scripting`** | Utilizado exclusivamente para inyectar la interfaz de la Calculadora Manual bajo demanda en la pestaña activa tras la acción del usuario en el popup, evitando inyecciones automáticas innecesarias en sitios web ajenos a GWC. |

### Declaración de Privacidad (Data Usage):
* **¿Recopila datos del usuario?** NO (No user data collected).
* **¿Transfiere datos a terceros?** NO (No third-party data transfer).
* **Uso exclusivo de permisos:** Los permisos se utilizan únicamente para la funcionalidad central de la extensión descrita en la ficha.

---

## 4. Archivo ZIP para Subir a la Tienda

* **Nombre del archivo:** `em-flights-v2.2.0.zip`
* **Ubicación:** Raíz del proyecto
* **Archivos incluidos:**
  * `manifest.json` (v2.2.0, Manifest V3)
  * `content.js`
  * `styles.css`
  * `popup.html`
  * `popup.js`
  * `LICENSE`
  * `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
* **Excluidos:** `.git`, `.gitignore`, `.DS_Store`, `.kilo`, archivos Markdown y temporales.
