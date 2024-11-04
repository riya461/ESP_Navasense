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

  camera = new THREE.PerspectiveCamera(75, parentWidth(document.getElementById("3Dcube")) / parentHeight(document.getElementById("3Dcube")), 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(parentWidth(document.getElementById("3Dcube")), parentHeight(document.getElementById("3Dcube")));

  document.getElementById('3Dcube').appendChild(renderer.domElement);

  // Create a geometry for the cube
  const geometry = new THREE.BoxGeometry(5, 1, 4);

  // Define materials for each face of the cube
  var cubeMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x03045e }),
    new THREE.MeshBasicMaterial({ color: 0x023e8a }),
    new THREE.MeshBasicMaterial({ color: 0x0077b6 }),
    new THREE.MeshBasicMaterial({ color: 0x03045e }),
    new THREE.MeshBasicMaterial({ color: 0x023e8a }),
    new THREE.MeshBasicMaterial({ color: 0x0077b6 }),
  ];

  const material = new THREE.MeshFaceMaterial(cubeMaterials);

  // Create and add the cube to the scene
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  camera.position.z = 10;
  renderer.render(scene, camera);
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
