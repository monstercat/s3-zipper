var express    = require('express')
var archiver   = require('archiver')
var bodyParser = require('body-parser')
var aws        = require('aws-sdk')
var debug      = require('debug')('zipper')
var uuid       = require('node-uuid').v1
var path       = require('path')

if (!process.env.AWS_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION)
  throw Error('Missing AWS fields')

var bucket = process.env.AWS_BUCKET
var s3 = new aws.S3()

var app = express()
app.use(bodyParser.json())

var map = {}

app.post('/download', function(req, res) {
  var filename = req.body.filename
    , tracks = req.body.tracks

  if (!filename || !tracks)
    return res.status(400).send('Missing fields.')

  try{
    tracks = JSON.parse(tracks)
  } catch(e) {
    return res.status(400).send('Invalid tracks.')
  }

  var obj = {
    filename: filename,
    tracks: tracks
  }

  var id = uuid()
    , url = (req.secure ? 'https://' : 'http://') + path.join(req.headers.host, 'download', id)
  map[id] = obj

  res.status(200).json({
    url: url
  })
})

app.get('/download/:id', function(req, res) {
  if (!map[req.params.id]) {
    return res.status(400).send('No url found.')
  }

  var obj = map[req.params.id]
    , filename = obj.filename
    , tracks = obj.tracks

  debug('Writing playlist', filename)

  var archive = archiver.create('zip', {store: true})
  .on('error', function(err) {
    debug('Archive error', err)
    res.end('Error')
  })
  .on('finish', function() {
    debug('Finished writing', filename)
  })

  tracks.forEach(function zipTrack(track) {
    var opts = {
      Bucket: bucket,
      Key: track.key
    }
    archive.append(s3.getObject(opts).createReadStream(), {name: track.filename})
  })
  archive.finalize()

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-disposition': attachment(filename)
  })
  archive.pipe(res)

  delete map[req.params.id]
})

app.use(function(req, res, next) {
  res.sendStatus(404)
})

function attachment(filename) {
  return "attachment; filename=\"" + filename + '"'
}

var port = process.env.PORT || 5000
app.listen(port, function() {
  debug('Server listening on port', port)
})