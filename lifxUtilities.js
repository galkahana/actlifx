/*
	Program for controlling LIFX bulbs.

	run with 'node actlifx', and then parameters.
	The first parameter is verb, or  adverb and then verb. The following verbs are available:

	1. on - turn bulbs on [done]
	2. off - turn bulbs off [done]
	3. save - save current state of bulb or bulbs
	4. restore - restore a previously saved state of bulb or bulbs
	5. status - provide status for bulb or bulbs
	6. rgb/color - set color to a bulb or bulbs thrugh RGB color space
	7. hsb - set color to a bulb or bulbs through HSB color space
	8. darker - reduce a bulb or bulbs illumination [done]
	9. lighter - increase a bulb or bulbs illumination [done]

	e.g. node actLifx on
	will turn all the bulbs on

	each verb can be followed by either nothing, the string 'all' or one or more names of bulbs.
	like:
	node actlifx on Kitchen
	node actlifx off Entrance
	node actlifx on Kitchen Entrance

	it's ok to separate bulb names with 'and'

	some verbs have additional parameters:

	1. save/restore - When using 'save' then after the names of the bulbs state "to Test", which will save the bulbs state in Test, which you can later load.
		state name is optional. To any combination of bulbs there's also a default state which can be saved. Later a restore command can either restore from default
		or use "from" after the bulbs names to state a previously set state name.
		examples:

		% this will save the current state of Etnrance bulb to its default state
		node actlifx save Entrance

		% it can later be restored with this
		node actlifx restore Entrance

		% now say we want to save multiple states of a bulb, just provide a name for the state, you can later restore
		node actlifx save Entrance Kitchen to MorningSetup

		% and you can later resotre it to 
		node actlifx restore Entrance Kitchen from MorningSetup

		% or if you want the default
		node actlifx restore Entrance Kitchen

		% or if you preconfigured a state for all bulbs
		node actlifx restore

		% or, you can do the same with
		node actlifx restore all

	2. darker/lighter - both darker and lighter can have adverbs. The adverbs may be 'much' or 'little', which will make 
		the darkening/lighting change either more drastic or less drastic respectively:
		node actlifx lighter
		node actlifx much lighter
		node actlifx little darker Kitchen

		note that at a low level of lighting, darkening will cause bulb shutdown.

	3. hsb/rgb/color - each of the lights color verbs will require 3 parameters specifying the light values coming aftet 'in' . Provide a value from 0...0xffff.
						for example:

						node actlifx color Kitchen in 0xffff 0x00cc 0x0015

						another option, probably better, is to use color names. any CSS name is a good options

						node actlifx color Kitchen in red
						node actlifx color Entrance in lightblue

						[note that you can use 'rgb' as an alternative to 'color'. You can use 'hsb' as well which will setup later color values as hsb components]
*/

var fs = require('fs');
var lifx = require('lifx');

var isDebug = false;
var config = {
  "illuminationStepSize": 255,
  "turnOffLevel": 511,
};

var predefinedColors =
{
    aliceblue:0xF0F8FF,
    antiquewhite:0xFAEBD7,
    aqua:0x00FFFF,
    aquamarine:0x7FFFD4,
    azure:0xF0FFFF,
    beige:0xF5F5DC,
    bisque:0xFFE4C4,
    black:0x000000,
    blanchedalmond:0xFFEBCD,
    blue:0x0000FF,
    blueviolet:0x8A2BE2,
    brown:0xA52A2A,
    burlywood:0xDEB887,
    cadetblue:0x5F9EA0,
    chartreuse:0x7FFF00,
    chocolate:0xD2691E,
    coral:0xFF7F50,
    cornflowerblue:0x6495ED,
    cornsilk:0xFFF8DC,
    crimson:0xDC143C,
    cyan:0x00FFFF,
    darkblue:0x00008B,
    darkcyan:0x008B8B,
    darkgoldenrod:0xB8860B,
    darkgray:0xA9A9A9,
    darkgreen:0x006400,
    darkkhaki:0xBDB76B,
    darkmagenta:0x8B008B,
    darkolivegreen:0x556B2F,
    darkorange:0xFF8C00,
    darkorchid:0x9932CC,
    darkred:0x8B0000,
    darksalmon:0xE9967A,
    darkseagreen:0x8FBC8F,
    darkslateblue:0x483D8B,
    darkslategray:0x2F4F4F,
    darkturquoise:0x00CED1,
    darkviolet:0x9400D3,
    deeppink:0xFF1493,
    deepskyblue:0x00BFFF,
    dimgray:0x696969,
    dodgerblue:0x1E90FF,
    firebrick:0xB22222,
    floralwhite:0xFFFAF0,
    forestgreen:0x228B22,
    fuchsia:0xFF00FF,
    gainsboro:0xDCDCDC,
    ghostwhite:0xF8F8FF,
    gold:0xFFD700,
    goldenrod:0xDAA520,
    gray:0x808080,
    green:0x008000,
    greenyellow:0xADFF2F,
    honeydew:0xF0FFF0,
    hotpink:0xFF69B4,
    indianred:0xCD5C5C,
    indigo:0x4B0082,
    ivory:0xFFFFF0,
    khaki:0xF0E68C,
    lavender:0xE6E6FA,
    lavenderblush:0xFFF0F5,
    lawngreen:0x7CFC00,
    lemonchiffon:0xFFFACD,
    lightblue:0xADD8E6,
    lightcoral:0xF08080,
    lightcyan:0xE0FFFF,
    lightgoldenrodyellow:0xFAFAD2,
    lightgray:0xD3D3D3,
    lightgreen:0x90EE90,
    lightpink:0xFFB6C1,
    lightsalmon:0xFFA07A,
    lightseagreen:0x20B2AA,
    lightskyblue:0x87CEFA,
    lightslategray:0x778899,
    lightsteelblue:0xB0C4DE,
    lightyellow:0xFFFFE0,
    lime:0x00FF00,
    limegreen:0x32CD32,
    linen:0xFAF0E6,
    magenta:0xFF00FF,
    maroon:0x800000,
    mediumaquamarine:0x66CDAA,
    mediumblue:0x0000CD,
    mediumorchid:0xBA55D3,
    mediumpurple:0x9370DB,
    mediumseagreen:0x3CB371,
    mediumslateblue:0x7B68EE,
    mediumspringgreen:0x00FA9A,
    mediumturquoise:0x48D1CC,
    mediumvioletred:0xC71585,
    midnightblue:0x191970,
    mintcream:0xF5FFFA,
    mistyrose:0xFFE4E1,
    moccasin:0xFFE4B5,
    navajowhite:0xFFDEAD,
    navy:0x000080,
    oldlace:0xFDF5E6,
    olive:0x808000,
    olivedrab:0x6B8E23,
    orange:0xFFA500,
    orangered:0xFF4500,
    orchid:0xDA70D6,
    palegoldenrod:0xEEE8AA,
    palegreen:0x98FB98,
    paleturquoise:0xAFEEEE,
    palevioletred:0xDB7093,
    papayawhip:0xFFEFD5,
    peachpuff:0xFFDAB9,
    peru:0xCD853F,
    pink:0xFFC0CB,
    plum:0xDDA0DD,
    powderblue:0xB0E0E6,
    purple:0x800080,
    red:0xFF0000,
    rosybrown:0xBC8F8F,
    royalblue:0x4169E1,
    saddlebrown:0x8B4513,
    salmon:0xFA8072,
    sandybrown:0xF4A460,
    seagreen:0x2E8B57,
    seashell:0xFFF5EE,
    sienna:0xA0522D,
    silver:0xC0C0C0,
    skyblue:0x87CEEB,
    slateblue:0x6A5ACD,
    slategray:0x708090,
    snow:0xFFFAFA,
    springgreen:0x00FF7F,
    steelblue:0x4682B4,
    tan:0xD2B48C,
    teal:0x008080,
    thistle:0xD8BFD8,
    tomato:0xFF6347,
    turquoise:0x40E0D0,
    violet:0xEE82EE,
    wheat:0xF5DEB3,
    white:0xFFFFFF,
    whitesmoke:0xF5F5F5,
    yellow:0xFFFF00,
    yellowgreen:0x9ACD32
};

var adverbs =
{
	much : ['lighter','darker'],
	little : ['lighter','darker']
};

var verbs =
{
	on : {
		action:'on',
		run:
			function(inLx,inBulb,inArguments,inCallback)
			{
				inLx.lightsOn(inBulb);
				inCallback();
			}
	},
	off : {
		action:'off',
		run:
			function(inLx,inBulb,inArguments,inCallback)
			{
				inLx.lightsOff(inBulb);
				inCallback();
			}

	},
	save : {
		action:'save',
		parseArguments : function(inArgumentsList)
						{
							var toIndex = inArgumentsList.indexOf('to')
							if(toIndex == -1 ||
								toIndex == inArgumentsList.length-1)
								return {};
							else
								return {stateName:inArgumentsList[toIndex+1]};
						},
		run: function(inLx,inBulb,inArguments,inCallback)
			{
				var self = this;
				this.stateName = inArguments.stateName;
				getBulbState(inLx,inBulb,function(inBulbState)
				{
					if(!self.states)
						self.states = [];
					self.states.push(inBulbState);
					inCallback();
				},inCallback);
			},
		finalize: function()
			{
				saveStates(this.originalTargets,this.states,this.stateName);
			},
		nounStopper: 'to'
	},
	restore : {
		action:'restore',
		parseArguments : function(inArgumentsList)
						{
							var toIndex = inArgumentsList.indexOf('from')
							if(toIndex == -1 ||
								toIndex == inArgumentsList.length-1)
								return {speed:parseSpeed(inArgumentsList)};
							else
								return {stateName:inArgumentsList[toIndex+1],speed:parseSpeed(inArgumentsList)};
						},
		run: function(inLx,inBulb,inArguments,inCallback)
			{
				if(!this.states)
				{
					inCallback();
					return;
				}
				var stateForBulb = this.states[inBulb.name];
				if(stateForBulb)
				{
					getBulbState(inLx,inBulb,function(inBulbState)
					{
						if(inBulbState.power != stateForBulb.power)
						{
							if(stateForBulb.power == 0xffff)
								inLx.lightsOn(inBulb);
							else
								inLx.lightsOff(inBulb);
						}
						inLx.lightsColour(stateForBulb.hue, stateForBulb.saturation,stateForBulb.brightness,stateForBulb.kelvin,inArguments.speed, inBulb);
						inCallback();
					},inCallback);

				}
				else
					inCallback();
			},
		initialize: function(inCallback)
		{
			var self = this;
			loadConfiguration(function(inConfig)
			{
				var states;
				do
				{
					if(!inConfig.states)
						break;
					var keyFromTargets = createKeyForTargets(self.originalTargets);
					if(!inConfig.states[keyFromTargets])
						break;
					if(self.parameters.stateName)
						states = inConfig.states[keyFromTargets].namedStates[self.parameters.stateName];
					else
						states = inConfig.states[keyFromTargets].default;
				}while(false);
				if(!states)
				{
					console.log('Configuration state not found, cannot restore');
					inCallback();
					return;
				}
				self.states = {};
				states.forEach(function(inElement)
				{
					self.states[inElement.bulbLabel] = inElement;
				});
				inCallback();
			});
		},
		nounStopper: 'from'

	},
	rgb : {alias:'color'},
	color : {
		action:'color',
		parseArguments : function(inArgumentsList)
						{
							return {color:parseColorArguments(inArgumentsList),speed:parseSpeed(inArgumentsList)};
						},
		run: function(inLx,inBulb,inArguments,inCallback)
			{
				var rgbColor;
				if(!inArguments.color)
				{
					console.log('Invalid argument');
					inCallback();
					return;
				}

				if(typeof inArguments.color === 'string')
				{
					rgbColor = predefinedToRGBComponents(inArguments.color);
					if(!rgbColor)
					{
						console.log('Unknown color name',inArguments.color);
						inCallback();
						return;
					}
				}
				else
					rgbColor = inArguments.color;
				setHSVColor(inLx,inBulb,RGBToHSV(rgbColor[0],rgbColor[1],rgbColor[2]),inArguments.speed,inCallback);
			},
		nounStopper: 'in'
	},
	hsb : {
		action:'hsb',
		parseArguments : function(inArgumentsList)
						{
							return {color:parseColorArguments(inArgumentsList),speed:parseSpeed(inArgumentsList)};
						},
		run: function(inLx,inBulb,inArguments,inCallback)
			{
				var hsv;
				if(!inArguments.color)
				{
					console.log('Invalid argument');
					inCallback();
					return;
				}

				if(typeof inArguments.color === 'string')
				{
					var rgbColor = predefinedToRGBComponents(inArguments.color);
					if(!rgbColor)
					{
						console.log('Unknown color name',inArguments.color);
						inCallback();
						return;
					}
					hsv = RGBToHSV(rgbColor[0],rgbColor[1],rgbColor[2]);
				}
				else
					hsv = inArguments.color;
				setHSVColor(inLx,inBulb,hsv,inArguments.speed,inCallback);
			},
		nounStopper: 'in',
	},
	darker : {
		action:'darker',
		parseArguments : function(inArgumentsList)
						{
							return  {modifier:parseLightingAdverb(inArgumentsList),speed:parseSpeed(inArgumentsList)};
						},
		run: function(inLx,inBulb,inArguments,inCallback)
		{
			getBulbState(inLx,inBulb,function(inBulbState)
			{
				if(inBulbState.brightness == 0x0000 || inBulbState.power == 0x0000)
				{
					inCallback();
					return;
				}

				var stepSize = calculateStepSize(inArguments.modifier);
				var illuminationValue = (inBulbState.brightness-stepSize) < 0x0000 ? 0x0000: (inBulbState.brightness-stepSize);
				if(illuminationValue < config.turnOffLevel)
				{
					console.log('Turning off bulb',inBulb.name);
					inLx.lightsOff(inBulb);
				}
				else
					inLx.lightsColour(inBulbState.hue, inBulbState.saturation,illuminationValue,inBulbState.kelvin,inArguments.speed, inBulb);
				inCallback();
			},inCallback);
		}
	},
	lighter : {
		action:'lighter',
		parseArguments : function(inArgumentsList)
						{
							return  {modifier:parseLightingAdverb(inArgumentsList),speed:parseSpeed(inArgumentsList)};							
						},
		run: function(inLx,inBulb,inArguments,inCallback)
		{
			getBulbState(inLx,inBulb,function(inBulbState)
			{
				if(inBulbState.brightness == 0xffff && inBulbState.power == 0xffff)
				{
					inCallback();
					return;
				}

				var stepSize = calculateStepSize(inArguments.modifier);
				var illuminationValue = (inBulbState.brightness+stepSize) > 0xffff ? 0xffff: (inBulbState.brightness+stepSize);
				if(inBulbState.power == 0x0000)
				{
					console.log('Turning on bulb',inBulb.name);
					inLx.lightsOn(inBulb);
				}
				inLx.lightsColour(inBulbState.hue, inBulbState.saturation,illuminationValue,inBulbState.kelvin,inArguments.speed, inBulb);
				inCallback();
			},inCallback);
		}
	},
	status : {
		action:'status',
		run: function(inLx,inBulb,inArguments,inCallback)
				{
					getBulbState(inLx,inBulb,function(inBulbState)
					{
						console.log('status for',inBulbState.bulbLabel);
						console.log('---------------');
						console.log('Bulb is', inBulbState.power == 0xffff ? 'on':'off');
						console.log('Color is [hsb]:','0x' + inBulbState.hue.toString(16),'0x' + inBulbState.saturation.toString(16),'0x' + inBulbState.brightness.toString(16));
						console.log('White color value','0x' + inBulbState.kelvin.toString(16));
						console.log('Fade time is',inBulbState.dim + '[ms]');
						console.log('---------------');
						inCallback();
					},inCallback);
				}
	}
};

function predefinedToRGBComponents(inColorName)
{
	if(predefinedColors[inColorName])
	{
		var rgbComposite = predefinedColors[inColorName];
		var b = (rgbComposite % 0x100) * 0x100;
		rgbComposite=Math.floor(rgbComposite/0x100);
		var g = (rgbComposite % 0x100) * 0x100;
		rgbComposite=Math.floor(rgbComposite/0x100);
		var r = rgbComposite * 0x100;
		return [r,g,b];
	}
	else
		return null;
}

function calculateStepSize(inModifier)
{
	if(inModifier == 'much')
	 	return 0x50 * config.illuminationStepSize;
	 else if(inModifier== 'little')
	 	return 0x5*config.illuminationStepSize;
	 else
	 	return 0x20*config.illuminationStepSize;
}

function parseLightingAdverb(inArgumentsList)
{
	if(inArgumentsList.length > 0 &&
		(inArgumentsList[0] == 'much' ||
			inArgumentsList[0] == 'little'))
		return inArgumentsList[0]
	else
		return null;
}

function parseColorArguments(inArgumentsList)
{
	var inIndex = inArgumentsList.indexOf('in');
	if(inIndex == -1 || inIndex == inArgumentsList.length-1)
		return null;


	if((inIndex + 3) < inArgumentsList.length)
	{
		return [
			parseNumber(inArgumentsList[inIndex+1]),
			parseNumber(inArgumentsList[inIndex+2]),
			parseNumber(inArgumentsList[inIndex+3])
		];
	}
	else 
		return inArgumentsList[inIndex+1]; // should be color name. to be discovered later
}

function parseNumber(inString)
{
	if(inString.substring(0,2) == '0x')
		return parseInt(inString,16);
	else
		return parseInt(inString,10);
}

function parseSpeed(inArgumentsList,inDefault)
{
	if(inArgumentsList.indexOf('quickly') != -1)
		return 0;
	else if(inArgumentsList.indexOf('slowly') != -1)
		return 10000;
	else
		return inDefault === undefined ? 3000 : inDefault;

}

function determineAction(inArgumentsList)
{
	if(inArgumentsList.length == 0)
	{
		console.log('Error: no action defined',inArgumentsList);
		return null;
	}

	/*
		input, argumnets list. parse it and retrieve result.

		result is an object with:
			targets: Either 'all' or array of bulb names 
			action: reference to action object that matches an input verb
			parameters: key value object with parameters for action, not including a particular target
	*/

	var verb;
	var bulbListStartIndex;
	if(adverbs[inArgumentsList[0]])
	{
		if(inArgumentsList.length < 2)
		{
			console.log('Error: no verb defined',inArgumentsList);
			return null;
		}
		verb = verbs[inArgumentsList[1]];
		bulbListStartIndex = 2;
	}
	else
	{
		verb = verbs[inArgumentsList[0]];
		bulbListStartIndex = 1;
	}
	if(verb && verb.alias)
		verb = verbs[verb.alias];

	if(!verb)
	{
		console.log('Error: no verb recognized',inArgumentsList);
		return null;
	}

	var parameters;
	if(verb.parseArguments)
	{
		parameters = verb.parseArguments(inArgumentsList);
		if(!parameters)
		{
			console.log('Error: parameters parsing failed',inArgumentsList);
			return null;
		}
	}

	var bulbs = parseBulbs(inArgumentsList,bulbListStartIndex,verb.nounStopper);
	if(!bulbs)
	{
		console.log('Error: failed to parse bulbs names');
		return null;
	}

	return {
		targets:bulbs,
		originalTargets:bulbs.concat(),
		action:verb.action,
		parameters:parameters,
		run:verb.run,
		finalize:verb.finalize,
		initialize:verb.initialize
	};
}

function parseBulbs(inArguments,inBulbsListStartIndex,inStopper)
{
	var stopIndex;
	if(inStopper)
	{
		stopIndex= inArguments.indexOf(inStopper);
		if(stopIndex == -1)
			stopIndex = inArguments.length;
	}
	else
		stopIndex = inArguments.length;

	if(stopIndex == inBulbsListStartIndex ||
		inArguments[inBulbsListStartIndex] == 'all')
		return 'all';

	var bulbNames = [];
	for(var i=inBulbsListStartIndex;i<stopIndex;++i)
	{
		if(i > inBulbsListStartIndex && inArguments[i] == 'and')
			continue;
		bulbNames.push(inArguments[i]);
	}

	return bulbNames;
}

function RGBToHSV(inR,inG,inB)
{
    var r,g,b,h,s,v;
    r = inR/65535.0;
    g = inG/65535.0;
    b = inB/65535.0;

    var min, max, delta;
    min = Math.min(r,g,b);
    max = Math.max(r,g,b);
    v = max;                // v
    delta = max - min;
    if( max != 0 )
        s = delta / max;        // s
    else {
        // r = g = b = 0        // s = 0, v is undefined
        s = 0;
        h = -1;
        return 0;
    }
    if(delta == 0)
    {
        s = 0;
        h = -1;
        return max*65535; // all components equal. this is some white value of the "max" degree    	
    }

    if( r == max )
        h = ( g - b ) / delta;      // between yellow & magenta
    else if( g == max )
        h = 2 + ( b - r ) / delta;  // between cyan & yellow
    else
        h = 4 + ( r - g ) / delta;  // between magenta & cyan
    h *= 60;                // degrees
    if( h < 0 )
        h += 360;

    return [Math.ceil(h*65535/360),Math.ceil(s*65535),Math.ceil(v*65535)];
}

function setHSVColor(inLx,inBulb,inHSV,inSpeed,inCallback)
{
	getBulbState(inLx,inBulb,function(inBulbState)
	{
		var args;
		if(typeof inHSV === 'number')
		{
			// some white value. set to plain white and hsv is brightness
			args = [0,0,inHSV,0];
		}
		else
		{
			// color, set directly with hsv value
			args = [inHSV[0],inHSV[1],inHSV[2],inBulbState.kelvin];
		}

		if(inBulbState.power == 0x0000 && args[2] > config.turnOffLevel)
		{
			console.log('Turning on bulb',inBulb.name);
			inLx.lightsOn(inBulb);
		}					
		if(args[2] < config.turnOffLevel)
		{
			if(inBulbState.power == 0xffff)
			{
				console.log('Turning off bulb',inBulb.name);
				inLx.lightsOff(inBulb);
			}
		}
		else
			inLx.lightsColour(args[0], args[1],args[2],args[3],inSpeed, inBulb);
		inCallback();
	},inCallback);
}

function saveStates(inTargets,inStates,inStateName)
{
	loadConfiguration(function(inConfig)
	{
		if(!inConfig.states)
			inConfig.states = {};
		var keyFromTargets = createKeyForTargets(inTargets);
		if(!inConfig.states[keyFromTargets])
			inConfig.states[keyFromTargets] = {namedStates:{}};
		if(inStateName)
			inConfig.states[keyFromTargets].namedStates[inStateName] = inStates;
		else
			inConfig.states[keyFromTargets].default = inStates;
		saveConfiguration(inConfig);
	});
}

function loadConfiguration(inCallback)
{
	fs.exists('./config.json',function(inExists)
	{
		if(inExists)
		{
			fs.readFile('./config.json', function (err, data) {
	    		if (err) throw err;
	    		inCallback(JSON.parse(data));
	    	});
		}
		else
			inCallback({});
	});
}

function saveConfiguration(inConfig)
{
	fs.writeFile('./config.json', 
				JSON.stringify(inConfig, null, 2), 
				function (err) {
			    	if (err) throw err;
	        	});  	
}

function createKeyForTargets(inTargets)
{
	if(inTargets == 'all')
		return 'all';

	var key = '';
	inTargets.forEach(function(inElement){
		key+=inElement.replace(/_/g,'__')+'_';
	});
	return key;
}

function getBulbState(inLx,inBulb,callback,fallbackcallback)
{
	var recieved = false;
	var to;
	inLx.once('bulbstate',function(data)
		{
			if(to)
				clearTimeout(to);
			recieved = true;
			if(data.bulb.name != inBulb.name)
			{
				if(isDebug)
					console.log('Got state for', data.bulb.name, 'expecting state for',inBulb.name);
				getCurrentBulbState(inBulb,callback,fallbackcallback) // not supposed to happen...as i am sending a packet only to that bulb...but make sure
			}

			callback(data.state);
		});
	inLx._sendToOneOrAll(packet.getLightState(),inBulb); // send getstate to just the bulb that we want

	// retry call to get state till i get it done
	var retries = 0;
	to = setTimeout(function()
	{
		if(!recieved)
		{
			inLx._sendToOneOrAll(packet.getLightState(),inBulb);
			++retries;
			// if failed retries to get state, revert to fallback
			if(retries == 5)
				fallbackcallback();
		}
	},5000);
}


// main execution code helpers
function runActionOnBulb(inLx,inBulb,inActionObject,inCallback)
{
	console.log('Running action on',inBulb.name);
	inActionObject.run(inLx,inBulb,inActionObject.parameters,inCallback);
}

function closeIfNothingHappened(self,inActionObject)
{
	if(!self.somethingHappened && self.inAction == 0)
	{
		finish(self,inActionObject);
		return true;
	}
	self.somethingHappened = false;
	return false;
}

function finish(self,inActionObject)
{
	self.lx.close();
	if(self.checkInterval)
		clearTimeout(self.checkInterval);
	if(inActionObject.finalize)
		inActionObject.finalize();
	console.log('Finishing action',inActionObject.action);
}


// application main
function LIFXRunner(inArguments)
{
	this.actionObject = determineAction(inArguments);
}

LIFXRunner.prototype.actLIFX = function()
{
	this.somethingHappened = true;
	this.inAction = 0;
	this.checkInterval = null;
	this.lx = null;

	// parse action from command line
	if(isDebug)
		console.log('actionObject:', this.actionObject);
	if(!this.actionObject)
		return;

	if(this.actionObject.initialize)
			this.actionObject.initialize(runActionOnBulbs.bind(null,this));
	else
		runActionOnBulbs(this);

}

function runActionOnBulbs(self)
{
	console.log('Starting action',self.actionObject.action);

	// start up bulbs and wait for bulbs to connect. for anyone that connect act on if fits to target
	// stop if no more interesting bulbs are connecting. has timeout method


	self.lx = lifx.init();
	self.bulbsEncountered = {};

	self.lx.on('bulb',function(inBulb)
	{
		if(isDebug)
			console.log('Encountered bulb',inBulb.name);
		if(!self.bulbsEncountered[inBulb.name])
		{
			self.bulbsEncountered[inBulb.name] = true;
			self.somethingHappened = true;
			// act on bulb if in target
			if(self.actionObject.targets == 'all' || self.actionObject.targets.indexOf(inBulb.name) != -1)
			{
				if(self.actionObject.targets != 'all')
					self.actionObject.targets.splice(self.actionObject.targets.indexOf(inBulb.name),1);
				++self.inAction;
				runActionOnBulb(self.lx,inBulb,self.actionObject,function(){
					--self.inAction;
					if(self.actionObject.targets != 'all' && self.actionObject.targets.length == 0)
									finish(self,self.actionObject);
				});
				
			}
		}
	});

	self.lx.findBulbs();


	function continueIfHappened()
	{
		if(!closeIfNothingHappened(self,self.actionObject))
			self.checkInterval = setTimeout(continueIfHappened,4000);
	}
	self.checkInterval = setTimeout(continueIfHappened,4000);
}


module.exports.LIFXRunner = LIFXRunner;