# Hodēgeō

App companion (PWA) del **bastón inteligente** para personas no videntes.
Proyecto **Pathfinders — Fundación Kinal, Guatemala**.

El bastón (ESP32 + HC-SR04 + buzzer + motor de vibración) detecta obstáculos y avisa por sí
solo. Esta app aporta lo que el bastón no tiene: **GPS, voz, contactos y envíos de emergencia**
desde el celular, comunicación por **Bluetooth Low Energy (BLE)** y una **demo completa sin
hardware** mediante un simulador.

> Todo el texto de la interfaz está en español. No hay backend: todo se guarda en `localStorage`.

---

## 1. Requisitos

- Node.js 18 o superior.
- Un navegador moderno. Para usar el **bastón real** se necesita **Chrome en Android**
  (o el navegador **Bluefy** en iPhone) y **contexto seguro** (HTTPS o `localhost`).

## 2. Instalar y ejecutar en desarrollo

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite (por defecto `http://localhost:5173`). En `localhost` la Web
Bluetooth y la geolocalización funcionan como contexto seguro.

## 3. Compilar para producción

```bash
npm run build
```

Genera la carpeta `dist/` con la app lista para publicar (incluye manifest y service worker de la
PWA). Puedes previsualizarla con:

```bash
npm run preview
```

## 4. Desplegar en Netlify (arrastrando la carpeta)

1. Ejecuta `npm run build`.
2. Entra a <https://app.netlify.com/drop>.
3. Arrastra la carpeta **`dist/`** completa a la zona de carga.
4. Netlify te dará una URL **HTTPS**; ábrela en Chrome Android para usar el bastón real.

> Las rutas de la PWA usan la raíz (`/`). Si publicas en un subdirectorio, ajusta `base` en
> `vite.config.ts`.

## 5. Usar el modo simulador (sin bastón)

Ideal para la feria o para desarrollar:

1. Abre la app. En la pantalla de conexión deja activado **«Usar modo simulador (sin bastón)»**.
2. Pulsa **«▶ Conectar simulador»**.
3. Usa el **Panel del simulador** (aparece en las pestañas Inicio/Bastón):
   - **Botón S.O.S (2 s)** y **Botón corto (encontrar celular)**.
   - **Obstáculo adelante** (baja la distancia a ~40 cm durante 3 s).
   - **Batería baja (15 %)**.
   - **Perder conexión** / **Restablecer conexión** (prueba la reconexión).

El simulador reproduce la lógica del firmware: distancias cada 200 ms, alertas por
buzzer/motor según el umbral y el modo, autotest, batería que baja lentamente, etc.

Para recorrer el S.O.S. completo primero crea **al menos un contacto de confianza** en la
pestaña **S.O.S**.

## 6. Probar con el bastón real

1. Publica la app en **HTTPS** (Netlify) o usa `localhost`.
2. Ábrela en **Chrome para Android** (o **Bluefy** en iPhone).
3. Enciende el bastón y activa **Bluetooth** y **ubicación** en el celular.
4. Desactiva el modo simulador y pulsa **«🔵 Conectar bastón»**; elige **«Hodegeo»**.
5. Concede permisos de **Bluetooth** y **ubicación** cuando el navegador los pida.

Si algo falla, la app muestra un mensaje claro en español y **no se rompe**. La pestaña
**Diagnóstico** tiene una consola en vivo (TX/RX/INFO/ERR en hexadecimal) y el estado de
Bluetooth para depurar con quien tenga el bastón.

## 7. Contrato BLE (firmware del ESP32)

Todos los números multibyte son **little-endian**. Todos los UUID van en minúsculas.

| Elemento | UUID | Propiedades | Formato |
|---|---|---|---|
| **Servicio Hodegeo** | `7a1c0001-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | — | — |
| Distancia | `7a1c0002-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | read, notify | `uint16` cm · `0xFFFF` = sin lectura |
| Batería | `7a1c0003-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | read, notify | `uint8` 0–100 % · `255` = desconocido |
| Evento de botón | `7a1c0004-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | notify | `uint8`: `1` = S.O.S · `2` = encontrar celular |
| Configuración | `7a1c0005-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | read, write | 3 bytes `[alertCm_lo, alertCm_hi, mode]` |
| Comando | `7a1c0006-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | write | `uint8`: `1` = encontrar bastón · `2` = autotest · `3` = detener |
| Resultado autotest | `7a1c0007-5b3e-4d8a-9c2f-0a1b2c3d4e5f` | notify | `uint8`: `1` = sensor responde · `0` = sin lectura |

`mode`: `0` = sonido + vibración · `1` = solo sonido · `2` = solo vibración.
El nombre anunciado por el bastón es `Hodegeo`. La implementación está en
`src/transport/BleTransport.ts` y los UUID en `src/transport/uuids.ts`.

## 8. Crear el bot de Telegram (envío automático opcional)

Telegram es el **único** canal de envío realmente automático (una web no puede enviar SMS/WhatsApp
sin intervención del usuario).

1. Abre Telegram y habla con **@BotFather**.
2. Envía `/newbot` y sigue las instrucciones. Copia el **token** (p. ej. `123456:ABC-DEF…`).
3. Envía un mensaje cualquiera a tu nuevo bot.
4. Abre en el navegador:
   `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
   y copia el valor de `result[0].message.chat.id` (el **chat_id**).
5. Pega **token** y **chat_id** en la app (pestaña **Bastón → Telegram**) y pulsa
   **«Enviar mensaje de prueba»**.

Si está configurado, al terminar la cuenta regresiva del S.O.S. se envían automáticamente el
mensaje y la ubicación.

> **Para no escribirlo en la feria:** copia `.env.example` a `.env`, rellena
> `VITE_TELEGRAM_TOKEN` y `VITE_TELEGRAM_CHAT_ID`, y esos valores se precargan solos (solo si
> aún no los configuraste en el dispositivo). El `.env` está en `.gitignore`; **ojo**: al
> compilar quedan dentro del JavaScript del sitio, así que si el token se filtra, revócalo en
> BotFather con `/revoke`.

## 9. Estructura del proyecto

```
src/
  transport/   types.ts · BleTransport.ts · SimTransport.ts · uuids.ts · index.ts
  services/    geo.ts · sos.ts · telegram.ts · voice.ts · audio.ts · storage.ts · wakelock.ts
  state/       store.ts · useStore.ts · appTypes.ts
  screens/     Connect · Home · Sos · Cane · History · Diagnostics
  components/  DistanceGauge · LiveChart · BatteryIcon · StatusChip · TabBar · SimPanel · ...
  styles/      theme.css · global.css
scripts/       generate-icons.mjs   (genera los PNG de la PWA)
```

## 10. Regenerar los íconos de la PWA

```bash
node scripts/generate-icons.mjs
```

Genera `public/pwa-192.png` y `public/pwa-512.png` sin dependencias externas.

## 11. Limitaciones conocidas

- **Envío de SMS/WhatsApp**: por seguridad, el navegador **no puede enviarlos automáticamente**.
  La pantalla final del S.O.S. abre WhatsApp/SMS con el mensaje ya redactado para que el usuario
  confirme el envío. Solo **Telegram** es automático.
- **Web Bluetooth** solo funciona en Chrome (Android/escritorio) y Bluefy (iPhone), y requiere
  **HTTPS** o `localhost`. Safari iOS y Firefox no lo soportan.
- **Geolocalización**: requiere permiso del usuario y GPS/ubicación activados; la precisión depende
  del dispositivo. Si falla, el S.O.S. usa la última ubicación conocida y lo advierte.
- **Sin conexión**: el shell de la app funciona offline (PWA), pero el **mapa** (OpenStreetMap) y
  los **envíos por Telegram** necesitan internet.
- El bastón **no tiene GPS ni internet**: la ubicación, la voz y los contactos los aporta el celular.
- No se detectan **desniveles o vacíos**: el sensor es ultrasónico frontal; la app no inventa esa
  detección.

---

Proyecto Hodēgeō — Pathfinders · Fundación Kinal.
