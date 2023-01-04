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

//	Code for creating three.js models from MSTS files in nw.js

//const fspath= require('path');

let mstsModelMap= {};
let mstsMaterialMap= {};

let getMstsMaterial= function(acefile,transparent,texDir1,texDir2,alphaTest,
  lightMatIdx)
{
	let id= texDir1+fspath.sep+acefile+transparent+alphaTest+lightMatIdx;
	let mat= mstsMaterialMap[id];
	if (mat)
		return mat;
	if (texDir2) {
		id= texDir2+fspath.sep+acefile+transparent+alphaTest+
		  lightMatIdx;
		mat= mstsMaterialMap[id];
		if (mat)
			return mat;
	}
	let path= texDir1+fspath.sep+acefile;
	let img= readMstsAce(path,!transparent);
	if (texDir2 && !img) {
		path= texDir2+fspath.sep+acefile;
		img= readMstsAce(path,!transparent);
	}
	if (img) {
		let texture= new THREE.Texture(img);
		texture.wrapS= THREE.RepeatWrapping;
		texture.wrapT= THREE.RepeatWrapping;
		texture.flipY= false;
		texture.needsUpdate= true;
		if (lightMatIdx == -9)
			mat= new THREE.MeshBasicMaterial({ map: texture } );
		else if (lightMatIdx == -6)
			mat= new THREE.MeshPhongMaterial({
			  map: texture, shininess: 4 } );
		else if (lightMatIdx == -7)
			mat= new THREE.MeshPhongMaterial({
			  map: texture, shininess: 128 } );
		else if (lightMatIdx == -10)
			mat= new THREE.MeshLambertMaterial({
			  map: texture, emissive: 0xffffff } );
		else if (lightMatIdx == -11)
			mat= new THREE.MeshLambertMaterial({
			  map: texture, color: 0xcccccc } );
		else if (lightMatIdx == -12)
			mat= new THREE.MeshLambertMaterial({
			  map: texture, color: 0x888888 } );
		else
			mat= new THREE.MeshLambertMaterial({ map: texture } );
	} else {
		mat= new THREE.MeshBasicMaterial({ color: 0xdddddd } );
	}
	mat.transparent= transparent;
	if (alphaTest)
		mat.alphaTest= 200/255;//value used by OR
	id= path+transparent+alphaTest+lightMatIdx;
	mstsMaterialMap[id]= mat;
//	if (lightMatIdx != -5)
//		console.log("lightMatIdx "+lightMatIdx+" "+id);
	return mat;
}

//	Creates a Three.js Object3d for an MSTS shape file.
//	Saves geometry and material info so it can be shared by multiple
//	copies and eventually displosed of.
//	Adds railcar parts if car is defined.
let getMstsModel= function(shapePath,texDir1,texDir2,car,roOffset)
{
	let shapeData= mstsModelMap[shapePath];
	if (!shapeData) {
		let shape= readMstsShape(shapePath);
		if (!shape)
			return null;
		let dLevel= shape.distLevels[0];
		for (let i=1; i<shape.distLevels.length; i++)
			if (dLevel.dist > shape.distLevels[i].dist)
				dLevel= shape.distLevels[i];
		shapeData= {
			count: 0,
			matrices: [],
			geometry: []
		};
		if (shape.animations && shape.animations.length>0)
			shapeData.animations= shape.animations;
		mstsModelMap[shapePath]= shapeData;
		for (let i=0; i<shape.matrices.length; i++) {
			var m= shape.matrices[i].mat;
			var matrix= new THREE.Matrix4();
			matrix.set(m[0],m[3],m[6],m[9],
			  m[1],m[4],m[7],m[10],
			  m[2],m[5],m[8],m[11],
			  0,0,0,1);
			shapeData.matrices.push({
				name: shape.matrices[i].name,
				matrix: matrix,
				parent: dLevel.hierarchy[i]
			});
		}
		for (let i=0; i<dLevel.subObjects.length; i++) {
			let so= dLevel.subObjects[i];
			for (let j=0; j<so.primStateIdxs.length; j++) {
				let psi= so.primStateIdxs[j];
				let triList= so.triLists[j];
				let primState= shape.primStates[psi];
				for (let k=0; k<so.vertices.length; k++)
					so.vertices[k].index= -1;
				let nv= 0;
				for (let k=0; k<triList.vertexIdxs.length;
				  k++) {
					let k1= triList.vertexIdxs[k];
					if (so.vertices[k1].index < 0)
						so.vertices[k1].index= nv++;
				}
				nv= 0;
				let verts= [];
				let normals= [];
				let uvs= [];
				for (let k=0; k<so.vertices.length; k++) {
					if (so.vertices[k].index < 0)
						continue;
					so.vertices[k].index= nv++;
					let k1= so.vertices[k].pointIndex;
					let point= shape.points[k1];
					if (point)
						verts.push(point[0],point[1],
						  point[2]);
					else
						verts.push(0,0,0);
					let ni= so.vertices[k].normalIndex;
					let normal= shape.normals[ni];
					if (normal)
						normals.push(normal[0],
						  normal[1],normal[2]);
					else
						normals.push(0,0,0);
					let uvi= so.vertices[k].uvIndex;
					let uv= shape.uvPoints[uvi];
					if (uv)
						uvs.push(uv[0],uv[1]);
					else
						uvs.push(0,0);
				}
				let indices= [];
				for (let k=0; k<triList.vertexIdxs.length;
				  k+=3) {
					let k1= triList.vertexIdxs[k];
					let k2= triList.vertexIdxs[k+1];
					let k3= triList.vertexIdxs[k+2];
					let v1= so.vertices[k1].index;
					let v2= so.vertices[k2].index;
					let v3= so.vertices[k3].index;
					indices.push(v1,v2,v3);
				}
//				console.log("verts "+verts.length);
//				console.log("indices "+indices.length);
				let bgeom= new THREE.BufferGeometry;
				bgeom.setAttribute("position",
				 new THREE.Float32BufferAttribute(verts,3));
				bgeom.setAttribute("normal",
				 new THREE.Float32BufferAttribute(normals,3));
				bgeom.setIndex(indices);
//				bgeom.setIndex(
//				 new THREE.Uint32BufferAttribute(indices,3));
//				bgeom.setAttribute("index",
//				 new THREE.Uint32BufferAttribute(indices,3));
				bgeom.setAttribute("uv",
				 new THREE.Float32BufferAttribute(uvs,2));
				let shader=
				  shape.shaders[primState.shaderIndex];
				let transparent=
				  (shader.substr(0,5).toLowerCase()=="blend");
				let aceFile= shape.images[shape.textures[
				  primState.texIdx]];
				let alphaTest=
				  primState.alphaTestMode?true:false;
				let vtxState=
				  shape.vtxStates[primState.vStateIndex];
				shapeData.geometry.push({
				  geometry: bgeom,
				  material: getMstsMaterial(aceFile,
				    transparent,texDir1,texDir2,alphaTest,
				    vtxState.lightMatIdx),
				  matrixIndex: vtxState.matIdx
				});
			}
		}
	}
	for (let i=0; i<shapeData.matrices.length; i++) {
		var obj= new THREE.Group();
		obj.name= shapeData.matrices[i].name;
		var matrix= shapeData.matrices[i].matrix;
		shapeData.matrices[i].object= obj;
		matrix.decompose(obj.position,obj.quaternion,obj.scale);
		shapeData.matrices[i].part= -1;
	}
	let root= null;
	for (let i=0; i<shapeData.matrices.length; i++) {
		var parent= shapeData.matrices[i].parent;
		var obj= shapeData.matrices[i].object;
		if (parent < 0) {
			root= obj;
			obj.rotation.y= -Math.PI/2;
			obj.scale.z= -1;
		} else {
			shapeData.matrices[parent].object.add(obj);
		}
	}
	for (let i=0; i<shapeData.geometry.length; i++) {
		let geom= shapeData.geometry[i];
		let mesh= new THREE.Mesh(geom.geometry,geom.material);
		shapeData.matrices[geom.matrixIndex].object.add(mesh);
		mesh.renderOrder= roOffset+i;
	}
	shapeData.count++;
	root.userData= shapeData;
	if (car) {
		let setRenderOrder= function(obj,value) {
			for (let i=0; i<obj.children.length; i++)
				obj.children[i].renderOrder= value;
		}
		car.mainWheelRadius= 0;
		for (let i=0; i<shapeData.matrices.length; i++) {
			let mat= shapeData.matrices[i];
			if (mat.name.toLowerCase().substr(0,6)=="wheels") {
				let radius= mat.object.position.y;
				if (mat.parent>=0)
					radius+= shapeData.matrices[
					  mat.parent].object.position.y;
				mat.part= car.parts.length;
				car.parts.push(new RailCarPart(
				  mat.object.position.z,mat.object,radius));
				if (car.mainWheelRadius < radius)
					car.mainWheelRadius= radius;
				setRenderOrder(mat.object,roOffset-2);
//				console.log("wheel "+i+" "+radius+" "+
//				  shapePath);
			}
		}
		car.nWheels= car.parts.length;
		for (let i=0; i<shapeData.matrices.length; i++) {
			let mat= shapeData.matrices[i];
			if (mat.name.toLowerCase().substr(0,5)=="bogie") {
				mat.part= car.parts.length;
				car.parts.push(new RailCarPart(
				  mat.object.position.z,mat.object,0));
				setRenderOrder(mat.object,roOffset-1);
			}
		}
		car.parts.push(new RailCarPart(root.position.x,root,0));
		for (let i=0; i<shapeData.matrices.length; i++) {
			let mat= shapeData.matrices[i];
			if (mat.part>=0 && mat.parent>=0) {
				let matp= shapeData.matrices[mat.parent];
				car.parts[mat.part].parent=
				 matp.part<0 ? car.parts.length-1 : matp.part;
			}
		}
		for (let i=shapeData.matrices.length-1; i>=0; i--) {
			let mat= shapeData.matrices[i];
			if (mat.part >= 0) {
				let part= car.parts[mat.part];
				if (part.parent >= 0)
					part.xOffset+=
					  car.parts[part.parent].xOffset;
			}
		}
//		console.log("nwheels "+car.nWheels);
//		for (let i=0; i<car.parts.length; i++) {
//			let part= car.parts[i];
//			console.log("part "+i+" "+part.parent+" "+part.xOffset);
//		}
		let makeTrack= function(name,controller) {
			if (controller.length < 2)
				return null;
			let times= [];
			let values= [];
			let type= null;
			for (let i=0; i<controller.length; i++) {
				let c= controller[i];
//				console.log("track "+i+" "+c.frame+" "+
//				  name+" "+c.type);
				type= c.type;
				times.push(c.frame/(controller.length-1));
				if (type == "position")
					values.push(c.x,c.y,c.z);
				else
					values.push(c.x,c.y,c.z,c.w);
			}
			if (type == "position")
				return new THREE.VectorKeyframeTrack(
				  name+".position",times,values);
			else
				return new THREE.QuaternionKeyframeTrack(
				  name+".quaternion",times,values);
		}
		if (shapeData.animations) {
//			console.log("nwheels "+car.nWheels);
//			console.log("animations "+shapeData.animations.length);
			let tracks= [];
			for (let i=0; i<shapeData.animations.length; i++) {
				let animation= shapeData.animations[i];
				for (let j=0; j<animation.nodes.length; j++) {
					let node= animation.nodes[j];
					for (let k=0; k<node.controllers.length;
					  k++) {
						let track= makeTrack(node.name,
						  node.controllers[k]);
						if (track)
							tracks.push(track);
					}
				}
			}
			if (tracks.length > 0) {
//				console.log("animtracks "+tracks.length);
				let clip=
				  new THREE.AnimationClip("rods",-1,tracks);
				let mixer= new THREE.AnimationMixer(root);
				mixer.clipAction(clip).play();
				car.animation= mixer;
			}
		}
	}
	return root;
}

//	create a 3d model for the specified tiles terrain
let makeGroundModel= function(tx,tz)
{
	let tile= findTile(tx,tz);
	if (!tile) {
		console.log("no tile "+tx+" "+tz);
		return null;
	}
	console.log("makegroundmodel "+tx+" "+tz+" "+tile.filename);
	for (let i=0; i<tile.textures.length; i++)
		console.log("tex "+i+" "+tile.textures[i]);
	for (let i=0; i<tile.microTextures.length; i++)
		console.log("microtex "+i+" "+tile.microTextures[i]);
	let group= new THREE.Group();
	for (let i=0; i<16; i++) {
		for (let j=0; j<16; j++) {
			group.add(makePatchModel(tile,tile.patches[16*i+j],
			  16*i,16*j))
		}
	}
	return group;
	let nv= 0;
	let verts= [];
	let indices= [];
	for (let i=0; i<256; i++) {
		for (let j=0; j<256; j++) {
			let a00= getTerrainElevation(i,j,tile);
			let a10= getTerrainElevation(i+1,j,tile);
			let a11= getTerrainElevation(i+1,j+1,tile);
			let a01= getTerrainElevation(i,j+1,tile);
			verts.push(8*(j-128),a00,8*(i-128));
			verts.push(8*(j-128),a10,8*(i+1-128));
			verts.push(8*(j+1-128),a11,8*(i+1-128));
			verts.push(8*(j+1-128),a01,8*(i-128));
			indices.push(nv+0,nv+1,nv+2);
			indices.push(nv+2,nv+3,nv+0);
			nv+= 4;
		}
	}
	var geom= new THREE.BufferGeometry();
	geom.setAttribute("position",
	 new THREE.Float32BufferAttribute(verts,3));
	geom.setIndex(indices);
	geom.computeBoundingSphere();
	return new THREE.Mesh(geom,
	  new THREE.MeshBasicMaterial( { color: 0x888800 } ));
}

let makePatchModel= function(tile,patch,i0,j0)
{
	let verts= [];
	let uvs= [];
	let normals= [];
	let indices= [];
	for (let i=0; i<=16; i++) {
		for (let j=0; j<=16; j++) {
			let a= getTerrainElevation(i0+i,j0+j,tile);
			verts.push(8*(j0+j-128),a,8*(i0+i-128));
			let u= patch.u0 + patch.dudx*j + patch.dudz*i;
			let v= patch.v0 + patch.dvdx*j + patch.dvdz*i;
			uvs.push(u,v);
			normals.push(0,1,0);
			if (i<16 && j<16) {
				let idx= i*17+j;
				indices.push(idx,idx+17,idx+1);
				indices.push(idx+1,idx+17,idx+18);
			}
		}
	}
	var geom= new THREE.BufferGeometry();
	geom.setAttribute("position",
	 new THREE.Float32BufferAttribute(verts,3));
	geom.setAttribute("normal",
	 new THREE.Float32BufferAttribute(normals,3));
	geom.setAttribute("uv",
	 new THREE.Float32BufferAttribute(uvs,2));
	geom.setIndex(indices);
	let rtpath= routeDir+fspath.sep+"TERRTEX";
	let mat= getMstsMaterial(tile.textures[patch.texIndex],false,
	  rtpath,null,false,-5);
	geom.computeBoundingSphere();
	return new THREE.Mesh(geom,mat);
}

let loadTileModels= function(tx,tz)
{
	let tile= findTile(tx,tz);
	if (!tile) {
		console.log("no tile "+tx+" "+tz);
		return null;
	}
	console.log("loadtilemodels "+tx+" "+tz);
	let objects= readMstsWorld(tile);
	if (!objects)
		return;
	let gtpath= mstsDir+fspath.sep+"GLOBAL"+fspath.sep+"TEXTURES";
	let rtpath= routeDir+fspath.sep+"TEXTURES";
	for (let i=0; i<objects.length; i++) {
		let object= objects[i];
		if (!object.position || !object.qdirection)
			continue;
		let model= null;
//		console.log("type "+object.type);
		if (object.filename) {
			let global= object.staticFlags &&
			  (object.staticFlags&0x00200000)!=0;
			let spath= global ?
			  mstsDir+fspath.sep+"GLOBAL"+fspath.sep+"SHAPES" :
			  routeDir+fspath.sep+"SHAPES";
			spath+= fspath.sep+object.filename;
			model= getMstsModel(spath,rtpath,gtpath,null,0);
			if (!model)
				continue;
		} else if (object.type == "dyntrack") {
			model= makeDynTrackModel(object);
		} else if (object.type == "forest") {
			model= makeForestModel(object,tx,tz);
		}
		model.position.x=
		  2048*(tx-centerTX)+object.position[0]-center.x;
		model.position.y= object.position[1]-center.z;
		model.position.z=
		  -2048*(tz-centerTZ)-object.position[2]+center.y;
		let qdir= object.qdirection;
		let q= new THREE.Quaternion(
		  qdir[0],qdir[1],qdir[2],qdir[3]);
		model.setRotationFromQuaternion(q);
//		if (object.type == "dyntrack") {
//			console.log("rot "+model.rotation.x+" "+
//			  model.rotation.y+" "+model.rotation.z+" "+
//			  qdir[0]+" "+qdir[1]+" "+qdir[2]+" "+qdir[3]);
//		}
		scene.add(model);
	}
	console.log("done "+tx+" "+tz+" "+objects.length);
}

let makeDynTrackModel= function(object)
{
	let headingVector= function(angle) {
		let a= angle*Math.PI/180;
		let dx= Math.sin(a);
		let dz= Math.cos(a);
		return new THREE.Vector3(dx,0,dz);
	}
//	console.log("dyntrack");
	let p= new THREE.Vector3(0,0,0);
	let heading= 0;
	let centerLine= [{ point:p.clone(), perp: headingVector(90) }];
	for (let i=0; i<object.trackSections.length; i++) {
		let section= object.trackSections[i];
		if (section.dist == 0)
			continue;
//		console.log(" "+i+" "+section.dist+" "+section.radius);
		let d= section.dist;
		let r= section.radius;
		let dir= headingVector(heading);
		if (r == 0) {
			p= p.add(dir.clone().multiplyScalar(d));
			centerLine.push({ point:p.clone(),
			  perp: headingVector(heading+90) });
		} else {
			let perp= headingVector(heading+90);
			let m= Math.ceil(Math.abs(d*180/Math.PI));
			let angle= d/m;
			let t= Math.abs(r*Math.tan(angle/2));
			if (t < .01)
				m= 0;
			let h= 0;
			let cs= 1;
			let sn= 0;
//			console.log("t "+t+" "+m+" "+angle+" "+perp+" "+dir);
			for (let j=0; j<m; j++) {
				p.add(dir.clone().multiplyScalar(t*cs));
				p.add(perp.clone().multiplyScalar(t*sn));
				h+= angle;
				cs= Math.cos(h);
				sn= Math.sin(h);
				p.add(dir.clone().multiplyScalar(t*cs));
				p.add(perp.clone().multiplyScalar(t*sn));
				centerLine.push({ point:p.clone(), perp:
				  headingVector(heading+90+h*180/Math.PI) });
			}
			heading+= h*180/Math.PI;
		}
	}
//	console.log("cl "+centerLine.length);
	for (let i=0; i<centerLine.length; i++) {
		let cl= centerLine[i];
		let p= cl.point;
		let perp= cl.perp;
//		console.log(" "+i+" "+p.x+" "+p.y+" "+p.z+" "+
//		  perp.x+" "+perp.y+" "+perp.z);
	}
	let rtpath= routeDir+fspath.sep+"TEXTURES";
	let makeMesh= function(options) {
		let polyLines= options.polyLines;
		let dtc= options.deltaTexCoord;;
		let verts= [];
		let uvs= [];
		let normals= [];
		let indices= [];
		for (let k=0; k<polyLines.length; k++) {
			let points= polyLines[k];
			let np= points.length;
			let c0= centerLine[0].point;
			let dist= 0;
			let i0= verts.length/3;
				for (let i=0; i<centerLine.length; i++) {
				let center= centerLine[i].point;
				let perp= centerLine[i].perp;
				dist+= center.distanceTo(c0);
				c0= center;
				for (let j=0; j<np; j++) {
					let pos= points[j].position;
					let p= center.clone().add(perp.clone().
					  multiplyScalar(pos[0])).
					  add(new THREE.Vector3(0,pos[1],0));
					verts.push(p.x,p.y,p.z);
					normals.push(0,1,0);
					let texc= points[j].texCoord;
					uvs.push(texc[0]+dist*dtc[0],
					  texc[1]+dist*dtc[1]);
				}
				if (i > 0) {
					for (let j=0; j<np-1; j++) {
						let i1= i-1;
						indices.push(i0+i1*np,
						  i0+i*np,i0+i1*np+1);
						indices.push(i0+i1*np+1,
						  i0+i*np,i0+i*np+1);
					}
				}
			}
		}
		let geom= new THREE.BufferGeometry;
		geom.setAttribute("position",
		 new THREE.Float32BufferAttribute(verts,3));
		geom.setAttribute("normal",
		 new THREE.Float32BufferAttribute(normals,3));
		geom.setAttribute("uv",
		 new THREE.Float32BufferAttribute(uvs,2));
		geom.setIndex(indices);
		let mat= getMstsMaterial(options.imageFile,
		  options.transparent,rtpath,null,options.transparent,-5);
		let mesh= new THREE.Mesh(geom,mat);
		mesh.scale.z= -1;
		return mesh;
	}
	let ballast= makeMesh({
		imageFile: "acleantrack1.ace",
		transparent: true,
		specular: false,
		deltaTexCoord: [ 0, .2 ],
		polyLines: [[
			{ position: [-2.5,.2], normal:[0,1,0],
			  texCoord: [-.139,-.2] },
			{ position: [2.5,.2], normal:[0,1,0],
			  texCoord: [.862,-.2] }
		]]
	});
	let railTops= makeMesh({
		imageFile: "acleantrack2.ace",
		transparent: false,
		specular: true,
		deltaTexCoord: [ .0745,0 ],
		polyLines: [[
			{ position: [-.8675,.325], normal:[0,1,0],
			  texCoord: [.232067,.126953] },
			{ position: [-.7175,.325], normal:[0,1,0],
			  texCoord: [.232067,.224609] }
		 ],
		 [
			{ position: [.7175,.325], normal:[0,1,0],
			  texCoord: [.232067,.126953] },
			{ position: [.8675,.325], normal:[0,1,0],
			  texCoord: [.232067,.224609] }
		]]
	});
	let railSides= makeMesh({
		imageFile: "acleantrack2.ace",
		transparent: false,
		specular: false,
		deltaTexCoord: [ .1673372,0 ],
		polyLines: [[
			{ position: [-.8675,.2], normal: [-1,0,0],
			  texCoord: [-.139362,.101563] },
			{ position: [-.8675,.325], normal: [-1,0,0],
			  texCoord: [-.139362,.003906] }
		 ],
		 [
			{ position: [-.7175,.325], normal: [1,0,0],
			  texCoord: [-.139362,.003906] },
			{ position: [-.7175,.2], normal: [1,0,0],
			  texCoord: [-.139362,.101563] }
		 ],
		 [
			{ position: [.8675,.325], normal: [1,0,0],
			  texCoord: [-.139362,.003906] },
			{ position: [.8675,.2], normal: [1,0,0],
			  texCoord: [-.139362,.101563] }
		 ],
		 [
			{ position: [.7175,.2], normal: [-1,0,0],
			  texCoord: [-.139362,.101563] },
			{ position: [.7175,.325], normal: [-1,0,0],
			  texCoord: [-.139362,.003906] }
		]]
	});
	let group= new THREE.Group();
	group.add(ballast);
	group.add(railTops);
	group.add(railSides);
	return group;
}

let makeForestModel= function(object,tx,tz)
{
	let randomValue= 12345;
	let random= function() {
		randomValue= Math.floor((randomValue*2661+36979) % 175000);
		return randomValue/174999;
	}
	let u0= 2048*(tx-centerTX)+object.position[0];
	let v0= 2048*(tz-centerTZ)+object.position[2];
	let y0= object.position[1];
	let qdir= object.qdirection;
	let q= new THREE.Quaternion(qdir[0],qdir[1],qdir[2],qdir[3]);
	let euler= new THREE.Euler();
	euler.setFromQuaternion(q,"YXZ");
	let cs= Math.cos(euler.y);
	let sn= Math.sin(euler.y);
	let scale0= object.scale0;
	let scale1= object.scale1;
	let sizeW= object.sizeW;
	let sizeH= object.sizeH;
	let areaW= object.areaW;
	let areaH= object.areaH;
	let pop= object.population;
//	pop= 1;
//	areaW= .1;
//	areaH= .1;
//	console.log("forest "+u0+" "+v0+" "+sizeW+" "+sizeH+" "+pop+" "+
//	  object.treeTexture);
	let nh= Math.ceil(Math.sqrt(pop*areaH/areaW));
	let nv= Math.ceil(pop/nh);
	let trees= [];
	for (let i=0; i<nh; i++) {
		if (i==nh-1 && nv>pop)
			nv= pop;
		for (let j=0; j<nv; j++) {
			let s= (i+.5+.9*(random()-.5)) / nh;
			let t= (j+.5+.9*(random()-.5)) / nv;
			let scale= scale0 + (scale1-scale0)*random();
			let x= (s-.5)*areaW;
			let z= (t-.5)*areaH;
			let u= u0 + cs*x - sn*z;
			let v= v0 + cs*z + sn*x;
			let y= getElevation(u,v)-y0;
			u-= center.x;
			v-= center.y;
			let d= Math.sqrt(u*u + v*v);
			if (d > 0)
				trees.push({dist:d, x:x, y:y, z:z,
				  du:-u/d, dv:-v/d, scale:scale });
		}
	}
	trees.sort(function(a,b){return b.dist-a.dist});
	let verts= [];
	let uvs= [];
	let normals= [];
	let indices= [];
	let vi= 0;
	for (let i=0; i<trees.length; i++) {
		let tree= trees[i];
		let w= sizeW*tree.scale/2;
		let h= sizeH*tree.scale;
		let x= tree.x;
		let y= tree.y;
		let z= tree.z;
		let nx= cs*tree.du + sn*tree.dv;
		let nz= cs*tree.dv - sn*tree.du;
		nx= -nx;
		nz= -nz;
		let px= -nz;
		let pz= nx;
		verts.push(x+w*px,y,z+w*pz);
		verts.push(x+w*px,y+h,z+w*pz);
		verts.push(x-w*px,y+h,z-w*pz);
		verts.push(x-w*px,y,z-w*pz);
		uvs.push(1,1);
		uvs.push(1,0);
		uvs.push(0,0);
		uvs.push(0,1);
		normals.push(nx,0,nz);
		normals.push(nx,0,nz);
		normals.push(nx,0,nz);
		normals.push(nx,0,nz);
		indices.push(vi,vi+1,vi+2);
		indices.push(vi,vi+2,vi+3);
		vi+= 4;
	}
	let geom= new THREE.BufferGeometry;
	geom.setAttribute("position",
	 new THREE.Float32BufferAttribute(verts,3));
	geom.setAttribute("normal",
	 new THREE.Float32BufferAttribute(normals,3));
	geom.setAttribute("uv",
	 new THREE.Float32BufferAttribute(uvs,2));
	geom.setIndex(indices);
	let rtpath= routeDir+fspath.sep+"TEXTURES";
	let mat= getMstsMaterial(object.treeTexture,true,rtpath,null,true,-5);
//	mat.side= THREE.DoubleSide;
	let mesh= new THREE.Mesh(geom,mat);
	mesh.scale.z= -1;
	return mesh;
}
