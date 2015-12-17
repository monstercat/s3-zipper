var app = require('./src')
var debug = require('debug')('s3-zipper')

var port = process.env.PORT || 5000
app.listen(port, function() {
  debug('Server listening on port %d', port)
})