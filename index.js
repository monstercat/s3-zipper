var express    = require('express')
var archiver   = require('archiver')
var bodyParser = require('body-parser')
var aws        = require('aws-sdk')

var s3 = new aws.S3()
var bucket = process.env.AWS_BUCKET

var app        = express()
app.use(bodyParser.json())

app.post('/', function(req, res) {
  var filename = req.body.filename
    , tracks = req.body.tracks
    , userId = req.body.userId

  if (!filename || !tracks || !userId)
    return res.status(404).send('Missing fields.');

  res.writeHead(200, {
    'Content-Type': 'application/zip'
    'Content-disposition': "attachment; filename=#{playlist.name}.zip"
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

app.listen(process.env.PORT || 5000)