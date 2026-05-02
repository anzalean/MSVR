'use strict';

let gl;
let surface;
let shProgram;
let shProgramWebCam;
let spaceball;
let stereoCam;

let iTextureWebCam = -1;
let video;

// Orientation matrix derived from accelerometer
let orientationMatrix = null;
let ws = null;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.iAttribVertex = -1;
    this.iAttribTexCoord = -1;
    this.iColor = -1;
    this.iModelViewMatrix = -1;
    this.iProjectionMatrix = -1;
    this.iSampler = -1;
    this.Use = function() { gl.useProgram(this.prog); }
}

/**
 * Build a tilt-only rotation matrix from a raw accelerometer vector.
 * The accelerometer gives gravity direction in device frame: [ax, ay, az].
 * We construct an orthonormal frame whose Y-axis aligns with the gravity vector,
 * which gives a "tilting" orientation (no yaw/azimuth info from accelerometer).
 *
 * Result is a column-major Float32Array(16) ready for gl.uniformMatrix4fv.
 */
function rotationMatrixFromAccelerometer(ax, ay, az) {
    // Normalize gravity vector → becomes the new "up" (Y) axis
    const len = Math.sqrt(ax*ax + ay*ay + az*az);
    if (len < 0.0001) return orientationMatrix || m4.identity();

    const gx = ax / len;
    const gy = ay / len;
    const gz = az / len;

    // Choose a reference vector not parallel to gravity
    // Use world Z [0,0,1] unless gravity is nearly parallel to it
    let rx = 0, ry = 0, rz = 1;
    if (Math.abs(gz) > 0.9) { rx = 1; ry = 0; rz = 0; }

    // X axis = cross(ref, gravity), then normalize
    let xx = ry*gz - rz*gy;
    let xy = rz*gx - rx*gz;
    let xz = rx*gy - ry*gx;
    const xlen = Math.sqrt(xx*xx + xy*xy + xz*xz);
    xx /= xlen; xy /= xlen; xz /= xlen;

    // Z axis = cross(gravity, X), then normalize (already unit but keep safe)
    let zx = gy*xz - gz*xy;
    let zy = gz*xx - gx*xz;
    let zz = gx*xy - gy*xx;
    const zlen = Math.sqrt(zx*zx + zy*zy + zz*zz);
    zx /= zlen; zy /= zlen; zz /= zlen;

    // Column-major 4x4:  columns are X, gravity(Y), Z
    const m = new Float32Array(16);
    m[0]=xx;  m[1]=xy;  m[2]=xz;  m[3]=0;
    m[4]=gx;  m[5]=gy;  m[6]=gz;  m[7]=0;
    m[8]=zx;  m[9]=zy;  m[10]=zz; m[11]=0;
    m[12]=0;  m[13]=0;  m[14]=0;  m[15]=1;
    return m;
}

function connectWebSocket(ip, port) {
    const url = `ws://${ip}:${port}/sensor/connect?type=android.sensor.accelerometer`;
    updateWsStatus('Підключення…', '#fdbb2d');

    if (ws) { ws.onclose = null; ws.close(); }

    ws = new WebSocket(url);

    ws.onopen  = () => updateWsStatus('Підключено ✓', '#4cff72');

    ws.onmessage = (evt) => {
        try {
            const data = JSON.parse(evt.data);
            // Sensor Server: { values: [ax, ay, az] }  (m/s²)
            if (data.values && data.values.length >= 3) {
                orientationMatrix = rotationMatrixFromAccelerometer(
                    data.values[0], data.values[1], data.values[2]
                );
            }
        } catch(e) { /* ignore */ }
    };

    ws.onerror  = () => { updateWsStatus('Помилка – перевірте IP/порт', '#ff4c4c'); };
    ws.onclose  = () => { updateWsStatus('Відключено', '#aaa'); };
}

function updateWsStatus(text, color) {
    const el = document.getElementById('wsStatus');
    if (el) { el.textContent = text; el.style.color = color; }
}

function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }
    shProgramWebCam.Use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);
    gl.uniform1i(shProgramWebCam.iSampler, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    shProgram.Use();

    // Use accelerometer-derived matrix when available, otherwise trackball
    let modelView = orientationMatrix ? orientationMatrix : spaceball.getViewMatrix();

    let rotateToPointZero  = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, -1, -12);

    const colorPolygon = new Float32Array([0.3, 0.6, 0.6, 0.9]);
    const colorEdge    = new Float32Array([0.8, 1.0, 1.0, 0.8]);

    // LEFT EYE (Red)
    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4.translation(stereoCam.eyeSeparation/2, 0, 0);
    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0);
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 0);
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon);
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge);
    surface.DrawWireframe();

    // RIGHT EYE (Cyan)
    gl.clear(gl.DEPTH_BUFFER_BIT);
    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4.translation(-stereoCam.eyeSeparation/2, 0, 0);
    matAccum0 = m4.multiply(rotateToPointZero, modelView);
    matAccum1 = m4.multiply(translateRightEye, matAccum0);
    matAccum2 = m4.multiply(translateToPointZero, matAccum1);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2);

    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, colorPolygon);
    surface.Draw();
    gl.uniform4fv(shProgram.iColor, colorEdge);
    surface.DrawWireframe();

    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();
    shProgram.iAttribVertex     = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix  = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor            = gl.getUniformLocation(prog, "color");

    let progWebCam = createProgram(gl, vertexShaderWebCamSource, fragmentShaderWebCamSource);
    shProgramWebCam = new ShaderProgram('WebCam', progWebCam);
    shProgramWebCam.Use();
    shProgramWebCam.iSampler = gl.getUniformLocation(progWebCam, "video");

    surface = new Model('CyberShoe');
    surface.CreateShoeSurface(60, 30);

    stereoCam = new StereoCamera(0.7, 14.0, 1.3, 0.4, 8.0, 20.0);

    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS))
        throw new Error("Error in vertex shader: " + gl.getShaderInfoLog(vsh));

    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS))
        throw new Error("Error in fragment shader: " + gl.getShaderInfoLog(fsh));

    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error("Link error: " + gl.getProgramInfoLog(prog));
    return prog;
}

function updateParameters() {
    stereoCam.eyeSeparation        = parseFloat(document.getElementById('eyeSeparation').value);
    stereoCam.FOV                  = parseFloat(document.getElementById('fov').value);
    stereoCam.nearClippingDistance = parseFloat(document.getElementById('nearClipping').value);
    stereoCam.convergence          = parseFloat(document.getElementById('convergence').value);
    draw();
}

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl2");
        if (!gl) throw "Browser does not support WebGL";
    } catch(e) {
        document.querySelector("#canvas-holder").innerHTML =
            "<p style='color:#ff00c8;padding:20px'>⚠️ Помилка WebGL контексту</p>";
        return;
    }
    try { initGL(); }
    catch(e) {
        document.querySelector("#canvas-holder").innerHTML =
            "<p style='color:#ff00c8;padding:20px'>⚠️ Помилка ініціалізації WebGL: " + e + "</p>";
        return;
    }

    video = document.createElement('video');
    video.autoplay = true;
    navigator.mediaDevices.getUserMedia({video: true})
        .then(stream => {
            video.srcObject = stream;
            let settings = stream.getVideoTracks()[0].getSettings();
            iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);
            video.play();
        })
        .catch(err => console.log(err.name + ': ' + err.message));

    setInterval(draw, 50);
    spaceball = new TrackballRotator(canvas, draw, 0);
    draw();
}

function deg2rad(angle) { return angle * Math.PI / 180; }