var archiver   = require('archiver')
var assert     = require('assert')
var aws        = require('aws-sdk')
var bodyParser = require('body-parser')
var debug      = require('debug')('s3-zipper')
var express    = require('express')
var path       = require('path')
var uuid       = require('node-uuid').v1

assert(process.env.AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID not set.')
assert(process.env.AWS_SECRET_ACCESS_KEY, 'AWS_SECRET_ACCESS_KEY not set.')

var map = {}
var s3 = new aws.S3()
var app = express()
app.set('trust proxy', true)
app.use(bodyParser.json())

app.post('/', function(req, res) {
  var filename = req.body.filename
    , items = req.body.items
    , bucket = req.body.bucket

  if (!filename || !items || !bucket)
    return res.status(400).send('Missing fields.')

  var obj = {
    bucket: bucket,
    filename: filename,
    items: items
  }

  var id = uuid()
  map[id] = obj
  res.status(200).json({
    url: req.protocol + '://' + [req.headers.host, id].join('/')
  })
})

app.get('/:id', function(req, res) {
  if (!map[req.params.id]) {
    return res.status(404).send('Resource not found.')
  }

  var obj = map[req.params.id]
    , filename = obj.filename
    , items = obj.items
    , bucket = obj.bucket

  debug('Writing zip as %s', filename)

  var archive = archiver.create('zip', {store: true})
  .on('error', function(err) {
    debug('Archive error %s', err)
    res.end('Error')
  })
  .on('finish', function() {
    debug('Finished writing zip %s', filename)
  })

  items.forEach(function zipit (item) {
    var opts = {
      Bucket: bucket,
      Key: item.key
    }
    archive.append(s3.getObject(opts).createReadStream(),
      {name: item.filename})
  })
  archive.finalize()

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-disposition': 'attachment; filename="' + filename + '"'
  })
  archive.pipe(res)

  delete map[req.params.id]
})

app.use(function(req, res) {
  res.status(404).send()
})

module.exports = app