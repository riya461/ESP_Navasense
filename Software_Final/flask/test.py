import numpy as np
import matplotlib.pyplot as plt

# Data (acceleration in x, y, z and angular velocity in x, y, z)
# The provided data should be organized as follows:
# (acc_x, acc_y, acc_z, gyro_x, gyro_y, gyro_z)
data = [
[-0.85, 9.66, 0.93, 0.11, -1.02, 0.30],
    [-1.42, 8.50, 1.45, -0.13, -0.75, -0.05],
    [-1.23, 8.90, 1.04, 0.05, -0.69, -0.05],
    [-1.58, 10.13, 0.44, 0.07, -0.43, -0.11],
    [-2.34, 8.92, 0.93, 0.13, -0.14, 0.10],
    [-1.75, 8.94, -0.45, 0.19, -0.15, -0.02],
    [-1.99, 9.12, 1.07, 0.11, 0.24, 0.01],
    [-2.46, 9.44, -0.11, 0.13, 0.11, 0.02],
    [-1.87, 9.07, -0.00, 0.30, 0.16, 0.00],
    [-1.92, 9.87, -1.04, 0.26, 0.08, -0.00],
    [-2.12, 9.31, -0.96, -0.25, 0.48, -0.08],
    [-0.48, 9.64, -1.51, -0.33, 1.27, -0.05],
    [-2.42, 9.35, -0.54, -0.43, 0.87, -0.36],
    [-2.24, 9.19, -1.28, -0.43, 0.98, -0.40],
    [-2.82, 8.97, -0.87, -0.37, 1.01, -0.20],
    [-2.58, 9.06, -1.20, -0.32, 1.09, -0.60],
    [-3.00, 8.98, -0.83, -0.48, 0.68, -0.43],
    [-2.97, 9.29, 0.32, -0.39, 0.14, -0.13],
    [-2.92, 9.00, -1.54, -0.09, -0.19, 0.07],
    [-2.87, 8.97, -1.51, -0.14, -0.14, 0.02],
    [-3.97, 8.83, -0.80, -0.12, -0.16, -0.30],
    [-4.04, 8.72, -0.90, -0.33, 0.24, 0.01],
    [-3.29, 8.77, -1.85, -0.11, 0.59, 0.32],
    [-2.39, 9.05, -1.98, -0.28, 0.46, 0.31],
    [-1.18, 9.04, -2.10, -0.19, -0.09, 0.12],
    [-1.76, 9.13, -2.73, -0.12, -0.01, -0.04],
    [-1.79, 9.02, -3.20, -0.23, -0.09, 0.24],
    [-1.10, 9.13, -2.35, -0.28, -0.04, 0.15],
]


# Convert data to numpy array for easier manipulation
data = np.array(data)

# Extract accelerometer (acc) and gyroscope (gyro) data
acc_data = data[:, :3]  # Acceleration data (x, y, z)
gyro_data = data[:, 3:]  # Gyroscope data (x, y, z)

# Initialize variables for integration
dt = 1  # Time step (assuming 1 second between measurements)
velocity = np.zeros(3)  # Initial velocity (m/s)
position = np.zeros(3)  # Initial position (m)

# Placeholder for reconstructed positions
positions = []

# Simple approach: Integrate accelerations directly (not accounting for orientation)
for acc in acc_data:
    # Integrate acceleration to get velocity (simple method)
    velocity += acc * dt  # Velocity update
    
    # Integrate velocity to get position (simple method)
    position += velocity * dt  # Position update
    
    # Store the position
    positions.append(position.copy())

positions = np.array(positions)

# Plot the trajectory
fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')

# Extract position components
x_pos = positions[:, 0]
y_pos = positions[:, 1]
z_pos = positions[:, 2]

# Plot the trajectory in 3D
ax.plot(x_pos, y_pos, z_pos, label="Trajectory")
ax.set_xlabel('X Position (m)')
ax.set_ylabel('Y Position (m)')
ax.set_zlabel('Z Position (m)')
ax.legend()

plt.show()
