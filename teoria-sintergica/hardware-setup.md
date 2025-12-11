# Hardware Setup - Laboratorio Sintérgico DIY
## Guía Completa de Componentes y Configuración

---

## 🎯 Objetivo

Montar un **laboratorio casero** para replicar (de forma simplificada) los experimentos de Jacobo Grinberg usando:
- Arduino (captura de bioseñales)
- Raspberry Pi (procesamiento y análisis)
- Sensores accesibles y económicos

---

## 📦 Lista de Componentes

### Hardware Esencial (Experimentos Básicos)

#### Para Captura de Bioseñales

| Componente | Cantidad | Precio Aprox. | Uso |
|------------|----------|---------------|-----|
| **Arduino Uno** o compatible | 1-2 | $20-30 | Adquisición de señales analógicas |
| **Raspberry Pi 4** (4GB RAM) | 1 | $60-80 | Procesamiento, visualización, almacenamiento |
| **Sensor cardiaco MAX30102** | 1-2 | $5-8 | Pulso y SpO2 (variabilidad cardíaca) |
| **Electrodos adhesivos ECG** | 1 pack (30 unidades) | $10-15 | Detección bioeléctrica |
| **AD8232 ECG Module** | 1-2 | $8-12 | Amplificación de señal cardíaca |
| **Cable de puente M-M/M-F** | 1 set | $5 | Conexiones |
| **Protoboard** grande | 1 | $8 | Montaje de circuitos |
| **Fuente alimentación 5V** | 1 | $10 | Para Arduino |
| **MicroSD 32GB** | 1 | $10 | Almacenamiento datos (Raspberry Pi) |

**Subtotal Básico**: ~$150-200 USD

---

#### Para EEG DIY (Nivel Intermedio/Avanzado)

| Componente | Cantidad | Precio Aprox. | Uso |
|------------|----------|---------------|-----|
| **OpenBCI Cyton Board** | 1 | $500 | EEG de 8 canales (MEJOR opción pro) |
| **ALTERNATIVA: ADS1299** módulo | 1 | $80-120 | Chip EEG DIY (requiere soldadura) |
| **Electrodos pasivos Ag/AgCl** | 1 set (10 unidades) | $15-20 | Captura EEG |
| **Gel conductor** | 1 tubo | $10 | Mejora contacto electrodos-piel |
| **Gorro EEG elástico** (opcional) | 1 | $30-50 | Posicionamiento de electrodos |

**Subtotal EEG (Opción OpenBCI)**: ~$550  
**Subtotal EEG (Opción DIY)**: ~$200-250

---

#### Componentes Adicionales para Experimentos Específicos

| Componente | Uso | Precio |
|------------|-----|--------|
| **LED RGB de alta potencia** | Estímulos visuales (experimentos VEP) | $5-10 |
| **Buzzer piezo** | Estímulos auditivos | $2-3 |
| **Módulo Bluetooth HC-05** | Comunicación inalámbrica | $5-8 |
| **Celda de Faraday DIY** | Aislamiento electromagnético (papel aluminio + malla cobre) | $20-30 |
| **Sensores GSR (respuesta galvánica piel)** | Arousal emocional | $8-12 |

---

### Software Necesario

#### Para Arduino
- **Arduino IDE** (gratis) - [arduino.cc](https://www.arduino.cc/en/software)
- Librerías:
  - `Adafruit_MAX30102` (sensor pulso)
  - `AD8232` (ECG)
  - `SPI.h`, `Wire.h` (comunicación)

#### Para Raspberry Pi
- **Raspberry Pi OS** (gratis)
- **Python 3.8+** con librerías:
  - `numpy`, `scipy` - Procesamiento numérico
  - `matplotlib`, `seaborn` - Visualización
  - `brainflow` - Interfaz con OpenBCI
  - `mne` - Análisis EEG
  - `pandas` - Manejo de datos
  - `pyserial` - Comunicación con Arduino

#### Instalación Rápida (Raspberry Pi)
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias Python
sudo apt install python3-pip python3-numpy python3-scipy python3-matplotlib -y

# Instalar librerías Python
pip3 install brainflow mne pandas pyserial seaborn scikit-learn
```

---

## 🔧 Configuración Paso a Paso

### Setup 1: Arduino + Sensor Cardíaco (Experimento Básico)

#### Objetivo
Medir **variabilidad de ritmo cardíaco (HRV)** como proxy de coherencia autonómica (relacionada con coherencia neuronal).

#### Conexiones MAX30102 → Arduino

```
MAX30102          Arduino Uno
---------         -----------
VIN       →       5V
GND       →       GND
SDA       →       A4 (o SDA)
SCL       →       A5 (o SCL)
INT       →       D2 (interrupción)
```

#### Código Arduino (pulso_coherencia.ino)
```cpp
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

MAX30105 particleSensor;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

void setup() {
  Serial.begin(115200);
  
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30105 no encontrado");
    while (1);
  }
  
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
}

void loop() {
  long irValue = particleSensor.getIR();
  
  if (checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    
    beatsPerMinute = 60 / (delta / 1000.0);
    
    if (beatsPerMinute < 255 && beatsPerMinute > 20) {
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;
      
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++)
        beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }
  }
  
  // Enviar datos por serial
  Serial.print(millis());
  Serial.print(",");
  Serial.print(irValue);
  Serial.print(",");
  Serial.print(beatsPerMinute);
  Serial.print(",");
  Serial.println(beatAvg);
  
  delay(20); // 50 Hz
}
```

---

### Setup 2: Arduino + AD8232 ECG (Señal Cardíaca Detallada)

#### Conexiones AD8232 → Arduino

```
AD8232            Arduino Uno
--------          -----------
GND       →       GND
3.3V      →       3.3V
OUTPUT    →       A0
LO+       →       D10
LO-       →       D11
```

#### Posición de Electrodos (Derivación I)
```
     [RA] Brazo derecho (-)
       |
[Cuerpo]
       |
     [LA] Brazo izquierdo (+)
       |
     [RL] Pierna derecha (tierra)
```

#### Código Arduino (ecg_captura.ino)
```cpp
void setup() {
  Serial.begin(9600);
  pinMode(10, INPUT);  // LO+
  pinMode(11, INPUT);  // LO-
}

void loop() {
  if((digitalRead(10) == 1) || (digitalRead(11) == 1)){
    Serial.println("0"); // Electrodos desconectados
  } else {
    int ecgValue = analogRead(A0);
    
    // Timestamp, valor ECG
    Serial.print(millis());
    Serial.print(",");
    Serial.println(ecgValue);
  }
  
  delay(5); // 200 Hz sampling
}
```

---

### Setup 3: Raspberry Pi + Arduino (Sistema Completo)

#### Arquitectura
```
[Arduino] → (USB/Serial) → [Raspberry Pi] → [Almacenamiento + Análisis]
```

#### Script Python para Captura (en Raspberry Pi)

**Archivo**: `captura_datos.py`
```python
import serial
import time
import numpy as np
import pandas as pd
from datetime import datetime

# Configuración
ARDUINO_PORT = '/dev/ttyUSB0'  # Cambiar según tu sistema
BAUD_RATE = 9600
DURACION_SEGUNDOS = 300  # 5 minutos

# Conectar con Arduino
ser = serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=1)
time.sleep(2)  # Esperar estabilización

print(f"Iniciando captura por {DURACION_SEGUNDOS} segundos...")

datos = []
tiempo_inicio = time.time()

try:
    while (time.time() - tiempo_inicio) < DURACION_SEGUNDOS:
        if ser.in_waiting > 0:
            linea = ser.readline().decode('utf-8').strip()
            if linea:
                valores = linea.split(',')
                datos.append(valores)
                
                if len(datos) % 100 == 0:
                    print(f"Capturados {len(datos)} puntos...")
                    
except KeyboardInterrupt:
    print("\nCaptura interrumpida por usuario")

finally:
    ser.close()
    
    # Guardar datos
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"ecg_data_{timestamp}.csv"
    
    df = pd.DataFrame(datos, columns=['timestamp_ms', 'ecg_value'])
    df.to_csv(filename, index=False)
    
    print(f"\nDatos guardados en: {filename}")
    print(f"Total de puntos: {len(datos)}")
```

#### Ejecutar Captura
```bash
python3 captura_datos.py
```

---

### Setup 4: OpenBCI para EEG Profesional

#### Configuración OpenBCI Cyton

1. **Instalar OpenBCI GUI** (descarga desde [openbci.com](https://openbci.com/downloads))
2. **Conectar via WiFi/Bluetooth** (según shield)
3. **Colocar electrodos** según sistema 10-20:
   - Canales mínimos: Fp1, Fp2, C3, C4, O1, O2, A1, A2 (referencia)
   - Tierra: En frente (Fpz) o mastoides

#### Exportar Datos para Análisis
- OpenBCI GUI → guardar como `.csv`
- Importar con Python/MNE para análisis

---

## 🧪 Celda de Faraday DIY (Para Experimento de Potencial Transferido)

### Objetivo
Bloquear interferencias electromagnéticas externas.

### Materiales
- Caja de cartón grande (60x60x80 cm aprox.)
- Papel aluminio grueso (suficiente para cubrir toda la caja)
- Malla de cobre (opcional, para mejor aislamiento)
- Cinta adhesiva conductora
- Cable a tierra (conectar a tierra física de enchufe)

### Construcción
1. Forrar interior de caja con papel aluminio (sin espacios)
2. Asegurar con cinta conductora
3. Superponer malla de cobre (opcional)
4. **Importante**: Conectar el aluminio/malla a tierra eléctrica
5. Abrir puerta (solapa) que se cierre herméticamente

### Verificación
- Meter un celular dentro, cerrar
- Llamar al celular desde fuera
- Si no suena/vibra = aislamiento efectivo

---

## 📊 Verificación del Sistema

### Test de Arduino
```cpp
// Código de prueba
void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.println("Arduino OK");
  delay(1000);
}
```
Ejecutar Serial Monitor → Debe mostrar "Arduino OK" cada segundo

### Test de Raspberry Pi
```bash
# Ver puertos seriales disponibles
ls /dev/tty*

# Instalar screen
sudo apt install screen

# Leer datos de Arduino
screen /dev/ttyUSB0 9600
```

---

## ⚡ Troubleshooting

### Arduino no detectado
```bash
# En Raspberry Pi
sudo apt install arduino
sudo usermod -a -G dialout $USER
# Re-login
```

### Ruido excesivo en señal
- Verificar conexiones a tierra
- Alejar de fuentes electromagnéticas (WiFi router, microondas)
- Usar cables apantallados
- Filtrar digitalmente (código Python)

### OpenBCI no conecta
- Verificar batería cargada
- Resetear board (botón físico)
- Re-emparejar Bluetooth/WiFi

---

## 🎓 Próximos Pasos

Con el hardware configurado:

1. **Experimento 1**: Coherencia cardíaca (HRV)
   - Archivo: `/experimentos/01-coherencia-cardiaca/`
   
2. **Experimento 2**: Respuesta a estímulos (VEP básico)
   - Archivo: `/experimentos/02-respuesta-estimulos/`
   
3. **Experimento 3**: Correlación inter-personal (si tienes 2 sistemas)
   - Archivo: `/experimentos/03-correlacion-interpersonal/`

**Continúa con la carpeta `/experimentos/` para protocolos detallados.**

---

## 📚 Recursos Adicionales

### Documentación Técnica
- [Arduino Reference](https://www.arduino.cc/reference/en/)
- [Raspberry Pi Documentation](https://www.raspberrypi.com/documentation/)
- [OpenBCI Docs](https://docs.openbci.com/)
- [MNE-Python Tutorial](https://mne.tools/stable/auto_tutorials/index.html)

### Comunidades
- r/OpenBCI (Reddit)
- OpenBCI Forum
- Arduino Forum
- Stack Overflow (tags: arduino, raspberry-pi, eeg)

---

¿Hardware listo? ¡Hora de experimentar! 🚀
