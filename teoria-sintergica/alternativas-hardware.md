# Alternativas de Hardware - Relojes Customizables
## Para Experimentos Sintérgicos con iPhone

---

## 🎯 Mejor Opción: **Bangle.js 2**

### Por qué es PERFECTO para este proyecto

✅ **100% Open Source** - Hardware y software totalmente abierto  
✅ **Programable en JavaScript** - ¡Literalmente puedes escribir apps en el reloj!  
✅ **Bluetooth directo a iPhone** - Streaming de datos en tiempo real  
✅ **Sensor PPG de calidad** - Similar a Apple Watch  
✅ **Batería 2-4 semanas** - No necesitas cargarlo constantemente  
✅ **Precio**: ~$90 USD  
✅ **Comunidad activa** - Muchos apps open-source disponibles  

### Especificaciones Técnicas
- **Sensor PPG**: HRS3300 (frecuencia cardíaca + SpO2)
- **Procesador**: nRF52840 (ARM Cortex-M4)
- **Bluetooth**: 5.0 LE
- **Pantalla**: 176x176 LCD color táctil
- **Memoria**: 64KB RAM, 512KB Flash
- **OS**: Espruino (JavaScript runtime nativo)

### Cómo Usarlo para Experimentos HRV

#### 1. Programar el Reloj con JavaScript

```javascript
// App custom para Bangle.js 2 - Captura HRV
// Guarda este código en el IDE web de Bangle.js

var hrm = require("heartrate");
var lastBeat = 0;

// Configurar sensor
hrm.start(function(rate) {
  var now = Date.now();
  var ibi = now - lastBeat;
  lastBeat = now;
  
  // Enviar datos vía Bluetooth
  Bluetooth.println(JSON.stringify({
    timestamp: now,
    ibi: ibi,
    bpm: rate.bpm,
    confidence: rate.confidence
  }));
});

// Mostrar en pantalla
function draw() {
  g.clear();
  g.setFont("Vector", 24);
  g.drawString("HRV Monitor", 88, 30);
  g.drawString(hrm.getBPM() + " BPM", 88, 100);
}

setInterval(draw, 1000);
```

#### 2. App iOS para Capturar Datos

**Opción A: Usar "Web Bluetooth" (navegador Safari)**

```javascript
// Código HTML/JS que corre en Safari iOS
// Archivo: bangle_captura.html

<!DOCTYPE html>
<html>
<head>
  <title>Bangle.js HRV Capture</title>
</head>
<body>
  <h1>Captura HRV desde Bangle.js</h1>
  <button onclick="connect()">Conectar Reloj</button>
  <button onclick="startCapture()">Iniciar Captura</button>
  <button onclick="stopCapture()">Detener</button>
  <div id="status"></div>
  <div id="data"></div>

  <script>
    let device, characteristic;
    let datos = [];

    async function connect() {
      try {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'Bangle.js' }],
          optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
        });
        
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        characteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
        
        document.getElementById('status').innerText = '✅ Conectado a ' + device.name;
      } catch(error) {
        console.error('Error de conexión:', error);
      }
    }

    async function startCapture() {
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleData);
      document.getElementById('status').innerText = '📊 Capturando datos...';
    }

    function handleData(event) {
      let value = new TextDecoder().decode(event.target.value);
      
      try {
        let json = JSON.parse(value);
        datos.push(json);
        
        // Mostrar últimos 5 datos
        let display = datos.slice(-5).map(d => 
          `${d.bpm} BPM, IBI: ${d.ibi}ms`
        ).join('<br>');
        
        document.getElementById('data').innerHTML = display;
      } catch(e) {
        console.log('Parseando:', value);
      }
    }

    function stopCapture() {
      // Descargar CSV
      let csv = 'timestamp,ibi_ms,bpm,confidence\n';
      datos.forEach(d => {
        csv += `${d.timestamp},${d.ibi},${d.bpm},${d.confidence}\n`;
      });
      
      let blob = new Blob([csv], {type: 'text/csv'});
      let url = URL.createObjectURL(blob);
      let a = document.createElement('a');
      a.href = url;
      a.download = 'hrv_data_' + Date.now() + '.csv';
      a.click();
      
      document.getElementById('status').innerText = '💾 Datos guardados';
    }
  </script>
</body>
</html>
```

**Opción B: App iOS Nativa (Swift)**

Si prefieres una app nativa, puedo crearte código Swift usando CoreBluetooth.

---

## ⚡ Opción 2: **Polar H10** + iPhone

### Ventajas
- ✅ **Banda pectoral** = Precisión MÁXIMA (gold standard para HRV)
- ✅ **Bluetooth directo** a iPhone con apps de terceros
- ✅ **Streaming 1000Hz** de señal ECG cruda (increíble para investigación)
- ✅ **API abierta** - Polar SDK para iOS
- ✅ **Precio**: ~$90 USD
- ✅ **Batería**: 400 horas

### Desventajas
- ❌ **Banda pectoral** incómoda para uso prolongado
- ❌ **No es reloj** (solo sensor)

### App iOS para Polar H10

**Usar "Elite HRV" o "HRV Logger"** (gratuitas)
- Exportan CSV directamente
- Acceso a IBIs crudos

**O programar tu propia app:**

```swift
// Usando Polar Bluetooth SDK
import PolarBleSdk

class HRVCapture {
    var polarAPI: PolarBleApi!
    
    func connect() {
        polarAPI = PolarBleApiDefaultImpl.polarImplementation(
            DispatchQueue.main,
            features: Features.hr.rawValue
        )
        
        // Conectar y recibir datos
        polarAPI.hrObserver = { hr in
            print("BPM: \(hr.hr), IBIs: \(hr.rrs)")
            // hr.rrs contiene los IBIs en ms!
        }
    }
}
```

---

## 🔧 Opción 3: **PineTime** (Open Source)

### Características
- ✅ **Totalmente open-source** (hardware ARM, InfiniTime OS)
- ✅ **Precio**: $27 USD (!!)
- ✅ **Programable en C** (más bajo nivel que Bangle.js)
- ⚠️ **Sensor PPG básico** (menos preciso que Bangle.js)
- ⚠️ **Requiere soldadura/flasheo** para firmware custom

### Ideal para:
- Hackers hardcore
- Presupuesto muy limitado
- Quieres aprender embedded systems

---

## 📊 Comparación Rápida

| Dispositivo | Precio | Customizable | Precisión HRV | Facilidad Uso | iPhone Compatible |
|-------------|--------|--------------|---------------|---------------|-------------------|
| **Bangle.js 2** | $90 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Bluetooth Web |
| **Polar H10** | $90 | ⭐⭐⭐ (SDK) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Apps nativas |
| **PineTime** | $27 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⚠️ Con trabajo |
| **Apple Watch** | $250+ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Nativo |
| **Arduino DIY** | $30 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ❌ Requiere PC |

---

## 🎯 Mi Recomendación para Ti

### **Setup Ideal: Bangle.js 2 + iPhone 12**

**Por qué:**
1. **JavaScript** - Ya conoces el lenguaje (veo tu proyecto Three.js)
2. **Desarrollo rápido** - Programas directo en navegador
3. **Portabilidad** - Llevas el sensor a todas partes
4. **Datos en tiempo real** - Streaming vía Bluetooth a Safari
5. **Community** - Muchos ejemplos de HRV apps ya hechas

### **Setup Alternativo: Polar H10 + Elite HRV app**

**Si prefieres:**
- Máxima precisión científica
- Solución lista para usar (0 programación)
- Exportar CSV y analizar después

---

## 🚀 Plan de Acción Recomendado

### Opción A: Comprar Bangle.js 2
1. **Comprar**: [banglejs.com](https://banglejs.com) (~$90 + envío)
2. **Mientras llega**: Familiarízate con [espruino.com/ide](https://espruino.com/ide)
3. **Al recibirlo**: Flashear app HRV custom (te doy código completo)
4. **Capturar datos**: Usar HTML Web Bluetooth en Safari
5. **Analizar**: Mismo pipeline Python que creamos

### Opción B: Comenzar YA con Polar H10
1. **Comprar**: Amazon/MercadoLibre (~$90)
2. **Descargar**: "Elite HRV" o "HRV4Training"
3. **Sesión**: Hacer meditación con banda puesta
4. **Exportar**: CSV directamente
5. **Analizar**: `python3 analizar_hrv.py datos_polar.csv`

---

## 💻 Código Listo para Usar

### Para Bangle.js 2

Te crearé:
1. **App del reloj** (JavaScript para Bangle.js)
2. **Web app de captura** (HTML/JS para Safari iOS)
3. **Script de conversión** (Python para análisis)

### Para Polar H10

Te daré:
1. **Guía de apps** recomendadas
2. **Script de importación** desde Elite HRV exports

---

¿Qué opción te resuena más? ¿Bangle.js 2 (más hacker, más control) o Polar H10 (plug & play, máxima precisión)?

Puedo prepararte el código completo para la opción que elijas. 🚀
