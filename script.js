let scene, camera, renderer, controls, pallet;
let rolls = [];
let rollDiameter = 0;
let gramWeight = 0;
let totalWeight = 0;
let minutesPerRoll = 0;
const PALLET_LENGTH = 1.2; // måste matcha updatePallet()
const PALLET_WIDTH  = 0.8; // måste matcha updatePallet()
const OVERHANG_TOL  = 0.20; // 5 cm (du kan ändra till 0.03 för 3 cm)
const WIDTH_SINGLE_ROW_THRESHOLD = 0.45; // 450 mm
let mybutton = document.getElementById("editBtn");


window.onscroll = () => {
    mybutton.style.display = (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) ? "block" : "none";
};

function goTo() {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}

function getPalletRotationY() {
  const orientation = document.getElementById('palletOrientation')?.value || 'short';
  return orientation === 'long' ? Math.PI / 2 : 0;
}

function rotateXZ(x, z, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: x * c - z * s, z: x * s + z * c };
}

// Remove old event listener for palletOrientation select; will use radio onchange inline
// document.addEventListener('DOMContentLoaded', function() {
//     const filmTypeRadios = document.querySelectorAll('input[name="filmType"]');
//         const rollFoldGroup = document.getElementById('rollFoldGroup');

//         function updateRollFoldVisibility() {
//             const selected = document.querySelector('input[name="filmType"]:checked');
//             if (!selected || !rollFoldGroup) return;

//             if (selected.id === 'filmFold') {
//                 rollFoldGroup.style.display = '';
//             } else {
//                 rollFoldGroup.style.display = 'none';
//             }
//         }

//         filmTypeRadios.forEach(function (radio) {
//             radio.addEventListener('change', updateRollFoldVisibility);
//         });

//         // Set initial visibility based on the default selected film type
//         updateRollFoldVisibility();

//     document.querySelectorAll('input, select').forEach(input => input.addEventListener('change', calculate));
//     document.getElementById('rollOrientation').addEventListener('change', updateRollOrientation);
//     document.getElementById('rollWidth').addEventListener('change', function() {
//       //  updateRoll(); 
//         updateRollOrientation(); // Ensure correct placement after width change
//     });
//     calculate();
// });

document.addEventListener('DOMContentLoaded', function() {
    // 1) Alla inputs/selects ska trigga calculate()
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', calculate);
    });

    

    // 2) Rullens orientering
    const rollOrientationSelect = document.getElementById('rollOrientation');
    if (rollOrientationSelect) {
        rollOrientationSelect.addEventListener('change', updateRollOrientation);
    }

    const rollWidthInput = document.getElementById('rollWidth');
    if (rollWidthInput) {
        rollWidthInput.addEventListener('change', function() {
            //  updateRoll();
            updateRollOrientation(); // säkerställ korrekt placering efter breddändring
        });
    }

    // 3) Filmtyp (dropdown) styr om Invik-fältet visas
    const filmTypeSelect = document.getElementById('filmType');
    const rollFoldGroup = document.getElementById('rollFoldGroup');
    const rollFoldInput = document.getElementById('rollFold');
    const rollFoldCollapseEl = document.getElementById('rollFoldCollapse');
    const rollFoldCollapse =
    rollFoldCollapseEl && window.bootstrap
        ? new bootstrap.Collapse(rollFoldCollapseEl, { toggle: false })
        : null;

    function updateRollFoldVisibility() {
        const selectedValue = filmTypeSelect ? String(filmTypeSelect.value) : '2';

        if (selectedValue === '4') {
            // ✅ Smooth open
            if (rollFoldCollapse) rollFoldCollapse.show();
            else if (rollFoldGroup) rollFoldGroup.style.display = '';
        } else {
            // ✅ Smooth close + reset value
            if (rollFoldCollapse) rollFoldCollapse.hide();
            else if (rollFoldGroup) rollFoldGroup.style.display = 'none';

            if (rollFoldInput) rollFoldInput.value = 0;
        }
    }

    if (filmTypeSelect) {
        filmTypeSelect.addEventListener('change', function() {
            updateRollFoldVisibility();
            calculate();
        });
    }

    // 4) Init-läge
    updateRollFoldVisibility();
    calculate();
});

// function init() {
//     scene = new THREE.Scene();
//     camera = new THREE.PerspectiveCamera(100, 537.2/500, 0.01, 1000);
//     camera.position.set(0.5, 0.5, 1);
//     renderer = new THREE.WebGLRenderer({ antialias: true });
//     renderer.setSize(537.2, 500);
//     renderer.setClearColor(0xffffff, 1);
//     // document.body.appendChild(renderer.domElement);

//     const container = document.getElementById('three-container');
//     container.appendChild(renderer.domElement);

//     const light = new THREE.PointLight(0xffffff, 1);
//     light.position.set(0, 99, 99);
//     scene.add(light);
//     scene.add(new THREE.AmbientLight(0x404040));

//     controls = new THREE.OrbitControls(camera, renderer.domElement);

//     initRolls();
//     updatePallet();
//     animate();
//    // calculate();
// }

function init() {
  scene = new THREE.Scene();

  const container = document.getElementById("three-container");

  const w = container.clientWidth || 537.2;
  const h = container.clientHeight || 500;

  camera = new THREE.PerspectiveCamera(100, w / h, 0.01, 1000);
  camera.position.set(0.5, 0.5, 1);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });

  // ✅ Makes it crisp on Retina/HiDPI screens
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // ✅ Match canvas to container size (no blur)
  renderer.setSize(w, h, false);

  // Transparent so your panel background shows (optional)
  renderer.setClearColor(0x000000, 0);

  // Better color handling for Three r140
  renderer.outputEncoding = THREE.sRGBEncoding;

  container.innerHTML = ""; // avoids multiple canvases during reload
  container.appendChild(renderer.domElement);

  const light = new THREE.PointLight(0xffffff, 1);
  light.position.set(0, 99, 99);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  controls = new THREE.OrbitControls(camera, renderer.domElement);

  initRolls();
  updatePallet();

  function resizeRenderer() {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(cw, ch, false);

    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resizeRenderer);

  // If layout changes due to grid/responsive, keep it sharp
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(resizeRenderer);
    ro.observe(container);
  }

  resizeRenderer();
  animate();
}

function initRolls() {
    rolls.forEach(roll => {
        scene.remove(roll.mesh);
        scene.remove(roll.bobbin);
    });
    rolls = [];
}

function updatePallet() {
    // Remove the existing pallet from the scene if it exists
    if (pallet) scene.remove(pallet);

    // Load wood texture for the pallet
    const loader = new THREE.TextureLoader();
    const woodTexture = loader.load('styles/images/wood.jpeg');
    woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(3, 3);

    // Create material for the pallet
    const palletMaterial = new THREE.MeshPhongMaterial({
        map: woodTexture,
        bumpMap: woodTexture,
        bumpScale: 0.05,
        specular: new THREE.Color('grey'),
        shininess: 50
    });

    // Define the constant size of the pallet
    const length = 1.2;  // fixed length
    const width = 0.8;   // fixed width
    const palletGroup = new THREE.Group();

    // Function to create and add boards to the pallet
    const createBoard = (x, y, z) => {
        const board = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, (width - (5 - 1) * 0.06) / 5), palletMaterial);
        board.position.set(x, y, z);
        palletGroup.add(board);
    };

    // Create top boards on the pallet
    for (let i = 0; i < 5; i++) {
        createBoard(0, -0.01, -width / 2 + 0.06 * i + (width - 0.24) / 5 * (i + 0.5));
    }

    // Create support blocks under the pallet
    [-length / 2.2, -length / 65, length / 2 - 0.05].forEach(posX => {
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, width), palletMaterial);
        block.position.set(posX, -0.07, 0);
        palletGroup.add(block);
    });

    // Get the pallet orientation value and apply rotation
    const orientation = document.getElementById('palletOrientation')?.value || 'short';
    if (orientation === 'long') {
        palletGroup.rotation.y = Math.PI / 2; // Rotate 90 degrees
    } else {
        palletGroup.rotation.y = 0; // No rotation
    }

    // Add the new pallet to the scene
    scene.add(pallet = palletGroup);
}

function calculate() {    
    const bobbinWeights = {
        '76.5': { '6': 1100, '10': 1900, '12': 2400, '15': 3000 },
        '135.5': { '6': 3000, '10': 3500, '12': 4000, '15': 5000 }
    };

    const palletWeight = 25000;

    const rollWidth = parseFloat(document.getElementById('rollWidth').value);  // convert cm to meters, width of the roll
    const rollFold = parseFloat(document.getElementById('rollFold').value) || 0; // Default to 0 if empty/hidden
    const lengthOfPlastic = parseFloat(document.getElementById('plasticLength').value) || 0; // Default to 0 if input is empty
    const thicknessOfPlastic = parseFloat(document.getElementById('plasticThickness').value) || 1; // Default to 1 if input is empty
    const typeOfPlastic = parseFloat(document.getElementById('windingType')?.value || '1');
    const styleOfPlastic = parseFloat(document.getElementById('filmType')?.value || '2');
    const densitetOfPlastic = parseFloat(document.getElementById('densitet').value) || 1; // Default to 1 if input is empty
    const bobbinInnerDiameter = parseFloat(document.getElementById('bobbinInnerDiameter')?.value || '76.5');
    const sliceQuantity = parseInt(document.getElementById('sliceCount').innerText) || 1;   
    const rollQuantity = parseInt(document.getElementById('rollCount').innerText) || 1;  
    const bobbinThickness = parseFloat(document.getElementById('bobbinThickness')?.value || '6');
    const bobbinTotalDiameter = bobbinInnerDiameter + ( bobbinThickness * 2 ); // Assuming bobbin diameter is twice the thickness
    const bobbinWeight = bobbinWeights[bobbinInnerDiameter][bobbinThickness] * rollWidth / 1000 || 0;
    const outputKgPerHour = parseFloat(document.getElementById('output')?.value || '0') || 0;

    if (lengthOfPlastic > 0) {
        // ✅ Film type (Enkel/Slang/Invik) affects how many layers are wound.
        // styleOfPlastic: 1=Enkel, 2=Slang, 4=Invik
        rollWeight = ((((rollWidth + rollFold) * typeOfPlastic * styleOfPlastic) * thicknessOfPlastic * densitetOfPlastic * lengthOfPlastic * 0.001) / sliceQuantity) * 1000;
        totalWeight = rollWeight + bobbinWeight;
        totalWeightonPallet = ((rollWeight + bobbinWeight) * rollQuantity) + palletWeight;

        const rollWeightKg = rollWeight / 1000; // rollWeight är i gram i din kod
            minutesPerRoll = (rollWeightKg > 0 && outputKgPerHour > 0)
            ? (rollWeightKg / outputKgPerHour) * 60
            : 0;

        // Gramvikt (g/m²) should also reflect film type layers
        gramWeight = ((((rollWidth + rollFold) * typeOfPlastic * styleOfPlastic) * thicknessOfPlastic * densitetOfPlastic * 0.001) / sliceQuantity) * 1000;

        rollDiameter = Math.sqrt((((thicknessOfPlastic * lengthOfPlastic * styleOfPlastic * 1000) / Math.PI) + (Math.pow(bobbinTotalDiameter / 2, 2)))) * 2 / 1000;


       
        if (rolls.length === 0) {
            console.log("HERE-1", rolls.length);
            addRoll(); 
        } else {
            updateRoll();
        }
        
    } else {
        rollWeight = 0;
        totalWeight = 0;
        totalWeightonPallet = palletWeight;
        gramWeight = 0;
        rollDiameter = 0;
        removeRoll();
    }

    pulseValue(document.getElementById('rollWeight'), (rollWeight / 1000).toFixed(1) + " kg");
    pulseValue(document.getElementById('totalWeight'), (totalWeight / 1000).toFixed(1) + " kg");
    pulseValue(document.getElementById('totalWeightonPallet'), (totalWeightonPallet / 1000).toFixed(1) + " kg");
    pulseValue(document.getElementById('gramWeight'), (gramWeight).toFixed(1) + " g");
    pulseValue(document.getElementById('rollDiameter'), (rollDiameter * 1000).toFixed(1) + " mm");

    if (minutesPerRoll > 0) {
    showRollChange(` Rullbytet tar ungefär ${minutesPerRoll.toFixed(1)} minuter`);
    } else {
    const el = document.getElementById('rollChangeTime');
    if (el) el.classList.remove('is-visible');
    }

    // 🔴 Max rekommenderad diameter = 700 mm
    const rollDiameterEl = document.getElementById('rollDiameter');
    const rollDiameterMm = (rollDiameter || 0) * 1000;

    if (rollDiameterEl) {
        if (rollDiameterMm > 700.1) {
            rollDiameterEl.classList.add('over-limit');
            showInlineWarning(" Rulldiameter över 700 mm – ej rekommenderat.");
        } else {
            rollDiameterEl.classList.remove('over-limit');
        }
    }
}

function updateRoll() {
    const rollWidth = parseFloat(document.getElementById('rollWidth').value) / 1000; // Convert mm to meters
    const sliceCount = parseInt(document.getElementById('sliceCount').innerText);
    const bobbinThickness = parseFloat(document.getElementById('bobbinThickness')?.value || '6') / 1000;
    const bobbinInnerDiameter = parseFloat(document.getElementById('bobbinInnerDiameter')?.value || '76.5') / 1000;
    const bobbinOuterDiameter = bobbinInnerDiameter + 2 * bobbinThickness; // Calculate outer diameter
    const rollOrientation = document.getElementById('rollOrientation').value;
    const isStanding = rollOrientation === 'standing';

    // Calculate the roll diameter for current configuration
    const rollDiameterM = (typeof rollDiameter === 'number' && rollDiameter > 0) ? rollDiameter : 0;

    const newWidth = rollWidth / sliceCount; // Adjust width based on slice count

    // Update all existing rolls with new dimensions
    rolls.forEach(roll => {
        roll.mesh.geometry.dispose(); // Dispose of old geometry
        roll.mesh.geometry = new THREE.CylinderGeometry(rollDiameterM / 2, rollDiameterM / 2, newWidth, 96);
        // roll.bobbin.geometry.dispose();

        roll.mesh.geometry = new THREE.CylinderGeometry(rollDiameterM / 2, rollDiameterM / 2, newWidth, 32);
        const b = roll.bobbin;
        if (b?.userData?.outerMesh) {
        const innerD = bobbinInnerDiameter;
        const thick = bobbinThickness;
        const outerD = innerD + 2 * thick;

        b.userData.outerMesh.geometry.dispose();
        b.userData.innerMesh.geometry.dispose();
        b.userData.ringFront.geometry.dispose();
        b.userData.ringBack.geometry.dispose();

        b.userData.outerMesh.geometry = new THREE.CylinderGeometry(outerD / 2, outerD / 2, newWidth, 96, 1, true);
        b.userData.innerMesh.geometry = new THREE.CylinderGeometry(innerD / 2, innerD / 2, newWidth, 96, 1, true);

        const ringGeom = new THREE.TorusGeometry(outerD / 2, Math.max(thick * 0.20, 0.002), 12, 64);
        b.userData.ringFront.geometry = ringGeom;
        b.userData.ringBack.geometry = ringGeom.clone();

        b.userData.ringFront.position.y = newWidth / 2;
        b.userData.ringBack.position.y = -newWidth / 2;
        b.userData.ringFront.rotation.x = Math.PI / 2;
        b.userData.ringBack.rotation.x = Math.PI / 2;
    }

        roll.width = newWidth; // Update roll width
        roll.diameter = rollDiameterM; // Update roll diameter

        // Update Y position based on orientation
        if (isStanding) {
            roll.mesh.rotation.x = 0;
            roll.bobbin.rotation.x = 0;
            roll.mesh.position.y = newWidth / 2; // Roll width as height when standing
            roll.bobbin.position.y = newWidth / 2; // Same as roll
        } else {
            roll.mesh.rotation.x = Math.PI / 2;
            roll.bobbin.rotation.x = Math.PI / 2;
            roll.mesh.position.y = rollDiameterM / 2; // Roll diameter as height when lying down
            roll.bobbin.position.y = rollDiameterM / 2; // Same as roll
        }
    });

    centerRolls(); // Recenter all rolls after updates
}


function addRoll() {
    // Get current roll properties and orientation
    const rollWidth = parseFloat(document.getElementById('rollWidth').value) / 1000; // Convert mm to meters
    const sliceCount = parseInt(document.getElementById('sliceCount').innerText); // Number of slices
    const bobbinThickness = parseFloat(document.getElementById('bobbinThickness')?.value || '6') / 1000;
    const bobbinInnerDiameter = parseFloat(document.getElementById('bobbinInnerDiameter')?.value || '76.5') / 1000;
    const bobbinOuterDiameter = bobbinInnerDiameter + 2 * bobbinThickness; // Calculate outer diameter
    const rollOrientation = document.getElementById('rollOrientation').value;
    const isStanding = rollOrientation === 'standing';

    // Calculate roll diameter and effective width based on orientation
    const rollDiameterVal = (typeof rollDiameter === 'number' && rollDiameter > 0) ? rollDiameter : 0;
    if (rollDiameterVal <= 0) {
        calculate(); // säkerställ att vi får ny diameter
    }
    const rollDiameterM = (typeof rollDiameter === 'number' && rollDiameter > 0) ? rollDiameter : rollDiameterVal;
    const effectiveWidth = rollWidth / sliceCount; // Adjusted width based on slices

    // Pallet dimensions (in meters)
    const palletLength = PALLET_LENGTH;
    const palletWidth  = PALLET_WIDTH;

    // Pallet rotation (we rotate the pallet mesh for 'Lång', so rotate positions too)
    const palletOrientation = document.getElementById('palletOrientation')?.value || 'short';
    const palletRotY = (palletOrientation === 'long') ? (Math.PI / 2) : 0;

    function rotateXZ(x, z, rotY) {
      if (!rotY) return { x, z };
      const c = Math.cos(rotY);
      const s = Math.sin(rotY);
      return {
        x: x * c - z * s,
        z: x * s + z * c,
      };
    }

    // footprintX = längdriktningen, footprintZ = breddriktningen (i layout-planet)
    const footprintX = rollDiameterM; // alltid diameter i layout X
    const footprintZ = isStanding ? rollDiameterM : effectiveWidth; // stående: diameter, liggande: bredd

    const virtualLength = palletLength + 2 * OVERHANG_TOL;
    const virtualWidth  = palletWidth  + 2 * OVERHANG_TOL;

    // standard grid capacity
    let rollsPerRow = Math.max(1, Math.floor(virtualLength / footprintX));
    let rollsPerColumn = Math.max(1, Math.floor(virtualWidth / footprintZ));

    // ✅ Regel: om bredden (per slice) är > 450mm → packa bara en rad i bredd (ingen “bredvid”)
    if (!isStanding && effectiveWidth > WIDTH_SINGLE_ROW_THRESHOLD) {
        rollsPerColumn = 1;
    }

    // Determine current row and column based on existing rolls
    const currentRollCount = rolls.length;
    const currentRow = Math.floor(currentRollCount / rollsPerRow);
    const currentColumn = currentRollCount % rollsPerRow;

    // Check if adding the roll will overflow the pallet dimensions
    // if (isStanding && currentRow >= rollsPerColumn) {
    //     alert("Not recommended: Adding more rolls will extend beyond the pallet!");
    //     return; // Stop adding rolls
    // }

    const createRollCylinder = (diameter, width, color, opacity = 0.85) => {
        const geom = new THREE.CylinderGeometry(diameter / 2, diameter / 2, width, 96);
        const mat = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,   // ✅ important: don’t block what’s inside
            depthTest: true,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.renderOrder = 2;  // ✅ render after bobbin
        return mesh;
    };

    const createBobbinTube = (innerDiameter, thickness, width, color) => {
        const outerDiameter = innerDiameter + 2 * thickness;
        const group = new THREE.Group();

        // Outer wall (open ended)
        const outerGeom = new THREE.CylinderGeometry(outerDiameter / 2, outerDiameter / 2, width, 96, 1, true);
        const outerMat = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.60,
            side: THREE.DoubleSide,
            depthWrite: true,
        });
        const outerMesh = new THREE.Mesh(outerGeom, outerMat);

        // Inner wall (faces inward)
        const innerGeom = new THREE.CylinderGeometry(innerDiameter / 2, innerDiameter / 2, width, 96, 1, true);
        const innerMat = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.30,
            side: THREE.BackSide,
            depthWrite: true,
        });
        const innerMesh = new THREE.Mesh(innerGeom, innerMat);

        // End rings so the tube edge is always visible
        const ringGeom = new THREE.TorusGeometry(outerDiameter / 2, Math.max(thickness * 0.20, 0.002), 12, 64);
        const ringMat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85 });

        const ringFront = new THREE.Mesh(ringGeom, ringMat);
        const ringBack = new THREE.Mesh(ringGeom, ringMat);

        ringFront.rotation.x = Math.PI / 2;
        ringBack.rotation.x = Math.PI / 2;
        ringFront.position.y = width / 2;
        ringBack.position.y = -width / 2;

        // Render priority (so it doesn’t vanish inside the roll)
        // outerMesh.renderOrder = 3;
        // innerMesh.renderOrder = 3;
        // ringFront.renderOrder = 4;
        // ringBack.renderOrder = 4;

        group.add(outerMesh, innerMesh, ringFront, ringBack);

        // Save references so updateRoll() can resize it later
        group.userData = { outerMesh, innerMesh, ringFront, ringBack };

        

        return group;
    };

    const roll = createRollCylinder(rollDiameter, effectiveWidth, 0xF9FEDB, 0.85);
    const bobbin = createBobbinTube(bobbinInnerDiameter, bobbinThickness, effectiveWidth, 0xAE6C07);

    // Set rotation based on current orientation
    roll.rotation.x = isStanding ? 0 : Math.PI / 2;
    bobbin.rotation.x = isStanding ? 0 : Math.PI / 2;

    // Correctly position the new roll above the pallet surface based on its orientation
    roll.position.y = isStanding ? effectiveWidth / 2 : rollDiameterM / 2;
    bobbin.position.y = isStanding ? effectiveWidth / 2 : rollDiameterM / 2;

    // Stop if out of pallet bounds (both orientations)
    if (currentRow >= rollsPerColumn) {
      showInlineWarning(" OBS: Inte rekommenderat – rullarna hamnar utanför pallen.");
    }

    // räkna unrotated position (short-orientation plane)
    let xOffset = -palletLength / 2 + footprintX / 2 + currentColumn * footprintX;
    let zOffset = -palletWidth  / 2 + footprintZ / 2 + currentRow    * footprintZ;

    const exceedsVirtual =
        (Math.abs(xOffset) + footprintX / 2) > (palletLength / 2 + OVERHANG_TOL) ||
        (Math.abs(zOffset) + footprintZ / 2) > (palletWidth  / 2 + OVERHANG_TOL);

    if (exceedsVirtual) {
        showInlineWarning(" OBS: Inte rekommenderat – rullarna hamnar utanför pallen.");
    }

    // ✅ rotera placeringen om pallen är Lång
    const theta = getPalletRotationY();
    const p = rotateXZ(xOffset, zOffset, theta);

    roll.position.x = p.x;
    roll.position.z = p.z;
    bobbin.position.x = p.x;
    bobbin.position.z = p.z;

    // Add the roll and bobbin to the scene and the rolls array
    scene.add(bobbin);
    scene.add(roll);        
    rolls.push({ mesh: roll, bobbin: bobbin, width: effectiveWidth, diameter: rollDiameter });

    // Update roll count without recalculating all rolls
    //document.getElementById('rollCount').innerText = rolls.length;

    // Recalculate positions to adjust for the new roll
    console.log("HERE-2", rolls.length);
    updateRollCount(1);
    centerRolls();
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
    console.log("change", change)
    console.log("rollCount", rollCount)
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

function updateRollOrientation() {
    const rollOrientation = document.getElementById('rollOrientation').value;

    rolls.forEach(roll => {
        if (rollOrientation === 'standing') {
            roll.mesh.rotation.x = 0; // Make the roll stand upright
            roll.bobbin.rotation.x = 0; // Align the bobbin to be standing
            roll.mesh.position.y = roll.width / 2; 
            roll.bobbin.position.y = roll.width / 2; 
        } else {
            roll.mesh.rotation.x = Math.PI / 2; // Make the roll lie down
            roll.bobbin.rotation.x = Math.PI / 2; // Align the bobbin to be lying down
            roll.mesh.position.y = roll.diameter / 2;
            roll.bobbin.position.y = roll.diameter / 2;
        }
    });

    // Optionally recenter rolls after changing orientation
    centerRolls();
}



function centerRolls() {
  if (rolls.length === 0) return;

  const rollOrientation = document.getElementById('rollOrientation')?.value || 'lying';
  const isStanding = rollOrientation === 'standing';

  const sliceCount = parseInt(document.getElementById('sliceCount')?.innerText || '1', 10) || 1;

  // Prefer global rollDiameter (meters). Fallback to UI text (mm -> m)
  const rollDiameterM =
    (typeof rollDiameter === 'number' && rollDiameter > 0)
      ? rollDiameter
      : (parseFloat((document.getElementById('rollDiameter')?.textContent || '0').replace(/[^0-9.]/g, '')) || 0) / 1000;

  const rollWidthM = (parseFloat(document.getElementById('rollWidth')?.value || '0') || 0) / 1000;
  const effectiveWidthM = rollWidthM / Math.max(1, sliceCount); // width per slice

  const palletLength = PALLET_LENGTH;
  const palletWidth  = PALLET_WIDTH;

  // Virtual pallet for small overhang (3–5 cm)
  const virtualLength = palletLength + 2 * OVERHANG_TOL;
  const virtualWidth  = palletWidth  + 2 * OVERHANG_TOL;

  // Footprint: X always diameter. Z depends on orientation.
  const footprintX = rollDiameterM;
  const footprintZ = isStanding ? rollDiameterM : effectiveWidthM;
  if (!footprintX || !footprintZ) return;

  // How many fit along pallet length
  let rollsPerRow = Math.max(1, Math.floor(virtualLength / footprintX));

  // ✅ 450mm rule: if lying and width per slice > 450mm => ONE row only (no “bredvid”)
  const forceSingleRow = (!isStanding && effectiveWidthM > WIDTH_SINGLE_ROW_THRESHOLD);

  let rowsNeeded = forceSingleRow ? 1 : Math.ceil(rolls.length / rollsPerRow);

  // If forcing single row, lay everything in a line along X
  if (forceSingleRow) {
    rollsPerRow = rolls.length;
  }

  const colsUsed = Math.min(rolls.length, rollsPerRow);

  const usedLenX = colsUsed * footprintX;
  const usedLenZ = rowsNeeded * footprintZ;

  // Start positions in VIRTUAL space
  const xStart = -virtualLength / 2 + (virtualLength - usedLenX) / 2 + footprintX / 2;
  const zStart = -virtualWidth  / 2 + (virtualWidth  - usedLenZ) / 2 + footprintZ / 2;

  // Rotate positions if pallet is Lång
  const theta = getPalletRotationY();

  // Non-blocking warning if we exceed real pallet (without tolerance)
const exceedsVirtualX = (usedLenX / 2) > (palletLength / 2 + OVERHANG_TOL);
const exceedsVirtualZ = (usedLenZ / 2) > (palletWidth  / 2 + OVERHANG_TOL);
if (exceedsVirtualX || exceedsVirtualZ) {
    showInlineWarning(" OBS: Inte rekommenderat – rullarna hamnar utanför pallen.");
}

  rolls.forEach((roll, i) => {
    const r = forceSingleRow ? 0 : Math.floor(i / rollsPerRow);
    const c = forceSingleRow ? i : (i % rollsPerRow);

    const xLocal = xStart + c * footprintX;
    const zLocal = zStart + r * footprintZ;

    const rotated = rotateXZ(xLocal, zLocal, theta);

    roll.mesh.position.x = rotated.x;
    roll.mesh.position.z = rotated.z;
    roll.bobbin.position.x = rotated.x;
    roll.bobbin.position.z = rotated.z;
  });
}


function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function showPalletWarning() {
  // Keep name for compatibility, but show inline warning instead of modal.
  showInlineWarning(" OBS: Inte rekommenderat – rullarna hamnar utanför pallen.");
}

init();

// =========================
// PRINT: snapshot WebGL -> image (so PDF export shows the 3D view)
// =========================
function ensurePrintSnapshot() {
  try {
    const container = document.getElementById('three-container');
    if (!container || !renderer || !renderer.domElement) return;

    // Create (or reuse) snapshot img
    let img = document.getElementById('threePrintImage');
    if (!img) {
      img = document.createElement('img');
      img.id = 'threePrintImage';
      img.alt = '3D vy (export)';
      img.setAttribute('aria-hidden', 'true');
      container.appendChild(img);
    }

    // Ensure we capture the latest frame
    renderer.render(scene, camera);
    // Snapshot
    img.src = renderer.domElement.toDataURL('image/png');
  } catch (e) {
    // no-op
  }
}

function cleanupPrintSnapshot() {
  const img = document.getElementById('threePrintImage');
  if (img && img.parentNode) img.parentNode.removeChild(img);
}

// Export helper: force snapshot first so the 3D view is visible in the PDF
function exportPDF() {
  ensurePrintSnapshot();
  // Small delay so Chrome print preview picks up the image
  setTimeout(() => window.print(), 60);
}

window.addEventListener('beforeprint', () => {
  ensurePrintSnapshot();
});

window.addEventListener('afterprint', () => {
  cleanupPrintSnapshot();
});

document.querySelectorAll('.num-wrap').forEach(wrap => {
    const input = wrap.querySelector('input');
    const up = wrap.querySelector('.num-up');
    const down = wrap.querySelector('.num-down');

    const step = parseFloat(input.step) || 1;

    up.addEventListener('click', () => {
        input.value = (parseFloat(input.value) || 0) + step;
        input.dispatchEvent(new Event('change'));
    });

    down.addEventListener('click', () => {
        input.value = (parseFloat(input.value) || 0) - step;
        input.dispatchEvent(new Event('change'));
    });
});

let warningTimer = null;

function showInlineWarning(msg) {
  const el = document.getElementById('palletWarningInline');
  if (!el) return;

  el.textContent = msg;
  el.classList.add('is-visible');

  clearTimeout(warningTimer);
  warningTimer = setTimeout(() => {
    el.classList.remove('is-visible');
  }, 3500);
}

let rollChangeTimer = null;

function pulseValue(el, text) {
  if (!el) return;
  const next = String(text);
  if (el.textContent === next) return;

  el.textContent = next;

  // restart animation
  el.classList.remove('value-pulse');
  void el.offsetWidth;
  el.classList.add('value-pulse');
}

function showRollChange(msg) {
  const el = document.getElementById('rollChangeTime');
  if (!el) return;

  el.textContent = msg;
  el.classList.add('is-visible');

  // pulse when it changes
  el.classList.remove('value-pulse');
  void el.offsetWidth;
  el.classList.add('value-pulse');

  clearTimeout(rollChangeTimer);
  // (Vi låter den vara kvar – ingen auto-hide)
  rollChangeTimer = setTimeout(() => {}, 1);
}