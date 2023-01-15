/*
Copyright © 2022 Doug Jones

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

let camera= null;
let cameraAngle= 0;
let cameraPath= null;
let scene= null;
let renderer= null;
let center= null;
let listener= null;
let modelBoardLights= [];

let initScene= function()
{
	scene= new THREE.Scene();
	let canvas= document.getElementById("canvas3d");
	let aspect= canvas.width/canvas.height;
	camera= new THREE.PerspectiveCamera(45,aspect,.1,1000);
	camera.position.y= 2;
	listener= new THREE.AudioListener();
	camera.add(listener);
	renderer= new THREE.WebGLRenderer({canvas:canvas});
	renderer.setClearColor(0x00dddd);
//	renderer.sortObjects= false;
	let alight= new THREE.AmbientLight(0xaaaaaa);
	scene.add(alight);
	let dlight= new THREE.DirectionalLight(0xffffff,.5);
	dlight.position.set(0,100,50);
	scene.add(dlight);
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.type == "camera") {
			centerU= o.u;
			centerV= o.v;
			if (o.y)
				camera.position.y= o.y;
			let v= findVertex(o.u,o.v);
			center= new THREE.Vector3(o.u,o.v,v.position.z);
			console.log("center "+center.x+" "+center.y+" "+
			  center.z);
			if (o.path)
				cameraPath= o.path;
			if (o.modelBoard)
				createModelBoard(o);
			if (o.building) {
				let path= sssimDir+fspath.sep+o.building.shape;
				let model=
				  getMstsModel(path,sssimDir,null,null,0);
				if (model) {
					model.position.x= 0;
					model.position.y= o.building.y;
					model.position.z= 0;
					model.rotation.y=
					  o.angle*Math.PI/180-Math.PI/2;
					scene.add(model);
				}
			}
			if (o.angle)
				cameraAngle= o.angle*Math.PI/180-Math.PI/2;
			console.log("cameraangle "+cameraAngle+" "+
			  Math.cos(cameraAngle)+" "+Math.sin(cameraAngle)+" "+
			  o.angle+" "+(o.angle*Math.PI/180));
			break;
		}
	}
	//makeTrackLines();
	loadModels();
	setBackground();
}

let render3D= function()
{
	if (!renderer)
		initScene();
	updateModelBoard();
	let lookat= new THREE.Vector3(camera.position.x+Math.cos(cameraAngle),
	  camera.position.y,camera.position.z+Math.sin(cameraAngle));
	camera.lookAt(lookat);
	renderer.render(scene,camera);
}

let cameraLeft= function()
{
	cameraAngle-= Math.PI/12;
//	console.log("angle "+cameraAngle);
}

let cameraRight= function()
{
	cameraAngle+= Math.PI/12;
//	console.log("angle "+cameraAngle);
}

let moveCamera= function(up)
{
	if (!cameraPath)
		return;
	let besti= 0;
	let bestd= 1e10;
	for (let i=0; i<cameraPath.length; i++) {
		let p= cameraPath[i];
		let dx= p[0]-center.x - camera.position.x;
		let dy= p[2] - camera.position.y;
		let dz= camera.position.z - (center.y-p[1]);
		let d= Math.sqrt(dx*dx + dy*dy + dz*dz);
		if (d < bestd) {
			bestd= d;
			besti= i;
		}
	}
	if (up && besti<cameraPath.length-1)
		besti++;
	else if (!up && besti>0)
		besti--;
	let p= cameraPath[besti];
	camera.position.x= p[0]-center.x;
	camera.position.y= p[2];
	camera.position.z= center.y-p[1];
}

let makeTrackLines= function()
{
	let verts= [];
	for (let i=0; i<edges.length; i++) {
		let e= edges[i];
		if (center.distanceTo(e.v1.position)<1000 ||
		  center.distanceTo(e.v2.position)<1000) {
			verts.push(e.v1.position.x-center.x);
			verts.push(e.v1.position.z-center.z);
			verts.push(-(e.v1.position.y-center.y));
			verts.push(e.v2.position.x-center.x);
			verts.push(e.v2.position.z-center.z);
			verts.push(-(e.v2.position.y-center.y));
		}
	}
	let bgeom= new THREE.BufferGeometry;
	console.log("set");
//	bgeom.setAttribute("position",
//	  new THREE.BufferAttribute(new Float32Array(verts),3));
	bgeom.setAttribute("position",
	  new THREE.Float32BufferAttribute(verts,3));
	let mat= new THREE.LineBasicMaterial({ color: 0x000000 } );
	console.log("lines");
	let lines= new THREE.LineSegments(bgeom,mat);
	scene.add(lines);
}

//	load the 3d models based on the current display center
let loadModels= function()
{
	let tx= centerTX + Math.round(centerU/2048);
	let tz= centerTZ + Math.round(centerV/2048);
	for (let i=-1; i<2; i++) {
		for (j=-1; j<2; j++) {
			let x= 2048*((tx+i)-centerTX);
			let z= -2048*((tz+j)-centerTZ);
			let dx= x-centerU;
			let dz= z+centerV;
			if (Math.abs(dx)>2000 || Math.abs(dz)>2000)
				continue;
			let ground= makeGroundModel(tx+i,tz+j);
			ground.position.x= 2048*(tx+i-centerTX)-center.x;
			ground.position.y= -center.z;
			ground.position.z= -2048*(tz+j-centerTZ)+center.y;
			scene.add(ground);
//			console.log("ground "+ground.position.x+" "+
//			  ground.position.y+" "+ground.position.z);
			loadTileModels(tx+i,tz+j);
		}
	}
}

let setBackground= function()
{
	let path= routeDir+fspath.sep+"ENVFILES"+fspath.sep+
	  "TEXTURES"+fspath.sep+background;
	let img= readMstsAce(path,false);
	if (img) {
		let texture= new THREE.CubeTexture([img,img,img,img,img,img]);
		texture.wrapS= THREE.RepeatWrapping;
		texture.wrapT= THREE.RepeatWrapping;
		texture.flipY= false;
		texture.needsUpdate= true;
		scene.background= texture;
	}
}

let createModelBoard= function(object)
{
	let loc= findLocation(object.u,object.v);
	let tp= loc.loc.getPosition();
	let dx= tp.x-center.x;
	let dy= tp.y-center.y;
	let d= Math.sqrt(dx*dx+dy*dy);
	dx/= d;
	dy/= d;
	let mb= object.modelBoard;
	let plane= new THREE.PlaneGeometry(mb.width,mb.height);
	let mat= null;
	if (mb.image) {
		let path= sssimDir+fspath.sep+mb.image;
		let img= readMstsAce(path,true);
		let texture= new THREE.Texture(img);
		texture.wrapS= THREE.RepeatWrapping;
		texture.wrapT= THREE.RepeatWrapping;
		texture.flipY= false;
		texture.needsUpdate= true;
		mat= new THREE.MeshBasicMaterial({ map: texture } );
	} else {
		mat= new THREE.MeshBasicMaterial({ color: 0x000000 } );
	}
	let mesh= new THREE.Mesh(plane,mat);
	mesh.position.x= -mb.distance*dx;
	mesh.position.y= camera.position.y+mb.vOffset;
	mesh.position.z= mb.distance*dy;
	mesh.rotation.y= Math.atan2(dy,dx)+Math.PI/2;
	cameraAngle= Math.atan2(-dy,dx);
	scene.add(mesh);
	if (mb.lights) {
		for (let i=0; i<mb.lights.length; i++) {
			let light= mb.lights[i];
			let geom= new THREE.CircleGeometry(light.radius);
			let mat= new THREE.MeshBasicMaterial({ color:
			   parseInt(light.color,16) });
			let lmesh= new THREE.Mesh(geom,mat);
			lmesh.position.x= light.x;
			lmesh.position.y= light.y;
			lmesh.position.z= .01;
			mesh.add(lmesh);
			if (light.trackCircuit) {
				let tc= trackCircuits[light.trackCircuit];
				if (tc) {
					modelBoardLights.push({
						trackCircuit: tc,
						model: lmesh
					});
				} else {
					console.error("unknown track circuit "+
					  light.trackCircuit);
				}
			}
			if (light.lever) {
				modelBoardLights.push({
					lever: light.lever,
					model: lmesh
				});
			}
		}
	}
}

let updateModelBoard= function()
{
	for (let i=0; i<modelBoardLights.length; i++) {
		let mbl= modelBoardLights[i];
		if (mbl.trackCircuit) {
			if (mbl.trackCircuit.occupied)
				mbl.model.rotation.y= 0;
			else
				mbl.model.rotation.y= Math.PI;
		}
		if (mbl.lever) {
			let ind= interlocking.getSignalState(mbl.lever,false);
			if (ind > 0)
				mbl.model.rotation.y= 0;
			else
				mbl.model.rotation.y= Math.PI;
		}
	}
}
