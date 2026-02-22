(() => {
  const PALLET_LENGTH = 1.2;
  const PALLET_WIDTH = 0.8;
  const OVERHANG_TOL = 0.2;
  const WIDTH_SINGLE_ROW_THRESHOLD = 0.45;
  const PALLET_WEIGHT_G = 25000;
  const MAX_RECOMMENDED_DIAMETER_MM = 700;
  const PALLET_WARNING_TEXT = " OBS: Inte rekommenderat – rullarna hamnar utanför pallen.";

  const BOBBIN_WEIGHTS = {
    "76.5": { "6": 1100, "10": 1900, "12": 2400, "15": 3000 },
    "135.5": { "6": 3000, "10": 3500, "12": 4000, "15": 5000 },
  };

  const state = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    pallet: null,
    rolls: [],
    rollDiameterM: 0,
    rollWeightG: 0,
    totalWeightG: 0,
    totalWeightOnPalletG: PALLET_WEIGHT_G,
    gramWeightGm2: 0,
    minutesPerRoll: 0,
    warningTimer: null,
    rollChangeTimer: null,
    resizeObserver: null,
  };

  const dom = {};

  const byId = (id) => document.getElementById(id);
  const toNumber = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const readInputNumber = (id, fallback = 0) => toNumber(dom[id]?.value, fallback);
  const readCounter = (id, fallback = 0) => parseInt(dom[id]?.textContent || `${fallback}`, 10) || fallback;

  function cacheDom() {
    [
      "filmType",
      "windingType",
      "bobbinInnerDiameter",
      "bobbinThickness",
      "rollWidth",
      "rollFold",
      "plasticThickness",
      "plasticLength",
      "densitet",
      "output",
      "sliceCount",
      "rollCount",
      "palletOrientation",
      "rollOrientation",
      "gramWeight",
      "rollWeight",
      "totalWeight",
      "totalWeightonPallet",
      "rollDiameter",
      "rollFoldGroup",
      "rollFoldCollapse",
      "three-container",
      "three-container-wrapper",
      "palletWarningInline",
      "rollChangeTime",
      "resetBtn",
      "exportBtn",
      "addSlice",
      "removeSlice",
      "addRoll",
      "removeRoll",
    ].forEach((id) => {
      dom[id] = byId(id);
    });
}

function bindEvents() {
    const calculableIds = [
      "windingType",
      "bobbinInnerDiameter",
      "bobbinThickness",
      "rollWidth",
      "rollFold",
      "plasticThickness",
      "plasticLength",
      "densitet",
      "output",
    ];

    calculableIds.forEach((id) => {
      dom[id]?.addEventListener("change", calculate);
    });

    dom.filmType?.addEventListener("change", () => {
      updateRollFoldVisibility();
      calculate();
    });

    dom.palletOrientation?.addEventListener("change", () => {
      updatePallet();
      centerRolls();
    });

    dom.bobbinInnerDiameter?.addEventListener("change", () => {
        updateBobbinThicknessAvailability();
        calculate();
    });

    dom.rollOrientation?.addEventListener("change", updateRollOrientation);

    dom.addSlice?.addEventListener("click", addSlice);
    dom.removeSlice?.addEventListener("click", removeSlice);
    dom.addRoll?.addEventListener("click", () => addRoll(true));
    dom.removeRoll?.addEventListener("click", removeRoll);

    dom.resetBtn?.addEventListener("click", () => window.location.reload());
    dom.exportBtn?.addEventListener("click", exportPDF);

    window.addEventListener("beforeprint", ensurePrintSnapshot);
    window.addEventListener("afterprint", cleanupPrintSnapshot);
}

function getPalletFrame() {
    const orientation = dom.palletOrientation?.value || "short";
    const isLong = orientation === "long";

    // När pallen roteras 90° ska layout-ramen byta plats (längd/bredd).
    return {
        theta: 0,
        length: isLong ? PALLET_WIDTH : PALLET_LENGTH,
        width: isLong ? PALLET_LENGTH : PALLET_WIDTH,
        isLong,
    };
}

function rotateXZ(x, z, theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return {
      x: x * c - z * s,
      z: x * s + z * c,
    };
}

function initThree() {
    if (!dom["three-container"]) return;

    state.scene = new THREE.Scene();

    const width = dom["three-container"].clientWidth || 537.2;
    const height = dom["three-container"].clientHeight || 500;

    state.camera = new THREE.PerspectiveCamera(100, width / height, 0.01, 1000);
    state.camera.position.set(0.9, 0.7, 1.6);
    state.camera.lookAt(0, 0, 0);

    state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    state.renderer.setSize(width, height, false);
    state.renderer.setClearColor(0x000000, 0);
    state.renderer.outputEncoding = THREE.sRGBEncoding;

    dom["three-container"].innerHTML = "";
    dom["three-container"].appendChild(state.renderer.domElement);

    const keyLight = new THREE.PointLight(0xffffff, 1);
    keyLight.position.set(0, 99, 99);

    state.scene.add(keyLight);
    state.scene.add(new THREE.AmbientLight(0x404040));

    state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);

    updatePallet();
    resizeThree();

    window.addEventListener("resize", resizeThree);

    if (window.ResizeObserver && dom["three-container"]) {
      state.resizeObserver = new ResizeObserver(resizeThree);
      state.resizeObserver.observe(dom["three-container"]);
    }

    animate();
}

function resizeThree() {
    if (!state.renderer || !state.camera || !dom["three-container"]) return;

    const width = dom["three-container"].clientWidth;
    const height = dom["three-container"].clientHeight;
    if (!width || !height) return;

    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    state.renderer.setSize(width, height, false);

    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);
    if (!state.renderer || !state.scene || !state.camera) return;
    state.renderer.render(state.scene, state.camera);
}

function updatePallet() {
    if (!state.scene) return;

    if (state.pallet) {
      state.scene.remove(state.pallet);
    }

    const textureLoader = new THREE.TextureLoader();
    const woodTexture = textureLoader.load("styles/images/wood.jpeg");
    woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(3, 3);

    const palletMaterial = new THREE.MeshPhongMaterial({
      map: woodTexture,
      bumpMap: woodTexture,
      bumpScale: 0.05,
      specular: new THREE.Color("grey"),
      shininess: 50,
    });

    const { length: palletLength, width: palletWidth } = getPalletFrame();
    const group = new THREE.Group();
    const boardDepth = (palletWidth - (5 - 1) * 0.06) / 5;

    for (let i = 0; i < 5; i += 1) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(palletLength, 0.02, boardDepth), palletMaterial);
      board.position.set(0, -0.01, -palletWidth / 2 + 0.06 * i + (palletWidth - 0.24) / 5 * (i + 0.5));
      group.add(board);
    }

    [-palletLength / 2.2, -palletLength / 65, palletLength / 2 - 0.05].forEach((posX) => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, palletWidth), palletMaterial);
      block.position.set(posX, -0.07, 0);
      group.add(block);
    });

    group.rotation.y = 0;

    state.scene.add(group);
    state.pallet = group;
}

function updateBobbinThicknessAvailability() {
  if (!dom.bobbinInnerDiameter || !dom.bobbinThickness) return;

  const isLargeBobbin = dom.bobbinInnerDiameter.value === "135.5";

  // gå igenom alla tjockleksalternativ
  Array.from(dom.bobbinThickness.options).forEach((option) => {

    if (isLargeBobbin) {
      // bara 15 mm tillåten
      option.disabled = option.value !== "15";
    } else {
      // alla tillåtna för 76.5
      option.disabled = false;
    }

  });

  // om stor bobin → tvinga 15 mm
  if (isLargeBobbin) {
    dom.bobbinThickness.value = "15";
  }
}

function updateRollFoldVisibility() {
    const isFoldFilm = `${dom.filmType?.value || "2"}` === "4";

    const collapse = dom.rollFoldCollapse && window.bootstrap
      ? new bootstrap.Collapse(dom.rollFoldCollapse, { toggle: false })
      : null;

    if (isFoldFilm) {
      if (collapse) {
        dom.rollFoldCollapse.style.display = "";
        collapse.show();
      } else if (dom.rollFoldCollapse) {
        dom.rollFoldCollapse.classList.add("show");
      }
      return;
    }

    if (collapse) {
      dom.rollFoldCollapse.style.display = "";
      collapse.hide();
    } else if (dom.rollFoldCollapse) {
      dom.rollFoldCollapse.classList.remove("show");
    }

    if (dom.rollFold) {
      dom.rollFold.value = "0";
    }
  }

  function calculate() {
    const rollWidthMm = readInputNumber("rollWidth", 0);
    const rollFoldMm = readInputNumber("rollFold", 0);
    const lengthM = readInputNumber("plasticLength", 0);
    const thicknessMm = readInputNumber("plasticThickness", 1);
    const windingTypeFactor = readInputNumber("windingType", 1);
    const filmTypeValue = readInputNumber("filmType", 2);

    const filmPliesForWeight = filmTypeValue === 4 ? 2 : filmTypeValue;
    const pliesForWeight = Math.max(filmPliesForWeight, windingTypeFactor);
    const pliesForDiameter = filmTypeValue === 4 ? 4 : filmTypeValue;


    // const filmTypeFactor = filmTypeValue === 4 ? 1 : filmTypeValue;
    // const pliesForDiameter = filmTypeValue === 4 ? 4 : filmTypeValue;
    const density = readInputNumber("densitet", 1);
    const bobbinInnerDiameterMm = readInputNumber("bobbinInnerDiameter", 76.5);
    const bobbinThicknessMm = readInputNumber("bobbinThickness", 6);
    const outputKgPerHour = readInputNumber("output", 0);
    const sliceQuantity = Math.max(1, readCounter("sliceCount", 1));

    // Keep original behavior: roll quantity defaults to 1 if counter is 0/empty.
    let rollQuantity = readCounter("rollCount", 1) || 1;

    const bobbinWeightPerRollG =
      ((BOBBIN_WEIGHTS[`${bobbinInnerDiameterMm}`] || {})[`${bobbinThicknessMm}`] || 0) * (rollWidthMm / 1000);

    if (lengthM > 0) {
        state.rollWeightG =
        ((((rollWidthMm + rollFoldMm) * pliesForWeight) * thicknessMm * density * lengthM * 0.001) / sliceQuantity) * 1000;

        state.gramWeightGm2 =
        ((((rollWidthMm + rollFoldMm) * pliesForWeight) * thicknessMm * density * 0.001) / sliceQuantity) * 1000;

      const bobbinTotalDiameterMm = bobbinInnerDiameterMm + bobbinThicknessMm * 2;
      state.rollDiameterM =
        (Math.sqrt((thicknessMm * lengthM * pliesForDiameter * 1000) / Math.PI + Math.pow(bobbinTotalDiameterMm / 2, 2)) * 2) /
        1000;

      if (state.rolls.length === 0) {
        addRoll(false);
        rollQuantity = 1;
      } else {
        updateRollGeometry();
        rollQuantity = readCounter("rollCount", 1) || 1;
      }

      state.totalWeightG = state.rollWeightG + bobbinWeightPerRollG;
      state.totalWeightOnPalletG = state.totalWeightG * rollQuantity + PALLET_WEIGHT_G;

      const rollWeightKg = state.rollWeightG / 1000;
      state.minutesPerRoll = rollWeightKg > 0 && outputKgPerHour > 0 ? (rollWeightKg / outputKgPerHour) * 60 : 0;
    } else {
      state.rollWeightG = 0;
      state.totalWeightG = 0;
      state.totalWeightOnPalletG = PALLET_WEIGHT_G;
      state.gramWeightGm2 = 0;
      state.rollDiameterM = 0;
      state.minutesPerRoll = 0;
      clearAllRolls();
    }

    renderResults();
    updateDiameterWarning();
    updateRollChangeNotice();
  }

  function renderResults() {
    pulseValue(dom.rollWeight, `${(state.rollWeightG / 1000).toFixed(1)} kg`);
    pulseValue(dom.totalWeight, `${(state.totalWeightG / 1000).toFixed(1)} kg`);
    pulseValue(dom.totalWeightonPallet, `${(state.totalWeightOnPalletG / 1000).toFixed(1)} kg`);
    pulseValue(dom.gramWeight, `${state.gramWeightGm2.toFixed(1)} g`);
    pulseValue(dom.rollDiameter, `${(state.rollDiameterM * 1000).toFixed(1)} mm`);
  }

  function updateDiameterWarning() {
    if (!dom.rollDiameter) return;

    const diameterMm = state.rollDiameterM * 1000;
    if (diameterMm > MAX_RECOMMENDED_DIAMETER_MM + 0.1) {
      dom.rollDiameter.classList.add("over-limit");
      showInlineWarning(" Rulldiameter över 700 mm – ej rekommenderat.");
    } else {
      dom.rollDiameter.classList.remove("over-limit");
    }
  }

  function updateRollChangeNotice() {
    if (!dom.rollChangeTime) return;

    if (state.minutesPerRoll > 0) {
      showRollChange(` Rullbytet tar ungefär ${state.minutesPerRoll.toFixed(1)} minuter`);
      return;
    }

    dom.rollChangeTime.classList.remove("is-visible");
  }

  function createRollMesh(diameter, width, color, opacity = 0.85) {
    const geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, width, 96);
    const material = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    return mesh;
  }

  function createBobbinTube(innerDiameter, thickness, width, color) {
    const outerDiameter = innerDiameter + 2 * thickness;
    const group = new THREE.Group();

    const outerMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(outerDiameter / 2, outerDiameter / 2, width, 96, 1, true),
      new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: true,
      })
    );

    const innerMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(innerDiameter / 2, innerDiameter / 2, width, 96, 1, true),
      new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
        depthWrite: true,
      })
    );

    const ringGeometry = new THREE.TorusGeometry(outerDiameter / 2, Math.max(thickness * 0.2, 0.002), 12, 64);
    const ringMaterial = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85 });

    const ringFront = new THREE.Mesh(ringGeometry, ringMaterial);
    const ringBack = new THREE.Mesh(ringGeometry.clone(), ringMaterial);

    ringFront.rotation.x = Math.PI / 2;
    ringBack.rotation.x = Math.PI / 2;
    ringFront.position.y = width / 2;
    ringBack.position.y = -width / 2;

    group.add(outerMesh, innerMesh, ringFront, ringBack);
    group.userData = { outerMesh, innerMesh, ringFront, ringBack };

    return group;
  }

  function updateRollGeometry() {
    const rollWidthM = readInputNumber("rollWidth", 0) / 1000;
    const sliceCount = Math.max(1, readCounter("sliceCount", 1));
    const bobbinThicknessM = readInputNumber("bobbinThickness", 6) / 1000;
    const bobbinInnerDiameterM = readInputNumber("bobbinInnerDiameter", 76.5) / 1000;
    const isStanding = (dom.rollOrientation?.value || "lying") === "standing";

    const newRollWidthM = rollWidthM / sliceCount;
    const rollDiameterM = Math.max(0, state.rollDiameterM);

    state.rolls.forEach((roll) => {
      roll.mesh.geometry.dispose();
      roll.mesh.geometry = new THREE.CylinderGeometry(rollDiameterM / 2, rollDiameterM / 2, newRollWidthM, 32);

      const bobbin = roll.bobbin;
      if (bobbin?.userData?.outerMesh) {
        const outerDiameter = bobbinInnerDiameterM + 2 * bobbinThicknessM;

        bobbin.userData.outerMesh.geometry.dispose();
        bobbin.userData.innerMesh.geometry.dispose();
        bobbin.userData.ringFront.geometry.dispose();
        bobbin.userData.ringBack.geometry.dispose();

        bobbin.userData.outerMesh.geometry = new THREE.CylinderGeometry(
          outerDiameter / 2,
          outerDiameter / 2,
          newRollWidthM,
          96,
          1,
          true
        );

        bobbin.userData.innerMesh.geometry = new THREE.CylinderGeometry(
          bobbinInnerDiameterM / 2,
          bobbinInnerDiameterM / 2,
          newRollWidthM,
          96,
          1,
          true
        );

        const ringGeometry = new THREE.TorusGeometry(
          outerDiameter / 2,
          Math.max(bobbinThicknessM * 0.2, 0.002),
          12,
          64
        );

        bobbin.userData.ringFront.geometry = ringGeometry;
        bobbin.userData.ringBack.geometry = ringGeometry.clone();

        bobbin.userData.ringFront.position.y = newRollWidthM / 2;
        bobbin.userData.ringBack.position.y = -newRollWidthM / 2;
        bobbin.userData.ringFront.rotation.x = Math.PI / 2;
        bobbin.userData.ringBack.rotation.x = Math.PI / 2;
      }

      roll.width = newRollWidthM;
      roll.diameter = rollDiameterM;

      if (isStanding) {
        roll.mesh.rotation.x = 0;
        roll.bobbin.rotation.x = 0;
        roll.mesh.position.y = newRollWidthM / 2;
        roll.bobbin.position.y = newRollWidthM / 2;
      } else {
        roll.mesh.rotation.x = Math.PI / 2;
        roll.bobbin.rotation.x = Math.PI / 2;
        roll.mesh.position.y = rollDiameterM / 2;
        roll.bobbin.position.y = rollDiameterM / 2;
      }
    });

    centerRolls();
  }

function addRoll(recalculate = true) {
    const rollWidthM = readInputNumber("rollWidth", 0) / 1000;
    const sliceCount = Math.max(1, readCounter("sliceCount", 1));

    if (state.rollDiameterM <= 0) {
      if (recalculate) {
        calculate();
      }
      if (state.rollDiameterM <= 0) {
        return;
      }
    }

    const bobbinThicknessM = readInputNumber("bobbinThickness", 6) / 1000;
    const bobbinInnerDiameterM = readInputNumber("bobbinInnerDiameter", 76.5) / 1000;
    const isStanding = (dom.rollOrientation?.value || "lying") === "standing";

    const effectiveWidthM = rollWidthM / sliceCount;
    const rollDiameterM = state.rollDiameterM;

    const footprintX = rollDiameterM;
    const footprintZ = isStanding ? rollDiameterM : effectiveWidthM;

    const { theta, length: palletLength, width: palletWidth } = getPalletFrame();

    const virtualLength = palletLength + 2 * OVERHANG_TOL;
    const virtualWidth = palletWidth + 2 * OVERHANG_TOL;

    const rollsPerRow = Math.max(1, Math.floor(virtualLength / footprintX));
    let rollsPerColumn = Math.max(1, Math.floor(virtualWidth / footprintZ));

    if (!isStanding && effectiveWidthM > WIDTH_SINGLE_ROW_THRESHOLD) {
      rollsPerColumn = 1;
    }

    const currentIndex = state.rolls.length;
    const currentRow = Math.floor(currentIndex / rollsPerRow);
    const currentColumn = currentIndex % rollsPerRow;

    if (currentRow >= rollsPerColumn) {
      showInlineWarning(PALLET_WARNING_TEXT);
    }

    const xOffset = -palletLength / 2 + footprintX / 2 + currentColumn * footprintX;
    const zOffset = -palletWidth / 2 + footprintZ / 2 + currentRow * footprintZ;

    const exceedsVirtual =
        Math.abs(xOffset) + footprintX / 2 > palletLength / 2 + OVERHANG_TOL ||
        Math.abs(zOffset) + footprintZ / 2 > palletWidth / 2 + OVERHANG_TOL;

    if (exceedsVirtual) {
      showInlineWarning(PALLET_WARNING_TEXT);
    }

    const rollMesh = createRollMesh(rollDiameterM, effectiveWidthM, 0xf9fedb, 0.85);
    const bobbin = createBobbinTube(bobbinInnerDiameterM, bobbinThicknessM, effectiveWidthM, 0xae6c07);

    rollMesh.rotation.x = isStanding ? 0 : Math.PI / 2;
    bobbin.rotation.x = isStanding ? 0 : Math.PI / 2;

    rollMesh.position.y = isStanding ? effectiveWidthM / 2 : rollDiameterM / 2;
    bobbin.position.y = isStanding ? effectiveWidthM / 2 : rollDiameterM / 2;

    const rotated = rotateXZ(xOffset, zOffset, theta);

    rollMesh.position.x = rotated.x;
    rollMesh.position.z = rotated.z;
    bobbin.position.x = rotated.x;
    bobbin.position.z = rotated.z;

    state.scene?.add(rollMesh);
    state.scene?.add(bobbin);

    state.rolls.push({
      mesh: rollMesh,
      bobbin,
      width: effectiveWidthM,
      diameter: rollDiameterM,
    });

    syncRollCount();
    centerRolls();

    if (recalculate) {
      calculate();
    }
}

function removeRoll() {
    if (state.rolls.length === 0) {
      return;
    }

    const removed = state.rolls.pop();
    state.scene?.remove(removed.mesh);
    state.scene?.remove(removed.bobbin);

    syncRollCount();
    centerRolls();

    if (state.rolls.length > 0) {
      calculate();
      return;
    }

    setResultsToZero();
  }

  function clearAllRolls() {
    state.rolls.forEach((roll) => {
      state.scene?.remove(roll.mesh);
      state.scene?.remove(roll.bobbin);
    });

    state.rolls = [];
    syncRollCount();
    setResultsToZero();
  }

  function syncRollCount() {
    if (dom.rollCount) {
      dom.rollCount.textContent = `${state.rolls.length}`;
    }
  }

  function setResultsToZero() {
    pulseValue(dom.rollWeight, `${(0).toFixed(1)} kg`);
    pulseValue(dom.totalWeight, `${(0).toFixed(1)} kg`);
    pulseValue(dom.totalWeightonPallet, `${(PALLET_WEIGHT_G / 1000).toFixed(1)} kg`);
    pulseValue(dom.gramWeight, `${(0).toFixed(1)} g`);
    pulseValue(dom.rollDiameter, `${(0).toFixed(1)} mm`);
  }

  function addSlice() {
    const nextValue = readCounter("sliceCount", 1) + 1;
    if (dom.sliceCount) {
      dom.sliceCount.textContent = `${nextValue}`;
    }
    calculate();
  }

  function removeSlice() {
    const current = readCounter("sliceCount", 1);
    if (current <= 1) {
      return;
    }

    if (dom.sliceCount) {
      dom.sliceCount.textContent = `${current - 1}`;
    }
    calculate();
}

function updateRollOrientation() {
    const isStanding = (dom.rollOrientation?.value || "lying") === "standing";

    state.rolls.forEach((roll) => {
      if (isStanding) {
        roll.mesh.rotation.x = 0;
        roll.bobbin.rotation.x = 0;
        roll.mesh.position.y = roll.width / 2;
        roll.bobbin.position.y = roll.width / 2;
      } else {
        roll.mesh.rotation.x = Math.PI / 2;
        roll.bobbin.rotation.x = Math.PI / 2;
        roll.mesh.position.y = roll.diameter / 2;
        roll.bobbin.position.y = roll.diameter / 2;
      }
    });

    centerRolls();
}

function centerRolls() {
    if (state.rolls.length === 0) {
      return;
    }

    const isStanding = (dom.rollOrientation?.value || "lying") === "standing";
    const sliceCount = Math.max(1, readCounter("sliceCount", 1));
    const rollWidthM = readInputNumber("rollWidth", 0) / 1000;

    const rollDiameterM = state.rollDiameterM;
    const effectiveWidthM = rollWidthM / sliceCount;

    const footprintX = rollDiameterM;
    const footprintZ = isStanding ? rollDiameterM : effectiveWidthM;
    if (footprintX <= 0 || footprintZ <= 0) {
        return;
    }

    const { theta, length: palletLength, width: palletWidth } = getPalletFrame();

    const virtualLength = palletLength + 2 * OVERHANG_TOL;
    const virtualWidth = palletWidth + 2 * OVERHANG_TOL;

    let rollsPerRow = Math.max(1, Math.floor(virtualLength / footprintX));
    const forceSingleRow = !isStanding && effectiveWidthM > WIDTH_SINGLE_ROW_THRESHOLD;

    if (forceSingleRow) {
      rollsPerRow = state.rolls.length;
    }

    const rowsNeeded = forceSingleRow ? 1 : Math.ceil(state.rolls.length / rollsPerRow);
    const columnsUsed = Math.min(state.rolls.length, rollsPerRow);

    const usedLengthX = columnsUsed * footprintX;
    const usedLengthZ = rowsNeeded * footprintZ;

    const startX = -virtualLength / 2 + (virtualLength - usedLengthX) / 2 + footprintX / 2;
    const startZ = -virtualWidth / 2 + (virtualWidth - usedLengthZ) / 2 + footprintZ / 2;

    if (usedLengthX / 2 > palletLength / 2 + OVERHANG_TOL || usedLengthZ / 2 > palletWidth / 2 + OVERHANG_TOL) {
        showInlineWarning(PALLET_WARNING_TEXT);
    }

    // const theta = getPalletRotationY();

    state.rolls.forEach((roll, index) => {
      const row = forceSingleRow ? 0 : Math.floor(index / rollsPerRow);
      const col = forceSingleRow ? index : index % rollsPerRow;

      const localX = startX + col * footprintX;
      const localZ = startZ + row * footprintZ;
      const rotated = rotateXZ(localX, localZ, theta);

      roll.mesh.position.x = rotated.x;
      roll.mesh.position.z = rotated.z;
      roll.bobbin.position.x = rotated.x;
      roll.bobbin.position.z = rotated.z;
    });
}

  function showInlineWarning(message) {
    if (!dom.palletWarningInline) return;

    dom.palletWarningInline.textContent = message;
    dom.palletWarningInline.classList.add("is-visible");

    clearTimeout(state.warningTimer);
    state.warningTimer = setTimeout(() => {
      dom.palletWarningInline?.classList.remove("is-visible");
    }, 3500);
  }

  function pulseValue(element, text) {
    if (!element) return;

    if (element.textContent === text) return;

    element.textContent = text;
    element.classList.remove("value-pulse");
    void element.offsetWidth;
    element.classList.add("value-pulse");
  }

  function showRollChange(message) {
    if (!dom.rollChangeTime) return;

    dom.rollChangeTime.textContent = message;
    dom.rollChangeTime.classList.add("is-visible");

    dom.rollChangeTime.classList.remove("value-pulse");
    void dom.rollChangeTime.offsetWidth;
    dom.rollChangeTime.classList.add("value-pulse");

    clearTimeout(state.rollChangeTimer);
    state.rollChangeTimer = setTimeout(() => {}, 1);
  }

  function ensurePrintSnapshot() {
    try {
      if (!state.renderer || !state.scene || !state.camera || !dom["three-container"]) return;

      let image = byId("threePrintImage");
      if (!image) {
        image = document.createElement("img");
        image.id = "threePrintImage";
        image.alt = "3D vy (export)";
        image.setAttribute("aria-hidden", "true");
        dom["three-container"].appendChild(image);
      }

      state.renderer.render(state.scene, state.camera);
      image.src = state.renderer.domElement.toDataURL("image/png");
    } catch (error) {
      // no-op
    }
  }

  function cleanupPrintSnapshot() {
    const image = byId("threePrintImage");
    if (image?.parentNode) {
      image.parentNode.removeChild(image);
    }
  }

  function exportPDF() {
    ensurePrintSnapshot();
    setTimeout(() => window.print(), 60);
  }

  window.exportPDF = exportPDF;

  function init() {
    cacheDom();
    bindEvents();
    initThree();
    updateBobbinThicknessAvailability();
    updateRollFoldVisibility();
    calculate();
  }

  init();
})();
