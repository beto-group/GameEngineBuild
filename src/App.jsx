const activeFile = dc.resolvePath("GAME ENGINE BUILD") || "_RESOURCES/DATACORE/_DONE/GAME ENGINE BUILD/GAME ENGINE BUILD";
const outerFolderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));

function WorldView({ webgl, input, game, folderPath }) {
  const {
    initWebGL,
    lookAtVec,
    makeProjectionMatrix,
    translationMatrix,
    rotationYMatrix,
    scaleMatrix,
    multiply4x4,
    computeFinalModel,
    multiplyMatVec,
    computeScreenPosition,
    requireMediaFile,
    findNearestAncestorWithClass,
    findDirectChildByClass
  } = webgl;

  const {
    registerKeyListeners,
    registerPointerLockListeners,
    registerMouseMoveListener,
    registerTouchAndWheelListeners
  } = input;

  const {
    spawnObject,
    isLottieMedia,
    updateLottieTexture,
    updateViewTexture
  } = game;

  const canvasRef = dc.useRef(null);
  const overlayPaneIndex = dc.useRef(null);
  const containerRef = dc.useRef(null);
  const stateRefs = dc.useRef({}).current;

  // --- State for full-tab mode ---
  const [isFullTab, setIsFullTab] = dc.useState(true);
  const instanceId = dc.useRef(Math.random().toString(36).substr(2, 5)).current;
  const uniqueWrapperClass = `game-engine-wrapper-${instanceId}`;

  // --- State for game & menus ---
  const [gameStarted, setGameStarted] = dc.useState(false);
  const gameStartedRef = dc.useRef(false);
  dc.useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);

  const [isAddMenuVisible, setIsAddMenuVisible] = dc.useState(false);
  const addMenuVisibleRef = dc.useRef(isAddMenuVisible);
  dc.useEffect(() => { addMenuVisibleRef.current = isAddMenuVisible; }, [isAddMenuVisible]);

  const [isPaused, setIsPaused] = dc.useState(false);
  const pausedRef = dc.useRef(false);

  const [showInstructions, setShowInstructions] = dc.useState(false);
  const [showKeyHelper, setShowKeyHelper] = dc.useState(false);
  
  // --- Experimental Features ---
  const [timeOfDay, setTimeOfDay] = dc.useState(0); // 0-1 for day/night cycle
  const [enableTrails, setEnableTrails] = dc.useState(false);
  const [enableWireframe, setEnableWireframe] = dc.useState(false);
  const [showStats, setShowStats] = dc.useState(false);
  const [currentFps, setCurrentFps] = dc.useState(60);
  const frameCountRef = dc.useRef(0);
  const lastFpsUpdateRef = dc.useRef(performance.now());
  
  // --- Clone Dragging State ---
  const [isDraggingClone, setIsDraggingClone] = dc.useState(false);
  const [clonedObject, setClonedObject] = dc.useState(null);
  const draggingCloneRef = dc.useRef(false);
  const clonedObjectRef = dc.useRef(null);

  // --- State for Lottie Interaction ---
  const [isLottieMenuVisible, setIsLottieMenuVisible] = dc.useState(false);
  const [lottieFilePathInput, setLottieFilePathInput] = dc.useState("images/sampleTexture.png");
  const [lottieOverlayPos, setLottieOverlayPos] = dc.useState({ left: -9999, top: -9999, size: 300 });
  const [viewFilePathInput, setViewFilePathInput] = dc.useState("LOTTIE.view.v.2.5");
  const [isViewMenuVisible, setIsViewMenuVisible] = dc.useState(false);

  // Load Lottie player / ReactDOM script if not registered.
  dc.useEffect(() => {
    if (!window.customElements.get("lottie-player")) {
      const lottieScript = document.createElement("script");
      lottieScript.src = "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js";
      lottieScript.async = true;
      document.body.appendChild(lottieScript);
      return () => {
        document.body.removeChild(lottieScript);
      };
    }
  }, []);

  dc.useEffect(() => {
    if (!window.html2canvas) {
      const html2canvasScript = document.createElement("script");
      html2canvasScript.src = "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js";
      html2canvasScript.async = true;
      document.body.appendChild(html2canvasScript);
      return () => {
        document.body.removeChild(html2canvasScript);
      };
    }
  }, []);

  // --- Full-tab mode effect ---
  dc.useEffect(() => {
    const container = containerRef.current;
    if (!container || !isFullTab) return;

    const targetPaneContent = findNearestAncestorWithClass(container, "workspace-leaf-content");
    if (!targetPaneContent) {
      setIsFullTab(false);
      return;
    }

    const contentWrapper = findDirectChildByClass(targetPaneContent, "view-content") || targetPaneContent;
    stateRefs.originalParent = container.parentNode;
    stateRefs.placeholder = document.createElement("div");
    stateRefs.placeholder.style.display = "none";
    container.parentNode.insertBefore(stateRefs.placeholder, container);

    stateRefs.parentPositionInfo = {
      element: contentWrapper,
      original: window.getComputedStyle(contentWrapper).position,
    };
    if (stateRefs.parentPositionInfo.original === "static") {
      contentWrapper.style.position = "relative";
    }

    contentWrapper.appendChild(container);
    Object.assign(container.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "9998",
      overflow: "auto",
    });

    return () => {
      if (stateRefs.placeholder?.parentNode) {
        stateRefs.placeholder.parentNode.replaceChild(container, stateRefs.placeholder);
      }
      if (stateRefs.parentPositionInfo?.element) {
        stateRefs.parentPositionInfo.element.style.position =
          stateRefs.parentPositionInfo.original === "static" ? "" : stateRefs.parentPositionInfo.original;
      }
      container.removeAttribute("style");
      Object.keys(stateRefs).forEach((key) => (stateRefs[key] = null));
    };
  }, [isFullTab]);

  // --- Refs for game state & objects ---
  const addedObjects = dc.useRef([]);
  const characterState = dc.useRef({ pos: { x: 0, y: 0, z: 0 }, verticalVelocity: 0 });
  const cameraState = dc.useRef({ yaw: 0, pitch: 0 });
  const selectedObjectIndex = dc.useRef(null);
  const fovRef = dc.useRef(45 * Math.PI / 180);
  const keysPressed = dc.useRef({});

  // --- Ref for view/projection matrices & canvas size (for overlay positioning) ---
  const vpMatricesRef = dc.useRef({ viewMatrix: null, projectionMatrix: null, width: 800, height: 400 });
  const eyePosRef = dc.useRef({ x: 0, y: 0, z: 0 });

  // --- Gameplay Constants ---
  const gravity = -9.8;
  const moveSpeed = 0.12;
  const sprintMultiplier = 1.8;
  const jumpSpeed = 5.5;
  const mouseSensitivity = 0.005;
  const objectDragSensitivity = 0.01;
  const eyeHeight = 0.8;

  // -------------------------
  // GAME CONTROL FUNCTIONS
  // -------------------------
  const handleExitFullTab = (e) => {
    e.stopPropagation();
    setIsFullTab(false);
  };

  const handleEnterFullTab = () => setIsFullTab(true);

  const resumeGame = () => {
    keysPressed.current = {};
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  };
  
  const closePauseMenu = () => {
    keysPressed.current = {};
    setIsPaused(false);
  };

  const startGame = () => {
    setGameStarted(true);
    
    // Spawn random objects around the map
    const objectTypes = ["cube", "pyramid", "pane"];
    const objectCount = Math.floor(Math.random() * 11) + 15; // 15-25 objects
    
    for (let i = 0; i < objectCount; i++) {
      const randomType = objectTypes[Math.floor(Math.random() * objectTypes.length)];
      const randomX = (Math.random() - 0.5) * 100;
      const randomZ = (Math.random() - 0.5) * 100;
      const randomY = Math.random() * 3;
      const randomRotation = Math.random() * Math.PI * 2;
      const randomScale = 0.5 + Math.random() * 1.5;
      
      addedObjects.current.push({
        type: randomType,
        pos: { x: randomX, y: randomY, z: randomZ },
        rotation: randomRotation,
        scale: { x: randomScale, y: randomScale, z: randomScale },
        texture: null
      });
    }
    
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  };

  // -------------------------
  // START GAME LISTENERS (Spacebar, Enter, Click)
  // -------------------------
  dc.useEffect(() => {
    if (gameStarted) return;
    
    const handleStartKeys = (e) => {
      if (e.key === " " || e.key === "Enter") {
        startGame();
        e.preventDefault();
      }
    };
    
    const handleStartClick = () => {
      if (!gameStarted) {
        startGame();
      }
    };
    
    window.addEventListener("keydown", handleStartKeys);
    window.addEventListener("click", handleStartClick);
    
    return () => {
      window.removeEventListener("keydown", handleStartKeys);
      window.removeEventListener("click", handleStartClick);
    };
  }, [gameStarted]);

  // -------------------------
  // OBJECT SPAWNING FUNCTIONS
  // -------------------------
  const handleAddCube = () => spawnObject("cube", characterState, cameraState, addedObjects);
  const handleAddPyramid = () => spawnObject("pyramid", characterState, cameraState, addedObjects);
  const handleAddPane = () => spawnObject("pane", characterState, cameraState, addedObjects);

  // -------------------------
  // NUMPAD SUPPORT FOR ADD MENU
  // -------------------------
  dc.useEffect(() => {
    const handleNumpad = (e) => {
      if (isAddMenuVisible) {
        if (e.key === "1" || e.key === "Numpad1") {
          handleAddCube();
          setIsAddMenuVisible(false);
          resumeGame();
          e.preventDefault();
        } else if (e.key === "2" || e.key === "Numpad2") {
          handleAddPyramid();
          setIsAddMenuVisible(false);
          resumeGame();
          e.preventDefault();
        } else if (e.key === "3" || e.key === "Numpad3") {
          handleAddPane();
          setIsAddMenuVisible(false);
          resumeGame();
          e.preventDefault();
        } else if (e.key === "4" || e.key === "Numpad4") {
          handleAddCube();
          setIsAddMenuVisible(false);
          resumeGame();
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handleNumpad);
    return () => window.removeEventListener("keydown", handleNumpad);
  }, [isAddMenuVisible]);

  // -------------------------
  // GLOBAL ESC KEY HANDLER FOR MENUS
  // -------------------------
  dc.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        if (showInstructions) {
          setShowInstructions(false);
          closePauseMenu();
          e.preventDefault();
          e.stopPropagation();
        } else if (isAddMenuVisible) {
          setIsAddMenuVisible(false);
          closePauseMenu();
          e.preventDefault();
          e.stopPropagation();
        } else if (isLottieMenuVisible) {
          setIsLottieMenuVisible(false);
          closePauseMenu();
          e.preventDefault();
          e.stopPropagation();
        } else if (showKeyHelper) {
          setShowKeyHelper(false);
          e.preventDefault();
          e.stopPropagation();
        } else if (isPaused && gameStarted) {
          closePauseMenu();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [showInstructions, isAddMenuVisible, isLottieMenuVisible, showKeyHelper, isPaused, gameStarted]);

  // -------------------------
  // KEY LISTENER FOR INTERACTION (E key)
  // -------------------------
  dc.useEffect(() => {
    const handleEKey = (e) => {
      if (e.key.toLowerCase() === "e") {
        if (document.pointerLockElement === canvasRef.current && gameStarted) {
          document.exitPointerLock();
          let paneIndex = selectedObjectIndex.current;
          if (paneIndex === null) {
            const charPos = characterState.current.pos;
            const cameraYaw = cameraState.current.yaw;
            const cameraForward = { x: Math.sin(cameraYaw), z: Math.cos(cameraYaw) };
            let minAngle = Infinity;
            let foundIndex = null;
            addedObjects.current.forEach((obj, index) => {
              if (obj.type === "pane") {
                const toObj = { x: obj.pos.x - charPos.x, z: obj.pos.z - charPos.z };
                const toObjMag = Math.hypot(toObj.x, toObj.z);
                if (toObjMag === 0) return;
                const normToObj = { x: toObj.x / toObjMag, z: toObj.z / toObjMag };
                const dot = cameraForward.x * normToObj.x + cameraForward.z * normToObj.z;
                const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
                const threshold = 15 * Math.PI / 180;
                if (angle < threshold && angle < minAngle) {
                  minAngle = angle;
                  foundIndex = index;
                }
              }
            });
            if (foundIndex !== null) {
              paneIndex = foundIndex;
              selectedObjectIndex.current = paneIndex;
            }
          }
          if (paneIndex !== null) {
            overlayPaneIndex.current = paneIndex;
            setIsLottieMenuVisible(true);
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener("keydown", handleEKey);
    return () => window.removeEventListener("keydown", handleEKey);
  }, [gameStarted]);

  // -------------------------
  // ANIMATION & RENDER LOOP
  // -------------------------
  dc.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas element not found.");
      return;
    }
    
    const webglData = initWebGL(canvas, fovRef);
    if (!webglData) return;
    
    canvas.addEventListener("click", () => { canvas.requestPointerLock(); });
    
    const unregisterPointerLock = registerPointerLockListeners(canvas, setIsPaused, pausedRef, keysPressed);
    const unregisterMouseMove = registerMouseMoveListener(
      canvas, keysPressed, cameraState, mouseSensitivity,
      characterState, addedObjects, selectedObjectIndex, objectDragSensitivity,
      draggingCloneRef, clonedObjectRef, vpMatricesRef, eyePosRef
    );
    const unregisterTouchAndWheel = registerTouchAndWheelListeners(canvas, fovRef, keysPressed, selectedObjectIndex, addedObjects);
    const unregisterKeyListeners = registerKeyListeners(
      canvasRef, gameStarted, setIsAddMenuVisible, setShowInstructions, setShowKeyHelper,
      setEnableTrails, setEnableWireframe, setShowStats, setTimeOfDay, keysPressed,
      null, resumeGame, draggingCloneRef, clonedObjectRef, setIsDraggingClone, setClonedObject,
      vpMatricesRef, eyePosRef, addedObjects, selectedObjectIndex
    );
    
    let lastTime = performance.now();
    function animate(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      
      frameCountRef.current++;
      if (now - lastFpsUpdateRef.current >= 1000) {
        const fps = Math.round(frameCountRef.current / ((now - lastFpsUpdateRef.current) / 1000));
        setCurrentFps(fps);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
      
      if (!gameStartedRef.current) {
        requestAnimationFrame(animate);
        return;
      }
      
      if (!pausedRef.current) {
        const char = characterState.current;
        const forward = { x: Math.sin(cameraState.current.yaw), z: Math.cos(cameraState.current.yaw) };
        const right = { x: Math.cos(cameraState.current.yaw), z: -Math.sin(cameraState.current.yaw) };
        
        const isMoving = keysPressed.current["w"] || keysPressed.current["W"] || keysPressed.current["ArrowUp"] ||
                         keysPressed.current["s"] || keysPressed.current["S"] || keysPressed.current["ArrowDown"] ||
                         keysPressed.current["a"] || keysPressed.current["A"] ||
                         keysPressed.current["d"] || keysPressed.current["D"];
        
        const isSprinting = isMoving && (keysPressed.current["Shift"] || keysPressed.current["ShiftLeft"] || keysPressed.current["ShiftRight"]);
        const currentSpeed = moveSpeed * (isSprinting ? sprintMultiplier : 1.0);
        
        if (keysPressed.current["w"] || keysPressed.current["W"] || keysPressed.current["ArrowUp"]) {
          char.pos.x += forward.x * currentSpeed;
          char.pos.z += forward.z * currentSpeed;
        }
        if (keysPressed.current["s"] || keysPressed.current["S"] || keysPressed.current["ArrowDown"]) {
          char.pos.x -= forward.x * currentSpeed;
          char.pos.z -= forward.z * currentSpeed;
        }
        if (keysPressed.current["a"] || keysPressed.current["A"]) {
          char.pos.x += right.x * currentSpeed;
          char.pos.z += right.z * currentSpeed;
        }
        if (keysPressed.current["d"] || keysPressed.current["D"]) {
          char.pos.x -= right.x * currentSpeed;
          char.pos.z -= right.z * currentSpeed;
        }
        if ((keysPressed.current[" "] || keysPressed.current["Space"]) && char.pos.y === 0) {
          char.verticalVelocity = jumpSpeed;
        }
        char.verticalVelocity += gravity * dt;
        char.pos.y += char.verticalVelocity * dt;
        if (char.pos.y < 0) { char.pos.y = 0; char.verticalVelocity = 0; }
      }
      
      const eyePos = {
        x: characterState.current.pos.x,
        y: characterState.current.pos.y + eyeHeight,
        z: characterState.current.pos.z
      };
      eyePosRef.current = eyePos;
      
      const forwardDir = {
        x: Math.sin(cameraState.current.yaw) * Math.cos(cameraState.current.pitch),
        y: Math.sin(cameraState.current.pitch),
        z: Math.cos(cameraState.current.yaw) * Math.cos(cameraState.current.pitch)
      };
      const viewTarget = {
        x: eyePos.x + forwardDir.x,
        y: eyePos.y + forwardDir.y,
        z: eyePos.z + forwardDir.z
      };
      const viewMatrix = lookAtVec(eyePos, viewTarget, { x: 0, y: 1, z: 0 });
      const projectionMatrix = makeProjectionMatrix(canvas.width, canvas.height, fovRef);
      vpMatricesRef.current = { viewMatrix, projectionMatrix, width: canvas.width, height: canvas.height };

      const skyBrightness = 0.0 + (Math.sin(timeOfDay * Math.PI * 2) * 0.15);
      const skyPurple = 0.0 + (Math.sin(timeOfDay * Math.PI * 2) * 0.08);
      webglData.gl.clearColor(skyBrightness * 0.5, skyBrightness * 0.5, skyBrightness + skyPurple, 1.0);

      if (enableTrails) {
        webglData.gl.enable(webglData.gl.BLEND);
        webglData.gl.blendFunc(webglData.gl.SRC_ALPHA, webglData.gl.ONE_MINUS_SRC_ALPHA);
        webglData.gl.depthMask(false);
        webglData.gl.clear(webglData.gl.DEPTH_BUFFER_BIT);
        webglData.gl.uniform1i(webglData.uUseTexture, 0);
        webglData.gl.uniform4fv(webglData.uColor, [0.0, 0.0, 0.0, 0.15]);
        webglData.gl.depthMask(true);
        webglData.gl.disable(webglData.gl.BLEND);
      } else {
        webglData.gl.clear(webglData.gl.COLOR_BUFFER_BIT | webglData.gl.DEPTH_BUFFER_BIT);
      }
      
      webglData.gl.uniformMatrix4fv(webglData.uProjectionMatrix, false, projectionMatrix);

      // ------------- Draw Character -------------
      {
        const charPos = characterState.current.pos;
        const charModelMatrix = translationMatrix(charPos.x, charPos.y, charPos.z);
        const mvChar = multiply4x4(viewMatrix, charModelMatrix);
        webglData.gl.uniformMatrix4fv(webglData.uModelViewMatrix, false, mvChar);
        webglData.gl.uniform1i(webglData.uUseTexture, 0);
        webglData.gl.uniform4fv(webglData.uColor, [0.615, 0.486, 0.808, 1.0]);
        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, webglData.buffers.cubeBuffer);
        webglData.gl.vertexAttribPointer(webglData.aVertexPosition, 3, webglData.gl.FLOAT, false, 0, 0);
        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, webglData.buffers.cubeUVBuffer);
        webglData.gl.vertexAttribPointer(webglData.aTextureCoord, 2, webglData.gl.FLOAT, false, 0, 0);
        
        if (enableWireframe) {
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 0, 5);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 4, 5);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 8, 5);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 12, 5);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 16, 5);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 20, 5);
        } else {
          webglData.gl.drawArrays(webglData.gl.TRIANGLES, 0, 36);
        }
      }
      
      // ------------- Draw Ground -------------
      {
        const groundModelMatrix = translationMatrix(0, 0, 0);
        const mvGround = multiply4x4(viewMatrix, groundModelMatrix);
        webglData.gl.uniformMatrix4fv(webglData.uModelViewMatrix, false, mvGround);
        webglData.gl.uniform1i(webglData.uUseTexture, 0);
        
        const brightness = 0.1 + (Math.sin(timeOfDay * Math.PI * 2) * 0.15);
        const purpleTint = 0.15 + (Math.cos(timeOfDay * Math.PI * 2) * 0.12);
        webglData.gl.uniform4fv(webglData.uColor, [brightness * 0.7, brightness * 0.6, purpleTint, 1.0]);
        
        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, webglData.buffers.groundBuffer);
        webglData.gl.vertexAttribPointer(webglData.aVertexPosition, 3, webglData.gl.FLOAT, false, 0, 0);
        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, webglData.buffers.groundUVBuffer);
        webglData.gl.vertexAttribPointer(webglData.aTextureCoord, 2, webglData.gl.FLOAT, false, 0, 0);
        
        if (enableWireframe) {
          webglData.gl.drawArrays(webglData.gl.LINE_LOOP, 0, 4);
        } else {
          webglData.gl.drawArrays(webglData.gl.TRIANGLES, 0, 6);
        }
      }
      
      // ------------- Draw Added Objects -------------
      addedObjects.current.forEach(obj => {
        let posBuffer, uvBuffer, vertexCount, color;
        if (obj.type === "cube") {
          posBuffer = webglData.buffers.cubeBuffer;
          uvBuffer = webglData.buffers.cubeUVBuffer;
          vertexCount = 36;
          color = [0.694, 0.612, 0.851, 1.0];
        } else if (obj.type === "pyramid") {
          posBuffer = webglData.buffers.pyramidBuffer;
          uvBuffer = webglData.buffers.pyramidUVBuffer;
          vertexCount = 18;
          color = [0.533, 0.533, 0.533, 1.0];
        } else if (obj.type === "pane") {
          posBuffer = webglData.buffers.paneBuffer;
          uvBuffer = webglData.buffers.paneUVBuffer;
          vertexCount = 6;
          color = [0.615, 0.486, 0.808, 1.0];
        }

        if (overlayPaneIndex.current !== null) {
          const activeObj = addedObjects.current[overlayPaneIndex.current];
          if (activeObj && activeObj.type === "pane" && activeObj.lottieSrc && isLottieMedia(activeObj.lottieSrc)) {
            const finalModel = computeFinalModel(activeObj);
            const corners = [
              [-0.5, -0.5, 0, 1],
              [0.5, -0.5, 0, 1],
              [0.5,  0.5, 0, 1],
              [-0.5,  0.5, 0, 1]
            ];
            let xCoords = [], yCoords = [];
            corners.forEach(corner => {
              const transformed = multiplyMatVec(finalModel, corner);
              const screenPos = computeScreenPosition(
                [transformed[0], transformed[1], transformed[2]],
                viewMatrix, projectionMatrix, canvas.width, canvas.height
              );
              xCoords.push(screenPos.left);
              yCoords.push(screenPos.top);
            });
            const minX = Math.min(...xCoords);
            const maxX = Math.max(...xCoords);
            const minY = Math.min(...yCoords);
            const maxY = Math.max(...yCoords);
            const overlayWidth = maxX - minX;
            const overlayHeight = maxY - minY;
            const overlaySize = Math.min(overlayWidth, overlayHeight);
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            setLottieOverlayPos({ left: centerX, top: centerY, size: overlaySize });
          } else {
            setLottieOverlayPos({ left: -9999, top: -9999, size: 0 });
          }
        }

        const modelMatrix = translationMatrix(obj.pos.x, obj.pos.y, obj.pos.z);
        const rotMatrix = rotationYMatrix(obj.rotation || 0);
        const scaleMat = scaleMatrix(obj.scale || 1.0);
        const modelRS = multiply4x4(rotMatrix, scaleMat);
        const finalModel = multiply4x4(modelMatrix, modelRS);
        const mvObj = multiply4x4(viewMatrix, finalModel);
        webglData.gl.uniformMatrix4fv(webglData.uModelViewMatrix, false, mvObj);

        if (obj.lottieSrc && isLottieMedia(obj.lottieSrc)) {
          if (!obj.texture) {
            obj.texture = webglData.gl.createTexture();
            webglData.gl.bindTexture(webglData.gl.TEXTURE_2D, obj.texture);
            webglData.gl.texParameteri(webglData.gl.TEXTURE_2D, webglData.gl.TEXTURE_MIN_FILTER, webglData.gl.LINEAR);
            webglData.gl.texParameteri(webglData.gl.TEXTURE_2D, webglData.gl.TEXTURE_WRAP_S, webglData.gl.CLAMP_TO_EDGE);
            webglData.gl.texParameteri(webglData.gl.TEXTURE_2D, webglData.gl.TEXTURE_WRAP_T, webglData.gl.CLAMP_TO_EDGE);
          }
          updateLottieTexture(webglData.gl, obj);
          webglData.gl.uniform1i(webglData.uUseTexture, 1);
          webglData.gl.activeTexture(webglData.gl.TEXTURE0);
          webglData.gl.bindTexture(webglData.gl.TEXTURE_2D, obj.texture);
        } else if (obj.viewLoaded && obj.viewContainer) {
          if (!obj.texture) {
            obj.texture = webglData.gl.createTexture();
            webglData.gl.bindTexture(webglData.gl.TEXTURE_2D, obj.texture);
            webglData.gl.texParameteri(webglData.gl.TEXTURE_2D, webglData.gl.TEXTURE_MIN_FILTER, webglData.gl.LINEAR);
            webglData.gl.texParameteri(webglData.gl.TEXTURE_2D, webglData.gl.TEXTURE_WRAP_S, webglData.gl.CLAMP_TO_EDGE);
            webglData.gl.texParameteri(webglData.gl.TEXTURE_2D, webglData.gl.TEXTURE_WRAP_T, webglData.gl.CLAMP_TO_EDGE);
          }
          updateViewTexture(webglData.gl, obj);
          webglData.gl.uniform1i(webglData.uUseTexture, 1);
          webglData.gl.activeTexture(webglData.gl.TEXTURE0);
          webglData.gl.bindTexture(webglData.gl.TEXTURE_2D, obj.texture);
        } else {
          webglData.gl.uniform1i(webglData.uUseTexture, 0);
          webglData.gl.uniform4fv(webglData.uColor, color);
        }

        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, posBuffer);
        webglData.gl.vertexAttribPointer(webglData.aVertexPosition, 3, webglData.gl.FLOAT, false, 0, 0);
        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, uvBuffer);
        webglData.gl.vertexAttribPointer(webglData.aTextureCoord, 2, webglData.gl.FLOAT, false, 0, 0);
        
        if (enableWireframe) {
          if (obj.type === "cube") {
            for (let i = 0; i < 6; i++) {
              webglData.gl.drawArrays(webglData.gl.LINE_LOOP, i * 6, 4);
            }
          } else if (obj.type === "pyramid") {
            webglData.gl.drawArrays(webglData.gl.LINE_LOOP, 0, 3);
            webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 3, 4);
            webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 6, 4);
            webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 9, 4);
            webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 12, 4);
          } else {
            webglData.gl.drawArrays(webglData.gl.LINE_LOOP, 0, 4);
          }
        } else {
          webglData.gl.drawArrays(webglData.gl.TRIANGLES, 0, vertexCount);
        }
      });

      // ------------- Draw Clone Being Dragged -------------
      if (draggingCloneRef.current && clonedObjectRef.current) {
        const obj = clonedObjectRef.current;
        let posBuffer, uvBuffer, vertexCount, color;
        
        if (obj.type === "cube") {
          posBuffer = webglData.buffers.cubeBuffer;
          uvBuffer = webglData.buffers.cubeUVBuffer;
          vertexCount = 36;
          color = [0.694, 0.612, 0.851, 0.5];
        } else if (obj.type === "pyramid") {
          posBuffer = webglData.buffers.pyramidBuffer;
          uvBuffer = webglData.buffers.pyramidUVBuffer;
          vertexCount = 18;
          color = [0.533, 0.533, 0.533, 0.5];
        } else if (obj.type === "pane") {
          posBuffer = webglData.buffers.paneBuffer;
          uvBuffer = webglData.buffers.paneUVBuffer;
          vertexCount = 6;
          color = [0.4, 0.4, 0.4, 0.5];
        }
        
        webglData.gl.enable(webglData.gl.BLEND);
        webglData.gl.blendFunc(webglData.gl.SRC_ALPHA, webglData.gl.ONE_MINUS_SRC_ALPHA);
        
        const scale = obj.scale || { x: 1, y: 1, z: 1 };
        const rotation = obj.rotation || 0;
        let modelMatrix = translationMatrix(obj.pos.x, obj.pos.y, obj.pos.z);
        modelMatrix = multiply4x4(modelMatrix, rotationYMatrix(rotation));
        modelMatrix = multiply4x4(modelMatrix, scaleMatrix(scale.x, scale.y, scale.z));
        const mvClone = multiply4x4(viewMatrix, modelMatrix);
        
        webglData.gl.uniformMatrix4fv(webglData.uModelViewMatrix, false, mvClone);
        webglData.gl.uniform1i(webglData.uUseTexture, 0);
        webglData.gl.uniform4fv(webglData.uColor, color);
        
        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, posBuffer);
        webglData.gl.vertexAttribPointer(webglData.aVertexPosition, 3, webglData.gl.FLOAT, false, 0, 0);
        webglData.gl.bindBuffer(webglData.gl.ARRAY_BUFFER, uvBuffer);
        webglData.gl.vertexAttribPointer(webglData.aTextureCoord, 2, webglData.gl.FLOAT, false, 0, 0);
        
        if (obj.type === "cube") {
          for (let i = 0; i < 6; i++) {
            webglData.gl.drawArrays(webglData.gl.LINE_LOOP, i * 6, 4);
          }
        } else if (obj.type === "pyramid") {
          webglData.gl.drawArrays(webglData.gl.LINE_LOOP, 0, 3);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 3, 4);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 6, 4);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 9, 4);
          webglData.gl.drawArrays(webglData.gl.LINE_STRIP, 12, 4);
        } else {
          webglData.gl.drawArrays(webglData.gl.LINE_LOOP, 0, 4);
        }
        
        webglData.gl.disable(webglData.gl.BLEND);
      }
      
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
    
    return () => {
      unregisterKeyListeners && unregisterKeyListeners();
      unregisterPointerLock && unregisterPointerLock();
      unregisterMouseMove && unregisterMouseMove();
      unregisterTouchAndWheel && unregisterTouchAndWheel();
    };
  }, [gameStarted]);

  async function handleLoadView() {
    const viewName = viewFilePathInput.trim();
    const fileName = viewName.endsWith(".md") ? viewName : viewName + ".md";
    try {
      const { View } = await dc.require(dc.headerLink(fileName, "ViewComponent"));
      const viewElement = <View />;
      const idx = selectedObjectIndex.current;
      if (idx !== null) {
        const obj = addedObjects.current[idx];
        if (obj && obj.type === "pane") {
          if (!obj.viewContainer) {
            obj.viewContainer = document.createElement("div");
            obj.viewContainer.style.position = "absolute";
            obj.viewContainer.style.width = "512px";
            obj.viewContainer.style.height = "512px";
            obj.viewContainer.style.backgroundColor = "#fff";
            obj.viewContainer.style.left = "-9999px";
            document.body.appendChild(obj.viewContainer);
          }
          
          if (dc.preact && typeof dc.preact.render === "function") {
            dc.preact.render(viewElement, obj.viewContainer);
          } else {
            throw new Error("preact render not found on dc");
          }
          
          obj.viewLoaded = true;
          obj.lottieSrc = null;
          obj.lottieAnimation = null;
        }
      }
      setIsViewMenuVisible(false);
      setIsLottieMenuVisible(false);
      if (canvasRef.current) {
        canvasRef.current.requestPointerLock();
      }
    } catch (err) {
      console.error("Error loading view:", err);
    }
  }

  const handleLoadLottie = () => {
    requireMediaFile(lottieFilePathInput)
      .then((url) => {
        console.debug("Loaded media URL:", url);
        const idx = selectedObjectIndex.current;
        if (idx !== null) {
          const obj = addedObjects.current[idx];
          if (obj && obj.type === "pane") {
            obj.lottieSrc = url;
            if (!obj.lottieAnimation) {
              obj.offscreenContainer = document.createElement("div");
              obj.offscreenContainer.style.position = "absolute";
              obj.offscreenContainer.style.width = "512px";
              obj.offscreenContainer.style.height = "512px";
              obj.offscreenContainer.style.left = "-9999px";
              document.body.appendChild(obj.offscreenContainer);
  
              const animation = lottie.loadAnimation({
                container: obj.offscreenContainer,
                renderer: 'canvas',
                loop: true,
                autoplay: true,
                path: url
              });
  
              obj.lottieAnimation = animation;
  
              setTimeout(() => {
                const canvasEl = obj.offscreenContainer.querySelector('canvas');
                if (canvasEl) {
                  obj.offscreenCanvas = canvasEl;
                }
              }, 100);
            }
          }
        }
        setIsLottieMenuVisible(false);
        if (canvasRef.current) {
          canvasRef.current.requestPointerLock();
        }
      })
      .catch((err) => {
        console.error("Error loading media file:", err);
      });
  };

  // Compact mode fallback
  if (!isFullTab) {
    return (
      <div ref={containerRef} style={{
        padding: "16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        border: "1px dashed var(--background-modifier-border)",
        borderRadius: "8px",
        backgroundColor: "var(--background-primary-alt)",
      }}>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
          Game Engine is in compact mode.
        </p>
        <button 
          style={{
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: "500",
            color: "var(--text-on-accent)",
            backgroundColor: "var(--interactive-accent)",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          onClick={handleEnterFullTab}
        >
          Enter Full Tab
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={uniqueWrapperClass}>
      <style>
        {`.${uniqueWrapperClass} .subtle-icon {
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }
        .${uniqueWrapperClass}:hover .subtle-icon {
          opacity: 0.7;
          transform: scale(1);
        }
        .${uniqueWrapperClass} .subtle-icon:hover {
          opacity: 1;
        }
        .${uniqueWrapperClass} .subtle-icon:hover .exit-tooltip {
          visibility: visible;
          opacity: 1;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }`}
      </style>
      {isFullTab && (
        <style>{`
          .status-bar {
            display: none !important;
          }
        `}</style>
      )}
      <div style={{
        position: "relative",
        height: "100%",
        width: "100%",
        border: isFullTab ? "none" : "1px solid var(--background-modifier-border)",
        borderRadius: isFullTab ? "0px" : "8px",
        overflow: "hidden",
        backgroundColor: "#000000"
      }}>
        {/* Exit Full Tab Button */}
        <div
          style={{
            position: "absolute",
            top: "15px",
            right: "20px",
            fontFamily: "monospace",
            fontSize: "14px",
            color: "var(--text-faint)",
            userSelect: "none",
            cursor: "pointer",
            zIndex: 10000,
          }}
          className="subtle-icon"
          onClick={handleExitFullTab}
        >
          {"</>"}
          <span 
            className="exit-tooltip"
            style={{
              visibility: "hidden",
              opacity: 0,
              backgroundColor: "var(--background-secondary-alt)",
              color: "var(--text-normal)",
              textAlign: "center",
              borderRadius: "4px",
              padding: "5px 10px",
              position: "absolute",
              zIndex: 1,
              top: "50%",
              right: "120%",
              transform: "translateY(-50%)",
              fontSize: "12px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              border: "1px solid var(--background-modifier-border)",
            }}
          >
            Close Full Mode
          </span>
        </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      
      {/* Start Menu Overlay */}
      {(!gameStarted) && (
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: "100%", height: "100%",
          backgroundColor: "#000000",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          zIndex: 2,
          padding: "20px",
          boxSizing: "border-box",
          overflowY: "auto"
        }}>
          <h1 style={{ 
            color: "#9d7cce", 
            margin: "0 0 20px 0",
            fontSize: "2rem",
            fontWeight: "300",
            letterSpacing: "4px",
            textTransform: "uppercase",
            textShadow: "0 0 20px rgba(157, 124, 206, 0.5)",
            textAlign: "center"
          }}>Game Engine</h1>
          
          <div style={{
            backgroundColor: "rgba(10,10,10,0.9)",
            padding: "20px 25px",
            borderRadius: "4px",
            marginBottom: "20px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "50vh",
            overflowY: "auto",
            border: "1px solid rgba(157, 124, 206, 0.25)",
            boxShadow: "0 0 30px rgba(157, 124, 206, 0.05)",
            boxSizing: "border-box"
          }}>
            <h3 style={{ 
              color: "#b19cd9", 
              marginTop: 0,
              fontSize: "1rem",
              fontWeight: "400",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "15px",
              textAlign: "center"
            }}>Controls</h3>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
              gap: "15px 25px",
              color: "#888", 
              textAlign: "left", 
              fontSize: "12px", 
              lineHeight: "1.8" 
            }}>
              <div>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>MOVEMENT</strong>
                  <span style={{ color: "#666" }}>W A S D</span> — Move around<br/>
                  <span style={{ color: "#666" }}>Shift</span> — Sprint (hold)<br/>
                  <span style={{ color: "#666" }}>Space</span> — Jump
                </p>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>CAMERA</strong>
                  <span style={{ color: "#666" }}>Mouse</span> — Look around<br/>
                  <span style={{ color: "#666" }}>⌃ + Scroll</span> — Adjust FOV
                </p>
                <p style={{ margin: "0" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>OBJECTS</strong>
                  <span style={{ color: "#666" }}>I</span> — Add Objects menu
                </p>
              </div>
              
              <div>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>EDIT OBJECTS</strong>
                  <span style={{ color: "#666" }}>⌘ + Drag</span> — Move XZ<br/>
                  <span style={{ color: "#666" }}>⌘ + Scroll</span> — Move Y<br/>
                  <span style={{ color: "#666" }}>⌘ + ⌥ + Drag</span> — Rotate<br/>
                  <span style={{ color: "#666" }}>⌘ + ⌃ + Drag</span> — Scale X/Y<br/>
                  <span style={{ color: "#666" }}>⌘ + ⌃ + Scroll</span> — Scale Z
                </p>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>ADVANCED</strong>
                  <span style={{ color: "#666" }}>C (hold)</span> — Clone object<br/>
                  <span style={{ color: "#666" }}>Delete</span> — Remove object<br/>
                  <span style={{ color: "#666" }}>T / G / N / F</span> — Effects
                </p>
                <p style={{ margin: "0" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>OTHER</strong>
                  <span style={{ color: "#666" }}>E</span> — Texture/View menu<br/>
                  <span style={{ color: "#666" }}>H</span> — Help controls<br/>
                  <span style={{ color: "#666" }}>K (hold)</span> — HUD overlay<br/>
                  <span style={{ color: "#666" }}>Esc</span> — Pause game
                </p>
              </div>
            </div>
          </div>
          
          <button onClick={startGame} style={{ 
            padding: "12px 40px", 
            fontSize: "0.95rem",
            backgroundColor: "transparent",
            color: "#9d7cce",
            border: "2px solid #9d7cce",
            borderRadius: "2px",
            cursor: "pointer",
            fontWeight: "400",
            letterSpacing: "3px",
            textTransform: "uppercase",
            transition: "all 0.3s ease",
            boxShadow: "0 0 20px rgba(157, 124, 206, 0.25)"
          }}>Start</button>
          
          <p style={{
            marginTop: "15px",
            color: "#555",
            fontSize: "0.75rem",
            letterSpacing: "1px",
            textAlign: "center",
            lineHeight: "1.6",
            margin: "12px 0 0 0"
          }}>
            <span style={{ color: "#9d7cce" }}>Space</span> · <span style={{ color: "#9d7cce" }}>Enter</span> · Click anywhere to start
          </p>
        </div>
      )}
      
      {/* Pause Menu Overlay */}
      {isPaused && gameStarted && (
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.95)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          zIndex: 2
        }}>
          <h2 style={{ 
            color: "#9d7cce", 
            fontSize: "2rem",
            fontWeight: "300",
            letterSpacing: "4px",
            textTransform: "uppercase",
            marginBottom: "30px",
            textShadow: "0 0 20px rgba(157, 124, 206, 0.4)"
          }}>Paused</h2>
          <button onClick={resumeGame} style={{ 
            padding: "12px 40px", 
            fontSize: "1rem",
            backgroundColor: "transparent",
            color: "#9d7cce",
            border: "2px solid #9d7cce",
            borderRadius: "2px",
            cursor: "pointer",
            fontWeight: "400",
            letterSpacing: "2px",
            textTransform: "uppercase",
            boxShadow: "0 0 15px rgba(157, 124, 206, 0.2)"
          }}>Resume</button>
          <p style={{
            marginTop: "20px",
            color: "#666",
            fontSize: "0.8rem",
            letterSpacing: "1px",
            textAlign: "center"
          }}>
            <span style={{ color: "#9d7cce" }}>ESC</span> to close · Click canvas to resume
          </p>
        </div>
      )}
      
      {/* Add Object Menu Overlay */}
      {isAddMenuVisible && gameStarted && (
        <div onClick={() => { setIsAddMenuVisible(false); resumeGame(); }}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            backgroundColor: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 3, cursor: "pointer"
          }}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: "#0a0a0a",
            padding: "35px",
            borderRadius: "2px",
            textAlign: "center",
            cursor: "default",
            minWidth: "320px",
            border: "1px solid rgba(157, 124, 206, 0.3)",
            boxShadow: "0 0 50px rgba(157, 124, 206, 0.3)"
          }}>
            <h4 style={{ 
              color: "#9d7cce", 
              margin: "0 0 8px",
              fontSize: "1.2rem",
              fontWeight: "300",
              letterSpacing: "3px",
              textTransform: "uppercase",
              textShadow: "0 0 15px rgba(157, 124, 206, 0.4)"
            }}>Spawn Object</h4>
            <p style={{
              color: "#666",
              fontSize: "0.75rem",
              margin: "0 0 25px",
              letterSpacing: "1px"
            }}>Use numpad or click</p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <button onClick={() => { handleAddCube(); setIsAddMenuVisible(false); resumeGame(); }} 
                style={{ 
                  padding: "16px 12px", 
                  fontSize: "0.9rem", 
                  backgroundColor: "rgba(157, 124, 206, 0.05)",
                  color: "#b19cd9",
                  border: "2px solid rgba(157, 124, 206, 0.3)",
                  borderRadius: "2px",
                  cursor: "pointer",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontWeight: "400",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}>
                <div style={{ fontSize: "1.1rem", marginBottom: "4px" }}>■</div>
                Cube
                <div style={{ 
                  position: "absolute", 
                  top: "6px", 
                  right: "8px", 
                  fontSize: "0.7rem", 
                  color: "#666",
                  fontWeight: "300"
                }}>1</div>
              </button>
              
              <button onClick={() => { handleAddPyramid(); setIsAddMenuVisible(false); resumeGame(); }} 
                style={{ 
                  padding: "16px 12px", 
                  fontSize: "0.9rem", 
                  backgroundColor: "rgba(157, 124, 206, 0.05)",
                  color: "#b19cd9",
                  border: "2px solid rgba(157, 124, 206, 0.3)",
                  borderRadius: "2px",
                  cursor: "pointer",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontWeight: "400",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}>
                <div style={{ fontSize: "1.1rem", marginBottom: "4px" }}>▲</div>
                Pyramid
                <div style={{ 
                  position: "absolute", 
                  top: "6px", 
                  right: "8px", 
                  fontSize: "0.7rem", 
                  color: "#666",
                  fontWeight: "300"
                }}>2</div>
              </button>
              
              <button onClick={() => { handleAddPane(); setIsAddMenuVisible(false); resumeGame(); }} 
                style={{ 
                  padding: "16px 12px", 
                  fontSize: "0.9rem", 
                  backgroundColor: "rgba(157, 124, 206, 0.05)",
                  color: "#b19cd9",
                  border: "2px solid rgba(157, 124, 206, 0.3)",
                  borderRadius: "2px",
                  cursor: "pointer",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontWeight: "400",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}>
                <div style={{ fontSize: "1.1rem", marginBottom: "4px" }}>▭</div>
                Pane
                <div style={{ 
                  position: "absolute", 
                  top: "6px", 
                  right: "8px", 
                  fontSize: "0.7rem", 
                  color: "#666",
                  fontWeight: "300"
                }}>3</div>
              </button>
              
              <button onClick={() => { handleAddCube(); setIsAddMenuVisible(false); resumeGame(); }} 
                style={{ 
                  padding: "16px 12px", 
                  fontSize: "0.9rem", 
                  backgroundColor: "rgba(157, 124, 206, 0.05)",
                  color: "#888",
                  border: "2px solid rgba(136, 136, 136, 0.2)",
                  borderRadius: "2px",
                  cursor: "pointer",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontWeight: "400",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}>
                <div style={{ fontSize: "1.1rem", marginBottom: "4px" }}>◆</div>
                Sphere
                <div style={{ 
                  position: "absolute", 
                  top: "6px", 
                  right: "8px", 
                  fontSize: "0.7rem", 
                  color: "#555",
                  fontWeight: "300"
                }}>4</div>
              </button>
            </div>
            
            <button onClick={() => { setIsAddMenuVisible(false); resumeGame(); }}
              style={{
                padding: "10px 20px",
                fontSize: "0.75rem",
                backgroundColor: "transparent",
                color: "#555",
                border: "1px solid #333",
                borderRadius: "2px",
                cursor: "pointer",
                letterSpacing: "2px",
                textTransform: "uppercase",
                width: "100%",
                marginTop: "10px"
              }}>
              Cancel (Esc)
            </button>
          </div>
        </div>
      )}
      
      {/* Instructions Overlay */}
      {showInstructions && gameStarted && (
        <div onClick={() => { setShowInstructions(false); resumeGame(); }}
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            backgroundColor: "rgba(0,0,0,0.95)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 4, cursor: "pointer",
            padding: "20px",
            boxSizing: "border-box"
          }}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: "#0a0a0a",
            padding: "25px 30px",
            borderRadius: "2px",
            maxWidth: "600px",
            width: "100%",
            cursor: "default",
            maxHeight: "85vh",
            overflowY: "auto",
            border: "1px solid rgba(157, 124, 206, 0.3)",
            boxShadow: "0 0 50px rgba(157, 124, 206, 0.2)",
            boxSizing: "border-box"
          }}>
            <h2 style={{ 
              color: "#b19cd9", 
              margin: "0 0 20px 0",
              fontSize: "1.3rem",
              fontWeight: "300",
              letterSpacing: "3px",
              textTransform: "uppercase",
              textAlign: "center"
            }}>Controls</h2>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", 
              gap: "15px 25px",
              color: "#888", 
              textAlign: "left", 
              fontSize: "12px", 
              lineHeight: "1.8",
              marginBottom: "20px"
            }}>
              <div>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>MOVEMENT</strong>
                  <span style={{ color: "#666" }}>W A S D</span> — Move around<br/>
                  <span style={{ color: "#666" }}>Shift</span> — Sprint (hold)<br/>
                  <span style={{ color: "#666" }}>Space</span> — Jump
                </p>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>CAMERA</strong>
                  <span style={{ color: "#666" }}>Mouse</span> — Look around<br/>
                  <span style={{ color: "#666" }}>⌃ + Scroll</span> — Adjust FOV
                </p>
                <p style={{ margin: "0" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>OBJECTS</strong>
                  <span style={{ color: "#666" }}>I</span> — Add Objects menu
                </p>
              </div>
              
              <div>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>EDIT OBJECTS</strong>
                  <span style={{ color: "#666" }}>⌘ + Drag</span> — Move XZ<br/>
                  <span style={{ color: "#666" }}>⌘ + Scroll</span> — Move Y<br/>
                  <span style={{ color: "#666" }}>⌘ + ⌥ + Drag</span> — Rotate<br/>
                  <span style={{ color: "#666" }}>⌘ + ⌃ + Drag</span> — Scale X/Y<br/>
                  <span style={{ color: "#666" }}>⌘ + ⌃ + Scroll</span> — Scale Z
                </p>
                <p style={{ margin: "0 0 12px" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>ADVANCED</strong>
                  <span style={{ color: "#666" }}>C (hold)</span> — Clone object<br/>
                  <span style={{ color: "#666" }}>Delete</span> — Remove object<br/>
                  <span style={{ color: "#666" }}>T / G / N / F</span> — Effects
                </p>
                <p style={{ margin: "0" }}>
                  <strong style={{ color: "#9d7cce", letterSpacing: "1px", display: "block", marginBottom: "4px" }}>OTHER</strong>
                  <span style={{ color: "#666" }}>E</span> — Texture/View menu<br/>
                  <span style={{ color: "#666" }}>H</span> — Help controls<br/>
                  <span style={{ color: "#666" }}>K (hold)</span> — HUD overlay<br/>
                  <span style={{ color: "#666" }}>Esc</span> — Pause game
                </p>
              </div>
            </div>
            
            <button onClick={() => { setShowInstructions(false); resumeGame(); }} 
              style={{ 
                padding: "12px 30px", 
                fontSize: "0.85rem",
                backgroundColor: "transparent",
                color: "#9d7cce",
                border: "2px solid #9d7cce",
                borderRadius: "2px",
                cursor: "pointer",
                fontWeight: "400",
                width: "100%",
                letterSpacing: "2px",
                textTransform: "uppercase",
                boxShadow: "0 0 15px rgba(157, 124, 206, 0.2)"
              }}>
              Resume
            </button>
            
            <p style={{ 
              color: "#555", 
              fontSize: "11px", 
              marginTop: "15px", 
              marginBottom: 0,
              textAlign: "center",
              letterSpacing: "0.5px"
            }}>
              {"Press H or click outside to close"}
            </p>
          </div>
        </div>
      )}
      
      {/* Lottie Interaction Menu Overlay */}
      {isLottieMenuVisible && gameStarted && (
        <div
            onClick={() => {
            setIsLottieMenuVisible(false);
            resumeGame();
            }}
            style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
            cursor: "pointer"
            }}
        >
            <div
            onClick={(e) => e.stopPropagation()}
            style={{
                backgroundColor: "#0a0a0a",
                padding: "30px",
                borderRadius: "2px",
                textAlign: "center",
                cursor: "default",
                maxWidth: "400px",
                border: "1px solid rgba(157, 124, 206, 0.3)",
                boxShadow: "0 0 40px rgba(157, 124, 206, 0.15)"
            }}
            >
            <h4 style={{ 
              color: "#b19cd9", 
              margin: "0 0 25px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              fontSize: "1.1rem",
              fontWeight: "300"
            }}>Pane Interaction</h4>

            {/* Load Texture Section */}
            <div style={{ marginBottom: "20px" }}>
                <h5 style={{ 
                  color: "#9d7cce", 
                  margin: "0 0 10px",
                  letterSpacing: "1px",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: "400"
                }}>Load Texture</h5>
                <input
                type="text"
                value={lottieFilePathInput}
                onChange={(e) => setLottieFilePathInput(e.target.value)}
                placeholder="Enter texture file path"
                style={{ 
                  padding: "10px", 
                  width: "100%", 
                  marginBottom: "10px",
                  backgroundColor: "rgba(20,20,20,0.6)",
                  border: "1px solid rgba(157, 124, 206, 0.2)",
                  color: "#888",
                  borderRadius: "2px",
                  boxSizing: "border-box",
                  fontSize: "0.85rem"
                }}
                />
                <button
                onClick={handleLoadLottie}
                style={{ 
                  padding: "10px 20px",
                  backgroundColor: "transparent",
                  color: "#9d7cce",
                  border: "1px solid #9d7cce",
                  borderRadius: "2px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  width: "100%",
                  fontWeight: "400"
                }}
                >
                Load Texture
                </button>
            </div>

            {/* Load View Section */}
            <div style={{ marginTop: "20px", marginBottom: "20px" }}>
                <h5 style={{ 
                  color: "#9d7cce", 
                  margin: "0 0 10px",
                  letterSpacing: "1px",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: "400"
                }}>Load View</h5>
                <input
                type="text"
                value={viewFilePathInput}
                onChange={(e) => setViewFilePathInput(e.target.value)}
                placeholder="Enter view name"
                style={{ 
                  padding: "10px", 
                  width: "100%", 
                  marginBottom: "10px",
                  backgroundColor: "rgba(20,20,20,0.6)",
                  border: "1px solid rgba(157, 124, 206, 0.2)",
                  color: "#888",
                  borderRadius: "2px",
                  boxSizing: "border-box",
                  fontSize: "0.85rem"
                }}
                />
                <button
                onClick={handleLoadView}
                style={{ 
                  padding: "10px 20px",
                  backgroundColor: "transparent",
                  color: "#9d7cce",
                  border: "1px solid #9d7cce",
                  borderRadius: "2px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  width: "100%",
                  fontWeight: "400"
                }}
                >
                Load View
                </button>
            </div>

            <button
                onClick={() => setIsLottieMenuVisible(false)}
                style={{ 
                  padding: "10px 20px", 
                  fontSize: "0.8rem",
                  backgroundColor: "transparent",
                  color: "#666",
                  border: "1px solid #444",
                  borderRadius: "2px",
                  cursor: "pointer",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  width: "100%",
                  marginTop: "10px"
                }}
            >
                Cancel
            </button>
            </div>
        </div>
      )}
      
      {/* On-Screen Key Helper */}
      {showKeyHelper && gameStarted && !isPaused && !isAddMenuVisible && !showInstructions && !isLottieMenuVisible && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          backgroundColor: "rgba(10,10,10,0.85)",
          padding: "15px 20px",
          borderRadius: "2px",
          border: "1px solid rgba(157, 124, 206, 0.2)",
          boxShadow: "0 0 30px rgba(0,0,0,0.5)",
          fontSize: "11px",
          color: "#666",
          fontFamily: "monospace",
          zIndex: 2,
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: "1.8",
          minWidth: "200px"
        }}>
          <div style={{ 
            marginBottom: "10px", 
            color: "#9d7cce",
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontWeight: "400",
            borderBottom: "1px solid rgba(157, 124, 206, 0.15)",
            paddingBottom: "8px"
          }}>
            Quick Keys <span style={{ color: "#555", fontSize: "8px" }}>(Hold K)</span>
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>WASD</span>
            <span>Move</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>Shift</span>
            <span>Sprint</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>Space</span>
            <span>Jump</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>Mouse</span>
            <span>Look</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#888" }}>⌃+Scroll</span>
            <span>FOV</span>
          </div>
          
          <div style={{ 
            borderTop: "1px solid rgba(157, 124, 206, 0.1)",
            paddingTop: "8px",
            marginTop: "8px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>I</span>
              <span>Objects (1-4)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>E</span>
              <span>Textures</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>H</span>
              <span>Help</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>Esc</span>
              <span>Pause</span>
            </div>
          </div>
          
          <div style={{ 
            borderTop: "1px solid rgba(157, 124, 206, 0.1)",
            paddingTop: "8px",
            marginTop: "8px"
          }}>
            <div style={{ 
              color: "#9d7cce",
              fontSize: "9px",
              letterSpacing: "1px",
              marginBottom: "5px"
            }}>EXPERIMENTAL</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>T</span>
              <span>Trails</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>G</span>
              <span>Wireframe</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>N</span>
              <span>Time Cycle</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#888" }}>F</span>
              <span>Stats</span>
            </div>
          </div>
          
          <div style={{ 
            borderTop: "1px solid rgba(157, 124, 206, 0.1)",
            paddingTop: "8px",
            marginTop: "8px"
          }}>
            <div style={{ 
              color: "#9d7cce",
              fontSize: "9px",
              letterSpacing: "1px",
              marginBottom: "5px"
            }}>OBJECT MANIPULATION</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>⌘+Click</span>
              <span>Select</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>⌘+Drag</span>
              <span>Move XZ</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>⌘+Scroll</span>
              <span>Move Y</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <span style={{ color: "#888" }}>C</span>
              <span>Clone & Drag</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#888" }}>Del</span>
              <span>Delete at Crosshair</span>
            </div>
          </div>
          
          <div style={{ 
            marginTop: "12px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(157, 124, 206, 0.1)",
            fontSize: "10px",
            color: "#555",
            textAlign: "center"
          }}>
            Hold K to view controls
          </div>
        </div>
      )}
      
      {/* Stats Display */}
      {showStats && gameStarted && !isPaused && (
        <div style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          backgroundColor: "rgba(10,10,10,0.85)",
          padding: "12px 16px",
          borderRadius: "2px",
          border: "1px solid rgba(157, 124, 206, 0.2)",
          boxShadow: "0 0 30px rgba(0,0,0,0.5)",
          fontSize: "11px",
          color: "#666",
          fontFamily: "monospace",
          zIndex: 2,
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: "1.6",
          minWidth: "180px"
        }}>
          <div style={{ 
            color: "#9d7cce",
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontWeight: "400",
            marginBottom: "8px",
            borderBottom: "1px solid rgba(157, 124, 206, 0.15)",
            paddingBottom: "6px"
          }}>
            Performance
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>FPS:</span>
            <span style={{ color: currentFps >= 55 ? "#9d7cce" : "#ff6b6b" }}>{currentFps}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>Objects:</span>
            <span style={{ color: "#9d7cce" }}>{addedObjects.current.length}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>Time:</span>
            <span style={{ color: "#9d7cce" }}>{(timeOfDay * 24).toFixed(1)}h</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{ color: "#888" }}>Trails:</span>
            <span style={{ color: enableTrails ? "#9d7cce" : "#444" }}>{enableTrails ? "ON" : "OFF"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#888" }}>Wire:</span>
            <span style={{ color: enableWireframe ? "#9d7cce" : "#444" }}>{enableWireframe ? "ON" : "OFF"}</span>
          </div>
        </div>
      )}
      
      {/* Clone Drag Mode Indicator */}
      {isDraggingClone && gameStarted && !isPaused && (
        <div style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          backgroundColor: "rgba(157, 124, 206, 0.15)",
          padding: "12px 16px",
          borderRadius: "2px",
          border: "1px solid rgba(157, 124, 206, 0.4)",
          boxShadow: "0 0 20px rgba(157, 124, 206, 0.3)",
          fontSize: "11px",
          color: "#9d7cce",
          fontFamily: "monospace",
          zIndex: 3,
          pointerEvents: "none",
          userSelect: "none",
          animation: "pulse 1.5s ease-in-out infinite"
        }}>
          <div style={{ 
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontWeight: "400",
            marginBottom: "4px"
          }}>
            CLONING
          </div>
          <div style={{ fontSize: "9px", color: "#b19cd9" }}>
            Release C to place
          </div>
        </div>
      )}
      
      {/* Crosshair Cursor */}
      {gameStarted && !isPaused && !isAddMenuVisible && !showInstructions && !isLottieMenuVisible && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 3,
          userSelect: "none"
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20">
            <line x1="10" y1="2" x2="10" y2="8" stroke="#9d7cce" strokeWidth="1" opacity="0.6" />
            <line x1="10" y1="12" x2="10" y2="18" stroke="#9d7cce" strokeWidth="1" opacity="0.6" />
            <line x1="2" y1="10" x2="8" y2="10" stroke="#9d7cce" strokeWidth="1" opacity="0.6" />
            <line x1="12" y1="10" x2="18" y2="10" stroke="#9d7cce" strokeWidth="1" opacity="0.6" />
            <circle cx="10" cy="10" r="1.5" fill="none" stroke="#9d7cce" strokeWidth="1" opacity="0.4" />
          </svg>
        </div>
      )}
      
      {/* Helper Key Hint - always visible in game */}
      {gameStarted && !isPaused && !isAddMenuVisible && !showInstructions && !isLottieMenuVisible && !showKeyHelper && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          backgroundColor: "rgba(10,10,10,0.7)",
          padding: "8px 14px",
          borderRadius: "2px",
          border: "1px solid rgba(157, 124, 206, 0.15)",
          fontSize: "10px",
          color: "#666",
          fontFamily: "monospace",
          zIndex: 2,
          pointerEvents: "none",
          userSelect: "none",
          animation: "pulse 2s ease-in-out infinite"
        }}>
          <span style={{ color: "#9d7cce" }}>K</span> for keys
        </div>
      )}
      </div>
    </div>
  );
}

function View(props) {
  const folderPath = props.folderPath || outerFolderPath;
  const [modules, setModules] = dc.useState(null);

  dc.useEffect(() => {
    Promise.all([
      dc.require(folderPath + "/src/utils/webglHelpers.js"),
      dc.require(folderPath + "/src/utils/inputListeners.js"),
      dc.require(folderPath + "/src/utils/gameHelpers.js")
    ]).then(([webgl, input, game]) => {
      setModules({ webgl, input, game });
    }).catch(err => {
      console.error("Failed to load Game Engine modules:", err);
    });
  }, [folderPath]);

  if (!modules) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9d7cce', fontFamily: 'monospace' }}>
        <dc.Icon icon="loader-2" style={{ animation: "spin 1s linear infinite", marginRight: "8px" }} />
        Loading engine modules...
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <WorldView {...props} webgl={modules.webgl} input={modules.input} game={modules.game} folderPath={folderPath} />;
}

return { View };

