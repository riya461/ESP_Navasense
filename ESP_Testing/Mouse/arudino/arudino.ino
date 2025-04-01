#include <BleMouse.h>
#include <Adafruit_MPU6050.h>

#define SPEED 8

Adafruit_MPU6050 mpu;
BleMouse bleMouse;

bool sleepMPU = true;
long mpuDelayMillis;

void setup() {
  Serial.begin(115200);
  bleMouse.begin();
  delay(1000);
  
  if (!mpu.begin()) {
    Serial.println("Failed to find MPU6050 chip");
    while (1) {
      delay(10);
    }
  }
  Serial.println("MPU6050 Found!");
  mpu.enableSleep(sleepMPU);
}

void loop() {
  if (bleMouse.isConnected()) {
    if (sleepMPU) {
      delay(3000);
      Serial.println("MPU6050 awakened!");
      sleepMPU = false;
      mpu.enableSleep(sleepMPU);
      delay(500);
    }

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // For 90-degree rotated MPU6050:
    // - Swap X and Z axes for movement
    // - Invert one axis to maintain natural movement direction
    bleMouse.move(g.gyro.z * SPEED, g.gyro.x * SPEED);

    // Alternative mapping if the above doesn't feel natural:
    // bleMouse.move(g.gyro.z * -SPEED, g.gyro.y * SPEED);
  }
}