import React from 'react';
import DMP from 'diff-match-patch';
import './App.css';
import exercises from './exercises.json';
import HistoryBar from 'history-bar';

/* eslint eqeqeq: "off" */

var Babel = require('babel-standalone')

let dmp = new DMP();

function patch_from_a_b(a,b){
  var diff=dmp.diff_main(a,b)
  var patch=dmp.patch_make(a,diff)
  var patch_text=dmp.patch_toText(patch)
  return patch_text}

function zero_state(){
  return(
  {loaded:false
  ,content:null
  ,parsed:null
  ,transformed:null
  ,history:null
  ,readonly:true
  ,history_view_index:null
  ,history_is_replaying:false
  })}

// Event: {type:"string",...other event-specific data}
// (State, Event) -> State
function handle_event(state,e){
  var next=Object.assign({},state)
  switch(e.type){
  case "history-view-rev":
    next.readonly=true
    next.history_view_index=e.history_index
    next.content=history_lookup_content(e.history_index,state.history)
    break
  case "history-view-tip":
    next.readonly=false
    next.history_view_index=null
    next.history_is_replaying=false
    next.content=history_lookup_content(Infinity,state.history)
    break
  case "history-replay":
    next.history_is_replaying=true
    break
  case "history-replay-stop":
    next.history_is_replaying=false
    break
  case "history-load":
    next.readonly = false
    next.history = e.history
    next.content = history_lookup_content(Infinity,e.history)
    break
  case "history-local-extend":
    next.history = state.history.concat(e.history_item)
    next.content = e.content
    break
  default:
    throw new Error('unknown event type: '+e.type)
  }
  if(window.location && window.location.href == 'https://play.inimino.org/'){
    // quick hack for permissions on main site
    next.readonly = true}
  if(next.content !== state.content){
    next.parsed = parse(next.content)
    next.transformed = transform(next.parsed)
  }
  return next
}

function history_lookup_content(index,history){
  var s=""
  history.some((p,i) => {
    var patch = dmp.patch_fromText(p.patch)
    ;[s] = dmp.patch_apply(patch,s)
    return i>=index})
  return s}

function get_history(path){
  return fetch(`/fs${path}`).then(res => res.text())}

/**
 * Interpret leading lines like the following:
 *
 * # HTML
 * # JSX
 * # Markdown
 *
 * etc.
 */
function parse(s){
  var lines,state,ret,re,m,i
  s = do_exercise_replacement(s)
  lines = s.split(/\r\n|\r|\n/g)
  state = {mode:"HTML",buffer:[]}
  ret = {chunks:[]}
  re = /^# (.+)$/
  for(i=0;i<lines.length;i++){
    // eslint-disable-next-line
    if((m = re.exec(lines[i])) && lines[i+1] === ""){
      combine()
      i++
      state.mode = m[1]
      state.buffer = []}
    else{
      state.buffer.push(lines[i])}}
  combine()
  return ret
  function combine(){
    if(!state.mode)return
    // XXX normalizes all newlines to Unix style
    ret.chunks.push({type:state.mode,content:state.buffer.join('\n')})}}

function do_exercise_replacement(s){
  return s.replace(/^# load (.*)\n/,function(a,b){
    //if(!exercises[b]) throw new Error('not found: exercises/'+b)
    if(!exercises[b]) return 'Not found: ' + b
    return exercises[b]+'\n'})}

function transform(parsed){
  var s
  try{s = _transform(parsed)}
  catch(e){s = String(e)}
  return s}

function _transform(parsed){
  var output=
    {html:null
    ,js:[]
    ,css:[]
    }
  //var injected_scripts='<script src=https://unpkg.com/react/dist/react.min.js></script>\n<script src=https://unpkg.com/react-dom/dist/react-dom.min.js></script>'
  var injected_scripts='<script src=/react.js></script><script src=/react-dom.js></script>'
  //injected_scripts += '<script src=react.js></script><script src=react-dom.js></script>'
  parsed.chunks.forEach(chunk => {
    switch(chunk.type){
    case "HTML":
      if(output.html) throw new Error('only one HTML chunk supported')
      output.html = chunk.content
      break
    case "JSX":
      output.js.push(transform_babel(chunk.content))
      break
    case "JavaScript":
      output.js.push(chunk.content)
      break
    default:
      throw new Error("unknown chunk type: "+chunk.type)
      }
    })
  return `${output.html}\n${injected_scripts}\n<script>\n${output.js.join('\n;/**/\n')}\n</script>`
}

function transform_babel(s){
  var opts=
    {highlightCode:false
    ,presets:['react']
    }
  var output
  try{output = Babel.transform(s,opts).code} // returns { code, map, ast }
  catch(e){output = String(e)}
  return output
}

function render_iframe(container,src){
  var scrollPos
  try{scrollPos = container.querySelector('iframe').contentDocument.body.scrollTop}
  catch(e){}
  container.innerHTML=''
  var iframe = container.appendChild(document.createElement('iframe'))
  iframe.srcdoc = src
  iframe.onload=scroll
  function scroll(){
    iframe.contentDocument.body.scrollTop = scrollPos || 0
  }
}

function PlayUI(props){
  var input,timeout,output
  let maximized = window.location.hash == '#max'
  let state = props.state || zero_state()
  let loading = <div className="Play-input">Loading...</div>
  let textarea = <textarea ref={input_ref} onChange={change} className="Play-input" spellCheck="false" disabled={state.readonly}/>
  let content = state==null || state.content==null ? loading : textarea
  function input_ref(el){
    if(!el)return
    input=el
    //input.onkeyup=function(e){alert(e.keyCode)}
    //input.disabled=state.readonly
    //if(input.value == state.content) return
    if(input.value != state.content) input.value=state.content
    //input.value = state.content
    //setTimeout(() => load_iframe(state.content),0)
    setTimeout(() => load_iframe(state.transformed),0)
    }
  function load_iframe(s){
    if(!output)return
    render_iframe(output,s)
  }
  function update(){
    var s=input.value
    var path = window.location.pathname
    var patch_text=patch_from_a_b(state.content,s)
    var req = new Request(`/fs${path}`,{method:'PATCH',body:patch_text})
    fetch(req).then(res => res.text()).then(text => {if(text!='{"status":"success"}')console.log(text)})
    //load_iframe(s)
    emit({type:"history-local-extend",content:s,history_item:{path:path,ts:Date.now(),patch:patch_text}})
  }
  function login(){
    // if logged in, log out
    // otherwise, log in
  }
  function change(){
    clearTimeout(timeout)
    timeout=setTimeout(update,200)}
  function emit(e){
    var next = handle_event(state,e)
    props.onChange(next)}
  if(props.state == null){
    get_history(props.path).then(body => {
      let history = body.split('\n').filter(l => Boolean(l)).map(line => {
        let m = line.match(/^([^ ]*) (\d*) (.*)$/)
        if(!m) throw new Error('cannot read history from '+props.path+' '+line)
        return {path:m[1]
               ,ts:m[2]
               ,patch:JSON.parse(m[3])}})
      emit({type:"history-load",history:history})
    })
  }
  return(
    <div className="App">
      <div className="App-header">
        <div className="user">
          <div className="welcome">Welcome, {state.username||"Guest"}!</div>
          <form className="login" action="login" method="POST">
                <div><input type="email" name="email" placeholder="email@example.com"/>
                     <button onClick={login}>{state.username?"logout":"register/login"}</button>
                </div>
                <div><input type="text" name="username" placeholder="username"/>
                     <input type="password" name="password" placeholder="password"/>
                     <input type="submit" value="login"/>
                </div>
                <aside className="Login-hint">hint</aside>
          </form>
        </div>
        <div className="controls">
          <HistoryBarWithButtons state={state} emit={emit}/>
        </div>
      </div>
      <div className="Play-container">
        {content}
        <div ref={e => output=e} className={"Play-output" + (maximized?' Play-output-maximized':'')}/>
        {/*<div className="Play-output"><pre>{state.transformed}</pre></div>*/}
        {/*<div className="Play-output"><iframe src={"data:text/html,"+state.transformed}/></div>*/}
      </div>
    </div>
  )
}

function HistoryBarWithButtons(props){
  let state=props.state,emit=props.emit
  if(!state || !state.history || state.history.length<2) return <div/>
  let history=state.history,start,end,diff,tss,highlight,svg_el,hb_replay_timeout
  start = history[0].ts
  end = history[history.length-1].ts
  diff=end-start
  tss=history.map(h => h.ts)
  highlight = state.history_view_index==null ? null : tss[state.history_view_index]
  var replaying = state.history_is_replaying
  if(replaying) replay_step()
  return (
    <div className="HistoryBar">
      <HistoryBar onSelectIndex={select_index} selectedIndex={state.history_view_index} history={tss}/>
      <div>
        <button onClick={hb_first} disabled={replaying}>|&lt;</button>
        <button onClick={highlight==null?hb_penultimate:hb_backward} disabled={replaying}>&lt;</button>
        <button onClick={hb_forward} disabled={highlight==null||replaying}>></button>
        <button onClick={hb_reset} disabled={highlight==null||replaying}>>|</button>
        {replaying
        ?<button onClick={hb_replay_stop} disabled={highlight==null}>stop</button>
        :<button onClick={hb_replay} disabled={highlight==null}>replay</button>
        }
      </div>
      {/*
      <div>
        <pre>
          {highlight ? state.history[state.history_view_index].patch : "\n"}
        </pre>
      </div>
      */}
    </div>)
  function hb_first(e){
    emit({type:"history-view-rev"
         ,history_index:0})}
  function hb_penultimate(e){
    emit({type:"history-view-rev"
         ,history_index:state.history.length-2})}
  function hb_backward(e){
    emit({type:"history-view-rev"
         ,history_index:Math.max(0,state.history_view_index-1)})}
  function hb_forward(e){
    emit({type:"history-view-rev"
         ,history_index:Math.min(state.history.length-1,state.history_view_index+1)})}
  function hb_reset(e){
    emit({type:"history-view-tip"})}
  function hb_replay(e){
    emit({type:"history-replay"})}
  function hb_replay_stop(e){
    clearTimeout(hb_replay_timeout)
    emit({type:"history-replay-stop"})}
  function select_index(index){
    if(replaying)return
    emit({type:"history-view-rev",history_index:index})}
  function replay_step(){
    var curr,next,time_diff
    curr = state.history[state.history_view_index]
    next = state.history[state.history_view_index+1]
    if(!next) {hb_reset(); return}
    //time_diff = Math.min(1000, next.ts - curr.ts) // real-time w/o delays
    time_diff = Math.min(1000, (next.ts - curr.ts) / 16)
    hb_replay_timeout=setTimeout(hb_forward,time_diff)
  }
}

export default PlayUI;
