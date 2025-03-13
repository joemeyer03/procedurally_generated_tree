'use strict';

import * as vec3 from './vec3.js';
import * as mat4 from './mat42.js';

// Global variables that are set and used
// across the application
let adapter,
    context,
    colorAttachment,
    colorTextureView,
    colorTexture,
    depthTexture,
    code,
    shaderDesc,
    colorState,
    shaderModule,
    pipeline,
    renderPassDesc,
    commandEncoder,
    passEncoder,
    device,
    canvas,
    points,
    uvs,
    uniformValues,
    uniformBindGroup,
    indices,
    trans,
    scales,
    modelViewMatrix,
    imageSource,
    texture;
  
// buffers
let myVertexBuffer = null;
let myUvBuffer = null;
let myIndexBuffer = null;
let uniformBuffer;

// Other globals with default values
let anglesReset = [0.0, 0.0, 0.0, 0.0];
let angles = [0.0, 0.0, 0.0, 0.0];
let angleInc = 5.0;

let transReset = [0.0, -0.40, 0.5];
let translations = [0.0, -0.40, 0.5];
let transInc = 0.05;

let scaleReset = 1;
let scale = 1;
let scaleInc = 0.05;

// set up the shader var's
function setShaderInfo() {
    // set up the shader code var's
    code = document.getElementById('shader').innerText;
    shaderDesc = { code: code };
    shaderModule = device.createShaderModule(shaderDesc);
    colorState = {
        format: 'bgra8unorm'
    };

    // set up depth
    // depth shading will be needed for 3d objects in the future
    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
}

// Create a program with the appropriate vertex and fragment shaders
async function initProgram() {
    // Check to see if WebGPU can run
    if (!navigator.gpu) {
        console.error("WebGPU not supported on this browser.");
        return;
    }

    // get webgpu browser software layer for graphics device
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("No appropriate GPUAdapter found.");
        return;
    }

    // get the instantiation of webgpu on this device
    device = await adapter.requestDevice();
    if (!device) {
        console.error("Failed to request Device.");
        return;
    }

    // configure the canvas
    context = canvas.getContext('webgpu');
    const canvasConfig = {
        device: device,
        // format is the pixel format
        format: navigator.gpu.getPreferredCanvasFormat(),
        // usage is set up for rendering to the canvas
        usage:
            GPUTextureUsage.RENDER_ATTACHMENT,
            alphaMode: 'opaque'
      };
    context.configure(canvasConfig);
}

// general call for making the buffers for the sphere
async function createBuffers() {
    // Call the functions in an appropriate order
    setShaderInfo();

    // create and bind vertex buffer
    // set up the attribute we'll use for the vertices
    const vertexAttribDesc = {
        shaderLocation: 0, // @location(0) in vertex shader
        offset: 0,
        format: 'float32x3' // 3 floats: x,y,z
    };

    // this sets up our buffer layout
    const vertexBufferLayoutDesc = {
        attributes: [vertexAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3, // sizeof(float) * 3 floats
        stepMode: 'vertex'
    };

    // buffer layout and filling
    const vertexBufferDesc = {
        size: points.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myVertexBuffer = device.createBuffer(vertexBufferDesc);
    let writeArray =
        new Float32Array(myVertexBuffer.getMappedRange());

    writeArray.set(points); // this copies the buffer
    myVertexBuffer.unmap();

    // set up the uv buffer
    // set up the attribute we'll use for the vertices
    const uvAttribDesc = {
        shaderLocation: 1, // @location(1) in vertex shader
        offset: 0,
        format: 'float32x2' // 2 floats: u,v
    };

    // this sets up our buffer layout
    const uvBufferLayoutDesc = {
        attributes: [uvAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 2, // sizeof(float) * 2 floats
        stepMode: 'vertex'
    };

    // buffer layout and filling
    const uvBufferDesc = {
        size: uvs.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myUvBuffer = device.createBuffer(uvBufferDesc);
    let writeArrayUvs =
        new Float32Array(myUvBuffer.getMappedRange());

    writeArrayUvs.set(uvs); // this copies the buffer
    myUvBuffer.unmap();

    // setup index buffer
    // first guarantee our mapped range is a multiple of 4
    // mainly necessary becauses uint16 is only 2 and not 4 bytes
    if (indices.length % 2 != 0) {
        indices.push(indices[indices.length-1]);
    }
    const myIndexBufferDesc = {
        size: indices.length * Uint16Array.BYTES_PER_ELEMENT,  
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myIndexBuffer = device.createBuffer(myIndexBufferDesc);
    let writeIndexArray =
        new Uint16Array(myIndexBuffer.getMappedRange());

    writeIndexArray.set(indices); // this copies the buffer
    myIndexBuffer.unmap();

    // Set up the uniform var
    let uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering",
                },
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "2d",
                    multisampled: false,
                },
            }
        ]
    });

    // set up the pipeline layout
    const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
    const layout = device.createPipelineLayout(pipelineLayoutDesc);

    // pipeline desc
    const pipelineDesc = {
        layout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
            buffers: [vertexBufferLayoutDesc, uvBufferLayoutDesc]
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fs_main',
            targets: [colorState]
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
        primitive: {
            topology: 'triangle-list', //<- MUST change to draw lines! 
            frontFace: 'cw', // this doesn't matter for lines
            cullMode: 'back'
        }
    };

    pipeline = device.createRenderPipeline(pipelineDesc);

    modelViewMatrix = mat4.identity();
    // Compute the sines and cosines of each rotation
    // about each axis - must be converted into radians first
    let radAngles = [radians(angles[0]), radians(angles[1]), radians(angles[2])];
    let c = [Math.cos(radAngles[0]), Math.cos(radAngles[1]), Math.cos(radAngles[2])];
    let s = [Math.sin(radAngles[0]), Math.sin(radAngles[1]), Math.sin(radAngles[2])];
    
    trans = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            translations[0], translations[1], translations[2], 1.0];
    scales = [scale, 0.0, 0.0, 0.0,
            0.0, scale, 0.0, 0.0,
            0.0, 0.0, scale, 0.0,
            0.0, 0.0, 0.0, 1.0];
    // rotation matrices
    let rx = [1.0, 0.0, 0.0, 0.0,
            0.0, c[0], s[0], 0.0,
            0.0, -s[0], c[0], 0.0,
            0.0, 0.0, 0.0, 1.0];
     let ry = [ c[1],  0.0, -s[1],  0.0,
                0.0,  1.0,  0.0,  0.0,
                s[1],  0.0,  c[1],  0.0,
                0.0,  0.0,  0.0,  1.0 ];
    let rz = [ c[2],  s[2],  0.0,  0.0,
                -s[2],  c[2],  0.0,  0.0,
                0.0,  0.0,  1.0,  0.0,
                0.0,  0.0,  0.0,  1.0 ];
    modelViewMatrix = mat4.mul(mat4.mul(mat4.mul(mat4.mul(trans, rz), ry), rx), scales);
    
    let altogether = [];
    for (let i = 0; i < 16; i++) {
        altogether.push(modelViewMatrix[i]);
    }
    
    uniformValues = new Float32Array(altogether);
    uniformBuffer = device.createBuffer({
        size: uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);


    // now create the texture to render
    const url = './textures.png';
    imageSource = await loadImageBitmap(url);
    texture = device.createTexture({
        label: "image",
        format: 'rgba8unorm',
        size: [imageSource.width, imageSource.height],
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    device.queue.copyExternalImageToTexture(
        { source: imageSource, flipY: true },
        { texture: texture },
        { width: imageSource.width, height: imageSource.height, depthOrArrayLayers: 1 },
    );

    const samplerTex = device.createSampler();

    uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                }
            },
            { binding: 1, resource: samplerTex },
            { binding: 2, resource: texture.createView() },
        ]
    });

}

// We call draw to render to our canvas
function draw() {
    // set up color info
    colorTexture = context.getCurrentTexture();
    colorTextureView = colorTexture.createView();

    // a color attachment ia like a buffer to hold color info
    colorAttachment = {
        view: colorTextureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
    };
    renderPassDesc = {
        colorAttachments: [colorAttachment],
        depthStencilAttachment: {
            view: depthTexture.createView(),

            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        },
    };

    // convert to radians before sending to shader
    let radAngles = [radians(angles[0]), radians(angles[1]), radians(angles[2])];
    let c = [Math.cos(radAngles[0]), Math.cos(radAngles[1]), Math.cos(radAngles[2])];
    let s = [Math.sin(radAngles[0]), Math.sin(radAngles[1]), Math.sin(radAngles[2])];
    
    trans = [1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                translations[0], translations[1], translations[2], 1.0]; 
    scales = [scale, 0.0, 0.0, 0.0,
                0.0, scale, 0.0, 0.0,
                0.0, 0.0, scale, 0.0,
                0.0, 0.0, 0.0, 1.0];
    // rotation matrices
    let rx = [1.0, 0.0, 0.0, 0.0,
            0.0, c[0], s[0], 0.0,
            0.0, -s[0], c[0], 0.0,
            0.0, 0.0, 0.0, 1.0];
    let ry = [c[1], 0.0, -s[1], 0.0,
            0.0, 1.0, 0.0, 0.0,
            s[1], 0.0, c[1], 0.0,
            0.0, 0.0, 0.0, 1.0];
    let rz = [c[2], s[2], 0.0, 0.0,
            -s[2], c[2], 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0];
    modelViewMatrix = mat4.mul(mat4.mul(mat4.mul(mat4.mul(trans, rz), ry), rx), scales);
   
    for (let i = 0; i < 16; i++) {
        uniformValues[i] = modelViewMatrix[i];
    }

    // copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    // create the render pass
    commandEncoder = device.createCommandEncoder();
    passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
    passEncoder.setViewport(0, 0,canvas.width, canvas.height, 0, 1);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setVertexBuffer(0, myVertexBuffer);
    passEncoder.setVertexBuffer(1, myUvBuffer);
    passEncoder.setIndexBuffer(myIndexBuffer, "uint16");
    passEncoder.drawIndexed(indices.length, 1);
    passEncoder.end();

    // submit the pass to the device
    device.queue.submit([commandEncoder.finish()]);
}

// Creates the points and indices and uvs that form a pot with dirt inside
function makePot() {    
    let radialdivision = 15;
    let heightdivision = 1;

    let radialInc = 360 / radialdivision; // find angle size for each triangle
    for (let i = 0; i < radialdivision; i++) { // loop through all triangles in circle
        // get points at current degree and the degree one radial increment above
        let firstDegree = i * radialInc;
        let secondDegree = (i + 1) * radialInc;
        let x0 = 0.25 * Math.cos(radians(firstDegree));
        let z0 = 0.25 * Math.sin(radians(firstDegree));
        let x1 = 0.25 * Math.cos(radians(secondDegree));
        let z1 = 0.25 * Math.sin(radians(secondDegree));

        let percentOfTop = .55; // size of bottom circle relative to top circle
        let ratio = -0.5 / (percentOfTop - 1); // needed to calculate new x's and z's

        // draw dirt
        addSquare(0, 0.225, 0,
            x1 * (1 + (.225 - 0.25) / ratio), 0.225, z1 * (1 + (.225 - 0.25) / ratio),
            x0 * (1 + (.225 - 0.25) / ratio), 0.225, z0 * (1 + (.225 - 0.25) / ratio),
            0, 0.225, 0,
            "d"
        );

        // draw inside of lip above dirt so teraccotta is visible on both sides
        addSquare(x0, 0.25, z0,
            x0 * (1 + (0.225 - 0.25) / ratio), 0.225, z0 * (1 + (0.225 - 0.25) / ratio),
            x1 * (1 + (0.225 - 0.25) / ratio), 0.225, z1 * (1 + (0.225 - 0.25) / ratio),
            x1, 0.25, z1,
            "t"
        )

        // draw bottom of pot
        addSquare(0, -0.25, 0,
            percentOfTop * x0, -0.25, percentOfTop * z0,
            percentOfTop * x1, -0.25, percentOfTop * z1,
            0, -0.25, 0,
            "t"
        );

        let heightInc = 0.5 / heightdivision; // find height for each triangle on sides
        for (let i = 0; i < heightdivision; i++) { // loop through number of squares on each side ignoring the top one
            // calculate bottom and top heights
            let bottomY = i * heightInc - 0.25;
            let topY = (i + 1) * heightInc - 0.25;

            // calculate top x and z values which must move in towards 0,0 relative to how high up it is
            let topX0 = x0 * (1 + (topY - 0.25) / ratio);
            let topZ0 = z0 * (1 + (topY - 0.25) / ratio);
            let topX1 = x1 * (1 + (topY - 0.25) / ratio);
            let topZ1 = z1 * (1 + (topY - 0.25) / ratio);

            // calculate bottom x and z values which are relative to how high up it is
            let bottomX0 = x0 * (1 + (bottomY - 0.25) / ratio);
            let bottomZ0 = z0 * (1 + (bottomY - 0.25) / ratio);
            let bottomX1 = x1 * (1 + (bottomY - 0.25) / ratio);
            let bottomZ1 = z1 * (1 + (bottomY - 0.25) / ratio);

            addSquare(topX0, topY, topZ0,
                topX1, topY, topZ1,
                bottomX1, bottomY, bottomZ1,
                bottomX0, bottomY, bottomZ0,
                "t"
            )
        }
    }
}

let initial_length,
    initial_radius,
    angleToUse,
	rules;
var iterations = 3;

// 
// initialize grammar variables
//
function initializeGrammarVars() {
    initial_length = 0.1;
    initial_radius = 0.025;
	angleToUse = 45.0;
    iterations = 5;
    rules = [];
}

function isNumeric(char) {
	return /^[0-9]$/.test(char);
}

// Run the lsystem iterations number of times on the start axiom.
function run(iterations, startString) {
	let grammarArray = startString.split('');
    let doubleBuffer = [];

	console.log("iterations: " + iterations);
    for (let i = 0; i < iterations; i++) {
		for (let j = 0; j < grammarArray.length; j++) {
            if (isNumeric(grammarArray[j])) {
				let rule = rules[parseInt(grammarArray[j])].split('');
				if (doubleBuffer.length === 0) {
					doubleBuffer = rule;
				} else {
					doubleBuffer = doubleBuffer.concat(rule);
                }
			} else {
				if (doubleBuffer.length === 0) {
					doubleBuffer = grammarArray[j];
				} else {
					doubleBuffer = doubleBuffer.concat(grammarArray[j]);
				}
            }
           
		}
		
        grammarArray = []; // Clear
		grammarArray.push(...doubleBuffer); 
		doubleBuffer = [];
    }

    return grammarArray;
}

//
// l-system grammar creation code
// 
function createGrammar() {
    //variables : 0, 1
    //constants: [, ], \, /, +, -, .
    //axiom  : 0
    //rules  : (1 ? 11.), (0 ? 1[[\0]/0][[+0]-0])
    // Second example LSystem from 
    // http://en.wikipedia.org/wiki/L-system
    let start = "0";
    rules[0] = "1[[\\0]/0][[+0]-0]";
    rules[1] = "11.";
	let grammar = run(iterations, start);
	return grammar;
}

//
// l-system drawing code
//
function drawGrammarPoints(grammarArray) {
    console.log(grammarArray)

	// to push and pop location and angle
	let positions = [];
	let angles = [];
    let radiuses = [];

    // current angle and position
	let xAngle = 0.0;
    let yAngle = 20.0;
    let zAngle = 0.0;

	// positions to draw towards
	let newPosition = [];

	// always start at 0.0, 0.225, 0.0, because that is the center
	let position = [0.0, 0.0, 0.0];
	let posx=0.0, posy = 0.0, posz=0.0; // I know the dirt of the pot starts at y = 0.225, but then tree is then really tall
    let radius = 0.025;
    let initial_length = 0.067;
    let angleToChange;
	
	// Apply the drawing rules to the string given to us
	for (let i = 0; i < grammarArray.length; i++) {
		let buff = grammarArray[i];
		switch (buff) {
			case '0':
				// draw a leaf
				newPosition = makeLeaf(position, [xAngle, yAngle, zAngle], 0.075, "l");

				// set up for the next draw
				position = newPosition;
				posx = newPosition[0];
				posy = newPosition[1];	
                posz = newPosition[2];		
				break;
			case '1':
				// draw a cylinder 
                newPosition = makeCylinder(position, [xAngle, yAngle, zAngle], initial_length, "b", radius);

				// set up for the next draw
				position = newPosition;
				posx = newPosition[0];
				posy = newPosition[1];
                posz = newPosition[2];
				break;
            case '/':
                // /: decrement z angle by between 25 and 45
                angleToChange = Math.floor(Math.random() * (45 - 25)) + 30;
                zAngle -= angleToChange;
                break;
            case '\\':
                // \: increment z angle by between 25 and 45
                angleToChange = Math.floor(Math.random() * (45 - 25)) + 30;
                zAngle += angleToChange;
                break;
            case '-':
                // -: decrement x angle by between 25 and 45
                angleToChange = Math.floor(Math.random() * (45 - 25)) + 30;
                xAngle -= angleToChange;
                break;
            case '+':
                // +: increment x angle by between 25 and 45
                angleToChange = Math.floor(Math.random() * (45 - 25)) + 30;
                xAngle += angleToChange;
                break;
            case '&':
                    // &: decrement y angle by between 25 and 45
                    angleToChange = Math.floor(Math.random() * (45 - 25)) + 30;
                    xAngle -= angleToChange;
                    break;
            case '^':
                    // ^: increment y angle by between 25 and 45
                    angleToChange = Math.floor(Math.random() * (45 - 25)) + 30;
                    xAngle += angleToChange;
                    break;
            case '.':
                // .: decrease radius by 2%
                radius *= .98
                break;
			case '[':
				//[: push position, angle, and radius
                positions.push(posz);
				positions.push(posy);
				positions.push(posx);
				angles.push(zAngle);
                angles.push(yAngle);
                angles.push(xAngle);
                radiuses.push(radius);
				break;
			case ']':
				//]: pop position, angle, and radius
				posx = positions.pop();
				posy = positions.pop();
                posz = positions.pop();
				position = [posx, posy, posz];
				xAngle = angles.pop();
                yAngle = angles.pop();
                zAngle = angles.pop();
                radius = radiuses.pop();
				break;
			default: break;
		}
	}
}


////////////////////////////////////////////////////////////////////
//
//  Utility functions
//
///////////////////////////////////////////////////////////////////

function radians(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
}

// takes four points of a square and adds necessary points
function addSquare(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, texture) {
    let nverts = points.length / 3;
    points.push(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3); // add points
    indices.push(nverts, nverts + 1,  nverts + 2,  nverts,  nverts + 2,  nverts + 3); // add indices
    if (texture == "t") uvs.push(0, 0, 0, 0.5, 0.5, 0, 0.5, 0.5);// add uv coords based off texture
    else if (texture == "b") uvs.push(0.5, 1, 0.5, 0.5, 1, 1, 1, 0.5);
    else if (texture == "d") uvs.push(0.5, 0.5, 0.5, 0, 1, 0.5, 1, 1)
    else uvs.push(0, 0.5, 0, 1, 0.5, 0.5, 0.5, 1.0);
}

// takes a position, angles, the height, texture, radius and creates a cylinder
// the arg draw is never used here but in some l-systems you want to generate a new position without actually drawing the line
function makeCylinder(position, angles, height, texture, radius = 0.025, draw = true){
    let newPosition = [];
    let radialdivision = 10;
    let radialInc = 360 / radialdivision; // find angle size for each triangle
    for (let i = 0; i < radialdivision; i++) { // loop through all triangles in circle
        // get points at current degree and the degree one radial increment above
        let firstDegree = i * radialInc;
        let secondDegree = (i + 1) * radialInc;
        let x0 = radius * Math.cos(radians(firstDegree));
        let z0 = radius * Math.sin(radians(firstDegree));
        let x1 = radius * Math.cos(radians(secondDegree));
        let z1 = radius * Math.sin(radians(secondDegree));

        // all points needed for the cylinder centered around the origin
        let point1 = [x0, (height / 2), z0, 1];
        let point2 = [x1, (height / 2), z1, 1];
        let point3 = [0, (height / 2), 0, 1];
        let point4 = [x0, -(height / 4), z0, 1];
        let point5 = [x1, -(height / 4), z1, 1];
        let point6 = [0, -(height / 4), 0, 1];

        // translate and angle the points with the provided args
        let radAngles = [radians(angles[0]), radians(angles[1]), radians(angles[2])];
        let c = [Math.cos(radAngles[0]), Math.cos(radAngles[1]), Math.cos(radAngles[2])];
        let s = [Math.sin(radAngles[0]), Math.sin(radAngles[1]), Math.sin(radAngles[2])];
        let cyl_trans = [1.0, 0.0, 0.0, 0.0,
                        0.0, 1.0, 0, 0.0,
                        0.0, 0.0, 1.0, 0.0,
                        position[0], position[1], position[2], 1.0];
        // rotation matrices
        let cyl_rx = [1.0, 0.0, 0.0, 0.0,
                    0.0, c[0], s[0], 0.0,
                    0.0, -s[0], c[0], 0.0,
                    0.0, 0.0, 0.0, 1.0];
        let cyl_ry = [ c[1],  0.0, -s[1],  0.0,
                    0.0,  1.0,  0.0,  0.0,
                    s[1],  0.0,  c[1],  0.0,
                    0.0,  0.0,  0.0,  1.0 ];
        let cyl_rz = [ c[2],  s[2],  0.0,  0.0,
                    -s[2],  c[2],  0.0,  0.0,
                    0.0,  0.0,  1.0,  0.0,
                    0.0,  0.0,  0.0,  1.0 ];
        
        // new translated points
        let trans1 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point1);
        let trans2 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point2);
        let trans3 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point3);
        let trans4 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point4);
        let trans5 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point5);
        let trans6 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point6);
        
        if (draw) {
            // add triangle to the top and bottom
            addSquare(trans1[0], trans1[1], trans1[2],
                trans3[0], trans3[1], trans3[2],
                trans3[0], trans3[1], trans3[2],
                trans2[0], trans2[1], trans2[2],
                texture
            );
            addSquare(trans6[0], trans6[1], trans6[2],
                trans4[0], trans4[1], trans4[2],
                trans5[0], trans5[1], trans5[2],
                trans6[0], trans6[1], trans6[2],
                texture
            );

            // add triangle to side
            addSquare(trans1[0], trans1[1], trans1[2],
                trans2[0], trans2[1], trans2[2],
                trans5[0], trans5[1], trans5[2],
                trans4[0], trans4[1], trans4[2],
                texture
            )
        }
        
        // calculate new position
        newPosition[0] = trans3[0];
        newPosition[1] = trans3[1];
        newPosition[2] = trans3[2];
    }

    return newPosition;
}

// takes a position, angles, the height, and texture and creates a leaf (just a diamond)
function makeLeaf(position, angles, height, texture) {
    let newPosition = [];

    // make points centered around 0,0,0
    let point1 = [0, (height * 1.5), 0, 1];
    let point2 = [(height / 2), (height / 2), 0, 1];
    let point3 = [0, 0, 0, 1];
    let point4 = [-(height / 2), (height / 2), 0, 1];

    // translate the points to the proper position at the right angle
    let radAngles = [radians(angles[0]), radians(angles[1]), radians(angles[2])];
    let c = [Math.cos(radAngles[0]), Math.cos(radAngles[1]), Math.cos(radAngles[2])];
    let s = [Math.sin(radAngles[0]), Math.sin(radAngles[1]), Math.sin(radAngles[2])];
    let cyl_trans = [1.0, 0.0, 0.0, 0.0,
                    0.0, 1.0, 0, 0.0,
                    0.0, 0.0, 1.0, 0.0,
                    position[0], position[1], position[2], 1.0];
    // rotation matrices
    let cyl_rx = [1.0, 0.0, 0.0, 0.0,
                0.0, c[0], s[0], 0.0,
                0.0, -s[0], c[0], 0.0,
                0.0, 0.0, 0.0, 1.0];
    let cyl_ry = [ c[1],  0.0, -s[1],  0.0,
                0.0,  1.0,  0.0,  0.0,
                s[1],  0.0,  c[1],  0.0,
                0.0,  0.0,  0.0,  1.0 ];
    let cyl_rz = [ c[2],  s[2],  0.0,  0.0,
                -s[2],  c[2],  0.0,  0.0,
                0.0,  0.0,  1.0,  0.0,
                0.0,  0.0,  0.0,  1.0 ];
    
    // new translated points
    let trans1 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point1);
    let trans2 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point2);
    let trans3 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point3);
    let trans4 = mat4.mul(mat4.mul(mat4.mul(mat4.mul(cyl_trans, cyl_rz), cyl_ry), cyl_rx), point4);

    // plot both sides of the leaf
    addSquare(trans1[0], trans1[1], trans1[2],
        trans4[0], trans4[1], trans4[2],
        trans3[0], trans3[1], trans3[2],
        trans2[0], trans2[1], trans2[2],
        texture
    );
    addSquare(trans4[0], trans4[1], trans4[2],
        trans1[0], trans1[1], trans1[2],
        trans2[0], trans2[1], trans2[2],
        trans3[0], trans3[1], trans3[2],
        texture
    );
    
    // save and return new position
    newPosition[0] = trans3[0];
    newPosition[1] = trans3[1];
    newPosition[2] = trans3[2];

    return newPosition;
}


// function obtained from:
// https://webgpufundamentals.org/webgpu/lessons/webgpu-importing-textures.html
async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
}

function gotKey(event) {
    var key = event.key;

    //  incremental rotation
    if (key == 'x')
        angles[0] -= angleInc;
    else if (key == 'y')
        angles[1] -= angleInc;
    else if (key == 'z')
        angles[2] -= angleInc;
    else if (key == 'X')
        angles[0] += angleInc;
    else if (key == 'Y')
        angles[1] += angleInc;
    else if (key == 'Z')
        angles[2] += angleInc;
    else if (key == 'w')
        scale -= scaleInc;
    else if (key == 's')
        scale += scaleInc;
    else if (key == 'a')
        translations[0] -= transInc;
    else if (key == 'd')
        translations[0] += transInc;
    else if (key == '+')
        translations[1] += transInc;
    else if (key == '-')
        translations[1] -= transInc;

    // reset
    else if (key == 'r' || key == 'R') {
        angles[0] = anglesReset[0];
        angles[1] = anglesReset[1];
        angles[2] = anglesReset[2];
        translations[0] = transReset[0];
        translations[1] = transReset[1];
        translations[2] = transReset[2];
        scale = scaleReset;
    }

    // redo the draw
    draw();
}

// entry point to the application
async function init() {
    // Retrieve the canvas
    canvas = document.querySelector("canvas");

    // deal with keypress
    window.addEventListener('keydown', gotKey, false);

    // Read, compile, and link the shaders
    await initProgram();

    // clear the points and elements
    points = [];
    indices = [];
    uvs = [];

    // create a pot and then the plant and create the buffers for it
    makePot();
    initializeGrammarVars();
    let grammar = createGrammar();
    drawGrammarPoints(grammar);

    await createBuffers();
    
    // do a draw
    draw();
}

window.onload = init;