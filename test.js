#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Iron300 Test Suite
// Extracts core logic from index.html and verifies it in Node.js
// Run: node test.js
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const vm = require('vm');

// ── Load the script block from index.html ─────────────────────
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.error('ERROR: Could not find <script> block in index.html'); process.exit(1); }

// Build the wrapper using string concatenation to avoid backtick conflicts
// (the app source uses template literals which would break an outer backtick string).
// Using Function() so const/let (replaced with var) bind to the wrapper scope.
const stubs = [
  'var localStorage = { getItem: function(){ return null; }, setItem: function(){}, removeItem: function(){} };',
  'var document = { getElementById: function(){ return { innerHTML:"", textContent:"", value:"", style:{}, classList:{ add:function(){}, remove:function(){} } }; }, querySelectorAll: function(){ return []; }, querySelector: function(){ return null; }, addEventListener: function(){} };',
  'var window = { addEventListener: function(){} };',
  'var alert = function(){};',
  'var confirm = function(){ return false; };',
  'var setTimeout = function(){ return 0; };',
  'var clearTimeout = function(){};',
  'var setInterval = function(){ return 0; };',
  'var clearInterval = function(){};',
  'var requestAnimationFrame = function(){};',
].join('\n');

const appSrc = scriptMatch[1]
  .replace(/\bconst\b/g, 'var')
  .replace(/\blet\b/g, 'var');

const returnStmt = [
  'return {',
  '  calc1RM: calc1RM,',
  '  roundToPlate: roundToPlate,',
  '  roundToDumbbell: roundToDumbbell,',
  '  roundWeight: roundWeight,',
  '  pct: pct,',
  '  impliedOneRM: impliedOneRM,',
  '  RPE_PERCENTAGES: RPE_PERCENTAGES,',
  '  generateBenchSets: generateBenchSets,',
  '  getDayStructure: getDayStructure,',
  '  ASSISTANCE_LIBRARY: ASSISTANCE_LIBRARY,',
  '  FAIL_PROTOCOLS: FAIL_PROTOCOLS,',
  '  generateOHPSets: generateOHPSets,',
  '  buildBenchWarmups: buildBenchWarmups,',
  '  generateScaledWarmups: generateScaledWarmups,',
  '  calcConsistency: calcConsistency,',
  '  getImplied1RMHistory: getImplied1RMHistory,',
  '  linearRegression: linearRegression,',
  '  projectGoalDate: projectGoalDate,',
  '};',
].join('\n');

const wrapperSrc = stubs + '\n' + appSrc + '\n' + returnStmt;

let appFns;
try {
  // eslint-disable-next-line no-new-func
  appFns = (new Function(wrapperSrc))();
} catch (e) {
  console.error('ERROR: Failed to load app functions:', e.message);
  process.exit(1);
}

const {
  calc1RM,
  roundToPlate,
  roundToDumbbell,
  roundWeight,
  pct,
  impliedOneRM,
  RPE_PERCENTAGES,
  generateBenchSets,
  getDayStructure,
  ASSISTANCE_LIBRARY,
  FAIL_PROTOCOLS,
  generateOHPSets,
  buildBenchWarmups,
  generateScaledWarmups,
  calcConsistency,
  getImplied1RMHistory,
  linearRegression,
  projectGoalDate,
} = appFns;

// ── Test harness ───────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function expect(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(`  FAIL: ${label}\n       expected: ${JSON.stringify(expected)}\n       got:      ${JSON.stringify(actual)}`);
  }
}

function expectClose(label, actual, expected, tol = 0.5) {
  if (Math.abs(actual - expected) <= tol) {
    passed++;
  } else {
    failed++;
    failures.push(`  FAIL: ${label}\n       expected: ~${expected} (±${tol})\n       got:      ${actual}`);
  }
}

function expectTrue(label, value) {
  expect(label, !!value, true);
}

function section(name) {
  const pad = Math.max(2, 50 - name.length);
  console.log(`\n── ${name} ${'─'.repeat(pad)}`);
}

// ════════════════════════════════════════════════════════════════
// 1. calc1RM — Epley formula
// ════════════════════════════════════════════════════════════════
section('calc1RM (Epley formula)');

expect('1RM with 1 rep = weight itself',         calc1RM(225, 1),  225);
expect('1RM: 225 lbs × 5 reps',                  calc1RM(225, 5),  Math.round(225 * (1 + 5/30)));  // 263
expect('1RM: 185 lbs × 3 reps',                  calc1RM(185, 3),  Math.round(185 * (1 + 3/30)));  // 204
expect('1RM: 135 lbs × 10 reps',                 calc1RM(135, 10), Math.round(135 * (1 + 10/30))); // 180
expectTrue('1RM always >= weight',               calc1RM(200, 5) >= 200);

// ════════════════════════════════════════════════════════════════
// 2. roundToPlate
// ════════════════════════════════════════════════════════════════
section('roundToPlate');

// Standard setup: 45 lb bar, 2.5 lb smallest plate → increments of 5
expect('Round 225 → 225 (exact)',                roundToPlate(225, 45, 2.5), 225);
expect('Round 226 → 225 (round down)',           roundToPlate(226, 45, 2.5), 225);
expect('Round 227.5 → 230 (round up)',           roundToPlate(227.5, 45, 2.5), 230);
expect('Round 44 → 45 (below bar = bar)',        roundToPlate(44, 45, 2.5), 45);
expect('Round 0 → 45 (zero = bar)',              roundToPlate(0, 45, 2.5), 45);
expect('Round 95 with 5 lb plates → 95',  roundToPlate(95,  45, 5), 95);  // plates=50, 50/10=5 → 50 → 95 ✓
expect('Round 105 with 5 lb plates → 105', roundToPlate(105, 45, 5), 105); // plates=60, 60/10=6 → 60 → 105 ✓

// ════════════════════════════════════════════════════════════════
// 3. roundToDumbbell
// ════════════════════════════════════════════════════════════════
section('roundToDumbbell');

expect('Round 22 to nearest 2.5 → 22.5',        roundToDumbbell(22, 2.5), 22.5);
expect('Round 20 to nearest 2.5 → 20',          roundToDumbbell(20, 2.5), 20);
expect('Round 1 → min = increment (2.5)',        roundToDumbbell(1, 2.5), 2.5);
expect('Round 47.5 to nearest 5 → 50',          roundToDumbbell(47.5, 5), 50);

// ════════════════════════════════════════════════════════════════
// 4. roundWeight (group-based dispatch)
// ════════════════════════════════════════════════════════════════
section('roundWeight (group dispatch)');

// Shoulders → dumbbell rounding
expect('Shoulders use dumbbell rounding',
  roundWeight(22, 'shoulders', 45, 2.5), roundToDumbbell(22, 2.5));

// Biceps → dumbbell rounding
expect('Biceps use dumbbell rounding',
  roundWeight(22, 'biceps', 45, 2.5), roundToDumbbell(22, 2.5));

// Back → plate rounding
expect('Back uses plate rounding',
  roundWeight(135, 'back', 45, 2.5), roundToPlate(135, 45, 2.5));

// Triceps → plate rounding
expect('Triceps use plate rounding',
  roundWeight(100, 'triceps', 45, 2.5), roundToPlate(100, 45, 2.5));

// Chest → plate rounding
expect('Chest uses plate rounding',
  roundWeight(100, 'chest', 45, 2.5), roundToPlate(100, 45, 2.5));

// ════════════════════════════════════════════════════════════════
// 5. pct — percentage of TM rounded to plate
// ════════════════════════════════════════════════════════════════
section('pct (TM percentage, plate-rounded)');

const TM = 275; // typical training max
const BAR = 45, PLATE = 2.5;

expect('pct(275, 100) = roundToPlate(275)',      pct(TM, 100, BAR, PLATE), roundToPlate(275, BAR, PLATE));
expect('pct(275, 85) back-off ≈ 235',           pct(TM, 85, BAR, PLATE), roundToPlate(275 * 0.85, BAR, PLATE));
expect('pct(275, 74.5) volume ≈ 205',           pct(TM, 74.5, BAR, PLATE), roundToPlate(275 * 0.745, BAR, PLATE));
expect('pct(275, 75) paused ≈ 205',             pct(TM, 75, BAR, PLATE), roundToPlate(275 * 0.75, BAR, PLATE));
expect('pct(275, 60) deload ≈ 165',             pct(TM, 60, BAR, PLATE), roundToPlate(275 * 0.60, BAR, PLATE));
// Result must be a multiple of 5 (barWeight + n*5 where n is integer ≥ 0)
expectTrue('pct result is barWeight + multiple of 5',
  (pct(TM, 85, BAR, PLATE) - BAR) % 5 === 0);

// ════════════════════════════════════════════════════════════════
// 6. impliedOneRM — RPE-based 1RM estimate
// ════════════════════════════════════════════════════════════════
section('impliedOneRM (RPE table)');

// RPE 10 single = 100% → implied 1RM = weight exactly
expect('RPE 10 single: implied 1RM = weight',   impliedOneRM(300, 10), 300);

// RPE 8 single → weight / 0.94
expect('RPE 8: implied 1RM ≈ weight / 0.94',
  impliedOneRM(280, 8), Math.round(280 / 0.94));

// RPE 7 → / 0.91
expect('RPE 7: implied 1RM ≈ weight / 0.91',
  impliedOneRM(260, 7), Math.round(260 / 0.91));

// RPE 9 → / 0.97
expect('RPE 9: implied 1RM ≈ weight / 0.97',
  impliedOneRM(290, 9), Math.round(290 / 0.97));

// RPE 6.5 → / 0.905
expect('RPE 6.5: implied 1RM ≈ weight / 0.905',
  impliedOneRM(250, 6.5), Math.round(250 / 0.905));

// All defined RPE values should return a number
[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].forEach(rpe => {
  expectTrue(`impliedOneRM(250, ${rpe}) is a positive number`,
    impliedOneRM(250, rpe) > 0);
});

// ════════════════════════════════════════════════════════════════
// 7. generateBenchSets — deload logic (week % 5 === 0)
// ════════════════════════════════════════════════════════════════
section('generateBenchSets — deload weeks (week % 5 === 0)');

const deloadWeeks = [5, 10, 15, 20];
const normalWeeks = [1, 2, 3, 4, 6, 7, 8, 9, 11];

deloadWeeks.forEach(w => {
  const result = generateBenchSets('heavy', w, TM, BAR, PLATE);
  expectTrue(`Week ${w} heavy is a deload (label contains 'Deload')`,
    result.label && result.label.toLowerCase().includes('deload'));
});

normalWeeks.forEach(w => {
  const result = generateBenchSets('heavy', w, TM, BAR, PLATE);
  expectTrue(`Week ${w} heavy is NOT a deload`,
    result.label && !result.label.toLowerCase().includes('deload'));
});

// ════════════════════════════════════════════════════════════════
// 8. generateBenchSets — heavy day structure
// ════════════════════════════════════════════════════════════════
section('generateBenchSets — heavy day (normal week)');

const heavy = generateBenchSets('heavy', 1, TM, BAR, PLATE);

expectTrue('Heavy day has sets array',                Array.isArray(heavy.sets));
expect('Heavy day has 5 sets (1 single + 4 back-offs)', heavy.sets.length, 5);

// Single = TM (plate-rounded)
const singleW = roundToPlate(TM, BAR, PLATE);
expect('First set (single) = TM rounded to plate',
  heavy.sets[0].targetWeight, singleW);
expect('First set is 1 rep',                          heavy.sets[0].targetReps, 1);
expectTrue('First set is marked as single',           heavy.sets[0].isSingle);

// Back-offs = 85% of single weight
const backOff = roundToPlate(singleW * 0.85, BAR, PLATE);
expect('Back-off weight = 85% of single, plate-rounded', heavy.sets[1].targetWeight, backOff);
expect('Back-offs are 5 reps',                        heavy.sets[1].targetReps, 5);
expect('All 4 back-offs same weight',                 heavy.sets[4].targetWeight, backOff);

// Back-offs must be lighter than single
expectTrue('Back-offs < single weight',               heavy.sets[1].targetWeight < heavy.sets[0].targetWeight);

expectTrue('Heavy day has warmups',                   Array.isArray(heavy.warmups) && heavy.warmups.length > 0);

// ════════════════════════════════════════════════════════════════
// 9. generateBenchSets — volume day structure
// ════════════════════════════════════════════════════════════════
section('generateBenchSets — volume day (normal week)');

const volume = generateBenchSets('volume', 1, TM, BAR, PLATE);

expectTrue('Volume day has sets array',               Array.isArray(volume.sets));
expect('Volume day has 4 sets',                       volume.sets.length, 4);
expect('Volume day is 6 reps per set',                volume.sets[0].targetReps, 6);

// Volume weight ≈ 74.5% TM
const volExpected = roundToPlate(TM * 0.745, BAR, PLATE);
expect('Volume weight ≈ 74.5% TM',                   volume.sets[0].targetWeight, volExpected);

// All sets same weight
expectTrue('All volume sets same weight',
  volume.sets.every(s => s.targetWeight === volume.sets[0].targetWeight));

// Last set marked for RPE rating
expectTrue('Last volume set has isLastVolumeSet flag', volume.sets[3].isLastVolumeSet);

// ════════════════════════════════════════════════════════════════
// 10. generateBenchSets — paused bench structure
// ════════════════════════════════════════════════════════════════
section('generateBenchSets — paused bench day (normal week)');

const paused = generateBenchSets('paused', 1, TM, BAR, PLATE);

expectTrue('Paused day has sets array',               Array.isArray(paused.sets));
expect('Paused day has 5 sets',                       paused.sets.length, 5);
expect('Paused day is 4 reps per set',                paused.sets[0].targetReps, 4);

// Paused weight = 75% TM
const pausedExpected = roundToPlate(TM * 0.75, BAR, PLATE);
expect('Paused weight = 75% TM',                      paused.sets[0].targetWeight, pausedExpected);

// All sets same weight
expectTrue('All paused sets same weight',
  paused.sets.every(s => s.targetWeight === paused.sets[0].targetWeight));

// ════════════════════════════════════════════════════════════════
// 11. generateBenchSets — deload weights are meaningfully lighter
// ════════════════════════════════════════════════════════════════
section('generateBenchSets — deload weights vs normal');

const normalHeavy  = generateBenchSets('heavy',  1, TM, BAR, PLATE);
const deloadHeavy  = generateBenchSets('heavy',  5, TM, BAR, PLATE);
const normalVolume = generateBenchSets('volume', 1, TM, BAR, PLATE);
const deloadVolume = generateBenchSets('volume', 5, TM, BAR, PLATE);
const normalPaused = generateBenchSets('paused', 1, TM, BAR, PLATE);
const deloadPaused = generateBenchSets('paused', 5, TM, BAR, PLATE);

expectTrue('Deload heavy: first set lighter than normal',
  deloadHeavy.sets[0].targetWeight < normalHeavy.sets[0].targetWeight);
expectTrue('Deload volume: weight lighter than normal',
  deloadVolume.sets[0].targetWeight < normalVolume.sets[0].targetWeight);
expectTrue('Deload paused: weight lighter than normal',
  deloadPaused.sets[0].targetWeight < normalPaused.sets[0].targetWeight);

// ── v3.7 deload heavy structure ──
// Single = 70% TM × 1 rep (RPE 4–5), back-offs = 60% TM × 3 reps × 3 sets.
// (The previous v3.6 layout was Single = 50% × 3 + 3 back-offs at 60% × 3,
// which produced a top set LIGHTER than the back-offs and a "single" that
// wasn't actually a single. Tests below codify the design intent so that
// regression can't return.)
const deload60 = pct(TM, 60, BAR, PLATE);
const deload70 = pct(TM, 70, BAR, PLATE);
expect('Deload heavy: single weight at 70% TM',     deloadHeavy.sets[0].targetWeight, deload70);
expect('Deload heavy: single is 1 rep',             deloadHeavy.sets[0].targetReps, 1);
expect('Deload heavy: back-off weight at 60% TM',   deloadHeavy.sets[1].targetWeight, deload60);
expect('Deload heavy: back-off is 3 reps',          deloadHeavy.sets[1].targetReps, 3);
expect('Deload heavy: total sets is 4',             deloadHeavy.sets.length, 4);

// ── INVARIANTS (design intent — survive future refactors) ──
// On any heavy day (deload or not), the top set must be heavier than
// the back-offs. Catches the v3.6-class inversion bug.
expectTrue('Heavy day INVARIANT (normal): top set ≥ back-offs',
  normalHeavy.sets[0].targetWeight >= normalHeavy.sets[1].targetWeight);
expectTrue('Heavy day INVARIANT (deload): top set ≥ back-offs',
  deloadHeavy.sets[0].targetWeight >= deloadHeavy.sets[1].targetWeight);

// On any heavy day, the set labeled as the top single must be exactly 1 rep
// (or the label must change). Catches the "single labeled but 3 reps" bug.
expectTrue('Heavy day INVARIANT (normal): set labeled "Single" has 1 rep',
  !/single/i.test(normalHeavy.sets[0].label) || normalHeavy.sets[0].targetReps === 1);
expectTrue('Heavy day INVARIANT (deload): set labeled "Single" has 1 rep',
  !/single/i.test(deloadHeavy.sets[0].label) || deloadHeavy.sets[0].targetReps === 1);

// Deload volume: 60% TM
expect('Deload volume: sets at 60% TM',      deloadVolume.sets[0].targetWeight, deload60);

// Deload paused: 55% TM
const deload55 = pct(TM, 55, BAR, PLATE);
expect('Deload paused: sets at 55% TM',      deloadPaused.sets[0].targetWeight, deload55);

// ── Deload <= normal weight invariants for every focus ──
// Catches future regressions where a deload accidentally prescribes a heavier
// load than the build week. Compares the heaviest set on each day.
function maxSetWeight(info) { return Math.max(...info.sets.map(s => s.targetWeight)); }
expectTrue('INVARIANT: deload heavy max ≤ normal heavy max',
  maxSetWeight(deloadHeavy)  <= maxSetWeight(normalHeavy));
expectTrue('INVARIANT: deload volume max ≤ normal volume max',
  maxSetWeight(deloadVolume) <= maxSetWeight(normalVolume));
expectTrue('INVARIANT: deload paused max ≤ normal paused max',
  maxSetWeight(deloadPaused) <= maxSetWeight(normalPaused));

// ── Source-level drift detector for assistance deload (v3.7) ──
// The assistance deload lives in renderToday + logWorkout, both of which
// are runtime-DOM-coupled and not easily called from this Node harness.
// Instead, we grep the source for the two checks that MUST exist together,
// so a future refactor can't silently strip one or both.
//
// We require both:
//   1. Display-side: the assistance render block declares isAssistanceDeload
//      and uses it to scale awDisplayWeight by 0.65.
//   2. Progression-side: the logWorkout assistance block declares
//      isAssistanceDeloadWk and short-circuits with a "Deload — held" note.
const srcText = fs.readFileSync(__dirname + '/index.html', 'utf8');
expectTrue('v3.7 — assistance deload display: isAssistanceDeload declared',
  /const\s+isAssistanceDeload\s*=\s*\(\s*week\s*%\s*5\s*===\s*0\s*\)/.test(srcText));
expectTrue('v3.7 — assistance deload display: 0.65 weight scale',
  /isAssistanceDeload[\s\S]{0,300}?aw\.weight\s*\*\s*0\.65/.test(srcText));
expectTrue('v3.7 — assistance deload display: DELOAD badge rendered',
  /isAssistanceDeload[\s\S]{0,500}?DELOAD/.test(srcText));
expectTrue('v3.7 — assistance deload progression: isAssistanceDeloadWk short-circuit',
  /isAssistanceDeloadWk[\s\S]{0,400}?Deload\s*—\s*held/.test(srcText));
expectTrue('v3.7 — assistance deload progression: forEach early-return present',
  /isAssistanceDeloadWk\)\s*\{[\s\S]{0,500}?return;\s*\/\/\s*continue\s*forEach/.test(srcText));

// ── Source-level drift detector for v3.8 saveSettings safety ──
// v3.8 fixed the silent progression-wipe bug: pressing "Save & Generate
// Program" used to reset d.assistanceWeights to library defaults on every
// save, nuking weeks of progression any time you edited your goal or 1RM.
// The destructive code now lives in restartProgram(), behind a confirm()
// dialog. saveSettings() must be a no-op for assistanceWeights on existing
// data (i.e. when assistanceWeights is already populated).
//
// We can't easily call saveSettings() from this Node harness (it depends on
// document.getElementById for the form fields and showPage/showToast for
// side effects). Instead, we scan the source to lock in the structural
// invariants that prevent regression.
section('v3.8 — saveSettings safety (no silent assistance wipe)');

// Isolate the saveSettings function body for scoped checks.
const ssStart = srcText.indexOf('function saveSettings()');
expectTrue('saveSettings function present', ssStart >= 0);
const ssEnd = srcText.indexOf('function restartProgram(', ssStart);
expectTrue('saveSettings boundary (restartProgram follows)', ssEnd > ssStart);
const ssBody = srcText.slice(ssStart, ssEnd);

// 1. saveSettings must NOT contain an unconditional assistanceWeights = {} wipe.
//    Any occurrence of the wipe inside saveSettings must sit behind an
//    isFirstRun guard. We assert by structure: the wipe line must be
//    preceded (in the body) by an isFirstRun check.
const wipeIdx = ssBody.indexOf('d.assistanceWeights = {}');
if (wipeIdx >= 0) {
  const firstRunIdx = ssBody.indexOf('isFirstRun');
  expectTrue('v3.8 — saveSettings: wipe line is gated by isFirstRun',
    firstRunIdx >= 0 && firstRunIdx < wipeIdx);
} else {
  expectTrue('v3.8 — saveSettings: no wipe line at all (acceptable)', true);
}

// 2. saveSettings must declare an isFirstRun signal derived from the
//    presence of existing assistance weights — the only reliable way to
//    distinguish onboarding from a settings tweak.
expectTrue('v3.8 — saveSettings: isFirstRun derived from assistanceWeights state',
  /isFirstRun\s*=[\s\S]{0,200}?Object\.keys\(d\.assistanceWeights\)\.length/.test(ssBody));

// 3. saveSettings must NOT contain unconditional currentWeek/currentDay/
//    failStreak/ohpRepsPerSet resets — those are progression state, not
//    config, and must only fire on first-run.
//    Strategy: every assignment to those fields inside saveSettings must
//    occur after the isFirstRun gate (i.e. at a body offset > the gate's
//    `if (isFirstRun)` index).
const gateIdx = ssBody.indexOf('if (isFirstRun)');
expectTrue('v3.8 — saveSettings: isFirstRun gate present', gateIdx > 0);
['d.currentWeek = 1', 'd.currentDay = 1', 'd.failStreak = {}', 'd.ohpRepsPerSet = 5'].forEach(stmt => {
  const idx = ssBody.indexOf(stmt);
  if (idx >= 0) {
    expectTrue(`v3.8 — saveSettings: "${stmt}" sits behind isFirstRun gate`, idx > gateIdx);
  }
});

// 4. restartProgram must exist, must use confirm(), must do the destructive
//    reset, and must reseed assistance weights from ASSISTANCE_LIBRARY.
const rpStart = srcText.indexOf('function restartProgram(');
expectTrue('v3.8 — restartProgram function present', rpStart >= 0);
const rpEnd = srcText.indexOf('function resetAll(', rpStart);
expectTrue('v3.8 — restartProgram boundary (resetAll follows)', rpEnd > rpStart);
const rpBody = srcText.slice(rpStart, rpEnd);
expectTrue('v3.8 — restartProgram uses confirm() dialog',
  /confirm\(/.test(rpBody));
expectTrue('v3.8 — restartProgram resets assistanceWeights to {}',
  /d\.assistanceWeights\s*=\s*\{\}/.test(rpBody));
expectTrue('v3.8 — restartProgram reseeds from ASSISTANCE_LIBRARY',
  /Object\.entries\(ASSISTANCE_LIBRARY\)/.test(rpBody));
expectTrue('v3.8 — restartProgram resets currentWeek to 1',
  /d\.currentWeek\s*=\s*1/.test(rpBody));

// 5. The Settings page button HTML must point at saveSettings (not the old
//    "Save & Generate Program" wording) and a separate Restart Program
//    button must exist alongside it.
expectTrue('v3.8 — Settings page: "Save Settings" button wired to saveSettings()',
  /onclick="saveSettings\(\)"[^>]*>\s*Save Settings\s*</.test(srcText));
expectTrue('v3.8 — Settings page: "Restart Program" button wired to restartProgram()',
  /onclick="restartProgram\(\)"[^>]*>\s*Restart Program\s*</.test(srcText));
// The historical label "Save & Generate Program" can appear in source
// comments (it's referenced in the saveSettings docblock as the bug we fixed).
// What matters is no live button uses it.
expectTrue('v3.8 — Settings page: no live button uses old "Save & Generate" label',
  !/onclick="[^"]*"[^>]*>\s*Save\s*&(?:amp;)?\s*Generate\s*Program\s*</.test(srcText));

// ── Source-level drift detectors for v3.10 — Settings 1RM is live ──
// v3.10 fixed the misleading Settings field that showed `d.estimated1RM`
// (a high-water mark that only moves up — could be 30+ lbs above current
// capability). The field now defaults to the live trainingMax-derived 1RM,
// matching the header and Program tab. Editing the field still triggers a
// manual recalibration via saveSettings.
section('v3.10 — Settings 1RM field shows live estimate');

// 1. renderSettings derives the field from trainingMax, not from estimated1RM
//    directly. Match the same formula the header uses: round(TM/0.935/5)*5.
const rsStart = srcText.indexOf('function renderSettings()');
expectTrue('renderSettings function present', rsStart >= 0);
const rsEnd = srcText.indexOf('\nfunction ', rsStart + 1);
const rsBody = srcText.slice(rsStart, rsEnd > rsStart ? rsEnd : rsStart + 5000);

expectTrue('v3.10 — renderSettings derives 1RM from trainingMax',
  /d\.trainingMax\s*\?\s*Math\.round\(\s*d\.trainingMax\s*\/\s*0\.935\s*\/\s*5\s*\)\s*\*\s*5/.test(rsBody));
expectTrue('v3.10 — renderSettings falls back to estimated1RM if no TM',
  /d\.trainingMax\s*\?[\s\S]{0,200}?:\s*d\.estimated1RM/.test(rsBody));
expectTrue('v3.10 — renderSettings sets rmEl.value from the live derivation',
  /rmEl\.value\s*=\s*live1RM/.test(rsBody));
// Anti-regression: the OLD assignment must be gone
expectTrue('v3.10 — old direct estimated1RM assignment removed',
  !/if\s*\(d\.estimated1RM\s*&&\s*rmEl\)\s*rmEl\.value\s*=\s*d\.estimated1RM\s*;/.test(rsBody));

// 2. The Settings page caption explaining the field is in the source
expectTrue('v3.10 — Settings caption explains live estimate + recalibrate behavior',
  /Live estimate from your training max[\s\S]{0,200}?Edit and save to recalibrate/.test(srcText));

// 3. saveSettings still recomputes trainingMax from the entered value
//    (the recalibration mechanism). Already covered by v3.8 detectors but
//    worth re-asserting since v3.10's UX leans on this contract.
const ssStartV10 = srcText.indexOf('function saveSettings()');
const ssEndV10   = srcText.indexOf('function restartProgram(', ssStartV10);
const ssBodyV10  = srcText.slice(ssStartV10, ssEndV10);
expectTrue('v3.10 — saveSettings still computes trainingMax = round(rm * 0.935)',
  /d\.trainingMax\s*=\s*Math\.round\(\s*rm\s*\*\s*0\.935\s*\)/.test(ssBodyV10));

// ── Source-level drift detectors for v3.9 progression logic ──
// v3.9 added: near-miss bucket, near-miss streak counter, wave trigger at 3,
// pump-protocol always +2.5, broadened auto-anchor (counts failed-set weight).
// These detectors lock in the structural invariants in the real code, since
// the simulator-based tests in section 18 are spec-only.
section('v3.9 — source-level drift detectors for progression logic');

// Locate the assistance forEach block (between "// ── ASSISTANCE ──" and the
// closing `});` that's followed by the workout-notes textarea lookup).
const asStart = srcText.indexOf('// ── ASSISTANCE ──');
expectTrue('ASSISTANCE block marker present', asStart >= 0);
const asEnd = srcText.indexOf('const notesEl = document.getElementById(\'workout-notes\')', asStart);
expectTrue('ASSISTANCE block boundary (notesEl follows)', asEnd > asStart);
const asBody = srcText.slice(asStart, asEnd);

// 1. d.nearMissStreak field declared in defaultData
expectTrue('v3.9 — nearMissStreak field in defaultData',
  /nearMissStreak:\s*\{\}/.test(srcText));

// 2. nearMissStreak is initialized in saveSettings first-run AND restartProgram
const ssStart2 = srcText.indexOf('function saveSettings()');
const rpStart2 = srcText.indexOf('function restartProgram(');
const resetEnd = srcText.indexOf('function resetAll(', rpStart2);
const ssBlock = srcText.slice(ssStart2, rpStart2);
const rpBlock = srcText.slice(rpStart2, resetEnd);
expectTrue('v3.9 — saveSettings first-run resets nearMissStreak',
  /d\.nearMissStreak\s*=\s*\{\}/.test(ssBlock));
expectTrue('v3.9 — restartProgram resets nearMissStreak',
  /d\.nearMissStreak\s*=\s*\{\}/.test(rpBlock));

// 3. Pump-protocol always uses +2.5 increment, regardless of group
expectTrue('v3.9 — groupInc override: pump → 2.5',
  /failProtocol\s*===\s*['"]pump['"][\s\S]{0,120}?\?\s*2\.5/.test(asBody));

// 4. Broadened actualMax: counts both Done and Failed set weights
expectTrue('v3.9 — failed-set weight tracked (failedWeights array)',
  /failedWeights\.push/.test(asBody));
expectTrue('v3.9 — actualMax computed over Done OR Failed sets',
  /actualWeights\.concat\(\s*failedWeights\s*\)/.test(asBody));

// 5. Near-miss bucket criteria: failedSetIndices, failedRepDeficits arrays
expectTrue('v3.9 — failedSetIndices tracked',
  /failedSetIndices\.push\(\s*si\s*\)/.test(asBody));
expectTrue('v3.9 — failedRepDeficits tracked',
  /failedRepDeficits\.push/.test(asBody));

// 6. Near-miss criteria: !earlySetFailed && totalDeficit <= 2 && maxDeficit <= 2
expectTrue('v3.9 — near-miss criteria: early-set check',
  /earlySetFailed\s*=\s*failedSetIndices\.some\(\s*i\s*=>\s*i\s*<\s*2\s*\)/.test(asBody));
expectTrue('v3.9 — near-miss criteria: totalDeficit <= 2',
  /totalDeficit\s*<=\s*2/.test(asBody));
expectTrue('v3.9 — near-miss criteria: maxDeficit <= 2',
  /maxDeficit\s*<=\s*2/.test(asBody));

// 7. Wave trigger: nearMissStreak >= 3
expectTrue('v3.9 — wave trigger at nearMissStreak >= 3',
  /d\.nearMissStreak\[exName\]\s*>=\s*3/.test(asBody));

// 8. Wave: bumps weight by groupInc and resets reps to bottom of range
expectTrue('v3.9 — wave: weight + groupInc',
  /aw\.weight\s*\+\s*groupInc/.test(asBody));
expectTrue('v3.9 — wave: reps → bottom of range (repRange[0])',
  /repTarget:\s*exDef\.repRange\[0\]/.test(asBody));

// 9. Wave: streak resets after firing
expectTrue('v3.9 — wave: nearMissStreak reset to 0',
  /d\.nearMissStreak\[exName\]\s*=\s*0/.test(asBody));

// 10. Real-fail path: resets nearMissStreak (this isn't a near-miss session)
const realFailRegion = asBody.slice(asBody.indexOf('Real-fail'));
expectTrue('v3.9 — real-fail path resets nearMissStreak',
  /d\.nearMissStreak\[exName\]\s*=\s*0/.test(realFailRegion));

// 11. Auto-anchor: resets BOTH streaks (leveling up invalidates stuck patterns)
// v3.11: anchor now uses the structural marker (the if-condition) rather than
// the note text, since the note text appears deep inside one of several
// sub-branches now. This is more drift-resistant.
const anchorMatch = asBody.match(/actualMax\s*>\s*aw\.weight\s*&&\s*\(anyDone\s*\|\|\s*anyFail\)\s*\)\s*\{/);
expectTrue('v3.11 — auto-anchor block found (structural)', anchorMatch != null);
const anchorBlockStart = anchorMatch ? anchorMatch.index : 0;
const anchorBlock = asBody.slice(anchorBlockStart, anchorBlockStart + 2500);
expectTrue('v3.9 — auto-anchor: failStreak reset',     /d\.failStreak\[exName\]\s*=\s*0/.test(anchorBlock));
expectTrue('v3.9 — auto-anchor: nearMissStreak reset', /d\.nearMissStreak\[exName\]\s*=\s*0/.test(anchorBlock));

// v3.11 — auto-anchor honors reps achieved at the new weight.
// Drift guard: the auto-anchor must NOT unconditionally set repTarget to range[0]
// before considering reps. The branching shape we want preserved:
//   - decideAutoAnchorOutcome helper exists, OR
//   - the anchor block contains an avgRepsAtMax computation AND a ceiling-promotion path.
expectTrue('v3.11 — auto-anchor reads avgRepsAtMax',
  /avgRepsAtMax/.test(anchorBlock));
expectTrue('v3.11 — auto-anchor has ceiling-promotion branch',
  /actualMax\s*\+\s*groupInc/.test(anchorBlock));
expectTrue('v3.11 — decideAutoAnchorOutcome helper exported',
  /function\s+decideAutoAnchorOutcome\s*\(/.test(srcText));
expectTrue('v3.11 — applyV311AutoAnchorMigration helper exported',
  /function\s+applyV311AutoAnchorMigration\s*\(/.test(srcText));
expectTrue('v3.11 — migration is gated behind d.migrations.v3_11_autoanchor',
  /d\.migrations\.v3_11_autoanchor/.test(srcText));

// 12. Clean-session path: resets BOTH streaks
const cleanIdx = asBody.indexOf('allDone && actualWeights.length > 0');
expectTrue('v3.9 — clean-session block found', cleanIdx >= 0);
const cleanBlock = asBody.slice(cleanIdx, cleanIdx + 200);
expectTrue('v3.9 — clean session: failStreak reset',     /d\.failStreak\[exName\]\s*=\s*0/.test(cleanBlock));
expectTrue('v3.9 — clean session: nearMissStreak reset', /d\.nearMissStreak\[exName\]\s*=\s*0/.test(cleanBlock));

// 13. Migration safety: existing user data without nearMissStreak gets defaulted
expectTrue('v3.9 — runtime guard: nearMissStreak defaulted if missing',
  /if\s*\(!d\.nearMissStreak\)\s*d\.nearMissStreak\s*=\s*\{\}/.test(srcText));

// ════════════════════════════════════════════════════════════════
// 12. TM progression logic (mirrors advanceDay)
// ════════════════════════════════════════════════════════════════
section('TM progression (RPE-driven, mirrors advanceDay)');

// We replicate the exact logic from advanceDay() here

function simulateTMAdvance(currentTM, rpe, nextWeek) {
  let tm = currentTM;
  if (nextWeek % 5 !== 0) { // not a deload week
    if (rpe !== null && rpe !== undefined) {
      if (rpe <= 7)       tm = roundToPlate(tm + 5,   BAR, PLATE);
      else if (rpe <= 8)  tm = roundToPlate(tm + 2.5, BAR, PLATE);
      else if (rpe <= 8.5)  { /* hold */ }
      else if (rpe <= 9)    { /* hold */ }
      else                tm = roundToPlate(tm - 2.5, BAR, PLATE);
    }
  }
  return tm;
}

// RPE ≤7 → +5
expect('RPE 7 → TM + 5 lbs',    simulateTMAdvance(275, 7, 2),   280);
expect('RPE 6 → TM + 5 lbs',    simulateTMAdvance(275, 6, 2),   280);

// RPE 8 → +2.5 (plate-rounded: 275+2.5=277.5 → roundToPlate → 280)
expect('RPE 8 → TM + 2.5, rounded to plate (275 → 280)',
  simulateTMAdvance(275, 8, 2), 280);

// RPE 8.5 → hold
expect('RPE 8.5 → TM holds',    simulateTMAdvance(275, 8.5, 2), 275);

// RPE 9 → hold
expect('RPE 9 → TM holds',      simulateTMAdvance(275, 9, 2),   275);

// RPE 10 → -2.5 (plate-rounded: 275-2.5=272.5 → roundToPlate → 275; rounds back to same)
// Note: subtracting 2.5 from a plate-legal TM always rounds back — effective hold at plate-legal TMs
expect('RPE 10 → roundToPlate(TM-2.5); rounds back to 275 at plate-legal TM',
  simulateTMAdvance(275, 10, 2), 275);

// Deload week → no TM change regardless of RPE
expect('Deload week (5): no TM change regardless of RPE',
  simulateTMAdvance(275, 7, 5), 275);
expect('Deload week (10): no TM change',
  simulateTMAdvance(275, 10, 10), 275);

// Result must still be plate-legal
expectTrue('TM after RPE 7 advance is plate-legal',
  (simulateTMAdvance(275, 7, 2) - BAR) % 5 === 0);
expectTrue('TM after RPE 10 drop is plate-legal',
  (simulateTMAdvance(275, 10, 2) - BAR) % 5 === 0);

// ════════════════════════════════════════════════════════════════
// 13. Fail streak → TM drops 10%
// ════════════════════════════════════════════════════════════════
section('Fail streak (2 consecutive fails → TM drops 10%)');

function simulateFailStreak(currentTM, streak) {
  if (streak >= 2) {
    return roundToPlate(currentTM * 0.90, BAR, PLATE);
  }
  return currentTM;
}

expectTrue('1 fail: no TM drop',       simulateFailStreak(275, 1) === 275);
expectTrue('2 fails: TM drops ~10%',   simulateFailStreak(275, 2) < 275);
expect('2 fails: TM = 90% rounded',    simulateFailStreak(275, 2), roundToPlate(275 * 0.90, BAR, PLATE));
expect('2 fails: result is plate-legal', (simulateFailStreak(275, 2) - BAR) % 5, 0);

// ════════════════════════════════════════════════════════════════
// 14. getDayStructure — assistance exercise verification
// ════════════════════════════════════════════════════════════════
section('getDayStructure — assistance exercises per variant');

// ── 4-day ──
const fourDay = getDayStructure(4);
expect('4-day: 4 days returned',                     fourDay.length, 4);

// Day 1: Heavy bench
const d1 = fourDay[0];
expectTrue('4-day Day 1: heavy bench focus',         d1.benchFocus === 'heavy');
expectTrue('4-day Day 1: has Seated CSR',            d1.assistance.includes('Seated Chest-Supported Row'));
expectTrue('4-day Day 1: has Rear Delt Fly',         d1.assistance.includes('Rear Delt Fly'));
expectTrue('4-day Day 1: has Skull Crusher',         d1.assistance.includes('Skull Crusher'));
expectTrue('4-day Day 1: NO Pec Deck (back/tri day)', !d1.assistance.includes('Pec Deck'));

// Day 2: OHP (v3.5 — was Volume; flipped to match physical week Mon-Heavy / Tue-OHP / Thu-Volume / Sat-Paused)
const d2 = fourDay[1];
expectTrue('4-day Day 2: OHP focus (v3.5)',          d2.benchFocus === 'ohp');
expectTrue('4-day Day 2: NO Hammer Strength Incline (moved to Day 3)', !d2.assistance.includes('Hammer Strength Incline'));
expectTrue('4-day Day 2: NO Pec Deck (Day 4 only)',  !d2.assistance.includes('Pec Deck'));

// Day 3: Volume bench — has Hammer Strength Incline (v3.5 — moved here from Day 2)
const d3 = fourDay[2];
expectTrue('4-day Day 3: Volume focus (v3.5)',       d3.benchFocus === 'volume');
expectTrue('4-day Day 3: has Hammer Strength Incline', d3.assistance.includes('Hammer Strength Incline'));
expectTrue('4-day Day 3: NO Pec Deck (Day 4 only)',  !d3.assistance.includes('Pec Deck'));

// Day 4: Paused bench — has Pec Deck (the v2.6 addition)
const d4 = fourDay[3];
expectTrue('4-day Day 4: paused bench focus',        d4.benchFocus === 'paused');
expectTrue('4-day Day 4: has Pec Deck (v2.6)',       d4.assistance.includes('Pec Deck'));
expectTrue('4-day Day 4: NO Hammer Strength Incline (different days)', !d4.assistance.includes('Hammer Strength Incline'));

// ── 3-day ──
const threeDay = getDayStructure(3);
expect('3-day: 3 days returned',                    threeDay.length, 3);

const tA = threeDay[0]; // Day A: heavy
const tB = threeDay[1]; // Day B: OHP
const tC = threeDay[2]; // Day C: volume

expectTrue('3-day Day A: heavy bench',              tA.benchFocus === 'heavy');
expectTrue('3-day Day B: OHP focus',                tB.benchFocus === 'ohp');
expectTrue('3-day Day B: has Pec Deck',             tB.assistance.includes('Pec Deck'));
expectTrue('3-day Day C: volume bench',             tC.benchFocus === 'volume');
expectTrue('3-day Day C: has Hammer Strength Incline', tC.assistance.includes('Hammer Strength Incline'));

// ── 5-day ──
const fiveDay = getDayStructure(5);
expect('5-day: 5 days returned',                    fiveDay.length, 5);
expectTrue('5-day Day 4: paused bench',             fiveDay[3].benchFocus === 'paused');
expectTrue('5-day Day 4: has Pec Deck',             fiveDay[3].assistance.includes('Pec Deck'));
expectTrue('5-day Day 2: OHP focus (v3.5)',         fiveDay[1].benchFocus === 'ohp');
expectTrue('5-day Day 3: Volume focus (v3.5)',      fiveDay[2].benchFocus === 'volume');
expectTrue('5-day Day 3: has Hammer Strength Incline (v3.5 — moved from Day 2)', fiveDay[2].assistance.includes('Hammer Strength Incline'));
expectTrue('5-day Day 5: OHP focus (unchanged)',    fiveDay[4].benchFocus === 'ohp');

// ── All assistance exercises are in ASSISTANCE_LIBRARY ──
[3, 4, 5].forEach(n => {
  getDayStructure(n).forEach((day, i) => {
    day.assistance.forEach(ex => {
      expectTrue(`${n}-day Day ${i+1}: "${ex}" is in ASSISTANCE_LIBRARY`,
        ex in ASSISTANCE_LIBRARY);
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 15. ASSISTANCE_LIBRARY — spot-checks
// ════════════════════════════════════════════════════════════════
section('ASSISTANCE_LIBRARY — required exercises exist');

const requiredExercises = [
  'Seated Chest-Supported Row', 'Lat Pulldown', 'Close Grip Pulldown', 'Dumbbell Row',
  'Lateral Raise', 'Machine Lateral Raise', 'Rear Delt Fly', 'Face Pull',
  'EZ Bar Curl (Inside Grip)', 'EZ Bar Curl (Outside Grip)', 'Hammer Curl', 'Incline DB Curl',
  'Skull Crusher', 'Tricep Pushdown', 'Overhead Tricep Ext',
  'Hammer Strength Incline', 'Pec Deck',
];

requiredExercises.forEach(ex => {
  expectTrue(`"${ex}" exists in ASSISTANCE_LIBRARY`, ex in ASSISTANCE_LIBRARY);
});

// Each entry has required fields
Object.entries(ASSISTANCE_LIBRARY).forEach(([name, info]) => {
  expectTrue(`${name}: has group`,      typeof info.group === 'string');
  expectTrue(`${name}: has sets`,       typeof info.sets === 'number' && info.sets > 0);
  expectTrue(`${name}: has repRange`,   Array.isArray(info.repRange) && info.repRange.length === 2);
  expectTrue(`${name}: repRange valid`, info.repRange[0] <= info.repRange[1]);
  expectTrue(`${name}: has startWeight`, typeof info.startWeight === 'number' && info.startWeight > 0);
  expectTrue(`${name}: has failProtocol`, ['strength','hypertrophy','pump'].includes(info.failProtocol));
});

// ════════════════════════════════════════════════════════════════
// 16. Warmup sanity checks
// ════════════════════════════════════════════════════════════════
section('buildBenchWarmups — sanity checks');

const warmups = buildBenchWarmups(275, BAR, PLATE, 'heavy');
expectTrue('Warmups is an array',                    Array.isArray(warmups));
expectTrue('At least 2 warmup sets',                 warmups.length >= 2);
// No warmup heavier than working weight
warmups.forEach((w, i) => {
  expectTrue(`Warmup ${i+1} weight <= working weight (275)`, w.weight <= 275);
  expectTrue(`Warmup ${i+1} weight >= bar weight (45)`,      w.weight >= 45);
  expectTrue(`Warmup ${i+1} reps > 0`,                       w.reps > 0);
  expectTrue(`Warmup ${i+1} weight is plate-legal`,
    (w.weight - BAR) % 5 === 0 || w.weight === BAR);
});

// ════════════════════════════════════════════════════════════════
// 17. generateOHPSets — basic structure
// ════════════════════════════════════════════════════════════════
section('generateOHPSets — basic structure');

const ohpNormal = generateOHPSets(1, 135, 5, BAR, PLATE);
expectTrue('OHP: has sets array',                    Array.isArray(ohpNormal.sets));
expectTrue('OHP: has warmups array',                 Array.isArray(ohpNormal.warmups));
expectTrue('OHP normal: at least 3 sets',            ohpNormal.sets.length >= 3);

// Deload week
const ohpDeload = generateOHPSets(5, 135, 5, BAR, PLATE);
expectTrue('OHP deload: is returned object',         typeof ohpDeload === 'object');

// ════════════════════════════════════════════════════════════════
// 18. Assistance progression decision tree (v3.9)
// ════════════════════════════════════════════════════════════════
// Spec of the forEach progression block in logWorkout. Reimplemented
// here until extracted (tracked in Phase 4).
//
// v3.9 expanded the spec:
//   - Auto-anchor up: if actualMax > aw.weight (counting weight on Done OR
//     Failed sets), store actualMax and reset reps to bottom of range.
//     A failed set still proves the user handled the load until rep failure.
//   - Near-miss vs real-fail bucket on `anyFail` sessions:
//       near-miss = failed sets only in last position(s), total deficit ≤2,
//                   no single set missed by >2. Holds without penalty.
//       real-fail = anything else (early-set fail, big deficit). Existing
//                   fail-streak path applies.
//   - Near-miss streak counter, parallel to fail-streak. Increments on
//     near-miss, resets on clean sweep / real-fail / wave.
//   - Wave trigger: 3 consecutive near-miss sessions → bump weight,
//     reset reps to bottom. Increment is +5 for back/chest/triceps,
//     +2.5 for everything else AND ALWAYS +2.5 for pump-protocol
//     exercises (rear delt fly, lateral raise) — pump work needs gentler
//     overload than strength work.
//   - Clean sessions reset BOTH streaks.
// sourceText was historically declared in this section's preamble
// (it's used by the Day 1 ordering check and other source-level scans below).
const sourceText = fs.readFileSync(__dirname + '/index.html', 'utf8');

section('Assistance progression decision tree (v3.9)');

function simulateAssistanceProgression(aw, exDef, summary) {
  // summary: {
  //   anyFail, anyDone, anySkipped, allDone,
  //   actualMax,            // max weight across done OR failed sets
  //   avgReps,              // avg across done sets (clean-session branches)
  //   effortPattern,        // 'easy' | 'ok' | 'hard' (clean-session branches)
  //   priorFailStreak,      // (alias: priorStreak — accepted for backward compat)
  //   priorNearMissStreak,
  //   failedSetIndices,     // 0-based positions of failed sets
  //   failedRepDeficits,    // per-failed-set: repTarget - reps achieved
  // }
  // Returns: { weight, repTarget, note, failStreak, nearMissStreak }
  const protocol = FAIL_PROTOCOLS[exDef.failProtocol] || FAIL_PROTOCOLS.hypertrophy;
  // Group increment: +5 for strength groups, +2.5 otherwise. Pump protocol
  // ALWAYS uses +2.5 regardless of group — light hypertrophy work.
  const groupInc = exDef.failProtocol === 'pump'
    ? 2.5
    : ((exDef.group === 'back' || exDef.group === 'chest' || exDef.group === 'triceps') ? 5 : 2.5);
  const priorFailStreak     = (summary.priorFailStreak     != null) ? summary.priorFailStreak     : (summary.priorStreak || 0);
  const priorNearMissStreak = summary.priorNearMissStreak || 0;

  // ── Auto-anchor up (v3.11 — honor reps achieved) ──
  // Anchor stored weight to the heaviest weight handled, then run the
  // rep-ladder against the reps actually achieved at that weight. Pre-v3.11
  // hard-reset to range[0]; that swallowed rep-ceiling promotions.
  // Summary fields used (all optional, sensible defaults):
  //   actualMax        — max weight across logged sets (required to fire)
  //   avgRepsAtMax     — avg reps across done sets at actualMax
  //                      (falls back to avgReps if absent)
  //   failsAtMax       — count of failed sets at actualMax (default 0)
  //   effortPattern    — 'easy' | 'ok' | 'hard' (default 'ok')
  if (summary.actualMax != null && summary.actualMax > aw.weight && (summary.anyDone || summary.anyFail)) {
    const failsAtMax = summary.failsAtMax || 0;
    const avgRepsAtMax = (summary.avgRepsAtMax != null)
      ? summary.avgRepsAtMax
      : (summary.avgReps != null ? summary.avgReps : 0);
    const effort = summary.effortPattern || 'ok';
    const anchored = roundWeight(summary.actualMax, exDef.group, BAR, PLATE);

    if (failsAtMax > 0 || avgRepsAtMax === 0) {
      return {
        weight: anchored, repTarget: exDef.repRange[0],
        note: 'advanced-lifted-heavier-misses',
        failStreak: 0, nearMissStreak: 0
      };
    }
    if (avgRepsAtMax >= exDef.repRange[1] && effort !== 'hard') {
      return {
        weight: roundWeight(summary.actualMax + groupInc, exDef.group, BAR, PLATE),
        repTarget: exDef.repRange[0],
        note: 'advanced-out-performed-ceiling',
        failStreak: 0, nearMissStreak: 0
      };
    }
    if (avgRepsAtMax >= exDef.repRange[1]) {
      return {
        weight: anchored, repTarget: exDef.repRange[1],
        note: 'advanced-out-performed-hard-ceiling',
        failStreak: 0, nearMissStreak: 0
      };
    }
    if (avgRepsAtMax >= exDef.repRange[0]) {
      const inc = effort === 'easy' ? 2 : (effort === 'hard' ? 0 : 1);
      return {
        weight: anchored,
        repTarget: Math.min(exDef.repRange[1], Math.round(avgRepsAtMax) + inc),
        note: 'advanced-out-performed-mid',
        failStreak: 0, nearMissStreak: 0
      };
    }
    // Below bottom of range — floor at bottom.
    return {
      weight: anchored, repTarget: exDef.repRange[0],
      note: 'advanced-lifted-heavier-low',
      failStreak: 0, nearMissStreak: 0
    };
  }

  // ── All skipped ──
  if (summary.anySkipped && !summary.anyDone && !summary.anyFail) {
    return {
      weight: aw.weight, repTarget: aw.repTarget,
      note: 'held-skipped',
      failStreak: priorFailStreak, nearMissStreak: priorNearMissStreak
    };
  }

  // ── Any fail: near-miss vs real-fail ──
  if (summary.anyFail) {
    const failedIdx = summary.failedSetIndices || [];
    const deficits  = summary.failedRepDeficits || [];
    const earlyFail = failedIdx.some(i => i < 2); // sets 0, 1 are "early" — weight too heavy
    const totalDeficit = deficits.reduce((a, b) => a + b, 0);
    const maxDeficit   = deficits.length ? Math.max.apply(null, deficits) : 0;
    const isNearMiss   = !earlyFail && totalDeficit <= 2 && maxDeficit <= 2;

    if (isNearMiss) {
      const newNearMiss = priorNearMissStreak + 1;
      if (newNearMiss >= 3) {
        // ── WAVE ──
        return {
          weight: roundWeight(aw.weight + groupInc, exDef.group, BAR, PLATE),
          repTarget: exDef.repRange[0],
          note: 'wave-applied',
          failStreak: 0, nearMissStreak: 0
        };
      }
      return {
        weight: aw.weight, repTarget: aw.repTarget,
        note: 'held-near-miss',
        failStreak: 0, nearMissStreak: newNearMiss
      };
    }

    // Real-fail
    const newFailStreak = priorFailStreak + 1;
    if (newFailStreak >= 2) {
      return {
        weight: protocol.newWeight(aw.weight),
        repTarget: protocol.newReps(aw.repTarget, exDef.repRange),
        note: 'fail-protocol-applied',
        failStreak: 0, nearMissStreak: 0
      };
    }
    return {
      weight: aw.weight, repTarget: aw.repTarget,
      note: 'held-first-fail',
      failStreak: newFailStreak, nearMissStreak: 0
    };
  }

  // ── allDone (clean session) ──
  if (summary.allDone) {
    if (summary.avgReps >= aw.repTarget) {
      if (summary.effortPattern === 'hard') {
        return { weight: aw.weight, repTarget: aw.repTarget, note: 'held-hard', failStreak: 0, nearMissStreak: 0 };
      }
      if (summary.avgReps >= exDef.repRange[1]) {
        return {
          weight: roundWeight(aw.weight + groupInc, exDef.group, BAR, PLATE),
          repTarget: exDef.repRange[0],
          note: 'advanced-weight',
          failStreak: 0, nearMissStreak: 0
        };
      }
      if (summary.effortPattern === 'easy') {
        return {
          weight: aw.weight,
          repTarget: Math.min(exDef.repRange[1], aw.repTarget + 2),
          note: 'advanced-2-reps',
          failStreak: 0, nearMissStreak: 0
        };
      }
      return { weight: aw.weight, repTarget: aw.repTarget + 1, note: 'advanced-1-rep', failStreak: 0, nearMissStreak: 0 };
    }
    return { weight: aw.weight, repTarget: aw.repTarget, note: 'held-below-target', failStreak: 0, nearMissStreak: 0 };
  }

  // ── Partial (some done, some skipped, no fails) ──
  return {
    weight: aw.weight, repTarget: aw.repTarget,
    note: 'held-incomplete',
    failStreak: priorFailStreak, nearMissStreak: priorNearMissStreak
  };
}

// Fixtures
const rowDef     = { group: 'back',      sets: 4, repRange: [6, 10],  startWeight: 90, failProtocol: 'strength'    };
const curlDef    = { group: 'biceps',    sets: 4, repRange: [8, 12],  startWeight: 65, failProtocol: 'hypertrophy' };
const lateralDef = { group: 'shoulders', sets: 4, repRange: [10, 15], startWeight: 20, failProtocol: 'pump'        };
// Pump-protocol exercise that happens to be in a strength group (defensive — currently no real
// example, but the override must be group-agnostic).
const pumpStrengthDef = { group: 'back', sets: 4, repRange: [10, 15], startWeight: 50, failProtocol: 'pump'        };

// ── Clean-session branches ──────────────────────────────────────

// All skipped
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 6 }, rowDef,
    { anyFail: false, anyDone: false, anySkipped: true, allDone: false }
  );
  expect('All skipped: weight held', r.weight, 90);
  expect('All skipped: reps held',   r.repTarget, 6);
  expect('All skipped: note',        r.note, 'held-skipped');
}

// Hit target below ceiling, ok effort: +1 rep
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 90, avgReps: 8, effortPattern: 'ok' }
  );
  expect('Hit target below ceiling (ok): +1 rep',     r.repTarget, 9);
  expect('Hit target below ceiling (ok): weight held', r.weight,    90);
  expect('Hit target below ceiling (ok): note',        r.note,      'advanced-1-rep');
}

// Hit target below ceiling, easy effort: +2 reps
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 90, avgReps: 8, effortPattern: 'easy' }
  );
  expect('Hit target below ceiling (easy): +2 reps',     r.repTarget, 10);
  expect('Hit target below ceiling (easy): weight held', r.weight,    90);
}

// Hit target, hard effort: hold
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 90, avgReps: 8, effortPattern: 'hard' }
  );
  expect('Hit target, hard effort: weight held', r.weight,    90);
  expect('Hit target, hard effort: reps held',   r.repTarget, 8);
  expect('Hit target, hard effort: note',        r.note,      'held-hard');
}

// Hit ceiling, back group: +5 lbs, reset reps to bottom
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 10 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 90, avgReps: 10, effortPattern: 'ok' }
  );
  expect('Ceiling hit, back group: +5 lbs',       r.weight,    95);
  expect('Ceiling hit, back group: reps → bottom', r.repTarget, 6);
  expect('Ceiling hit: note',                     r.note,      'advanced-weight');
}

// Hit ceiling, biceps group: +2.5 lbs
{
  const r = simulateAssistanceProgression(
    { weight: 65, repTarget: 12 }, curlDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 65, avgReps: 12, effortPattern: 'ok' }
  );
  expect('Ceiling hit, biceps: +2.5 lbs',       r.weight,    roundWeight(67.5, 'biceps', BAR, PLATE));
  expect('Ceiling hit, biceps: reps → bottom',  r.repTarget, 8);
}

// Below rep target: hold (clean session, didn't hit reps but no failed sets)
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 90, avgReps: 7, effortPattern: 'ok' }
  );
  expect('Below rep target: weight held', r.weight,    90);
  expect('Below rep target: reps held',   r.repTarget, 8);
  expect('Below rep target: note',        r.note,      'held-below-target');
}

// Partial session (some done, some skipped, no fails): hold
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: true, allDone: false }
  );
  expect('Partial (no fail): weight held', r.weight, 90);
  expect('Partial (no fail): note',        r.note,   'held-incomplete');
}

// ── Auto-anchor up (v3.11 — honor reps achieved) ────────────────

// Lifted heavier mid-range (allDone, OK): anchor + repTarget = avgRepsAtMax + 1
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 100, avgRepsAtMax: 8, effortPattern: 'ok' }
  );
  expect('Lifted heavier mid-range (OK): weight anchors',  r.weight,    100);
  expect('Lifted heavier mid-range (OK): repTarget = +1',  r.repTarget, 9);
  expect('Lifted heavier mid-range (OK): note',            r.note,      'advanced-out-performed-mid');
}

// Lifted heavier mid-range, easy effort: +2 reps from avgRepsAtMax
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 100, avgRepsAtMax: 7, effortPattern: 'easy' }
  );
  expect('Lifted heavier mid-range (easy): repTarget = +2', r.repTarget, 9);
  expect('Lifted heavier mid-range (easy): weight anchors', r.weight,    100);
}

// Lifted heavier mid-range, hard effort: +0 reps from avgRepsAtMax (clamp at >= range[0])
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 100, avgRepsAtMax: 8, effortPattern: 'hard' }
  );
  expect('Lifted heavier mid-range (hard): repTarget = avg', r.repTarget, 8);
  expect('Lifted heavier mid-range (hard): weight anchors',  r.weight,    100);
}

// THE BUG BILL CAUGHT: lifted heavier AND hit rep ceiling cleanly →
// must promote one MORE increment, not just anchor + reset to range[0].
// Pre-v3.11 this returned 100 × 6; v3.11 returns 105 × 6.
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 6 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 100, avgRepsAtMax: 10, effortPattern: 'ok' }
  );
  expect('Lifted heavier + ceiling (OK): promoted weight',  r.weight,    105);
  expect('Lifted heavier + ceiling (OK): reps → bottom',    r.repTarget, 6);
  expect('Lifted heavier + ceiling (OK): note',             r.note,      'advanced-out-performed-ceiling');
  expect('Lifted heavier + ceiling (OK): fail-streak reset', r.failStreak,     0);
  expect('Lifted heavier + ceiling (OK): near-miss reset',   r.nearMissStreak, 0);
}

// Lifted heavier + ceiling, easy effort: still promotes (effort != hard)
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 6 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 100, avgRepsAtMax: 10, effortPattern: 'easy' }
  );
  expect('Lifted heavier + ceiling (easy): promoted weight', r.weight,    105);
  expect('Lifted heavier + ceiling (easy): reps → bottom',   r.repTarget, 6);
}

// Lifted heavier + hit ceiling but HARD effort: anchor at top of range, no promote
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 6 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 100, avgRepsAtMax: 10, effortPattern: 'hard' }
  );
  expect('Lifted heavier + ceiling (hard): weight anchors',  r.weight,    100);
  expect('Lifted heavier + ceiling (hard): reps → top',      r.repTarget, 10);
  expect('Lifted heavier + ceiling (hard): note',            r.note,      'advanced-out-performed-hard-ceiling');
}

// Lifted heavier with a fail at the new weight: anchor + bottom of range
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 100, failsAtMax: 1, avgRepsAtMax: 8,
      failedSetIndices: [3], failedRepDeficits: [1] }
  );
  expect('Lifted heavier (fail at max): weight anchors', r.weight,         100);
  expect('Lifted heavier (fail at max): reps → bottom',  r.repTarget,      6);
  expect('Lifted heavier (fail at max): note',           r.note,           'advanced-lifted-heavier-misses');
  expect('Lifted heavier (fail at max): fail-streak reset', r.failStreak,     0);
  expect('Lifted heavier (fail at max): near-miss reset',   r.nearMissStreak, 0);
}

// Lifted heavier, partial session (some skipped, no done at max): anchor + bottom
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 10 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: true, allDone: false,
      actualMax: 105 }
  );
  expect('Lifted heavier (partial): weight anchors', r.weight,    105);
  expect('Lifted heavier (partial): reps → bottom',  r.repTarget, 6);
}

// Sanity check: previously-broken Bill scenario.
// Pre-deload week 4 prescribed at 235 × something, did 240 × 10 across all 4 sets, OK.
// Pre-v3.11 produced 240 × 6. v3.11 must produce 245 × 6.
{
  const r = simulateAssistanceProgression(
    { weight: 235, repTarget: 6 }, rowDef,  // CSR, range [6,10], +5 group inc
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 240, avgRepsAtMax: 10, effortPattern: 'ok' }
  );
  expect("Bill's CSR scenario: weight promoted",      r.weight,    245);
  expect("Bill's CSR scenario: reps to bottom",       r.repTarget, 6);
  expect("Bill's CSR scenario: note (ceiling)",       r.note,      'advanced-out-performed-ceiling');
}

// ── Near-miss bucket detection ──────────────────────────────────

// 4×10 prescribed, did 10/10/10/9 → near-miss
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 0 }
  );
  expect('Near-miss (10/10/10/9): weight held',       r.weight,         200);
  expect('Near-miss (10/10/10/9): reps held',         r.repTarget,      10);
  expect('Near-miss (10/10/10/9): note',              r.note,           'held-near-miss');
  expect('Near-miss (10/10/10/9): streak → 1',        r.nearMissStreak, 1);
  expect('Near-miss (10/10/10/9): fail-streak reset', r.failStreak,     0);
}

// 4×10 prescribed, did 10/10/10/8 → near-miss (borderline, deficit=2)
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [3], failedRepDeficits: [2],
      priorNearMissStreak: 0 }
  );
  expect('Near-miss (10/10/10/8): note',         r.note,           'held-near-miss');
  expect('Near-miss (10/10/10/8): streak → 1',   r.nearMissStreak, 1);
}

// 4×10, did 10/10/9/9 → near-miss (last-two failed, total deficit 2)
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [2, 3], failedRepDeficits: [1, 1],
      priorNearMissStreak: 0 }
  );
  expect('Near-miss (10/10/9/9): note', r.note, 'held-near-miss');
}

// 4×10, did 10/10/10/7 → real-fail (per-set deficit > 2)
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [3], failedRepDeficits: [3],
      priorFailStreak: 0 }
  );
  expect('Real-fail (10/10/10/7, deficit=3): note',          r.note,           'held-first-fail');
  expect('Real-fail (10/10/10/7): fail-streak → 1',          r.failStreak,     1);
  expect('Real-fail (10/10/10/7): near-miss-streak reset',   r.nearMissStreak, 0);
}

// 4×10, did 10/9/10/9 → real-fail (set 2 is "early")
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [1, 3], failedRepDeficits: [1, 1],
      priorFailStreak: 0 }
  );
  expect('Real-fail (10/9/10/9, set-2 fail): note',     r.note,       'held-first-fail');
  expect('Real-fail (10/9/10/9): fail-streak → 1',      r.failStreak, 1);
}

// 4×10, did 10/10/8/8 → real-fail (total deficit 4)
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [2, 3], failedRepDeficits: [2, 2],
      priorFailStreak: 0 }
  );
  expect('Real-fail (10/10/8/8, total=4): note', r.note, 'held-first-fail');
}

// 4×10, did 7/9/10/10 → real-fail (early-set fail)
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [0, 1], failedRepDeficits: [3, 1],
      priorFailStreak: 0 }
  );
  expect('Real-fail (7/9/10/10, set-1 fail): note', r.note, 'held-first-fail');
}

// ── Near-miss streak progression ────────────────────────────────

// First near-miss: streak 0 → 1
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 0 }
  );
  expect('1st near-miss: streak 0→1', r.nearMissStreak, 1);
  expect('1st near-miss: weight held', r.weight, 200);
}

// Second consecutive near-miss: streak 1 → 2
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 1 }
  );
  expect('2nd near-miss: streak 1→2', r.nearMissStreak, 2);
  expect('2nd near-miss: weight held', r.weight, 200);
  expect('2nd near-miss: note', r.note, 'held-near-miss');
}

// Third consecutive near-miss: WAVE FIRES, weight bumps, reps reset, streak resets
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,  // back group → +5
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 200, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 2 }
  );
  expect('Wave (back group): weight +5 → 205',     r.weight,         205);
  expect('Wave: reps → bottom of range',           r.repTarget,      6);
  expect('Wave: note',                             r.note,           'wave-applied');
  expect('Wave: near-miss streak resets',          r.nearMissStreak, 0);
  expect('Wave: fail-streak resets',               r.failStreak,     0);
}

// Wave on biceps (hypertrophy group): +2.5 increment
{
  const r = simulateAssistanceProgression(
    { weight: 65, repTarget: 12 }, curlDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 65, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 2 }
  );
  expect('Wave (biceps group): weight +2.5 → 67.5', r.weight,    roundWeight(67.5, 'biceps', BAR, PLATE));
  expect('Wave (biceps): reps → bottom (8)',        r.repTarget, 8);
}

// Wave on pump-protocol exercise (Rear Delt Fly / Lateral Raise — shoulders): +2.5
{
  const r = simulateAssistanceProgression(
    { weight: 100, repTarget: 15 }, lateralDef,  // shoulders + pump → +2.5
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 100, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 2 }
  );
  expect('Wave (pump): weight +2.5 → 102.5',  r.weight,    roundWeight(102.5, 'shoulders', BAR, PLATE));
  expect('Wave (pump): reps → bottom (10)',   r.repTarget, 10);
}

// Wave on pump exercise that's miscoded into a strength group: STILL +2.5
// (defensive — the pump-protocol override is group-agnostic)
{
  const r = simulateAssistanceProgression(
    { weight: 50, repTarget: 15 }, pumpStrengthDef,  // back + pump → +2.5 (NOT +5)
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 50, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 2 }
  );
  expect('Wave (pump in strength group): still +2.5', r.weight,    roundWeight(52.5, 'back', BAR, PLATE));
  expect('Wave (pump in strength group): note',       r.note,      'wave-applied');
}

// ── Real-fail path (existing, unchanged) ────────────────────────

// First real fail: hold, fail-streak 0→1, near-miss-streak resets
{
  const r = simulateAssistanceProgression(
    { weight: 90, repTarget: 8 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 90, failedSetIndices: [0], failedRepDeficits: [3],
      priorFailStreak: 0, priorNearMissStreak: 2 }
  );
  expect('1st real-fail: weight held',            r.weight,         90);
  expect('1st real-fail: fail-streak → 1',        r.failStreak,     1);
  expect('1st real-fail: near-miss-streak resets', r.nearMissStreak, 0);
  expect('1st real-fail: note',                   r.note,           'held-first-fail');
}

// Second real-fail (strength): protocol — weight ×0.90, reps → bottom
{
  const r = simulateAssistanceProgression(
    { weight: 100, repTarget: 10 }, rowDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 100, failedSetIndices: [0], failedRepDeficits: [3],
      priorFailStreak: 1 }
  );
  expect('2nd real-fail strength: weight × 0.90', r.weight,    90);
  expect('2nd real-fail strength: reps → bottom', r.repTarget, 6);
  expect('2nd real-fail: note',                   r.note,      'fail-protocol-applied');
}

// Second real-fail (hypertrophy): weight held, reps → bottom
{
  const r = simulateAssistanceProgression(
    { weight: 65, repTarget: 12 }, curlDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 65, failedSetIndices: [0], failedRepDeficits: [4],
      priorFailStreak: 1 }
  );
  expect('2nd real-fail hypertrophy: weight held',   r.weight,    65);
  expect('2nd real-fail hypertrophy: reps → bottom', r.repTarget, 8);
}

// Second real-fail (pump): weight held, reps current-1
{
  const r = simulateAssistanceProgression(
    { weight: 20, repTarget: 13 }, lateralDef,
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 20, failedSetIndices: [0], failedRepDeficits: [4],
      priorFailStreak: 1 }
  );
  expect('2nd real-fail pump: weight held',     r.weight,    20);
  expect('2nd real-fail pump: reps → current-1', r.repTarget, 12);
}

// ── Combined edge cases ─────────────────────────────────────────

// Wave fires at streak 3, next session is also near-miss → streak fresh at 1 (new weight)
{
  const r = simulateAssistanceProgression(
    { weight: 205, repTarget: 6 }, rowDef,  // post-wave weight
    { anyFail: true, anyDone: true, anySkipped: false, allDone: false,
      actualMax: 205, failedSetIndices: [3], failedRepDeficits: [1],
      priorNearMissStreak: 0 }  // streak was reset by wave
  );
  expect('Post-wave near-miss: streak fresh → 1', r.nearMissStreak, 1);
  expect('Post-wave near-miss: weight held at new value', r.weight, 205);
}

// Clean sweep mid-near-miss-streak: streak resets
{
  const r = simulateAssistanceProgression(
    { weight: 200, repTarget: 10 }, rowDef,
    { anyFail: false, anyDone: true, anySkipped: false, allDone: true,
      actualMax: 200, avgReps: 10, effortPattern: 'ok',
      priorNearMissStreak: 2 }  // had been close to wave
  );
  expect('Clean sweep mid-near-miss-streak: streak resets', r.nearMissStreak, 0);
  expect('Clean sweep at ceiling: +5 advance', r.weight, 205);
}

// ════════════════════════════════════════════════════════════════
// 19. Day 1 assistance order — Skull Crusher BEFORE EZ Bar Curl (Inside Grip)
// ════════════════════════════════════════════════════════════════
// v3.4: Skull Crusher reordered ahead of EZ Bar Curl (Inside Grip) in all
// Day 1 assistance arrays. Covers 3-day, 4-day, and 5-day program variants.
section('Day 1 assistance order (Skull Crusher before EZ Bar Curl)');

[3, 4, 5].forEach(variant => {
  const struct = getDayStructure(variant);
  const day1 = struct[0].assistance;
  const iSC = day1.indexOf('Skull Crusher');
  const iEZ = day1.indexOf('EZ Bar Curl (Inside Grip)');
  expect(`${variant}-day Day 1 contains Skull Crusher`,          iSC >= 0, true);
  expect(`${variant}-day Day 1 contains EZ Bar Curl (Inside)`,   iEZ >= 0, true);
  expect(`${variant}-day Day 1: Skull Crusher before EZ Bar Curl`, iSC < iEZ, true);
});

// Source-level drift detector: stale order must not reappear anywhere
const staleOrder = `'EZ Bar Curl (Inside Grip)','Skull Crusher'`;
const staleHits  = (sourceText.match(new RegExp(staleOrder.replace(/[()]/g, '\\$&'), 'g')) || []).length;
expect('No stale Day 1 assistance order in source', staleHits, 0);

// ════════════════════════════════════════════════════════════════
// 20. renderToday synchronous pendingStatuses restore (tab-switch bug fix)
// ════════════════════════════════════════════════════════════════
// v3.4: when showPage('today') re-renders the workout DOM, pendingStatuses
// must be applied synchronously afterward — otherwise marked sets appear
// undone and the next click cycles to FAIL instead of DONE.
// Node can't simulate DOM, so this is a source-level drift detector that
// catches accidental removal of the sync restore block during future refactors.
section('renderToday synchronous pendingStatuses restore (Change 3)');

// Isolate the renderToday function body so we only scan inside it.
const rtStart = sourceText.indexOf('function renderToday()');
expect('renderToday function present', rtStart >= 0, true);

// Extract from rtStart to the next top-level function declaration.
// `function propagateWeight(` follows renderToday per current layout.
const rtEndMarker = sourceText.indexOf('function propagateWeight(', rtStart);
expect('renderToday boundary (propagateWeight follows)', rtEndMarker > rtStart, true);
const rtBody = sourceText.slice(rtStart, rtEndMarker);

// 1. The main workout-render path sets el.innerHTML = html;
const hasInnerHTMLAssign = /el\.innerHTML\s*=\s*html\s*;/.test(rtBody);
expect('renderToday sets el.innerHTML = html', hasInnerHTMLAssign, true);

// 2. pendingStatuses iteration appears *after* el.innerHTML = html;
const idxInnerHTML = rtBody.indexOf('el.innerHTML = html');
const idxRestore   = rtBody.indexOf('Object.entries(pendingStatuses)', idxInnerHTML);
expect('pendingStatuses applied after innerHTML = html', idxRestore > idxInnerHTML, true);

// 3. Sync restore precedes the trailing updateHeader() call
const idxUpdateHeader = rtBody.indexOf('updateHeader()', idxInnerHTML);
expect('sync restore runs before updateHeader()', idxRestore < idxUpdateHeader, true);

// 4. DONE / FAIL / SKIP branches all present in the restore block
expect('restore block handles DONE state', /className\s*=\s*['"]set-status-btn done['"]/.test(rtBody.slice(idxRestore)), true);
expect('restore block handles FAIL state', /className\s*=\s*['"]set-status-btn fail['"]/.test(rtBody.slice(idxRestore)), true);
expect('restore block handles SKIP state', /textContent\s*=\s*['"]SKIP['"]/.test(rtBody.slice(idxRestore)), true);

// ════════════════════════════════════════════════════════════════
// 21. OHP swap feature fully removed (Change 4)
// ════════════════════════════════════════════════════════════════
// v3.4: "Do OHP Today Instead" button and its three helpers deleted.
// Only the single localStorage.removeItem('iron300_day_swap') cleanup
// line should remain, to purge stale state on older installs.
section('OHP swap feature removed from source');

function countMatches(pattern) {
  const m = sourceText.match(pattern);
  return m ? m.length : 0;
}

expect('No function swapOHPDay definition',       countMatches(/function\s+swapOHPDay\b/g),       0);
expect('No function getSwapOverride definition',  countMatches(/function\s+getSwapOverride\b/g),  0);
expect('No function clearSwapOverride definition',countMatches(/function\s+clearSwapOverride\b/g),0);

// No call sites
expect('No swapOHPDay() call sites',       countMatches(/\bswapOHPDay\s*\(/g),       0);
expect('No getSwapOverride() call sites',  countMatches(/\bgetSwapOverride\s*\(/g),  0);
expect('No clearSwapOverride() call sites',countMatches(/\bclearSwapOverride\s*\(/g),0);

// iron300_day_swap localStorage key appears exactly once — the cleanup line
expect('iron300_day_swap appears exactly once (cleanup line only)',
  countMatches(/iron300_day_swap/g), 1);

// The single occurrence is a localStorage.removeItem call
expect('Remaining iron300_day_swap is a removeItem cleanup',
  /localStorage\.removeItem\(['"]iron300_day_swap['"]\)/.test(sourceText), true);

// The "Do OHP Today Instead" UI button label must be gone
expect('No "Do OHP Today Instead" button in source',
  countMatches(/Do OHP Today Instead/g), 0);

// ════════════════════════════════════════════════════════════════
// 22. v3.5 — Pec Deck bumped to 4 sets, Pec Deck above Lateral Raise on Day 4
// ════════════════════════════════════════════════════════════════
// v3.5 increased Pec Deck from 3×12-15 to 4×12-15 (Bill noticed under-volume
// chest accessory in his Day 4 sessions) and reordered Day 4 so Pec Deck
// runs immediately after Dumbbell Row, before Lateral Raise / Incline DB Curl.
section('v3.5 — Pec Deck volume + Day 4 ordering');

expect('Pec Deck: 4 sets (v3.5, was 3)',  ASSISTANCE_LIBRARY['Pec Deck'].sets, 4);
expect('Pec Deck: rep range still 12-15', JSON.stringify(ASSISTANCE_LIBRARY['Pec Deck'].repRange), '[12,15]');

[4, 5].forEach(variant => {
  const day4 = getDayStructure(variant)[3].assistance;
  const iPD = day4.indexOf('Pec Deck');
  const iLR = day4.indexOf('Lateral Raise');
  expect(`${variant}-day Day 4: contains Pec Deck`,    iPD >= 0, true);
  expect(`${variant}-day Day 4: contains Lateral Raise`, iLR >= 0, true);
  expect(`${variant}-day Day 4: Pec Deck before Lateral Raise (v3.5)`, iPD < iLR, true);
});

// Source-level drift detector: stale Day 4 ordering must not reappear
const staleDay4 = `'Lateral Raise','Incline DB Curl','Pec Deck'`;
const staleDay4Hits = (sourceText.match(new RegExp(staleDay4.replace(/[()]/g, '\\$&'), 'g')) || []).length;
expect('No stale Day 4 ordering (Pec Deck last) in source', staleDay4Hits, 0);

// ════════════════════════════════════════════════════════════════
// 23. v3.5 — Day 2/3 reorder: Day 2 = OHP, Day 3 = Volume (4-day + 5-day)
// ════════════════════════════════════════════════════════════════
// v3.5 swapped slot 1 and slot 2 in the 4-day and 5-day variants so the
// in-app rotation maps 1:1 to Bill's physical week (Mon-Heavy, Tue-OHP,
// Thu-Volume, Sat-Paused). The 3-day variant (Day A/B/C) is unchanged.
section('v3.5 — Day 2/3 reorder (4-day + 5-day)');

[4, 5].forEach(variant => {
  const struct = getDayStructure(variant);
  expect(`${variant}-day Day 2 label says "OHP"`,    /Day 2 — OHP/.test(struct[1].label), true);
  expect(`${variant}-day Day 3 label says "Volume"`, /Day 3 — Volume/.test(struct[2].label), true);
});

// Source-level drift detector: stale label combinations must not reappear
const staleD2Volume = (sourceText.match(/'Day 2 — Volume Bench/g) || []).length;
const staleD3OHP    = (sourceText.match(/'Day 3 — OHP/g) || []).length;
expect('No stale "Day 2 — Volume Bench" label in source', staleD2Volume, 0);
expect('No stale "Day 3 — OHP" label in source',          staleD3OHP, 0);

// ════════════════════════════════════════════════════════════════
// 24. v3.5 — propagateReps function exists and is wired on rep inputs
// ════════════════════════════════════════════════════════════════
// v3.5 added propagateReps as a mirror of propagateWeight, so editing a
// rep field copies the value down to subsequent (non-readonly) sets in
// the same exercise block. Wired on bench (back-offs only — not the
// heavy single, since reps=1 should not propagate to back-offs at 5),
// OHP, and assistance rep inputs.
section('v3.5 — propagateReps wired on rep inputs');

expect('propagateReps function defined',          /function\s+propagateReps\s*\(/.test(sourceText), true);
expect('propagateReps wired on OHP reps',         /propagateReps\(\s*['"]ohp-r-['"]/.test(sourceText), true);
expect('propagateReps wired on bench reps',       /propagateReps\(\s*['"]bench-r-['"]/.test(sourceText), true);
expect('propagateReps wired on assistance reps',  /propagateReps\(\s*[`'"]ex-/.test(sourceText), true);
// Bench heavy single must NOT propagate reps (single = 1 rep, back-offs = 5)
expect('bench rep propagation guarded by !s.isSingle',
  /!s\.isSingle\s*\?\s*`oninput="propagateReps\('bench-r-'/.test(sourceText), true);

// ════════════════════════════════════════════════════════════════
// 25. v3.6 — Pinned per-slot notes + bottom session-notes retired
// ════════════════════════════════════════════════════════════════
// v3.6 added persistent per-slot reminder notes that survive across
// sessions. The bottom session-notes textarea was retired in the same
// release because Bill confirmed he never used it (notes didn't carry
// forward between workouts). Historical notes still display on the
// History tab from prior workoutLogs entries — only the input UI is gone.
section('v3.6 — pinned notes + bottom session notes retirement');

// Helpers exist
expect('PINNED_NOTES_KEY constant defined',  /const\s+PINNED_NOTES_KEY\s*=\s*['"]iron300_pinned_notes['"]/.test(sourceText), true);
expect('loadPinnedNotes function defined',   /function\s+loadPinnedNotes\s*\(/.test(sourceText), true);
expect('savePinnedNote function defined',    /function\s+savePinnedNote\s*\(/.test(sourceText), true);
expect('pinnedNoteHtml function defined',    /function\s+pinnedNoteHtml\s*\(/.test(sourceText), true);

// All four bench slot keys are wired
expect('bench-heavy-single slot wired',  /pinnedNoteHtml\(\s*['"]bench-heavy-single['"]/.test(sourceText), true);
expect('bench-heavy-backoff slot wired', /pinnedNoteHtml\(\s*['"]bench-heavy-backoff['"]/.test(sourceText), true);
expect('bench-volume slot wired',        /pinnedNoteHtml\(\s*['"]bench-volume['"]/.test(sourceText), true);
expect('bench-paused slot wired',        /pinnedNoteHtml\(\s*['"]bench-paused['"]/.test(sourceText), true);
expect('ohp slot wired',                 /pinnedNoteHtml\(\s*['"]ohp['"]/.test(sourceText), true);
// Assistance: the call uses the exName variable (not a literal)
expect('assistance slot keyed by exName', /pinnedNoteHtml\(\s*exName\s*,/.test(sourceText), true);

// Bottom session-notes textarea is gone
expect('No <textarea id="workout-notes"> in source',
  /<textarea\s+id=["']workout-notes["']/.test(sourceText), false);
expect('No "Session Notes" card title in source',
  /Session Notes <span/.test(sourceText), false);

// History tab still references log.notes for historical display
expect('History tab still reads log.notes for old entries',
  /if\s*\(\s*log\.notes\s*\)/.test(sourceText), true);

// ════════════════════════════════════════════════════════════════
// 26. v3.6 — Legs feature parity (rest timer, last-week ref, propagation)
// ════════════════════════════════════════════════════════════════
section('v3.6 — Legs parity (timer / last-week / propagation)');

// Last-week reference helper
expect('legs_prevRowHtml function defined',
  /function\s+legs_prevRowHtml\s*\(/.test(sourceText), true);
expect('legs_prevRowHtml called for hackSquat',
  /legs_prevRowHtml\(\s*['"]hackSquat['"]/.test(sourceText), true);
expect('legs_prevRowHtml called for legCurl',
  /legs_prevRowHtml\(\s*['"]legCurl['"]/.test(sourceText), true);

// Weight + rep propagation wired on Legs inputs
expect('propagateWeight wired on Hack Squat weight inputs',
  /oninput="propagateWeight\('sq-w-'/.test(sourceText), true);
expect('propagateReps wired on Hack Squat rep inputs',
  /oninput="propagateReps\('sq-r-'/.test(sourceText), true);
expect('propagateWeight wired on Leg Curl weight inputs',
  /oninput="propagateWeight\('curl-w-'/.test(sourceText), true);
expect('propagateReps wired on Leg Curl rep inputs',
  /oninput="propagateReps\('curl-r-'/.test(sourceText), true);

// Rest timer fires from legs toggle handlers — and is guarded so it doesn't
// fire on toggle-off or on 'fail'
function fnBody(name) {
  const s = sourceText.indexOf('function ' + name + '(');
  if (s < 0) return '';
  const e = sourceText.indexOf('\nfunction ', s + 1);
  return sourceText.slice(s, e > 0 ? e : sourceText.length);
}
const hackBody = fnBody('legs_toggleHackStatus');
const curlBody = fnBody('legs_toggleCurlStatus');
expect('legs_toggleHackStatus calls startRestTimer',
  /startRestTimer\(\)/.test(hackBody), true);
expect('legs_toggleHackStatus guards on 0→done transition',
  /!wasDone\s*&&\s*legsSetStatuses\[idx\]\s*===\s*['"]done['"]/.test(hackBody), true);
expect('legs_toggleCurlStatus calls startRestTimer',
  /startRestTimer\(\)/.test(curlBody), true);
expect('legs_toggleCurlStatus guards on 0→done transition',
  /!wasDone\s*&&\s*legsSetStatuses\[idx\]\s*===\s*['"]done['"]/.test(curlBody), true);

// ════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
if (failed === 0) {
  console.log(`\n✅  ALL ${passed} TESTS PASSED\n`);
} else {
  console.log(`\n❌  ${failed} FAILED / ${passed + failed} TOTAL\n`);
  failures.forEach(f => console.log(f));
  console.log('');
  process.exit(1);
}
