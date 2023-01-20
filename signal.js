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

//	code for user controlled interlocking signal

class Signal {
	static STOP= 0;
	static CLEAR= 1;
	static MAXINDICATION= 3;
	constructor (vertex) {
		this.state= Signal.STOP;
		this.vertex= vertex;
		this.trainDistance= 0;
		this.indication= 0;
		this.tumbleDown= false;
		this.maxSpeed= 0;
	}
	setState(state) {
		this.state= state;
		this.update();
	}
	setDistant() {
		this.isDistant= true;
		this.indication= 1;
	}
	getIndication() {
		return this.indication;
	}
	update() {
		if (this.state == Signal.STOP) {
			this.setIndication(0);
			return;
		}
		let v= this.vertex;
		let e= v.edge1;
		if (v.getSignal(e) != this)
			e= v.edge2;
		let clear= true;
		let nextSignal= null;
		while (e) {
			e= v.nextEdge(e);
			if (!e)
				break;
			if (e.trackCircuit && e.trackCircuit.occupied>0) {
				e.trackCircuit.addSignal(this);
				clear= false;
				break;
			}
			v= e.v1==v ? e.v2 : e.v1;
			nextSignal= v.getSignal(e);
			if (nextSignal)
				break;
		}
		if (!clear) {
			this.setIndication(0);
		} else if (!nextSignal) {
			this.setIndication(Signal.MAXINDICATION);
		} else if (nextSignal.indication==0 && nextSignal.tumbleDown) {
			this.tumbleDown= true;
			this.setIndication(0);
		} else if (nextSignal.indication < Signal.MAXINDICATION) {
			this.setIndication(nextSignal.indication+1);
		} else {
			this.setIndication(Signal.MAXINDICATION);
		}
	}
	setIndication(ind) {
		if (this.isDistant && ind==0)
			ind= 1;
		if (this.indication == ind)
			return;
		this.indication= ind;
		if (this.indication > 0)
			this.tumbleDown= false;
		let prevSignal= null;
		let v= this.vertex;
		let e= v.edge1;
		if (v.getSignal(e) != this)
			e= v.edge2;
		while (e) {
			v= e.v1==v ? e.v2 : e.v1;
			e= v.nextEdge();
			if (!e)
				break;
			prevSignal= v.getSignal(e);
			if (prevSignal)
				break;
		}
		if (prevSignal)
			prevSignal.update();
	}
}
