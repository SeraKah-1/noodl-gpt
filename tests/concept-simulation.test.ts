import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseConceptMap,conceptMapPositions} from '../src/shared/conceptMap';
import {parseSimulation,calculateSimulation} from '../src/shared/simulation';
import {validateArtifact,validatePackInput} from '../src/shared/validation';

const map={
 version:1,title:'Gastric regulation',
 concepts:[{id:'gastrin',label:'Gastrin'},{id:'ecl',label:'ECL cell'},{id:'hcl',label:'Acid secretion'}],
 relations:[
  {id:'r1',from:'gastrin',to:'ecl',type:'causes',status:'draft',rationale:'Gastrin can stimulate ECL cells',
   sourceRefs:[{title:'Course slide',anchor:'Slide 4',status:'provided'}]},
  {id:'r2',from:'ecl',to:'hcl',type:'regulates',status:'creator_reviewed',rationale:'Histamine pathway influences parietal cells',
   sourceRefs:[{title:'OpenStax',uri:'https://openstax.org',status:'model_inspected'}]}
 ]
};
const simulation={
 version:1,title:'Linear transport toy model',objective:'Show how a parameter changes a declared output',
 control:{id:'x',label:'Input',unit:'arbitrary unit',min:0,max:10,step:1,default:2},
 output:{label:'Response',unit:'arbitrary unit'},
 model:{kind:'linear',slope:2,intercept:3},
 assumptions:['Simplified linear relationship; not clinical'],
 sources:[{title:'Author supplied model',status:'provided'}],
 expectedCases:[{input:2,expected:7,tolerance:0},{input:5,expected:13,tolerance:0}],
 validity:'Valid only as a model illustration'
};
test('typed concept map round-trips and rejects fabricated or malformed relationships',()=>{
 const parsed=parseConceptMap(JSON.stringify(map));
 assert.equal(parsed.relations[0].type,'causes');
 assert.equal(parsed.relations[0].sourceRefs[0].anchor,'Slide 4');
 assert.equal(conceptMapPositions(parsed.concepts).length,3);
 assert.throws(()=>parseConceptMap(JSON.stringify({...map,relations:[{...map.relations[0],to:'missing'}]})),/missing/);
 assert.throws(()=>parseConceptMap(JSON.stringify({...map,relations:[{...map.relations[0],sourceRefs:[]}]})),/source/);
 assert.throws(()=>parseConceptMap(JSON.stringify({...map,relations:[{...map.relations[0],type:'unknown'}]})),/type/);
 assert.throws(()=>parseConceptMap(JSON.stringify({...map,relations:[{...map.relations[0],
  sourceRefs:[{title:'Untrusted',uri:'javascript:alert(1)',status:'provided'}]}]})),/HTTPS/);
});

test('simulation validates deterministic formula, bounds, fixtures and scientific honesty fields',()=>{
 const parsed=parseSimulation(JSON.stringify(simulation));
 assert.equal(calculateSimulation(parsed.model,2),7);
 assert.equal(calculateSimulation(parsed.model,5),13);
 assert.equal(calculateSimulation({kind:'saturation',maximum:100,halfSaturation:2},2),50);
 assert.throws(()=>parseSimulation(JSON.stringify({...simulation,expectedCases:[{input:5,expected:999,tolerance:0},{input:2,expected:7,tolerance:0}]})),/match/);
 assert.throws(()=>parseSimulation(JSON.stringify({...simulation,assumptions:[]})),/assumptions/);
 assert.throws(()=>parseSimulation(JSON.stringify({...simulation,control:{...simulation.control,step:0}})),/bounds/);
 assert.throws(()=>parseSimulation(JSON.stringify({...simulation,model:{kind:'eval',expression:'alert(1)'}})),/supported/);
});

test('saved bank validation accepts versioned structured artifacts without altering legacy questions',()=>{
 const questions=[{id:'q',type:'FILL_BLANK',text:'Potassium symbol?',difficulty:'Easy',explanation:'K',acceptedAnswers:['K']}];
 const input={title:'Demo',description:'',folder:'',tags:[],questions,artifacts:[
  {id:'map',kind:'concept_map',title:'Map',content:JSON.stringify(map)},
  {id:'sim',kind:'simulation',title:'Sim',content:JSON.stringify(simulation)}
 ]};
 const pack=validatePackInput(input);
 assert.equal(pack.questions[0].text,'Potassium symbol?');
 assert.equal(parseConceptMap(pack.artifacts[0].content).relations.length,2);
 assert.equal(parseSimulation(pack.artifacts[1].content).expectedCases.length,2);
 assert.throws(()=>validateArtifact({id:'bad',kind:'simulation',title:'Bad',content:'<script>alert(1)</script>'}));
});
