import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildReviewQueues} from '../src/ui/reviewQueue';
import type {Pack,Question,ReviewEvent} from '../src/shared/types';

const question=(id:string):Question=>({id,type:'TRUE_FALSE',text:'Question '+id,correctBoolean:true,explanation:'Yes',difficulty:'Easy'});
const pack:Pack={id:'pack-1',ownerId:'owner',title:'Study pack',description:'',folder:'',tags:[],artifacts:[],questions:[question('q1'),question('q2'),question('q3')],revision:1,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
const event=(id:string,rating:0|1|2|3,at:string):ReviewEvent=>({id,cardId:'pack-1:'+id,packId:'pack-1',questionId:id,question:question(id),rating,reviewedAt:at});
test('review queue separates untouched, due, and scheduled questions',()=>{
 const now=Date.parse('2026-01-10T00:00:00Z');
 const r=buildReviewQueues([pack],[
  event('q1',0,'2026-01-09T00:00:00Z'),
  event('q2',2,'2026-01-09T23:00:00Z')
 ],now);
 assert.deepEqual(r.newCards.map(x=>x.question.id),['q3']);
 assert.deepEqual(r.due.map(x=>x.question.id),['q1']);
 assert.deepEqual(r.scheduled.map(x=>x.question.id),['q2']);
});
test('review queue excludes deleted banks and does not confuse no reviews with due',()=>{
 const all=buildReviewQueues([pack],[],Date.now());
 assert.equal(all.due.length,0);
 assert.equal(all.newCards.length,3);
 assert.equal(buildReviewQueues([{...pack,deletedAt:'2026-01-01T00:00:00Z'}],[],Date.now()).newCards.length,0);
});
