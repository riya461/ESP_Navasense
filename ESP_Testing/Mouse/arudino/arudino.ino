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


void setup() {
  Serial.begin(115200);
  Wire.begin();

  if (!mpu.begin()) {
    Serial.println("MPU6050 connection failed!");
    while (1);
  }
  Serial.println("MPU6050 connected!");
  
  //setupt motion detection
  mpu.setHighPassFilter(MPU6050_HIGHPASS_0_63_HZ);
  mpu.setMotionDetectionThreshold(1);
  mpu.setMotionDetectionDuration(20);
  mpu.setInterruptPinLatch(true);	// Keep it latched.  Will turn off when reinitialized.
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
    html += "</div></div>";
    html += "</body></html>";
    server.send(200, "text/html", html);
  });

  // JSON Data Endpoint
  server.on("/motion", HTTP_GET, handleMotionRequest);

  server.begin();
}

void loop() {
  server.handleClient();
}

// Function to simulate data collection and store it as a text file
void collectDataForFiveSeconds() {
  collectedData = "";  // Reset collected data
  unsigned long start = millis();
  while (millis() - start < 7000) {
    if(mpu.getMotionInterruptStatus()) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);


    // Append collected data to the string
    collectedData += String(a.acceleration.x) + "," + String(a.acceleration.y) + "," + String(a.acceleration.z) + "," +
                     String(g.gyro.x) + "," + String(g.gyro.y) + "," + String(g.gyro.z) + ","  + "\n";
    }
    delay(1);  // Simulating delay between data points
  }
}
void handleMotionRequest() {
  

  collectingData = true;
  collectDataForFiveSeconds();
  collectingData = false;

  // Format the collected data as JSON
  String response = collectedData;
  Serial.println(collectedData);

  // Send the collected data as JSON
  server.sendHeader("Content-Type", "application/json");
  server.send(200, "application/json", response);  // Send data as JSON
}