/*
 * ======================================================================================
 * PROYEK IOT QUALITY CONTROL: SISTEM DETEKSI CACAT BARANG BERBASIS SENSOR ULTRASONIK
 * Mikrokontroler: ESP32 Dev Module
 * Sensor        : HC-SR04 Ultrasonic Distance Sensor
 * Output        : Web Dashboard (REST API / Serial USB / Firebase Realtime DB)
 * ======================================================================================
 * 
 * SKEMA SAMBUNGAN LANGSUNG 4 KABEL (DIRECT CONNECTION TANPA BREADBOARD):
 * ----------------------------------------------------------------------
 * Sensor HC-SR04  -------->  ESP32 Dev Module
 * 1. VCC          -------->  Pin VIN (atau 5V / 3.3V)
 * 2. GND          -------->  Pin GND
 * 3. Trig         -------->  GPIO 5 (D5)
 * 4. Echo         -------->  GPIO 19 (D19)
 * 
 * INDIKATOR BAWAAN (TANPA KOMPONEN TAMBAHAN):
 * - LED Biru Bawaan Board (GPIO 2) berkedip cepat saat mendeteksi barang cacat!
 * ======================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>

// --- KONFIGURASI JARINGAN WIFI & SERVER ---
const char* ssid = "NAMA_WIFI_KAMU";        // Ganti dengan nama WiFi / Hotspot HP
const char* password = "PASSWORD_WIFI";     // Ganti dengan password WiFi
const char* serverUrl = "http://192.168.1.10:3000/api/inspection"; // Ganti dengan IP Laptop kamu

// --- KONFIGURASI PIN HARDWARE ---
#define TRIG_PIN     5    // Pin Trigger HC-SR04 -> GPIO 5 (D5)
#define ECHO_PIN     19   // Pin Echo HC-SR04    -> GPIO 19 (D19)
#define ONBOARD_LED  2    // LED bawaan papan ESP32

// --- PARAMETER KALIBRASI SENSOR (CM) ---
// Objek dianggap lewat jika jarak lebih dekat dari 20 cm
const float DETECTION_THRESHOLD_CM = 20.0;

// Standar Barang Normal (Lolos / Pass):
// Ketinggian barang standar menghasilkan jarak pantulan 4.0 cm - 7.0 cm
const float MIN_NORMAL_DIST_CM = 4.0;
const float MAX_NORMAL_DIST_CM = 7.0;

// Variabel Waktu & State
unsigned long lastReadTime = 0;
const unsigned long READ_INTERVAL = 300; // Baca sensor tiap 300ms
int itemCounter = 100;
bool objectCurrentlyPresent = false;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println("   SISTEM IOT QC: DETEKSI SENSOR ULTRASONIK HC-SR04");
  Serial.println("==================================================");

  // Inisialisasi Pin
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(ONBOARD_LED, OUTPUT);
  digitalWrite(ONBOARD_LED, LOW);

  // Koneksi ke WiFi (Opsional: Tetap bisa streaming via USB Serial jika WiFi mati)
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 20) {
    delay(500);
    Serial.print(".");
    timeout++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Berhasil Terhubung!");
    Serial.print("[WiFi] IP ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Berjalan dalam mode Serial USB Bridge.");
  }

  Serial.println("Sensor siap melakukan inspeksi barang...");
}

// Fungsi Mengukur Jarak Sensor Ultrasonik (cm)
float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // Timeout 30ms (~5 meter)
  if (duration == 0) return 999.0; // Tidak ada pantulan / out of range

  float distanceCm = (duration * 0.0343) / 2.0;
  return distanceCm;
}

void loop() {
  if (millis() - lastReadTime >= READ_INTERVAL) {
    lastReadTime = millis();

    float distance = measureDistance();

    // Cek apakah ada objek yang melintas di depan sensor
    if (distance > 0.5 && distance <= DETECTION_THRESHOLD_CM) {
      if (!objectCurrentlyPresent) {
        objectCurrentlyPresent = true;
        itemCounter++;

        String itemId = "BRG-" + String(itemCounter);
        String status = "PASS";
        String defectType = "Permukaan Sempurna (Normal)";
        String action = "Lolos ke Packaging";
        int irEquivValue = (int)(distance * 25); // Konversi visual nilai sensor

        // Evaluasi Kualitas Berdasarkan Ukuran / Dimensi
        if (distance < MIN_NORMAL_DIST_CM) {
          status = "DEFECT";
          defectType = "Dimensi Terlalu Tebal / Tonjolan";
          action = "Dorong ke Kotak Reject";
        } else if (distance > MAX_NORMAL_DIST_CM) {
          status = "DEFECT";
          defectType = "Dimensi Penyok / Berlubang";
          action = "Dorong ke Kotak Reject";
        }

        // Respon Indikator Lokal
        if (status == "DEFECT") {
          // Kedipkan LED bawaan board 3x
          for (int i = 0; i < 3; i++) {
            digitalWrite(ONBOARD_LED, HIGH);
            delay(80);
            digitalWrite(ONBOARD_LED, LOW);
            delay(80);
          }
        } else {
          // Nyalakan LED sebentar tanda lolos
          digitalWrite(ONBOARD_LED, HIGH);
          delay(100);
          digitalWrite(ONBOARD_LED, LOW);
        }

        // 1. Kirim Data via Serial USB (JSON Format)
        String jsonPayload = "{\"id\":\"" + itemId + "\",\"status\":\"" + status + "\",\"irVal\":" + String(irEquivValue) + ",\"distance\":" + String(distance, 1) + ",\"defectType\":\"" + defectType + "\",\"action\":\"" + action + "\"}";
        Serial.println(jsonPayload);

        // 2. Kirim Data via HTTP POST ke Web Server (jika WiFi terhubung)
        if (WiFi.status() == WL_CONNECTED) {
          HTTPClient http;
          http.begin(serverUrl);
          http.addHeader("Content-Type", "application/json");

          int httpResponseCode = http.POST(jsonPayload);
          if (httpResponseCode > 0) {
            Serial.print("[HTTP] Server Response: ");
            Serial.println(httpResponseCode);
          } else {
            Serial.print("[HTTP] Gagal kirim data, Error: ");
            Serial.println(http.errorToString(httpResponseCode).c_str());
          }
          http.end();
        }
      }
    } else {
      objectCurrentlyPresent = false;
    }
  }
}
