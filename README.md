# S3 Zipper

A simple web service to take create a streaming zip from a list of provided s3 bucket items.

# Preparing a Stream

POST to `/` with the following JSON:

```
{
  bucket: 's3-bucket-name',
  filename: 'name-of-desired.zip',
  items: [{
    filename: 'desired-name-of-file.example',
    key: 's3-object-key'
  }]
}
```

It will return a JSON string like the following:

```
{
  url: 'http://example.com/idofstream'
}
```

# Downloading Zip Stream

Call the returned URL to starting streaming the zip.

## Running
```
PORT=8080 \
DEBUG='s3-zipper' \
AWS_ACCESS_KEY_ID=... \
AWS_SECRET_ACCESS_KEY=... \
node index.js
```
