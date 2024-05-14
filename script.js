let scene, camera, renderer, controls, pallet;
let rolls = [];
let rollDiameter = 0;
let gramWeight = 0;
let totalWeight = 0;
let mybutton = document.getElementById("editBtn");

window.onscroll = function() {scrollFunction()};

function scrollFunction() {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    mybutton.style.display = "block";
  } else {
    mybutton.style.display = "none";
  }
}

function goTo() {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}

document.getElementById('palletOrientation').addEventListener('change', updatePallet);
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('input, select').forEach(input => input.addEventListener('change', calculate));
    calculate();
});

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(100, 1950/900, 0.01, 1000);
    camera.position.set(0.5, 0.5, 1);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1950, 900);
    renderer.setClearColor(0xffffff, 1);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(5, 70, 50);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    initRolls();
    updatePallet();
    animate();
    calculate();
}

function initRolls() {
    rolls.forEach(roll => {
        scene.remove(roll.mesh);
        scene.remove(roll.bobbin);
    });
    rolls = [];
}

function updatePallet() {
    if (pallet) {
        scene.remove(pallet); // Remove the existing pallet from the scene
    }

    const loader = new THREE.TextureLoader();
    const woodTexture = loader.load('styles/images/wood.jpeg');
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(3, 3); // Adjust texture repeat for better appearance

    const palletMaterial = new THREE.MeshPhongMaterial({
        map: woodTexture,
        bumpMap: woodTexture,
        bumpScale: 0.05,
        specular: new THREE.Color('grey'),
        shininess: 50
    });

    const orientation = document.getElementById('palletOrientation').value;
    const length = orientation === 'long' ? 0.8 : 1.2;
    const width = orientation === 'long' ? 1.2 : 0.8;
    const palletGroup = new THREE.Group();

    const numTopBoards = 5;  // Number of boards across the width
    const gapBetweenBoards = 0.06;  // Gap of 0.01 meters between boards
    const totalGapWidth = (numTopBoards - 1) * gapBetweenBoards;  // Total width used by gaps
    const availableWidthForBoards = width - totalGapWidth;  // Total width available for boards
    const topBoardThickness = 0.02;  // Thickness of each board
    const topBoardWidth = availableWidthForBoards / numTopBoards;  // Width of each board

    for (let i = 0; i < numTopBoards; i++) {
        const board = new THREE.Mesh(
            new THREE.BoxGeometry(length, topBoardThickness, topBoardWidth),
            palletMaterial
        );
        // Positioning the first board at the left edge and each subsequent board next to the previous one
        let boardPositionZ = -width / 2 + topBoardWidth / 2 + i * (topBoardWidth + gapBetweenBoards);
        board.position.set(0, -0.01, boardPositionZ);  // Adjust y position if needed
        palletGroup.add(board);
    }

    // Support blocks (unchanged)
    const blockHeight = 0.1;
    const blockPositions = [-length / 2.2, -length / 65 , length / 2 - 0.05];
    blockPositions.forEach(posX => {
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, blockHeight, width),
            palletMaterial
        );
        block.position.set(posX, -0.07, 0);
        palletGroup.add(block);
    });

    pallet = palletGroup;
    scene.add(palletGroup);
}

function calculate() {
    const bobbinWeights = {
        '76.6': { '6': 1500, '10': 1800, '12': 2000, '15': 2400 },
        '135.5': { '6': 3000, '10': 3500, '12': 4000, '15': 4500 }
    };

    const palletWeight = 25000;

    const rollWidth = parseFloat(document.getElementById('rollWidth').value);  // convert cm to meters, width of the roll
    const rollFold = parseFloat(document.getElementById('rollFold').value) || 1; // Default to 1 if input is empty
    const lengthOfPlastic = parseFloat(document.getElementById('plasticLength').value) || 0; // Default to 0 if input is empty
    const thicknessOfPlastic = parseFloat(document.getElementById('plasticThickness').value) || 1; // Default to 1 if input is empty
    const typeOfPlastic = parseFloat(document.getElementById('type').value) || 1; // Default to 1 if input is empty
    const styleOfPlastic = parseFloat(document.getElementById('style').value) || 1; // Default to 1 if input is empty
    const densitetOfPlastic = parseFloat(document.getElementById('densitet').value) || 1; // Default to 1 if input is empty
    const bobbinInnerDiameter = parseFloat(document.getElementById('bobbinInnerDiameter').value); // in mm
    const sliceQuantity = parseInt(document.getElementById('sliceCount').innerText) || 1;   
    const rollQuantity = parseInt(document.getElementById('rollCount').innerText) || 1;  
    const bobbinThickness = parseFloat(document.getElementById('bobbinThickness').value) || 1; // Default to 1 if input is empty
    const bobbinTotalDiameter = bobbinInnerDiameter + ( bobbinThickness * 2 ); // Assuming bobbin diameter is twice the thickness
    const bobbinWeight = bobbinWeights[bobbinInnerDiameter][bobbinThickness] * rollWidth / 1000 || 0;

    if (lengthOfPlastic > 0) {
        rollWeight = ((((rollWidth + rollFold) * typeOfPlastic) * thicknessOfPlastic * densitetOfPlastic * lengthOfPlastic * 0.001) / sliceQuantity) * 1000;
        totalWeight = rollWeight + bobbinWeight;
        totalWeightonPallet = ((rollWeight + bobbinWeight) * rollQuantity) + palletWeight;
        gramWeight = ((((rollWidth + rollFold) * typeOfPlastic) * thicknessOfPlastic * densitetOfPlastic * 0.001) / sliceQuantity) * 1000;
        rollDiameter = Math.sqrt((((thicknessOfPlastic * lengthOfPlastic * styleOfPlastic * 1000) / Math.PI) + (Math.pow(bobbinTotalDiameter / 2, 2)))) * 2 / 1000;
    } else {
        rollWeight = 0;
        totalWeight = 0;
        totalWeightonPallet = palletWeight;
        gramWeight = 0;
        rollDiameter = 0;
    }

    document.getElementById('rollWeight').textContent = (rollWeight / 1000).toFixed(1) + " kg";
    document.getElementById('totalWeight').textContent = (totalWeight / 1000).toFixed(1) + " kg";
    document.getElementById('totalWeightonPallet').textContent = (totalWeightonPallet / 1000).toFixed(1) + " kg";
    document.getElementById('gramWeight').textContent = (gramWeight).toFixed(1) + " g";
    document.getElementById('rollDiameter').textContent = (rollDiameter * 1000).toFixed(1) + " mm";
    updateRoll();
}

function addRoll() {
    const rollWidth = parseFloat(document.getElementById('rollWidth').value) / 1000;  // convert cm to meters, width of the roll
    const bobbinThickness = parseFloat(document.getElementById('bobbinThickness').value) / 1000;  // convert cm to meters, thickness of the bobbin wall
    const bobbinInnerDiameter = parseFloat(document.getElementById('bobbinInnerDiameter').value) / 1000; // in mm
    const bobbinOuterDiameter = bobbinInnerDiameter + 2 * bobbinThickness;

    const rollGeometry = new THREE.CylinderGeometry(rollDiameter / 2, rollDiameter / 2, rollWidth, 32);
    const rollMaterial = new THREE.MeshPhongMaterial({ color: 0xF9FEDB, opacity: 0.85, transparent: true });
    const roll = new THREE.Mesh(rollGeometry, rollMaterial);
    roll.rotation.x = Math.PI / 2;

    const bobbinGeometry = new THREE.CylinderGeometry(bobbinOuterDiameter / 2, bobbinOuterDiameter / 2, rollWidth, 32);
    const bobbinMaterial = new THREE.MeshPhongMaterial({ color: 0xAE6C07 });
    const bobbin = new THREE.Mesh(bobbinGeometry, bobbinMaterial);
    bobbin.rotation.x = Math.PI / 2;

    // Calculate position based on existing rolls
    roll.position.y = rollDiameter / 2;
    bobbin.position.y = roll.position.y;

    // Add roll to scene temporarily to calculate positions
    scene.add(roll);
    scene.add(bobbin);
    rolls.push({mesh: roll, bobbin: bobbin, width: rollWidth, diameter: rollDiameter, position: roll.position, geometry: roll.geometry});

    // Center all rolls
    centerRolls();
    updateRollCount(1);
}

function removeRoll() {
    if (rolls.length > 0) {
        const lastRoll = rolls.pop();
        scene.remove(lastRoll.mesh);
        scene.remove(lastRoll.bobbin);
        updateRollCount(-1);  // Decrement roll count
        centerRolls();
    }
}

function addSlice() {
    let sliceCount = parseInt(document.getElementById('sliceCount').innerText);
    sliceCount++;
    document.getElementById('sliceCount').innerText = sliceCount;
    calculate();
}

function removeSlice() {
    let sliceCount = parseInt(document.getElementById('sliceCount').innerText);
    if (sliceCount > 1) {
        sliceCount--;
        document.getElementById('sliceCount').innerText = sliceCount;
        calculate();
    }
}

function updateRollCount(change) {
    let rollCount = parseInt(document.getElementById('rollCount').innerText);
    rollCount += change;
    document.getElementById('rollCount').innerText = rollCount;
    if (rollCount > 0) {
        calculate();
    } else {
        document.getElementById('rollWeight').textContent = (0).toFixed(1) + " kg";
        document.getElementById('totalWeight').textContent = (0).toFixed(1) + " kg";
        document.getElementById('totalWeightonPallet').textContent = (25000 / 1000).toFixed(1) + " kg";
        document.getElementById('gramWeight').textContent = (0).toFixed(1) + " g";
        document.getElementById('rollDiameter').textContent = (0).toFixed(1) + " mm";
    }
}

function updateRoll() {
    const rollWidth = parseFloat(document.getElementById('rollWidth').value) / 1000;
    const sliceCount = parseInt(document.getElementById('sliceCount').innerText);
    const bobbinThickness = parseFloat(document.getElementById('bobbinThickness').value) / 1000;
    const bobbinInnerDiameter = parseFloat(document.getElementById('bobbinInnerDiameter').value) / 1000; // in mm
    const bobbinOuterDiameter = bobbinInnerDiameter + 2 * bobbinThickness;

    if (rolls.length === 0) {
       addRoll();
    } else {
        rolls.forEach(roll => {
            roll.mesh.geometry.dispose(); // Dispose old geometry
            roll.bobbin.geometry.dispose();

            const newWidth = rollWidth / sliceCount; 
            roll.mesh.geometry = new THREE.CylinderGeometry(rollDiameter / 2, rollDiameter / 2, rollWidth, 32);
            roll.bobbin.geometry = new THREE.CylinderGeometry(bobbinOuterDiameter / 2, bobbinOuterDiameter / 2, rollWidth, 32);

            roll.width = newWidth;
            roll.diameter = rollDiameter; // Update roll's diameter in array
            roll.width = rollWidth; // Update roll's width in array
            
            // Update position if needed based on new diameter
            roll.mesh.position.y = rollDiameter / 2;
            roll.bobbin.position.y = rollDiameter / 2;
        });
        centerRolls();
    }
}

function centerRolls() {
    const orientation = document.getElementById('palletOrientation').value;
    let rollCount = parseInt(document.getElementById('rollCount').innerText);
    const fullWidth = orientation === 'long' ? 1.2 : 0.8;
    let totalWidth = 0;

    if (rollCount > 0) {
       // Calculate total width of all rolls
        rolls.forEach(roll => {
            totalWidth += rollDiameter; 
        });
        // Calculate initial x position
        let currentPositionX = -totalWidth / 2 + rolls[0].diameter / 2;

        // Reposition all rolls
        rolls.forEach(roll => {
            roll.mesh.position.x = currentPositionX;
            roll.bobbin.position.x = currentPositionX;
            currentPositionX += roll.diameter;
        });
    }
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

init();