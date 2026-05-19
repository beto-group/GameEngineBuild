const activeFile = dc.resolvePath("GAME ENGINE BUILD") || "_RESOURCES/DATACORE/_DONE/GAME ENGINE BUILD/GAME ENGINE BUILD";
const outerFolderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));

let helpers = null;
async function getHelpers() {
  if (!helpers) {
    helpers = await dc.require(outerFolderPath + "/src/utils/webglHelpers.js");
  }
  return helpers;
}

/** Spawns a new object in front of the character. */
function spawnObject(type, characterState, cameraState, addedObjects) {
  const charPos = characterState.current.pos;
  const forward = {
    x: Math.sin(cameraState.current.yaw),
    z: Math.cos(cameraState.current.yaw)
  };
  const spawnOffset = 2;
  let baseOffset;
  if (type === "pyramid") {
    baseOffset = 1.0;
  } else if (type === "pane") {
    baseOffset = 0.5;
  } else {
    baseOffset = 0.5;
  }
  
  const newObject = {
    type,
    pos: {
      x: charPos.x + forward.x * spawnOffset,
      y: baseOffset,
      z: charPos.z + forward.z * spawnOffset
    },
    rotation: 0,
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    baseYOffset: baseOffset,
    lottieSrc: null,
    texture: null,
    viewLoaded: false,
    viewContainer: null
  };
  addedObjects.current.push(newObject);
}

/** Helper that returns a canvas element from a DOM node. */
async function getSourceCanvas(viewContainer) {
  if (!viewContainer) return null;
  
  if (viewContainer instanceof HTMLCanvasElement) {
    return viewContainer;
  }
  
  const existingCanvas = viewContainer.querySelector('canvas');
  if (existingCanvas) return existingCanvas;
  
  if (window.html2canvas) {
    try {
      const capturedCanvas = await window.html2canvas(viewContainer);
      return capturedCanvas;
    } catch (err) {
      console.error("html2canvas capture failed:", err);
      return null;
    }
  } else {
    console.error("html2canvas library is not loaded.");
    return null;
  }
}

async function updateViewTexture(gl, obj) {
  const { isPowerOf2 } = await getHelpers();
  const sourceCanvas = obj.viewContainer.querySelector("canvas");

  if (!sourceCanvas) {
    console.error("updateViewTexture: No valid canvas element found within the view container.");
    return;
  }
  
  gl.bindTexture(gl.TEXTURE_2D, obj.texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  try {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sourceCanvas
    );
  } catch (err) {
    console.error("updateViewTexture: texImage2D error:", err);
    return;
  }

  if (isPowerOf2(sourceCanvas.width) && isPowerOf2(sourceCanvas.height)) {
    gl.generateMipmap(gl.TEXTURE_2D);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
}

function isLottieMedia(url) {
  if (!url) return false;
  const baseUrl = url.split("?")[0];
  return baseUrl.toLowerCase().endsWith(".json");
}

async function updateLottieTexture(gl, obj) {
  const { isPowerOf2 } = await getHelpers();
  if (!obj.offscreenCanvas) return;
  gl.bindTexture(gl.TEXTURE_2D, obj.texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, obj.offscreenCanvas);
  
  if (isPowerOf2(obj.offscreenCanvas.width) && isPowerOf2(obj.offscreenCanvas.height)) {
    gl.generateMipmap(gl.TEXTURE_2D);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
}

return {
  spawnObject,
  getSourceCanvas,
  updateViewTexture,
  isLottieMedia,
  updateLottieTexture
};
