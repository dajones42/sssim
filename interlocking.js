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
		this.interlocks= [];
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
		if (!when)
			when=[];
//		console.log("addlocking "+lever1+" "+state1+" "+
//		  lever2+" "+state2);
		this.interlocks.push({ lever1:lever1, state1:state1,
		  lever2:lever2, state2:state2, when:when });
	}
	// adds a condition to the latest interlock
	addCondition(lever,state) {
		let i= this.interlocks.length;
		if (i > 0)
			this.interlocks[i-1].when.push(
			  {lever:lever,state:state});
	}
	// adds a switch to the indicated lever state
	addSwitch(lever,swVertex,rev) {
		this.levers[lever-1].switches.push({vertex:swVertex,rev:rev});
		this.levers[lever-1].color= "#000";
	}
	// adds a signal to the indicated lever
	addSignal(lever,signal) {
		this.levers[lever-1].signals.push(signal);
		this.levers[lever-1].color= "#a00";
	}
	// returns true if a switch connected to the indicated lever is occupied
	getSwitchOccupied(lvr) {
		let lever= this.levers[lvr-1];
		for (let i=0; i<lever.switches.length; i++)
			if (lever.switches[i].vertex.occupied)
				return true;
		return false;
	}
	getSignalState(lvr) {
		let lever= this.levers[lvr-1];
		let result= Signal.MAXINDICATION+1;
		for (let i=0; i<lever.signals.length; i++) {
			let sig= lever.signals[i];
			if (sig.trainDistance>0 && result>sig.indication)
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
		for (let i=0; i<this.interlocks.length; i++) {
			let lock= this.interlocks[i];
			let j=0;
			for (; j<lock.when.length; j++) {
				let w= lock.when[j];
				if ((this.levers[w.lever-1].state&w.state)==0)
					break;
			}
			if (j < lock.when.length)
				continue;
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
		return toggleState(lever,timeS);
	}
}

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
			if (o.lock)
				parseSignalLock(o.lever,o.lock);
			if (o.maxSpeed)
				signal.maxSpeed= o.maxSpeed/2.23693;
		}
	}
}

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
