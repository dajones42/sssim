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
let scene= null;
let renderer= null;
let center= null;
let listener= null;

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
			let v= findVertex(o.u,o.v);
			center= new THREE.Vector3(o.u,o.v,v.position.z);
			console.log("center "+center.x+" "+center.y+" "+
			  center.z);
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
