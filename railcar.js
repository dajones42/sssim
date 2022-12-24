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

//	code for cars in trains

class RailCarPart {
	constructor(x0,m,r) {
		this.parent= -1;
		this.xOffset= x0;
		this.model= m;
		this.radius= r;
	}
	initLinReg() {
		this.sw= 0;
		this.so= 0;
		this.soo= 0;
		this.sx= 0;
		this.sxo= 0;
		this.sy= 0;
		this.syo= 0;
		this.sz= 0;
		this.szo= 0;
	}
	sumLinReg(o,x,y,z) {
		this.sw+= 1;
		this.so+= o;
		this.soo+= o*o;
		this.sx+= x;
		this.sxo+= x*o;
		this.sy+= y;
		this.syo+= y*o;
		this.sz+= z;
		this.szo+= z*o;
	}
	calcLinReg() {
		let d= this.sw*this.soo - this.so*this.so;
		if (d > 1e-20) {
			this.ax= (this.soo*this.sx - this.so*this.sxo) / d;
			this.ay= (this.soo*this.sy - this.so*this.syo) / d;
			this.az= (this.soo*this.sz - this.so*this.szo) / d;
			this.bx= (this.sw*this.sxo - this.so*this.sx) / d;
			this.by= (this.sw*this.syo - this.so*this.sy) / d;
			this.bz= (this.sw*this.szo - this.so*this.sz) / d;
		} else {
			this.ax= this.sx/this.sw;
			this.ay= this.sy/this.sw;
			this.az= this.sz/this.sw;
			this.bx= 0;
			this.by= 0;
			this.bz= 0;
		}
	}
	moveWheel(distance,rev) {
		this.location.move(distance,0);
		if (this.radius) {
			this.state+= distance/(2*Math.PI*this.radius);
			if (this.model)
				this.model.rotation.x= this.state;
		}
	}
}

class RailCar {
	constructor() {
		this.parts= [];
		this.nWheels= 0;
	}
	setLocation(offset,location,rev) {
		this.rev= rev;
		let s= rev ? -1 : 1;
		for (let i=0; i<this.nWheels; i++) {
			let part= this.parts[i];
			let loc= location.copy();
			loc.move(offset+s*part.xOffset,0);
			part.location= loc;
			part.state= 0;
			if (this.animation &&
			  part.radius>=this.mainWheelRadius-.01)
				part.radius= 0;
//			let p= loc.getPosition();
//			console.log("wheelpos "+p.x+" "+p.y+" "+p.z);
		}
		this.mainWheelState= 0;
		this.move(0);
	}
	move(distance) {
		for (let i=0; i<this.parts.length; i++)
			if (!this.parts[i].location)
				this.parts[i].initLinReg();
		for (let i=0; i<this.parts.length; i++) {
			let part= this.parts[i];
			if (part.location) {
				part.moveWheel(distance,this.rev);
				let p= part.location.getPosition();
				part.ax= p.x;
				part.ay= p.y;
				part.az= p.z;
				if (part.parent >= 0)
					this.parts[part.parent].sumLinReg(
					  part.xOffset,p.x,p.y,p.z);
			} else if (part.sw > 1.5) {
				part.calcLinReg();
				if (part.parent >= 0)
					this.parts[part.parent].sumLinReg(
					  part.xOffset,
					  part.ax+part.xOffset*part.bx,
					  part.ay+part.xOffset*part.by,
					  part.az+part.xOffset*part.bz);
			}
		}
		for (let i=0; i<this.parts.length; i++) {
			let part= this.parts[i];
			if (!part.location && part.sw<1.5 && part.parent>=0) {
				let parent= this.parts[part.parent];
				part.sumLinReg(part.xOffset,
				  parent.ax+part.xOffset*parent.bx,
				  parent.ay+part.xOffset*parent.by,
				  parent.az+part.xOffset*parent.bz);
				part.calcLinReg();
			}
		}
		for (let i=0; i<this.parts.length; i++) {
			let part= this.parts[i];
			if (part.location && part.parent>=0) {
				let parent= this.parts[part.parent];
				part.bx= parent.bx;
				part.by= parent.by;
				part.bz= parent.bz;
			} else if (part.parent>=0 && part.model) {
				let fwd= new THREE.Vector3(part.bx,part.by,0);
				fwd.normalize();
				let parent= this.parts[part.parent];
				let pfwd= new THREE.Vector3(
				  parent.bx,parent.by,0);
				pfwd.normalize();
				part.model.rotation.y=
				  Math.atan2(pfwd.y,pfwd.x)-
				  Math.atan2(fwd.y,fwd.x);
			}
			if (!part.model || part.parent>=0)
				continue;
			//let fwd= new THREE.Vector3(part.bx,part.by,part.bz);
			//fwd.normalize();
			let fwd= new THREE.Vector3(part.bx,part.by,0);
			fwd.normalize();
			part.model.position.x=
			  part.ax+part.xOffset*part.bx-center.x;
			part.model.position.y=
			  part.az+part.xOffset*part.bz-center.z;
			part.model.position.z=
			  -(part.ay+part.xOffset*part.by-center.y);
			part.model.rotation.y=
			  Math.atan2(fwd.y,fwd.x)-Math.PI/2;
//			console.log("rcpos "+part.model.position.x+" "+
//			  part.model.position.y+" "+
//			  part.model.position.z+" "+
//			  part.model.rotation.y);
		}
		if (this.mainWheelRadius > 0) {
			this.mainWheelState+=
			  distance/(2*Math.PI*this.mainWheelRadius);
			if (this.animation)
				this.animation.setTime(this.mainWheelState);
		}
	}
}
