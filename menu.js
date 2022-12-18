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

//	Menu setup code for Signal Station Simulator

//	adds menu to main window
let setupMenu= function() {
	var topMenu= new nw.Menu({type: 'menubar'});
	var fileMenu= new nw.Menu();
	fileMenu.append(new nw.MenuItem({
		label: 'New',
		click: function() {
			document.getElementById('fileopentdb').click();
		}
	}));
	fileMenu.append(new nw.MenuItem({
		label: 'Open',
		click: function() {
			document.getElementById('fileopen').click();
		}
	}));
	fileMenu.append(new nw.MenuItem({
		label: 'Save',
		click: function() {
			let e= document.getElementById('filesave');
			e.value= "";
			e.click();
		}
	}));
	topMenu.append(new nw.MenuItem({
		label: 'File',
		submenu: fileMenu
	}));
	var editMenu= new nw.Menu();
	editMenu.append(new nw.MenuItem({
		label: 'Change Lever',
		click: changeLever
	}));
	editMenu.append(new nw.MenuItem({
		label: 'Change Lock',
		click: changeLock
	}));
	editMenu.append(new nw.MenuItem({
		label: 'Change Maximum Speed',
		click: changeSpeed
	}));
	editMenu.append(new nw.MenuItem({
		label: 'Change Name',
		click: changeName
	}));
	editMenu.append(new nw.MenuItem({
		label: 'Toggle Signal Direction',
		click: toggleSignalDirection
	}));
	editMenu.append(new nw.MenuItem({
		label: 'Delete',
		click: deleteSelected
	}));
	topMenu.append(new nw.MenuItem({
		label: 'Edit',
		submenu: editMenu
	}));
	var runMenu= new nw.Menu();
	runMenu.append(new nw.MenuItem({
		label: 'Start',
		click: startSimulation
	}));
	runMenu.append(new nw.MenuItem({
		label: 'Pause',
		click: pauseSimulation
	}));
	topMenu.append(new nw.MenuItem({
		label: 'Run',
		submenu: runMenu
	}));
	nw.Window.get().menu= topMenu;
	let addMenu= new nw.Menu();
	addMenu.append(new nw.MenuItem({label:'Switch',click:addSwitch}));
	addMenu.append(new nw.MenuItem({label:'Signal',click:addSignal}));
	addMenu.append(new nw.MenuItem({label:'Camera',click:addCamera}));
	addMenu.append(new nw.MenuItem({label:'Location',click:addLocation}));
	document.getElementById('canvas').addEventListener('contextmenu',
		function(event) {
			event.preventDefault();
			let canvas= document.getElementById('canvas');
			downX= event.pageX-canvas.offsetLeft;
			downY= event.pageY-canvas.offsetTop;
			addMenu.popup(event.x,event.y);
			return false;
		},false);
	document.getElementById('fileopentdb').addEventListener('change',
		function(e) {
			console.log('open '+this.value);
			trackDB= readTrackDB(this.value);
			readTiles();
			findCenter();
			calcTrackDBUV();
			makeTrack();
			renderCanvas();
		});
	document.getElementById('fileopen').addEventListener('change',
		function(e) {
//			console.log('open '+this.value);
			readData(this.value);
		});
	document.getElementById('filesave').addEventListener('change',
		function(e) {
			console.log('save '+this.value);
			saveData(this.value);
		});
}
