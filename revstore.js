const http = require('http')
const express = require('express')
const fs = require('fs')
const cp = require('child_process')

const log_stream = fs.createWriteStream(__dirname + '/revstore_log',{flags:"a"})

function append(req,res){
  var body=""
  req.setEncoding('utf-8')
  req.on('data',chunk => body+=chunk)
  // XXX is this safe for simultaneous incoming requests?
  req.on('end',() => log_stream.write(`${req.url} ${Date.now()} ${JSON.stringify(body)}\n`,"utf-8",() => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(`{"status":"success"}`)
  }))
}

function get(req,res){
  const url = req.url
  // XXX todo: shell-escape URL
  cp.exec(`grep ${url} revstore_log`,{},(err,stdout,stderr) => {
    // TODO: error handling
    res.statusCode = 200
    res.setHeader('Content-Type','text/plain')
    res.end(stdout+stderr)})
}

const server = http.createServer((req, res) => {
  if(req.method == "PATCH"){
    append(req,res)
    return}
  if(req.method == "GET"){
    get(req,res)
    return}
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain')
  res.end('Hello World\n')
})

server.listen(4000,'localhost',() => console.log('listening on localhost:4000'))
