import {spawnSync} from 'node:child_process';
if(process.stdin.isTTY)spawnSync('stty',['-echo'],{stdio:'inherit'});console.log('Ready for credentials on hidden stdin.');let input='';for await(const chunk of process.stdin){input+=chunk;if(input.includes('\n'))break;}
const c=JSON.parse(input);const cwd=process.cwd();
function run(args,env=process.env){const r=spawnSync('git',args,{cwd,env,encoding:'utf8'});if(r.status!==0)throw new Error('Git command failed: '+args[0]);return r.stdout.trim();}
try{run(['init','-b',c.branch||'main']);run(['add','.']);run(['-c','user.name=Noodl Builder','-c','user.email=builder@noodl.local','commit','-m','Build ChatGPT-connected Noodl study workspace']);}catch(e){if(!run(['status','--porcelain'])){}else throw e;}
const remote=c.remote_url;try{run(['remote','add','sites',remote]);}catch{run(['remote','set-url','sites',remote]);}
let success=false;
for(const auth of c.token?['Bearer '+c.token,'Basic '+Buffer.from('x-access-token:'+c.token).toString('base64')]:['']){const env={...process.env};if(auth){env.GIT_CONFIG_COUNT='1';env.GIT_CONFIG_KEY_0='http.extraHeader';env.GIT_CONFIG_VALUE_0='Authorization: '+auth;}try{run(['push','sites','HEAD:refs/heads/'+(c.branch||'main')],env);success=true;break;}catch{}}
if(!success)throw new Error('Source push authentication failed');
console.log(JSON.stringify({commit_sha:run(['rev-parse','HEAD'])}));
