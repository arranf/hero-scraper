const express = require('express')
const sslRedirect = require('heroku-ssl-redirect');
const app = express()
let rotationData = require('./services/rotation_service')
let {updateData, updateId} = require('./services/update_service')

app.use(sslRedirect());

// Serve data at root domain
app.get('/', function (req, res) {
  res.send(rotationData());
})

app.get('/v1/rotation', function (req, res) {
  res.send(rotationData());
})

app.get('/v1/update', function (req, res) {
  // console.log(updateData)
  res.send(updateData());
})

app.get('/v1/update/id', function (req, res) {
  res.send({id: updateId()});
})

var port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}`))