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

//	map drawing related code

let centerU= 0;
let centerV= 0;
let moveMode= false;
let dragging= null;
let selected= null;

//	initialize 2d map display
let setupMap= function()
{
	let canvas= document.getElementById('canvas');
	canvas.addEventListener('mousedown',mapMouseDown);
	canvas.addEventListener('mousemove',mapMouseMove);
	canvas.addEventListener('mouseup',mapMouseUp);
}

//	draw display in map canvas
let renderMap= function()
{
	let canvas= document.getElementById("canvas");
	let width= canvas.width;
	let height= canvas.height;
	let context= canvas.getContext("2d");
	context.clearRect(0,0,canvas.width,canvas.height);
	context.fillStyle= "black";
	context.textAlign= "center";
	for (let i=0; false && i<tiles.length; i++) {
		let tile= tiles[i];
		let u= (2048*(tile.x-centerTX)-centerU)*scale + width/2;
		let v= height/2 - (2048*(tile.z-centerTZ)-centerV)*scale;
		context.fillText(tile.filename+" "+tile.x+" "+tile.z,u,v);
	}
	context.strokeWidth= 1;
	context.strokeStyle= "fuchsia";//"lightblue";
	for (let i=0; false && i<tiles.length; i++) {
		let tile= tiles[i];
		let u= (2048*(tile.x-centerTX)-1024-centerU)*scale + width/2;
		let v= height/2 - (2048*(tile.z-centerTZ)+1024-centerV)*scale;
		context.strokeRect(u,v,2048*scale,2048*scale);
	}
	context.strokeWidth= 1;
	context.strokeStyle= "red";
	context.beginPath();
	context.moveTo(width/2,height/2);
	context.lineTo(width/2+5,height/2);
	context.stroke();
	context.strokeStyle= "blue";
	context.beginPath();
	context.moveTo(width/2,height/2);
	context.lineTo(width/2,height/2+5);
	context.stroke();
	context.strokeStyle= "black";
	let drawSection= function(id,u1,v1,u2,v2) {
		let section= trackDB.tSection.sections[id];
		if (!section || section.length) {
			context.lineTo(u2,v2);
			return;
		}
		let du= u2 - u1;
		let dv= v2 - v1;
		let d= Math.sqrt(du*du+dv*dv);
		du/= d;
		dv/= d;
		let r= section.radius*scale;
		let a= .5*section.angle*Math.PI/180;
		let t= r*Math.abs(Math.tan(a));
		let x= Math.sqrt(t*t+r*r) - r*Math.cos(a);
		let ui= .5*(u1+u2);
		let vi= .5*(v1+v2);
		if (section.angle>0) {
			ui+= x*dv;
			vi-= x*du;
		} else {
			ui-= x*dv;
			vi+= x*du;
		}
		context.arcTo(ui,vi,u2,v2,r);
	}
	let isMain= function(id,pin) {
		let node= trackDB.nodes[id];
		let node2= trackDB.nodes[node.pins[pin].node];
		if (!node2.shape)
			return true;
		let shape= trackDB.tSection.shapes[node2.shape];
		let mainRoute= shape.mainRoute || 0;
		for (let i=0; i<node2.pins.length; i++)
			if (node2.pins[i].node == id)
				return i==0 || i==mainRoute+1;
		return false;
	}
	for (let i=0; trackDB && i<trackDB.nodes.length; i++) {
		let node= trackDB.nodes[i];
		if (!node)
			continue;
		if (node.sections) {
			let u0= 0;
			let v0= 0;
			let sectionID= 0;
			if (isMain(i,0) && isMain(i,1))
				context.strokeStyle= "black";
			else
				context.strokeStyle= "#aaa";
			context.beginPath();
			for (let j=0; j<node.sections.length; j++) {
				let section= node.sections[j];
				let u= (section.u-centerU)*scale + width/2;
				let v= height/2 - (section.v-centerV)*scale;
				if (j == 0)
					context.moveTo(u,v);
				else
					drawSection(sectionID,u0,v0,u,v);
				u0= u;
				v0= v;
				sectionID= section.sectionID;
			}
			let node2= trackDB.nodes[node.pins[1].node];
			let u= (node2.u-centerU)*scale + width/2;
			let v= height/2 - (node2.v-centerV)*scale;
			drawSection(sectionID,u0,v0,u,v);
			context.stroke();
		}
	}
	context.fillStyle= "black";
	context.textAlign= "center";
	for (let i=0; trackDB && trackDB.items && i<trackDB.items.length; i++) {
		let item= trackDB.items[i];
		let u= (item.u-centerU)*scale + width/2;
		let v= height/2 - (item.v-centerV)*scale;
		if (item.platformName)
			context.fillText(item.platformName,u,v);
		else
			context.fillRect(u-2,v-2,5,5);
	}
	context.textAlign= "left";
	for (let i=0; i<mapObjects.length; i++) {
		let object= mapObjects[i];
		let u= (object.u-centerU)*scale + width/2;
		let v= height/2 - (object.v-centerV)*scale;
		if (object.type == "camera")
			context.fillStyle= "cyan";
		else if (object.type == "switch")
			context.fillStyle= "green";
		else if (object.type == "signal")
			context.fillStyle= "blue";
		else if (object.type == "location")
			context.fillStyle= "magenta";
		if (object==selected)
			context.fillStyle= "orange";
		context.fillRect(u-3,v-3,7,7);
		if (object.lever) {
			let s= object.lever.toString();
			if (object.lock)
				s+= ","+object.lock;
			if (object.trackCircuit)
				s+= ","+object.trackCircuit;
			context.fillText(s,u+5,v);
		} else if (object.trackCircuit) {
			context.fillText(object.trackCircuit,u+5,v);
		} else if (object.name) {
			context.fillText(object.name,u+5,v);
		}
		if (object.type == "signal") {
			context.fillStyle= "red";
			context.fillRect(u-3+5*object.du,v-3-5*object.dv,7,7);
		}
	}
	context.fillStyle= "orange";
	for (let i=0; activeTrains && i<activeTrains.length; i++) {
		let train= activeTrains[i];
		let p= train.location.getPosition();
		let u= (p.x-centerU)*scale + width/2;
		let v= height/2 - (p.y-centerV)*scale;
		context.fillRect(u-3,v-3,7,7);
		p= train.endLocation.getPosition();
		u= (p.x-centerU)*scale + width/2;
		v= height/2 - (p.y-centerV)*scale;
		context.fillRect(u-3,v-3,7,7);
	}
}

//	handle mouse down event in map canvas
//	center display on shift click
//	change selection control point and set up dragging
//	add new control point on ctrl click
let mapMouseDown= function(event)
{
	let canvas= document.getElementById('canvas');
	downX= event.pageX-canvas.offsetLeft;
	downY= event.pageY-canvas.offsetTop;
//	console.log("down "+downX+" "+downY);
	let width= canvas.width;
	let height= canvas.height;
	if (event.shiftKey || moveMode) {
		centerU-= (width/2-downX)/scale;
		centerV+= (height/2-downY)/scale;
//		console.log('center '+centerU+' '+centerV+' '+scale);
		renderCanvas();
	} else {
		let bestD= 40;
		let bestObject= null;
		for (let j=0; j<mapObjects.length; j++) {
			let object= mapObjects[j];
			let u= (object.u-centerU)*scale + width/2;
			let v= height/2 - (object.v-centerV)*scale;
			let dx= u - downX;
			let dy= v - downY;
			let d= dx*dx + dy*dy;
//			console.log("d "+j+" "+d+" "+bestD);
			if (d < bestD) {
				bestD= d;
				bestObject= object;
			}
		}
		if (selected && selected==bestObject && selected.type!="switch")
			dragging= bestObject;
		else
			dragging= null;
		selected= bestObject;
		renderCanvas();
	}
	event.preventDefault();
}

//	handle mouse move event in map canvas
//	move or change track direction for selected control point
let mapMouseMove= function(event)
{
	if (dragging) {
		let canvas= document.getElementById('canvas');
		let width= canvas.width;
		let height= canvas.height;
		let upX= event.pageX-canvas.offsetLeft;
		let upY= event.pageY-canvas.offsetTop;
		let x= (upX-width/2)/scale + centerU;
		let y= centerV - (upY-height/2)/scale;
		if (dragging.type!="camera") {
			let p= findNearestTrack(x,y);
			if (p) {
				dragging.u= p.u;
				dragging.v= p.v;
				if (dragging.type=="signal") {
					dragging.du= Math.cos(Math.PI/2-p.ay);
					dragging.dv= Math.sin(Math.PI/2-p.ay);
					if (dragging.direction) {
						dragging.du= -dragging.du;
						dragging.dv= -dragging.dv;
					}
				}
			}
		} else {
			dragging.u= x;
			dragging.v= y;
		}
		renderCanvas();
	}
}

//	handle mouse up event in map canvas
//	stop dragging
let mapMouseUp= function(e)
{
	dragging= null;
	renderCanvas();
}

let addObject= function(type)
{
	let canvas= document.getElementById('canvas');
	let width= canvas.width;
	let height= canvas.height;
	let object= {
		type: type,
		u: (downX-width/2)/scale + centerU,
		v: centerV - (downY-height/2)/scale
	};
	if (type == "switch") {
		let node= findNearestSwitch(object.u,object.v);
		if (!node)
			return;
		object.u= node.u;
		object.v= node.v;
		//object.nodeId= node.uid;
		let lever= document.getElementById('lever');
		object.lever= parseInt(lever.value);
	} else if (type == "signal") {
		let p= findNearestTrack(object.u,object.v);
		if (!p)
			return;
		object.u= p.u;
		object.v= p.v;
		object.du= Math.cos(Math.PI/2-p.ay);
		object.dv= Math.sin(Math.PI/2-p.ay);
		let lever= document.getElementById('lever');
		object.lever= parseInt(lever.value);
		object.direction= 0;
	} else if (type == "location") {
		let p= findNearestTrack(object.u,object.v);
		if (!p)
			return;
		object.u= p.u;
		object.v= p.v;
		let name= document.getElementById('locationname');
		object.name= name.value;
		object.column=
		  parseInt(document.getElementById('locationcolumn').value);
		object.track= document.getElementById('locationtrack').value;
	}
	mapObjects.push(object);
	renderCanvas();
	makeLevers();
}

let addSwitch= function()
{
	addObject("switch");
}

let addSignal= function()
{
	addObject("signal");
}

let addCamera= function()
{
	addObject("camera");
}

let addLocation= function()
{
	addObject("location");
	updateLocations();
}

let findNearestTrack= function(u,v)
{
	let bestD= 10000;
	let bestSection= null;
	let bestNode= null;
	let bestj= -1;
	for (let i=0; trackDB && i<trackDB.nodes.length; i++) {
		let node= trackDB.nodes[i];
		if (!node)
			continue;
		if (node.sections) {
			for (let j=1; j<node.sections.length; j++) {
				let section= node.sections[j];
				let du= u-section.u;
				let dv= v-section.v;
				let d= du*du + dv*dv;
				if (d < bestD) {
					bestD= d;
					bestSection= section;
					bestNode= node;
					bestj= j;
				}
			}
		}
	}
	if (bestSection)
		return { u:bestSection.u, v:bestSection.v, ay:bestSection.ay };
	else
		return null;
}

let findNearestSwitch= function(u,v)
{
	let bestD= 10000;
	let bestNode= null;
	for (let i=0; trackDB && i<trackDB.nodes.length; i++) {
		let node= trackDB.nodes[i];
		if (!node || node.sections || !node.shape)
			continue;
		let du= u-node.u;
		let dv= v-node.v;
		let d= du*du + dv*dv;
		if (d < bestD) {
			bestD= d;
			bestNode= node;
		}
	}
	return bestNode;
}

let changeLever= function()
{
	if (!selected)
		return;
	if (selected.type!="switch" && selected.type!="signal")
		return;
	let lever= document.getElementById('lever');
	selected.lever= parseInt(lever.value);
//	makeLevers();
	renderCanvas();
}

let changeLock= function()
{
	if (!selected)
		return;
	if (selected.type!="switch" && selected.type!="signal")
		return;
	let lock= document.getElementById('lock');
	selected.lock= lock.value;
//	makeLevers();
	renderCanvas();
}

let changeSpeed= function()
{
	if (!selected)
		return;
	if (selected.type!="signal")
		return;
	let speed= document.getElementById('maxspeed');
	selected.maxSpeed= parseFloat(speed.value);
	renderCanvas();
}

let changeTrackCircuit= function()
{
	if (!selected)
		return;
	if (selected.type!="signal")
		return;
	let tc= document.getElementById('trackcircuit');
	selected.trackCircuit= tc.value;
	renderCanvas();
}

let changeName= function()
{
	if (!selected || selected.type!="location")
		return;
	let name= document.getElementById('locationname');
	selected.name= name.value;
	selected.column= parseInt(document.getElementById('locationcolumn'));
	selected.track= document.getElementById('locationtrack');
	renderCanvas();
	updateLocations();
}

let toggleSignalDirection= function()
{
	if (!selected || selected.type!="signal")
		return;
	if (selected.direction) {
		selected.direction= 0;
	} else {
		selected.direction= 1;
	}
	selected.du= -selected.du;
	selected.dv= -selected.dv;
	console.log("sigdir "+selected.direction+" "+
	  selected.du+" "+selected.dv);
	renderCanvas();
}

let deleteSelected= function()
{
	if (!selected)
		return;
	let i= mapObjects.indexOf(selected);
	mapObjects.splice(i,1);
	selected= null;
	renderCanvas();
}
