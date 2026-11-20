import type {ConceptSource} from './conceptMap';

export type SimulationModel={kind:'linear';slope:number;intercept:number}
 | {kind:'saturation';maximum:number;halfSaturation:number};
export interface SimulationDocument {
 version:1;title:string;objective:string;
 control:{id:string;label:string;unit:string;min:number;max:number;step:number;default:number};
 output:{label:string;unit:string};
 model:SimulationModel;
 assumptions:string[];sources:ConceptSource[];
 expectedCases:{input:number;expected:number;tolerance:number}[];
 validity:string;
}
const object=(x:unknown,n:string):Record<string,any>=>{
 if(!x||typeof x!=='object'||Array.isArray(x))throw new Error(n+' must be an object');
 return x as Record<string,any>;
};
const text=(x:unknown,n:string,max=1000)=>{
 if(typeof x!=='string'||!x.trim()||x.length>max)throw new Error(n+' must be 1..'+max+' characters');
 return x.trim();
};
const num=(x:unknown,n:string)=>{
 if(typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e9)throw new Error('Invalid '+n);
 return x;
};
/** No eval, network, scripts or user-defined JavaScript. All outputs follow a declared deterministic formula. */
export function calculateSimulation(model:SimulationModel,x:number):number {
 if(!Number.isFinite(x))throw new Error('Invalid simulation input');
 const y=model.kind==='linear'?model.slope*x+model.intercept:model.maximum*x/(model.halfSaturation+x);
 if(!Number.isFinite(y))throw new Error('Simulation result is outside defined range');
 return y;
}
export function parseSimulation(raw:string):SimulationDocument{
 let data:unknown;
 try{data=JSON.parse(raw);}catch{throw new Error('Simulation must be valid JSON');}
 const doc=object(data,'simulation');
 if(doc.version!==1)throw new Error('Unsupported simulation version');
 const control=object(doc.control,'control'),out=object(doc.output,'output'),m=object(doc.model,'model');
 const min=num(control.min,'minimum'),max=num(control.max,'maximum'),step=num(control.step,'step'),defaultValue=num(control.default,'default');
 if(min>=max||step<=0||defaultValue<min||defaultValue>max||(max-min)/step>10000)
  throw new Error('Invalid control bounds, step or default');
 const model:SimulationModel=m.kind==='linear'
  ?{kind:'linear',slope:num(m.slope,'slope'),intercept:num(m.intercept,'intercept')}
  :m.kind==='saturation'
   ?{kind:'saturation',maximum:num(m.maximum,'maximum'),halfSaturation:num(m.halfSaturation,'halfSaturation')}
   :(()=>{throw new Error('Only linear or saturation models are currently supported')})();
 if(model.kind==='saturation'&&(min<0||model.maximum<=0||model.halfSaturation<=0))
  throw new Error('Saturation requires nonnegative inputs and positive model parameters');
 if(!Array.isArray(doc.assumptions)||doc.assumptions.length<1||doc.assumptions.length>20)
  throw new Error('Model must explicitly list its assumptions');
 if(!Array.isArray(doc.sources)||doc.sources.length<1||doc.sources.length>12)
  throw new Error('Model must include a source description');
 const sources:ConceptSource[]=doc.sources.map((v:any)=>{
  const src=object(v,'source');
  if(!['provided','model_inspected','unavailable'].includes(src.status))throw new Error('Invalid source status');
  if(src.uri!==undefined&&(!/^https:\/\//i.test(src.uri)||src.uri.length>2000))throw new Error('Use HTTPS source URLs');
  return {title:text(src.title,'source title',300),status:src.status,
   ...(src.anchor===undefined?{}:{anchor:text(src.anchor,'anchor',150)}),
   ...(src.uri===undefined?{}:{uri:src.uri})};
 });
 const valid=doc.expectedCases;
 if(!Array.isArray(valid)||valid.length<2||valid.length>20)throw new Error('At least two expected model test cases are required');
 const expectedCases=valid.map((v,i)=>{
  const c=object(v,'expected case '+i),input=num(c.input,'case input'),
   expected=num(c.expected,'case expected'),tolerance=num(c.tolerance,'case tolerance');
  if(tolerance<0||input<min||input>max)throw new Error('Expected test case outside model domain');
  const computed=calculateSimulation(model,input);
  if(Math.abs(computed-expected)>tolerance+1e-9)throw new Error('Declared expected model output did not match computation');
  return {input,expected,tolerance};
 });
 calculateSimulation(model,min);calculateSimulation(model,max);
 return {version:1,title:text(doc.title,'title',300),objective:text(doc.objective,'objective',1500),
  control:{id:text(control.id,'parameter id',100),label:text(control.label,'parameter label',200),
   unit:text(control.unit,'parameter unit',80),min,max,step,default:defaultValue},
  output:{label:text(out.label,'output label',200),unit:text(out.unit,'output unit',80)},model,
  assumptions:doc.assumptions.map((x:unknown)=>text(x,'assumption',1000)),sources,expectedCases,
  validity:text(doc.validity,'validity',1600)};
}
