"use strict";

let cageEnabled = false;
let surfaceEnabled = true;

function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

function ltime(t, a,b) { return t<=a ? 0 : t>=b ? 1 : (t-a)/(b-a); }



function rotateZAround(theta, c) {
    const M = BABYLON.Matrix;
    return M.Translation(-c.x,-c.y,-c.z)
        .multiply(M.RotationZ(theta))
        .multiply(M.Translation(c.x,c.y,c.z));
}

let viewer;
let torus;
let currentT = 0.0;
let quality = 2;
let rootMesh;
let model;
let cage;
let material;


window.onload = function() {
    viewer = new Viewer('render-canvas');
    viewer.scene.onKeyboardObservable.add(onKeyEvent);

    // viewer.createGrid();
    rootMesh = new BABYLON.Mesh('root', viewer.scene);
    rootMesh.rotation.z=Math.PI/2;
    createTorus();    
    makeModel();

    viewer.runRenderLoop();
}

function setQuality(v) {
    quality = v;
    updateModel();
}


function onKeyEvent(kbInfo) {
    if(kbInfo.type != BABYLON.KeyboardEventTypes.KEYDOWN) return;
    let key = kbInfo.event.key;
    if(key == "c") { cageEnabled=!cageEnabled; updateModel(); }
    else if(key == 's') { surfaceEnabled=!surfaceEnabled; updateModel(); }

}

function updateModel() {
    makeModel();
}

function showVal(v) {
    let t = currentT = v/100;
    makeModel();
}


function createTorus() {
    let scene = viewer.scene;
    torus = BABYLON.MeshBuilder.CreateTorus('t',{
        diameter : 7,
        thickness : 0.6,
        tessellation : 64
    },scene);
    torus.material = new BABYLON.StandardMaterial('m', scene);
    torus.material.diffuseColor.set(0.2,0.6,0.8,1.0);
    torus.rotation.x = Math.PI/2;
    torus.position.y = 2.5;
    torus.parent = rootMesh;
}


//===========================================================

function doMakeModel(scene, pts, faces) {
    let ph = new Polyhedron();
    ph.build(pts, faces);
    if(cage) cage.dispose();
    if(cageEnabled) {
        cage = ph.createLineSystem(scene, new BABYLON.Color4(1,1,1,1), true);
        cage.parent = rootMesh;
    }

    if(model) { model.dispose(); model = null; }

    if(surfaceEnabled)
    {
        ph.updateVertices();
        let ph2 = ph.catmullClark();
        for(let i=0;i+1<quality;i++) {
            ph2.updateVertices();
            ph2 = ph2.catmullClark();    
        }
        model = ph2.createMesh(scene);
        if(material==null) {
            material = new BABYLON.StandardMaterial('a',scene);
            material.diffuseColor.set(0.8,0.3,0.1);            
        }
        model.material = material;
        model.parent = rootMesh;
    }
}

//===========================================================

function makeModel() {
    let scene = viewer.scene;

    let t = currentT * 4;
    let stage = Math.min(3,Math.floor(t));
    t -= stage;
    // stage 0 : ciambelle separate -> ciambelle unite
    // stage 1 : ciambelle unite -> tre manici
    // stage 2 : tre manici -> ciambelle unite
    // stage 3 : ciambelle unite -> ciambelle separate

    let triangleShape = (stage%2)==0 ? t : 1-t; 
    // 0=60deg; 1=90deg

    let separation = (stage%2)==0 ? 1-t : t; 
    // 0=>unite; 1=separate

    let faces = [];

    let pts2, edges2, faces2;


    // let d = 2 * separation;
    let rotationRadius = 2;
    let edgeLength = 0.75;
    let h = edgeLength * ((1-triangleShape)*Math.sqrt(3)/2 + triangleShape*0.5);
    let z = edgeLength*0.5;

    // let m = 8; // 6,4
    pts2 = [[-h,0],[0,-z],[0,-z],[h,0],[0,z],[0,z]];
    let m = 6;
    let bridge = false;
    if(separation>0.1) {
        bridge = true;
        // m = 10;
        // pts2.push([0,-z],[0,z],[0,-z],[0,z]);
        /*
        edges2 = [
            [0,5],[4,3],[3,2],[1,0],
            [7,6],[8,9],
            [5,7],[9,4],[2,8],[6,1]];
        faces2 = [[0,1,5],[5,1,6,7],[9,8,2,4],[4,2,3]];
        */
       edges2 = [
        [0,5],[4,3],[3,2],[1,0],
        [5,1],[2,4]];
        faces2 = [[0,1,5],[4,2,3]];

    } else if(separation>0) {
        edges2 = [[0,5],[4,3],[3,2],[1,0],[5,4],[2,1]];
        faces2 = [[0,1,5],[1,2,4,5],[2,3,4]];
    
    } else {
        m = 4;
        pts2 = [[-h,0],[0,-z],[h,0],[0,z]];
        edges2 = [[0,3],[3,2],[2,1],[1,0]];
        faces2 = [[0,1,2,3]];
    }
    // console.log("m=",m, "stage=", stage, "t=", t, "sep=",separation);

    let theta = separation*Math.PI/2;
    let rot2Center = new BABYLON.Vector3(0,-rotationRadius,0);
    
    let mat_a,mat_b;
    let maxBridgeLength;
    if(stage<3) {
        mat_a = rotateZAround(theta, rot2Center);
        mat_b = rotateZAround(-theta, rot2Center);    
        maxBridgeLength = 0.25*theta * rotationRadius;
    } else {
        let d = separation*0.5;
        mat_a = BABYLON.Matrix.Translation(-d,0,0);
        mat_b = BABYLON.Matrix.Translation( d,0,0);
        maxBridgeLength = 0.5*d;
    }

    let rot1 = BABYLON.Matrix.RotationY(stage == 1 || stage == 2 ? Math.PI/2 : 0);

    let dy = edgeLength * 0.5;
    let pts = pts2.flatMap(([x,z]) => [
        new BABYLON.Vector3(x,dy,z),
        new BABYLON.Vector3(x,-dy,z)        
    ]);
    
    let offy = 0;
    if(m>4) {
        const TC = BABYLON.Vector3.TransformCoordinates;
        [0,1,5].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],mat_a);});
        [2,3,4].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],mat_b);});
        
        if(m>6) {
            [6,7].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],mat_a);});
            [8,9].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],mat_b);});
        }
        
        let p = new BABYLON.Vector3(0,0,0);
        for(let i=0;i<12;i++) p.addInPlace(pts[i]);
        p.scaleInPlace(1/12);
        offy = p.y;
    }
    let mat = rot1.multiply(BABYLON.Matrix.Translation(0,-offy,0));

    if(stage>=2)
    {
        mat = mat.multiply( BABYLON.Matrix.RotationZ(Math.PI*2/3));
    }

    pts = pts.map(p => BABYLON.Vector3.TransformCoordinates(p, mat));
    
    edges2.forEach(([i1,i2])=> {
        faces.push([i2*2,i1*2,i1*2+1,i2*2+1]);
    });
    faces2.forEach((L)=> {
        faces.push(L.map(j=>2*j+1));
        faces.push(L.slice().reverse().map(j=>2*j));
    });        


    let ww = 1.0;
    let ww1 = ww + 0.5 * (ltime(currentT, 0.19, 0.24)-ltime(currentT, 0.30, 0.35));
    for(let i=0; i<4;i++) {
        extrude(pts,faces,i,ww1);
    }
    if(bridge) {
        let length = Math.min(maxBridgeLength, ww1);
        [4,5].forEach(i=>{
            extrude(pts,faces,i,length);
        });
        addHandle(pts, faces, 5,4);
    }

    if(stage==0 || stage==3) {
        addHandle(pts, faces, 2, 1);
        addHandle(pts, faces, 0, 3);
        
    } else {
        addHandle(pts, faces, 1, 0);
        addHandle(pts, faces, 3, 2); 
    
    }

    // global movement
    let matrix = BABYLON.Matrix.Identity();

    matrix = matrix.multiply(
        BABYLON.Matrix.Translation(0,3*(1-ltime(currentT, 0, 0.2)),0));

    matrix = matrix.multiply(
        BABYLON.Matrix.RotationX(Math.PI*(1-ltime(currentT, 0, 0.1))));

    matrix = matrix.multiply(
        BABYLON.Matrix.RotationZ(-Math.PI/6*ltime(currentT, 0.39, 0.7)));

    matrix = matrix.multiply(
        BABYLON.Matrix.Translation(0,-3*ltime(currentT, 0.39, 0.7),0));

    pts = pts.map(p=>BABYLON.Vector3.TransformCoordinates(p,matrix));

    doMakeModel(scene, pts,faces);
}

