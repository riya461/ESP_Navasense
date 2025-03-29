
#include "BleMouse.h"
#include "I2Cdev.h"
#include "MPU6050.h"
#include "Wire.h"
#include "LittleFS.h"

BleMouse bleMouse("ESP32 Air Mouse");
MPU6050 accelgyro;

struct CalibrationData {
  float xScale = 0.2;  // Reduced sensitivity
  float yScale = 0.2;
  int16_t xOffset = 0;
  int16_t yOffset = 0;
  bool calibrated = false;
};

CalibrationData calData;
bool isCalibrating = false;
enum CalibrationPhase { NONE, TOP_BOTTOM, LEFT_RIGHT, DONE };
CalibrationPhase calPhase = NONE;

void setup() {
  Serial.begin(115200);
  
  if (!LittleFS.begin()) {
    Serial.println("LittleFS initialization failed!");
    while(1);
  }
  
  loadCalibration();

  Wire.begin();
  Wire.setClock(400000);
  accelgyro.initialize();
  accelgyro.setFullScaleGyroRange(MPU6050_GYRO_FS_250);
  
  if (!accelgyro.testConnection()) {
    Serial.println("MPU6050 connection failed");
    while(1);
  }
  
  bleMouse.begin();
  Serial.println("Wireless BLE Mouse Ready");
}

void loop() {
  if (isCalibrating) {
    handleCalibration();
    return;
  }

  if (bleMouse.isConnected()) {
    int16_t gx, gy, gz;
    accelgyro.getRotation(&gx, &gy, &gz);

    float moveX = (gx - calData.xOffset) * calData.xScale * 0.5;
    float moveY = (gy - calData.yOffset) * calData.yScale * 0.5;

    if (abs(moveX) < 150) moveX = 0;
    if (abs(moveY) < 150) moveY = 0;

    if (moveX != 0 || moveY != 0) {
      bleMouse.move(-moveX/200, -moveY/200);
    }
  }

  checkSerialCommands();
  delay(20);
}

void handleCalibration() {
  static unsigned long lastPrint = 0;
  static int16_t minX = 32767, maxX = -32768, minY = 32767, maxY = -32768;
  
  if (millis() - lastPrint > 2000) {
    switch (calPhase) {
      case TOP_BOTTOM:
        Serial.println("MOVE UP-DOWN (wait for DONE message)");
        break;
      case LEFT_RIGHT:
        Serial.println("MOVE LEFT-RIGHT (wait for DONE message)");
        break;
      case DONE:
        finishCalibration();
        return;
      default: break;
    }
    lastPrint = millis();
  }

  int16_t gx, gy, gz;
  accelgyro.getRotation(&gx, &gy, &gz);
  
  minX = min(minX, gx);
  maxX = max(maxX, gx);
  minY = min(minY, gy);
  maxY = max(maxY, gy);

  static bool moved = false;
  static unsigned long moveStart = 0;
  
  if (abs(gx) > 500 || abs(gy) > 500) {
    if (!moved) {
      moved = true;
      moveStart = millis();
    }
  }
  
  if (moved && (millis() - moveStart > 2000)) {
    if (calPhase == TOP_BOTTOM) {
      calData.yScale = 500.0f/(maxY - minY);
      Serial.println("VERTICAL DONE");
      calPhase = LEFT_RIGHT;
    } 
    else if (calPhase == LEFT_RIGHT) {
      calData.xScale = 500.0f/(maxX - minX);
      Serial.println("HORIZONTAL DONE");
      calPhase = DONE;
    }
    minX = minY = 32767;
    maxX = maxY = -32768;
    moved = false;
    delay(1000);
  }
}

void finishCalibration() {
  Serial.println("Calculating offsets... Keep device STILL");
  delay(2000);
  
  int16_t gx, gy;
  long sumX = 0, sumY = 0;
  const int samples = 200;
  
  for(int i = 0; i < samples; i++) {
    accelgyro.getRotation(&gx, &gy, nullptr);
    sumX += gx;
    sumY += gy;
    delay(10);
  }
  
  calData.xOffset = sumX/samples;
  calData.yOffset = sumY/samples;
  calData.calibrated = true;
  
  saveCalibration();
  
  Serial.println("\nCALIBRATION COMPLETE");
  printCalibrationStatus();
  isCalibrating = false;
  calPhase = NONE;
}

void loadCalibration() {
  if (LittleFS.exists("/calibration.dat")) {
    File file = LittleFS.open("/calibration.dat", "r");
    if (file.read((uint8_t*)&calData, sizeof(calData))) {
      Serial.println("Loaded existing calibration");
    }
    file.close();
  } else {
    Serial.println("Using default calibration");
  }
}

void saveCalibration() {
  File file = LittleFS.open("/calibration.dat", "w");
  file.write((uint8_t*)&calData, sizeof(calData));
  file.close();
}

void checkSerialCommands() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd == "CALIBRATE") {
      isCalibrating = true;
      calPhase = TOP_BOTTOM;
      Serial.println("\nStarting Calibration...");
    }
    else if (cmd == "STATUS") {
      printCalibrationStatus();
    }
    else if (cmd == "RESET") {
      LittleFS.remove("/calibration.dat");
      calData = {0.2, 0.2, 0, 0, false};
      Serial.println("Calibration reset to defaults");
    }
  }
}

void printCalibrationStatus() {
  Serial.println("\n--- CALIBRATION STATUS ---");
  Serial.printf("X Sensitivity: %.4f\n", calData.xScale);
  Serial.printf("Y Sensitivity: %.4f\n", calData.yScale);
  Serial.printf("X Offset: %d\n", calData.xOffset);
  Serial.printf("Y Offset: %d\n", calData.yOffset);
  Serial.printf("Calibrated: %s\n", calData.calibrated ? "YES" : "NO");
  Serial.println("Send 'CALIBRATE' to recalibrate");
}
