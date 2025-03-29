#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>  // Use #include <WiFi.h> for ESP32
#include <WebSocketsClient.h>

Adafruit_MPU6050 mpu;
WebSocketsClient webSocket;

// WiFi credentials
const char* ssid = "Astraa 1st Floor";
const char* password = "Astraa123";

// WebSocket server (your Electron app's IP)
const char* websocketServer = "localhost"; 
const int websocketPort = 8080;
const char* websocketPath = "/";

unsigned long lastSendTime = 0;
const unsigned long sendInterval = 50; // 50ms = 20Hz update rate

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected, IP address: ");
  Serial.println(WiFi.localIP());

  // Initialize MPU6050
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
    while (1) {
      delay(10);
    }
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("MPU6050 initialized");

  // Initialize WebSocket
  webSocket.begin(websocketServer, websocketPort, websocketPath);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      break;
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      break;
    case WStype_TEXT:
      // Handle incoming messages if needed
      break;
    case WStype_ERROR:
      Serial.println("WebSocket error");
      break;
  }
}

void loop() {
  webSocket.loop(); // Maintain WebSocket connection
  
  unsigned long currentTime = millis();
  if (currentTime - lastSendTime >= sendInterval) {
    lastSendTime = currentTime;
    
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    
    // Create compact JSON string
    String jsonData = "{\"a\":[" + 
                     String(a.acceleration.x, 2) + "," + 
                     String(a.acceleration.y, 2) + "," + 
                     String(a.acceleration.z, 2) + "],\"g\":[" + 
                     String(g.gyro.x, 2) + "," + 
                     String(g.gyro.y, 2) + "," + 
                     String(g.gyro.z, 2) + "]}";
    
    // Send via WebSocket
    if (webSocket.isConnected()) {
      webSocket.sendTXT(jsonData);
    } else {
      Serial.println("WebSocket not connected, attempting to reconnect...");
      webSocket.begin(websocketServer, websocketPort, websocketPath);
    }
  }
  
  delay(1); // Small delay to prevent watchdog issues
}
