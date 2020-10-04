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

class Viewer {
    constructor(canvasId) {
        let canvas = this.canvas = document.getElementById(canvasId);
        if(!canvas) throw "canvas not found"; 
        let engine = this.engine = new BABYLON.Engine(canvas, true); 
        let scene = this.scene = new BABYLON.Scene(engine);
        let camera = this.camera = new BABYLON.ArcRotateCamera("Camera", 
            -1.44, 0.4, 
            150, 
            new BABYLON.Vector3(0,0,0), 
            scene);
        camera.fov = 0.1;
        camera.attachControl(canvas, true);
        camera.wheelPrecision = 10;

        // var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
        var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(0, 0, 0), scene);            
        light2.parent = camera;

        window.addEventListener("resize", function () { 
            engine.resize(); 
        });
    }

    runRenderLoop() {
        let scene = this.scene;
        this.engine.runRenderLoop(function () {scene.render();});
    }

    createGrid() {   
        let scene = this.scene;
        
        var Color4 = BABYLON.Color4;
        var Vector3 = BABYLON.Vector3;
         
        var m = 50;
        var r = 5;
        var pts = [];
        var colors = [];
        var c1 = new Color4(0.7,0.7,0.7,0.5);
        var c2 = new Color4(0.5,0.5,0.5,0.25);
        var cRed   = new Color4(0.8,0.1,0.1);
        var cGreen = new Color4(0.1,0.8,0.1);
        var cBlue  = new Color4(0.1,0.1,0.8);
        
        var color = c1;
        function line(x0,y0,z0, x1,y1,z1) { 
            pts.push([new Vector3(x0,y0,z0), new Vector3(x1,y1,z1)]); 
            colors.push([color,color]); 
        }
        
        for(var i=0;i<=m;i++) {
            if(i*2==m) continue;
            color = (i%5)==0 ? c1 : c2;
            var x = -r+2*r*i/m;        
            line(x,0,-r, x,0,r);
            line(-r,0,x, r,0,x);
        }
        
        var r1 = r + 1;
        var a1 = 0.2;
        var a2 = 0.5;
        
        // x axis
        color = cRed;
        line(-r1,0,0, r1,0,0); 
        line(r1,0,0, r1-a2,0,a1);
        line(r1,0,0, r1-a2,0,-a1);
            
        // z axis
        color = cBlue;
        line(0,0,-r1, 0,0,r1); 
        line(0,0,r1, a1,0,r1-a2);
        line(0,0,r1,-a1,0,r1-a2);
        
        // y axis
        color = cGreen;
        line(0,-r1,0, 0,r1,0); 
        line(0,r1,0, a1,r1-a2,0);
        line(0,r1,0,-a1,r1-a2,0);
        line(0,r1,0, 0,r1-a2,a1);
        line(0,r1,0, 0,r1-a2,-a1);
        
        let lines = BABYLON.MeshBuilder.CreateLineSystem(
            "lines", {
                    lines: pts,
                    colors: colors,
                    
            }, 
            scene);
        return lines;    
      }
  
};


let viewer;
let torus;
let currentT = 0.0;

window.onload = function() {
    viewer = new Viewer('render-canvas');
    // viewer.createGrid();
    createTorus(viewer.scene);

    viewer.scene.onKeyboardObservable.add(onKeyEvent);
    
    makeModel(viewer.scene, currentT);
    viewer.runRenderLoop();
}

let model = null;


function onKeyEvent(kbInfo) {
    if(kbInfo.type != BABYLON.KeyboardEventTypes.KEYDOWN) return;
    let key = kbInfo.event.key;
    if(key == "c") { cageEnabled=!cageEnabled; updateModel(); }
    else if(key == 's') { surfaceEnabled=!surfaceEnabled; updateModel(); }

}

function updateModel() {
    makeModel(viewer.scene, currentT);
}

function showVal(v) {
    let t = currentT = v/100;
    makeModel(viewer.scene, t);
}


function createTorus(scene) {
    torus = BABYLON.MeshBuilder.CreateTorus('t',{
        diameter : 9,
        thickness : 0.5,
        tessellation : 64
    },scene);
    torus.material = new BABYLON.StandardMaterial('m', scene);
    torus.material.diffuseColor.set(0.2,0.6,0.8,1.0);
    torus.rotation.x = Math.PI/2;
    torus.position.y = 3.5;
}

function ltime(t, a,b) { return t<=a ? 0 : t>=b ? 1 : (t-a)/(b-a); }

let gh;


let cage;

function extrude(pts, faces, faceIndex, d) {
    let k = pts.length;
    let face = faces[faceIndex];
    let fPts = face.map(j=>pts[j]);
    let nrm = BABYLON.Vector3
        .Cross(fPts[1].subtract(fPts[0]), fPts[2].subtract(fPts[0]))
        .normalize();
    let delta = nrm.scale(d);
    fPts.forEach(p => {pts.push(delta.add(p))});
    let m = face.length;
    let q = [];
    for(let j=0; j<m; j++) {
        q.push(k+j);
        let j1 = (j+1)%m;
        faces.push([face[j],face[j1],k+j1,k+j]);
    }
    faces[faceIndex] = q;
}



function addHandle(pts, faces, f1, f2) {
    let face1 = faces[f1];
    let face2 = faces[f2];
    
    let c1 = new BABYLON.Vector3(0,0,0);
    let c2 = new BABYLON.Vector3(0,0,0);
    face1.forEach(i=>c1.addInPlace(pts[i]));
    face2.forEach(i=>c2.addInPlace(pts[i]));
    let c = c1.add(c2);
    c.scaleInPlace(1/(face1.length+face2.length));
    c1.scaleInPlace(1/face1.length);
    c2.scaleInPlace(1/face2.length);

    let norm1 = BABYLON.Vector3.Cross(
        pts[face1[0]].subtract(c1),
        pts[face1[1]].subtract(c1)).normalize();
    let norm2 = BABYLON.Vector3.Cross(
        pts[face2[0]].subtract(c2),
        pts[face2[1]].subtract(c2)).normalize();
    

    let c12 = c2.subtract(c1);
    let c12midPoint = BABYLON.Vector3.Lerp(c1,c2,0.5);
    let e0 = c12.clone().normalize();
    let e1 = norm1.add(norm2);
    e1 = e1.subtract(e0.scale(BABYLON.Vector3.Dot(e0,e1))).normalize();
    let e2 = BABYLON.Vector3.Cross(e0,e1).normalize();

    let cs = BABYLON.Vector3.Dot(norm1,norm2);
    cs = Math.max(-1,Math.min(1,cs));
    let normsAngle = Math.acos(cs);
    let theta = (Math.PI-normsAngle)/2;

    if(theta < 1.0e-8)
    {
        // normals are aligned, with opposite direction:
        // no arc: just link the faces
        let t1 = face1;
        let t2 = [face2[1],face2[0],face2[3],face2[2]];
        for(let i=0; i<4; i++) {
            let i1 = (i+1)%4;
            let t = [t1[i],t1[i1],t2[i1],t2[i]];
            if(i<2) faces[i==0 ? f1 : f2] = t;
            else faces.push(t);
        }
        return;
    }

    let h = c12.length()*0.5 / Math.tan(theta);

    if(BABYLON.Vector3.Dot(BABYLON.Vector3.Cross(norm1,norm2), e2)<0) 
        h = -h;

    let center = c12midPoint.subtract(e1.scale(h));

    let R = 0.5*(center.subtract(c1).length()+center.subtract(c2).length());

    /*
    let c_lines = [
        [c1.add(norm1),c1,center,c2,c2.add(norm2)],
        [center.add(e0),center,center.add(e1)],
        [center, center.add(e1.scale(h))]
    ];
    let lineSystem = BABYLON.MeshBuilder.CreateLineSystem(
        "lines", {lines: c_lines},  viewer.scene);
    */

    let e;
    e = c1.subtract(center);
    let phi1 = Math.atan2(
        BABYLON.Vector3.Dot(e0,e),
        BABYLON.Vector3.Dot(e1,e));
    e = c2.subtract(center);
    let phi2 = Math.atan2(
        BABYLON.Vector3.Dot(e0,e),
        BABYLON.Vector3.Dot(e1,e)) ;
    
    let k = pts.length;

    let a0 = c1.subtract(center).normalize();
    let a1 = e2.subtract(a0.scale(BABYLON.Vector3.Dot(e2,a0))).normalize();
    let q = face1.map(i=>pts[i].subtract(c1)).map(p => 
        [BABYLON.Vector3.Dot(a0,p),BABYLON.Vector3.Dot(a1,p)]
    );
    // q = [[-1,-1],[1,-1],[1,1],[-1,1]];

    let n = 4; // 11; // 5;


    for(let i=0; i<n; i++) {
        let t = (i+1)/(n+1);
        let phi = phi1 *(1-t) + phi2 * t;
        let cs = Math.cos(phi);
        let sn = Math.sin(phi);        
        for(let j = 0; j<4; j++) {
            let rr = R + q[j][0];
            let y = q[j][1];
            let p = center
                .add(e0.scale(rr*sn))
                .add(e1.scale(rr*cs))
                .add(e2.scale(y));
            pts.push(p);
        }
    }

    let count = 0;
    for(let i=0; i<n+1; i++) {
        let ki = k+4*(i-1);
        let t1 = i==0 ? face1 : [ki,ki+1,ki+2,ki+3];
        ki += 4;
        let t2 = i==n ? [face2[1],face2[0],face2[3],face2[2]] : [ki,ki+1,ki+2,ki+3];
        
        for(let j=0; j<4; j++) {
            let j1 = (j+1)%4;
            let t = [t1[j],t1[j1],t2[j1],t2[j]];
            if(count<2) faces[count==0 ? f1 : f2] = t;
            else faces.push(t);
            count++;
        }
        
    }
    
}

let material = null;

//===========================================================

function rotateZAround(theta, c) {
    const M = BABYLON.Matrix;
    return M.Translation(-c.x,-c.y,-c.z)
        .multiply(M.RotationZ(theta))
        .multiply(M.Translation(c.x,c.y,c.z));
}

function doMakeModel(scene, pts, faces) {
    let ph = new Polyhedron();
    ph.build(pts, faces);
    if(cage) cage.dispose();
    if(cageEnabled) cage = ph.createLineSystem(scene, new BABYLON.Color4(1,1,1,1), true);

    if(model) { model.dispose(); model = null; }

    if(surfaceEnabled)
    {
        ph.updateVertices();
        let ph2 = ph.catmullClark();
        for(let i=0;i<1;i++) {
            ph2.updateVertices();
            ph2 = ph2.catmullClark();    
        }
        model = ph2.createMesh(scene);
        if(material==null) {
            material = new BABYLON.StandardMaterial('a',scene);
            material.diffuseColor.set(0.8,0.3,0.1);            
        }
        model.material = material;
    }
}

//===========================================================

function makeModel(scene, globalt) {
    let t = globalt * 4;
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
    
    let rot2a,rot2b;
    if(stage<3) {
        rot2a = rotateZAround(theta, rot2Center);
        rot2b = rotateZAround(-theta, rot2Center);    
    } else {
        let d = separation*0.5;
        rot2a = BABYLON.Matrix.Translation(-d,0,0);
        rot2b = BABYLON.Matrix.Translation( d,0,0);
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
        [0,1,5].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],rot2a);});
        [2,3,4].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],rot2b);});
        
        if(m>6) {
            [6,7].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],rot2a);});
            [8,9].flatMap(i=>[2*i,2*i+1]).forEach(i=>{pts[i] = TC(pts[i],rot2b);});
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
    let ww1 = ww + 0.5 * (ltime(globalt, 0.19, 0.24)-ltime(globalt, 0.30, 0.35));
    for(let i=0; i<4;i++) {
        extrude(pts,faces,i,ww1);
    }
    if(bridge) {
        let maxLength = 0.25*theta * rotationRadius;
        let length = Math.min(maxLength, ww);
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
        BABYLON.Matrix.Translation(0,3*(1-ltime(globalt, 0, 0.2)),0));

    matrix = matrix.multiply(
        BABYLON.Matrix.RotationX(Math.PI*(1-ltime(globalt, 0, 0.1))));

    matrix = matrix.multiply(
        BABYLON.Matrix.RotationZ(-Math.PI/6*ltime(globalt, 0.39, 0.7)));

    matrix = matrix.multiply(
        BABYLON.Matrix.Translation(0,-3*ltime(globalt, 0.39, 0.7),0));

    pts = pts.map(p=>BABYLON.Vector3.TransformCoordinates(p,matrix));

    doMakeModel(scene, pts,faces);
}

