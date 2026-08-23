/*
 ============================================================================
  PROYEK IoT QUALITY CONTROL: DETEKSI CACAT BARANG MENGGUNAKAN SENSOR INFRARED
 ============================================================================
  Deskripsi:
  Program firmware untuk ESP32 yang mendeteksi objek dan cacat fisik / permukaan
  menggunakan Sensor Infrared (misal TCRT5000 / IR Obstacle Proximity Sensor).
  
  Hasil inspeksi diklasifikasikan menjadi:
  - PASS (Normal) : LED Hijau menyala, Buzzer beep pendek.
  - DEFECT (Cacat) : LED Merah berkedip, Buzzer alarm menyala, Servo reject aktif.
  
  Data dikirimkan ke Dashboard Web via HTTP POST / REST API JSON.
 ============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

// --- KONFIGURASI WIFI & SERVER ---
const char* ssid = "NAMA_WIFI_KAMU";           // Ganti dengan SSID WiFi kamu
const char* password = "PASSWORD_WIFI_KAMU";   // Ganti dengan Password WiFi kamu

// Alamat server / backend dashboard (misal laptop di satu jaringan WiFi)
// Contoh: "http://192.168.1.100:3000/api/inspection"
const char* serverUrl = "http://192.168.1.100:3000/api/inspection";

// --- KONFIGURASI PIN HARDWARE ---
#define PIN_IR_DIGITAL   4     // Pin DO (Digital Out) Sensor IR
#define PIN_IR_ANALOG    34    // Pin AO (Analog Out) Sensor IR (ADC1 Pin ESP32)
#define PIN_BUZZER       18    // Pin Buzzer Aktif
#define PIN_LED_PASS     21    // LED Hijau (Barang Lolos)
#define PIN_LED_DEFECT   19    // LED Merah (Barang Cacat)
#define PIN_SERVO        13    // Pin Kontrol Servo Rejector

// --- THRESHOLD & PARAMETER SENSOR ---
// Nilai threshold pantulan IR untuk menentukan cacat permukaan/lubang/goresan
// Rentang ADC ESP32: 0 - 4095
const int IR_ANALOG_THRESHOLD_DEFECT = 2500; // Jika nilai analog > threshold = Cacat
const int DEBOUNCE_DELAY_MS = 300;           // Anti-bouncing pembacaan objek

// Objek Servo
Servo rejectServo;

// Variabel Counter
unsigned long totalInspected = 0;
unsigned long passCount = 0;
unsigned long defectCount = 0;
bool lastObjectState = HIGH;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=============================================");
  Serial.println("   IoT Quality Control - IR Sensor Detector");
  Serial.println("=============================================");

  // Inisialisasi Pin
  pinMode(PIN_IR_DIGITAL, INPUT);
  pinMode(PIN_IR_ANALOG, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_PASS, OUTPUT);
  pinMode(PIN_LED_DEFECT, OUTPUT);

  // Setup Servo
  rejectServo.attach(PIN_SERVO);
  rejectServo.write(0); // Posisi standby normal (0 derajat)

  // Matikan indikator awal
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_PASS, LOW);
  digitalWrite(PIN_LED_DEFECT, LOW);

  // Sambungkan ke WiFi
  connectToWiFi();
}

void loop() {
  // Baca status sensor IR Digital
  // Umumnya sensor IR Proximity aktif LOW (0 = ada objek di depan sensor, 1 = tidak ada)
  int irDigitalState = digitalRead(PIN_IR_DIGITAL);

  // Deteksi transisi objek baru masuk ke area sensor (Falling Edge: HIGH -> LOW)
  if (irDigitalState == LOW && lastObjectState == HIGH) {
    delay(50); // Debouncing delay

    // Ambil sampel pembacaan Analog (Pantulan IR terhadap permukaan barang)
    int irAnalogValue = analogRead(PIN_IR_ANALOG);
    
    // Evaluasi Kualitas Barang
    bool isDefect = evaluateQuality(irAnalogValue);
    
    totalInspected++;
    String status = isDefect ? "DEFECT" : "PASS";
    String defectReason = isDefect ? "Goresan / Pantulan Abnormal" : "Permukaan Normal (Sempurna)";

    if (isDefect) {
      defectCount++;
      handleDefectAction();
    } else {
      passCount++;
      handlePassAction();
    }

    // Tampilkan log di Serial Monitor
    printSerialLog(totalInspected, irAnalogValue, status, defectReason);

    // Kirim data ke Web Dashboard
    sendDataToDashboard(totalInspected, irAnalogValue, status, defectReason);

    delay(DEBOUNCE_DELAY_MS);
  }

  lastObjectState = irDigitalState;
}

// --- FUNGSI EVALUASI KUALITAS BARANG ---
bool evaluateQuality(int analogVal) {
  // Logika: Jika permukaan cacat, retak, atau warna kusam/tidak rata,
  // pantulan inframerah yang diterima fotodioda akan berubah drastis
  if (analogVal > IR_ANALOG_THRESHOLD_DEFECT || analogVal < 300) {
    return true; // CACAT
  }
  return false;  // NORMAL / LOLOS
}

// --- AKSI BARANG LOLOS (PASS) ---
void handlePassAction() {
  digitalWrite(PIN_LED_PASS, HIGH);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(80);
  digitalWrite(PIN_BUZZER, LOW);
  delay(200);
  digitalWrite(PIN_LED_PASS, LOW);
}

// --- AKSI BARANG CACAT (DEFECT) ---
void handleDefectAction() {
  // Nyalakan LED Merah & Buzzer Alarm
  digitalWrite(PIN_LED_DEFECT, HIGH);
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(150);
    digitalWrite(PIN_BUZZER, LOW);
    delay(100);
  }

  // Gerakkan lengan Servo untuk menolak / menyortir barang cacat
  rejectServo.write(90); // Dorong ke kotak reject
  delay(600);
  rejectServo.write(0);  // Kembali ke posisi awal

  digitalWrite(PIN_LED_DEFECT, LOW);
}

// --- PENGIRIMAN DATA KE SERVER DASHBOARD ---
void sendDataToDashboard(unsigned long id, int analogVal, String status, String reason) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Tidak terhubung. Melewati pengiriman HTTP.");
    return;
  }

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  // Buat Payload JSON
  String payload = "{";
  payload += "\"id\":\"ESP32-ITEM-" + String(id) + "\",";
  payload += "\"irVal\":" + String(analogVal) + ",";
  payload += "\"status\":\"" + status + "\",";
  payload += "\"defectType\":\"" + reason + "\"";
  payload += "}";

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] Data terkirim! Response code: %d\n", httpResponseCode);
  } else {
    Serial.printf("[HTTP] Gagal kirim. Error: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// --- KONEKSI WIFI ---
void connectToWiFi() {
  Serial.print("[WiFi] Menghubungkan ke: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Berhasil Terhubung!");
    Serial.print("[WiFi] IP Address ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Timeout menghubungkan ke WiFi (Mode Standalone Offline).");
  }
}

// --- LOG SERIAL MONITOR ---
void printSerialLog(unsigned long id, int irVal, String status, String reason) {
  Serial.println("\n-------------------------------------------");
  Serial.printf("ID Barang      : ITM-%04lu\n", id);
  Serial.printf("Sinyal IR (ADC): %d\n", irVal);
  Serial.printf("Hasil Inspeksi : %s\n", status.c_str());
  Serial.printf("Keterangan     : %s\n", reason.c_str());
  Serial.printf("Total: %lu | Lolos: %lu | Cacat: %lu\n", totalInspected, passCount, defectCount);
  Serial.println("-------------------------------------------");
}
