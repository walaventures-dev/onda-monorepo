# API del servidor local POS

Servidor HTTP que expone el SDK ZCS SmartPOS en el propio dispositivo.

|                      |                                  |
| -------------------- | -------------------------------- |
| Base                 | `http://127.0.0.1:8080`          |
| Bind                 | solo loopback (`127.0.0.1`)      |
| Formato              | `application/json`               |
| CORS                 | `Access-Control-Allow-Origin: *` |
| Métodos              | `GET`, `POST`, `OPTIONS`         |
| Cabeceras permitidas | `Content-Type`                   |

Las llamadas al SDK se ejecutan en serie. Una petición espera a que termine la anterior.

El ping interno (`getVersion`, y `sysInit` si falla) se repite cada 5 minutos. Si el SDK no respondió en ese intervalo, la siguiente acción lo vuelve a comprobar antes de ejecutarse.

## Convenciones

### Sobre de respuesta de una acción

Toda ruta `POST /v1/...` que llega al SDK responde `200` con este objeto, también cuando la operación del hardware falla. El fallo del SDK va en `code`, no en el status HTTP.

```json
{
  "code": 0,
  "message": "",
  "response": ""
}
```

| Campo      | Tipo   | Descripción                                                                    |
| ---------- | ------ | ------------------------------------------------------------------------------ |
| `code`     | entero | `0` es éxito. Cualquier otro valor es un código del SDK o un error del puente. |
| `message`  | string | Texto de estado. Vacío si no hay mensaje.                                      |
| `response` | string | Dato de la operación. Vacío si la operación no devuelve payload.               |

Códigos propios del puente, distintos de los del SDK:

| `code` | Cuándo                                                                       |
| ------ | ---------------------------------------------------------------------------- |
| `-1`   | Cuerpo inválido, campo faltante, excepción del canal nativo o error interno. |
| `-2`   | Tiempo de espera agotado en `readNfcTag` (60 s) o en `readQr`.               |

### Errores HTTP

Estos casos no llegan al SDK.

**400** — el cuerpo no es un objeto JSON:

```json
{ "code": -1, "message": "El cuerpo debe ser un objeto JSON", "response": "" }
```

**400** — falta un campo obligatorio (`{campo}` es el nombre):

```json
{ "code": -1, "message": "Falta el campo {campo}", "response": "" }
```

**400** — un entero no se puede parsear:

```json
{ "code": -1, "message": "El campo {campo} debe ser un entero", "response": "" }
```

**400** — `enable` no es booleano:

```json
{ "code": -1, "message": "El campo enable debe ser booleano", "response": "" }
```

**503** — el SDK no responde al ping:

```json
{ "code": -1, "message": "SDK no responde", "response": "" }
```

**204** — cualquier `OPTIONS` (preflight CORS), sin cuerpo.

Una ruta desconocida responde **404** de Shelf, sin el sobre JSON.

### Tipos de campos

Los enteros (`length`, `block`, `keyIndex`, `mode`, `timeout`, `slot`) aceptan número JSON o string numérico (`60` o `"60"`).

`enable` acepta booleano JSON o los strings `"true"` y `"false"`.

El resto de campos se convierte a string.

`text` e `image` son opcionales. Si faltan o llegan vacíos, el método usa su valor por defecto.

Las claves hexadecimales (`masterKey`, `pinKey`, `macKey`, `tdkKey`, `data`, `password`) son strings de dígitos hex pares, sin espacios ni prefijo `0x`.

### Lecturas que esperan tarjeta

`readBankCard`, `readContactlessCard`, `readM1Card` y `writeM1Card` buscan tarjeta hasta 60 segundos. La petición HTTP permanece abierta hasta que hay tarjeta, error o el SDK corta la búsqueda. `searchCard` y `readQr` usan el `timeout` del cuerpo, en segundos. `readQr` usa 60 s si omites `timeout`.

---

## `GET /health`

Estado del proceso y del último ping al SDK. No llama al hardware.

**Respuesta 200**

```json
{
  "ok": true,
  "initialized": true,
  "lastPongAt": "2026-09-23T20:00:00.000",
  "sdkReachable": true
}
```

| Campo          | Tipo            | Descripción                                                         |
| -------------- | --------------- | ------------------------------------------------------------------- |
| `ok`           | boolean         | Siempre `true` si el servidor contesta.                             |
| `initialized`  | boolean         | Igual que `sdkReachable`.                                           |
| `lastPongAt`   | string o `null` | Fecha ISO-8601 del último ping correcto. `null` si nunca hubo ping. |
| `sdkReachable` | boolean         | El último `getVersion` devolvió `code` 0.                           |

---

## `GET /v1`

Catálogo de acciones. No llama al hardware.

**Respuesta 200**

```json
{
  "endpoints": [{ "method": "POST", "path": "/v1/sysInit", "body": [] }]
}
```

| Campo                | Tipo     | Descripción                                                       |
| -------------------- | -------- | ----------------------------------------------------------------- |
| `endpoints`          | array    | Una entrada por acción.                                           |
| `endpoints[].method` | string   | Siempre `"POST"`.                                                 |
| `endpoints[].path`   | string   | Ruta absoluta.                                                    |
| `endpoints[].body`   | string[] | Nombres de campos que acepta el cuerpo. Vacío si no lleva cuerpo. |

---

## Acciones `POST /v1/{método}`

Si `body` está vacío, el cuerpo puede omitirse. Si tiene campos, el cuerpo es un objeto JSON.

### Sistema

#### `POST /v1/sysInit`

Inicializa el SDK. Si el primer intento falla, enciende el sistema, espera 1 s y reintenta.

Cuerpo: ninguno.

**200 éxito**

```json
{ "code": 0, "message": "System initialized successfully", "response": "" }
```

**200 fallo del SDK**

```json
{ "code": 1, "message": "System initialization failed, error code: 1", "response": "" }
```

`code` es el código que devuelve `sdkInit`.

#### `POST /v1/getVersion`

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "2.0.8" }
```

`response` es el string de versión del SDK (`sys.sdkVersion`).

#### `POST /v1/getSN`

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "SN123456789" }
```

`response` es el número de serie. Vacío si `code` no es 0.

#### `POST /v1/showLog`

Activa o desactiva el log detallado del SDK.

```json
{ "enable": true }
```

| Campo    | Tipo    | Obligatorio |
| -------- | ------- | ----------- |
| `enable` | boolean | sí          |

**200**

```json
{ "code": 0, "message": "Log enabled", "response": "" }
```

Con `enable: false`, `message` es `"Log disabled"`.

#### `POST /v1/emvInit`

Inicializa el kernel EMV con parámetros de terminal por defecto.

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "EMV initialization completed", "response": "" }
```

---

### Impresora y caja

#### `POST /v1/printString`

Imprime texto centrado, tamaño 24, y tres líneas en blanco.

```json
{ "text": "Hola" }
```

| Campo  | Tipo   | Obligatorio |
| ------ | ------ | ----------- |
| `text` | string | no          |

Si `text` falta o está en blanco, imprime `测试打印字符串` y `Test Print String`.

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

`code` es el resultado de `setPrintStart`. Si no es 0 y no hay mensaje propio, `message` es `"Operation failed, error code: {code}"`.

#### `POST /v1/printImage`

Imprime el bitmap embebido `print_demo.bmp`, centrado.

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

#### `POST /v1/printReceipt`

Imprime un recibo de demostración fijo (comprobio de ejemplo en chino, comercio de prueba, tarjeta enmascarada, monto ￥100.00).

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

#### `POST /v1/openCutter`

Acciona el cortador (`openPrnCutter(1)`).

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

#### `POST /v1/openCashBox`

Abre el cajón de dinero.

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

#### `POST /v1/is80MMPrinter`

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "true" }
```

`response` es el string `"true"` o `"false"`.

#### `POST /v1/setPrintLabelLength`

```json
{ "length": 400 }
```

| Campo    | Tipo   | Obligatorio |
| -------- | ------ | ----------- |
| `length` | entero | sí          |

**200 éxito**

```json
{ "code": 0, "message": "Label length set to 400", "response": "" }
```

**200 fallo**

```json
{ "code": 1, "message": "Set label length failed", "response": "" }
```

#### `POST /v1/printLabel`

Imprime la etiqueta embebida `label_photo_demo.bmp`. Comprueba antes que la impresora esté lista.

Cuerpo: ninguno.

**200 éxito**

```json
{ "code": 0, "message": "Print label success", "response": "" }
```

**200 impresora no lista**

```json
{ "code": 1, "message": "Printer not ready, status: 1", "response": "" }
```

**200 fallo de impresión**

```json
{ "code": 1, "message": "Print label failed", "response": "" }
```

---

### Pantalla secundaria

Hay dos salidas distintas.

La pantalla grande del cliente solo acepta una imagen JPEG. El puente la encaja en 480×480 con fondo negro y el SDK la deja en 480 px de ancho, recomprimida a menos de 100 KB. No admite vídeo.

El LCD pequeño (128×64, el de `showStringOnLcd`) solo recibe texto. No es la pantalla grande.

#### `POST /v1/secondaryScreenImage`

Muestra una imagen en la pantalla grande. Con `image`, esa imagen se muestra ahora y queda guardada como imagen de bienvenida del equipo (`setSecondaryScreenDefaultBitmap`). Sin `image`, muestra `secondscreen/test_secondary_screen2.jpg` y no cambia la imagen guardada.

```json
{ "image": "<jpeg en base64>" }
```

| Campo   | Tipo   | Obligatorio | Notas                                                                                                            |
| ------- | ------ | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `image` | string | no          | JPEG en base64, o data URL `data:image/jpeg;base64,...`. Si falta o está vacío se usa la imagen de demostración. |

**200 imagen de bienvenida reemplazada**

```json
{ "code": 0, "message": "Welcome image replaced", "response": "" }
```

**200 solo demostración, sin `image`**

```json
{ "code": 0, "message": "Secondary screen display image success", "response": "" }
```

**200 fallo al mostrarla**

```json
{ "code": 1, "message": "Secondary screen display image failed", "response": "" }
```

**200 se mostró, pero no se guardó como bienvenida**

```json
{ "code": 1, "message": "Set welcome image failed", "response": "" }
```

**200 imagen ilegible**

```json
{ "code": -1, "message": "Invalid image", "response": "" }
```

Un base64 inválido responde `code` `-1` y `message` `"Secondary screen image error: ..."`.

#### `POST /v1/secondaryScreenString`

Escribe texto en el LCD pequeño, en el origen `(0, 0)`. No cambia la imagen de la pantalla grande.

```json
{ "text": "Bienvenido" }
```

| Campo  | Tipo   | Obligatorio |
| ------ | ------ | ----------- |
| `text` | string | no          |

Si falta o está en blanco, muestra `Welcome to ZCS POS`.

**200**

```json
{ "code": 0, "message": "Secondary screen display string success", "response": "" }
```

---

### Escáner

#### `POST /v1/scanHeadPowerOn`

Enciende el cabezal de escaneo QR (ciclo de apagado y encendido). No espera un código.

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

#### `POST /v1/readQr`

Enciende el sensor, abre el escáner, espera un QR o código de barras y apaga el sensor al terminar. La petición permanece abierta hasta la lectura, el error o el tiempo de espera.

```json
{ "timeout": 60 }
```

| Campo     | Tipo   | Obligatorio | Notas                                         |
| --------- | ------ | ----------- | --------------------------------------------- |
| `timeout` | entero | no          | Segundos. Si falta, 60. Debe ser mayor que 0. |

**200 lectura**

```json
{ "code": 0, "message": "", "response": "https://ejemplo.com/pago" }
```

`response` es el texto del código, hasta 1024 bytes.

**200 tiempo agotado**

```json
{ "code": -2, "message": "QR read timeout (60s)", "response": "" }
```

**200 el escáner no conecta**

```json
{ "code": 1, "message": "QR scanner connect failed", "response": "" }
```

**200 la decodificación falla**

```json
{ "code": 1, "message": "QR read failed", "response": "" }
```

**400** si `timeout` no es un entero o es menor que 1.

---

### Llaves del PIN pad

Las llaves son hex. La longitud en bytes es la mitad de la longitud del string.

#### `POST /v1/downloadMasterKey`

```json
{ "keyIndex": 0, "masterKey": "00112233445566778899AABBCCDDEEFF" }
```

| Campo       | Tipo       | Obligatorio |
| ----------- | ---------- | ----------- |
| `keyIndex`  | entero     | sí          |
| `masterKey` | string hex | sí          |

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

`code` es el resultado de `pinPadUpMastKey`.

#### `POST /v1/downloadWorkKey`

```json
{
  "keyIndex": 0,
  "pinKey": "00112233445566778899AABBCCDDEEFF",
  "macKey": "00112233445566778899AABBCCDDEEFF",
  "tdkKey": "00112233445566778899AABBCCDDEEFF"
}
```

| Campo      | Tipo       | Obligatorio |
| ---------- | ---------- | ----------- |
| `keyIndex` | entero     | sí          |
| `pinKey`   | string hex | sí          |
| `macKey`   | string hex | sí          |
| `tdkKey`   | string hex | sí          |

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

`code` es el resultado de `pinPadUpWorkKey`.

---

### Tarjetas

#### `POST /v1/readBankCard`

Busca banda magnética hasta 60 s y lee las pistas.

Cuerpo: ninguno.

**200 éxito** — `response` es texto multilínea, solo con los campos presentes:

```json
{
  "code": 0,
  "message": "",
  "response": "Resultcode: 0\nCard type: MAG_CARD\nCard no: 6214440000007816\nTrack1: ...\nTrack2: ...\nTrack3: ...\nExpiredDate: 2512\nServiceCode: 101"
}
```

Líneas posibles, en este orden:

| Línea                 | Origen                                  |
| --------------------- | --------------------------------------- |
| `Resultcode: {n}`     | siempre                                 |
| `Card type: {enum}`   | slot de la tarjeta, si existe           |
| `Card no: {pan}`      | número de tarjeta, si existe            |
| `Rf card type: {n}`   | solo si el tipo RF no es 0              |
| `RFUid: {texto}`      | UID interpretado como string, si existe |
| `Atr: {atr}`          | ATR, si existe                          |
| `Track1: {tk1}`       | pista 1                                 |
| `Track2: {tk2}`       | pista 2                                 |
| `Track3: {tk3}`       | pista 3                                 |
| `ExpiredDate: {yyMM}` | fecha de expiración                     |
| `ServiceCode: {n}`    | código de servicio                      |

**200 error de búsqueda**

```json
{ "code": 1, "message": "Card search failed", "response": "" }
```

**200 lectura fallida**

```json
{ "code": 1, "message": "Read magnetic card failed, error code: 1", "response": "" }
```

#### `POST /v1/readContactlessCard`

Busca tarjeta RF Type A o Type B (máscara `0x03`) hasta 60 s, hace reset y envía el SELECT PPSE (`2PAY.SYS.DDF01`).

Cuerpo: ninguno.

**200 éxito**

```json
{
  "code": 0,
  "message": "",
  "response": "卡类型: TypeA\nAPDU响应: 6f1a840e325041592e5359532e4444463031a5088801025f2d02656e9000"
}
```

`卡类型` es `TypeA` (`0x01`), `TypeB` (`0x02`), `FeliCa` (`0x04`) o `Unknown({n})`. `APDU响应` es la respuesta APDU en hex.

**200 fallos**

```json
{ "code": 1, "message": "Card search failed", "response": "" }
```

```json
{ "code": 1, "message": "RF card reset failed", "response": "" }
```

```json
{ "code": 1, "message": "APDU exchange failed", "response": "" }
```

#### `POST /v1/readNfcTag`

Espera un tag NFC del sistema Android hasta 60 s. No usa el lector RF del SDK.

Cuerpo: ninguno.

**200 éxito**

```json
{
  "code": 0,
  "message": "",
  "response": "TagId: 04A1B2C3\nContent: texto NDEF"
}
```

`TagId` es el id del tag en hex. `Content` es el texto NDEF leído; puede ir vacío.

**200 timeout**

```json
{ "code": -2, "message": "NFC tag read timeout (60s)", "response": "" }
```

**200 NFC no disponible o error de lectura** — el canal nativo lo traduce el puente a:

```json
{ "code": -1, "message": "NFC not available", "response": "" }
```

#### `POST /v1/readM1Card`

Busca Mifare Classic (Type A) hasta 60 s, autentica el sector 10 con la clave A `FFFFFFFFFFFF` y lee sus 4 bloques (40 a 43).

Cuerpo: ninguno.

**200 éxito**

```json
{
  "code": 0,
  "message": "",
  "response": "Block0: 00112233445566778899AABBCCDDEEFF\nBlock1: ...\nBlock2: ...\nBlock3: ...\n"
}
```

Cada bloque son 16 bytes en hex.

**200 fallos**

```json
{ "code": 1, "message": "Card search failed", "response": "" }
```

```json
{ "code": 1, "message": "Verify sector 10 key failed", "response": "" }
```

```json
{ "code": 1, "message": "Read block data failed", "response": "" }
```

#### `POST /v1/writeM1Card`

Busca Mifare Classic hasta 60 s, autentica con clave A el sector del bloque indicado y escribe 16 bytes.

```json
{
  "block": 40,
  "data": "00112233445566778899AABBCCDDEEFF",
  "password": "FFFFFFFFFFFF"
}
```

| Campo      | Tipo       | Obligatorio | Notas                                                                          |
| ---------- | ---------- | ----------- | ------------------------------------------------------------------------------ |
| `block`    | entero     | sí          | El sector es `block / 4`. La clave se verifica en el primer bloque del sector. |
| `data`     | string hex | sí          | Se recorta o se rellena con ceros hasta 16 bytes.                              |
| `password` | string hex | sí          | Clave A, normalmente 6 bytes (`12` caracteres hex).                            |

**200 éxito**

```json
{ "code": 0, "message": "Write success, block 40", "response": "" }
```

**200 fallos**

```json
{ "code": 1, "message": "Write failed", "response": "" }
```

```json
{ "code": 1, "message": "Verify sector 10 key failed", "response": "" }
```

```json
{ "code": 1, "message": "Card search failed", "response": "" }
```

#### `POST /v1/searchCard`

Busca un tipo de tarjeta. El tiempo de espera del SDK es `timeout` segundos.

```json
{ "mode": 0, "timeout": 60 }
```

| Campo     | Tipo   | Obligatorio | Valores                                                                                               |
| --------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| `mode`    | entero | sí          | `0` banda magnética, `1` chip de contacto, `2` contactless. Cualquier otro valor se trata como banda. |
| `timeout` | entero | sí          | Segundos.                                                                                             |

**200 éxito**

```json
{ "code": 0, "message": "", "response": "寻卡成功: 6214440000007816=2512101" }
```

`response` incluye la pista 2 si el SDK la trae. Puede quedar vacío después de los dos puntos.

**200 fallo**

```json
{ "code": 1, "message": "Card search failed", "response": "" }
```

#### `POST /v1/iccReset`

Reset de un slot de chip.

```json
{ "slot": 0 }
```

| Campo  | Tipo   | Obligatorio | Valores                                                                                  |
| ------ | ------ | ----------- | ---------------------------------------------------------------------------------------- |
| `slot` | entero | sí          | `0` tarjeta de usuario, `1` SAM1, `2` SAM2. Cualquier otro valor usa el slot de usuario. |

**200**

```json
{ "code": 0, "message": "", "response": "" }
```

`code` es el resultado de `icCardReset`.

#### `POST /v1/rfReset`

Apaga el campo del lector contactless.

Cuerpo: ninguno.

**200**

```json
{ "code": 0, "message": "RF card powered down", "response": "" }
```

---

## Índice

| Método | Ruta                        | Cuerpo                                   |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/health`                   | —                                        |
| GET    | `/v1`                       | —                                        |
| POST   | `/v1/sysInit`               | —                                        |
| POST   | `/v1/getVersion`            | —                                        |
| POST   | `/v1/getSN`                 | —                                        |
| POST   | `/v1/showLog`               | `enable`                                 |
| POST   | `/v1/printString`           | `text` opcional                          |
| POST   | `/v1/printImage`            | —                                        |
| POST   | `/v1/printReceipt`          | —                                        |
| POST   | `/v1/openCutter`            | —                                        |
| POST   | `/v1/openCashBox`           | —                                        |
| POST   | `/v1/printLabel`            | —                                        |
| POST   | `/v1/setPrintLabelLength`   | `length`                                 |
| POST   | `/v1/is80MMPrinter`         | —                                        |
| POST   | `/v1/scanHeadPowerOn`       | —                                        |
| POST   | `/v1/readQr`                | `timeout` opcional                       |
| POST   | `/v1/downloadMasterKey`     | `keyIndex`, `masterKey`                  |
| POST   | `/v1/downloadWorkKey`       | `keyIndex`, `pinKey`, `macKey`, `tdkKey` |
| POST   | `/v1/readBankCard`          | —                                        |
| POST   | `/v1/readContactlessCard`   | —                                        |
| POST   | `/v1/readNfcTag`            | —                                        |
| POST   | `/v1/readM1Card`            | —                                        |
| POST   | `/v1/writeM1Card`           | `block`, `data`, `password`              |
| POST   | `/v1/emvInit`               | —                                        |
| POST   | `/v1/searchCard`            | `mode`, `timeout`                        |
| POST   | `/v1/iccReset`              | `slot`                                   |
| POST   | `/v1/rfReset`               | —                                        |
| POST   | `/v1/secondaryScreenImage`  | `image` opcional                         |
| POST   | `/v1/secondaryScreenString` | `text` opcional                          |
