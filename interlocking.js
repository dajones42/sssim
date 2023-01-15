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

//	code for user controlled interlocking

class Interlocking {
	static NORMAL= 1;
	static REVERSE= 2;
	constructor (numLevers) {
		this.levers= [];
		for (let i=0; i<numLevers; i++)
			this.levers.push({state:Interlocking.NORMAL,
			  color:"#888",switches:[],signals:[]});
		this.locks= [];
		this.routeLocks= [];
		this.lockdelay= 120;
	}
	// returns information for the indicated lever
	// lever numbers passed to member functions are one based
	getLever(lever) {
		return this.levers[lever-1];
	}
	// add locking information for a pair of lever states
	addLocking(lever1,state1,lever2,state2,when) {
//		console.log("addlocking "+lever1+" "+state1+" "+
//		  lever2+" "+state2+" "+when);
		if (when) {
			let whencopy= [];
			for (let i=0; when && i<when.length; i++)
				whencopy.push(when[i]);
			this.locks.push({ lever1:lever1, state1:state1,
			  lever2:lever2, state2:state2, when:whencopy });
		} else {
			for (let i=0; i<this.locks.length; i++) {
				let lock= this.locks[i];
				if (lock.lever1==lever1 &&
				  lock.state1==state1 &&
				  lock.lever2==lever2 &&
				  lock.state2==state2)
					return;
			}
			this.locks.push({ lever1:lever1, state1:state1,
			  lever2:lever2, state2:state2 });
		}
	}
	// adds a condition to the latest lock
	addCondition(lever,state) {
		let i= this.locks.length;
		if (i > 0) {
			let lock= this.locks[i-1];
			if (!lock.when)
				lock.when= [];
			lock.when.push({lever:lever,state:state});
		}
	}
	// adds a switch to the indicated lever
	addSwitch(lever,swVertex,rev) {
		this.levers[lever-1].switches.push({vertex:swVertex,rev:rev});
		this.levers[lever-1].color= "#000";
		swVertex.lever= lever;
	}
	// adds a signal to the indicated lever
	addSignal(lever,signal) {
		this.levers[lever-1].signals.push(signal);
		this.levers[lever-1].color= "#a00";
		signal.lever= lever;
	}
	// returns true if a switch connected to the indicated lever is occupied
	getSwitchOccupied(lvr) {
		let lever= this.levers[lvr-1];
		for (let i=0; i<lever.switches.length; i++)
			if (lever.switches[i].vertex.occupied)
				return true;
		return false;
	}
	// returns state of signals attached to the indicated lever
	// -1 if no train approaching
	// 0 if train approaching STOP signal
	// >0 if train appoaching CLEAR signal
	getSignalState(lvr,approach) {
		let lever= this.levers[lvr-1];
		let result= Signal.MAXINDICATION+1;
		for (let i=0; i<lever.signals.length; i++) {
			let sig= lever.signals[i];
			if ((!approach || sig.trainDistance>0) &&
			  result>sig.indication)
				result= sig.indication;
		}
		return result>Signal.MAXINDICATION ? -1 : result;
	}
	// returns remaining lever lock duration
	getLockDuration(lever,timeS) {
		if (this.levers[lever-1].lockTime == 0)
			return 0;
		let dt= this.lockDelay - (timeS-levers[lever-1].lockTime);
		return dt>0 ? dt : 0;
	}
	// returns true if the indicated lever cannot be moved
	isLocked(lever) {
		if (this.levers[lever-1].routeLock ||
		  this.getSwitchOccupied(lever))
			return true;
		let state= this.levers[lever-1].state;
//		console.log("islocked "+lever+" "+state);
		for (let i=0; i<this.locks.length; i++) {
			let lock= this.locks[i];
			if (lock.when) {
				let j=0;
				for (; lock.when && j<lock.when.length; j++) {
					let w= lock.when[j];
					let state= this.levers[w.lever-1].state;
					if ((state&w.state) == 0)
						break;
				}
				if (j < lock.when.length)
					continue;
			}
//			console.log(" "+i+" "+lock.lever1+" "+lock.state1+" "+
//			  lock.lever2+" "+lock.state2);
			if (lock.lever1==lever && (lock.state1&state)==0 &&
			  (this.levers[lock.lever2-1].state&lock.state2)==0)
				return true;
			if (lock.lever2==lever && (lock.state2&state)!=0 &&
			  (this.levers[lock.lever1-1].state&lock.state1)!=0)
				return true;
		}
		return false;
	}
	// changes the state of the indicated lever if possible
	// returns true if changed and false if the lever cannot be moved
	// changes the state of attached switches and signals
	toggleState(lever,timeS) {
//		console.log("toggle "+lever);
		if (this.isLocked(lever))
			return false;
//		console.log("toggle "+lever+" not locked");
		let lvr= this.levers[lever-1];
		if (lvr.state == Interlocking.NORMAL) {
			lvr.state= Interlocking.REVERSE;
			for (let i=0; i<lvr.switches.length; i++) {
				let sw= lvr.switches[i];
				sw.vertex.throwSwitch(!sw.rev);
			}
			for (let i=0; i<lvr.signals.length; i++) {
				let sig= lvr.signals[i];
				sig.setState(Signal.CLEAR);
			}
		} else if (this.getLockDuration(lever,timeS) <= 0) {
			let i=0;
			for (; i<lvr.signals.length; i++) {
				let sig= lvr.signals[i];
				if (lvr.lockTime==0 && sig.trainDistance>0)
					break;
			}
			if (i < lvr.signals.length) {
				lvr.state= Interlocking.REVERSE|
				  Interlocking.NORMAL;
				lvr.lockTime= timeS;
			} else {
				lvr.state= Interlocking.NORMAL;
				lvr.lockTime= 0;
			}
			for (let i=0; i<lvr.switches.length; i++) {
				let sw= lvr.switches[i];
				sw.vertex.throwSwitch(sw.rev);
			}
			for (let i=0; i<lvr.signals.length; i++) {
				let sig= lvr.signals[i];
				sig.setState(Signal.STOP);
			}
		} else {
			lvr.state= Interlocking.REVERSE;
			for (let i=0; i<lvr.signals.length; i++) {
				let sig= lvr.signals[i];
				sig.setState(Signal.CLEAR);
			}
		}
		return true;
	}
	// sets the state of the indicated lever
	setState(lever,state,timeS) {
		if (this.levers[lever-1].state == state)
			return true;
		return this.toggleState(lever,timeS);
	}
	printLocks(lever) {
		for (let i=0; i<this.locks.length; i++) {
			let lock= this.locks[i];
			if (lever && lever!=lock.lever1)
				continue;
			console.log(" lock "+lock.lever1+" "+lock.state1+" "+
			  lock.lever2+" "+lock.state2);
			for (let j=0; lock.when && j<lock.when.length; j++)
				console.log("  when "+lock.when[j].lever+" "+
				  lock.when[j].state);
		}
	}
}

//	Build interlocking given map objects using locking defined on
//	switch and signals
let makeInterlocking= function()
{
	let n= 0;
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.lever && n<o.lever)
			n= o.lever;
	}
	console.log("levers "+n);
	interlocking= new Interlocking(n);
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
//		console.log("object "+i+" "+o.type+" "+o.lever);
		if (o.type=="switch" && o.lever) {
			let v= findVertex(o.u,o.v,false);
			if (!v) {
				console.log("cannot find vertex "+i+" "+o.type);
				continue;
			}
			interlocking.addSwitch(o.lever,v,0);
			if (o.lock) {
				let lock= parseInt(o.lock);
				if (lock<1 || lock>n) {
					console.log(
					  "switch lock out of range "+
					  o.lever+" "+lock);
					continue;
				}
				interlocking.levers[lock-1].color="#00a";
				interlocking.addLocking(lock,
				  Interlocking.REVERSE,o.lever,
				  Interlocking.NORMAL|Interlocking.REVERSE);
				v.lock= lock;
			}
		} else if (o.type == "signal") {
			let v= findVertex(o.u,o.v,false);
			if (!v) {
				console.log("cannot find vertex "+i+" "+o.type);
				continue;
			}
			let signal= new Signal(v);
			if (o.lever > 0) {
				interlocking.addSignal(o.lever,signal);
			} else {
				signal.state= Signal.CLEAR;
				signal.indication= Signal.MAXINDICATION;
			}
			if (o.direction)
				v.signal1= signal;
			else
				v.signal2= signal;
			if (o.lock && o.lock!="calc")
				parseSignalLock(o.lever,o.lock);
			if (o.maxSpeed)
				signal.maxSpeed= o.maxSpeed/2.23693;
		}
	}
	for (let i=0; i<mapObjects.length; i++) {
		let o= mapObjects[i];
		if (o.type=="signal" && o.trackCircuit) {
			let tc= { name: o.trackCircuit, occupied: 0 };
			trackCircuits[o.trackCircuit]= tc;
			let v= findVertex(o.u,o.v,false);
			let e= o.direction ? v.edge2 : v.edge1;
			while (e) {
				e.trackCircuit= tc;
				v= v==e.v1 ? e.v2 : e.v1;
				if (v.getSignal(e))
					break;
				e= v.nextEdge(e);
			}
		}
		if (o.type=="signal" && o.lever>0 && o.lock && o.lock=="calc") {
			let v= findVertex(o.u,o.v,false);
			let e= o.direction ? v.edge2 : v.edge1;
			console.log("addsignalocking "+o.lever);
			addSignalLocking(o.lever,v,e,[]);
		}
	}
}

//	creates locking from lock string
let parseSignalLock= function(lever,lock)
{
	let locks= lock.split(',');
	for (let i=0; i<locks.length; i++) {
		let lever2= parseInt(locks[i]);
		if (lever2<1 || lever2>interlocking.levers.length) {
			console.log("signal lock out of range "+
			  lever+" "+lever2);
			continue;
		}
		let state= Interlocking.NORMAL|Interlocking.REVERSE;
		if (locks[i].indexOf('N')>0)
			state= Interlocking.NORMAL;
		else if (locks[i].indexOf('R')>0)
			state= Interlocking.REVERSE;
//		console.log("parselock "+i+" "+locks[i]+" "+lever2+" "+state);
		interlocking.addLocking(lever,Interlocking.REVERSE,
		  lever2,state);
	}
}

//	adds locking for a signal lever by recursively following all paths
//	starting at the signal and ending at a controlled signal facing back.
let addSignalLocking= function(lever,v,e,when)
{
//	console.log("addsignalocking "+lever+" "+when.length);
	let pe= e;
	while (e) {
		v= v==e.v1 ? e.v2 : e.v1;
		pe= e;
		e= e==v.edge1 ? v.edge2 : v.edge1;
		let signal= v.getSignal(e);
		if (signal && signal.lever) {
//			console.log("back signal "+lever+" "+signal.lever);
//			for (let i=0; i<when.length; i++)
//				console.log(" when "+when[i].lever+" "+
//				  when[i].state);
			if (lever < signal.lever)
				interlocking.addLocking(
				  lever,Interlocking.REVERSE,
				  signal.lever,Interlocking.NORMAL,when);
			return;
		}
		if (v.swEdges && v.lever)
			break;
	}
	if (!e) {
		console.log("path with no exit signal "+lever);
		for (let i=0; i<when.length; i++)
			console.log(" when "+when[i].lever+" "+when[i].state);
		return;
	}
	if (v.lock)
		interlocking.addLocking(lever,Interlocking.REVERSE,
		  v.lock,Interlocking.REVERSE,when);
	if (e == v.edge1) {
//		console.log("trailing "+v.lever+" "+v.mainEdge+" "+
//		  (v.swEdges[v.mainEdge]==pe)+" "+pe);
		interlocking.addLocking(lever,Interlocking.REVERSE,
		  v.lever,v.swEdges[v.mainEdge]==pe?Interlocking.NORMAL:
		  Interlocking.REVERSE,when);
		addSignalLocking(lever,v,e,when);
	} else {
//		console.log("facing "+v.lever);
		when.push({lever:v.lever,state:Interlocking.NORMAL});
		addSignalLocking(lever,v,v.edge2,when);
		when.pop();
		interlocking.setState(v.lever,Interlocking.REVERSE,0);
		when.push({lever:v.lever,state:Interlocking.REVERSE});
		addSignalLocking(lever,v,v.edge2,when);
		when.pop();
		interlocking.setState(v.lever,Interlocking.NORMAL,0);
	}
}
