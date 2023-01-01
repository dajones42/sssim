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

//	MSTS file related code for nw.js

const fs= require('fs');
const fspath= require('path');
const zlib= require('zlib');

//	changes the case of path to match the directory entry
let fixFilenameCase= function(path)
{
	let dir= fspath.dirname(path);
	let lower= fspath.basename(path).toLowerCase();
	let files= null;
	try {
		files= fs.readdirSync(dir);
	} catch (e) {
		dir= fixFilenameCase(dir);
		try {
			files= fs.readdirSync(dir);
		} catch (e) {
			console.log("cannot read dir "+dir);
		}
	}
	for (let i=0; files && i<files.length; i++)
		if (files[i].toLowerCase() == lower)
			return dir+fspath.sep+files[i];
	return path;
}

//	opens file path and tries to fix the filename case on failure
let openFixCase= function(path)
{
	try {
		return fs.openSync(path,"r");
	} catch (e) {
		let path1= fixFilenameCase(path);
		try {
			return fs.openSync(path1,"r");
		} catch (e) {
			console.log("cannot open "+path+" "+e);
			return null;
		}
	}
}

//	reads an MSTS binary file and returns a buffer with the contents
//	unzips the contents if needed
//	returns null if the doesn't appear to be an MSTS binary file
let readMstsBinary= function(path)
{
	const fd= openFixCase(path);
	if (!fd)
		return null;
	const magic= Buffer.alloc(16);
	fs.readSync(fd,magic,0,16);
	if (magic.toString("ascii",0,6) != "SIMISA")
		return null;
	let stat= fs.fstatSync(fd);
	if (!stat) {
		console.log('cannot stat '+path);
		return null;
	}
	let sz= stat.size-16;
	const buf= Buffer.alloc(sz);
	fs.readSync(fd,buf,0,sz);
	if (magic.toString("ascii",7,8) == "F") {
		let len= magic.readUInt32LE(8);
		let orig= zlib.inflateSync(buf);
//		console.log("compressed "+len+" "+orig.length);
		return orig;
	} else {
		return buf;
	}
}

//	reads an MSTS ACE file and returns the image in a canvas
let readMstsAce= function(path,ignoreAlpha)
{
//	console.log("ace "+path);
	let buf= readMstsBinary(path);
	if (!buf)
		return null;
	let flags= buf.readInt32LE(4);
	let wid= buf.readInt32LE(8);
	let ht= buf.readInt32LE(12);
//	console.log("flags "+flags+" wid "+wid+" ht "+ht);
	let code= buf.readInt32LE(16);
	let colors= buf.readInt32LE(20);
//	console.log(" code "+code+" colors "+colors);
	let offset= buf.readInt32LE(152+16*colors);
//	console.log(" offset "+offset);
	let canvas= document.createElement("canvas");
	canvas.width= wid;
	canvas.height= ht;
	let context= canvas.getContext("2d");
	context.clearRect(0,0,wid,ht);
	let idata= context.getImageData(0,0,wid,ht);
	let data= idata.data;
	let sz= wid*ht;
	if (flags&16) { // dxt1
//		console.log("dxt1");
		offset+= 4;
		let i=0;
		for (let j=0; j<ht; j+=4) {
			for (let k=0; k<wid; k+=4) {
				let c0= buf.readUInt16LE(offset+i);
				let c1= buf.readUInt16LE(offset+i+2);
				let bits= buf.readUInt32LE(offset+i+4);
				i+= 8;
				let r0= (c0>>8)&0xf8;
				let g0= (c0>>3)&0xfa;
				let b0= (c0<<3)&0xf8;
				let r1= (c1>>8)&0xf8;
				let g1= (c1>>3)&0xfa;
				let b1= (c1<<3)&0xf8;
				for (let j1=0; j1<4; j1++) {
					for (let k1=0; k1<4; k1++) {
						let di= 4*(k+k1+wid*(j+j1));
						switch (bits&3) {
						 case 0:
							data[di]= r0;
							data[di+1]= g0;
							data[di+2]= b0;
							data[di+3]= 255;
							break;
						 case 1:
							data[di]= r1;
							data[di+1]= g1;
							data[di+2]= b1;
							data[di+3]= 255;
							break;
						 case 2:
							if (c0 > c1) {
								data[di]=
								  (2*r0+r1)/3;
								data[di+1]=
								  (2*g0+g1)/3;
								data[di+2]=
								  (2*b0+b1)/3;
							} else {
								data[di]=
								  (r0+r1)/2;
								data[di+1]=
								  (g0+g1)/2;
								data[di+2]=
								  (b0+b1)/2;
							}
							data[di+3]= 255;
							break;
						 case 3:
							if (c0 > c1) {
								data[di]=
								  (r0+2*r1)/3;
								data[di+1]=
								  (g0+2*g1)/3;
								data[di+2]=
								  (b0+2*b1)/3;
								data[di+3]= 255;
							} else {
								data[di]= 0;
								data[di+1]= 0;
								data[di+2]= 0;
								data[di+3]= 0;
							}
							break;
						}
						bits>>= 2;
					}
				}
			}
		}
	} else {
		let na= 0;
		let rowSize= 3*wid;
		if (colors > 3)
			rowSize+= wid/8;
		if (colors > 4)
			rowSize+= wid;
//		console.log("rowsize "+rowSize);
		for (let i=0; i<ht; i++) {
			for (let j=0; j<wid; j++) {
				let o= offset + i*rowSize;
				let k= 4 * (j + wid*i);
				data[k]= buf.readUInt8(o+j);
				data[k+1]= buf.readUInt8(o+wid+j);
				data[k+2]= buf.readUInt8(o+2*wid+j);
				if (colors == 3)
					data[k+3]= 255;
				else if (colors == 5)
					data[k+3]=
					  buf.readUInt8(o+3*wid+wid/8+j);
				else if (buf.readUInt8(o+3*wid+Math.floor(j/8))
				  &(1<<(j%8)))
					data[k+3]= 255;
				else
					data[k+3]= 0;
				if (data[k+3] != 255)
					na++;
			}
		}
//		console.log("na "+na+" "+(ht*wid));
	}
	if (ignoreAlpha) {
		for (let i=0; i<ht; i++) {
			for (let j=0; j<wid; j++) {
				let k= 4 * (j + wid*i);
				data[k+3]= 255;
			}
		}
	}
	context.putImageData(idata,0,0);
	return canvas;
}

//	reads an MSTS unicode SIMISA text file and returns a tree of values and
//	children arrays.
let readMstsUnicode= function(path)
{
	let fd= openFixCase(path);
	if (!fd)
		return null;
	const buf= Buffer.alloc(2);
	fs.readSync(fd,buf,0,2);
	let littleEndian= buf[0]==0xff;
	// reads a single unicode character in file
	let getChar= function()
	{
		let n= fs.readSync(fd,buf,0,2);
		if (n < 2)
			return "";
		if (littleEndian) {
			return String.fromCharCode(buf[0]+256*buf[1]);
		} else {
			return String.fromCharCode(buf[1]+256*buf[0]);
		}
	}
	let savedC= null;
	// reads a token worth of chars from file
	let getToken= function()
	{
		let token= "";
		if (savedC) {
			token= savedC;
			savedC= null;
			return token;
		}
		let c= "";
		for (;;) {
			c= getChar();
			if (c.length != 1)
				return token;
			if (c!=' ' && c!='\t' && c!='\n' && c!='\r')
				break;
		}
		if (c=='(' || c==')') {
			token= c;
		} else if (c == '"') {
			for (c=getChar(); c!='"'; c=getChar()) {
				if (c == '\\') {
					c= getChar();
					if (c == 'n')
						c= '\n';
				}
				token+= c;
			}
		} else {
			while (c!=' ' && c!='\t' && c!='\n' && c!='\r') {
				if (c=='(' || c==')') {
					savedC= c;
					break;
				}
				token+= c;
				c= getChar();
			}
		}
		return token;
	}
	// reads a list of tokens terminated by a ).
	// calls self recursively to handle sublists.
	let parseList= function()
	{
		let list= [];
		for (let token=getToken(); token.length>0; token=getToken()) {
			if (token == ")")
				return list;
			if (token == "(")
				list.push(parseList());
			else
				list.push(token);
		}
		return list;
	}
	let token= getToken();
	if (token.substr(0,6) != "SIMISA") {
		fs.close(fd);
		console.log("file heading not found in "+path);
		return null;
	}
	let root= [];
	for (let token=getToken(); token.length>0; token=getToken()) {
		if (token == "(")
			root.push(parseList());
		else
			root.push(token);
	}
	fs.closeSync(fd);
	return root;
}

//	loops over array a returned by readMstsUnicode looking for string v
//	and calls function op on the following value for each match
let foreach= function(a,v,op)
{
	for (let i=0; i<a.length; i++) {
		if (typeof a[i]=="string" && a[i].toLowerCase()==v) {
			if (typeof a[i+1] == "string")
				op(a[i+2],a[i+1]);
			else
				op(a[i+1]);
		}
	}
}

class MstsBinFileParser {
	constructor(buf) {
		this.buffer= buf;
		this.offset= 16;
	}
	getStringU(len) {
		let s= this.buffer.toString("utf16le",this.offset,
		  this.offset+2*len);
		this.offset+= 2*len;
		return s;
	}
	getString() {
		let len= this.buffer.readUInt8(this.offset);
		this.offset++;
		return getStringU(len);;
	}
	getInt() {
		let n= this.buffer.readInt32LE(this.offset);
		this.offset+= 4;
		return n;
	}
	getShort() {
		let n= this.buffer.readUInt16LE(this.offset);
		this.offset+= 2;
		return n;
	}
	getFloat() {
		let x= this.buffer.readFloatLE(this.offset);
		this.offset+= 4;
		return x;
	}
}

//	reads an MSTS Shape file
let readMstsShape= function(path)
{
	let result= {
		shaders: [],
		points: [],
		uvPoints: [],
		normals: [],
		matrices: [],
		images: [],
		textures: [],
		vtxStates: [],
		primStates: [],
		distLevels: [],
		animations: []
	};
	let buffer= readMstsBinary(path);
	if (buffer) {
		let offset= 16;
		let getStringU= function(len) {
			let s= buffer.toString("utf16le",offset,offset+2*len);
			offset+= 2*len;
			return s;
		}
		let getString= function() {
			let len= buffer.readUInt8(offset);
			offset++;
			return getStringU(len);;
		}
		let getInt= function() {
			let n= buffer.readInt32LE(offset);
			offset+= 4;
			return n;
		}
		let getShort= function() {
			let n= buffer.readUInt16LE(offset);
			offset+= 2;
			return n;
		}
		let getFloat= function() {
			let x= buffer.readFloatLE(offset);
			offset+= 4;
			return x;
		}
		let distLevel= null;
		let subObject= null;
		let primState= null;
		let triList= null;
		let matrix= null;
		let animation= null;
		let animNode= null;
		let controller= null;
		for (; offset<buffer.length; ) {
			let code= getInt();
			if (code == 0)
				break;
			let len= getInt();
			let offset0= offset;
//			console.log("code "+code+" "+len+" "+offset);
			switch (code) {
			 case 70: // shape_header
			 case 68: // volumes
			 case 74: // texture_filter_names
			 case 76: // sort_vectors
			 case 11: // colours
			 case 18: // light_materials
			 case 79: // light_model_cfgs
			 case 33: // distance_levels_header
			 case 40: // sub_object_header
			 case 52: // vertex_sets
			 case 6: // normal_idxs
			 case 64: // flags
				offset+= len;
				break;
			 case 72: // shader_names
			 case 7: // points
			 case 9: // uv_points
			 case 5: // normals
			 case 66: // matrices
			 case 14: // images
			 case 16: // textures
			 case 47: // vtx_states
			 case 55: // prim_states
			 case 31: // lod_controls
			 case 36: // distance_levels
			 case 38: // sub_objects
			 case 50: // vertices
			 case 53: // primitives
			 case 27: // anim_nodes
				getString();
				getInt();
				break;
			 case 71: // shape
			 case 32: // lod_control
			 case 34: // distance_level_header
			 case 60: // indexed_trilist
				getString();
				break;
			 case 129: // named_shader
				getString();
				result.shaders.push(getStringU(
				  getShort()));
				break;
			 case 2: // point
				getString();
				result.points.push(
				  [getFloat(),getFloat(),getFloat()]);
				break;
			 case 8: // uv_point
				getString();
				result.uvPoints.push([getFloat(),getFloat()]);
				break;
			 case 3: // normal
				getString();
				result.normals.push(
				  [getFloat(),getFloat(),getFloat()]);
				break;
			 case 65: // matrix
				matrix= { name: getString() };
				matrix.mat= [
				    getFloat(),getFloat(),getFloat(),
				    getFloat(),getFloat(),getFloat(),
				    getFloat(),getFloat(),getFloat(),
				    getFloat(),getFloat(),getFloat()];
				result.matrices.push(matrix);
//				console.log("mat "+offset+" "+offset0+" "+len+
//				  " "+(offset0+len)+" "+matrix.name);
				offset= offset0+len;
				break;
			 case 13: // image
				getString();
				result.images.push(getStringU(getShort()));
				break;
			 case 15: // texture
				getString();
				result.textures.push(getInt());
				getInt();
				getFloat();
				if (len > 13)
					getInt();
				break;
			 case 46: // vtx_state
				getString();
				getInt();
				result.vtxStates.push(getInt());
				offset= offset0+len;
				break;
			 case 54: // prim_state
				primState= {
				  alphaTestMode:0, zBufMode: 0 };
				result.primStates.push(primState);
				getString();
				getInt();
				primState.shaderIndex= getInt();
				getInt(); // tex_idxs
				getInt();
				getString();
				var n= getInt();
				primState.texIdx= getInt();
				for (let j=0; j<n-1; j++)
					getInt();
				getInt();
				primState.vStateIndex= getInt();
				if (offset < offset0+len) {
					n= offset0+len-offset;
					if (n >= 4) {
						primState.alphaTestMode=
						  getInt();
						n-= 4;
					}
					if (n >= 4) {
						getInt();
						n-= 4;
					}
					if (n >= 4) {
						primState.zBufMode=
						  getInt();
						n-= 4;
					}
					offset= offset0+len;
				}
				break;
			 case 37: // distance_level
				getString();
				distLevel= {
					dist: 0,
					hierarchy: [],
					subObjects: []
				};
				result.distLevels.push(distLevel);
				break;
			 case 35: // dlevel_selection
				getString();
				distLevel.dist= getFloat();
				break;
			 case 67: // heirarchy
				getString();
				var n= getInt();
				for (let j=0; j<n; j++)
					distLevel.hierarchy.push(getInt());
				break;
			 case 39: // sub_object
				getString();
				subObject= {
					vertices: [],
					vertexSets: [],
					primStateIdxs: [],
					triLists: []
				};
				distLevel.subObjects.push(subObject);
				break;
			 case 48: // vertex
				let o= offset;
				getString();
				getInt();
				var pi= getInt();
				var ni= getInt();
				getInt();
				getInt();
				getInt(); // vertex_uvs
				var uvlen= getInt();
				getString();
				var nuv= getInt();
				var uvi= 0;
				for (let k=0; k<nuv; k++)
					uvi= getInt();
				subObject.vertices.push({
					pointIndex: pi,
					normalIndex: ni,
					uvIndex: uvi
				});
				offset= offset0+len;
				break;
			 case 56: // prim_state_index
				getString();
				subObject.primStateIdxs.push(getInt());
				break;
			 case 63: // vertex_idxs
				getString();
				var n= getInt();
				triList= {
					vertexIdxs: [],
					normalIdxs: []
				};
				for (var j=0; j<n; j++)
					triList.vertexIdxs.push(getInt());
				subObject.triLists.push(triList);
				break;
			 case 29: // animations
				getString();
				getInt();
				break;
			 case 28: // animation
				getString();
				animation= {
				  frames: getInt(),
				  rate: getInt(),
				  nodes: []
				};
				result.animations.push(animation);
				break;
			 case 26: // anim_node
				animNode= {
				  name: getString(),
				  controllers: []
				};
				animation.nodes.push(animNode);
				break;
			 case 25: // controllers
				getString();
				getInt();
				break;
			 case 21: // linear_pos
				getString();
				getInt();
				controller= [];
				animNode.controllers.push(controller);
				break;
			 case 22: // tcb_pos
				offset+= len;
				break;
			 case 23: // slerp_rot
				getString();
				controller.push({
					type: "rotation",
					frame: getInt(),
					x: getFloat(),
					y: getFloat(),
					z: getFloat(),
					w: getFloat()
				});
				break;
			 case 24: // tcb_rot
				getString();
				getInt();
				controller= [];
				animNode.controllers.push(controller);
				break;
			 case 19: // linear_key
				getString();
				controller.push({
					type: "position",
					frame: getInt(),
					x: getFloat(),
					y: getFloat(),
					z: getFloat()
				});
				break;
			 case 20: // tcb_key
				getString();
				controller.push({
					type: "rotation",
					frame: getInt(),
					x: getFloat(),
					y: getFloat(),
					z: getFloat(),
					w: getFloat()
				});
				getFloat();
				getFloat();
				getFloat();
				getFloat();
				getFloat();
				break;
			 case 1: // comment
				offset+= len;
				break;
			 default:
				offset+= len;
				break;
			}
		}
	} else {
		let root= readMstsUnicode(path);
		if (!root)
			return null;
		if (typeof root[0]!="string" ||
		  root[0].toLowerCase()!="shape") {
			console.log("no shape "+path);
			return null;
		}
		root= root[1];
		let foreach= function(a,v,op) {
			for (let i=0; i<a.length; i++) {
				if (typeof a[i]=="string" &&
				  a[i].toLowerCase()==v) {
					if (typeof a[i+1] == "string")
						op(a[i+2],a[i+1]);
					else
						op(a[i+1]);
				}
			}
		}
		for (let i=0; i<root.length; i++) {
			if (typeof root[i] != "string")
				continue;
			let lower= root[i].toLowerCase();
			//console.log(" "+i+" "+lower+" "+root[i+1].length);
			if (lower == "shader_names") {
				foreach(root[i+1],"named_shader",function(a) {
					result.shaders.push(a[0]);
				});
			} else if (lower == "points") {
				foreach(root[i+1],"point",function(a) {
					result.points.push([
					  parseFloat(a[0]),
					  parseFloat(a[1]),
					  parseFloat(a[2])]);
				});
			} else if (lower == "uv_points") {
				foreach(root[i+1],"uv_point",function(a) {
					result.uvPoints.push([
					  parseFloat(a[0]),
					  parseFloat(a[1])]);
				});
			} else if (lower == "normals") {
				foreach(root[i+1],"vector",function(a) {
					result.normals.push([
					  parseFloat(a[0]),
					  parseFloat(a[1]),
					  parseFloat(a[2])]);
				});
			} else if (lower == "matrices") {
				foreach(root[i+1],"matrix",function(a,name) {
					let mat= [];	
					for (let i=0; i<12; i++)
						mat.push(parseFloat(a[i]));
					result.matrices.push({
					  name: name,
					  mat: mat
					});
				});
			} else if (lower == "images") {
				foreach(root[i+1],"image",function(a) {
					//console.log("image "+a[0]);
					result.images.push(a[0]);
				});
			} else if (lower == "textures") {
				foreach(root[i+1],"texture",function(a) {
					result.textures.push(parseInt(a[0]));
				});
			} else if (lower == "vtx_states") {
				foreach(root[i+1],"vtx_state",function(a) {
					result.vtxStates.push(parseInt(a[1]));
				});
			} else if (lower == "prim_states") {
				foreach(root[i+1],"prim_state",function(a) {
					result.primStates.push({
					  texIdx: parseInt(a[3][1]),
					  vStateIndex: parseInt(a[5]),
					  shaderIndex: parseInt(a[1]),
					  alphaTestMode: parseInt(a[6]),
					  zBufMode: parseInt(a[8])
					});
				});
			} else if (lower == "lod_controls") {
				let dLevel= null;
				let subObject= null;
				let triList= null;
				let parseDLevelSel= function(a) {
					dLevel.dist= parseInt(a[0]);
				};
				let parseHierarchy= function(a) {
					for (let i=1; i<a.length; i++)
						dLevel.hierarchy.push(
						  parseInt(a[i]));
				};
				let parseDLevelHdr= function(a) {
					foreach(a,"dlevel_selection",
					  parseDLevelSel);
					foreach(a,"hierarchy",parseHierarchy);
				};
				let parseVertex= function(a) {
					subObject.vertices.push({
						pointIndex: parseInt(a[1]),
						normalIndex: parseInt(a[2]),
						uvIndex: parseInt(a[6][1])
					});
				};
				let parseVertices= function(a) {
					foreach(a,"vertex",parseVertex);
				};
				let parseVertexSet= function(a) {
					subObject.vertexSets.push({
						stateIndex: parseInt(a[0]),
						startIndex: parseInt(a[1]),
						nVertex: parseInt(a[2])
					});
				};
				let parseVertexSets= function(a) {
					foreach(a,"vertex_set",
					  parseVertexSet);
				};
				let parseVertexIdxs= function(a) {
					for (let i=1; i<a.length; i++)
						triList.vertexIdxs.push(
						  parseInt(a[i]));
				};
				let parseNormalIdxs= function(a) {
					for (let i=1; i<a.length; i++)
						triList.normalIdxs.push(
						  parseInt(a[i]));
				};
				let parseTriList= function(a) {
					triList= {
						vertexIdxs: [],
						normalIdxs: []
					};
					subObject.triLists.push(triList);
					foreach(a,"vertex_idxs",
					  parseVertexIdxs);
					foreach(a,"normal_idxs",
					  parseNormalIdxs);
				};
				let parsePrimStateIdxs= function(a) {
					subObject.primStateIdxs.push(
					  parseInt(a[0]));
				};
				let parsePrimitives= function(a) {
					foreach(a,"prim_state_idx",
					  parsePrimStateIdxs);
					foreach(a,"indexed_trilist",
					  parseTriList);
				};
				let parseSubObject= function(a) {
					subObject= {
						vertices: [],
						vertexSets: [],
						primStateIdxs: [],
						triLists: []
					};
					dLevel.subObjects.push(subObject);
					foreach(a,"vertices",parseVertices);
					foreach(a,"vertex_sets",
					  parseVertexSets);
					foreach(a,"primitives",parsePrimitives);
				};
				let parseSubObjects= function(a) {
					foreach(a,"sub_object",
					  parseSubObject);
				};
				let parseDLevel= function(a) {
					dLevel= {
						dist: 0,
						hierarchy: [],
						subObjects: []
					};
					result.distLevels.push(dLevel);
					foreach(a,"distance_level_header",
					  parseDLevelHdr);
					foreach(a,"sub_objects",
					  parseSubObjects);
				};
				let parseDLevels= function(a) {
					foreach(a,"distance_level",
					  parseDLevel);
				};
				let parseLodControl= function(a) {
					foreach(a,"distance_levels",
					  parseDLevels);
				};
				foreach(root[i+1],"lod_control",
				  parseLodControl);
			} else if (lower == "animations") {
				let animation= null;
				let animNode= null;
				let controller= null;
				let parseLinearKey= function(a) {
					controller.push({
						type: "position",
						frame: parseInt(a[0]),
						x: parseFloat(a[1]),
						y: parseFloat(a[2]),
						z: parseFloat(a[3])
					});
				};
				let parseSlerpRot= function(a) {
					controller.push({
						type: "rotation",
						frame: parseInt(a[0]),
						x: parseFloat(a[1]),
						y: parseFloat(a[2]),
						z: parseFloat(a[3]),
						w: parseFloat(a[4])
					});
				};
				let parseTcbKey= function(a) {
					controller.push({
						type: "rotation",
						frame: parseInt(a[0]),
						x: parseFloat(a[1]),
						y: parseFloat(a[2]),
						z: parseFloat(a[3]),
						w: parseFloat(a[4])
					});
				};
				let parseTcbRot= function(a) {
					controller= [];
					animNode.controllers.push(controller);
					foreach(a,"tcb_key",
					  parseTcbKey);
					foreach(a,"slerp_rot",
					  parseSlerpRot);
				};
				let parseLinearPos= function(a) {
					controller= [];
					animNode.controllers.push(controller);
					foreach(a,"linear_key",
					  parseLinearKey);
				};
				let parseControllers= function(a) {
					foreach(a,"tcb_rot",
					  parseTcbRot);
					foreach(a,"linear_pos",
					  parseLinearPos);
				};
				let parseAnimNode= function(a,name) {
					animNode= {
					  name: name,
					  controllers: []
					};
					animation.nodes.push(animNode);
					foreach(a,"controllers",
					  parseControllers);
				};
				let parseAnimNodes= function(a) {
					foreach(a,"anim_node",parseAnimNode);
				};
				let parseAnimation= function(a) {
					animation= {
					  frames: parseInt(a[0]),
					  rate: parseFloat(a[1]),
					  nodes: []
					};
					result.animations.push(animation);
					foreach(a,"anim_nodes",parseAnimNodes);
				};
				foreach(root[i+1],"animation",
				  parseAnimation);
			}
		}
	}
	return result;
}

// formats tile id coordinate for use in .w or .td file name
let tileCoordToStr= function(n,len)
{
	if (!len)
		len= 6;
	let s= n<0 ? "-" : "+";
	let ns= Math.abs(n).toFixed(0);
	for (let i=len; i>ns.length; i--)
		s+= "0";
	return s+ns;
}

//	reads an MSTS World file and returns an array of objects
let readMstsWorld= function(tile)
{
	let path= routeDir+fspath.sep+"WORLD"+fspath.sep+
	  "w"+tileCoordToStr(tile.x,6)+tileCoordToStr(tile.z,6)+".w";
	let result= [];
	let buffer= readMstsBinary(path);
	if (buffer) {
		console.log("bin world file "+path);
		let object= null;
		let addObject= function(type) {
			object= { type:type };
			result.push(object);
		}
		let parser= new MstsBinFileParser(buffer);
		for (; parser.offset<parser.buffer.length; ) {
			let code= parser.getInt();
			if (code == 0)
				break;
			let len= parser.getInt();
			let offset0= offset;
//			console.log("code "+code+" "+len+" "+offset);
			switch (code) {
			 case 75: // world_file
				parser.getString();
				break;
			 case 3: // static
				parser.getString();
				addObject("static");
				break;
			 case 5: // trackobj
				parser.getString();
				addObject("track");
				break;
			 case 6: // dyntrack
				parser.getString();
				addObject("dyntrack");
				object.trackSections= [];
				break;
			 case 95: // filename
				parser.getString();
				object.filename= parser.getStringU(
				  parser.getShort());
				break;
			 case 97: // position
				parser.getString();
				object.position= [parser.getFloat(),
				  parser.getFloat(), parser.getFloat()];
				break;
			 case 645: // qdirection
				parser.getString();
				object.qdirection= [parser.getFloat(),
				  parser.getFloat(), parser.getFloat(),
				  parser.getFloat()];
				break;
			 case 104: // static flags
				parser.getString();
				object.staticFlags= parser.getInt();
				break;
			 case 109: // tracksections
				parser.getString();
				break;
			 case 110: // tracksection
				if (len == 26) {
					parser.getString();
					parser.getInt(); //section curve code
					parser.getInt(); //section curve len
					parser.getString();
					parser.getInt(); //section curve flag
					parser.getInt(); //section id
					object.trackSections.push({
						dist: parser.getFloat(),
						radius: parser.getFloat()
					});
				} else {
					parser.offset+= len;
				}
				break;
			 case 1: // comment
				parser.offset+= len;
				break;
			 default:
				parser.offset+= len;
				break;
			}
		}
	} else {
		let root= readMstsUnicode(path);
		if (typeof root[0]!="string" ||
		  root[0].toLowerCase()!="tr_worldfile") {
			console.log("no world data "+path);
			return null;
		}
		root= root[1];
		let foreach= function(a,v,op) {
			for (let i=0; i<a.length; i++) {
				if (typeof a[i]=="string" &&
				  a[i].toLowerCase()==v) {
					if (typeof a[i+1] == "string")
						op(a[i+2],a[i+1]);
					else
						op(a[i+1]);
				}
			}
		}
		let object= null;
		let addObject= function(type,a) {
			object= { type:type };
			result.push(object);
			foreach(a,"filename",function(a) {
				object.filename= a[0];
			});
			foreach(a,"position",function(a) {
				object.position= [ parseFloat(a[0]),
				  parseFloat(a[1]), parseFloat(a[2])];
			});
			foreach(a,"qdirection",function(a) {
				object.qdirection= [ parseFloat(a[0]),
				  parseFloat(a[1]), parseFloat(a[2]),
				  parseFloat(a[3])];
			});
			foreach(a,"staticflags",function(a) {
				object.staticFlags= parseInt(a[0],16);
			});
		}
		for (let i=0; i<root.length; i++) {
			if (typeof root[i] != "string")
				continue;
			let lower= root[i].toLowerCase();
			//console.log(" "+i+" "+lower+" "+root[i+1].length);
			if (lower == "static") {
				addObject("static",root[i+1]);
			} else if (lower == "trackobj") {
				addObject("track",root[i+1]);
			} else if (lower == "dyntrack") {
				addObject("dyntrack",root[i+1]);
				object.trackSections= [];
				foreach(root[i+1],"tracksections",function(a) {
					foreach(a,"tracksection",function(a) {
						object.trackSections.push({
							dist: parseFloat(a[3]),
							radius: parseFloat(a[4])
						});
					});
				});
			} else if (lower == "forest") {
				addObject("forest",root[i+1]);
				foreach(root[i+1],"treetexture",function(a) {
					object.treeTexture= a[0];
				});
				foreach(root[i+1],"scalerange",function(a) {
					object.scale0= parseFloat(a[0]);
					object.scale1= parseFloat(a[1]);
				});
				foreach(root[i+1],"area",function(a) {
					object.areaH= parseFloat(a[0]);
					object.areaW= parseFloat(a[1]);
				});
				foreach(root[i+1],"treesize",function(a) {
					object.sizeW= parseFloat(a[0]);
					object.sizeH= parseFloat(a[1]);
				});
				foreach(root[i+1],"population",function(a) {
					object.population= parseFloat(a[0]);
				});
			}
		}
	}
	return result;
}

let readMstsConsist= function(path)
{
	let root= readMstsUnicode(path);
	if (typeof root[0]!="string" ||
	  root[0].toLowerCase()!="train") {
		console.log("no train data "+path);
		return null;
	}
	root= root[1][1];
	let result= {
		name: fspath.basename(path),
		cars: []
	};
	if (typeof root[0] == "string")
		result.name= root[0];
	let car= null;
	for (let i=0; i<root.length; i++) {
		if (typeof root[i] != "string")
			continue;
		let lower= root[i].toLowerCase();
		//console.log(" "+i+" "+lower+" "+root[i+1].length);
		if (lower=="engine" || lower=="wagon") {
			car= {};
			result.cars.push(car);
			foreach(root[i+1],"flip",function(a) {
				car.flip= true;
			});
			foreach(root[i+1],"enginedata",function(a) {
				car.file= a[0]+".eng";
				car.directory= a[1];
			});
			foreach(root[i+1],"wagondata",function(a) {
				car.file= a[0]+".wag";
				car.directory= a[1];
			});
		}
	}
	return result;
}

let readMstsWag= function(path)
{
	console.log("readwag "+path);
	let root= readMstsUnicode(path);
	if (!root || typeof root[0]!="string" ||
	  root[0].toLowerCase()!="wagon") {
		console.log("no wagon data "+path);
		return null;
	}
	root= root[1];
	let result= {
	};
	foreach(root,"wagonshape",function(a) {
		result.shape= a[0];
	});
	foreach(root,"freightanim",function(a) {
		result.fashape= a[0];
	});
	foreach(root,"size",function(a) {
		result.length= parseFloat(a[2]);
	});
	foreach(root,"sound",function(a) {
		result.sound= a[0];
	});
	foreach(root,"lights",function(a) {
		let lights= [];
		foreach(a,"light",function(a) {
			let light= {}
			foreach(a,"type",function(a) {
				light.type= parseInt(a[0]);
			});
			foreach(a,"conditions",function(a) {
				foreach(a,"headlight",function(a) {
					light.headlight= parseInt(a[0]);
				});
				foreach(a,"unit",function(a) {
					light.unit= parseInt(a[0]);
				});
			});
			foreach(a,"states",function(a) {
				foreach(a,"state",function(a) {
					foreach(a,"lightcolour",function(a) {
						light.color= a[0].substr(2);
					});
					foreach(a,"position",function(a) {
						light.x= parseFloat(a[0]);
						light.y= parseFloat(a[1]);
						light.z= parseFloat(a[2]);
					});
					foreach(a,"radius",function(a) {
						light.radius= parseFloat(a[0]);
					});
				});
			});
			console.log("light "+light.type+" "+light.headlight);
			if (light.type===0 && light.headlight==3)
				lights.push(light);
		});
		if (lights.length > 0)
			result.lights= lights;
	});
	return result;
}
