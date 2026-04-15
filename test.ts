// Ejemplo de uso completo - TBox IoT
// Hardware: micro:bit + Nezha board + módulo EF05036 en J1

// 1. Configurar servidor e inicializar módulo
TBoxIoT.setServer("http://192.168.1.100", 8080)
TBoxIoT.init(TBoxIoT.RJPort.J1, BaudRate.BaudRate115200)

// 2. Conectar WiFi y verificar
TBoxIoT.connectWifi("MiRedWiFi", "mi_clave_123")
if (TBoxIoT.wifiState(TBoxIoT.WifiState.Connected)) {
    basic.showIcon(IconNames.Heart)
}

// 3. Conectar a TBox
TBoxIoT.connectTBox("miToken123", 1)

// 4. Control remoto
TBoxIoT.onSwitchOn(function () {
    basic.showIcon(IconNames.Heart)
    led.plotAll()
})

TBoxIoT.onSwitchOff(function () {
    basic.clearScreen()
})

// 5. Enviar datos cada 5 segundos
basic.forever(function () {
    if (TBoxIoT.isTBoxConnected()) {
        TBoxIoT.setData(input.temperature(), input.lightLevel())
        TBoxIoT.uploadData()
        basic.showIcon(IconNames.SmallHeart)
    } else {
        basic.showIcon(IconNames.Sad)
        TBoxIoT.connectTBox("miToken123", 1)
    }
    basic.pause(5000)
})
