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
let cameraVAngle= 0;
let cameraPath= null;
let scene= null;
let renderer= null;
let center= null;
let listener= null;
let modelBoardLights= [];
let leversModel= null;

let initScene= function()
{
	scene= new THREE.Scene();
	let canvas= document.getElementById("canvas3d");
	canvas.addEventListener('mousedown',mouseDown3d);
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
			if (o.levers) {
				leversModel= make3dLevers();
				if (leversModel) {
					leversModel.position.x= o.levers.u;
					leversModel.position.y= o.levers.y;
					leversModel.position.z= -o.levers.v;
					leversModel.rotation.y=
					  o.angle*Math.PI/180;
					scene.add(leversModel);
				}
			}
			if (o.angle)
				cameraAngle= Math.PI-o.angle*Math.PI/180;
//			console.log("cameraangle "+cameraAngle+" "+
//			  Math.cos(cameraAngle)+" "+Math.sin(cameraAngle)+" "+
//			  o.angle+" "+(o.angle*Math.PI/180));
			break;
		}
	}
//	let axes= new THREE.AxesHelper(5);
//	axes.position.y= 4;
//	scene.add(axes);
	//makeTrackLines();
	loadModels();
	setBackground();
}

let render3D= function()
{
	if (!renderer)
		initScene();
	updateModelBoard();
	updateLeverModels();
	let cos= Math.cos(cameraAngle);
	let sin= Math.sin(cameraAngle);
	let cosv= Math.cos(cameraVAngle);
	let sinv= Math.sin(cameraVAngle);
	let lookat= new THREE.Vector3(camera.position.x+cos*cosv,
	  camera.position.y+sinv,camera.position.z+sin*cosv);
	camera.lookAt(lookat);
	renderer.render(scene,camera);
}

let cameraLeft= function()
{
	cameraAngle-= Math.PI/12;
}

let cameraRight= function()
{
	cameraAngle+= Math.PI/12;
}

let cameraUp= function()
{
	cameraVAngle+= Math.PI/12;
}

let cameraDown= function()
{
	cameraVAngle-= Math.PI/12;
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
	if (object.angle) {
		dx= Math.cos(Math.PI-object.angle*Math.PI/180);
		dy= -Math.sin(Math.PI-object.angle*Math.PI/180);
	}
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
	if (object.angle) {
		mesh.rotation.y= object.angle*Math.PI/180-Math.PI/2;
	} else {
		mesh.rotation.y= Math.atan2(dy,dx)+Math.PI/2;
		cameraAngle= Math.atan2(-dy,dx);
	}
	if (mb.distance < 0)
		mesh.rotation.y+= Math.PI;
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

let make3dLevers= function()
{
	let baseIndices= [ 0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7,
	  6, 7, 8, 8, 7, 9, 0, 2, 4, 0, 4, 6, 0, 6, 8, 9, 7, 5, 9, 5, 3,
	  9, 3, 1 ];
	let baseNormals= [ 0.38768, -0.155253, 0.908626,
	  0.392018, 0.0463013, 0.918792, 0.321899, -0.00484563, 0.946762,
	  0.245266, 0.0501866, 0.968156, 0.0554549, -0.0233173, 0.998189,
	  -0.0554549, 0.0233173, 0.998189, -0.245266, -0.0501866, 0.968156,
	  -0.321899, 0.00484563, 0.946762, -0.392018, -0.0463013, 0.918792,
	  -0.38768, 0.155253, 0.908626 ];
	let baseVertices= [ 0.3, -1.27, 0, 0.3, 1.27, 0, 0.15, -1.27,
	  0.064, 0.15, 1.27, 0.064, 0, -1.27, 0.089, 0, 1.27, 0.089,
	  -0.15, -1.27, 0.064, -0.15, 1.27, 0.064, -0.3, -1.27, 0,
	  -0.3, 1.27, 0 ];

	let handleIndices= [ 0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6,
	  0, 6, 7, 0, 8, 1, 1, 8, 9, 1, 9, 2, 2, 9, 10, 2, 10, 3,
	  3, 10, 11, 3, 11, 4, 4, 11, 12, 4, 12, 5, 5, 12, 13, 5, 13, 6,
	  6, 13, 14, 6, 14, 7, 7, 14, 15, 7, 15, 0, 0, 15, 8, 8, 16, 9,
	  9, 16, 17, 9, 17, 10, 10, 17, 18, 10, 18, 11, 11, 18, 19,
	  11, 19, 12, 12, 19, 20, 12, 20, 13, 13, 20, 21, 13, 21, 14,
	  14, 21, 22, 14, 22, 15, 15, 22, 23, 15, 23, 8, 8, 23, 16,
	  16, 23, 27, 16, 27, 24, 16, 24, 17, 18, 17, 24, 18, 24, 25,
	  18, 25, 19, 20, 19, 25, 20, 25, 26, 20, 26, 21, 22, 21, 26,
	  22, 26, 27, 22, 27, 23 ];
	let handleNormals= [ 0.975429, -0.121929, 0.183498,
	  0.788019, 0.615639, 0.00384229, 0.123941, 0.991529, 0.0388524,
	  -0.613979, 0.785893, 0.0735032, -0.988445, 0.123556, 0.0878034,
	  -0.785893, -0.613979, 0.0735032, -0.123941, -0.991529, 0.0388524,
	  0.615639, -0.788019, 0.00384229, 0.991498, 0.130121, 0, 0.615389,
	  0.788224, 3.07017e-10, -0.130121, 0.991498, -3.08189e-10, -0.788224,
	  0.615389, 3.07017e-10, -0.991498, -0.130121, -3.08189e-10, -0.615389,
	  -0.788224, 3.07017e-10, 0.130121, -0.991498, -3.08189e-10, 0.788224,
	  -0.615389, 3.07017e-10, 0.956089, 0.0769132, 0.282804, 0.628255,
	  0.756729, 0.180711, -0.0645776, 0.981577, -0.179824, -0.756729,
	  0.628255, 0.180711, -0.956089, -0.0769132, 0.282804, -0.628255,
	  -0.756729, 0.180711, 0.0645776, -0.981577, -0.179824, 0.756729,
	  -0.628255, 0.180711, 0.479138, 0.838492, -0.259534, -0.479138,
	  0.838492, -0.259534, -0.479138, -0.838492, -0.259534, 0.479138,
	  -0.838492, -0.259534 ];
	let handleVertices= [ 0.02, 0, 1.32, 0.014, 0.014, 1.32, 0, 0.02,
	  1.32, -0.014, 0.014, 1.32, -0.02, 0, 1.32, -0.014, -0.014, 1.32,
	  0, -0.02, 1.32, 0.014, -0.014, 1.32, 0.017, 0, 1.038,
	  0.012, 0.012, 1.038, 0, 0.017, 1.038, -0.012, 0.012, 1.038,
	  -0.017, 0, 1.038, -0.012, -0.012, 1.038, 0, -0.017, 1.038,
	  0.012, -0.012, 1.038, 0.02, 0, 1.012, 0.014, 0.014, 1.012,
	  0, 0.02, 1.012, -0.014, 0.014, 1.012, -0.02, 0, 1.012,
	  -0.014, -0.014, 1.012, 0, -0.02, 1.012, 0.014, -0.014, 1.012,
	  0.025, 0.01, 1, -0.025, 0.01, 1, -0.025, -0.01, 1, 0.025, -0.01, 1 ];

	let barIndices= [ 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7,
	  3, 7, 0, 0, 7, 4, 8, 12, 9, 9, 12, 13, 9, 13, 10, 10, 13, 14,
	  10, 14, 11, 11, 14, 15, 11, 15, 8, 8, 15, 12 ];
	let barNormals= [ 0.624687, 0.780859, 0.0049975,
	  -0.169907, 0.985459, 0.00135925, -0.624687, -0.780859, 0.0049975,
	  0.169907, -0.985459, 0.00135925, 0.169907, 0.985459, 0.00135925,
	  -0.518297, 0.855191, 0.00414638, -0.169907, -0.985459, 0.00135925,
	  0.518297, -0.855191, 0.00414638, 0.948656, -0.316219, -0.00758925,
	  0.316227, 0.94868, -0.00252981, -0.948656, 0.316219, 0.00758925,
	  -0.316227, -0.94868, 0.00252981, 0.948656, 0.316219, -0.00758925,
	  -0.316227, 0.94868, 0.00252981, -0.948656, -0.316219, 0.00758925,
	  0.316227, -0.94868, -0.00252981 ];
	let barVertices= [ 0.025, 0.01, 1, -0.025, 0.01, 1, -0.025,
	  -0.01, 1, 0.025, -0.01, 1, 0.033, 0.01, 0, -0.033, 0.01,
	  0, -0.033, -0.01, 0, 0.033, -0.01, 0, -0.032, 0,
	  0.873, -0.038, 0.006, 0.873, -0.044, 0, 0.873, -0.038, -0.006,
	  0.873, -0.04, 0, -0.127, -0.046, 0.006, -0.127, -0.052, 0,
	  -0.127, -0.046, -0.006, -0.127 ];

	let latchIndices= [ 0, 1, 2, 0, 2, 3, 4, 0, 5, 5, 0, 1, 5, 1, 6,
	  6, 1, 2, 6, 2, 7, 7, 2, 3, 7, 3, 4, 4, 3, 0, 8, 4, 9, 9, 4, 5,
	  9, 5, 10, 10, 5, 6, 10, 6, 11, 11, 6, 7, 11, 7, 8, 8, 7, 4,
	  12, 8, 13, 13, 8, 9, 13, 9, 14, 14, 9, 10, 14, 10, 15, 15, 10, 11,
	  15, 11, 12, 12, 11, 8, 16, 12, 17, 17, 12, 13, 17, 13, 18,
	  18, 13, 14, 18, 14, 19, 19, 14, 15, 19, 15, 16, 16, 15, 12 ];
	let latchNormals= [ 0.0822358, 0.314431, 0.945712,
	  -0.352924, 0.311404, 0.882311, -0.0822358, -0.314431, 0.945712,
	  0.352924, -0.311404, 0.882311, 0.453029, 0.888292, -0.0755049,
	  -0.453029, 0.888292, 0.0755049, -0.453029, -0.888292, -0.0755049,
	  0.453029, -0.888292, 0.0755049, 0.444967, 0.831042, 0.333726,
	  -0.558056, 0.820671, 0.122772, -0.46657, -0.871389, 0.151635,
	  0.501719, -0.737823, 0.451548, 0.532948, 0.790017, 0.303049,
	  -0.763846, 0.630593, -0.13745, -0.55862, -0.828073, -0.0473184,
	  0.732489, -0.604706, 0.312716, 0.87583, 0.364929, 0.31583,
	  -0.386081, 0.920654, -0.0577771, -0.904414, -0.376839, -0.200067,
	  0.381436, -0.909578, 0.164844, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];
	let latchVertices= [ 0.03, 0.017, 0, -0.03, 0.017, 0,
	  -0.03, -0.017, 0, 0.03, -0.017, 0, 0.035, 0.017, 0.01,
	  -0.035, 0.017, 0.01, -0.035, -0.017, 0.01, 0.035, -0.017, 0.01,
	  0.03, 0.017, 0.02, -0.03, 0.017, 0.02, -0.03, -0.017, 0.02,
	  0.03, -0.017, 0.02, 0.01, 0.017, 0.04, -0.027, 0.017, 0.04,
	  -0.027, -0.017, 0.04, 0.01, -0.017, 0.04, -0.028, 0.013, 0.15,
	  -0.053, 0.013, 0.15, -0.053, -0.013, 0.15, -0.028, -0.013, 0.15,
	  -0.068, 0.009, 0.28, -0.087, 0.009, 0.28, -0.087, -0.009, 0.28,
	  -0.068, -0.009, 0.28 ];

	let lhandleIndices= [ 4, 0, 5, 5, 0, 1, 5, 1, 6, 6, 1, 2, 6, 2, 7,
	  7, 2, 3, 7, 3, 4, 4, 3, 0, 4, 5, 6, 4, 6, 7 ];
	let lhandleNormals= [ 0.500417, 0.84686, 0.180032,
	  -0.850519, 0.483249, -0.207574, -0.505865, -0.85608, -0.105962,
	  0.836661, -0.475375, 0.272061, 0.851084, 0.367513, 0.374953,
	  -0.378589, 0.92544, -0.0152083, -0.911723, -0.393699, -0.117313,
	  0.371257, -0.907518, 0.196417 ];
	let lhandleVertices= [ -0.028, 0.013, 0.15, -0.053, 0.013, 0.15,
	  -0.053, -0.013, 0.15, -0.028, -0.013, 0.15, -0.068, 0.009, 0.28,
	  -0.087, 0.009, 0.28, -0.087, -0.009, 0.28, -0.068, -0.009, 0.28 ];

	let shoeIndices= [ 0, 1, 2, 0, 2, 3, 4, 7, 6, 4, 6, 5, 0, 4, 1,
	   1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4 ];
	let shoeNormals= [ 0.264857, 0.932297, -0.246317,
	   0.719029, -0.675887, -0.161782, -0.265536, -0.934687, -0.236327,
	   -0.722097, 0.678771, -0.133588, 0.735453, 0.603072, 0.30889,
	   0.271495, -0.955661, 0.114028, -0.72855, -0.597411, 0.335133,
	   -0.271143, 0.954424, 0.124726 ];
	let shoeVertices= [ 0.034, 0.025, 0, 0.034, -0.025, 0,
	   -0.06, -0.025, 0, -0.06, 0.025, 0, 0.032, 0.025, 0.2,
	   0.032, -0.025, 0.2, -0.05, -0.025, 0.2, -0.05, 0.025, 0.2 ];

	let makeGeometry= function(vertices,normals,indices) {
		let geom= new THREE.BufferGeometry;
		geom.setAttribute("position",
		 new THREE.Float32BufferAttribute(vertices,3));
		geom.setAttribute("normal",
		 new THREE.Float32BufferAttribute(normals,3));
		geom.setIndex(indices);
		return geom;
	}
	let barGeom= makeGeometry(barVertices,barNormals,barIndices);
	let latchGeom= makeGeometry(latchVertices,latchNormals,latchIndices);
	let handleGeom= makeGeometry(handleVertices,handleNormals,
	  handleIndices);
	let lhandleGeom= makeGeometry(lhandleVertices,lhandleNormals,
	  lhandleIndices);
	let baseGeom= makeGeometry(baseVertices,baseNormals,baseIndices);
	let shoeGeom= makeGeometry(shoeVertices,shoeNormals,shoeIndices);
//	let handleMat= new THREE.MeshStandardMaterial({color:"#bbbbbb",
//	  metalness:1,roughness:.2});
//	let handleMat= new THREE.MeshBasicMaterial({color:"#bbbbbb"});
	let handleMat= new THREE.MeshPhongMaterial({color:"#bbbbbb",
	  shininess:128});
	let redMat= new THREE.MeshBasicMaterial({color:"#aa0000"});
	let blueMat= new THREE.MeshBasicMaterial({color:"#0000aa"});
	let blackMat= new THREE.MeshBasicMaterial({color:"#000000"});
	let greyMat= new THREE.MeshBasicMaterial({color:"#888888"});
	let baseMat= new THREE.MeshBasicMaterial({color:"#444444"});
	let shoeMat= new THREE.MeshBasicMaterial({color:"#333333"});
	let root= new THREE.Group();
	let base= new THREE.Mesh(baseGeom,baseMat);
	let n= interlocking.levers.length;
	base.scale.y= n/20;
	root.add(base);
	for (let i=0; i<n; i++) {
		let lever= interlocking.levers[i];
		let group= new THREE.Group();
		group.position.x= .02;
		group.position.y= .127*(i-(n-1)/2);
		group.position.z= -.534;
		group.rotation.y= -10/180*Math.PI;
		lever.model= group;
		group.userData.lever= i+1;
		root.add(group);
		let mesh= new THREE.Mesh(handleGeom,handleMat);
		mesh.position.z= .483;
		mesh.userData.lever= i+1;
		group.add(mesh);
		mesh= new THREE.Mesh(shoeGeom,shoeMat);
		mesh.position.z= .583;
		group.add(mesh);
		let mat= null;
		if (lever.color == "#a00")
			mat= redMat;
		else if (lever.color == "#00a")
			mat= blueMat;
		else if (lever.color == "#000")
			mat= blackMat;
		else
			mat= greyMat;
		mesh= new THREE.Mesh(barGeom,mat);
		mesh.position.z= .483;
		mesh.userData.lever= i+1;
		group.add(mesh);
		if (mat != greyMat) {
			mesh= new THREE.Mesh(latchGeom,mat);
			mesh.position.x= -.015;
			mesh.position.z= 1.356;
			mesh.userData.lever= i+1;
			group.add(mesh);
			mesh.add(new THREE.Mesh(lhandleGeom,handleMat));
		}
	}
	root.rotation.x= -Math.PI/2;
	let model= new THREE.Group();
	model.add(root);
	return model;
}

let updateLeverModels= function()
{
	for (let i=0; i<interlocking.levers.length; i++) {
		let lever= interlocking.levers[i];
		if (!lever.model)
			continue;
		let angle= 0;
		if (lever.state == Interlocking.NORMAL)
			angle= -10/180*Math.PI;
		else if (lever.state == Interlocking.REVERSE)
			angle= 17/180*Math.PI;
		lever.model.rotation.y= angle;
	}
}

let mouseDown3d= function(event)
{
	if (!leversModel)
		return;
	let canvas= document.getElementById('canvas3d');
	downX= event.pageX-canvas.offsetLeft;
	downY= event.pageY-canvas.offsetTop;
	let click= new THREE.Vector2();
	click.x= 2*(downX/canvas.width) - 1;
	click.y= -2*(downY/canvas.height) + 1;
	let raycaster= new THREE.Raycaster();
	raycaster.setFromCamera(click,camera);
	let intersects= raycaster.intersectObject(leversModel);
	if (intersects.length <= 0)
		return;
	let lever= intersects[0].object.userData.lever;
	if (lever>0 && lever<=interlocking.levers.length &&
	  interlocking.toggleState(lever,simTime))
		renderLevers();
	event.preventDefault();
}
