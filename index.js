var express    = require('express')
var archiver   = require('archiver')
var bodyParser = require('body-parser')
var aws        = require('aws-sdk')
var debug      = require('debug')('zipper')

var s3 = new aws.S3()
var bucket = process.env.AWS_BUCKET

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
  archive.finalize()
})

function attachment(filename) {
  return "attachment; filename=\"" + filename + '"'
}

app.listen(process.env.PORT || 5000)