/**
 * TBox IoT - Extensión MakeCode para micro:bit
 * Módulo WiFi EF05036 (BL602/ESP8266) → servidor TBox IoT vía HTTP
 * Basado en el protocolo real AT de ELECFREAKS PlanetX IoT
 */

//% color="#00BCD4" weight=95 icon="\uf1eb" block="TBox IoT"
namespace TBoxIoT {

    // ─── Estado interno ───────────────────────────────────────────────────────
    let _wifi_connected = false
    let _iot_connected = false
    let _token = ""
    let _topic = ""
    let _host = "http://192.168.1.100"
    let _port = 8080
    let _sendMsg = ""
    let _lastSendTime = 0
    let _switchStatus = false
    let _switchListening = false

    // Buffer para recibir respuestas seriales
    let _strBuf = ""

    type HandlerMap = { [key: string]: { type: number, handler?: (res: string) => void, msg?: string } }
    const _handlers: HandlerMap = {}

    // ─── Serial listener interno ──────────────────────────────────────────────
    function _serialHandler() {
        const str = _strBuf + serial.readString()
        let splits = str.split("\n")
        if (str.charCodeAt(str.length - 1) != 10) {
            _strBuf = splits.pop()
        } else {
            _strBuf = ""
        }
        for (let i = 0; i < splits.length; i++) {
            const res = splits[i]
            Object.keys(_handlers).forEach(key => {
                if (res.includes(key)) {
                    if (_handlers[key].type == 0 && _handlers[key].handler) {
                        _handlers[key].handler(res)
                    } else {
                        _handlers[key].msg = res
                    }
                }
            })
        }
    }

    // ─── Funciones AT internas ────────────────────────────────────────────────
    function _sendAT(command: string, wait: number = 0) {
        serial.writeString(command + "\r\n")
        basic.pause(wait)
    }

    function _waitResponse(key: string, wait: number = 1000): string {
        let timeout = input.runningTime() + wait
        _handlers[key] = { type: 1 }
        while (timeout > input.runningTime()) {
            if (_handlers[key] == null) return null
            if (_handlers[key].msg) {
                const res = _handlers[key].msg
                delete _handlers[key]
                return res
            }
            basic.pause(5)
        }
        delete _handlers[key]
        return null
    }

    function _sendRequest(command: string, key: string, wait: number = 1000): string {
        serial.writeString(command + "\r\n")
        return _waitResponse(key, wait)
    }

    function _registerHandler(key: string, handler: (res: string) => void) {
        _handlers[key] = { type: 0, handler }
    }

    function _buildUrl(path: string): string {
        return `AT+HTTPCLIENT=2,0,"${_host}:${_port}${path}",,,1`
    }

    function _resetModule() {
        _sendRequest("AT+RESTORE", "ready", 2000)
        _sendRequest("AT+RST", "ready", 2000)
        _sendRequest("AT+CWMODE=1", "OK", 1000)
    }

    // ─── CONFIGURACIÓN ────────────────────────────────────────────────────────

    /**
     * Inicializar módulo WiFi EF05036 en el puerto J1 del Nezha board
     * Llama este bloque una sola vez al iniciar
     */
    //% block="Inicializar TBox IoT en puerto J1"
    //% weight=100
    //% group="1. Configuración"
    export function init(): void {
        // Puerto J1 del Nezha: TX=P8, RX=P1
        serial.redirect(SerialPin.P8, SerialPin.P1, BaudRate.BaudRate115200)
        serial.setTxBufferSize(128)
        serial.setRxBufferSize(128)
        serial.onDataReceived(serial.delimiters(Delimiters.NewLine), _serialHandler)
        _resetModule()
    }

    /**
     * Configurar IP y puerto del servidor TBox IoT
     * @param host IP o dominio del servidor, eg: "http://192.168.1.100"
     * @param port puerto del servidor, eg: 8080
     */
    //% block="Servidor TBox %host puerto %port"
    //% host.defl="http://192.168.1.100"
    //% port.defl=8080
    //% weight=98
    //% group="1. Configuración"
    export function setServer(host: string, port: number): void {
        _host = host
        _port = port
    }

    // ─── CONEXIÓN ─────────────────────────────────────────────────────────────

    /**
     * Conectar a la red WiFi
     * @param ssid nombre de la red WiFi, eg: "MiRed"
     * @param password contraseña, eg: "mi_clave"
     */
    //% block="Conectar WiFi red %ssid contraseña %password"
    //% ssid.defl="MiRedWiFi"
    //% password.defl="mi_clave"
    //% weight=95
    //% group="2. Conexión"
    export function connectWifi(ssid: string, password: string): void {
        _registerHandler("WIFI DISCONNECT", () => _wifi_connected = false)
        _registerHandler("WIFI GOT IP", () => _wifi_connected = true)
        let retries = 3
        while (true) {
            _sendAT(`AT+CWJAP="${ssid}","${password}"`)
            pauseUntil(() => _wifi_connected, 3500)
            if (!_wifi_connected && --retries > 0) {
                _resetModule()
            } else {
                break
            }
        }
    }

    /**
     * Conectar a la plataforma TBox IoT con Token y Topic
     * @param token User Token de tu cuenta, eg: "ABC123xyz"
     * @param topic número de dispositivo (1-10), eg: 1
     */
    //% block="Conectar TBox token %token topic %topic"
    //% token.defl="miToken123"
    //% topic.defl=1
    //% weight=90
    //% group="2. Conexión"
    export function connectTBox(token: string, topic: number): void {
        _token = token
        _topic = "" + topic
        for (let i = 0; i < 3; i++) {
            const ret = _sendRequest(
                _buildUrl(`/iot/iotTopic/getTopicStatus/${_token}/${_topic}`),
                '"code":200',
                2000
            )
            if (ret != null) {
                _iot_connected = true
                if (ret.includes('switchOn')) {
                    _switchStatus = true
                }
                return
            }
        }
        _iot_connected = false
    }

    /**
     * ¿Está conectado el WiFi?
     */
    //% block="WiFi conectado"
    //% weight=85
    //% group="2. Conexión"
    export function isWifiConnected(): boolean {
        return _wifi_connected
    }

    /**
     * ¿Está conectado a TBox IoT?
     */
    //% block="TBox conectado"
    //% weight=84
    //% group="2. Conexión"
    export function isTBoxConnected(): boolean {
        return _iot_connected
    }

    // ─── ENVIAR DATOS ─────────────────────────────────────────────────────────

    /**
     * Preparar datos para enviar (campos 1 y 2)
     * @param d1 valor del campo 1, eg: 0
     * @param d2 valor del campo 2, eg: 0
     */
    //% block="Preparar datos campo 1 = %d1 campo 2 = %d2"
    //% weight=80
    //% group="3. Enviar Datos"
    export function setData(d1: number, d2: number = 0): void {
        _sendMsg = _buildUrl(
            `/iot/iotTopicData/addTopicData?userToken=${_token}&topicName=${_topic}&data1=${d1}&data2=${d2}`
        )
    }

    /**
     * Preparar datos para enviar (hasta 5 campos)
     * @param d1 campo 1, eg: 0
     * @param d2 campo 2, eg: 0
     * @param d3 campo 3, eg: 0
     * @param d4 campo 4, eg: 0
     * @param d5 campo 5, eg: 0
     */
    //% block="Preparar datos 1=%d1 2=%d2 3=%d3 4=%d4 5=%d5"
    //% weight=78
    //% group="3. Enviar Datos"
    export function setDataFull(d1: number, d2: number = 0, d3: number = 0, d4: number = 0, d5: number = 0): void {
        _sendMsg = _buildUrl(
            `/iot/iotTopicData/addTopicData?userToken=${_token}&topicName=${_topic}`
            + `&data1=${d1}&data2=${d2}&data3=${d3}&data4=${d4}&data5=${d5}`
        )
    }

    /**
     * Enviar los datos preparados a TBox IoT
     */
    //% block="Enviar datos a TBox"
    //% weight=75
    //% group="3. Enviar Datos"
    export function uploadData(): void {
        if (!_iot_connected) return
        // Respetar mínimo 1 segundo entre envíos
        basic.pause(_lastSendTime + 1000 - input.runningTime())
        _sendAT(_sendMsg)
        _lastSendTime = input.runningTime()
    }

    // ─── CONTROL REMOTO ───────────────────────────────────────────────────────

    /**
     * Ejecutar código cuando la plataforma enciende el switch
     */
    //% block="Cuando TBox encienda el switch"
    //% weight=70
    //% group="4. Control Remoto"
    export function onSwitchOn(handler: () => void): void {
        _registerHandler('{"code":200,"msg":null,"data":"switchOn"}', () => {
            if (_iot_connected && !_switchStatus) {
                handler()
            }
            _switchStatus = true
        })
        _startSwitchPolling()
    }

    /**
     * Ejecutar código cuando la plataforma apague el switch
     */
    //% block="Cuando TBox apague el switch"
    //% weight=69
    //% group="4. Control Remoto"
    export function onSwitchOff(handler: () => void): void {
        _registerHandler('{"code":200,"msg":null,"data":"switchOff"}', () => {
            if (_iot_connected && _switchStatus) {
                handler()
            }
            _switchStatus = false
        })
        _startSwitchPolling()
    }

    function _startSwitchPolling(): void {
        if (_switchListening) return
        _switchListening = true
        // Consultar estado del switch cada 1 segundo
        basic.forever(() => {
            if (_iot_connected) {
                _sendAT(_buildUrl(`/iot/iotTopic/getTopicStatus/${_token}/${_topic}`))
            }
            basic.pause(1000)
        })
    }
}
