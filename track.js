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

let edges= [];
let vertices= [];

class Edge {
	constructor(vert1,n1,vert2,n2) {
		this.v1= vert1;
		this.v2= vert2;
		this.occupied= 0;
		this.v1.saveEdge(this,n1);
		this.v2.saveEdge(this,n2);
		this.length= this.v1.position.distanceTo(this.v2.position);
		if (this.length < .001)
			this.length= .001;
	}
	setCircle(radius,angle) {
		let x= -4*radius*(1-Math.cos(.5*angle))/3;
		if (angle < 0)
			x= -x;
		let dx= this.v1.position.x - this.v2.position.x;
		let dy= this.v1.position.y - this.v2.position.y;
		let r= Math.sqrt(dx*dx+dy*dy);
		this.ddx= x*dy/r;
		this.ddy= -x*dx/r;
	}
	getPosition(offset) {
		let a= offset/this.length;
		let p= this.v1.position.clone().multiplyScalar(1-a).add(
		  this.v2.position.clone().multiplyScalar(a));
		if (this.ddx || this.ddy) {
			let b= 1-a;
			let a3= a*a*a-a;
			let b3= b*b*b-b;
			p.x+= this.ddx*(b3+a3);
			p.y+= this.ddy*(b3+a3);
		}
		return p;
	}
}

class Vertex {
	constructor(x,y,z) {
		this.position= new THREE.Vector3(x,y,z);
		this.edge1= null;
		this.edge2= null;
		this.occupied= 0;
	}
	nextEdge(e) {
		if (e == this.edge1)
			return this.edge2;
		if (e == this.edge2)
			return this.edge1;
		return null;
	}
	saveEdge(e,n) {
		if (n == 0) {
			this.edge1= e;
		} else if (n == 1) {
			if (this.swEdges) {
				this.swEdges[0]= e;
				if (this.mainEdge == 0)
					this.edge2= e;
			} else {
				this.edge2= e;
			}
		} else if (this.swEdges) {
			this.swEdges[1]= e;
			if (this.mainEdge == 1)
				this.edge2= e;
		}
	}
	getSignal(e) {
		if (e == this.edge1)
			return this.signal1 || null;
		if (e == this.edge2)
			return this.signal2 || null;
		return null;
	}
	throwSwitch(e) {
		if (e === 0)
			e= this.swEdges[this.mainEdge];
		else if (e === 1) 
			e= this.swEdges[1-this.mainEdge];
		if (this.occupied>0 || e==this.edge1 || e==this.edge2)
			return;
		if (this.edge2 == this.swEdges[0])
			this.edge2= this.swEdges[1];
		else
			this.edge2= this.swEdges[0];
	}
}

let makeTrack= function()
{
	let getPin= function(node,id) {
		for (let i=0; i<node.pins.length; i++)
			if (node.pins[i].node == id)
				return i;
		return -1;
	}
	for (let i=0; i<trackDB.nodes.length; i++) {
		let node= trackDB.nodes[i];
		if (!node || node.sections)
			continue;
		let v= new Vertex(node.u,node.v,node.y+.275);
		node.vertex= v;
		vertices.push(v);
		if (node.shape) {
			let shape= trackDB.tSection.shapes[node.shape];
			v.mainEdge= shape.mainRoute || 0;
			v.swEdges= [null,null];
		}
	}
	for (let i=0; i<trackDB.nodes.length; i++) {
		let node= trackDB.nodes[i];
		if (!node || !node.sections)
			continue;
		let node1= trackDB.nodes[node.pins[0].node];
		let node2= trackDB.nodes[node.pins[1].node];
		let pin1= getPin(node1,i);
		let pin2= getPin(node2,i);
		let v1= node1.vertex;
		let s1= node.sections[0];
		for (let j=1; j<node.sections.length; j++) {
			let s2= node.sections[j];
			let v2= new Vertex(s2.u,s2.v,s2.y+.275);
			vertices.push(v2);
			let e= new Edge(v1,pin1,v2,0);
			edges.push(e);
			let sinfo= trackDB.tSection.sections[s1.sectionID];
			if (sinfo.radius) {
				e.setCircle(sinfo.radius,
				  sinfo.angle*Math.PI/180);
				e.length= sinfo.radius*sinfo.angle*Math.PI/180;
				if (e.length < 0)
					e.length= -e.length;
			}
			v1= v2;
			pin1= 1;
			s1= s2;
		}
		let v2= node2.vertex;
		let e= new Edge(v1,pin1,v2,pin2);
		edges.push(e);
	}
}

let checkEdgeLengths= function(lbl)
{
	for (let i=0; i<edges.length; i++) {
		let e= edges[i];
		let len= e.v1.position.distanceTo(e.v2.position);
		if (Math.abs(len-e.length) > .002) {
			console.log("elen "+i+" "+e.length+" "+len+" "+lbl);
			return;
		}
	}
}

class Location {
	constructor(e,o,r) {
		this.edge= e;
		this.offset= o;	//distance from edge.v1
		this.rev= r;	// true if move is toward edge.v1
	}
	set(e,o,r) {
		this.edge= e;
		this.offset= o;
		this.rev= r;
	}
	copy() {
		return new Location(this.edge,this.offset,this.rev);
	}
	getPosition() {
		return this.edge.getPosition(this.offset);
	}
	// return distance between two location on the same edge
	distance(other) {
		if (this.edge != other.edge)
			return 1e10;
		if (this.offset > other.offset)
			return this.offset-other.offset;
		return other.offset-this.offset;
	}
	// returns distance between two locations no matter what edge
	dDistance(other) {
		if (this.edge == other.edge)
			return this.rev ? this.offset-other.offset :
			 other.offset-this.offset;
		let d= this.offset;
		let v= this.edge.v1;
		let e= this.edge;
		for (;;) {
			e= v.edge1==e ? v.edge2 : v.edge1;
			if (e == null)
				break;
			if (e == other.edge) {
				d+= v==e.v1 ? other.offset :
				  e.length-other.offset;
				return this.rev ? d : -d;
			}
			d+= e.length;
			v= v==e.v1 ? e.v2 : e.v1;
		}
		d= this.length-this.offset;
		v= this.edge.v2;
		e= this.edge;
		for (;;) {
			e= v.edge1==e ? v.edge2 : v.edge1;
			if (e == null)
				break;
			if (e == other.edge) {
				d+= v==e.v1 ? other.offset :
				  e.length-other.offset;
				return this.rev ? -d : d;
			}
			d+= e.length;
			v= v==e.v1 ? e.v2 : e.v1;
		}
		return 1e30;
	}
	spDistance() {
		let e= this.edge;
		if (e.v1.dist < e.v2.dist)
			return e.v1.dist+this.offset;
		else
			return e.v2.dist+e.length-this.offset;
	}
	move(distance,dOccupied) {
		let reverse= distance<0;
		if (reverse) {
			distance= -distance;
			dOccupied= -dOccupied;
		}
		for (;;) {
			let max= reverse==this.rev ?
			  this.edge.length-this.offset : this.offset;
			if (distance <= max) {
				if (reverse == this.rev)
					this.offset+= distance;
				else
					this.offset-= distance;
				return 0;
			}
			distance-= max;
			let v= reverse==this.rev ? this.edge.v2 : this.edge.v1;
			let e= this.edge;
			if (this.edge != v.edge1) {
				this.edge= v.edge1;
			} else if (v.edge2 == null) {
				if (v == this.edge.v1)
					this.offset= 0;
				else
					this.offset= this.edge.length;
				return 1;
			} else {
				this.edge= v.edge2;
			}
			if (dOccupied < 0) {
				v.occupied--;
				this.edge.occupied--;
				if (this.edge.trackCircuit!=e.trackCircuit &&
				  e.trackCircuit) {
					e.trackCircuit.occupied--;
					console.log("tc "+e.trackCircuit.name+
					  " "+e.trackCircuit.occupied);
				}
			} else if (dOccupied > 0) {
				v.occupied++
				this.edge.occupied++
				if (this.edge.trackCircuit!=e.trackCircuit &&
				  this.edge.trackCircuit) {
					this.edge.trackCircuit.occupied++;
					console.log("tc "+
					  this.edge.trackCircuit.name+" "+
					  this.edge.trackCircuit.occupied);
				}
			}
			if (v == this.edge.v1) {
				this.offset= 0;
				this.rev= reverse;
			} else {
				this.offset= this.edge.length;
				this.rev= !reverse;
			}
		}
	}
}

let findLocation= function(x,y)
{
	let bestD= 1e30;
	let bestE= null;
	let bestO= 0;
	let bestR= false;
	for (let i=0; i<edges.length; i++) {
		let e= edges[i];
		let p1= e.v1.position;
		let p2= e.v2.position;
		let dx= p2.x-p1.x;
		let dy= p2.y-p1.y;
		let d= dx*dx + dy*dy;
		let n= dx*(p1.x-x) + dy*(p1.y-y);
		if (d==0 || n<=0) {
			dx= p1.x-x;
			dy= p1.y-y;
			n= 0;
		} else if (n >= d) {
			dx= p2.x-x;
			dy= p2.y-y;
			n= e.length;
		} else {
			dx= p1.x - x + dx*n/d;
			dy= p1.y - y + dy*n/d;
			n= e.length*n/d;
		}
		d= dx*dx + dy*dy;
		if (bestD > d) {
			bestD= d;
			bestE= e;
			bestO= n;
			bestR= e.v2.nextEdge(e)==null ? 1 : 0;
		}
	}
	return { d: bestD, loc: new Location(bestE,bestO,bestR) };
}

let findVertex= function(x,y,switchOnly)
{
	let bestD= 1e30;
	let bestV= null;
	for (let i=0; i<vertices.length; i++) {
		let v= vertices[i];
//		if (switchOnly && !v.swEdges)
//			continue;
		let dx= v.position.x-x;
		let dy= v.position.y-y;
		let d= dx*dx + dy*dy;
		if (bestD > d) {
			bestD= d;
			bestV= v;
		}
	}
	console.log("bestd "+bestD);
	return bestV;
}

let findSPT= function(startLocation,bothDirections)
{
	for (let i=0; i<vertices.length; i++) {
		let v= vertices[i];
		v.dist= 1e10;
		v.inEdge= null;
	}
	vQueue= [];
	let e= startLocation.edge;
	e.v1.dist= startLocation.offset;
	e.v1.inEdge= e;
	e.v2.dist= e.length-startLocation.offset;
	e.v2.inEdge= e;
	if (bothDirections || startLocation.rev)
		vQueue.push(e.v1);
	if (bothDirections || !startLocation.rev)
		vQueue.push(e.v2);
	let vQueueSize= vQueue.length;
	while (vQueueSize > 0) {
		let besti= 0;
		for (let i=1; i<vQueueSize; i++)
			if (vQueue[besti].dist > vQueue[i].dest)
				besti= i;
		let v= vQueue[besti];
		vQueue[besti]= vQueue[--vQueueSize];
		for (let i=0; i<2; i++) {
			e= null;
			if (v.swEdges && v.inEdge==v.edge1)
				e= v.swEdges[i];
			else if (i > 0)
				break;
			else if (v.swEdges)
				e= v.edge1;
			else
				e= v.nextEdge(v.inEdge);
			if (e == null)
				break;
			let v2= v==e.v1 ? e.v2 : e.v1;
			let d= v.dist + e.length;
			if (v2.dist > d) {
				v2.dist= d;
				if (!v2.inEdge) {
					if (vQueueSize < vQueue.length)
						vQueue[vQueueSize]= v2;
					else
						vQueue.push(v2)
					vQueueSize++;
				}
				v2.inEdge= e;
			}
		}
	}
}
