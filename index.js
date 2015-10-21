var express    = require('express')
var archiver   = require('archiver')
var bodyParser = require('body-parser')
var aws        = require('aws-sdk')
var debug      = require('debug')('zipper')

var s3 = new aws.S3()
var bucket = process.env.AWS_BUCKET

if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.AWS_SECRET_ACCESS_KEY)
  throw Error('Missing AWS fields')

var app        = express()
app.use(bodyParser.json())

app.get('/', function(req, res) {
  var filename = req.query.filename
    , tracks = req.query.tracks
    , userId = req.query.userId

  if (!filename || !tracks || !userId)
    return res.status(404).send('Missing fields.')

  try{
    tracks = JSON.parse(tracks)
  } catch(e) {
    return res.status(404).send('Invalid tracks.')
  }

  debug('Writing playlist', filename)

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-disposition': attachment(filename)
  })

  var archive = archiver.create('zip', {store: true})
  archive.pipe(res)

  tracks.forEach(function (track) {
    var opts = {
      Bucket: bucket,
      Key: track.key
    };
    archive.append(s3.getObject(opts).createReadStream(), {name: track.filename})
  });
  archive.on('error', function(err) {
    debug('archive error', err)
    res.end('Error')
  });
  archive.finalize()
})

function attachment(filename) {
  return "attachment; filename=\"" + filename + '"'
}

var port = process.env.PORT || 5000
app.listen(port, function() {
  debug('Server listening on port', port)
});