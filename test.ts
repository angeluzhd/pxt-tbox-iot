// ─── Ejemplo de uso completo de TBox IoT ─────────────────────────────────────
//
// Hardware requerido:
//   - micro:bit v1 o v2
//   - Nezha Expansion Board
//   - Módulo WiFi EF05036 (BL602) conectado al puerto J1
// ─────────────────────────────────────────────────────────────────────────────

// Al iniciar: configurar serial y conectar
TBoxIoT.init(SerialPin.P8, SerialPin.P12)
TBoxIoT.connectWifi("MiRedWiFi", "mi_clave_123")
TBoxIoT.connectTBox("192.168.1.100", "miToken123", 1)

// Cuando la plataforma enciende el switch
TBoxIoT.onSwitchOn(function () {
    basic.showIcon(IconNames.Heart)
})

// Cuando la plataforma apaga el switch
TBoxIoT.onSwitchOff(function () {
    basic.clearScreen()
})

// Para siempre: enviar datos y verificar conexión
basic.forever(function () {
    if (TBoxIoT.isConnected()) {
        TBoxIoT.sendFields(input.temperature(), input.lightLevel())
        basic.showIcon(IconNames.SmallHeart)
    } else {
        basic.showIcon(IconNames.Sad)
    }
    basic.pause(5000)
})
