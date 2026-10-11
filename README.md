# ✈️ EM Flights (v2.1.2)

> **Calculadora de Margen Real, Pasajeros y Canje de Millas Itaú Volar para Emisión de Vuelos**

[![Version](https://img.shields.io/badge/version-2.1.2-blue.svg)](https://github.com/egidio-pro/em.flights)
[![Manifest](https://img.shields.io/badge/manifest-v3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-orange.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![Platform](https://img.shields.io/badge/platform-Google%20Chrome-4285F4.svg)](https://www.google.com/chrome/)

---

## 📖 Descripción General

**EM Flights** es una extensión moderna para Google Chrome diseñada para agentes de viajes, consolidadores y profesionales del turismo. Permite cotizar tarifas aéreas en tiempo real aplicando la fórmula de **margen real sobre venta**, desglosar precios por grupo de pasajeros y aplicar canje de **Millas Itaú Volar** con cálculo en vivo.

Cuenta con dos modos de operación integrados:
1. **Detección Automática en GWC**: Al hacer clic en cualquier tarifa neta dentro de `gwc.glas.travel/search`, la calculadora se abre automáticamente capturando el precio.
2. **Calculadora Manual Universal**: Accesible en cualquier sitio web o pestaña desde el popup de la extensión, permitiendo cotizar de forma independiente cualquier tarifa manual.

---

## ✨ Características Principales

* **🎯 Centrado Inteligente**: La ventana flotante siempre se abre exactamente en el centro de la pantalla del usuario.
* **📐 Altura Compacta y Modo Claro**: Interfaz limpia, optimizada para minimizar la ocupación vertical de la pantalla y con soporte para arrastrar (`drag & drop`) y redimensionar.
* **📊 Precio Unificado**: Muestra simultáneamente el **Precio Total en destaque** y el **Precio por Pasajero en formato secundario**, sin necesidad de conmutar vistas.
* **💳 Canje de Millas Itaú Volar**:
  * Conmutador directo: `[ SIN MILLAS | 💳 MILLAS ITAÚ ]`.
  * Deducción aplicada directamente sobre el valor total del billete.
  * Mínimo configurable de millas (por defecto `5.000` millas).
  * Valor monetario por milla configurable (por defecto `USD 0,0125` / milla).
  * Stepper rápido de $\pm 1.000$ millas y chips de selección rápida (`0`, `5K`, `10K`, `15K`, `20K`).
* **🧮 Margen Real de Agencia**:
  $$\text{Precio Final} = \frac{\text{Tarifa Neta}}{1 - \frac{\text{Margen } \% + \text{BOK } \%}{100}}$$
  $$\text{Total a Cobrar} = \max(0, \text{Precio Final} - \text{Descuento Millas})$$
* **📋 Copiado al Portapapeles con 1 Clic**: Formatea el texto listo para enviar por WhatsApp o correo al cliente, incluyendo el desglose de pasajeros y el detalle de millas canjeadas.
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
├── test_gwc_simulation.html   # Suite de pruebas automatizadas y simulador GWC
├── LICENSE                    # PolyForm Noncommercial License 1.0.0
└── README.md                  # Documentación del proyecto
```

---

## 🚀 Instalación en Google Chrome

### Opción A: Modo Desarrollador (Carga descomprimida)

1. Clona el repositorio o descarga el código fuente:
   ```bash
   git clone https://github.com/egidio-pro/em.flights.git
   ```
2. Abre Google Chrome y navega a:
   ```text
   chrome://extensions/
   ```
3. Activa la opción **Modo de desarrollador** en la esquina superior derecha.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta del proyecto `EM Flights`.
5. La extensión quedará activa y lista para usar.

### Opción B: Carga desde archivo ZIP

1. Descarga el paquete empaquetado `EM_Flights_v2.1.2.zip`.
2. Descomprímelo en una carpeta local.
3. Carga la carpeta descomprimida en `chrome://extensions/`.

---

## 🧪 Pruebas y Simulación Local

Puedes probar todas las funciones interactivas y la suite de tests automatizados sin necesidad de acceder a GWC:

1. Abre el archivo [`test_gwc_simulation.html`](file:///Users/egidio/Downloads/My%20project/Extensiones/EM%20Flights/test_gwc_simulation.html) o el archivo independiente del Escritorio `Probar_EM_Flights.html` en tu navegador.
2. Haz clic en **🧪 Ejecutar Tests Automáticos** para verificar:
   * Parseo de formatos de moneda (`USD 1.250`, `$ 1.480,50`, `USD 1,320.75`).
   * Fórmula de margen real sobre venta.
   * Apertura centrada en pantalla con etiqueta `✈️ GWC Auto`.
   * Conmutador y deducción de Millas Itaú Volar.
   * Precios unificados (Total y Pax).
   * Cierre con tecla `Escape [ESC]`.

---

## 📄 Licencia

Este software se distribuye bajo la **PolyForm Noncommercial License 1.0.0**.

* **Uso Libre**: Puedes utilizar, consultar y modificar este software libremente para fines personales, educativos, de prueba o no comerciales.
* **Propósito No Comercial**: No está autorizado su uso directo para explotación comercial o compensación monetaria sin autorización del autor.
* Consulta el texto completo en el archivo [LICENSE](LICENSE) o en <https://polyformproject.org/licenses/noncommercial/1.0.0/>.

---

## 👤 Autor

Desarrollado por **Egidio Magalhaes**  
* GitHub: [@egidio-pro](https://github.com/egidio-pro)  
* Repositorio: [https://github.com/egidio-pro/em.flights](https://github.com/egidio-pro/em.flights)  
* © 2026 Egidio Magalhaes · PolyForm Noncommercial License · Uso Libre
