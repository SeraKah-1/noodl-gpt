import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveFlashSwipe} from '../src/shared/flashcardGesture';

test('a deliberate horizontal drag rates only the two extreme SRS outcomes',()=>{
 assert.equal(resolveFlashSwipe(-100,4,-200),0);
 assert.equal(resolveFlashSwipe(107,8,240),3);
 assert.equal(resolveFlashSwipe(70,0,980),3);
 assert.equal(resolveFlashSwipe(-60,3,-1050),0);
});

test('tap, short drag and vertical reading scroll never create ratings',()=>{
 for(const x of [0,10,30,75,95])assert.equal(resolveFlashSwipe(x,0,0),null);
 assert.equal(resolveFlashSwipe(-102,85,-1000),null);
 assert.equal(resolveFlashSwipe(30,0,1600),null);
 assert.equal(resolveFlashSwipe(-40,32,-1200),null);
 assert.equal(resolveFlashSwipe(-120,0,Number.NaN),null);
 assert.equal(resolveFlashSwipe(Number.POSITIVE_INFINITY,0,0),null);
});
