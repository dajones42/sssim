/*
Copyright © 2023 Doug Jones

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

//	code for track circuits

let trackCircuits= {};

class TrackCircuit {
	constructor (name) {
		this.name= name;
		this.occupied= 0;
		this.signals= [];
	}
	static get(name) {
		let tc= trackCircuits[name];
		if (tc)
			return tc;
		tc= new TrackCircuit(name);
		trackCircuits[name]= tc;
		return tc;
	}
	incOccupied() {
		this.occupied++;
		console.log("tc "+this.name+" "+this.occupied);
	}
	decOccupied() {
		this.occupied--;
		console.log("tc "+this.name+" "+this.occupied);
		if (this.occupied == 0) {
			for (let i=0; i<this.signals.length; i++)
				this.signals[i].update();
			this.signals= [];
		}
	}
	addSignal(signal) {
		this.signals.push(signal);
	}
}
