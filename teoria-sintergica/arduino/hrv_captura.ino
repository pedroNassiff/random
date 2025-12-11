/*
 * HRV Captura - Experimento Coherencia Cardíaca
 * Proyecto: Teoría Sintérgica - Validación Experimental
 * 
 * Hardware: Arduino Uno + MAX30105
 * Output: CSV via Serial (timestamp_ms, ibi_ms, bpm, ir_raw)
 */

#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

MAX30105 particleSensor;

const byte RATE_SIZE = 10;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
long lastIBI = 0;
float beatsPerMinute;

void setup() {
  Serial.begin(115200);
  
  // Inicializar sensor
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("ERROR: MAX30105 no encontrado. Verificar conexiones.");
    while (1);
  }
  
  // Configuración del sensor
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);  // LED rojo para pulso
  particleSensor.setPulseAmplitudeGreen(0);    // LED verde apagado
  
  // Header CSV
  Serial.println("timestamp_ms,ibi_ms,bpm,ir_raw");
}

void loop() {
  long irValue = particleSensor.getIR();
  
  // Detectar latido
  if (checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    lastIBI = delta;
    
    beatsPerMinute = 60000.0 / (float)delta;
    
    // Filtrar valores fisiológicamente posibles
    if (beatsPerMinute < 180 && beatsPerMinute > 40) {
      // Enviar datos: timestamp, IBI, BPM, señal IR cruda
      Serial.print(millis());
      Serial.print(",");
      Serial.print(lastIBI);
      Serial.print(",");
      Serial.print(beatsPerMinute, 2);
      Serial.print(",");
      Serial.println(irValue);
    }
  }
  
  delay(20);  // 50 Hz sampling rate
}
