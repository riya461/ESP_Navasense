#include <Wire.h>
#include <SPI.h>
#include <BleMouse.h>

uint8_t data[6];
int16_t gyroX, gyroZ;

int Sensitivity = 200;  // Increase sensitivity to reduce cursor speed
int delayi = 5;  // Slightly increased delay for smoother movement

BleMouse bleMouse;

uint32_t timer;
uint8_t i2cData[14];

const uint8_t IMUAddress = 0x68;
const uint16_t I2C_TIMEOUT = 1000;

// Thresholds for gyro movement to avoid unintended mouse movement
const int gyroThresholdX = 3; // Reduced for finer control
const int gyroThresholdZ = 3;

// Smoothing variables
float smoothedGyroX = 0;
float smoothedGyroZ = 0;
float alpha = 0.2; // Smoothing factor between 0 and 1

// Initialization delay settings
unsigned long movementStartDelay = 1000;  // 1-second delay before cursor starts moving
unsigned long startTime;
bool movementEnabled = false;

uint8_t i2cWrite(uint8_t registerAddress, uint8_t* data, uint8_t length, bool sendStop) {
    Wire.beginTransmission(IMUAddress);
    Wire.write(registerAddress);
    Wire.write(data, length);
    return Wire.endTransmission(sendStop);
}

uint8_t i2cWrite2(uint8_t registerAddress, uint8_t data, bool sendStop) {
    return i2cWrite(registerAddress, &data, 1, sendStop);
}

uint8_t i2cRead(uint8_t registerAddress, uint8_t* data, uint8_t nbytes) {
    uint32_t timeOutTimer;
    Wire.beginTransmission(IMUAddress);
    Wire.write(registerAddress);
    if (Wire.endTransmission(false))
        return 1;
    Wire.requestFrom(IMUAddress, nbytes, (uint8_t)true);
    for (uint8_t i = 0; i < nbytes; i++) {
        if (Wire.available())
            data[i] = Wire.read();
        else {
            timeOutTimer = micros();
            while (((micros() - timeOutTimer) < I2C_TIMEOUT) && !Wire.available());
            if (Wire.available())
                data[i] = Wire.read();
            else
                return 2;
        }
    }
    return 0;
}

void setup() {
    Wire.begin();
    Serial.begin(115200);
    bleMouse.begin();

    // Initialize IMU settings
    i2cData[0] = 7;
    i2cData[1] = 0x00;
    i2cData[3] = 0x00;

    while (i2cWrite(0x19, i2cData, 4, false));
    while (i2cWrite2(0x6B, 0x01, true));
    while (i2cRead(0x75, i2cData, 1));
    delay(100);
    while (i2cRead(0x3B, i2cData, 6));

    startTime = millis();  // Record the start time
    delay(100);
}

void loop() {
    while (i2cRead(0x3B, i2cData, 14));

    // Check if the initialization delay has passed
    if (millis() - startTime >= movementStartDelay) {
        movementEnabled = true;  // Enable movement after delay
    }

    // Read the gyro data
    gyroX = ((i2cData[8] << 8) | i2cData[9]);
    gyroZ = ((i2cData[12] << 8) | i2cData[13]);

    // Normalize gyroscope data with Sensitivity adjustment
    gyroX = gyroX / Sensitivity / 1.1 * -1;
    gyroZ = gyroZ / Sensitivity * -1;

    // Exponential smoothing
    smoothedGyroX = alpha * gyroX + (1 - alpha) * smoothedGyroX;
    smoothedGyroZ = alpha * gyroZ + (1 - alpha) * smoothedGyroZ;

    // Only process movements if BLE mouse is connected and movement is enabled
    if (bleMouse.isConnected() && movementEnabled) {
        Serial.print("Smoothed Gyro X: ");
        Serial.print(smoothedGyroX);
        Serial.print("   Smoothed Gyro Z: ");
        Serial.print(smoothedGyroZ);
        Serial.print("\r\n");

        // Non-linear scaling and move the mouse based on gyro data if above threshold
        int adjustedGyroX = (abs(smoothedGyroX) > gyroThresholdX) ? smoothedGyroX * 0.5 : smoothedGyroX;
        int adjustedGyroZ = (abs(smoothedGyroZ) > gyroThresholdZ) ? smoothedGyroZ * 0.5 : smoothedGyroZ;

        bleMouse.move(adjustedGyroZ, -adjustedGyroX);
    }

    // Delay to control the refresh rate of the loop
    delay(delayi);
}

