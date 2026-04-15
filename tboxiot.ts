/**
 * TBox IoT - Extensión MakeCode para micro:bit
 * Módulo WiFi EF05036 (BL602/ESP8266) → servidor TBox IoT vía HTTP
 * Compatible con: micro:bit v1 y v2 + Nezha Expansion Board
 */

//% color="#00BCD4" weight=95 icon="\uf1eb" block="TBox IoT"
namespace TBoxIoT {

    // ─── Enumeraciones públicas ───────────────────────────────────────────────

    export enum RJPort {
        //% block="J1"
        J1,
        //% block="J2"
        J2,
        //% block="J3"
        J3,
        //% block="J4"
        J4
    }

    export enum WifiState {
        //% block="true"
        Connected = 1,
        //% block="false"
        Disconnected = 0
    }

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
    let _strBuf = ""

    // Sistema de handlers (igual al patrón oficial ELECFREAKS)
    type HandlerEntry = {
        type: number,          // 0 = async callback, 1 = sync wait
        handler?: (res: string) => void,
        msg?: string
    }
    const _handlers: { [key: string]: HandlerEntry } = {}

    // ─── Listener serial con buffer (patrón oficial) ──────────────────────────
    function _serialHandler(): void {
        const str = _strBuf + serial.readString()
        let splits = str.split("\n")
        // Si el último carácter NO es \n, el último fragmento está incompleto
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
                    } else if (_handlers[key].type == 1) {
                        _handlers[key].msg = res
                    }
                }
            })
        }
    }

    // ─── Funciones AT internas ────────────────────────────────────────────────
    function _sendAT(command: string, wait: number = 0): void {
        serial.writeString(command + "\r\n")
        if (wait > 0) basic.pause(wait)
    }

    function _registerHandler(key: string, handler: (res: string) => void): void {
        _handlers[key] = { type: 0, handler }
    }

    function _removeHandler(key: string): void {
        delete _handlers[key]
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

    function _resetModule(): void {
        _sendRequest("AT+RESTORE", "ready", 2000)
        _sendRequest("AT+RST", "ready", 2000)
        if (_sendRequest("AT+CWMODE=1", "OK", 1000) == null) {
            _sendRequest("AT+CWMODE=1", "OK", 1000)
        }
    }

    function _buildUrl(path: string): string {
        return `AT+HTTPCLIENT=2,0,"${_host}:${_port}${path}",,,1`
    }

    // ─── CONFIGURACIÓN ────────────────────────────────────────────────────────

    /**
     * Inicializar módulo WiFi en el puerto del Nezha board
     * @param port puerto RJ11 donde está conectado el módulo, eg: RJPort.J1
     * @param baudrate velocidad de comunicación serial, eg: BaudRate.BaudRate115200
     */
    //% block="Inicializar TBox IoT puerto %port baudrate %baudrate"
    //% port.defl=RJPort.J1
    //% baudrate.defl=BaudRate.BaudRate115200
    //% weight=100
    //% group="1. Configuración"
    export function init(port: RJPort, baudrate: BaudRate): void {
        let pin_tx = SerialPin.P8
        let pin_rx = SerialPin.P1
        switch (port) {
            case RJPort.J1:
                pin_tx = SerialPin.P8
                pin_rx = SerialPin.P1
                break
            case RJPort.J2:
                pin_tx = SerialPin.P12
                pin_rx = SerialPin.P2
                break
            case RJPort.J3:
                pin_tx = SerialPin.P14
                pin_rx = SerialPin.P13
                break
            case RJPort.J4:
                pin_tx = SerialPin.P16
                pin_rx = SerialPin.P15
                break
        }
        serial.redirect(pin_tx, pin_rx, baudrate)
        serial.setTxBufferSize(128)
        serial.setRxBufferSize(128)
        serial.onDataReceived(serial.delimiters(Delimiters.NewLine), _serialHandler)
        _resetModule()
    }

    /**
     * Configurar dirección del servidor TBox IoT
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
     * @param ssid nombre de la red WiFi, eg: "MiRedWiFi"
     * @param password contraseña de la red, eg: "mi_clave"
     */
    //% block="Conectar WiFi red %ssid contraseña %password"
    //% ssid.defl="MiRedWiFi"
    //% password.defl="mi_clave"
    //% weight=95
    //% group="2. Conexión"
    export function connectWifi(ssid: string, password: string): void {
        _registerHandler("WIFI DISCONNECT", () => { _wifi_connected = false })
        _registerHandler("WIFI GOT IP", () => { _wifi_connected = true })
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
     * Verificar estado de la conexión WiFi
     * @param state estado esperado, eg: WifiState.Connected
     */
    //% block="WiFi conectado %state"
    //% state.defl=WifiState.Connected
    //% weight=90
    //% group="2. Conexión"
    export function wifiState(state: WifiState): boolean {
        return _wifi_connected === (state === WifiState.Connected)
    }

    /**
     * Conectar a la plataforma TBox IoT
     * @param token User Token de la cuenta, eg: "miToken123"
     * @param topic número de dispositivo (1-10), eg: 1
     */
    //% block="Conectar TBox token %token topic %topic"
    //% token.defl="miToken123"
    //% topic.defl=1
    //% weight=85
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
                _switchStatus = ret.includes("switchOn")
                return
            }
        }
        _iot_connected = false
    }

    /**
     * Verificar si TBox IoT está conectado
     */
    //% block="TBox conectado"
    //% weight=80
    //% group="2. Conexión"
    export function isTBoxConnected(): boolean {
        return _iot_connected
    }

    // ─── ENVIAR DATOS ─────────────────────────────────────────────────────────

    /**
     * Preparar datos para enviar (hasta 8 campos)
     * @param d1 campo 1, eg: 0
     * @param d2 campo 2, eg: 0
     * @param d3 campo 3, eg: 0
     * @param d4 campo 4, eg: 0
     * @param d5 campo 5, eg: 0
     * @param d6 campo 6, eg: 0
     * @param d7 campo 7, eg: 0
     * @param d8 campo 8, eg: 0
     */
    //% block="Preparar datos|Campo 1 = %d1||Campo 2 = %d2|Campo 3 = %d3|Campo 4 = %d4|Campo 5 = %d5|Campo 6 = %d6|Campo 7 = %d7|Campo 8 = %d8"
    //% expandableArgumentMode="enabled"
    //% weight=75
    //% group="3. Enviar Datos"
    export function setData(
        d1: number,
        d2: number = 0,
        d3: number = 0,
        d4: number = 0,
        d5: number = 0,
        d6: number = 0,
        d7: number = 0,
        d8: number = 0
    ): void {
        _sendMsg = _buildUrl(
            `/iot/iotTopicData/addTopicData?userToken=${_token}&topicName=${_topic}`
            + `&data1=${d1}&data2=${d2}&data3=${d3}&data4=${d4}`
            + `&data5=${d5}&data6=${d6}&data7=${d7}&data8=${d8}`
        )
    }

    /**
     * Enviar los datos preparados a TBox IoT
     */
    //% block="Enviar datos a TBox"
    //% weight=70
    //% group="3. Enviar Datos"
    export function uploadData(): void {
        if (!_iot_connected) return
        basic.pause(_lastSendTime + 1000 - input.runningTime())
        _sendAT(_sendMsg)
        _lastSendTime = input.runningTime()
    }

    // ─── CONTROL REMOTO ───────────────────────────────────────────────────────

    /**
     * Ejecutar código cuando la plataforma encienda el switch
     */
    //% block="Cuando TBox encienda el switch"
    //% weight=65
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
    //% weight=64
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
        basic.forever(() => {
            if (_iot_connected) {
                _sendAT(_buildUrl(
                    `/iot/iotTopic/getTopicStatus/${_token}/${_topic}`
                ))
            }
            basic.pause(1000)
        })
    }
}
