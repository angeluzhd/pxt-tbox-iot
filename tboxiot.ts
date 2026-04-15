/**
 * TBox IoT - Extensión MakeCode para micro:bit
 * Conecta el módulo WiFi EF05036 (BL602) a la plataforma TBox IoT
 * Compatible con: micro:bit v1 y v2
 */

// ─── Tipos y enumeraciones ───────────────────────────────────────────────────

//% color="#00BCD4" weight=95 icon="\uf1eb" block="TBox IoT"
namespace TBoxIoT {

    // Estado interno
    let _connected = false
    let _userToken = ""
    let _topicId = ""
    let _serverIP = ""
    let _switchOnHandler: (() => void) | null = null
    let _switchOffHandler: (() => void) | null = null
    let _initialized = false

    // Constantes de comandos AT hacia el BL602
    const CMD_CONNECT_WIFI = "WIFI:"
    const CMD_CONNECT_IOT = "IOT:"
    const CMD_UPLOAD = "UPLOAD:"
    const CMD_STATUS = "STATUS"
    const CMD_SWITCH_ON = "SWITCH:ON"
    const CMD_SWITCH_OFF = "SWITCH:OFF"

    // ─── Inicialización ──────────────────────────────────────────────────────

    /**
     * Inicializar puerto serial para comunicación con el módulo WiFi BL602
     * Conectar módulo a J1 (TX=P8, RX=P12) del Nezha board
     * @param txPin pin TX del micro:bit hacia el módulo, eg: SerialPin.P8
     * @param rxPin pin RX del micro:bit desde el módulo, eg: SerialPin.P12
     */
    //% block="Inicializar TBox IoT TX %txPin RX %rxPin"
    //% txPin.defl=SerialPin.P8
    //% rxPin.defl=SerialPin.P12
    //% weight=100
    //% group="1. Configuración"
    export function init(txPin: SerialPin, rxPin: SerialPin): void {
        serial.redirect(txPin, rxPin, BaudRate.BaudRate115200)
        basic.pause(500)
        _initialized = true

        // Listener permanente para recibir comandos desde la plataforma
        serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
            const msg = serial.readLine().trim()
            if (msg === CMD_SWITCH_ON) {
                _connected = true
                if (_switchOnHandler) _switchOnHandler()
            } else if (msg === CMD_SWITCH_OFF) {
                _connected = true
                if (_switchOffHandler) _switchOffHandler()
            } else if (msg === "IOT:OK") {
                _connected = true
            } else if (msg === "IOT:FAIL") {
                _connected = false
            }
        })
    }

    // ─── Conexión ────────────────────────────────────────────────────────────

    /**
     * Conectar a la red WiFi
     * @param ssid nombre de la red WiFi, eg: "MiRedWiFi"
     * @param password contraseña de la red, eg: "mi_clave_123"
     */
    //% block="Conectar WiFi red %ssid contraseña %password"
    //% weight=95
    //% group="2. Conexión"
    export function connectWifi(ssid: string, password: string): void {
        serial.writeLine(CMD_CONNECT_WIFI + ssid + ":" + password)
        basic.pause(3000)
    }

    /**
     * Conectar a la plataforma TBox IoT con Token y Topic
     * @param serverIP IP o dominio del servidor TBox, eg: "192.168.1.100"
    * @param token User Token de tu cuenta TBox, eg: "ABC123xyz"
     * @param topic Número de dispositivo (1-10), eg: 1
     */
    //% block="Conectar TBox servidor %serverIP token %token topic %topic"
    //% weight=90
    //% group="2. Conexión"
    export function connectTBox(serverIP: string, token: string, topic: number): void {
        _serverIP = serverIP
        _userToken = token
        _topicId = "" + topic
        // Formato: IOT:{ip}:{puerto}:{token}:{topic}
        serial.writeLine(CMD_CONNECT_IOT + serverIP + ":1883:" + token + ":" + topic)
        basic.pause(2000)
    }

    /**
     * ¿Está conectado a TBox IoT?
     */
    //% block="TBox conectado"
    //% weight=85
    //% group="2. Conexión"
    export function isConnected(): boolean {
        return _connected
    }

    // ─── Envío de datos ──────────────────────────────────────────────────────

    /**
     * Enviar un valor numérico al campo 1 de la plataforma
     * @param value valor a enviar, eg: 25
     */
    //% block="Enviar dato 1 = %value"
    //% weight=80
    //% group="3. Enviar Datos"
    export function sendField1(value: number): void {
        _sendPayload(`{"field1":${value}}`)
    }

    /**
     * Enviar un valor numérico al campo 2 de la plataforma
     * @param value valor a enviar, eg: 60
     */
    //% block="Enviar dato 2 = %value"
    //% weight=79
    //% group="3. Enviar Datos"
    export function sendField2(value: number): void {
        _sendPayload(`{"field2":${value}}`)
    }

    /**
     * Enviar múltiples campos a la vez (campo 1 y campo 2)
     * @param value1 valor del campo 1, eg: 25
     * @param value2 valor del campo 2, eg: 60
     */
    //% block="Enviar dato 1 = %value1 dato 2 = %value2"
    //% weight=78
    //% group="3. Enviar Datos"
    export function sendFields(value1: number, value2: number): void {
        _sendPayload(`{"field1":${value1},"field2":${value2}}`)
    }

    /**
     * Enviar un campo personalizado por número
     * @param fieldNum número de campo (1-5), eg: 3
     * @param value valor a enviar, eg: 100
     */
    //% block="Enviar campo %fieldNum valor %value"
    //% fieldNum.min=1 fieldNum.max=5
    //% weight=75
    //% group="3. Enviar Datos"
    export function sendField(fieldNum: number, value: number): void {
        _sendPayload(`{"field${fieldNum}":${value}}`)
    }

    // ─── Control remoto (plataforma → micro:bit) ─────────────────────────────

    /**
     * Ejecutar código cuando la plataforma enciende el switch
     */
    //% block="Cuando TBox encienda el switch"
    //% weight=70
    //% group="4. Control Remoto"
    export function onSwitchOn(handler: () => void): void {
        _switchOnHandler = handler
    }

    /**
     * Ejecutar código cuando la plataforma apague el switch
     */
    //% block="Cuando TBox apague el switch"
    //% weight=69
    //% group="4. Control Remoto"
    export function onSwitchOff(handler: () => void): void {
        _switchOffHandler = handler
    }

    // ─── Función interna ─────────────────────────────────────────────────────

    function _sendPayload(json: string): void {
        if (!_initialized) return
        // Formato: UPLOAD:{token}/{topic}/upload:{payload}
        serial.writeLine(
            CMD_UPLOAD + _userToken + "/" + _topicId + "/upload:" + json
        )
        basic.pause(100)
    }
}
