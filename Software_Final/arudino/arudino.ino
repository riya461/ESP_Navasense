#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "Astraa 1st Floor";  // Replace with your WiFi SSID
const char* password = "Astraa123";  // Replace with your WiFi password

const char* serverUrl = "http://127.0.0.1:5000";  // Replace with actual Flask server IP

bool isCollecting = false;
Adafruit_MPU6050 mpu;

void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);

    Serial.print("Connecting to WiFi...");
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }
    Serial.println("\nConnected to WiFi!");

    // Initialize MPU6050
    if (!mpu.begin()) {
        Serial.println("MPU6050 initialization failed!");
        while (1);
    }
    Serial.println("MPU6050 Initialized");
}

void loop() {
    if (!isCollecting) {
        checkCollectionStatus();
    } else {
        sendIMUData();
    }
    delay(1000);  // 1-second delay between readings
}

void checkCollectionStatus() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(String(serverUrl) + "/status");
        int httpResponseCode = http.GET();

        if (httpResponseCode == 200) {
            String response = http.getString();
            Serial.println("Server Response: " + response);
            if (response.indexOf("\"is_collecting\":true") > 0) {
                isCollecting = true;
            }
        } else {
            Serial.print("Failed to get status, Error code: ");
            Serial.println(httpResponseCode);
        }
        http.end();
    } else {
        Serial.println("WiFi not connected!");
    }
}

void sendIMUData() {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Prepare JSON payload
    String jsonData = "{";
    jsonData += "\"accel_x\":" + String(a.acceleration.x, 4) + ",";
    jsonData += "\"accel_y\":" + String(a.acceleration.y, 4) + ",";
    jsonData += "\"accel_z\":" + String(a.acceleration.z, 4) + ",";
    jsonData += "\"gyro_x\":" + String(g.gyro.x, 4) + ",";
    jsonData += "\"gyro_y\":" + String(g.gyro.y, 4) + ",";
    jsonData += "\"gyro_z\":" + String(g.gyro.z, 4);
    jsonData += "}";

    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(String(serverUrl) + "/imu");
        http.addHeader("Content-Type", "application/json");

        int httpResponseCode = http.POST(jsonData);
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);

        http.end();
    } else {
        Serial.println("WiFi not connected!");
    }
}
