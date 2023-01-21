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
			e.preventDefault();
		} else if (e.keyCode == 38) {
			if (simTime > 0) {
				cameraUp();
			} else {
				scale*= 1.4;
				renderCanvas();
			}
			e.preventDefault();
		} else if (e.keyCode == 39) {
			cameraRight();
			e.preventDefault();
		} else if (e.keyCode == 40) {
			if (simTime > 0) {
				cameraDown();
			} else {
				scale/= 1.4;
				renderCanvas();
			}
			e.preventDefault();
		} else if (e.keyCode == 33) {
			if (simTime > 0) {
				moveCamera(true);
				e.preventDefault();
			}
		} else if (e.keyCode == 34) {
			if (simTime > 0) {
				moveCamera(false);
				e.preventDefault();
			}
		} else {
			console.log("keydown "+e.keyCode+" "+e.key);
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
let blockSheet= [[],[]];
let blockSheetColumns= ["Northbound","Southbound"];
let requests= [];
let sssimDir= "";

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
//	console.log("center "+centerTX+" "+centerTZ);
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
		consists: consists,
		blockSheetColumns: blockSheetColumns
	};
	if (tdbPath)
		data.tdbFile= fspath.basename(tdbPath);
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
	sssimDir= fspath.dirname(filename);
	routeDir= fspath.dirname(fspath.dirname(filename));
	mstsDir= fspath.dirname(fspath.dirname(routeDir));
	console.log("mstsdir "+mstsDir);
	console.log("routedir "+routeDir);
	let s= fs.readFileSync(filename);
	let data= JSON.parse(s);
	if (data.tdbFile) {
		console.log("tdbfile "+data.tdbFile);
		trackDB= readTrackDB(routeDir+fspath.sep+data.tdbFile);
		readTiles();
	} else if (data.tdbPath) {
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
	if (data.sounds) {
		for (let i in data.sounds)
			if (data.sounds.hasOwnProperty(i))
				sounds[i]= data.sounds[i];
	}
	if (data.equipment)
		equipment= data.equipment;
	if (data.consists)
		consists= data.consists;
	if (data.blockSheetColumns)
		blockSheetColumns= data.blockSheetColumns;
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
		  parseFloat(document.getElementById("trainmaxspeed").value),
		randomDelay:
		  parseInt(document.getElementById("trainrandomdelay").value)
	};
	let stop= document.getElementById("trainstop").value;
	let stopTime= document.getElementById("trainstoptime").value;
	let stopWait=
	  parseInt(document.getElementById("trainstopduration").value);
	if (stopTime.length > 0)
		train.stops= [{stop:stop, stopTime:stopTime,
		  stopWait:stopWait}];
	trains.push(train);
	displayTrains();
}

let deleteTrain= function(name)
{
	for (let i=0; i<trains.length; i++) {
		let train= trains[i];
		if (train.name == name) {
			document.getElementById("trainname").value= name;
			document.getElementById("trainentrance").value=
			  train.entrance
			document.getElementById("trainexit").value= train.exit;
			document.getElementById("trainstart").value=
			  train.startTime;
			document.getElementById("trainconsist").value=
			  train.consist;
			document.getElementById("trainmaxspeed").value=
			  train.maxSpeed.toFixed(0);
			if (train.stops && train.stops.length>0) {
				document.getElementById("trainstop").value=
				  train.stops[0].stop;
				document.getElementById("trainstoptime").value=
				  train.stops[0].stopTime;
				document.getElementById("trainstopduration").
				  value= (train.stops[0].stopWait||"0");
			} else {
				document.getElementById("trainstoptime").value=
				  "";
			}
			if (train.randomDelay)
				document.getElementById(
				  "trainrandomdelay").value=
				  train.randomDelay.toFixed(0);
			else
				document.getElementById(
				  "trainrandomdelay").value= "";
			trains.splice(i,1);
			displayTrains();
			return;
		}
	}
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
	let s= "<table><tr><th>Name</th><th>Start Time</th><th>Max. Speed</th>"+
	  "<th>Entrance</th><th>Exit</th><th>Consist</th><th>Stops</th>"+
	  "<th>Random Delay</th></tr>";
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
			for (let j=0; j<train.stops.length; j++) {
				s+= train.stops[j].stop+" "+
				  train.stops[j].stopTime+" ";
				if (train.stops[j].stopWait)
					s+= "("+train.stops[j].stopWait+") ";
			}
			s+= "</td>";
		} else {
			s+= "<td></td>";
		}
		if (train.randomDelay)
			s+= "<td>"+train.randomDelay.toFixed(0)+"</td>";
		else
			s+= "<td></td>";
		s+= "<td><button type='button' onclick='deleteTrain(\""+
		  train.name+"\")'>Delete</button></td>";
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
	initBlocks();
	for (let i=0; i<trains.length; i++) {
		let train= trains[i];
		if (train.startTime.indexOf(":")<0) {
			for (let j=0; j<trains.length; j++) {
				if (trains[j].name == train.startTime) {
					trains[j].nextTrain= train.name;
					break;
				}
			}
			continue;
		}
		let t= hmToTime(train.startTime);
		if (train.randomDelay)
			t+= Math.random()*train.randomDelay*60;
		let loc= findNamedLocation(train.entrance);
		if (loc.block) {
			train.startBlock= loc.block;
			addEvent(t-loc.block.delay,requestBlockEvent,train);
		} else {
			addEvent(t,startTrainEvent,train);
		}
	}
	if (eventQueue.length > 0)
		simTime= eventQueue[0].time;
//	document.getElementById("canvas").style.visibility= "hidden";
//	document.getElementById("canvas3d").style.visibility= "visible";
	render3D();
	renderLevers();
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
		let checkNear= function(t,loc) {
			let p= loc.getPosition();
			let du= p.x-centerU;
			let dv= p.y-centerV;
			if (du*du+dv*dv < 500*500) {
				timeMult= 1;
				if (t.speed)
					moving= true;
			}
		}
		for (let i=0; i<activeTrains.length; i++) {
			let t= activeTrains[i];
			t.move(dt,simTime);
			checkNear(t,t.location);
			checkNear(t,t.endLocation);
			if (t.distance > t.maxDistance) {
				del= t;
				t.times.cleared= simTime;
				if (t.startBlock)
					t.startBlock.inUse= false;
				if (t.endBlock)
					t.endBlock.inUse= false;
				displayBlockSheet();
			}
		}
		if (requests.length > 0)
			timeMult= 1;
		else if (!moving)
			timeMult= 8;
		if (del) {
			del.removeModels();
			let i= activeTrains.indexOf(del);
			activeTrains.splice(i,1);
		}
		if (activeTrains.length==0 && timeMult>1 &&
		  eventQueue.length>0 &&
		  (blockSheet[0].length==0 ||
		   blockSheet[0][blockSheet[0].length-1].cleared) &&
		  (blockSheet[1].length==0 ||
		   blockSheet[1][blockSheet[1].length-1].cleared)) {
			simTime= eventQueue[0].time;
			console.log("timejump "+timeToHMS(simTime));
		} else if (activeTrains.length==0 && timeMult>1 &&
		  eventQueue.length==0) {
			timeMult= 0;
		}
		updateEvents(simTime);
		//displayActiveTrains();
		renderLeverIndicators();
		render3D();
	}
	window.setTimeout(updateSimulation,100);
}

let initBlocks= function()
{
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.type=="location" && o.blockDelay) {
			o.block= {
				name: o.name,
				delay: o.blockDelay,
				inUse:false
			};
		}
	}
}

let findNamedLocation= function(name)
{
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.type=="location" && o.name==name) {
			return {
			  loc: findLocation(o.u,o.v).loc,
			  column: o.column?1:0,
			  block: o.block,
			  track: o.track || null
			 };
		}
	}
	console.log("cannod find location "+name);
	return null;
}

let requestBlockEvent= function(e)
{
//	console.log("request block "+e.train.name+" at "+timeToHMS(simTime));
	if (e.train.startBlock.inUse) {
		console.log("block not clear");
		addEvent(simTime+60,requestBlockEvent,e.train);
	}
	requests.push({
		func:"recordBlockFor",
		label:"Block for "+e.train.name,
		train:e.train
	});
	displayRequests();
}

let displayRequests= function()
{
	let s= "";
	for (let i=0; i<requests.length; i++) {
		let request= requests[i];
		s+= "<button type='button' onclick='"+request.func+
		  "(\""+request.train.name+"\")'>"+request.label+
		  "</button>";
	}
	document.getElementById("requestdiv").innerHTML= s;
}

let recordBlockFor= function(name)
{
//	console.log("recordblock "+name);
	for (let i=0; i<trains.length; i++) {
		let train= trains[i];
		if (train.name == name) {
			let loc= findNamedLocation(train.entrance);
			loc.block.inUse= true;
			let column= loc.column;
			addEvent(simTime+loc.block.delay,startTrainEvent,train);
			train.times= { train:train, name:train.name,
			  given:simTime };
			blockSheet[column].unshift(train.times);
			displayBlockSheet();
//			console.log("given "+simTime);
			break;
		}
	}
	for (let i=0; i<requests.length; i++) {
		if (requests[i].train.name == name) {
//			console.log("remove button "+i);
			requests.splice(i,1);
			displayRequests();
			return;
		}
	}
}

let startTrainEvent= function(e)
{
//	console.log("starttime "+e.train.name+" at "+timeToHMS(simTime));
	let startLoc= findNamedLocation(e.train.entrance);
	let endLoc= findNamedLocation(e.train.exit);
	if (!startLoc || !endLoc)
		return;
	let column= startLoc.column;
	if (e.train.prevTrain)
		column= 1-endLoc.column;
	let startBlock= startLoc.block;
	let startTrack= startLoc.track;
	startLoc= startLoc.loc;
	let endBlock= endLoc.block;
	let endTrack= endLoc.track;
	endLoc= endLoc.loc;
	findSPT(endLoc,true);
	let d= startLoc.dDistance(endLoc);
	startLoc.rev= startLoc.edge.v1.dist<startLoc.edge.v2.dist;
//	console.log("startdir "+startLoc.rev+" "+startLoc.edge.v1.dist+" "+
//	  startLoc.edge.v2.dist);
	let train= null;
	if (e.train.prevTrain) {
		train= e.train.prevTrain;
		train.name= e.train.name;
		train.reverse();
		train.maxDistance=
		  Math.max(startLoc.edge.v1.dist,startLoc.edge.v2.dist);
	} else {
		train= new Train(e.train,startLoc,
		  Math.max(startLoc.edge.v1.dist,startLoc.edge.v2.dist));
		train.createModels(e.train);
		activeTrains.push(train);
	}
	if (e.train.stops) {
		d= startLoc.spDistance();
		for (let i=0; i<e.train.stops.length; i++) {
			let loc= findNamedLocation(e.train.stops[i].stop);
			if (!loc)
				break;
			loc= loc.loc;
			train.addStop(d-loc.spDistance()+train.length/2,
			  hmToTime(e.train.stops[i].stopTime),
			  e.train.stops[i].wait);
			d= loc.spDistance();
		}
		if (e.train.nextTrain)
			train.nextTrain= e.train.nextTrain;
		if (e.train.prevTrain)
			train.stopDistance= 0;
	}
	train.findSignal();
	train.startBlock= startBlock;
	train.endBlock= endBlock;
	if (e.train.times) {
		train.times= e.train.times;
		train.times.train= train;
		train.times.entered= simTime;
	} else {
		train.times= { train:train, name:train.name, entered:simTime };
		blockSheet[column].unshift(train.times);
	}
	if (e.train.prevTrain)
		train.times.arrived= simTime;
	if (startTrack)
		train.times.startTrack= startTrack;
	if (endTrack)
		train.times.endTrack= endTrack;
	displayBlockSheet();
}

let startNextTrain= function(prevTrain)
{
	for (let i=0; i<trains.length; i++) {
		let train= trains[i];
		if (train.name == prevTrain.nextTrain) {
			train.prevTrain= prevTrain;
			prevTrain.nextTrain= train.nextTrain;
			prevTrain.times.departed= simTime;
			if (!prevTrain.times.arrived)
				prevTrain.times.arrived= simTime;
			prevTrain.times.cleared= simTime;
			if (prevTrain.startBlock)
				prevTrain.startBlock.inUse= false;
			prevTrain.distance= 0;
			if (prevTrain.signal) {
				prevTrain.signal.trainDistance= 0;
				prevTrain.signal= 0;
				prevTrain.signalDistance= 0;
			}
			addEvent(simTime,startTrainEvent,train);
			return;
		}
	}
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
//	console.log("loadconsist "+path);
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
		} else {
			s+= "<td>file not found</td>";
		}
		s+= "</tr>";
	}
	s+= "</table>";
	document.getElementById("consistdisplay").innerHTML= s;
}

let displayBlockSheet= function()
{
	let s= "<table><tr><th colspan=9>"+blockSheetColumns[0]+"</th>"+
	  "<th colspan=9>"+blockSheetColumns[1]+"</th></tr>"+
	  "<tr><th rowspan=2>Train</th><th rowspan=2>Block<br>Given</th>"+
	  "<th rowspan=2>Block<br>Entered</th>"+
	  "<th rowspan=2>Block<br>Received</th>"+
	  "<th colspan=2>Arrived</th><th colspan=2>Departed</th>"+
	  "<th rowspan=2>Block<br>Cleared</th>"+
	  "<th rowspan=2>Train</th><th rowspan=2>Block<br>Given</th>"+
	  "<th rowspan=2>Block<br>Entered</th>"+
	  "<th rowspan=2>Block<br>Received</th>"+
	  "<th colspan=2>Arrived</th><th colspan=2>Departed</th>"+
	  "<th rowspan=2>Block<br>Cleared</th></tr>"+
	  "<tr><th>Time</th><th>Trk</th><th>Time</th><th>Trk</th>"+
	  "<th>Time</th><th>Trk</th><th>Time</th><th>Trk</th></tr>";
	let addTime= function(t,func,name,label) {
		s+= "<td>";
		if (t)
			s+= timeToHM(t);
		else if (func)
			s+= "<button type='button' onclick='"+func+"(\""+name+
			  "\")'>"+label+"</button>";
		s+= "</td>";
	}
	let addTrack= function(track) {
		s+= "<td>";
		if (track)
			s+= " "+track;
		s+= "</td>";
	}
	let addTimes= function(times) {
		s+= "<td>"+times.name+"</td>";
		addTime(times.given);
		addTime(times.entered);
		if (times.train.endBlock && times.entered && !times.received)
			addTime(times.received,"requestBlock",times.name,
			  "Request");
		else
			addTime(times.received);
		addTime(times.arrived,"setArrivalTime",times.name,"Enter");
		addTrack(times.startTrack);
		addTime(times.departed,"setDepartureTime",times.name,"Enter");
		addTrack(times.endTrack);
		addTime(times.cleared);
	}
	let blank= "<td></td><td></td><td></td><td></td><td></td>"+
	  "<td></td><td></td><td></td><td></td>";
	for (let i=0; i<blockSheet[0].length || i<blockSheet[1].length; i++) {
		s+= "<tr>";
		if (i<blockSheet[0].length)
			addTimes(blockSheet[0][i]);
		else
			s+= blank;
		if (i<blockSheet[1].length)
			addTimes(blockSheet[1][i]);
		else
			s+= blank;
		s+= "</tr>";
	}
	s+= "</table>";
	let trainList= document.getElementById("blocksheet");
	trainList.innerHTML= s;
}

let setArrivalTime= function(name)
{
	for (let i=0; i<activeTrains.length; i++) {
		let train= activeTrains[i];
		if (train.name == name) {
			train.times.arrived= simTime;
			if (train.startBlock)
				train.startBlock.inUse= false;
			displayBlockSheet();
			return;
		}
	}
}

let setDepartureTime= function(name)
{
	for (let i=0; i<activeTrains.length; i++) {
		let train= activeTrains[i];
		if (train.name == name) {
			train.times.departed= simTime;
//			if (!train.times.arrived)
//				train.times.arrived= simTime;
			displayBlockSheet();
			return;
		}
	}
}

let requestBlock= function(name)
{
	for (let i=0; i<activeTrains.length; i++) {
		let train= activeTrains[i];
		if (train.name==name && train.endBlock.inUse==false) {
			train.times.received= simTime;
			train.endBlock.inUse= true;
			displayBlockSheet();
			return;
		}
	}
}
