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

//	Code for Signal Station Simulator
//

const THREE= require('three');

//	initiallizes menu, keyboard events and displays
window.onload= function() {
	setupMenu();
	window.addEventListener('keydown',function(e) {
		if (e.keyCode == 37) {
			cameraLeft();
		} else if (e.keyCode == 38) {
			scale*= 1.4;
			renderCanvas();
			e.preventDefault();
		} else if (e.keyCode == 39) {
			cameraRight();
		} else if (e.keyCode == 40) {
			scale/= 1.4;
			renderCanvas();
			e.preventDefault();
//		} else {
//			console.log("keydown "+e.keyCode+" "+e.key);
		}
		return true;
	});
	let button= document.getElementById("trainadd");
	button.addEventListener('click',addTrain);
	document.getElementById("consistfile").
	  addEventListener('change',loadConsist);
	setupMap();
	setupLevers();
}

//	display error in case user can't see console
window.onerror= function(msg,url,line)
{
	alert("ERROR: "+msg+"\n"+url+":"+line);
	return false;
}

let trackDB= null;		// MSTS TDB data object
let centerTX= 0;		// MSTS tile at center of route
let centerTZ= 0;
let scale= 1;			// current scale for displays
let downX= 0;
let downY= 0;
let mapObjects= [];
let levers= [];
let trains= [];
let interlocking= null;
let activeTrains= [];
let background= "daysky.ace";
let equipment= {};
let consists= {};

//	finds the center of MSTS route using TDB data
//	adjusts default display settings
let findCenter= function()
{
	let minTX= 1e10;
	let maxTX= -1e10;
	let minTZ= 1e10;
	let maxTZ= -1e10;
	for (let i=0; trackDB && i<trackDB.nodes.length; i++) {
		let node= trackDB.nodes[i];
		if (!node || node.sections)
			continue;
		if (minTX > node.tx)
			minTX= node.tx;
		if (maxTX < node.tx)
			maxTX= node.tx;
		if (minTZ > node.tz)
			minTZ= node.tz;
		if (maxTZ < node.tz)
			maxTZ= node.tz;
	}
	for (let i=0; i<tiles.length; i++) {
		let tile= tiles[i];
		if (minTX > tile.x)
			minTX= tile.x;
		if (maxTX < tile.x)
			maxTX= tile.x;
		if (minTZ > tile.z)
			minTZ= tile.z;
		if (maxTZ < tile.z)
			maxTZ= tile.z;
	}
	let toInt= function(x) {
		return x>=0 ? Math.floor(x) : Math.ceil(x);
	}
	centerTX= toInt(.5*(minTX+maxTX));
	centerTZ= toInt(.5*(minTZ+maxTZ));
	let canvas= document.getElementById("canvas");
	let sx= canvas.width/(2048*(maxTX-minTX+2));
	let sz= canvas.height/(2048*(maxTZ-minTZ+2));
	scale= sx<sz ? sx : sz;
	console.log("center "+centerTX+" "+centerTZ);
}

//	Calculates U&V coordinates used for displays for trackDB contents.
let calcTrackDBUV= function()
{
	for (let i=0; trackDB && i<trackDB.nodes.length; i++) {
		let node= trackDB.nodes[i];
		if (!node)
			continue;
		if (node.sections) {
			for (let j=0; j<node.sections.length; j++) {
				let section= node.sections[j];
				section.u= 2048*(section.tx-centerTX) +
				  section.x;
				section.v= 2048*(section.tz-centerTZ) +
				  section.z;
			}
		} else {
			node.u= 2048*(node.tx-centerTX) + node.x;
			node.v= 2048*(node.tz-centerTZ) + node.z;
		}
	}
	for (let i=0; trackDB && trackDB.items && i<trackDB.items.length; i++) {
		let item= trackDB.items[i];
		item.u= 2048*(item.tx-centerTX) + item.x;
		item.v= 2048*(item.tz-centerTZ) + item.z;
	}
}

//	update all displays
let renderCanvas= function()
{
	renderMap();
}

//	Implements the File menu Save feature.
//	Saves all data needed to restore session in a json file.
let saveData= function(filename)
{
	let data= {
		centerTX: centerTX,
		centerTZ: centerTZ,
		centerU: centerU,
		centerV: centerV,
		scale: scale,
		mapObjects: mapObjects,
		trains: trains,
		background: background,
		sounds: sounds,
		equipment: equipment,
		consists: consists
	};
	if (tdbPath)
		data.tdbPath= tdbPath;
	let s= JSON.stringify(data,null,1);
	if (filename.indexOf(".json") < 0)
		filename+= ".json";
	fs.writeFileSync(filename,s);
}

//	Implements the File menu Open function.
//	Reads a previously saved json file.
//	Needs to handle files created by earlier version which might be
//	missing some fields.
let readData= function(filename)
{
	console.log("read "+filename);
	let s= fs.readFileSync(filename);
	let data= JSON.parse(s);
	if (data.tdbPath) {
		console.log("tdbpath "+data.tdbPath);
		trackDB= readTrackDB(data.tdbPath);
		readTiles();
	} else {
		tdbPath= null;
	}
	centerTX= data.centerTX;
	centerTZ= data.centerTZ;
	centerU= data.centerU;
	centerV= data.centerV;
	scale= data.scale;
	if (data.mapObjects)
		mapObjects= data.mapObjects;
	if (data.trains)
		trains= data.trains;
	if (data.background)
		background= data.background;
	if (data.sounds)
		sounds= data.sounds;
	if (data.equipment)
		equipment= data.equipment;
	if (data.consists)
		consists= data.consists;
	calcTrackDBUV();
	makeTrack();
	renderCanvas();
	makeLevers();
	displayTrains();
	updateLocations();
	updateConsists();
}

let makeLevers= function()
{
	let n= 0;
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.lever && n<o.lever)
			n= o.lever;
	}
	levers= [];
	for (let i=0; i<n; i++)
		levers.push({type:"spare",color:"gray"});
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.lever) {
			let lever= levers[o.lever-1];
			if (o.type == "switch") {
				lever.type= "switch";
				lever.color= "black";
			} else if (o.type == "signal") {
				lever.type= "signal";
				lever.color= "red";
			}
		}
	}
	let s= '<table><tr>';
	for (let i=0; i<n; i++) {
		let lever= levers[i];
		s+= '<td class="'+lever.color+'">';
		s+= '<input type="checkbox" id="lever'+(i+1)+'"></td>';
	}
	s+= '</tr><tr>'
	for (let i=0; i<n; i++) {
		let lever= levers[i];
		s+= '<td class="'+lever.color+'">'+(i+1)+'</td>';
	}
	s+= '</tr></table>';
//	let leversDiv= document.getElementById("levers");
//	leversDiv.innerHTML= s;
//	console.log(s);
}

//	converts numeric time to hours and minutes string
let timeToHM= function(t)
{
	let h= Math.floor(t/3600);
	let m= Math.floor(t/60) - h*60;
	h%= 24;
	return h + ":" + (m<10?("0"+m):m);
}

//	converts numeric time to hours, minutes and seconds string
let timeToHMS= function(t)
{
	let h= Math.floor(t/3600);
	let m= Math.floor(t/60) - h*60;
	let s= Math.floor(t) - h*3600 - m*60;
	h%= 24;
	return h + ":" + (m<10?("0"+m):m) + ":" + (s<10?("0"+s):s);
}

//	converts hours:minutes string to seconds
let hmToTime= function(s)
{
	let h= parseInt(s,10);
	let i= s.indexOf(":");
	let m= parseInt(s.substr(i+1),10);
	return 60*(m + 60*h);
}

let addTrain= function()
{
	let train= {
		name: document.getElementById("trainname").value,
		entrance: document.getElementById("trainentrance").value,
		exit: document.getElementById("trainexit").value,
		startTime: document.getElementById("trainstart").value,
		consist: document.getElementById("trainconsist").value,
		maxSpeed:
		  parseFloat(document.getElementById("trainmaxspeed").value)
	};
	let stop= document.getElementById("trainstop").value;
	let stopTime= document.getElementById("trainstoptime").value;
	if (stopTime.length > 0)
		train.stops= [{stop:stop, stopTime:stopTime}];
	trains.push(train);
	displayTrains();
}

let displayTrains= function()
{
	if (trains.length == 0)
		return;
	let sortedTrains= trains.sort(function(a,b) {
		if (a.startTime < b.startTime)
			return -1;
		if (a.startTime > b.startTime)
			return 1;
		return 0;
	});
	let s= "<table><tr><th>Name</th><th>Start Time</th><th>Max.Speed</th>"+
	  "<th>Entrance</th><th>Exit</th><th>Consist</th><th>Stops</th></tr>";
	for (let i=0; i<sortedTrains.length; i++) {
		let train= sortedTrains[i];
		s+= "<tr><td>"+train.name+"</td><td>"+
		  train.startTime+"</td><td>"+
		  train.maxSpeed+"</td><td>"+
		  train.entrance+"</td><td>"+
		  train.exit+"</td><td>"+
		  train.consist+"</td>";
		if (train.stops) {
			s+= "<td>";
			for (let j=0; j<train.stops.length; j++)
				s+= train.stops[j].stop+" "+
				  train.stops[j].stopTime+" ";
			s+= "</td>";
		}
		s+= "</tr>";
	}
	s+= "</table>";
	let list= document.getElementById("trains");
	list.innerHTML= s;
}

let updateLocations= function()
{
	let s= "";
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.type == "location")
			s+= "<option>"+o.name;
	}
	document.getElementById("trainentrance").innerHTML= s;
	document.getElementById("trainexit").innerHTML= s;
	document.getElementById("trainstop").innerHTML= s;
}

let updateConsists= function()
{
	let s= "";
	for (let i in consists) {
		if (consists.hasOwnProperty(i))
			s+= "<option>"+i;
	}
	document.getElementById("trainconsist").innerHTML= s;
}

let simTime= 0;
let timeMult= 1;
let timeStep= .1;

let startSimulation= function()
{
	if (simTime > 0) {
		timeMult= 1;
		return;
	}
	makeInterlocking();
	renderLevers();
	for (let i=0; i<trains.length; i++) {
		let train= trains[i];
		let t= hmToTime(train.startTime);
		addEvent(t,startTrainEvent,train);
	}
	if (eventQueue.length > 0)
		simTime= eventQueue[0].time;
//	document.getElementById("canvas").style.visibility= "hidden";
//	document.getElementById("canvas3d").style.visibility= "visible";
	render3D();
	window.setTimeout(updateSimulation,timeStep*1000);
}

let pauseSimulation= function()
{
	if (timeMult > 0)
		timeMult= 0;
	else
		timeMult= 1;
}

let updateSimulation= function()
{
	if (timeMult > 0) {
		let dt= timeStep*timeMult;
		simTime+= dt;
		let timeDiv= document.getElementById("timediv");
		timeDiv.innerHTML= "Time: "+timeToHMS(simTime);
		timeMult= 32;
		let del= null;
		let moving= false;
		for (let i=0; i<activeTrains.length; i++) {
			let t= activeTrains[i];
			t.move(dt,simTime);
			let p= t.location.getPosition();
			let du= p.x-centerU;
			let dv= p.y-centerV;
			if (du*du+dv*dv < 500*500) {
				timeMult= 1;
				if (t.speed)
					moving= true;
			}
			if (t.distance > t.maxDistance)
				del= t;
		}
		if (!moving)
			timeMult= 8;
		if (del) {
			del.removeModels();
			let i= activeTrains.indexOf(del);
			activeTrains.splice(i,1);
		}
		if (activeTrains.length==0 && timeMult>1 &&
		  eventQueue.length>0) {
			simTime= eventQueue[0].time;
			console.log("timejump "+timeToHMS(simTime));
		} else if (activeTrains.length==0 && timeMult>1) {
			timeMult= 0;
		}
		updateEvents(simTime);
		displayActiveTrains();
		renderModelBoard();
		render3D();
	}
	window.setTimeout(updateSimulation,100);
}

let startTrainEvent= function(e)
{
	console.log("starttime "+e.train.name+" at "+timeToHMS(simTime));
	let findNamedLocation= function(name) {
		for (let i=0; i<mapObjects.length; i++) {
			let o= mapObjects[i];
			if (o.type=="location" && o.name==name)
				return findLocation(o.u,o.v).loc;
		}
		console.log("cannod find location "+name);
		return null;
	}
	let startLoc= findNamedLocation(e.train.entrance);
	let endLoc= findNamedLocation(e.train.exit);
	if (!startLoc || !endLoc)
		return;
	findSPT(endLoc,true);
	let d= startLoc.dDistance(endLoc);
	startLoc.rev= startLoc.edge.v1.dist<startLoc.edge.v2.dist;
	console.log("startdir "+startLoc.rev+" "+startLoc.edge.v1.dist+" "+
	  startLoc.edge.v2.dist);
	let train= new Train(e.train,startLoc,
	  Math.max(startLoc.edge.v1.dist,startLoc.edge.v2.dist));
	train.createModels(e.train);
	if (e.train.stops) {
		d= startLoc.spDistance();
		for (let i=0; i<e.train.stops.length; i++) {
			let loc= findNamedLocation(e.train.stops[i].stop);
			if (!loc)
				break;
			train.addStop(d-loc.spDistance()+train.length/2,
			  hmToTime(e.train.stops[i].stopTime));
			d= loc.spDistance();
		}
	}
	train.findSignal();
	activeTrains.push(train);
}

let displayActiveTrains= function()
{
	let s= "<table><tr><th>Train</th><th>Speed</th><th>Distance</th></tr>";
	for (let i=0; i<activeTrains.length; i++) {
		let t= activeTrains[i];
		let p= t.location.getPosition();
		let du= p.x-centerU;
		let dv= p.y-centerV;
		s+= "<tr><td>"+t.name+"</td><td>"+(t.speed*2.23693).toFixed(0)+
		  "</td><td>"+Math.sqrt(du*du+dv*dv).toFixed(0)+"</td>"+
		  "<td>"+t.signalDistance.toFixed(1)+"</td>"+
		  "<td>"+(t.signal?t.signal.indication:-1)+"</td>"+
		  "<td>"+(t.signal?t.signal.state:-1)+"</td>"+
		  "</tr>";
	}
	s+= "</table>";
	let trainList= document.getElementById("activetrains");
	trainList.innerHTML= s;
}

let loadConsist= function()
{
	let path= document.getElementById("consistfile").value;
	console.log("loadconsist "+path);
	let data= readMstsConsist(path);
	if (!data)
		return;
	let trainsDir= fspath.dirname(fspath.dirname(path));
	if (!trainsDir) {
		let s= "<pre>"+JSON.stringify(data,null,1)+"</pre>";
		document.getElementById("consistdisplay").innerHTML= s;
		return;
	}
	let consist= [];
	let path0= trainsDir+fspath.sep+"TRAINSET"+fspath.sep;
	for (let i=0; i<data.cars.length; i++) {
		let car= data.cars[i];
		if (!car.directory || !car.file)
			continue;
		let name= car.directory+"/"+car.file;
		if (car.flip)
			consist.push("^"+name);
		else
			consist.push(name);
		if (equipment[name])
			continue;
		let path= path0+car.directory+fspath.sep+car.file;
		let wag= readMstsWag(path);
		if (!wag || !wag.shape || !wag.length)
			continue;
		let equip= {
			directory: car.directory,
			shape: wag.shape,
			length: wag.length
		};
		if (wag.fashape)
			equip.fashape= wag.fashape;
		if (wag.lights) {
			equip.lights= wag.lights;
			for (let j=0; j<equip.lights.length; j++) {
				let light= equip.lights[j];
				if (light.radius > .5)
					light.radius*= .1;
				else
					light.radius*= .2;
				if (light.unit == 2)
					light.radius= .15;
				else
					light.radius= .06;
			}
		}
		if (wag.sound) {
			let lower= wag.sound.toLowerCase();
			for (j in sounds) {
				if (sounds.hasOwnProperty(j) &&
				  lower.indexOf(j)>=0) {
					equip.sound= j;
					break;
				}
			}
		}
		equipment[name]= equip;
	}
	consists[data.name]= consist;
	updateConsists();
//	let s= "<pre>"+JSON.stringify(data,null,1)+"</pre>";
	let s= "<br>"+data.name+"<table>"+
	  "<tr><th>Car</th><th>Shape</th><th>Length</th><th>Lights</th>"+
	  "<th>Sound</th></tr>";
	for (let i=0; i<consist.length; i++) {
		let car= consist[i];
		s+= "<tr><td>"+car+"</td>";
		let name= car.substr(0,1)=="^" ? car.substr(1) : car;
		let equip= equipment[name];
		if (equip) {
			s+= "<td>"+equip.shape+"</td>";
			s+= "<td>"+equip.length.toFixed(3)+"</td>";
			if (equip.lights)
				s+= "<td>"+equip.lights.length+"</td>";
			else
				s+= "<td></td>";
			if (equip.sound)
				s+= "<td>"+equip.sound+"</td>";
			else
				s+= "<td></td>";
		}
		s+= "</tr>";
	}
	s+= "</table>";
	document.getElementById("consistdisplay").innerHTML= s;
}
