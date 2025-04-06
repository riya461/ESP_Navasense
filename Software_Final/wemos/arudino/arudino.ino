#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

Adafruit_MPU6050 mpu;
ESP8266WebServer server(80);

const char* ssid = "SSID";
const char* password = "PASSWORD";

// Motion Data Variables
float ax, ay, az;
float gx, gy, gz;

bool collectingData = false;
unsigned long startTime = 0;
String collectedData = "";  // Store collected data in a string

unsigned long lastCollectTime = 0;
const unsigned long collectInterval = 1000; // Collect data every 1 second


void setup() {
  Serial.begin(115200);
  Wire.begin();

  if (!mpu.begin()) {
    Serial.println("MPU6050 connection failed!");
    while (1);
  }
  Serial.println("MPU6050 connected!");
  
  // Setup motion detection
  mpu.setHighPassFilter(MPU6050_HIGHPASS_0_63_HZ);
  mpu.setMotionDetectionThreshold(1);
  mpu.setMotionDetectionDuration(20);
  mpu.setInterruptPinLatch(true);  // Keep it latched. Will turn off when reinitialized.
  mpu.setInterruptPinPolarity(true);
  mpu.setMotionInterrupt(true);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Web Page Route
  server.on("/", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html><head>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'>";
    html += "<title>MPU6050 Dashboard</title></head><body class='container mt-3'>";
    html += "<h2 class='text-center'>MPU6050 Sensor is working</h2>";
    html += "<div class='card'><div class='card-body'>";
    html += "<h5 class='card-title'> Sensor Readings</h5>";
    
    html += "</div></div>";
    html += "<script>";
    html += "setInterval(function() { fetch('/motion').then(response => response.json()).then(data => {";
    html += "document.getElementById('accel').innerHTML = `Data: ${data.collectedData}`;"; 
    html += "}); }, 500);";  // Updates every 500ms
    html += "</script></body></html>";
    server.send(200, "text/html", html);
  });

  // JSON Data Endpoint
  server.on("/motion", HTTP_GET, handleMotionRequest);

  server.begin();
}

void loop() {
  server.handleClient();
}


void collectDataForFiveSeconds() {
  collectedData = "";  // Reset collected data
  unsigned long start = millis();
  
  // Run for 5 seconds
  while (millis() - start < 5000) {
    if (millis() - lastCollectTime >= collectInterval) {
      if (mpu.getMotionInterruptStatus()) {
        sensors_event_t a, g, temp;
        mpu.getEvent(&a, &g, &temp);

        // Append collected data
        collectedData += String(a.acceleration.x, 6) + "," + String(a.acceleration.y, 6) + "," + String(a.acceleration.z, 6) + "," +
                         String(g.gyro.x, 6) + "," + String(g.gyro.y, 6) + "," + String(g.gyro.z, 6) + "\n";
      }
      lastCollectTime = millis();
    }
    yield();  // Allow other tasks (e.g., web server handling)
  }
}

void handleMotionRequest() {
  collectingData = true;
  collectDataForFiveSeconds();  // Collect data for exactly 5 seconds
  collectingData = false;

  // Format the collected data as JSON
  String response = collectedData;
  Serial.println(collectedData);

  // Send the collected data as JSON
  server.sendHeader("Content-Type", "application/json");
  server.send(200, "application/json", response);  // Send data as JSON
}

