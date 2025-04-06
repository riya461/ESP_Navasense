/*********
  Rui Santos & Sara Santos - Random Nerd Tutorials
  Complete project details at https://RandomNerdTutorials.com/esp32-mpu-6050-web-server/
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files.
*********/
#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Arduino_JSON.h>
#include "LittleFS.h"


// Replace with your network credentials
const char* ssid = "SSID";
const char* password = "PASSWORD";

// Create AsyncWebServer object on port 80
AsyncWebServer server(80);

// Create an Event Source on /events
AsyncEventSource events("/events");

// Json Variable to Hold Sensor Readings
JSONVar readings;

// Timer variables
unsigned long lastTime = 0;  
unsigned long lastTimeAcc = 0;

unsigned long gyroDelay = 100;
unsigned long accelerometerDelay = 100;

// Create a sensor object
Adafruit_MPU6050 mpu;

sensors_event_t a, g, temp;

float gyroX, gyroY, gyroZ;
float accX, accY, accZ;



// Init MPU6050
void initMPU(){
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
    while (1) {
      delay(10);
    }
  }
  Serial.println("MPU6050 Found!");
}

void initLittleFS() {
  if (!LittleFS.begin()) {
    Serial.println("An error has occurred while mounting LittleFS");
  }
  Serial.println("LittleFS mounted successfully");
}

// Initialize WiFi
void initWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.println("");
  Serial.print("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("");
  Serial.println(WiFi.localIP());
}

String getGyroReadings(){
  mpu.getEvent(&a, &g, &temp);

  
  gyroX = g.gyro.x;
  
  
  gyroY = g.gyro.y;
  
  gyroZ = g.gyro.z;
  

  readings["gyroX"] = String(gyroX);
  readings["gyroY"] = String(gyroY);
  readings["gyroZ"] = String(gyroZ);
  
  return JSON.stringify(readings);
}

String getAccReadings() {
  mpu.getEvent(&a, &g, &temp);
  accX = a.acceleration.x;
  accY = a.acceleration.y;
  accZ = a.acceleration.z;

  readings["accX"] = String(accX);
  readings["accY"] = String(accY);
  readings["accZ"] = String(accZ);

  return JSON.stringify(readings);
}


void setup() {
  Serial.begin(115200);
  initWiFi();
  initLittleFS();
  initMPU();
  analogSetAttenuation(ADC_11db); 

  // Handle Web Server
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(LittleFS, "/index.html", "text/html");
  });

  server.serveStatic("/", LittleFS, "/");

  server.on("/reset", HTTP_GET, [](AsyncWebServerRequest *request){
    gyroX=0;
    gyroY=0;
    gyroZ=0;
    request->send(200, "text/plain", "OK");
  });

  server.addHandler(&events);

  server.begin();
}

void loop() {
  // if ((millis() - lastTime) > gyroDelay) {
    events.send(getGyroReadings().c_str(), "gyro_readings", millis());
    // lastTime = millis();
  // }
  // if ((millis() - lastTimeAcc) > accelerometerDelay) {
    events.send(getAccReadings().c_str(), "accelerometer_readings", millis());
    // lastTimeAcc = millis();
  // }
  
  // delay(10);
}
