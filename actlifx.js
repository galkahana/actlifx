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
						node actlifx color Entrance in light blue

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
	red : [0xffff,0,0],
	green: [0x0000,0xffff,0x0000],
	blue: [0x0000,0x0000,0xffff],
	white : [0xffff,0xffff,0xffff],
	black : [0x0,0x0,0x0]
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
								return {};
							else
								return {stateName:inArgumentsList[toIndex+1]};
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
						inLx.lightsColour(stateForBulb.hue, stateForBulb.saturation,stateForBulb.brightness,stateForBulb.kelvin,stateForBulb.dim, inBulb);
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
							return {color:parseColorArguments(inArgumentsList)};
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
					rgbColor = predefinedColors[inArguments.color];
					if(!rgbColor)
					{
						console.log('Unknown color name',inArguments.color);
						inCallback();
						return;
					}
				}
				else
					rgbColor = inArguments.color;
				setHSVColor(inLx,inBulb,RGBToHSV(rgbColor[0],rgbColor[1],rgbColor[2]),inCallback);
			},
		nounStopper: 'in'
	},
	hsb : {
		action:'hsb',
		parseArguments : function(inArgumentsList)
						{
							return {color:parseColorArguments(inArgumentsList)};
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
					var rgbColor = predefinedColors[inArguments.color];
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
				setHSVColor(inLx,inBulb,hsv,inCallback);
			},
		nounStopper: 'in',
	},
	darker : {
		action:'darker',
		parseArguments : function(inArgumentsList)
						{
							return  {modifier:parseLightingAdverb(inArgumentsList)};
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
					inLx.lightsColour(inBulbState.hue, inBulbState.saturation,illuminationValue,inBulbState.kelvin,0, inBulb);
				inCallback();
			},inCallback);
		}
	},
	lighter : {
		action:'lighter',
		parseArguments : function(inArgumentsList)
						{
							return  {modifier:parseLightingAdverb(inArgumentsList)};							
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
				inLx.lightsColour(inBulbState.hue, inBulbState.saturation,illuminationValue,inBulbState.kelvin,0, inBulb);
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

function setHSVColor(inLx,inBulb,inHSV,inCallback)
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
			inLx.lightsColour(args[0], args[1],args[2],args[3],0, inBulb);
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

function closeIfNothingHappened(inActionObject)
{
	if(!somethingHappened && inAction == 0)
	{
		finish(inActionObject);
		return true;
	}
	somethingHappened = false;
	return false;
}

function finish(inActionObject)
{
	lx.close();
	if(checkInterval)
		clearTimeout(checkInterval);
	if(inActionObject.finalize)
		inActionObject.finalize();
	console.log('Finishing action',inActionObject.action);
}


// application main

// parse action from command line
var actionObject = determineAction(process.argv.slice(2,process.argv.length));
if(isDebug)
	console.log('actionObject:', actionObject);
if(!actionObject)
	return;

if(actionObject.initialize)
		actionObject.initialize(runActionOnBulbs);
else
	runActionOnBulbs();

var somethingHappened = true;
var inAction = 0;
var checkInterval;
var lx;


function runActionOnBulbs()
{
	console.log('Starting action',actionObject.action);

	// start up bulbs and wait for bulbs to connect. for anyone that connect act on if fits to target
	// stop if no more interesting bulbs are connecting. has timeout method


	lx = lifx.init();
	var bulbsEncountered = {};

	lx.on('bulb',function(inBulb)
	{
		if(isDebug)
			console.log('Encountered bulb',inBulb.name);
		if(!bulbsEncountered[inBulb.name])
		{
			bulbsEncountered[inBulb.name] = true;
			somethingHappened = true;
			// act on bulb if in target
			if(actionObject.targets == 'all' || actionObject.targets.indexOf(inBulb.name) != -1)
			{
				if(actionObject.targets != 'all')
					actionObject.targets.splice(actionObject.targets.indexOf(inBulb.name),1);
				++inAction;
				runActionOnBulb(lx,inBulb,actionObject,function(){
					--inAction;
					if(actionObject.targets != 'all' && actionObject.targets.length == 0)
									finish(actionObject);
				});
				
			}
		}
	});

	lx.findBulbs();


	function continueIfHappened()
	{
		if(!closeIfNothingHappened(actionObject))
			checkInterval = setTimeout(continueIfHappened,4000);
	}
	checkInterval = setTimeout(continueIfHappened,4000);
}
