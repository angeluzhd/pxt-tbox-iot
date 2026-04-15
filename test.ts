// Ejemplo completo de uso - TBox IoT
// Hardware: micro:bit + Nezha board + módulo EF05036 en J1

// ── 1. Inicializar ──────────────────────────────────────────
TBoxIoT.init()
TBoxIoT.setServer("http://192.168.1.100", 8080)

// ── 2. Conectar WiFi y TBox ─────────────────────────────────
TBoxIoT.connectWifi("MiRedWiFi", "mi_clave_123")
TBoxIoT.connectTBox("miToken123", 1)

// ── 3. Control remoto desde la plataforma ───────────────────
TBoxIoT.onSwitchOn(function () {
    basic.showIcon(IconNames.Heart)
})

TBoxIoT.onSwitchOff(function () {
    basic.clearScreen()
})

// ── 4. Enviar datos cada 5 segundos ─────────────────────────
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
