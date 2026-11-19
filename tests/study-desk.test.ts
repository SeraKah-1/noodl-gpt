import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement, type ComponentProps} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Home} from '../src/ui/classic/Home';
import {createAttempt} from '../src/shared/engine';
import type {Pack,StudyOptions} from '../src/shared/types';

const options:StudyOptions={mode:'BATCH',shuffle:false,mixed:false,retention:false};
const earlier:Pack={
  id:'one',ownerId:'guest',revision:0,title:'First bank',description:'',folder:'',tags:[],artifacts:[],
  createdAt:'2026-01-01',updatedAt:'2026-01-01',
  questions:[{id:'q',type:'TRUE_FALSE',text:'Question',correctBoolean:true,difficulty:'Easy',explanation:'Explanation'}]
};
const later={...earlier,id:'two',title:'Second bank',updatedAt:'2026-01-02'};
const noop=()=>{};
function render(props:Partial<ComponentProps<typeof Home>>){
  return renderToStaticMarkup(createElement(Home,{
    locale:'en',packs:[earlier,later],attempts:[],selectedId:'',options,busy:false,
    onProbe:noop,onDebugger:noop,onOptions:noop,onStart:noop,onFlash:noop,onResume:noop,onReview:noop,
    onImport:async()=>{},onBrainDump:noop,onCreate:noop,onChat:noop,onExplore:noop,onSelect:noop,...props
  }));
}
test('practice defaults to an available bank and honors an explicit selection',()=>{
  const attempt=createAttempt(earlier,options,earlier.ownerId);
  assert.match(render({}),/id="practice-title">Second bank/);
  assert.match(render({attempts:[attempt]}),/id="practice-title">First bank/);
  assert.match(render({attempts:[attempt],selectedId:later.id}),/id="practice-title">Second bank/);
  const deleted=render({attempts:[attempt],selectedId:earlier.id,packs:[later]});
  assert.match(deleted,/id="practice-title">Second bank/);
  assert.match(deleted,/id="resume-title">First bank/);
});
test('an empty desk offers sources and has no unusable practice controls',()=>{
  const page=render({packs:[]});
  assert.match(page,/Explore public banks/);
  assert.match(page,/Create bank/);
  assert.doesNotMatch(page,/id="practice-title"|class="classic-options"/);
});
