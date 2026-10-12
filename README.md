# ✈️ EM Flights (v2.0.0)

> **Calculadora de Margen Real, Pasajeros y Canje de Millas Itaú Volar para Emisión de Vuelos**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/egidio-pro/em.flights)
[![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform](https://img.shields.io/badge/platform-Google%20Chrome-4285F4.svg)](https://www.google.com/chrome/)

---

## 📖 Descripción General

**EM Flights** es una extensión moderna para Google Chrome diseñada para agentes de viajes, consolidadores y profesionales del turismo. Permite cotizar tarifas aéreas en tiempo real aplicando la fórmula de **margen real sobre venta**, desglosar precios por grupo de pasajeros y aplicar canje de **Millas Itaú Volar** con cálculo en vivo.

Cuenta con dos modos de operación integrados:
1. **Detección Automática en GWC**: Al hacer clic en cualquier tarifa neta dentro de `gwc.glas.travel/search`, la calculadora se abre automáticamente capturando el precio y detectando los pasajeros (con ajuste manual siempre disponible).
2. **Calculadora Manual Universal**: Accesible en cualquier sitio web o pestaña desde el popup de la extensión, permitiendo cotizar de forma independiente cualquier tarifa manual.

---

## ✨ Características Principales

* **🎯 Centrado Inteligente**: La ventana flotante siempre se abre exactamente en el centro de la pantalla del usuario.
* **📐 Altura Compacta y Modo Claro**: Interfaz limpia, optimizada para minimizar la ocupación vertical de la pantalla y con soporte para arrastrar (`drag & drop`) y redimensionar.
* **📊 Precio Unificado y Desglose en Tarjeta Azul**: Muestra el **Total a Cobrar en destaque principal**. Al cotizar con Millas Itaú, desglosa el precio de venta y las millas a descontar; en cotización sin millas, exhibe el valor por pasajero (cuando pax > 1).
* **💳 Canje de Millas Itaú Volar con Tope Inteligente**:
  * Conmutador directo: `[ SIN MILLAS | 💳 MILLAS ITAÚ ]`.
  * **Tope máximo automático**: Calcula e indica las millas necesarias para cubrir el billete sin permitir desbordes accidentales.
  * Por defecto `0` millas para control total del agente.
  * Deducción aplicada directamente sobre el valor total del billete con redondeo sin discrepancias de 1 USD.
  * Mínimo configurable de millas (por defecto `5.000` millas).
  * Valor monetario por milla configurable (por defecto `USD 0,0125` / milla).
  * Stepper rápido de $\pm 1.000$ millas y chips de selección rápida (`0`, `5K`, `10K`, `15K`, `20K`).
* **👥 Pasajeros Editables**: Detección automática inteligente en GWC con steppers y entrada manual siempre habilitados para ajustar la cotización en vivo.
* **🧮 Margen Real de Agencia**:
  $$\text{Precio Final} = \frac{\text{Tarifa Neta}}{1 - \frac{\text{Margen } \% + \text{BOK } \%}{100}}$$
  $$\text{Total a Cobrar} = \max(0, \text{Precio Final} - \text{Descuento Millas})$$
* **📋 Copiado al Portapapeles con 1 Clic**: Clic en el precio total copia el total listo para cotizar; clic en el precio por pasajero copia el valor unitario con confirmación visual interactiva.
* **⚙️ Configuración Personalizada en Popup**: Parámetros de millas, interruptor general de la extensión y acceso a la calculadora manual con guardado sincronizado (`chrome.storage.sync`).

---

## 📦 Estructura del Proyecto

```text
EM Flights/
├── manifest.json              # Configuración de Chrome Extensions Manifest V3
├── popup.html                 # Interfaz del popup de configuración y control
├── popup.js                   # Lógica reactiva del popup y almacenamiento sincronizado
├── content.js                 # Script inyectado con la calculadora flotante y cálculos
├── styles.css                 # Sistema de diseño en Modo Claro y animaciones
├── icons/                     # Iconografía oficial (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE                    # GNU General Public License v3.0 (GPL-3.0)
└── README.md                  # Documentación del proyecto
```

---

## 🚀 Instalación en Google Chrome

Puedes instalar la extensión mediante cualquiera de las siguientes opciones:

### 1. Descargar el archivo en local y subir como extensión de Chrome (Modo Desarrollador)

1. Descarga o clona el código fuente en tu equipo local:
   ```bash
   git clone https://github.com/egidio-pro/em.flights.git
   ```
2. Abre Google Chrome y accede a:
   ```text
   chrome://extensions/
   ```
3. Activa la casilla **Modo de desarrollador** en la esquina superior derecha.
4. Haz clic en el botón **Cargar descomprimida** y selecciona la carpeta del proyecto `EM Flights`.
5. ¡Listo! La extensión quedará habilitada en tu navegador.

### 2. Buscar "EM Flights" en la tienda de extensiones de Google Chrome

1. Ingresa a la [Chrome Web Store](https://chromewebstore.google.com/).
2. Escribe **"EM Flights"** en la barra de búsqueda.
3. Haz clic en el resultado correspondiente y presiona el botón **Añadir a Chrome** para instalarla automáticamente.

---

## 📄 Licencia

Este software es **Software Libre** y se distribuye bajo los términos de la **GNU General Public License v3.0 (GPL-3.0)**.

* **Libertad de Uso y Modificación**: Tienes total libertad para ejecutar, estudiar, modificar y redistribuir este programa.
* **Copyleft**: Cualquier redistribución o trabajo derivado debe ser distribuido bajo la misma licencia GPL v3 y con código fuente accesible.
* Consulta el texto completo de la licencia en el archivo [LICENSE](LICENSE) o en <https://www.gnu.org/licenses/gpl-3.0.html>.

---

## 👤 Autor

Desarrollado por **Egidio Magalhaes**  
* GitHub: [@egidio-pro](https://github.com/egidio-pro)  
* Repositorio: [https://github.com/egidio-pro/em.flights](https://github.com/egidio-pro/em.flights)  
* © 2026 Egidio Magalhaes · GNU General Public License v3.0 (GPL-3.0) · Software Libre
