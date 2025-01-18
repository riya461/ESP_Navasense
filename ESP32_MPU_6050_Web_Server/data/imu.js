let scene, camera, renderer, cube;

function parentWidth(elem) {
  return elem.parentElement.clientWidth;
}

function parentHeight(elem) {
  return elem.parentElement.clientHeight;
}
function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const container = document.getElementById("3Dcube");
  camera = new THREE.PerspectiveCamera(
    75,
    parentWidth(container) / parentHeight(container),
    0.1,
    1000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(parentWidth(container), parentHeight(container));

  container.appendChild(renderer.domElement);

  // Create a square boundary
  const squareSize = 20;
  const squareGeometry = new THREE.PlaneGeometry(squareSize, squareSize);
  const squareMaterial = new THREE.MeshBasicMaterial({
    color: 0xe0e0e0,
    side: THREE.DoubleSide,
  });
  const square = new THREE.Mesh(squareGeometry, squareMaterial);
  square.rotation.x = Math.PI / 2; // Align the square horizontally
  scene.add(square);

  // Create a pen-like object (cylinder)
  const penGeometry = new THREE.CylinderGeometry(0.2, 0.2, 5, 32);
  const penMaterial = new THREE.MeshBasicMaterial({ color: 0x0077b6 });
  const pen = new THREE.Mesh(penGeometry, penMaterial);

  pen.position.set(0, 2.5, 0); // Start at the center above the square
  scene.add(pen);

  // Set camera position
  camera.position.set(0, 20, 20);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);

  // Attach the pen to global scope for sensor updates
  window.pen = pen;
}

// Resize the 3D object when the browser window changes size
function onWindowResize() {
  camera.aspect = parentWidth(document.getElementById("3Dcube")) / parentHeight(document.getElementById("3Dcube"));
  camera.updateProjectionMatrix();
  renderer.setSize(parentWidth(document.getElementById("3Dcube")), parentHeight(document.getElementById("3Dcube")));
}

window.addEventListener('resize', onWindowResize, false);

// Initialize the 3D scene
init3D();

// Initialize variables to track position based on accelerometer readings
let position = { x: 0, y: 0,z:0 };
const accelerationScale = 0.05; // Scale factor for accelerometer data to control movement sensitivity

// Create events for the sensor readings
if (!!window.EventSource) {
  var source = new EventSource('/events');

  source.addEventListener('open', function(e) {
    console.log("Events Connected");
  }, false);

  source.addEventListener('error', function(e) {
    if (e.target.readyState != EventSource.OPEN) {
      console.log("Events Disconnected");
    }
  }, false);

  // Gyroscope data for cube rotation
  source.addEventListener('gyro_readings', function(e) {
    var obj = JSON.parse(e.data);
    document.getElementById("gyroX").innerHTML = obj.gyroX;
    document.getElementById("gyroY").innerHTML = obj.gyroY;
    document.getElementById("gyroZ").innerHTML = obj.gyroZ;

    // Update cube rotation
    cube.rotation.x = obj.gyroY;
    cube.rotation.z = obj.gyroX;
    cube.rotation.y = obj.gyroZ;
    renderer.render(scene, camera);
  }, false);

  // Force sensor data display
  source.addEventListener('forces_readings', function(e) {
    var obj = JSON.parse(e.data);
    document.getElementById("fsrpin1").innerHTML = obj.fsrpin1;
    document.getElementById("fsrpin2").innerHTML = obj.fsrpin2;
    document.getElementById("fsrpin3").innerHTML = obj.fsrpin3;
  }, false);

  // Accelerometer data for cube trajectory using only x and y axes
  source.addEventListener('accelerometer_readings', function(e) {
    var obj = JSON.parse(e.data);
    document.getElementById("accX").innerHTML = obj.accX;
    document.getElementById("accY").innerHTML = obj.accY;
    document.getElementById("accZ").innerHTML = obj.accZ;

    // // Update position based on accelerometer readings (only x and y axes)
    // position.x += (obj.accX) * accelerationScale;
    // position.y += (obj.accY) * accelerationScale;
    // position.z += (obj.accZ) * accelerationScale;

    // // Set cube's position in the 3D space with z constant
    // cube.position.set(position.x, position.y, position.z);
    // renderer.render(scene, camera);
  }, false);
}

function resetPosition(element) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/" + element.id, true);
  console.log(element.id);
  xhr.send();
}
