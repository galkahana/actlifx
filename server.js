var express = require('express');
var app     = express();
var lifxutils = require('./lifxUtilities');

app.use(express.bodyParser());

app.post('/lifx', function(req, res) {
  	res.send('executing action"' + req.body.action + '".');

  	var lifxRunner = new lifxutils.LIFXRunner(req.body.action.toLowerCase().split(/[ ]+/));
	lifxRunner.actLIFX();
});

var port = process.env.PORT || 3000;

app.use('/',express.static('website'))
app.listen(port, function() {
  console.log('Server running at',port);
});