var express    = require('express')
var archiver   = require('archiver')
var bodyParser = require('body-parser')
var aws        = require('aws-sdk')
var debug      = require('debug')('zipper')

if (!process.env.AWS_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION)
  throw Error('Missing AWS fields')

var bucket = process.env.AWS_BUCKET
var s3 = new aws.S3()
var app = express()
app.use(bodyParser.json())

app.post('/', function(req, res) {
  var filename = req.body.filename
    , tracks = req.body.tracks
    , userId = req.body.userId

  if (!filename || !tracks || !userId)
    return res.status(400).send('Missing fields.')

  try{
    tracks = JSON.parse(tracks)
  } catch(e) {
    return res.status(400).send('Invalid tracks.')
  }

  debug('Writing playlist', filename)

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-disposition': attachment(filename)
  })

  var archive = archiver.create('zip', {store: true})
  .on('error', function(err) {
    debug('archive error', err)
    res.end('Error')
  })
  .on('finish', function() {
    debug('Finished writing', filename)
  })

  archive.pipe(res)

  tracks.forEach(function zipTrack(track) {
    var opts = {
      Bucket: bucket,
      Key: track.key
    };
    archive.append(s3.getObject(opts).createReadStream(), {name: track.filename})
  })
  archive.finalize()
})

function attachment(filename) {
  return "attachment; filename=\"" + filename + '"'
}

var port = process.env.PORT || 5000
app.listen(port, function() {
  debug('Server listening on port', port)
})