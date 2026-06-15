// SHAZAM logic tests — run with:  node tests.mjs
// Extracts the real <script> from index.html and runs it against stubs, so these
// test the SHIPPED code (no duplicated logic). Add a case here before changing logic.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const STUBS = `
const mem={};
global.localStorage={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>mem[k]=String(v),removeItem:k=>delete mem[k]};
const fakeEl=()=>new Proxy({innerHTML:'',textContent:'',className:'',style:{},dataset:{},classList:{add(){},remove(){},toggle(){}}},{get(t,p){return p in t?t[p]:()=>{};},set(t,p,v){t[p]=v;return true;}});
global.document={getElementById:()=>fakeEl(),querySelectorAll:()=>[],createElement:()=>fakeEl(),body:fakeEl(),addEventListener(){}};
global.navigator={vibrate(){}};
global.btoa=s=>Buffer.from(s,'binary').toString('base64');
global.atob=s=>Buffer.from(s,'base64').toString('binary');
global.__fetchImpl=null; global.fetch=(...a)=>global.__fetchImpl(...a);
`;

const TESTS = `
let PASS=0,FAIL=0;
function ok(name,cond){ if(cond){PASS++;console.log('  PASS '+name);} else {FAIL++;console.log('  FAIL '+name);} }
function bench(reps,effort,status='done',w=240){
  selDay=0; startWorkout(); const b=SESSION.ex[0]; b.weight=w; b.effort=effort;
  b.sets=reps.map(r=>({weight:w,reps:r,status:status}));
  for(let i=1;i<SESSION.ex.length;i++)SESSION.ex[i].sets.forEach(s=>s.status='');
  finishWorkout(); return DATA.plan['1_barbellbenchpress'];
}
function fresh(){ DATA=defaultData(); DATA.logs=[]; DATA.weights={}; DATA.plan={}; DATA.failStreak={}; }

// 1. failed set must NOT count toward estimated 1RM
fresh(); bench([6,6,6,6],'ok','fail',225);
ok('failed bench excluded from 1RM', lastBenchEst()===0);
fresh(); bench([5,5,5,5],'ok','done',230);
ok('completed bench counts toward 1RM', lastBenchEst()===calc1RM(230,5));

// 2. partial session (fewer sets, no fail) = hold, not a stall
fresh(); selDay=0; startWorkout(); let b=SESSION.ex[0]; b.weight=235;
b.sets=[{weight:235,reps:5,status:'done'},{weight:235,reps:5,status:'done'},{weight:235,reps:'',status:''}];
for(let i=1;i<SESSION.ex.length;i++)SESSION.ex[i].sets.forEach(s=>s.status='');
finishWorkout();
ok('short session holds, no deload', DATA.plan['1_barbellbenchpress'].kind==='hold' && DATA.failStreak['1_barbellbenchpress']===0);

// 3. explicit fail = miss; two in a row = deload
fresh(); let p=bench([3,3,3,3],'ok','fail',235); ok('first fail = retry', p.kind==='retry');
p=bench([3,3,3,3],'ok','fail',235); ok('second fail = deload down', p.kind==='down' && p.w < 235);

// 4. hard effort holds even at top reps
fresh(); p=bench([6,6,6,6],'hard','done',235); ok('top reps + Hard = hardhold (no graduate)', p.kind==='hardhold' && p.w===235);
fresh(); p=bench([6,6,6,6],'ok','done',235);  ok('top reps + OK = up',                       p.kind==='up' && p.w>235);

// 5. blank reps on a green check defaults to bottom of range (lazy check != auto-progress)
fresh(); selDay=0; startWorkout(); setStatus(0,0,'done','full');
ok('blank-done defaults to lo', SESSION.ex[0].sets[0].reps===SESSION.ex[0].lo);

// 6. toggling status does not restamp a set's recorded weight
fresh(); selDay=0; startWorkout(); SESSION.ex[0].weight=225; setStatus(0,0,'done','full');
setWeight(0,205); setStatus(0,0,'fail','full');
ok('toggle does not rewrite logged set weight', SESSION.ex[0].sets[0].weight===225);

// 7. recompute judges history by the log's own snapshot, not the current program
fresh();
DATA.logs=[{date:new Date().toISOString(),name:'Day 1',tag:'x',ex:[
  {n:'Barbell Bench Press',id:'1_barbellbenchpress',effort:'ok',meta:{s:4,lo:3,hi:5,inc:5,t:'barbell'},
   sets:[{weight:200,reps:5,status:'done'},{weight:200,reps:5,status:'done'},{weight:200,reps:5,status:'done'},{weight:200,reps:5,status:'done'}]}
]}];
recomputeProgression();
ok('recompute uses log snapshot (hi=5 -> success)', DATA.plan['1_barbellbenchpress'].kind==='up');

// 8. plate math (canonical cases for his plates)
ok('plate 225 olympic', plateBreakdown(225,45,0.5)==='2\u00d745 /side');
ok('plate 231 uses microplates', /0\.5/.test(plateBreakdown(231,45,0.5)));

// 8b. history-edit inputs are clamped (the back-door garbage path)
fresh();
DATA.logs=[{date:new Date().toISOString(),name:'Day 1',tag:'x',ex:[
  {n:'Barbell Bench Press',id:'1_barbellbenchpress',effort:'ok',meta:{s:4,lo:4,hi:6,inc:1,t:'barbell'},sets:[{weight:225,reps:5,status:'done'}]}]}];
EDIT=0;
editSet(0,0,'weight',2350); ok('editSet clamps weight', DATA.logs[0].ex[0].sets[0].weight===2000);
editSet(0,0,'reps',500);    ok('editSet clamps reps',   DATA.logs[0].ex[0].sets[0].reps===50);
EDIT=null;

// 8c. migration backfills meta onto pre-v1.7 logs (no retroactive reinterpretation later)
localStorage.setItem('shazam_data', JSON.stringify({v:1,settings:{benchGoal:300},weights:{},logs:[
  {date:new Date().toISOString(),name:'Day 1',tag:'x',ex:[{n:'Barbell Bench Press',id:'1_barbellbenchpress',effort:'ok',sets:[{weight:200,reps:5,status:'done'}]}]}]}));
const mig=load();
ok('migrate backfills meta on legacy logs', !!(mig.logs[0].ex[0].meta) && mig.logs[0].ex[0].meta.hi===6 && mig.v===2);

// 9. corrupt localStorage -> last-good restore + LOAD_ERROR
localStorage.setItem('shazam_lastgood', JSON.stringify({v:2,settings:{benchGoal:300},logs:[],weights:{}}));
localStorage.setItem('shazam_data', 'this is not json{{');
LOAD_ERROR=null; const recovered=load();
ok('corrupt load recovers last-good', Array.isArray(recovered.logs));
ok('corrupt load sets a loud LOAD_ERROR', !!LOAD_ERROR);

// 9b. save() must never promote a corrupt blob into last-good
localStorage.setItem('shazam_lastgood', JSON.stringify({v:2,settings:{benchGoal:300},logs:[],weights:{}}));
localStorage.setItem('shazam_data', 'corrupt{{');
DATA=load();                                   // recovers from last-good (KEY is corrupt)
DATA.logs.push({date:new Date().toISOString(),name:'Day 1',tag:'x',ex:[]});
save();
let lgGood=false; try{lgGood=JSON.parse(localStorage.getItem('shazam_lastgood')).logs.length===1;}catch(_){}
ok('save never poisons last-good with a corrupt blob', lgGood);

// 11. loose bench gate: top set at the top earns the jump even if other sets are lower
fresh(); selDay=0; startWorkout(); let lb=SESSION.ex[0]; lb.weight=240;
lb.sets=[{weight:240,reps:6,status:'done'},{weight:240,reps:4,status:'done'},{weight:240,reps:4,status:'done'}];
finishWorkout();
ok('loose gate graduates on top set', DATA.plan['1_barbellbenchpress'].kind==='up' && DATA.plan['1_barbellbenchpress'].w===241);

// 12. light isolations jump by 2.5, not 5
fresh(); selDay=0; startWorkout(); let lr=SESSION.ex[3];   // Cable Lateral Raise
lr.weight=15; lr.sets=[{weight:15,reps:15,status:'done'},{weight:15,reps:15,status:'done'},{weight:15,reps:15,status:'done'}];
finishWorkout();
ok('lateral raise jumps 2.5 lb', DATA.plan['1_cablelateralraise'].w===17.5);

// 13. stagnation flag after ~6 holds with no rep PR
fresh();
for(let k=0;k<6;k++){ selDay=0; startWorkout(); let e=SESSION.ex[2];   // chest press, range 8-12
  e.weight=130; e.sets=[{weight:130,reps:10,status:'done'},{weight:130,reps:10,status:'done'},{weight:130,reps:10,status:'done'}];
  for(let i=0;i<SESSION.ex.length;i++)if(i!==2)SESSION.ex[i].sets.forEach(s=>s.status='');
  finishWorkout(); }
ok('stagnation flagged after 6 no-PR holds', DATA.plan['1_hammerstrengthchestpress'].stale===true);

// 14. a deload session is logged but never moves progression
fresh(); selDay=0; startWorkout(); let nb=SESSION.ex[0]; nb.weight=240;
nb.sets=[{weight:240,reps:6,status:'done'},{weight:240,reps:6,status:'done'},{weight:240,reps:6,status:'done'}];
finishWorkout();
const planNormal=JSON.stringify(DATA.plan['1_barbellbenchpress']);
DATA.settings.deload=true; selDay=0; startWorkout(); let db=SESSION.ex[0];
db.sets.forEach(s=>{s.status='done';s.reps=db.lo;});
finishWorkout(); DATA.settings.deload=false; recomputeProgression();
ok('deload session excluded from progression', JSON.stringify(DATA.plan['1_barbellbenchpress'])===planNormal);

// 15. loose-gate floor: one good set surrounded by a sub-floor set must NOT graduate
fresh(); selDay=0; startWorkout(); let gf=SESSION.ex[0]; gf.weight=235;
gf.sets=[{weight:235,reps:6,status:'done'},{weight:235,reps:5,status:'done'},{weight:235,reps:3,status:'done'}]; // a set at 3 < floor 4
finishWorkout();
ok('gate floor holds when a set drops below the floor', DATA.plan['1_barbellbenchpress'].kind==='hold');
fresh(); selDay=0; startWorkout(); let gp=SESSION.ex[0]; gp.weight=235;
gp.sets=[{weight:235,reps:6,status:'done'},{weight:235,reps:5,status:'done'},{weight:235,reps:4,status:'done'}]; // top 6, all >=4
finishWorkout();
ok('gate floor graduates when top hits hi and all >= floor', DATA.plan['1_barbellbenchpress'].kind==='up');

// 16. Day 4 bench is pegged to ~90% of the Day 1 working weight and tracks no own plan
fresh(); selDay=0; startWorkout(); let d1=SESSION.ex[0]; d1.weight=240;
d1.sets=[{weight:240,reps:6,status:'done'},{weight:240,reps:6,status:'done'},{weight:240,reps:6,status:'done'}];
finishWorkout();                                  // Day 1 working weight = 240
selDay=3; let d4=PROGRAM[3].ex[0];
const sug=suggestWeight(d4);
ok('Day 4 bench pegs to ~90% of Day 1', sug.kind==='peg' && sug.w===roundLoad(240*0.9,d4));
ok('Day 4 bench keeps no own progression plan', !DATA.plan['4_barbellbenchpress']);

// 17. a chronically-Hard lift: held by the override, then correctly trips the stagnation flag
fresh();
for(let k=0;k<6;k++){ selDay=0; startWorkout(); let e=SESSION.ex[2]; e.weight=130; e.effort='hard';   // top reps but always Hard
  e.sets=[{weight:130,reps:12,status:'done'},{weight:130,reps:12,status:'done'},{weight:130,reps:12,status:'done'}];
  for(let i=0;i<SESSION.ex.length;i++)if(i!==2)SESSION.ex[i].sets.forEach(s=>s.status='');
  finishWorkout(); }
const cp=DATA.plan['1_hammerstrengthchestpress'];
ok('always-Hard lift is held, not graduated', cp.kind==='hardhold' && cp.w===130);
ok('always-Hard lift eventually flags stale', cp.stale===true);

// 10. sync refuses to overwrite a non-empty remote with an empty local dataset
(async()=>{
  localStorage.setItem('shz_token','t');localStorage.setItem('shz_user','u');localStorage.setItem('shz_repo','r');
  const remote={logs:[{x:1}]}; const b64=btoa(unescape(encodeURIComponent(JSON.stringify(remote))));
  global.__fetchImpl=async(url,opt)=>({ok:true,json:async()=>({sha:'s',content:b64})});
  DATA=defaultData(); DATA.logs=[]; localStorage.setItem('shazam_data',JSON.stringify(DATA));
  const res=await syncTo(false);
  ok('empty local never overwrites non-empty remote', res===false && DATA.sync && DATA.sync.err==='guard');

  console.log('\\n'+PASS+' passed, '+FAIL+' failed');
  process.exit(FAIL?1:0);
})();
`;

const combined = STUBS + script + TESTS;
const tmp = new URL('./_combined_test.cjs', import.meta.url).pathname;
fs.writeFileSync(tmp, combined);
try { execSync('node ' + tmp, { stdio: 'inherit' }); }
finally { fs.unlinkSync(tmp); }
