// ====================
// DOM TRAVERSAL UTILITIES
// ====================

/** Finds the nearest ancestor element with the specified class name. */
function findNearestAncestorWithClass(element, className) {
  if (!element) return null;
  let current = element.parentNode;
  while (current) {
    if (current.classList && current.classList.contains(className)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

/** Finds a direct child of parent with the specified class name. */
function findDirectChildByClass(parent, className) {
  if (!parent) return null;
  for (const child of parent.children) {
    if (child.classList && child.classList.contains(className)) {
      return child;
    }
  }
  return null;
}

// ====================
// HELPER FUNCTIONS
// ====================

/** Creates a rotation matrix about the Y-axis. */
function rotationYMatrix(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, 0,  s, 0,
    0, 1,  0, 0,
   -s, 0,  c, 0,
    0, 0,  0, 1,
  ]);
}

/** Creates a scale matrix for uniform/nonuniform scaling. */
function scaleMatrix(s) {
  if (typeof s === 'number') {
    return new Float32Array([
      s, 0, 0, 0,
      0, s, 0, 0,
      0, 0, s, 0,
      0, 0, 0, 1
    ]);
  } else {
    return new Float32Array([
      s.x,  0,    0,    0,
       0,  s.y,   0,    0,
       0,   0,  s.z,   0,
       0,   0,   0,    1
    ]);
  }
}

/** Multiplies two 4x4 matrices (a * b). */
function multiply4x4(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[i + k * 4] * b[k + j * 4];
      }
      out[i + j * 4] = sum;
    }
  }
  return out;
}

/** Creates a translation matrix from x, y, z components. */
function translationMatrix(tx, ty, tz) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1
  ]);
}

/** Creates a projection matrix. */
function makeProjectionMatrix(width, height, fovRef) {
  const fov = fovRef.current;
  const aspect = width / height;
  const zNear = 0.1;
  const zFar = 100.0;
  const f = 1.0 / Math.tan(fov / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (zFar+zNear)/(zNear-zFar); out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = (2*zFar*zNear)/(zNear-zFar); out[15] = 0;
  return out;
}

/** Creates a "look-at" view matrix. */
function lookAtVec(eye, center, up) {
  const f = {
    x: center.x - eye.x,
    y: center.y - eye.y,
    z: center.z - eye.z
  };
  const fMag = Math.hypot(f.x, f.y, f.z);
  f.x /= fMag; f.y /= fMag; f.z /= fMag;
  const s = {
    x: f.y * up.z - f.z * up.y,
    y: f.z * up.x - f.x * up.z,
    z: f.x * up.y - f.y * up.x
  };
  const sMag = Math.hypot(s.x, s.y, s.z);
  s.x /= sMag; s.y /= sMag; s.z /= sMag;
  const u = {
    x: s.y * f.z - s.z * f.y,
    y: s.z * f.x - s.x * f.z,
    z: s.x * f.y - s.y * f.x
  };
  const out = new Float32Array(16);
  out[0] = s.x;  out[1] = u.x;  out[2] = -f.x; out[3] = 0;
  out[4] = s.y;  out[5] = u.y;  out[6] = -f.y; out[7] = 0;
  out[8] = s.z;  out[9] = u.z;  out[10] = -f.z; out[11] = 0;
  out[12] = -(s.x * eye.x + s.y * eye.y + s.z * eye.z);
  out[13] = -(u.x * eye.x + u.y * eye.y + u.z * eye.z);
  out[14] =  (f.x * eye.x + f.y * eye.y + f.z * eye.z);
  out[15] = 1;
  return out;
}

/** Creates and compiles a shader. */
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Creates and links a shader program. */
function createProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** Helper: Computes the final model transformation for an object */
function computeFinalModel(obj) {
  const modelMatrix = translationMatrix(obj.pos.x, obj.pos.y, obj.pos.z);
  const rotMatrix = rotationYMatrix(obj.rotation || 0);
  const scaleMat = scaleMatrix(obj.scale || 1.0);
  const modelRS = multiply4x4(rotMatrix, scaleMat);
  return multiply4x4(modelMatrix, modelRS);
}

/** Multiplies a 4x4 matrix by a 4D vector. */
function multiplyMatVec(mat, vec) {
  const result = [0, 0, 0, 0];
  for (let row = 0; row < 4; row++) {
    result[row] =
      vec[0] * mat[row + 0] +
      vec[1] * mat[row + 4] +
      vec[2] * mat[row + 8] +
      vec[3] * mat[row + 12];
  }
  return result;
}

/**
 * Given a world-space position (an array [x,y,z]), the current view and projection matrices,
 * and canvas dimensions, compute its screen coordinates.
 */
function computeScreenPosition(worldPos, viewMatrix, projMatrix, canvasWidth, canvasHeight) {
  const pos4 = [worldPos[0], worldPos[1], worldPos[2], 1];
  const viewPos = multiplyMatVec(viewMatrix, pos4);
  const clipPos = multiplyMatVec(projMatrix, viewPos);
  const ndc = clipPos.map((c, i) => (i < 3 && clipPos[3] !== 0 ? c / clipPos[3] : c));
  const screenX = (ndc[0] * 0.5 + 0.5) * canvasWidth;
  const screenY = (1 - (ndc[1] * 0.5 + 0.5)) * canvasHeight;
  return { left: screenX, top: screenY };
}

/** Loads a media file from the vault and returns its resource URL. */
async function requireMediaFile(path) {
  const mediaFile = await app.vault.getFileByPath(path);
  return app.vault.getResourcePath(mediaFile);
}

/** Determines if a value is a power of 2. */
function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

/** Loads an image as a WebGL texture. */
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const level = 0,
    internalFormat = gl.RGBA,
    width = 1,
    height = 1,
    border = 0,
    srcFormat = gl.RGBA,
    srcType = gl.UNSIGNED_BYTE;
  const placeholderPixel = new Uint8Array([255, 255, 255, 255]); // white pixel
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
    width, height, border, srcFormat, srcType, placeholderPixel);

  const image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
      srcFormat, srcType, image);
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
  image.src = url;
  return texture;
}

/** Creates a ray from camera through screen coordinates for raycasting */
function getRayFromCamera(screenX, screenY, vpMatrices, eyePos) {
  const { viewMatrix, projectionMatrix, width, height } = vpMatrices;
  
  const ndcX = (screenX / width) * 2 - 1;
  const ndcY = 1 - (screenY / height) * 2;
  
  const rayClip = [ndcX, ndcY, -1.0, 1.0];
  
  const projInverse = invertMatrix4x4(projectionMatrix);
  const rayEye = multiplyMatVec(projInverse, rayClip);
  rayEye[2] = -1.0;
  rayEye[3] = 0.0;
  
  const viewInverse = invertMatrix4x4(viewMatrix);
  const rayWorld = multiplyMatVec(viewInverse, rayEye);
  
  const length = Math.sqrt(rayWorld[0] * rayWorld[0] + rayWorld[1] * rayWorld[1] + rayWorld[2] * rayWorld[2]);
  const direction = {
    x: rayWorld[0] / length,
    y: rayWorld[1] / length,
    z: rayWorld[2] / length
  };
  
  return {
    origin: eyePos,
    direction: direction
  };
}

/** Ray-AABB intersection test - returns distance or null if no hit */
function rayIntersectAABB(ray, objPos, objScale) {
  const halfScale = { x: objScale.x / 2, y: objScale.y / 2, z: objScale.z / 2 };
  const min = { x: objPos.x - halfScale.x, y: objPos.y - halfScale.y, z: objPos.z - halfScale.z };
  const max = { x: objPos.x + halfScale.x, y: objPos.y + halfScale.y, z: objPos.z + halfScale.z };
  
  const invDirX = 1.0 / ray.direction.x;
  const invDirY = 1.0 / ray.direction.y;
  const invDirZ = 1.0 / ray.direction.z;
  
  const t1 = (min.x - ray.origin.x) * invDirX;
  const t2 = (max.x - ray.origin.x) * invDirX;
  const t3 = (min.y - ray.origin.y) * invDirY;
  const t4 = (max.y - ray.origin.y) * invDirY;
  const t5 = (min.z - ray.origin.z) * invDirZ;
  const t6 = (max.z - ray.origin.z) * invDirZ;
  
  const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
  const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
  
  if (tmax < 0 || tmin > tmax) {
    return null;
  }
  
  return tmin > 0 ? tmin : tmax;
}

/** Inverts a 4x4 matrix (needed for raycasting) */
function invertMatrix4x4(m) {
  const inv = [];
  
  inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
  inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
  inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
  inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
  inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
  inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
  inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
  inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
  inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
  inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
  inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
  inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
  inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
  inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
  inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
  inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];
  
  const det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
  
  if (det === 0) {
    return m;
  }
  
  const invDet = 1.0 / det;
  return inv.map(v => v * invDet);
}

/** Initializes WebGL context, shaders, and geometry (with UV buffers) */
function initWebGL(canvas, fovRef) {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) {
    console.error("WebGL not supported.");
    return null;
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uModelViewMatrix;
    
    varying highp vec2 vTextureCoord;
    
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;
  const fsSource = `
    precision mediump float;
    
    varying highp vec2 vTextureCoord;
    uniform bool uUseTexture;
    uniform sampler2D uSampler;
    uniform vec4 uColor;
    
    void main(void) {
      if (uUseTexture) {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
      } else {
        gl_FragColor = uColor;
      }
    }
  `;
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vertexShader || !fragmentShader) return null;
  const shaderProgram = createProgram(gl, vertexShader, fragmentShader);
  if (!shaderProgram) return null;
  gl.useProgram(shaderProgram);

  const aVertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(aVertexPosition);
  const aTextureCoord = gl.getAttribLocation(shaderProgram, "aTextureCoord");
  gl.enableVertexAttribArray(aTextureCoord);

  const uProjectionMatrix = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
  const uModelViewMatrix = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");
  const uColor = gl.getUniformLocation(shaderProgram, "uColor");
  const uSampler = gl.getUniformLocation(shaderProgram, "uSampler");
  const uUseTexture = gl.getUniformLocation(shaderProgram, "uUseTexture");

  const buffers = {};

  // Cube Buffer
  const cubePositions = new Float32Array([
    // Front face
    -0.5, -0.5,  0.5,
     0.5, -0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5, -0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5,  0.5,  0.5,
    // Back face
    -0.5, -0.5, -0.5,
    -0.5,  0.5, -0.5,
     0.5,  0.5, -0.5,
    -0.5, -0.5, -0.5,
     0.5,  0.5, -0.5,
     0.5, -0.5, -0.5,
    // Top face
    -0.5,  0.5, -0.5,
    -0.5,  0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5,  0.5, -0.5,
     0.5,  0.5,  0.5,
     0.5,  0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,
     0.5, -0.5, -0.5,
     0.5, -0.5,  0.5,
    -0.5, -0.5, -0.5,
     0.5, -0.5,  0.5,
    -0.5, -0.5,  0.5,
    // Right face
     0.5, -0.5, -0.5,
     0.5,  0.5, -0.5,
     0.5,  0.5,  0.5,
     0.5, -0.5, -0.5,
     0.5,  0.5,  0.5,
     0.5, -0.5,  0.5,
    // Left face
    -0.5, -0.5, -0.5,
    -0.5, -0.5,  0.5,
    -0.5,  0.5,  0.5,
    -0.5, -0.5, -0.5,
    -0.5,  0.5,  0.5,
    -0.5,  0.5, -0.5,
  ]);
  buffers.cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW);

  const faceUV = [0,0, 1,0, 1,1, 0,0, 1,1, 0,1];
  const cubeUVs = new Float32Array([
    ...faceUV, ...faceUV, ...faceUV, ...faceUV, ...faceUV, ...faceUV
  ]);
  buffers.cubeUVBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.cubeUVBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cubeUVs, gl.STATIC_DRAW);

  // Pyramid Buffer
  const pyramidPositions = new Float32Array([
    0.0,  1.0,  0.0,   -1.0, -1.0, -1.0,    1.0, -1.0, -1.0,
    0.0,  1.0,  0.0,    1.0, -1.0, -1.0,    1.0, -1.0,  1.0,
    0.0,  1.0,  0.0,    1.0, -1.0,  1.0,   -1.0, -1.0,  1.0,
    0.0,  1.0,  0.0,   -1.0, -1.0,  1.0,   -1.0, -1.0, -1.0,
    -1.0, -1.0, -1.0,    1.0, -1.0, -1.0,    1.0, -1.0,  1.0,
    -1.0, -1.0, -1.0,    1.0, -1.0,  1.0,   -1.0, -1.0,  1.0,
  ]);
  buffers.pyramidBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pyramidBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pyramidPositions, gl.STATIC_DRAW);

  const sideUV = [0.5,1, 0,0, 1,0];
  const baseUV1 = [0,0, 1,0, 1,1];
  const baseUV2 = [0,0, 1,1, 0,1];
  const pyramidUVs = new Float32Array([
    ...sideUV, ...sideUV, ...sideUV, ...sideUV, ...baseUV1, ...baseUV2
  ]);
  buffers.pyramidUVBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pyramidUVBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pyramidUVs, gl.STATIC_DRAW);

  // Pane Buffer
  const panePositions = new Float32Array([
    -0.5, -0.5, 0.0,
     0.5, -0.5, 0.0,
     0.5,  0.5, 0.0,
    -0.5, -0.5, 0.0,
     0.5,  0.5, 0.0,
    -0.5,  0.5, 0.0,
  ]);
  buffers.paneBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.paneBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, panePositions, gl.STATIC_DRAW);

  const paneUVs = new Float32Array([
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,
  ]);
  buffers.paneUVBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.paneUVBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, paneUVs, gl.STATIC_DRAW);

  // Ground Buffer
  const groundPositions = new Float32Array([
    -50, 0, -50,
     50, 0, -50,
     50, 0,  50,
    -50, 0, -50,
     50, 0,  50,
    -50, 0,  50,
  ]);
  buffers.groundBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.groundBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, groundPositions, gl.STATIC_DRAW);

  const groundUVs = new Float32Array([
    0,0, 1,0, 1,1,
    0,0, 1,1, 0,1,
  ]);
  buffers.groundUVBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.groundUVBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, groundUVs, gl.STATIC_DRAW);

  return {
    gl,
    shaderProgram,
    aVertexPosition,
    aTextureCoord,
    uProjectionMatrix,
    uModelViewMatrix,
    uColor,
    uSampler,
    uUseTexture,
    buffers
  };
}

return {
  findNearestAncestorWithClass,
  findDirectChildByClass,
  rotationYMatrix,
  scaleMatrix,
  multiply4x4,
  translationMatrix,
  makeProjectionMatrix,
  lookAtVec,
  createShader,
  createProgram,
  computeFinalModel,
  multiplyMatVec,
  computeScreenPosition,
  requireMediaFile,
  isPowerOf2,
  loadTexture,
  getRayFromCamera,
  rayIntersectAABB,
  invertMatrix4x4,
  initWebGL
};
