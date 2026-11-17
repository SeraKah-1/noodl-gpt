import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseComic,comicGuide} from '../src/shared/comic';
import {validateArtifact,validatePackInput} from '../src/shared/validation';
export const draftComic={version:1,status:'draft',brief:{objective:'Test sequence',audience:'Test reader',language:'id',style:'User requested line drawing',userConfirmation:'Test confirmation fixture',confirmed:true},panels:[{id:'p1',title:'First panel',visualDescription:'A square',caption:'A square has four sides.',dialogue:[],alt:'A square'}],sources:[],review:{accuracy:false,sequence:false,text:false,visuals:false,userStyle:false,notes:'Test fixture, not a reviewed educational comic.',issues:['No image yet']}};
const artifact=(comic:unknown)=>({id:'comic1',kind:'comic',title:'Test comic',content:JSON.stringify(comic)});
test('comic storage requires user confirmation and retains structured draft information',()=>{
 const saved=validateArtifact(artifact(draftComic));assert.deepEqual(parseComic(saved.content),draftComic);
 assert.throws(()=>validateArtifact(artifact({...draftComic,brief:{...draftComic.brief,confirmed:false}})));
 assert.throws(()=>validateArtifact(artifact({...draftComic,brief:{...draftComic.brief,userConfirmation:''}})));
 assert.throws(()=>validateArtifact(artifact({...draftComic,panels:[draftComic.panels[0],draftComic.panels[0]]})));
 assert.equal(comicGuide.documentSchema.type,'object');
});
test('reviewed status rejects missing pictures, sources or incomplete checks',()=>{
 assert.throws(()=>parseComic(JSON.stringify({...draftComic,status:'reviewed'})));
 const reviewed={...draftComic,status:'reviewed',panels:[{...draftComic.panels[0],illustrationSvg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8"/></svg>'}],sources:[{label:'Geometry test fixture',reference:'Definition of square in test specification'}],review:{accuracy:true,sequence:true,text:true,visuals:true,userStyle:true,notes:'Synthetic test of the review contract only.',issues:[]}};
 assert.equal(parseComic(JSON.stringify(reviewed)).status,'reviewed');
 for(const change of [{sources:[]},{review:{...reviewed.review,visuals:false}},{review:{...reviewed.review,issues:['Unresolved']}}])assert.throws(()=>parseComic(JSON.stringify({...reviewed,...change})));
});
test('unsafe or remote comic artwork is rejected and existing artifact types remain readable',()=>{
 for(const illustrationSvg of ['<svg><script>alert(1)</script></svg>','<svg onload="alert(1)"></svg>','<svg><image href="https://example.com/x.png"/></svg>','<svg><foreignObject/></svg>','<svg><rect fill="url(https://example.com)"/></svg>'])assert.throws(()=>parseComic(JSON.stringify({...draftComic,panels:[{...draftComic.panels[0],illustrationSvg}]})));
 assert.throws(()=>parseComic(JSON.stringify({...draftComic,panels:[{...draftComic.panels[0],imageData:'https://example.com/a.png'}]})));
 for(const kind of ['material','insight','visualization'])assert.equal(validateArtifact({id:'old',kind,title:'Existing',content:'Existing content'}).content,'Existing content');
 const pack=validatePackInput({title:'Bank',questions:[{id:'q',type:'FILL_BLANK',text:'2+2?',acceptedAnswers:['4'],difficulty:'Easy',explanation:'Four'}],artifacts:[artifact(draftComic)]});assert.deepEqual(parseComic(pack.artifacts[0].content),draftComic);
});
