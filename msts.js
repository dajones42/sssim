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

//	MSTS file related code

//const fs= require('fs');
//const fspath= require('path');

let mstsDir= null;	// full path to MSTS directory
let routeDir= null;	// full path to route directory
let tdbPath= null;	// full path to TDB file
let tiles= [];		// tiles in route

//	read all of the .t files in the specified route's TILES directory.
let readTiles= function(routePath)
{
	if (!routePath)
		routePath= routeDir;
	let tilesPath= fixFilenameCase(routePath+fspath.sep+'TILES');
	let files= fs.readdirSync(tilesPath);
	for (let i=0; i<files.length; i++) {
		if (files[i].substr(files[i].length-2) != ".t")
			continue;
//		console.log(' '+files[i]);
		let tile= tFileToXZ(files[i]);
		let path= tilesPath+fspath.sep+files[i];
		readTFile(path,tile);
//		console.log(' '+tile.x+" "+tile.z+" "+
//		  tile.floor+" "+tile.scale+" "+tile.filename);
		tiles.push(tile);
	}
}

//	reads a single .t file and saves the terrain scale and floor.
let readTFile= function(path,tile)
{
	const fd= fs.openSync(path,"r");
	if (!fd)
		throw 'cannot open file '+filename;
	const magic= Buffer.alloc(16);
	fs.readSync(fd,magic,0,16);
//	console.log("tfile "+path+" "+magic.toString("ascii",0,6)+" "+
//	  magic.toString("ascii",7,1));
	const buf= Buffer.alloc(4);
	// read a single 2 byte int from file
	let readShort= function()
	{
		let n= fs.readSync(fd,buf,0,2);
		if (n < 2)
			return 0;
		return buf.readInt16LE(0);
	}
	// read a single 4 byte int from file
	let readInt= function()
	{
		let n= fs.readSync(fd,buf,0,4);
		if (n < 4)
			return 0;
		return buf.readInt32LE(0);
	}
	// read a single 4 byte float from file
	let readFloat= function()
	{
		let n= fs.readSync(fd,buf,0,4);
		if (n < 4)
			return 0;
		return buf.readFloatLE(0);
	}
	// read a single 1 byte int from file
	let readByte= function()
	{
		let n= fs.readSync(fd,buf,0,1);
		if (n < 1)
			return 0;
		return buf.readUInt8(0);
	}
	let readString= function(n) {
		let s= "";
		for (let i=0; i<n; i++) {
			fs.readSync(fd,buf,0,2);
			s+= buf.toString("utf16le",0,2);
		}
		return s;
	}
	// ignore n bytes in file
	let skip= function(n)
	{
		for (let i=0; i<n; i++)
			if (fs.readSync(fd,buf,0,1) != 1)
				return;
	}
	skip(16);
	tile.patches= [];
	tile.textures= [];
	tile.microTextures= [];
	for (;;) {
		let code= readInt();
		let len= readInt();
		if (code == 0)
			break;
		switch (code) {
		 case 136: // terrain
		 case 139: // terrain_samples
			skip(readByte());
			break;
		 case 142: // terrain sample floor
			skip(readByte());
			tile.floor= readFloat();
			break;
		 case 143: // terrain sample scale
			skip(readByte());
			tile.scale= readFloat();
			break;
		 case 137: // terrain errthreshold_scale
		 case 138: // terrain always select maxdist
		 case 140: // terrain nsamples
		 case 141: // terrain sample rotation
		 case 144: // terrain sample size
		 case 146: // terrain sample ybuffer
		 case 147: // terrain sample ebuffer
		 case 148: // terrain sample nbuffer
		 case 251: // water level
		 case 281: // ??
			skip(len);
			break;
		 case 157: // terrain patches
		 case 159: // terrain patchset
		 case 163: // terrain patchset patches
			skip(readByte());
			break;
		 case 158: // terrain patchsets
			skip(readByte());
			readInt();
			break;
		 case 164: // terrain patchset patch
			skip(readByte());
			let patch= { flags: readInt() };
			patch.centerX= readFloat();
			readFloat();
			patch.centerZ= readFloat();
			readFloat();
			readFloat();
			readFloat();
			patch.texIndex= readInt();
			patch.u0= readFloat();
			patch.v0= readFloat();
			patch.dudx= readFloat();
			patch.dudz= readFloat();
			patch.dvdx= readFloat();
			patch.dvdz= readFloat();
			readFloat();
			tile.patches.push(patch);
			break;
		 case 151: // terrain shaders
			skip(readByte());
			readInt();
			break;
		 case 152: // terrain shader
			skip(readByte());
			readString(readShort());
			break;
		 case 153: // terrain texslots
			skip(readByte());
			readInt();
			break;
		 case 154: // terrain texslot
			skip(readByte());
			let s= readString(readShort());
			readInt();
			let n= readInt();
			if (n == 0)
				tile.textures.push(s);
			else if (n == 1)
				tile.microTextures.push(s);
			break;
		 default:
//			console.log("code "+code+" "+len);
			skip(len);
			break;
		}
	}
	fs.closeSync(fd);
}

//	returns tile x and z coordinates extracted from .t file name.
let tFileToXZ= function(name)
{
	let x= 0;
	let z= 0;
	let hexdigit= [
		'0','1','4','5',
		'3','2','7','6',
		'c','d','8','9',
		'f','e','b','a'
	];
	for (let i=1; i<9; i++) {
		let j= 0;
		for (; j<16; j++)
			if (name.substr(i,1)==hexdigit[j])
				break;
		let s= 16-2*i;
		let m= 3<<s;
		x|= (j&3)<<s;
		z|= ((j&0xc)>>2)<<s;
	}
	x>>= 1;
	z>>= 1;
	return { filename: name.substr(0,name.length-2),
	  x: x-16384, z: 16384-z-1 };
}

//	reads a tile's elevation data from the y.raw file.
let readTerrain= function(tile)
{
	if (tile.terrain)
		return;
	let size= 256*256*2;
	tile.terrain= Buffer.alloc(size);
	let path= routeDir+fspath.sep+"TILES"+fspath.sep+tile.filename+"_y.raw";
	console.log("read "+path);
	let fd= openFixCase(path);
	if (!fd) {
		console.error('cannot open file '+path);
		return;
	}
	fs.readSync(fd,tile.terrain,0,size);
	fs.closeSync(fd);
}

//	reads global and route tsection.dat files and saves arrays of
//	shapes, sections and track paths.
let readTSection= function(routePath)
{
	let mstsDir= fspath.dirname(fspath.dirname(routePath));
	let path= mstsDir+fspath.sep+"GLOBAL"+fspath.sep+'tsection.dat';
	let gts= readMstsUnicode(path);
	let result= { shapes: [], sections: [], trackPaths: [] };
	// saves track shape path information from a file node.
	let makePath= function(node)
	{
		let n= parseInt(node[0]);
		let path= {
			start: [
				parseFloat(node[1]),
				parseFloat(node[2]),
				parseFloat(node[3])
			],
			angle: parseFloat(node[4]),
			sections: []
		};
		for (let i=0; i<n; i++) {
			path.sections.push(parseInt(node[i+5]));
		}
		return path;
	}
	// saves track shape information from a file node.
	let saveTrackShape= function(node)
	{
		let shape= { paths: [] };
		for (let i=0; i<node.length; i++) {
			if (typeof node[i]!="string")
				continue;
			let lower= node[i].toLowerCase();
			if (lower=="filename") {
				shape.filename= node[i+1][0];
			} else if (lower=="sectionidx") {
				shape.paths.push(makePath(node[i+1]));
			} else if (lower=="mainroute") {
				shape.mainRoute= parseInt(node[i+1][0]);
			}
		}
		let index= parseInt(node[0]);
		result.shapes[index]= shape;
	}
	// saves track section information from a file node.
	let saveTrackSection= function(node)
	{
		let section= {};
		for (let i=0; i<node.length; i++) {
			if (typeof node[i]!="string")
				continue;
			let lower= node[i].toLowerCase();
			if (lower=="sectionsize") {
				section.length= parseFloat(node[i+1][1]);
			} else if (lower=="sectioncurve") {
				section.radius= parseFloat(node[i+1][0]);
				section.angle= parseFloat(node[i+1][1]);
			}
		}
		let index= parseInt(node[0]);
		result.sections[index]= section;
	}
	// saves track section information from a route tsection file node.
	let saveRTrackSection= function(node)
	{
		let section= { dynTrack: true };
		let radius= parseFloat(node[4]);
		if (radius == 0) {
			section.length= parseFloat(node[3]);
		} else {
			section.radius= radius;
			section.angle= 180/Math.PI*
			  parseFloat(node[3]);
		}
		let index= parseInt(node[2]);
		result.sections[index]= section;
	}
	// saves track path information from a route tsection file node.
	let saveRTrackPath= function(node)
	{
		let path= [];
		let n= parseInt(node[1]);
		for (let i=0; i<n; i++)
			path.push(parseInt(node[i+2]));
		let index= parseInt(node[0]);
		result.trackPaths[index]= path;
	}
	for (let i=0; i<gts.length; i++) {
		if (typeof gts[i]!="string")
			continue;
		let lower= gts[i].toLowerCase();
		if (lower!="trackshapes" && lower!="tracksections")
			continue;
		let node= gts[i+1];
		for (let j=0; j<node.length; j++) {
			if (typeof node[j]!="string")
				continue;
			lower= node[j].toLowerCase();
			if (lower=="trackshape") {
				saveTrackShape(node[j+1]);
			} else if (lower=="tracksection") {
				saveTrackSection(node[j+1]);
			}
		}
	}
	path= routePath+fspath.sep+'tsection.dat';
	let rts= readMstsUnicode(path);
	for (let i=0; i<rts.length; i++) {
		if (typeof rts[i]!="string")
			continue;
		let lower= rts[i].toLowerCase();
		if (lower!="tracksections" && lower!="sectionidx")
			continue;
		let node= rts[i+1];
		for (let j=0; j<node.length; j++) {
			if (typeof node[j]!="string")
				continue;
			lower= node[j].toLowerCase();
			if (lower=="tracksection") {
				saveRTrackSection(node[j+1]);
			}
			if (lower=="trackpath") {
				saveRTrackPath(node[j+1]);
			}
		}
	}
	return result;
}

//	reads a route's .tdb file and builds a list of track nodes.
let readTrackDB= function(path)
{
	tdbPath= path;
	routeDir= fspath.dirname(path);
	mstsDir= fspath.dirname(fspath.dirname(routeDir));
	let tSection= readTSection(routeDir);
	let result= { nodes: [], trItems: [], tSection: tSection };
	// saves end node information from a tdb file node.
	let parseEndNode= function(fnode,tnode)
	{
	}
	// saves junction node information from a tdb file node.
	let parseJunctionNode= function(fnode,tnode)
	{
		tnode.unk2= parseInt(fnode[0]);//always zero?
		tnode.shape= parseInt(fnode[1]);
		tnode.manual= parseInt(fnode[2]);
	}
	// saves Uid information from a tdb file node.
	let parseUid= function(fnode,tnode)
	{
		tnode.wftx= parseInt(fnode[0]);
		tnode.wftz= parseInt(fnode[1]);
		tnode.wfuid= parseInt(fnode[2]);
		tnode.unk= parseInt(fnode[3]);
		tnode.tx= parseInt(fnode[4]);
		tnode.tz= parseInt(fnode[5]);
		tnode.x= parseFloat(fnode[6]);
		tnode.y= parseFloat(fnode[7]);
		tnode.z= parseFloat(fnode[8]);
//		rotation angles
		tnode.ax= parseFloat(fnode[9]);
		tnode.ay= parseFloat(fnode[10]);
		tnode.az= parseFloat(fnode[11]);
	}
	// saves vector section information from a tdb file node.
	let parseVectorSections= function(fnode)
	{
		let n= parseInt(fnode[0]);
		let sections= [];
		for (let i=0; i<n; i++) {
			let section= {};
			let j= i*16+1;
			section.sectionID= parseInt(fnode[j]);
			section.shapeID= parseInt(fnode[j+1]);
			section.wftx= parseInt(fnode[j+2]);
			section.wftz= parseInt(fnode[j+3]);
			section.wfuid= parseInt(fnode[j+4]);
			section.flag1= parseInt(fnode[j+5]);
//			flag1==1 for first section and ==2 for flipped section?
			section.flag2= parseInt(fnode[j+6]);
			section.flag3= fnode[j+7];
			section.tx= parseInt(fnode[j+8]);
			section.tz= parseInt(fnode[j+9]);
			section.x= parseFloat(fnode[j+10]);
			section.y= parseFloat(fnode[j+11]);
			section.z= parseFloat(fnode[j+12]);
//			rotation angles
			section.ax= parseFloat(fnode[j+13]);
			section.ay= parseFloat(fnode[j+14]);
			section.az= parseFloat(fnode[j+15]);
			sections[i]= section;
		}
		return sections;
	}
	// saves TrItemRef information from a tdb file node.
	let parseItemRefs= function(fnode)
	{
		let n= parseInt(fnode[0]);
		let itemRefs= [];
		for (let i=1; i<fnode.length; i++) {
			if (typeof fnode[i] != "string")
				continue;
			let lower= fnode[i].toLowerCase();
			if (lower == "tritemref")
				itemRefs.push(parseInt(fnode[i+1][0]));
		}
		return itemRefs;
	}
	// saves track node pins information from a tdb file node.
	let parsePins= function(fnode)
	{
		let pins= [];
		for (let i=0; i<fnode.length; i++) {
			if (typeof fnode[i] != "string")
				continue;
			let lower= fnode[i].toLowerCase();
			if (lower == "trpin") {
				let j= parseInt(fnode[i+1][0]);
				let end= parseInt(fnode[i+1][1]);
				pins.push({ node: j, end: end });
			}
		}
		return pins;
	}
	// saves track node information from a tdb file node.
	let saveTrackNode= function(fnode)
	{
		let index= parseInt(fnode[0]);
		let tnode= { id: index };
		for (let i=0; i<fnode.length; i++) {
			if (typeof fnode[i] != "string")
				continue;
			let lower= fnode[i].toLowerCase();
			if (lower == "trendnode") {
				parseEndNode(fnode[i+1],tnode);
			} else if (lower =="trjunctionnode") {
				parseJunctionNode(fnode[i+1],tnode);
			} else if (lower == "uid") {
				parseUid(fnode[i+1],tnode);
			} else if (lower == "trvectornode") {
				let c= fnode[i+1];
				tnode.sections=
				  parseVectorSections(fnode[i+1][1]);
				if (fnode[i+1].length>=4 &&
				  typeof fnode[i+1][2]=="string" &&
				  fnode[i+1][2].toLowerCase()=="tritemrefs")
					tnode.itemRefs=
					  parseItemRefs(fnode[i+1][3]);
			} else if (lower == "trpins") {
				tnode.pins= parsePins(fnode[i+1]);
			}
		}
		result.nodes[index]= tnode;
	}
	// saves SignalItem information from a tdb file node.
	let parseTrItem= function(fnode) {
		let item= {};
		for (let i=0; i<fnode.length; i++) {
			if (typeof fnode[i] != "string")
				continue;
			let lower= fnode[i].toLowerCase();
			if (lower == "tritemid") {
				item.id= parseInt(fnode[i+1][0]);
			} else if (lower == "tritemrdata") {
				item.x= parseFloat(fnode[i+1][0]);
				item.y= parseFloat(fnode[i+1][1]);
				item.z= parseFloat(fnode[i+1][2]);
				item.tx= parseInt(fnode[i+1][3]);
				item.tz= parseInt(fnode[i+1][4]);
			} else if (lower == "trsignaltype") {
				item.signalDir= parseInt(fnode[i+1][1])+1;
			} else if (lower == "platformname") {
				item.platformName= fnode[i+1][0];
			}
		}
		return item;
	}
	let tdb= readMstsUnicode(path);
	if (typeof tdb[0]!="string" || tdb[0].toLowerCase() != "trackdb")
		throw "bad TrackDB file "+path;
	tdb= tdb[1];
	for (let i=0; i<tdb.length; i++) {
		if (typeof tdb[i]!="string")
			continue;
		let lower= tdb[i].toLowerCase();
		if (lower == "serial") {
			result.serial= parseInt(tdb[i+1][0]);
			continue;
		}
		if (lower=="tritemtable") {
			result.items= [];
			let node= tdb[i+1];
			for (let j=0; j<node.length; j++) {
				if (typeof node[j]!="string")
					continue;
				let lower= node[j].toLowerCase();
				if (lower=="signalitem") {
					result.items.push(
					  parseTrItem(node[j+1]));
				} else if (lower=="platformitem") {
					result.items.push(
					  parseTrItem(node[j+1]));
				}
			}
			result.itemTable= tdb[i+1];
			continue;
		}
		if (lower!="tracknodes")
			continue;
		let node= tdb[i+1];
		for (let j=0; j<node.length; j++) {
			if (typeof node[j]!="string")
				continue;
			let lower= node[j].toLowerCase();
			if (lower=="tracknode") {
				saveTrackNode(node[j+1]);
			}
		}
	}
	return result;
}

//	finds and return a tile entry in the tiles array.
let findTile= function(tx,tz)
{
	for (let i=0; i<tiles.length; i++) {
		let tile= tiles[i];
		if (tile.x==tx && tile.z==tz)
			return tile;
	}
//	console.log("no tile "+tx+" "+tz);
	return null;
}

//	returns terrain elevation given tile and height field coordinates.
let getTerrainElevation= function(i,j,tile,orig)
{
	if (!tile.terrain)
		readTerrain(tile);
	let tdata= orig ? tile.origTerrain : tile.terrain;
	if (i<256 && j<256)
		return tile.floor + tile.scale*tdata.readUInt16LE((i*256+j)*2);
	if (i<256 && j>=256) {
		if (!tile.tile21)
			tile.tile21= findTile(tile.x+1,tile.z);
		if (tile.tile21 && !tile.tile21.terrain)
			readTerrain(tile.tile21);
		if (tile.tile21 && tile.tile21.terrain) {
			tdata= orig ? tile.tile21.origTerrain :
			  tile.tile21.terrain;
			return tile.tile21.floor + tile.tile21.scale*
			  tdata.readUInt16LE((i*256+j-256)*2);
		} else {
			return tile.floor +
			  tile.scale*tdata.readUInt16LE((i*256+255)*2);
		}
	}
	if (i>=256 && j<256) {
		if (!tile.tile12)
			tile.tile12= findTile(tile.x,tile.z-1);
		if (tile.tile12 && !tile.tile12.terrain)
			readTerrain(tile.tile12);
		if (tile.tile12 && tile.tile12.terrain) {
			tdata= orig ? tile.tile12.origTerrain :
			  tile.tile12.terrain;
			return tile.tile12.floor + tile.tile12.scale*
			  tdata.readUInt16LE(((i-256)*256+j)*2);
		} else {
			return tile.floor +
			  tile.scale*tdata.readUInt16LE((255*256+j)*2);
		}
	}
	if (i>=256 && j>=256) {
		if (!tile.tile22)
			tile.tile22= findTile(tile.x+1,tile.z-1);
		if (tile.tile22 && !tile.tile22.terrain)
			readTerrain(tile.tile22);
		if (tile.tile22 && tile.tile22.terrain) {
			tdata= orig ? tile.tile22.origTerrain :
			  tile.tile22.terrain;
			return tile.tile22.floor + tile.tile22.scale*
			  tdata.readUInt16LE(((i-256)*256+j-256)*2);
		} else {
			return tile.floor +
			  tile.scale*tdata.readUInt16LE((255*256+255)*2);
		}
	}
}

//	returns the terrain elevation given internal u/v coordinates.
let getElevation= function(u,v)
{
	let tx= centerTX + Math.round(u/2048);
	let tz= centerTZ + Math.round(v/2048);
	let x= u - 2048*(tx-centerTX);
	let z= v - 2048*(tz-centerTZ);
//	console.log("ge "+tx+" "+tz+" "+x+" "+z);
	return getTileElevation(tx,tz,x,z);
}

//	returns an interpolated terrain elevation given coordinates within tile.
let getTileElevation= function(tx,tz,x,z,orig)
{
	let j= Math.floor(x/8) + 128;
	let i= 128 - Math.floor(z/8);
	if (j < 0) {
		j+= 256;
		x+= 2048;
		tx-= 1;
	}
	if (i <= 0) {
		i+= 256;
		z-= 2048;
		tz+= 1;
	}
	let x0= 8*(j-128);
	let z0= 8*(128-i);
	let wx= (x-x0)/8;
	let wz= (z-z0)/8;
	let tile= findTile(tx,tz);
	if (!tile) {
		console.log("cant find "+tx+" "+tz);
		return 0;
	}
	let a00= getTerrainElevation(i,j,tile,orig);
	let a01= getTerrainElevation(i-1,j,tile,orig);
	let a11= getTerrainElevation(i-1,j+1,tile,orig);
	let a10= getTerrainElevation(i,j+1,tile,orig);
//	console.log(" gte "+wx+" "+wz+" "+x0+" "+z0+" "+i+" "+j);
//	console.log("  "+a00+" "+a10+" "+a11+" "+a01);
	return (1-wx)*(1-wz)*a00 + wx*(1-wz)*a10 + wx*wz*a11 + (1-wx)*wz*a01;
}

