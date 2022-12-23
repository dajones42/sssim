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

//	default table of known sounds, can be overwritten by json file
let sounds= {
	gp38: [
		{ minThrottle: 0, maxThrottle: .16, volume: 1,
			wavFile: "GP38/SOUND/x_gp_power_cruise1.wav" },
		{ minThrottle: .16, maxThrottle: .33, volume: 1,
			wavFile: "GP38/SOUND/x_gp_power_cruise2.wav" },
		{ minThrottle: .33, maxThrottle: .5, volume: 1,
			wavFile: "GP38/SOUND/x_gp_power_cruise3.wav" },
		{ minThrottle: .5, maxThrottle: .66, volume: 1,
			wavFile: "GP38/SOUND/x_gp_power_cruise4.wav" },
		{ minThrottle: .66, maxThrottle: .84, volume: 1,
			wavFile: "GP38/SOUND/x_gp_power_cruise5.wav" },
		{ minThrottle: .84, maxThrottle: 1, volume: 1,
			wavFile: "GP38/SOUND/x_gp_power_cruise6.wav" }
	],
	als4: [
		{ minThrottle: 0, maxThrottle: .16, volume: 1,
			wavFile: "Common.Snd/als4/x_Alco_power_cruise1.wav" },
		{ minThrottle: .16, maxThrottle: .33, volume: 1,
			wavFile: "Common.Snd/als4/x_Alco_power_cruise2.wav" },
		{ minThrottle: .33, maxThrottle: .5, volume: 1,
			wavFile: "Common.Snd/als4/x_Alco_power_cruise3.wav" },
		{ minThrottle: .5, maxThrottle: .66, volume: 1,
			wavFile: "Common.Snd/als4/x_Alco_power_cruise4.wav" },
		{ minThrottle: .66, maxThrottle: .84, volume: 1,
			wavFile: "Common.Snd/als4/x_Alco_power_cruise5.wav" },
		{ minThrottle: .84, maxThrottle: 1, volume: 1,
			wavFile: "Common.Snd/als4/x_Alco_power_cruise6.wav" }
	],
	rdc: [
		{ minThrottle: 0, maxThrottle: .06, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise0.wav" },
		{ minThrottle: .06, maxThrottle: .18, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise1.wav" },
		{ minThrottle: .18, maxThrottle: .30, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise2.wav" },
		{ minThrottle: .30, maxThrottle: .42, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise3.wav" },
		{ minThrottle: .42, maxThrottle: .54, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise4.wav" },
		{ minThrottle: .54, maxThrottle: .66, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise5.wav" },
		{ minThrottle: .66, maxThrottle: .78, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise6.wav" },
		{ minThrottle: .78, maxThrottle: .90, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise7.wav" },
		{ minThrottle: .90, maxThrottle: 1, volume: 1,
			wavFile: "NHRDC/Sound/x_sd_power_cruise8.wav" }
	],
	rodloco2: [
		{ minSpeed: .5, maxSpeed: 1.2, volume: 1,
			wavFile: "VSCSteamSound/x_es2_150.wav" },
		{ minSpeed: 1.2, maxSpeed: 2, volume: 1,
			wavFile: "VSCSteamSound/x_es2_100d.wav" },
		{ minSpeed: 2, maxSpeed: 3.15, volume: 1,
			wavFile: "VSCSteamSound/x_es2_075d.wav" },
		{ minSpeed: 3.15, maxSpeed: 4.25, volume: 1,
			wavFile: "VSCSteamSound/x_es2_050d.wav" },
		{ minSpeed: 4.25, maxSpeed: 5, volume: 1,
			wavFile: "VSCSteamSound/x_es2_037d.wav" },
		{ minSpeed: 5, maxSpeed: 5.8, volume: 1,
			wavFile: "VSCSteamSound/x_es2_032e.wav" },
		{ minSpeed: 5.8, maxSpeed: 6.6, volume: 1,
			wavFile: "VSCSteamSound/x_es2_027e.wav" },
		{ minSpeed: 6.6, maxSpeed: 8, volume: 1,
			wavFile: "VSCSteamSound/x_es2_024f.wav" },
		{ minSpeed: 8, maxSpeed: 9.25, volume: 1,
			wavFile: "VSCSteamSound/x_es2_020g.wav" },
		{ minSpeed: 9.25, maxSpeed: 11, volume: 1,
			wavFile: "VSCSteamSound/x_es2_017e.wav" },
		{ minSpeed: 11, maxSpeed: 13, volume: 1,
			wavFile: "VSCSteamSound/x_es2_015g.wav" },
		{ minSpeed: 13, maxSpeed: 16, volume: 1,
			wavFile: "VSCSteamSound/x_es2_012e.wav" },
		{ minSpeed: 16, maxSpeed: 18, volume: 1,
			wavFile: "VSCSteamSound/x_es2_010g.wav" },
		{ minSpeed: 18, maxSpeed: 24, volume: 1,
			wavFile: "VSCSteamSound/x_es2_009g.wav" },
		{ minSpeed: 24, maxSpeed: 32, volume: 1,
			wavFile: "VSCSteamSound/x_es2_007h.wav" },
		{ minSpeed: 32, maxSpeed: 100, volume: 1,
			wavFile: "VSCSteamSound/x_es2_005f.wav" }
	]
};

//	reads a .wav file and returns an AudioBuffer with the data on success.
let loadWavFile= function(path)
{
	try {
		let buf= fs.readFileSync(path);
		if (buf.toString("ascii",0,4)!="RIFF" ||
		  buf.toString("ascii",8,12)!="WAVE")
			throw "invalid wav file header ";
		let channels= 0;
		let rate= 0;
		let length= 0;
		let bits= 0;
		let abuf= null;
		let context= THREE.AudioContext.getContext();
		for (let offset=12; offset<buf.length; ) {
			let type= buf.toString("ascii",offset,offset+4);
			let len= buf.readUInt32LE(offset+4);
//			console.log("chunk "+type+" "+len+" "+offset);
			if (type == "fmt ") {
				if (buf.readUInt16LE(offset+8) != 1)
					throw "not pcm";
				channels= buf.readUInt16LE(offset+10);
				rate= buf.readUInt32LE(offset+12);
				bits= buf.readUInt16LE(offset+22);
//				console.log("fmt "+channels+" "+rate+" "+bits);
			} else if (type == "data") {
				let size= channels*bits/8;
				length= len / size;
//				console.log("abuf "+length);
				abuf= context.createBuffer(
				  channels,length,rate);
				for (let i=0; i<channels; i++) {
					let data= abuf.getChannelData(i);
					for (let j=0; j<length; j++) {
						let k= offset+8+j*size+i*bits/8;
						data[j]= (bits == 8) ?
						  buf.readInt8(k)/128 :
						  buf.readInt16LE(k)/32768;
					}
				}
			}
			offset+= len+8;
		}
		return abuf;
	} catch (e) {
		console.error("bad wav file "+path+" "+e);
	}
	return null;
}

let loadRailcarSounds= function(railcar,soundName)
{
	let soundTable= sounds[soundName];
	if (!soundTable) {
		console.error("unknown sound "+soundName);
		return;
	}
	let sound= new THREE.PositionalAudio(listener);
	sound.setRefDistance(20);
	sound.setLoop(true);
	railcar.model.add(sound);
	railcar.soundControl= {
	  sound: sound,
	  current: -1,
	  soundTable: soundTable
	};
	let basepath= mstsDir+fspath.sep+"TRAINS"+
	  fspath.sep+"TRAINSET"+fspath.sep;
	for (let i=0; i<soundTable.length; i++) {
		if (soundTable[i].buffer)
			continue;
		let path= basepath+soundTable[i].wavFile;
//		console.log("sound "+i+" "+path);
		soundTable[i].buffer= loadWavFile(path);
	}
}

let updateRailcarSound= function(railcar,throttle,speed)
{
	if (!railcar.soundControl || !railcar.model)
		return;
	let sc= railcar.soundControl;
	let dx= railcar.model.position.x;
	let dy= railcar.model.position.y;
	let dz= railcar.model.position.z;
	if (dx*dx+dy*dy+dz*dz > 1e6) {
		if (sc.sound.isPlaying)
			sc.sound.stop();
		sc.current= -1;
	} else {
		speed= Math.abs(speed);
		if (railcar.mainWheelRadius > 0)
			speed/= railcar.mainWheelRadius;
		for (let i=0; i<sc.soundTable.length; i++) {
			let te= sc.soundTable[i];
			if (!te.buffer)
				continue;
			if (te.maxThrottle &&
			  (throttle<te.minThrottle || throttle>te.maxThrottle))
				continue;
			if (te.maxSpeed &&
			  (speed<te.minSpeed || speed>te.maxSpeed))
				continue;
			if (sc.current != i) {
				if (sc.sound.isPlaying)
					sc.sound.stop();
				sc.sound.setBuffer(te.buffer);
				if (te.volume)
					sc.sound.setVolume(te.volume);
				else
					sc.sound.setVolume(1);
				sc.sound.play();
				sc.current= i;
//				console.log("sound "+i);
			}
			return;
		}
		if (sc.sound.isPlaying)
			sc.sound.stop();
		sc.current= -1;
	}
}
