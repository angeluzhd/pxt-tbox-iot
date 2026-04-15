# pxt-tbox-iot

Extensión MakeCode para conectar el **micro:bit** con el **módulo WiFi EF05036 (BL602)** a la plataforma **TBox IoT**.

## Hardware requerido

| Componente | Descripción |
|---|---|
| micro:bit v1 o v2 | Placa principal |
| Nezha Expansion Board | Placa de expansión con puertos RJ11 |
| Módulo WiFi EF05036 | Chip BL602, conectar en puerto J1 |

**Pines:**
```
TX módulo → P12 micro:bit
RX módulo → P8  micro:bit
```

## Instalación en MakeCode

1. Abrir makecode.microbit.org
2. Click en Extensions
3. Pegar URL del repositorio GitHub
4. Los bloques TBox IoT aparecerán en azul

## Bloques disponibles

### Configuración
```
TBoxIoT.init(SerialPin.P8, SerialPin.P12)
```

### Conexión
```
TBoxIoT.connectWifi("MiRedWiFi", "mi_clave")
TBoxIoT.connectTBox("192.168.1.100", "miToken123", 1)
TBoxIoT.isConnected()  // true o false
```

### Enviar Datos
```
TBoxIoT.sendField1(25)
TBoxIoT.sendField2(60)
TBoxIoT.sendFields(25, 60)
TBoxIoT.sendField(3, 100)
```

### Control Remoto
```
TBoxIoT.onSwitchOn(handler)
TBoxIoT.onSwitchOff(handler)
```

## Protocolo serial con BL602

| Comando enviado | Descripción |
|---|---|
| WIFI:ssid:password | Conectar WiFi |
| IOT:ip:1883:token:topic | Conectar MQTT |
| UPLOAD:token/topic/upload:{...} | Publicar datos |

| Respuesta recibida | Descripción |
|---|---|
| IOT:OK | Conexión exitosa |
| IOT:FAIL | Conexión fallida |
| SWITCH:ON | Switch activado remotamente |
| SWITCH:OFF | Switch desactivado remotamente |

## Licencia

MIT - TBox Planet 2024
