const activeFile = dc.resolvePath("GAME ENGINE BUILD") || "_RESOURCES/DATACORE/_DONE/GAME ENGINE BUILD/GAME ENGINE BUILD";
const outerFolderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));

let helpers = null;
async function getHelpers() {
  if (!helpers) {
    helpers = await dc.require(outerFolderPath + "/src/utils/webglHelpers.js");
  }
  return helpers;
}

function registerKeyListeners(canvasRef, gameStarted, setIsAddMenuVisible, setShowInstructions, setShowKeyHelper, setEnableTrails, setEnableWireframe, setShowStats, setTimeOfDay, keysPressed, draggingPyramid, resumeGame, draggingCloneRef, clonedObjectRef, setIsDraggingClone, setClonedObject, vpMatricesRef, eyePosRef, addedObjects, selectedObjectIndex) {
  if (!gameStarted) return;
  const handleKeyDown = async (e) => {
    if (document.pointerLockElement !== canvasRef.current) return;
    const { getRayFromCamera, rayIntersectAABB } = await getHelpers();

    if (e.key.toLowerCase() === "i") {
      setIsAddMenuVisible((prev) => {
        if (prev) {
          resumeGame();
          return false;
        } else {
          document.exitPointerLock();
          return true;
        }
      });
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === "h") {
      setShowInstructions((prev) => {
        if (prev) {
          resumeGame();
          return false;
        } else {
          document.exitPointerLock();
          return true;
        }
      });
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === "k") {
      setShowKeyHelper(true);
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === "t") {
      setEnableTrails((prev) => !prev);
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === "g") {
      setEnableWireframe((prev) => !prev);
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === "f") {
      setShowStats((prev) => !prev);
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === "n") {
      setTimeOfDay((prev) => (prev + 0.1) % 1);
      e.preventDefault();
      return;
    }
    
    if (e.key === "Backspace" || e.key === "Delete") {
      const canvas = canvasRef.current;
      if (!canvas || !vpMatricesRef.current || !eyePosRef.current) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = rect.width / 2;
      const mouseY = rect.height / 2;
      
      const ray = getRayFromCamera(mouseX, mouseY, vpMatricesRef.current, eyePosRef.current);
      let closestObjIndex = null;
      let closestDist = Infinity;
      
      addedObjects.current.forEach((obj, idx) => {
        const dist = rayIntersectAABB(ray, obj.pos, obj.scale || { x: 1, y: 1, z: 1 });
        if (dist !== null && dist < closestDist) {
          closestDist = dist;
          closestObjIndex = idx;
        }
      });
      
      if (closestObjIndex !== null) {
        addedObjects.current.splice(closestObjIndex, 1);
        selectedObjectIndex.current = null;
        e.preventDefault();
        return;
      }
    }
    
    if (e.key.toLowerCase() === "c" && !draggingCloneRef.current) {
      const canvas = canvasRef.current;
      if (!canvas || !vpMatricesRef.current) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = rect.width / 2;
      const mouseY = rect.height / 2;
      
      const ray = getRayFromCamera(mouseX, mouseY, vpMatricesRef.current, eyePosRef.current);
      let closestObj = null;
      let closestDist = Infinity;
      
      addedObjects.current.forEach((obj, idx) => {
        const dist = rayIntersectAABB(ray, obj.pos, obj.scale || { x: 1, y: 1, z: 1 });
        if (dist !== null && dist < closestDist) {
          closestDist = dist;
          closestObj = { ...obj, index: idx };
        }
      });
      
      if (closestObj) {
        const cloned = {
          ...closestObj,
          pos: { ...closestObj.pos },
          rotation: closestObj.rotation || 0,
          scale: { ...closestObj.scale }
        };
        delete cloned.index;
        
        draggingCloneRef.current = true;
        clonedObjectRef.current = cloned;
        setIsDraggingClone(true);
        setClonedObject(cloned);
        
        e.preventDefault();
        return;
      }
    }
    if (e.key === " " || e.key === "Space") {
      e.preventDefault();
    }
    keysPressed.current[e.key] = true;
    if (e.key === "Shift" || e.key === "ShiftLeft" || e.key === "ShiftRight") {
      keysPressed.current["Shift"] = true;
      keysPressed.current["ShiftLeft"] = true;
      keysPressed.current["ShiftRight"] = true;
    }
  };

  const handleKeyUp = (e) => {
    keysPressed.current[e.key] = false;
    if (e.key === "Shift" || e.key === "ShiftLeft" || e.key === "ShiftRight") {
      keysPressed.current["Shift"] = false;
      keysPressed.current["ShiftLeft"] = false;
      keysPressed.current["ShiftRight"] = false;
    }
    if (e.key === "Meta") {
      if (draggingPyramid) draggingPyramid.current = false;
    }
    if (e.key.toLowerCase() === "k") {
      setShowKeyHelper(false);
    }
    if (e.key.toLowerCase() === "c" && draggingCloneRef.current && clonedObjectRef.current) {
      addedObjects.current.push({ ...clonedObjectRef.current });
      draggingCloneRef.current = false;
      clonedObjectRef.current = null;
      setIsDraggingClone(false);
      setClonedObject(null);
      e.preventDefault();
    }
  };
  
  const handleBlur = () => {
    keysPressed.current = {};
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleBlur);
  };
}

function registerPointerLockListeners(canvas, setIsPaused, pausedRef, keysPressed) {
  const pointerLockChange = () => {
    if (document.pointerLockElement === canvas) {
      pausedRef.current = false;
      setIsPaused(false);
      console.log("Pointer locked. Resuming game.");
    } else {
      pausedRef.current = true;
      setIsPaused(true);
      keysPressed.current = {};
      console.log("Pointer unlocked. Game paused.");
    }
  };
  document.addEventListener("pointerlockchange", pointerLockChange);
  return () => document.removeEventListener("pointerlockchange", pointerLockChange);
}

function registerMouseMoveListener(canvas, keysPressed, cameraState, mouseSensitivity, characterState, addedObjects, selectedObjectIndex, objectDragSensitivity, draggingCloneRef, clonedObjectRef, vpMatricesRef, eyePosRef) {
  const handleMouseMove = async (e) => {
    if (document.pointerLockElement === canvas) {
      const { getRayFromCamera } = await getHelpers();

      if (draggingCloneRef.current && clonedObjectRef.current) {
        const canvasEl = e.target;
        const rect = canvasEl.getBoundingClientRect();
        const mouseX = rect.width / 2;
        const mouseY = rect.height / 2;
        
        if (vpMatricesRef.current && eyePosRef.current) {
          const ray = getRayFromCamera(mouseX, mouseY, vpMatricesRef.current, eyePosRef.current);
          const distance = 5;
          clonedObjectRef.current.pos.x = eyePosRef.current.x + ray.direction.x * distance;
          clonedObjectRef.current.pos.y = eyePosRef.current.y + ray.direction.y * distance;
          clonedObjectRef.current.pos.z = eyePosRef.current.z + ray.direction.z * distance;
        }
        return;
      }
      
      if (keysPressed.current["Meta"]) {
        if (selectedObjectIndex.current === null) {
          const charPos = characterState.current.pos;
          let foundIndex = null;
          let minAngle = Infinity;
          const cameraYaw = cameraState.current.yaw;
          const cameraForward = { x: Math.sin(cameraYaw), z: Math.cos(cameraYaw) };
          addedObjects.current.forEach((obj, index) => {
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
          });
          if (foundIndex !== null) {
            selectedObjectIndex.current = foundIndex;
          }
        }
        if (selectedObjectIndex.current !== null) {
          let obj = addedObjects.current[selectedObjectIndex.current];
          if (keysPressed.current["Meta"] && keysPressed.current["Control"]) {
            const scalingSensitivityX = 0.01;
            const scalingSensitivityY = 0.01;
            obj.scale.x = Math.max(0.1, obj.scale.x + e.movementX * scalingSensitivityX);
            obj.scale.y = Math.max(0.1, obj.scale.y + e.movementY * scalingSensitivityY);
            if (typeof obj.baseYOffset === "number") {
                obj.pos.y = obj.baseYOffset * obj.scale.y;
            }
          } else if (keysPressed.current["Meta"] && keysPressed.current["Alt"]) {
            const rotationSensitivity = 0.01;
            obj.rotation = (obj.rotation || 0) - e.movementX * rotationSensitivity;
          } else if (keysPressed.current["Meta"]) {
            const yaw = cameraState.current.yaw;
            const cameraRight = { x: Math.cos(yaw), z: -Math.sin(yaw) };
            const cameraForward = { x: Math.sin(yaw), z: Math.cos(yaw) };
            const deltaX = e.movementX * objectDragSensitivity;
            const deltaY = e.movementY * objectDragSensitivity;
            obj.pos.x -= cameraRight.x * deltaX + cameraForward.x * deltaY;
            obj.pos.z -= cameraRight.z * deltaX + cameraForward.z * deltaY;
          }
        }
      } else {
        selectedObjectIndex.current = null;
        cameraState.current.yaw   -= e.movementX * mouseSensitivity;
        cameraState.current.pitch -= e.movementY * mouseSensitivity;
        const maxPitch = 80 * Math.PI / 180;
        if (cameraState.current.pitch > maxPitch) cameraState.current.pitch = maxPitch;
        if (cameraState.current.pitch < -maxPitch) cameraState.current.pitch = -maxPitch;
      }
    }
  };
  document.addEventListener("mousemove", handleMouseMove);
  return () => document.removeEventListener("mousemove", handleMouseMove);
}

function registerTouchAndWheelListeners(canvas, fovRef, keysPressed, selectedObjectIndex, addedObjects) {
  let initialPinchDistance = null;
  const touchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance = Math.hypot(dx, dy);
    }
  };
  const touchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.hypot(dx, dy);
      const delta = currentDistance - initialPinchDistance;
      fovRef.current += -delta * 0.005;
      const minFov = 20 * Math.PI / 180;
      const maxFov = 80 * Math.PI / 180;
      if (fovRef.current < minFov) fovRef.current = minFov;
      if (fovRef.current > maxFov) fovRef.current = maxFov;
      initialPinchDistance = currentDistance;
      e.preventDefault();
    }
  };
  const touchEnd = (e) => {
    if (e.touches.length < 2) initialPinchDistance = null;
  };

  const wheelHandler = (e) => {
    if (e.ctrlKey && keysPressed.current["Meta"] && keysPressed.current["Control"]) {
      e.preventDefault();
      const currentIndex = selectedObjectIndex.current;
      if (currentIndex !== null) {
        const obj = addedObjects.current[currentIndex];
        const scalingSensitivityZ = 0.01;
        obj.scale.z = Math.max(0.1, obj.scale.z - e.deltaY * scalingSensitivityZ);
      }
    } else if (e.ctrlKey) {
      fovRef.current += e.deltaY * 0.001;
      const minFov = 20 * Math.PI / 180;
      const maxFov = 80 * Math.PI / 180;
      if (fovRef.current < minFov) fovRef.current = minFov;
      if (fovRef.current > maxFov) fovRef.current = maxFov;
      e.preventDefault();
    }
  };

  canvas.addEventListener("touchstart", touchStart);
  canvas.addEventListener("touchmove", touchMove);
  canvas.addEventListener("touchend", touchEnd);
  canvas.addEventListener("wheel", wheelHandler);

  return () => {
    canvas.removeEventListener("touchstart", touchStart);
    canvas.removeEventListener("touchmove", touchMove);
    canvas.removeEventListener("touchend", touchEnd);
    canvas.removeEventListener("wheel", wheelHandler);
  };
}

return {
  registerKeyListeners,
  registerPointerLockListeners,
  registerMouseMoveListener,
  registerTouchAndWheelListeners
};
