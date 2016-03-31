var archiver   = require('archiver')
var assert     = require('assert')
var aws        = require('aws-sdk')
var bodyParser = require('body-parser')
var debug      = require('debug')('s3-zipper')
var express    = require('express')
var path       = require('path')
var uuid       = require('node-uuid').v1
var basicAuth  = require('basic-auth')
var async      = require('async')

assert(process.env.AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID not set.')
assert(process.env.AWS_SECRET_ACCESS_KEY, 'AWS_SECRET_ACCESS_KEY not set.')

var map = {}
var s3 = new aws.S3()
var app = express()
app.set('trust proxy', true)
app.use(bodyParser.json())

app.post('/', auth, function(req, res) {
  var filename = req.body.filename
    , items = req.body.items
    , bucket = req.body.bucket

  if (!filename || !items || !bucket)
    return res.status(400).send('Missing fields.')

  var obj = {
    bucket: bucket,
    filename: filename,
    items: items,
    public: req.body.public
  }

  var id = uuid()
  map[id] = obj

  debug('Created new id %s.', id)
  res.status(200).json({
    id: id,
    url: req.protocol + '://' + [req.headers.host, id].join('/')
  })
})

app.get('/:id', function(req, res, next) {
  var obj = map[req.params.id]
  if (!obj) {
    return res.status(404).send('Resource not found.')
  }
  if (obj.public) {
    return next()
  }
  else {
    return auth(req, res, next)
  }
}, function(req, res) {
  var obj = map[req.params.id]
    , filename = obj.filename
    , items = obj.items
    , bucket = obj.bucket

  delete map[req.params.id]
  debug('Writing %d items to zip %s using bucket %s with id %s',
    Array.isArray(items) ? items.length : 0, filename, bucket, req.params.id)

  checkExisting(items, bucket, function(err, items) {
    if (err) {
      return res.status(500).end()
    }

    if (!items || !items.length) {
      debug('No valid keys found in %j', items)
      return res.status(400).json({message: "No valid items were found."})
    }

    var archive = archiver.create('zip', {store: true})
    .on('error', function(err) {
      debug('Archive error %s', err)
      res.end('Error')
    })
    .on('finish', function() {
      debug('Finished writing zip %s', filename)
    })

    async.forEachOfLimit(items, 4, function downloadAndZip(item, index, cb) {
      var opts = {
        Bucket: bucket,
        Key: item.key
      }
      var aopts = {
        name: item.filename || 'filename' + index
      }

      archive
      .append(s3.getObject(opts).createReadStream(), aopts)
      .on('error', cb)
      .on('entry', function(entry) {
        if (entry && entry.name == aopts.name) {
          cb()
        }
      })

    }, function(err) {
      if (err) {
        debug('Error zipping: %s', err)
      }
      archive.finalize()
    })

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-disposition': 'attachment; filename="' + filename + '"'
    })
    archive.pipe(res)
  })
})

app.use(function(req, res) {
  res.status(404).send()
})

function auth(req, res, next) {
  var pass = process.env.AUTH_PASSWORD
  if (!pass) return next()

  var user = basicAuth(req)
  if (!user || !user.pass || user.pass !== pass)
    return res.send(401)

  next()
}

function checkExisting(items, bucket, done) {
  var existing = []
  async.eachLimit(items, 4, function handleItem(item, cb) {
    var opts = {
      Bucket: bucket,
      Key: item.key
    }
    s3.headObject(opts, function(err, data) {
      if (!err && data) {
        existing.push(item)
      }
      cb()
    })
  }, function(err) {
    done(err, existing)
  })
}

module.exports = app