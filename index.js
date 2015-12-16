var express    = require('express')
var archiver   = require('archiver')
var bodyParser = require('body-parser')
var aws        = require('aws-sdk')
var debug      = require('debug')('zipper')
var uuid       = require('node-uuid').v1
var path       = require('path')

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)
  throw Error('Missing AWS fields')

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
    url: req.protocol + '://' + [req.headers.host, 'download', id].join('/')
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

var port = process.env.PORT || 5000
app.listen(port, function() {
  debug('Server listening on port %d', port)
})