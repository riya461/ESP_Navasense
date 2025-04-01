#include <Adafruit_MPU6050.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define SPEED 8
const char* ssid = "Aastraa PG G Floor";
const char* password = "Aastraa123";
const char* serverUrl = "http://192.168.1.100:5000/imu_data"; // Use local IP instead of localhost

Adafruit_MPU6050 mpu;
bool isCollecting = false;
unsigned long lastSendTime = 0;
const long sendInterval = 50;

void setup() {
  Serial.begin(115200);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  
  if (!mpu.begin()) while(1) delay(10);
}

void loop() {
  if (!isCollecting || millis() - lastSendTime < sendInterval) return;
  
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  
  char payload[150]; // Pre-allocated buffer
  snprintf(payload, sizeof(payload),
    "{\"accel_x\":%.2f,\"accel_y\":%.2f,\"accel_z\":%.2f,"
    "\"gyro_x\":%.2f,\"gyro_y\":%.2f,\"gyro_z\":%.2f}",
    a.acceleration.x, a.acceleration.y, a.acceleration.z,
    g.gyro.x, g.gyro.y, g.gyro.z);
  
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(payload);
    http.end();
  }
  
  lastSendTime = millis();
}