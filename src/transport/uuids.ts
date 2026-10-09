// Contrato BLE del firmware del ESP32. NO modificar.
// Todos los UUID van en minúsculas y todos los números multibyte son little-endian.

export const SERVICE_UUID = '7a1c0001-5b3e-4d8a-9c2f-0a1b2c3d4e5f';

export const CHAR_DISTANCE = '7a1c0002-5b3e-4d8a-9c2f-0a1b2c3d4e5f'; // uint16 cm, 0xFFFF = sin lectura
export const CHAR_BATTERY = '7a1c0003-5b3e-4d8a-9c2f-0a1b2c3d4e5f'; // uint8 %, 255 = desconocido
export const CHAR_BUTTON = '7a1c0004-5b3e-4d8a-9c2f-0a1b2c3d4e5f'; // uint8: 1=SOS, 2=encontrar celular
export const CHAR_CONFIG = '7a1c0005-5b3e-4d8a-9c2f-0a1b2c3d4e5f'; // [alertCm_lo, alertCm_hi, mode]
export const CHAR_COMMAND = '7a1c0006-5b3e-4d8a-9c2f-0a1b2c3d4e5f'; // uint8: 1=encontrar bastón, 2=autotest, 3=detener
export const CHAR_SELFTEST = '7a1c0007-5b3e-4d8a-9c2f-0a1b2c3d4e5f'; // uint8: 1=sensor responde, 0=sin lectura

/** Nombre anunciado por el bastón (prefijo de filtro). */
export const DEVICE_NAME_PREFIX = 'Hodegeo';

/** Valor centinela de "sin lectura" para la distancia (uint16). */
export const DISTANCE_NONE = 0xffff;

/** Valor centinela de "batería desconocida" (uint8). */
export const BATTERY_UNKNOWN = 0xff;
