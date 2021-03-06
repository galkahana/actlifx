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


// application main

var lifxutils = require('./lifxUtilities');
var lifxRunner = new lifxutils.LIFXRunner(process.argv.slice(2,process.argv.length));

lifxRunner.actLIFX();