var express = require('express');
var app = express();

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
	console.log("Request from " + req.ip)
	res.render('index.ejs');
});

// Files
app.use('/static', express.static(__dirname + '/static'));

// Start the server
app.listen(9001, function() {
	console.log('Bhell listening on port 9001.');
});
