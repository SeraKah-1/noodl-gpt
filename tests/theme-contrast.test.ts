import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionColors,colorContrast} from '../src/ui/theme';

test('action foreground is readable across vibrant and pastel accents',()=>{
 for(const accent of ['#4f46e5','#fb7185','#38bdf8','#a855f7','#059669','#d946ef','#44403c']){
  const {onAction}=actionColors(accent,'#fafafa','#172033');
  assert.ok(colorContrast(accent,onAction)>=4.5,accent+' must meet 4.5:1 with text');
 }
});
test('low contrast accent links use readable ink instead',()=>{
 const p=actionColors('#38bdf8','#f0f9ff','#0c4a6e');
 assert.equal(p.actionText,'#0c4a6e');
 assert.equal(actionColors('#4f46e5','#eef2ff','#1e293b').actionText,'#4f46e5');
});
