import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './legacy/upstream.css';
import 'katex/dist/katex.min.css';
import './ui/App.css';
class Boundary extends React.Component<React.PropsWithChildren,{error:string}> {state={error:''};static getDerivedStateFromError(e:Error){return {error:e.message}};render(){return this.state.error?<main style={{padding:40}}><h1>Noodl perlu dimuat ulang</h1><p>{this.state.error}</p><button onClick={()=>location.reload()}>Muat ulang</button></main>:this.props.children}}
createRoot(document.getElementById('root')!).render(<Boundary><App/></Boundary>);
if(window===window.parent && 'serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(console.error);
