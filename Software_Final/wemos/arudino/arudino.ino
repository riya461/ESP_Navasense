#include <Wire.h>
#include <MPU6050.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

MPU6050 mpu;
ESP8266WebServer server(80);

const char* ssid = "Astraa 1st Floor";
const char* password = "Astraa123";

// Motion Data Variables
float ax, ay, az;
float gx, gy, gz;
int batteryLevel = 100; // Simulated battery percentage

void setup() {
    Serial.begin(115200);
    Wire.begin();
    mpu.initialize();

    if (!mpu.testConnection()) {
        Serial.println("MPU6050 connection failed!");
        while (1);
    }
    Serial.println("MPU6050 connected!");

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
        html += "<h2 class='text-center'>MPU6050 Sensor Dashboard</h2>";
        html += "<div class='card'><div class='card-body'>";
        html += "<h5 class='card-title'>Live Sensor Readings</h5>";
        html += "<p><strong>Accelerometer:</strong> <span id='accel'></span></p>";
        html += "<p><strong>Gyroscope:</strong> <span id='gyro'></span></p>";
        html += "</div></div>";
        html += "<script>";
        html += "setInterval(function() { fetch('/motion').then(response => response.json()).then(data => {";
        html += "document.getElementById('accel').innerHTML = `Ax: ${data.ax}, Ay: ${data.ay}, Az: ${data.az}`;";
        html += "document.getElementById('gyro').innerHTML = `Gx: ${data.gx}, Gy: ${data.gy}, Gz: ${data.gz}`;";
        html += "}); }, 1);"; // Updates every 1ms
        html += "</script></body></html>";
        server.send(200, "text/html", html);
    });

    // JSON Data Endpoint
    server.on("/motion", HTTP_GET, []() {
        String json = "{ \"ax\": " + String(ax) + ", \"ay\": " + String(ay) + ", \"az\": " + String(az) + ",";
        json += "\"gx\": " + String(gx) + ", \"gy\": " + String(gy) + ", \"gz\": " + String(gz) + ",";
        json += "\"battery\": " + String(batteryLevel) + " }";
        server.send(200, "application/json", json);
    });

    server.begin();
}

void loop() {
    int16_t ax_raw, ay_raw, az_raw;
    int16_t gx_raw, gy_raw, gz_raw;

    mpu.getAcceleration(&ax_raw, &ay_raw, &az_raw);
    mpu.getRotation(&gx_raw, &gy_raw, &gz_raw);

    ax = ax_raw / 16384.0;
    ay = ay_raw / 16384.0;
    az = az_raw / 16384.0;
    gx = gx_raw / 131.0;
    gy = gy_raw / 131.0;
    gz = gz_raw / 131.0;

    server.handleClient();
}