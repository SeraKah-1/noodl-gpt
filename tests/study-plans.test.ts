import test from 'node:test';
import assert from 'node:assert/strict';
import {bloomAllocation,dailyStudyCalendar,generationBrief} from '../src/shared/studyPlans';

test('Bloom distribution allocates whole questions including small and tied totals',()=>{
 assert.deepEqual(bloomAllocation(3,[50,50,0,0,0,0]),[2,1,0,0,0,0]);
 for(let count=1;count<=100;count++){
  const allocation=bloomAllocation(count,[10,30,30,20,10,0]);
  assert.equal(allocation.reduce((sum,n)=>sum+n,0),count);
  assert.equal(allocation[5],0);
 }
 assert.throws(()=>bloomAllocation(5,[10,30,30,0,0,0]));
 assert.throws(()=>bloomAllocation(1.5,[50,50,0,0,0,0]));
});

test('generation brief keeps instructions and explicitly asks for an unavailable source',()=>{
 const brief=generationBrief(4,[0,50,50,0,0,0],' Modul A ',' Utamakan kasus ');
 assert.match(brief,/2 C2, 2 C3/);
 assert.match(brief,/Sumber belajar: Modul A/);
 assert.match(brief,/melampirkannya/);
 assert.match(brief,/Utamakan kasus$/);
 assert.equal(generationBrief(5,null,'',''),'');
});

test('calendar export starts at the next local occurrence and repeats daily',()=>{
 const now=new Date(2026,11,31,20,15);
 const calendar=dailyStudyCalendar('19:00',now,'test');
 assert.match(calendar,/DTSTART:20270101T190000\r\n/);
 assert.match(calendar,/DURATION:PT30M\r\nRRULE:FREQ=DAILY/);
 assert.match(calendar,/BEGIN:VALARM/);
 assert.match(dailyStudyCalendar('21:05',now,'test'),/DTSTART:20261231T210500/);
 assert.throws(()=>dailyStudyCalendar('24:30',now,'test'));
});
