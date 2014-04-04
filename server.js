var express = require('express');
var app     = express();
var lifxutils = require('./lifxUtilities');

app.use(express.bodyParser());

app.post('/lifx', function(req, res) {
  	res.send('executing action"' + req.body.action + '".');

  	var params = req.body.action.split(/[ ]+/);
  	
  	// lowercase the verb which may have got uppercased in stupid mobile browsers
  	if(params.length > 0) params[0] = params[0].toLowerCase();

  	var lifxRunner = new lifxutils.LIFXRunner(params);
	lifxRunner.actLIFX();
});

var port = process.env.PORT || 3000;

app.use('/',express.static('website'))
app.listen(port, function() {
  console.log('Server running at',port);
});