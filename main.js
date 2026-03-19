'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model (shoe)
let shProgram;                  // A shader program
let shProgramWebCam;            // A shader program for webcam
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

let iTextureWebCam = -1;

let video;

// Anti-plagiarism signature
const PROJECT_SIGNATURE = 'SHOE_STEREO_2024_v3.0_CYBER';

// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribTexCoord = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewMatrix = -1;
    this.iProjectionMatrix = -1;
    this.iSampler = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

/* Draws the shoe model */
function draw() { 
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // PATH ZERO: DRAW ZERO PARALLAX WEBCAM
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }

    shProgramWebCam.Use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, iTextureWebCam);
    gl.uniform1i(shProgramWebCam.iSampler, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // Switch to main shader for 3D model
    shProgram.Use();
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    // Position the shoe in the scene
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, -1, -12);

    // Cyber-style colors with neon effect
    const colorPolygon = new Float32Array([0.3, 0.6, 0.6, 0.9]);
    const colorEdge    = new Float32Array([0.8, 1.0, 1.0, 0.8]);

    // The FIRST PASS (for the left eye)
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

    // The SECOND PASS (for the right eye)
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

    // RESET specific params to their default state
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    // Create main shader program
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");

    // Create webcam shader program
    let progWebCam = createProgram(gl, vertexShaderWebCamSource, fragmentShaderWebCamSource);
    shProgramWebCam = new ShaderProgram('WebCam', progWebCam);
    shProgramWebCam.Use();

    shProgramWebCam.iSampler = gl.getUniformLocation(progWebCam, "video");

    // Create the shoe surface with correct formula
    surface = new Model('CyberShoe');
    // Create shoe with 60 length segments and 30 radial segments for smoother surface
    surface.CreateShoeSurface(60, 30);
    
    // Initialize stereo camera
    stereoCam = new StereoCamera(
        0.7,     // eyeSeparation
        14.0,    // convergence
        1.3,     // aspectRatio of canvas
        0.4,     // FOV (radians)
        8.0,     // nearClippingDistance
        20.0     // farClippingDistance
    );

    gl.enable(gl.DEPTH_TEST);
    
    // Log project signature (anti-plagiarism)
    console.log('Project initialized:', PROJECT_SIGNATURE);
    console.log('Cyber shoe model loaded with mathematical formula: z = u³/3 - v²/2');
}

/* Creates a program for use in the WebGL context gl */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function updateParameters() {
    const eyeSep = parseFloat(document.getElementById('eyeSeparation').value);
    const fov = parseFloat(document.getElementById('fov').value);
    const near = parseFloat(document.getElementById('nearClipping').value);
    const conv = parseFloat(document.getElementById('convergence').value);
    
    stereoCam.eyeSeparation = eyeSep;
    stereoCam.FOV = fov;
    stereoCam.nearClippingDistance = near;
    stereoCam.convergence = conv;
    
    draw();
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl2");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.querySelector("#canvas-holder").innerHTML =
            "<p style='color: #ff00c8; padding: 20px; text-shadow: 0 0 10px currentColor;'>⚠️ ERROR: Could not get WebGL context</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.querySelector("#canvas-holder").innerHTML =
            "<p style='color: #ff00c8; padding: 20px; text-shadow: 0 0 10px currentColor;'>⚠️ ERROR: Could not initialize WebGL: " + e + "</p>";
        return;
    }

    video = document.createElement('video');
    video.autoplay = true;

    // Connect to video stream
    let constraints = {video: true};
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;

        let track = stream.getVideoTracks()[0];
        let settings = track.getSettings();

        iTextureWebCam = CreateWebCamTexture(settings.width, settings.height);

        video.play();
    })
    .catch(function(err) {
        console.log(err.name + ": " + err.message);
        // Continue without webcam - it's optional
    });

    // Set up the rendering loop
    setInterval(draw, 50); // 20 fps

    spaceball = new TrackballRotator(canvas, draw, 0);

    // Initial draw
    draw();
}

function deg2rad(angle) {
    return angle * Math.PI / 180;
}