const http = require('http')
const connect = require('connect')
const passport = require('passport')
const passport_strategy = require('passport-local').Strategy
const body_parser = require('body-parser')
const fs = require('fs')
const cp = require('child_process')

const app = connect()

passport.use(new passport_strategy(
  function(username,password,cb){
    var result = lookup_user(username,password)
    if(!result) cb(null,false)
    else cb(null,result)}))

passport.serializeUser(function(user,done){
  done(null,JSON.stringify(user))})

passport.deserializeUser(function(id,done){
  done(null,JSON.parse(id))})

function lookup_user(username,password){
  if(username!="me" || password!="123") return false
  return {username:"me"}}

const log_stream = fs.createWriteStream(__dirname + '/revstore_log',{flags:"a"})

function append(req,res){
  var body=""
  req.setEncoding('utf-8')
  req.on('data',chunk => body+=chunk)
  req.on('end',() => log_stream.write(`${req.url} ${Date.now()} ${JSON.stringify(body)}\n`,"utf-8",() => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(`{"status":"success"}`)
  }))
}

function get(req,res){
  const url = req.url
  var child = cp.spawn('grep',['^'+url+' ','revstore_log'],{})
  child.on('error',function(e){console.log(e)})
  child.stderr.pipe(process.stderr,{end:false})
  res.statusCode = 200
  res.setHeader('Content-Type','text/plain')
  child.stdout.pipe(res)
}

function list(req,res){
  var child = cp.spawn(__dirname+'/list.sh')
  child.on('error',function(e){console.log(e);res.statusCode=500;res.end('Internal Server Error')})
  child.stderr.pipe(process.stderr,{end:false})
  res.statusCode=200
  res.setHeader('Content-Type','text/plain')
  child.stdout.pipe(res)
}

const authenticate=passport.authenticate('local')

app.use(passport.initialize())

app.use('/login',body_parser.urlencoded({extended:false}))

app.use('/login',(req,resp,next) => {
  if(req.method != "POST")return next()
  authenticate(req,resp,function(){redirect(req,resp)})})

function redirect(req,res,next){
  var redir=req.body&&req.body.redir||'/'
  res.statusCode = 302
  res.setHeader('Location',redir)
  res.end('')
}

app.use('/meta/recents', (req,res,next) => {
  if(req.method != "GET") return next()
  list(req,res)})

app.use((req, res, next) => {
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

const server = http.createServer(app)

server.listen(4000,'localhost',() => console.log('listening on localhost:4000'))
