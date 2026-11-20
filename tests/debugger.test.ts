import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDebugger,gradeDebugger} from '../src/shared/debugger';
import {validatePackInput} from '../src/shared/validation';

const water={"version":1,"title":"Water cycle error correction","prompt":"One link in this water-cycle diagram is deliberately wrong. Identify and correct the directed relation.","nodes":[{"id":"rain","label":"Rainfall"},{"id":"river","label":"River runoff"},{"id":"ocean","label":"Ocean"}],"edges":[{"id":"e1","from":"rain","to":"river","displayLabel":"evaporates into","correctLabel":"flows into","choices":["evaporates into","flows into","inhibits"],"explanation":"Rainfall can contribute to runoff feeding rivers.","sourceRefs":[{"title":"Author-provided water-cycle notes","status":"provided","anchor":"Section 2"}]},{"id":"e2","from":"river","to":"ocean","displayLabel":"flows into","correctLabel":"flows into","choices":["evaporates into","flows into","inhibits"],"explanation":"Rivers carry water towards seas and oceans in this simplified cycle.","sourceRefs":[{"title":"Author-provided water-cycle notes","status":"provided","anchor":"Section 3"}]}],"limitations":"Simplified directed water-cycle teaching model, not a hydrological prediction."};
const circuit={"version":1,"title":"Basic electric circuit correction","prompt":"Identify the incorrect energy-flow relation in a toy circuit.","nodes":[{"id":"battery","label":"Battery"},{"id":"lamp","label":"Lamp"}],"edges":[{"id":"e1","from":"battery","to":"lamp","displayLabel":"absorbs energy from","correctLabel":"supplies energy to","choices":["absorbs energy from","supplies energy to"],"explanation":"In the described simplified circuit, the battery supplies electrical energy.","sourceRefs":[{"title":"Author classroom circuit diagram","status":"provided"}]}],"limitations":"Simplified ideal circuit only. Not suitable for circuit-safety calculations."};

test('Two different subjects use one debugger model and deterministic grading',()=>{
 const w=parseDebugger(JSON.stringify(water)),c=parseDebugger(JSON.stringify(circuit));
 assert.equal(w.edges.length,2);
 assert.equal(c.nodes.length,2);
 const wrong=gradeDebugger(w,{e1:'evaporates into',e2:'flows into'});
 assert.equal(wrong.correct,1);
 assert.equal(wrong.passed,false);
 const fixed=gradeDebugger(w,{e1:'flows into',e2:'flows into'});
 assert.equal(fixed.correct,2);
 assert.equal(fixed.passed,true);
 assert.equal(gradeDebugger(c,{e1:'supplies energy to'}).passed,true);
});

test('Debugger rejects forged cross-node edges, ambiguous grades, unsafe sources and no-bug scenarios',()=>{
 assert.throws(()=>parseDebugger(JSON.stringify({...water,edges:[{...water.edges[0],from:'unknown'}]})),/existing/);
 assert.throws(()=>parseDebugger(JSON.stringify({...water,edges:[{...water.edges[0],sourceRefs:[]}]})),/source/);
 assert.throws(()=>parseDebugger(JSON.stringify({...water,edges:water.edges.map(e=>({...e,correctLabel:e.displayLabel}))})),/deliberately incorrect/);
 assert.throws(()=>gradeDebugger(parseDebugger(JSON.stringify(water)),{e1:'flows into'}),/exactly/);
 assert.throws(()=>gradeDebugger(parseDebugger(JSON.stringify(water)),{e1:'injected label',e2:'flows into'}),/listed/);
 assert.throws(()=>parseDebugger(JSON.stringify({...circuit,edges:[{...circuit.edges[0],sourceRefs:[{title:'Bad',status:'provided',uri:'javascript:alert(1)'}]}]})),/HTTPS/);
});

test('Saved pack preserves two validated debugger artifacts without affecting ordinary questions',()=>{
 const pack=validatePackInput({title:'Debugger test',questions:[{id:'q',type:'TRUE_FALSE',text:'Is rain wet?',correctBoolean:true,explanation:'Yes',difficulty:'Easy'}],artifacts:[
  {id:'water',kind:'debugger',title:'Water cycle',content:JSON.stringify(water)},
  {id:'circuit',kind:'debugger',title:'Circuit',content:JSON.stringify(circuit)}
 ]});
 assert.equal(pack.artifacts.length,2);
 assert.equal(parseDebugger(pack.artifacts[1].content).title,'Basic electric circuit correction');
 assert.equal(pack.questions[0].text,'Is rain wet?');
});
