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

let eventQueue= [];	// 2-heap with earliest time first

//	adds an event to the events queue
let addEvent= function(time,func,train)
{
	eventQueue.push({time:time, handle:func, train:train });
	let i= eventQueue.length-1;
	while (i > 0) {
		let p= Math.floor((i-1)/2);
		if (eventQueue[i].time >= eventQueue[p].time)
			break;
		let t= eventQueue[p];
		eventQueue[p]= eventQueue[i];
		eventQueue[i]= t;
		i= p;
	}
//	printEvents();
}

let printEvents= function()
{
	for (let i=0; i<eventQueue.length; i++) {
		let e= eventQueue[i];
		console.log("event "+i+" "+e.time);
	}
}

let updateEvents= function(time)
{
	while (eventQueue.length>0 && eventQueue[0].time<=time) {
		let e= eventQueue[0];
		let len= eventQueue.length-1;
		eventQueue[0]= eventQueue[len];
		eventQueue.length= len;
		let i= 0;
		while (i < len) {
			let j= 2*i+1;
			if (j >= len)
				break;
			let j1= j+1;
			if (j1<len && eventQueue[j].time>eventQueue[j1].time)
				j= j1;
			if (eventQueue[i].time <= eventQueue[j].time)
				break;
			let t= eventQueue[i];
			eventQueue[i]= eventQueue[j];
			eventQueue[j]= t;
			i= j;
		}
		e.handle(e);
//		printEvents();
	}
}
