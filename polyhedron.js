
class Vertex {
    constructor(p) {
        this.index = null;
        this.p = p;
        this.faces = [];
        this.edges = [];
        this.vertices = [];
    }
}

class Edge {
    constructor() {
        this.index = null;
        this.vertices = [];
        this.faces = [];        
    }
    computeMidPoint() {
        return BABYLON.Vector3.Lerp(this.vertices[0].p, this.vertices[1].p, 0.5); 
    }
}

class Face {
    constructor() {
        this.index = null;
        this.points = [];
        this.edges = [];
        this.faces = [];
    }

    computeCenter() {
        let p = new BABYLON.Vector3(0,0,0);
        this.vertices.forEach(v=>p.addInPlace(v.p));
        p.scaleInPlace(1/this.vertices.length);
        return p;
    }
}

class Polyhedron {
    constructor() {
        this.vertices = [];
        this.edges = [];
        this.faces = [];        
    }
    
    build(pts, facesVertexIndices) {
        // assign vertices
        let vertices = this.vertices = pts.map(p=>new Vertex(p));
        this.vertices.forEach((v,i) => v.index=i);        
        let vCount = vertices.length;

        // assign faces & edges
        let edgeTable = {};
        let faces = this.faces = [];
        let edges = this.edges = [];
        facesVertexIndices.forEach(indices => {
            let face = new Face();
            face.index = faces.length;
            faces.push(face);
            face.vertices = indices.map(i=>vertices[i]);
            let a,b;
            let m = indices.length;
            for(let i=0;i<m;i++) {
                a = indices[i];
                b = indices[(i+1)%m];
                let aa=a, bb=b;
                if(aa<bb) {aa=b;bb=a;}
                let edgeId = bb*vCount + aa;
                let edge = edgeTable[edgeId];
                if(edge === undefined) {
                    edge = new Edge();
                    edge.index = edges.length;
                    edges.push(edge);
                    edgeTable[edgeId] = edge;
                    edge.vertices = [vertices[aa], vertices[bb]];
                }
                edge.faces.push(face);
                face.edges.push(edge);
            }
        });
    }

    updateVertices() {
        this._checkFaces();
        // for each vertex : table e0.index => [[e1,f1],[e2,f2]]
        let vTable = this.vertices.map(v => ({}));

        this.faces.forEach(face => {
            let m = face.vertices.length;
            for(let i=0; i<m; i++) {
                let i1 = (i+1)%m;
                let e0 = face.edges[i];
                let v = face.vertices[i1];
                let e1 = face.edges[i1];
                let tb = vTable[v.index];
                let q = tb[e0.index];
                if(q === undefined) tb[e0.index] = [[e1,face]];
                else q.push([e1,face]);
                q = tb[e1.index];
                if(q === undefined) tb[e1.index] = [[e0,face]];
                else q.push([e0,face]);
                tb.firstEdge = e0;
            }
        });
        this.vertices.forEach(vertex => {
            let tb = vTable[vertex.index];
            let e0 = tb.firstEdge;
            if(!e0) {
                console.warn("V"+vertex.index+" without edges");
                return;
            }
            let touched = {};
            touched[e0.index] = true;
            vertex.edges.push(e0);
            let edge = e0;
            let q = tb[edge.index][0];
            for(;;)
            {
                vertex.faces.push(q[1]);
                let oldEdge = edge;
                edge = q[0];
                if(edge == e0 || touched[edge.index]) break;
                touched[edge.index] = true;
                vertex.edges.push(edge);
                let qq = tb[edge.index];
                if(qq[0][0].index == oldEdge.index) q = qq[1];
                else if(qq[1][0].index == oldEdge.index) q = qq[0];
                else throw "Internal Error";
            }
        })
    }

    check() {
      this._checkFaces();
      this._checkEdges();
      this._checkVertices();
    }

    _checkFaces() {
        this.faces.forEach(face => {
            let m = face.vertices.length;
            assert(m == face.edges.length);
            assert(m >= 3);
            for(let i=0;i<m;i++) {
                let i1 = (i+1)%m;
                let va = face.vertices[i];
                let vb = face.vertices[i1];
                assert(va != vb);
                let edge = face.edges[i];
                assert(edge.vertices.indexOf(va)>=0);
                assert(edge.vertices.indexOf(vb)>=0);
            }            
        })
    }
    _checkEdges() {
        this.edges.forEach(edge => {
            assert(edge.vertices.length==2);
            assert(edge.faces.length==2);
            edge.faces.forEach(face => {
                assert(face.edges.indexOf(edge)>=0);
            })            
        })
    }
    _checkVertices() {
        this.vertices.forEach(vertex => {
            let m = vertex.faces.length;
            assert(m == vertex.edges.length);
            assert(m>=3);
            for(let i=0;i<m;i++) {
                let i1 = (i+1)%m;
                let e0 = vertex.edges[i];
                let f = vertex.faces[i];
                let e1 = vertex.edges[i1];
                assert(f.edges.indexOf(e0)>=0);
                assert(f.edges.indexOf(e1)>=0);
                assert(e0.faces.indexOf(f)>=0);
                assert(e1.faces.indexOf(f)>=0);
                assert(e0.vertices.indexOf(vertex)>=0);
                assert(f.vertices.indexOf(vertex)>=0);
            }
        });
    }

    
    catmullClark() {
        this.faces.forEach(face => { face.center = face.computeCenter(); });
        this.edges.forEach(edge => { edge.midPoint = edge.computeMidPoint(); });
        let pts = [];
        let fPts = this.faces.map(face => {
            pts.push(face.center); 
            return pts.length-1;
        });
        let ePts = this.edges.map(edge => {
            pts.push(edge.midPoint.scale(2)
                .add(edge.faces[0].center)
                .add(edge.faces[1].center)
                .scale(0.25));
            return pts.length-1;
        });
        let vPts = this.vertices.map(vertex => {
            let p_old = vertex.p;
            let zero = new BABYLON.Vector3(0,0,0);
            let m = vertex.faces.length;
            let p_f = vertex.faces.reduce(
                (a,b)=>a.add(b.center), zero).scale(1/m);
            let p_e = vertex.edges.reduce(
                (a,b)=>a.add(b.midPoint), zero).scale(1/m);
            let p = p_old.scale((m-3)/m)
                .add(p_f.scale(1/m))
                .add(p_e.scale(2/m))
                
            pts.push(p);
            return pts.length-1;
        });
        let faces = [];
        this.faces.forEach(face => {
            let m = face.vertices.length;
            for(let i=0; i<m; i++) {
                let i1 = (i+1)%m;
                faces.push([
                    vPts[face.vertices[i1].index], 
                    ePts[face.edges[i1].index], 
                    fPts[face.index],
                    ePts[face.edges[i].index]]);
            }
        });
        let q = new Polyhedron();
        q.build(pts, faces);
        return q;
    }

    createLineSystem(scene, color, showFaces = false) {
        let lines = [];
        let colors = [];
        let edgeColor = color || new BABYLON.Color4(0.7,0.7,0.2,1.0);
        this.edges.forEach(edge => {
            let p0 = edge.vertices[0].p;
            let p1 = edge.vertices[1].p;            
            lines.push([p0,p1]);
            colors.push([edgeColor, edgeColor]);
        });
        if(showFaces) {
            edgeColor = new BABYLON.Color4(1,0,1,1);
            let nrmColor = new BABYLON.Color4(0,1,1,1);
            this.faces.forEach(face => {
                let center = face.computeCenter();
                let m = face.vertices.length;
                let pts = face.vertices.map(v=>BABYLON.Vector3.Lerp(v.p,center,0.1));
                pts.push(BABYLON.Vector3.Lerp(pts[pts.length-1],pts[0],0.9));
                lines.push(pts);
                colors.push(pts.map(p=>edgeColor));

                pts = face.vertices.map(v=>v.p);
                let c = pts.reduce((a,b)=>a.add(b),new BABYLON.Vector3(0,0,0)).scale(1/pts.length);
                let nrm = BABYLON.Vector3.Cross(
                    pts[0].subtract(c),
                    pts[1].subtract(c)).normalize();
                lines.push([c,c.add(nrm)]);
                colors.push([nrmColor,nrmColor]);
            });
    

        }

        let lineSystem = BABYLON.MeshBuilder.CreateLineSystem(
            "lines", {lines: lines,colors: colors},  scene);
        return lineSystem;
    }

    createMesh(scene) {
        let mesh = new BABYLON.Mesh('a',scene);
        let positions = this.vertices.flatMap(v=>[v.p.x,v.p.y,v.p.z]);
        let indices = [];
        this.faces.forEach(f => {
            let m = f.vertices.length;
            let ii = f.vertices.map(v=>v.index);
            for(let i=1;i+1<m;i++) indices.push(ii[0],ii[i+1],ii[i]);
        });
        // console.log(indices);
        var vd = new BABYLON.VertexData();
        vd.positions = positions;
        vd.indices = indices;
        let normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        vd.normals = normals;
        vd.applyToMesh(mesh);
        return mesh;
    }
};
