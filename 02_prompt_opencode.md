

# ROL Y OBJETIVO

Eres un desarrollador senior full‑stack/front‑end. Vas a construir, desde cero y en esta carpeta, la aplicación **Hodēgeō**: el companion app de un bastón inteligente para personas no videntes (proyecto escolar del grupo "Pathfinders", Fundación Kinal, Guatemala). La app se presenta mañana en una feria de ciencia, así que debe ser **robusta, funcional y demostrable aunque el bastón físico no esté presente**. Prioriza que todo funcione de punta a punta por encima de que sea complejo.

Todo el texto de la interfaz debe estar **en español** (`lang="es"`). Los comentarios del código pueden estar en español.

# CONTEXTO DEL BASTÓN (HARDWARE)

- Microcontrolador **ESP32** dentro de un tubo de PVC. Se comunica con el celular por **Bluetooth Low Energy (BLE)**.
- Sensor ultrasónico **HC‑SR04** en la punta: mide distancia frontal en cm.
- **Buzzer** (alerta sonora) y **motor de vibración** (alerta háptica) en la empuñadura; el ESP32 los maneja SOLO (modo autónomo), la app no es necesaria para las alertas locales.
- **Botón** en la empuñadura: pulsación larga (2 s) = S.O.S; pulsación corta = "encontrar mi celular".
- El bastón NO tiene GPS ni internet. El **GPS, internet, voz y contactos los aporta el celular** a través de esta app.

# DECISIONES TÉCNICAS (obligatorias)

- **PWA** (Progressive Web App) con **Vite + React + TypeScript**. CSS propio (sin Tailwind ni librerías de UI). Sin librerías de gráficos ni de rutas: usa estado simple para las pestañas y dibuja las gráficas con SVG/canvas a mano.
- Dependencias permitidas: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `vite-plugin-pwa`, `@types/web-bluetooth`. Nada más salvo que sea imprescindible.
- BLE mediante **Web Bluetooth API** (`navigator.bluetooth`), válido en Chrome para Android (y en el navegador Bluefy en iPhone). Debe correr en contexto seguro (HTTPS o localhost).
- **No hay backend.** Todo se guarda en `localStorage` (envuélvelo en try/catch).
- Debe compilar con `npm run build` sin errores de TypeScript y generar la carpeta `dist/` lista para subir a Netlify arrastrando la carpeta.
- Diseño **mobile‑first** (pantalla de 360–412 px de ancho), pero que se vea bien también en el navegador de escritorio.

# ARQUITECTURA CLAVE: capa de transporte intercambiable

Crea una interfaz `CaneTransport` y DOS implementaciones. **Toda la UI y la lógica de negocio hablan solo con la interfaz**, nunca directamente con Web Bluetooth ni con el simulador.

```ts
interface CaneTransport {
  readonly kind: 'ble' | 'sim';
  connect(): Promise<void>;          // BLE: abre el selector del navegador
  disconnect(): Promise<void>;
  writeConfig(cfg: { alertCm: number; mode: 0 | 1 | 2 }): Promise<void>;
  readConfig(): Promise<{ alertCm: number; mode: 0 | 1 | 2 }>;
  sendCommand(cmd: 1 | 2 | 3): Promise<void>;  // 1=encontrar bastón, 2=autotest, 3=detener
  on(event: 'distance', cb: (cm: number | null) => void): void;   // null = sin lectura
  on(event: 'battery', cb: (pct: number | null) => void): void;   // null = desconocido
  on(event: 'button', cb: (type: 'sos' | 'findPhone') => void): void;
  on(event: 'selftest', cb: (r: { sensorOk: boolean }) => void): void;
  on(event: 'connection', cb: (state: 'connected' | 'connecting' | 'disconnected', unexpected?: boolean) => void): void;
  on(event: 'log', cb: (line: { t: number; dir: 'TX' | 'RX' | 'INFO' | 'ERR'; text: string }) => void): void;
}
```

## Implementación 1: `SimTransport` (MODO SIMULADOR) — MUY IMPORTANTE

Como el bastón físico no estará disponible mientras desarrollo, el simulador debe permitir probar y presentar TODA la app sin hardware:
- Emite distancias cada 200 ms con un movimiento realista (caminata aleatoria entre 20 y 300 cm, con obstáculos que "se acercan" de forma gradual, y de vez en cuando `null` = sin lectura).
- Batería simulada que empieza en 85 % y baja lentamente (también permite forzarla).
- Aplica la misma lógica que el firmware: si distancia < `alertCm`, enciende un **buzzer virtual** y un **motor virtual** (indicadores visuales animados en pantalla, respetando el `mode`: 0=ambos, 1=solo sonido, 2=solo vibración).
- Un **panel del simulador** (visible solo cuando el transporte activo es `sim`) con botones: "Presionar botón S.O.S (2 s)", "Presionar botón corto (encontrar celular)", "Obstáculo adelante" (baja la distancia a ~40 cm durante 3 s), "Batería baja (15 %)", "Perder conexión" y "Restablecer conexión".
- `sendCommand(1)` activa buzzer+motor virtuales 3 s; `sendCommand(2)` responde con `selftest { sensorOk: true }` tras 800 ms.
- Se activa con un interruptor visible en la pantalla de conexión: "Usar modo simulador (sin bastón)".

## Implementación 2: `BleTransport` (bastón real)

Contrato BLE exacto (el firmware del ESP32 ya está escrito para este contrato; NO lo cambies). **Todos los números multibyte son little‑endian.** Todos los UUID van en minúsculas.

| Elemento | UUID | Propiedades | Formato |
|---|---|---|---|
| **Servicio Hodegeo** | `7a1c0001-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | — | — |
| Distancia | `7a1c0002-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | read, notify | `uint16` en cm. `0xFFFF` (65535) = sin lectura |
| Batería | `7a1c0003-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | read, notify | `uint8` 0–100 %. `255` = desconocido |
| Evento de botón | `7a1c0004-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | notify | `uint8`: `1` = S.O.S (pulsación larga), `2` = encontrar celular (pulsación corta) |
| Configuración | `7a1c0005-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | read, write | 3 bytes: `[alertCm_lo, alertCm_hi, mode]` ; `mode`: 0=sonido+vibración, 1=solo sonido, 2=solo vibración |
| Comando | `7a1c0006-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | write | `uint8`: `1`=encontrar bastón (suena/vibra 3 s), `2`=autotest, `3`=detener |
| Resultado autotest | `7a1c0007-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | notify | `uint8`: `1` = sensor responde, `0` = sin lectura |

Reglas de implementación BLE:
- `requestDevice({ filters: [{ namePrefix: 'Hodegeo' }, { services: [SERVICE_UUID] }], optionalServices: [SERVICE_UUID] })`. El nombre anunciado por el bastón es `Hodegeo`.
- Tras conectar: obtener servicio y características, **suscribirse a notificaciones** (`startNotifications`) de distancia, batería, evento y autotest, y leer la configuración y la batería iniciales.
- Parsear con `DataView` en little‑endian. Escribir con `writeValueWithResponse` (con fallback a `writeValue`).
- **Reconexión automática** ante desconexión inesperada (`gattserverdisconnected`): hasta 6 intentos, cada 2 s, reutilizando el mismo objeto `device` con `device.gatt.connect()`; reenganchar suscripciones tras reconectar. Emitir `connection('disconnected', unexpected=true)` en la primera caída.
- Cada operación (conexión, notificación recibida, escritura enviada, errores) emite un evento `log` con el valor en **hexadecimal** (para la pantalla de diagnóstico).
- Manejo de errores amigable en español: usuario cancela el selector, Bluetooth apagado, servicio no encontrado ("Este dispositivo no parece ser un bastón Hodēgeō"), navegador sin soporte.
- Si `navigator.bluetooth` no existe, mostrar un aviso claro: "Tu navegador no soporta Bluetooth web. Abre la app en Chrome para Android (o Bluefy en iPhone), o usa el modo simulador."

# PANTALLAS Y FUNCIONES

Navegación inferior con 5 pestañas (iconos SVG propios + texto): **Inicio, S.O.S, Bastón, Historial, Diagnóstico**. Encabezado con el nombre "Hodēgeō" y un chip de estado de conexión (Conectado / Conectando / Desconectado / Simulador).

## Pantalla de conexión (aparece si no hay conexión)
Botón grande "Conectar bastón" (BLE), interruptor "Usar modo simulador (sin bastón)", aviso de compatibilidad, y mini guía de 3 pasos (encender bastón, activar Bluetooth y ubicación, tocar conectar).

## 1. Inicio (dashboard en vivo)
- Distancia actual en número MUY grande (en cm y en metros), con color según estado: verde (segura), naranja (< `alertCm`), rojo (< `alertCm/2`). **Nunca dependas solo del color**: añade texto ("Despejado", "Precaución", "¡Peligro!") y un icono.
- Barra de proximidad horizontal y una **gráfica en vivo de las últimas 60 lecturas** (SVG), con línea de umbral de alerta.
- Batería (icono + %), con aviso si < 20 % (`255` se muestra como "—").
- Tarjeta de **ubicación actual**: coordenadas, precisión en metros, hora, botón "Abrir en Google Maps" y un mapa embebido con iframe de OpenStreetMap (`https://www.openstreetmap.org/export/embed.html?bbox=...&marker=lat,lng`), sin API key. Solicita geolocalización con `watchPosition` (alta precisión) cuando hay conexión; maneja permiso denegado con mensaje claro.
- Contador de "obstáculos detectados" en la sesión (cada vez que la distancia cruza por debajo del umbral).
- Indicador de estado del buzzer/motor (en simulador: virtual; con BLE real: se infiere de la distancia vs umbral).
- Mantener la pantalla encendida con **Screen Wake Lock** mientras haya conexión (con try/catch y re‑solicitud al volver a la pestaña).

## 2. S.O.S
- **Contactos de confianza**: CRUD (nombre + teléfono con código de país, por defecto `+502`), guardados en localStorage. Mínimo 1, hasta 5. Validar formato.
- Botón S.O.S enorme en pantalla (se activa con pulsación sostenida de 1.5 s para evitar toques accidentales). El mismo flujo se dispara cuando el bastón envía el evento de botón `1`.
- **Flujo S.O.S**: pantalla completa roja con **cuenta regresiva de 10 s**, número grande, botón gigante "CANCELAR", vibración (`navigator.vibrate`), pitido por WebAudio cada segundo y lectura por voz ("S.O.S en 10, 9, 8…"; usa `speechSynthesis` con voz en español). Si se cancela, registrar en historial como "S.O.S cancelado".
- Al llegar a 0: obtener ubicación (`getCurrentPosition`, alta precisión, timeout 10 s; si falla, usar la última conocida y avisarlo) y construir el mensaje:
  `🚨 S.O.S de Hodēgeō. {nombreUsuario} necesita ayuda. Ubicación: https://www.google.com/maps?q={lat},{lng} (precisión ±{m} m). Hora: {fecha/hora local}.`
- **Importante, limitación real del navegador:** una página web NO puede enviar SMS/WhatsApp automáticamente. Por eso, la pantalla final de S.O.S debe mostrar, por cada contacto, dos botones grandes: **"Enviar por WhatsApp"** (`https://wa.me/{telefonoSoloDigitos}?text={mensajeCodificado}`) y **"Enviar por SMS"** (`sms:{telefono}?body={mensajeCodificado}`), además de "Copiar mensaje" y "Compartir" (`navigator.share` si existe). Muestra el mensaje completo para revisión.
- **Envío automático opcional por Telegram** (ver Ajustes): si está configurado, al terminar la cuenta regresiva se envía el mensaje y la ubicación automáticamente con `fetch` a la API de bots de Telegram (`sendMessage` y `sendLocation`), mostrando el resultado (enviado / error de red). Es el único envío realmente automático.
- Tras el S.O.S, ofrecer "Compartir ubicación cada 30 s" (reenvía por Telegram mientras esté activo) con botón para detenerlo.
- Registrar todo en el historial.

## 3. Bastón (ajustes y pruebas)
- **Distancia de alerta**: slider 30–300 cm (por defecto 100) con valor numérico. **Modo de alerta**: radios "Sonido + vibración / Solo sonido / Solo vibración". Botón "Enviar configuración al bastón" (`writeConfig`), con confirmación visible. Al conectar, leer y mostrar la configuración actual del bastón.
- Botón **"Encontrar mi bastón"** (`sendCommand(1)`) y "Detener" (`sendCommand(3)`).
- **Autodiagnóstico real** (botón "Probar todo"): ejecuta una secuencia con checklist en pantalla:
  1. Conexión BLE ✓/✗.
  2. Sensor ultrasónico: `sendCommand(2)` y esperar evento `selftest` (timeout 3 s). Si `sensorOk=false`, mostrar el consejo "Coloca la mano a 20–50 cm del sensor y repite".
  3. Buzzer y motor: el bastón los activa 0.5 s; la app pregunta "¿Escuchaste el pitido?" y "¿Sentiste la vibración?" con botones Sí/No (confirmación humana, no inventes porcentajes).
  4. Batería: valor leído y veredicto (OK ≥ 40, Baja 20–39, Crítica < 20).
  5. GPS del celular: obtiene una posición con precisión.
  Al final, un resumen "Todo OK" o la lista de fallas. Guardar el resultado en el historial.
- **Ajustes de la app**: nombre del usuario (para el mensaje S.O.S), alertas por voz en el celular (interruptor, **apagado por defecto**), tema de alto contraste (interruptor), tamaño de texto (normal/grande/muy grande), y la sección "Telegram (opcional)": campos token del bot y chat_id, botón "Enviar mensaje de prueba".

## 4. Historial
Lista cronológica (más reciente arriba, máximo 200 entradas en localStorage) de: conexión, desconexión, reconexión, obstáculos (resumen por minuto, no uno por lectura), batería baja, S.O.S (activado/cancelado/enviado), autodiagnósticos, encontrar bastón/celular. Cada entrada con hora y un icono. Botones "Exportar CSV" (descarga de archivo) y "Borrar historial" (con confirmación).

## 5. Diagnóstico (pensado para depurar con el compañero que tiene el bastón)
- Consola en vivo de los eventos `log` del transporte (TX/RX/INFO/ERR) con hora y bytes en hexadecimal, scroll automático, botón "Copiar log", "Limpiar" y filtro por tipo.
- Panel "Estado de Bluetooth": soporte del navegador, contexto seguro (HTTPS), nombre del dispositivo conectado, estado GATT, número de reconexiones, última lectura de distancia (con edad en segundos), última batería, versión de la app.
- Botones de depuración: "Leer configuración", "Leer batería", "Enviar comando 1/2/3" y "Forzar desconexión".

## Funciones transversales
- **Alerta de desconexión inesperada**: banner rojo persistente + vibración repetitiva + pitidos + voz "Bastón desconectado" hasta que se reconecte o el usuario la silencie con un botón grande. Mientras intenta reconectar, mostrar "Reintentando 2/6…".
- **Evento "encontrar celular"** (botón corto del bastón): el celular suena fuerte (pitidos WebAudio), vibra y dice "Aquí estoy" durante 10 s, con botón "Detener". Para que el audio funcione, inicializa el `AudioContext` en el primer toque del usuario (el botón Conectar).
- **Alertas por voz** (si están activadas): al cruzar el umbral, dice "Obstáculo a X metros" (máx. una vez cada 3 s y solo si la distancia cambió significativamente), "Desnivel o vacío" no aplica (no inventes detección de desniveles), y "Batería baja" una sola vez.
- **Accesibilidad (requisito de primer nivel)**: `lang="es"`; HTML semántico; roles/ARIA correctos; región `aria-live="polite"` para cambios de estado importantes (conexión, batería baja, obstáculo) y `assertive` para S.O.S y desconexión; todos los controles ≥ 56×56 px; foco visible; orden de tabulación lógico; etiquetas accesibles en todos los botones e iconos; compatible con TalkBack/VoiceOver; contraste AA como mínimo, con tema de alto contraste opcional.
- **Estilo visual**: azul marino/azul intenso con acentos naranja (como el panel web del proyecto), tarjetas con bordes suaves, tipografía del sistema. Logo textual "Hodēgeō" y pie "Proyecto Hodēgeō — Pathfinders · Fundación Kinal".
- **PWA**: `vite-plugin-pwa` con manifest (`name: "Hodēgeō"`, `short_name: "Hodēgeō"`, `display: "standalone"`, `lang: "es"`, colores del tema) y service worker que cachee el shell (funciona abierta sin internet, salvo mapa y envíos). Crea íconos SVG propios del bastón y genera los PNG 192/512 con un script de Node (si genera problemas, usa solo SVG y no te detengas por esto).

# ESTRUCTURA DE CARPETAS SUGERIDA

```
src/
  transport/ (types.ts, BleTransport.ts, SimTransport.ts, uuids.ts)
  services/ (geo.ts, sos.ts, telegram.ts, voice.ts, audio.ts, storage.ts, wakelock.ts)
  state/ (store.ts con React context o un store mínimo propio)
  screens/ (Connect, Home, Sos, Cane, History, Diagnostics)
  components/ (DistanceGauge, LiveChart, BatteryIcon, StatusChip, TabBar, SimPanel, Toast, ...)
  styles/ (global.css, theme.css)
```

# PLAN POR FASES (sigue este orden; al final de CADA fase ejecuta `npm run build`, corrige todos los errores y resume en 5 líneas qué probar a mano)

**Fase 1 — Base:** scaffolding Vite+React+TS, tipos, interfaz `CaneTransport`, `SimTransport` completo con su panel, store, pestañas, pantalla de conexión, Inicio con distancia, gráfica en vivo y batería. Debe poder demostrarse entero en el modo simulador.

**Fase 2 — S.O.S y ubicación:** contactos, geolocalización, flujo S.O.S completo con cuenta regresiva, mensajes WhatsApp/SMS/copiar/compartir, tarjeta de ubicación con mapa.

**Fase 3 — Bluetooth real:** `BleTransport` según el contrato, reconexión, pantalla de Diagnóstico con log hexadecimal, pestaña Bastón (config, comandos, autodiagnóstico), alerta de desconexión y "encontrar celular".

**Fase 4 — Pulido:** voz, Telegram opcional, historial con CSV, ajustes de accesibilidad, alto contraste, Wake Lock, PWA, README y revisión final.

# README.md (entrégalo al final)
Incluye: cómo instalar y correr (`npm install`, `npm run dev`), cómo compilar (`npm run build`), cómo desplegar en Netlify arrastrando `dist/`, cómo usar el modo simulador, cómo probar con el bastón real (HTTPS + Chrome Android + permisos de Bluetooth y ubicación), el contrato BLE, cómo crear un bot de Telegram (BotFather → token → obtener chat_id con `getUpdates`) y una lista de limitaciones conocidas.

# CRITERIOS DE ACEPTACIÓN (verifica antes de dar por terminado)
1. `npm run build` pasa sin errores ni warnings de TypeScript.
2. En modo simulador se pueden recorrer TODAS las funciones: distancia en vivo, alertas virtuales, S.O.S completo, autodiagnóstico, historial, desconexión y reconexión.
3. `BleTransport` respeta exactamente los UUID, formatos y endianness de la tabla.
4. Ninguna función depende de librerías o servicios de pago ni de API keys.
5. Si algo falla (BLE, GPS, red), la app muestra un mensaje claro en español y NO se rompe.
6. La app es utilizable con lector de pantalla y con el tema de alto contraste.
7. No dejes código muerto, TODOs sin resolver ni datos falsos presentados como reales (p. ej., no inventes porcentajes de salud del hardware).

Empieza ahora por la Fase 1. Antes de escribir código, muestra en 10 líneas tu plan de archivos y luego impleméntalo sin pedirme confirmación.
