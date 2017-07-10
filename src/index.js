import React from 'react';
import ReactDOM from 'react-dom';
import PlayUI from './App';
import registerServiceWorker from './registerServiceWorker';
import './index.css';

function render(state){
  ReactDOM.render(<PlayUI path={window.location.pathname} state={state} onChange={render}/>, document.getElementById('root'))}

render();

registerServiceWorker();
