import React, { Component } from 'react';
import DMP from 'diff-match-patch';
import logo from './logo.svg';
import './App.css';

let dmp = new DMP();

//fetch('/fs/foo/bar')
//.then(res => res.text(),err => console.log(err))
//.then(body => console.log(body),err => console.log(err))

function get_history(path){
  return fetch(`/fs${path}`).then(res => res.text())}

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {}
  }
  componentDidMount() {
    get_history(this.props.path).then(body => {
      let history = body.split('\n').filter(l => Boolean(l)).map(line => {
        let m = line.match(/^([^ ]*) (\d*) (.*)$/)
        //console.log(m)
        return {path:m[1]
               ,ts:m[2]
               ,patch:JSON.parse(m[3])}})
      var s = ""
      history.forEach(p => {
        var patch = dmp.patch_fromText(p.patch)
        ;[s] = dmp.patch_apply(patch,s)})
      this.setState({content:s})
    })
  }
  render() {
    var timeout,output,input,prev_content=this.state.content
    let loading = <div className="Play-input">Loading...</div>
    let textarea = <textarea ref={input_ref} onChange={change} className="Play-input" disabled/>
    let content = this.state.content==null ? loading : textarea
    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to Play</h2>
        </div>
        <div className="Play-container">
          {content}
          <div ref={e => output=e} className="Play-output"/>
        </div>
      </div>
    );
    function input_ref(el){
      input=el
      input.value=prev_content
      input.disabled=false
      setTimeout(() => load_iframe(prev_content),0)
    }
    function change(e){
      clearTimeout(timeout)
      timeout=setTimeout(update,200)
    }
    function update(){
      var s=input.value
      var diff=dmp.diff_main(prev_content,s)
      var patch=dmp.patch_make(prev_content,diff)
      var patch_text=dmp.patch_toText(patch)
      console.log(diff,patch,patch_text)
      var path = '/foo/bar'
      var req = new Request(`/fs${path}`,{method:'PATCH',body:patch_text})
      console.log(req)
      fetch(req).then(res => res.text()).then(console.log)
      prev_content=s
      load_iframe(s)
    }
    function load_iframe(s){
      var scrollPos
      try{scrollPos = output.querySelector('iframe').contentDocument.body.scrollTop}
      catch(e){}
      output.innerHTML=''
      var iframe = output.appendChild(document.createElement('iframe'))
      //iframe.src = 'data:text/html;charset=utf-8,'+encodeURIComponent(s)
      iframe.srcdoc = s
      iframe.onload=scroll
      function scroll(){
        iframe.contentDocument.body.scrollTop = scrollPos || 0
      }
    }
  }
}

export default App;
