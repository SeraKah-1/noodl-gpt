import assert from 'node:assert/strict';
import {test} from 'node:test';
import {conceptGraph,conceptTerms} from '../src/shared/conceptGraph';
import type {Pack,Question} from '../src/shared/types';
const q=(id:string,name:string,explanation:string):Question=>({id,type:'TRUE_FALSE',text:'Question '+id,correctBoolean:true,explanation,difficulty:'Easy',conceptName:name});
test('concept map labels textual overlap instead of claiming causal links',()=>{
 const bank:Pack={id:'p',ownerId:'owner',title:'Concepts',description:'',folder:'',tags:[],artifacts:[],revision:1,createdAt:'',updatedAt:'',questions:[
  q('a','Acid secretion','Gastrin and histamine influence secretion in the stomach.'),
  q('b','ECL cells','Histamine release and gastrin interact with parietal cells.'),
  q('c','Lung','Respiration supports oxygen exchange in pulmonary tissues.')
 ]};
 const graph=conceptGraph(bank);
 assert.equal(graph.nodes.length,3);
 assert.equal(graph.edges.length,1);
 assert.deepEqual(graph.edges[0].shared,['gastrin','histamine']);
 assert.ok(!('causal' in graph.edges[0]));
});
test('common stop words do not fabricate associations',()=>{
 assert.equal(conceptTerms('Yang dengan karena untuk pada dalam').size,0);
});
