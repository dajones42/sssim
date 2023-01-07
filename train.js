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

class Train {
	constructor(info,loc,maxd) {
		this.name= info.name;
		this.maxSpeed= parseFloat(info.maxSpeed)/2.23693;
		this.speed= 0;
		this.accel= .2;
		this.decel= .7;
		this.location= loc;
		this.endLocation= loc.copy();
		if (info.consist) {
			let consist= consists[info.consist];
			this.length= 0;
			for (let i=0; i<consist.length; i++) {
				let eq= consist[i];
				if (eq.substr(0,1)=="^")
					eq= eq.substr(1);
				let car= equipment[eq];
				if (car)
					this.length+= car.length;
				else
					console.log("missing equipment "+
					  consist[i]);
			}
		} else if (info.cars) {
			this.length= 0;
			for (let i=0; i<info.cars.length; i++)
				this.length+= info.cars[i].length;
		} else {
			this.length= 25;
		}
		if (this.location.edge.trackCircuit)
			this.location.edge.trackCircuit.occupied++;
		this.location.move(this.length,1);
		this.maxDistance= maxd;
		this.distance= 0;
		this.stopdistance= 0;
		this.stops= [];
		this.restrictedSpeed= 0;
		this.restrictedSpeedDistance= 0;
		this.nextRestrictedSpeed= 0;
	}
	addStop(dist,time) {
		if (this.stops.length == 0)
			this.stopDistance= dist;
		this.stops.push({dist:dist,time:time});
	}
	move(dt,simTime) {
		let ind= this.signal ? this.signal.getIndication() :
		  Signal.MAXINDICATION;
		let max= this.maxSpeed;
		if (this.restrictedSpeed>0 && max>this.restrictedSpeed)
			max= this.restrictedSpeed;
		let d= 1e10;
		if (ind == 0)
			d= this.signalDistance-10;
		if (this.stops.length>0 && this.stopDistance<d)
			d= this.stopDistance;
		let minsq= (d-.2)*this.decel;
		if (minsq < 0)
			minsq= 0;
		if (this.signal && this.signal.maxSpeed>0) {
			let s= this.signal.maxSpeed;
			let sq= s*s + this.signalDistance*this.decel;
			if (minsq > sq)
				minsq= sq;
		}
//		if (ind==0 && max>.5*this.maxSpeed) {
//			max= .5*this.maxSpeed;
//		} else if (ind==1 && max>.75*this.maxSpeed) {
//			minsq+= .25*max*max;
//			max= .75*this.maxSpeed;
//		}
		if (minsq > max*max)
			minsq= max*max;
		if (this.speed*this.speed > minsq) {
			this.speed-= dt*this.decel;
			if (this.speed < 0)
				this.speed= 0;
			this.throttle= 0;
		}
		if (this.speed<max && this.speed*this.speed<.96*minsq) {
			this.speed+= dt*this.accel;
			if (this.speed > max)
				this.speed= max;
			if (minsq >= max*max)
				this.throttle= max/this.maxSpeed;
		}
		if (ind==0 && dt*this.speed>d)
			this.speed= 0;
		if (this.speed==0 && this.stops.length>0 && 
		  this.stopDistance<10 && simTime>this.stops[0].time) {
			this.stops.splice(0,1);
			if (this.stops.length > 0)
				this.stopDistance= this.stops[0].dist;
			else if (this.nextTrain)
				startNextTrain(this);
		}
		let dx= this.speed*dt;
		if (dx == 0)
			return 0;
		if (this.signal) {
			this.signalDistance-= dx;
			this.signal.trainDistance-= dx;
		}
		if (this.stopDistance > 0)
			this.stopDistance-= dx;
		if (this.restrictedSpeedDistance > 0) {
			this.restrictedSpeedDistance-= dx;
			if (this.restrictedSpeedDistance <= 0) {
				this.restrictedSpeed= this.nextRestrictedSpeed;
				this.restrictedSpeedDistance= 0;
			}
		}
		this.distance+= dx;
		if (this.location.move(dx,1) || this.endLocation.move(dx,-1))
			return 1;
		for (let i=0; this.cars && i<this.cars.length; i++) {
			let car= this.cars[i];
			car.move(dx);
			updateRailcarSound(car,this.throttle,this.speed);
		}
		if (this.signal && this.signalDistance<0)
			this.findSignal();
		return 0;
	}
	findSignal() {
		if (this.signal) {
			if (this.signal.maxSpeed==0 && this.restrictedSpeed>0) {
				this.restrictedSpeedDistance= this.length;
				this.nextRestrictedSpeed= 0;
			} else if (this.signal.maxSpeed>0 &&
			  this.restrictedSpeed>0 &&
			  this.restrictedSpeed<this.signal.maxSpeed) {
				this.restrictedSpeedDistance= this.length;
				this.nextRestrictedSpeed= this.signal.maxSpeed;
			} else if (this.signal.maxSpeed>0) {
				this.restrictedSpeed= this.signal.maxSpeed;
				this.restrictedSpeedDistance= 0;
			} else {
				this.restrictedSpeed= 0;
			}
		}
		this.signalDistance= 0;
		this.signal= null;
		let loc= this.location;
		let e= loc.edge;
		let v= loc.rev ? e.v1 : e.v2;
		this.signalDistance= loc.rev ? loc.offset : e.length-loc.offset;
		while (e) {
			this.signal= v.getSignal(e);
			if (this.signal)
				break;
//			e= v.nextEdge(e);
			if (e != v.edge1)
				e= v.edge1;
			else
				e= v.edge2;
			if (!e)
				break;
			this.signalDistance+= e.length;
			v= v==e.v1 ? e.v2 : e.v1;
		}
		if (this.signal) {
			this.signal.trainDistance= this.signalDistance;
		}
	}
	createModels(info) {
		let cars= info.cars;
		let flip= [];
		if (info.consist) {
			let consist= consists[info.consist];
			cars= [];
			for (let i=0; i<consist.length; i++) {
				let eq= consist[i];
				let f= false;
				if (eq.substr(0,1)=="^") {
					eq= eq.substr(1);
					f= true;
				}
				let car= equipment[eq];
				if (car) {
					cars.push(car);
					flip.push(f);
				}
			}
		}
		if (cars) {
			this.cars= [];
			this.length= 0;
			let loc= this.location.copy();
			for (let i=0; i<cars.length; i++) {
				let car= cars[i];
				let dir= mstsDir+fspath.sep+"TRAINS"+
				  fspath.sep+"TRAINSET"+fspath.sep+
				  car.directory;
				let railcar= new RailCar();
				let model= getMstsModel(
				  dir+fspath.sep+car.shape,dir,null,
				  railcar,1000);
				if (!model)
					continue;
				this.length+= car.length;
				loc.move(-car.length/2,0);
				railcar.setLocation(0,loc,flip[i]);
				loc.move(-car.length/2,0);
				this.cars.push(railcar);
				railcar.model= model;
				scene.add(model);
				if (car.fashape) {
					let famodel= getMstsModel(
					  dir+fspath.sep+car.fashape,dir,null,
					  null,1000);
					model.add(famodel);
					famodel.rotation.y= 0;
					famodel.scale.z= 1;
				}
				if (car.lights)
					railcar.addLights(i==0,
					  i==cars.length-1,car.lights,flip[i]);
				if (car.sound) {
					loadRailcarSounds(railcar,car.sound);
				}
			}
		}
	}
	removeModels() {
		for (let i=0; i<this.cars.length; i++) {
			let car= this.cars[i];
			if (car.model)
				scene.remove(car.model);
		}
		this.endLocation.move(this.length,-1);
		if (this.location.edge.trackCircuit)
			this.location.edge.trackCircuit.occupied--;
	}
	reverse() {
		let t= this.location;
		this.location= this.endLocation;
		this.location= t;
		this.location.rev= !this.location.rev;
		this.endLocation.rev= !this.endLocation.rev;
		this.cars.reverse();
		for (let i=0; i<this.cars.length; i++)
			this.cars[i].reverse();
	}
}
