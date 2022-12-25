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

//	lever drawing related code

//	initialize 2d lever display
let setupLevers= function()
{
	let canvas= document.getElementById('levercanvas');
	canvas.addEventListener('mousedown',leverMouseDown);
}

//	draw display in map canvas
let renderLevers= function()
{
	if (!interlocking)
		return;
//	console.log("renderlevers");
	let canvas= document.getElementById("levercanvas");
	let leverSpacing= 20;
	let leverWidth= 8;
	let leverHeight= 100;
	canvas.width= leverSpacing*interlocking.levers.length;
	let context= canvas.getContext("2d");
	context.clearRect(0,0,canvas.width,canvas.height);
	context.textAlign= "center";
	for (let i=0; i<interlocking.levers.length; i++) {
		let lever= interlocking.levers[i];
		let x= i*leverSpacing;
		let x1= x+.5*(leverSpacing-leverWidth);
		let y= .1*leverHeight;
		if (lever.state == Interlocking.NORMAL)
			y= 0;
		else if (lever.state == Interlocking.REVERSE)
			y= .2*leverHeight;
		context.fillStyle= "#888";
//		console.log("lever "+(i+1)+" "+lever.state+" "+x+" "+y);
		context.fillRect(x1,y,leverWidth,.2*leverHeight);
		y+= .2*leverHeight;
		context.fillStyle= lever.color;
		context.fillRect(x1,y,leverWidth,leverHeight);
		context.fillRect(x+1,y+1,leverSpacing-2,leverSpacing-2);
		context.fillStyle= "white";
		context.fillText((i+1).toString(),
		  x+.5*leverSpacing,y+.7*leverSpacing);
	}
}

//	handle mouse down event in lever canvas
let leverMouseDown= function(event)
{
	if (!interlocking)
		return;
	let canvas= document.getElementById('levercanvas');
	downX= event.pageX-canvas.offsetLeft;
	downY= event.pageY-canvas.offsetTop;
	let leverSpacing= 20;
	let lever= Math.floor(downX/leverSpacing)+1;
//	console.log("leverdown "+downX+" "+downY+" "+lever);
	if (lever>0 && lever<=interlocking.levers.length &&
	  interlocking.toggleState(lever,simTime))
		renderLevers();
	event.preventDefault();
}

let renderModelBoard= function()
{
	if (!interlocking)
		return;
	let canvas= document.getElementById("modelboardcanvas");
	let leverSpacing= 20;
	let leverWidth= 8;
	canvas.width= leverSpacing*interlocking.levers.length;
	let context= canvas.getContext("2d");
	context.clearRect(0,0,canvas.width,canvas.height);
	for (let i=0; i<interlocking.levers.length; i++) {
		let lever= interlocking.levers[i];
		let x= i*leverSpacing;
		let x1= x+.5*(leverSpacing-leverWidth);
		if (interlocking.getSwitchOccupied(i+1)) {
			context.fillStyle= lever.color;
			context.fillRect(x1,0,leverWidth,canvas.height);
		} else {
			let ind= interlocking.getSignalState(i+1);
			if (ind == 0) {
				context.fillStyle= "#f00";
				context.fillRect(x1,0,leverWidth,canvas.height);
			} else if (ind > 0) {
				context.fillStyle= "#0c0";
				context.fillRect(x1,0,leverWidth,canvas.height);
			}
		}
	}
}
