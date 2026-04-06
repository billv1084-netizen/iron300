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
  console.log(`\n── ${name} ${'─'.repeat(50 - name.length)}`);
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

// Deload heavy: check sets are at ~50% and ~60% TM (not 100%)
const deload50 = pct(TM, 50, BAR, PLATE);
const deload60 = pct(TM, 60, BAR, PLATE);
expect('Deload heavy: first set at 50% TM',  deloadHeavy.sets[0].targetWeight, deload50);
expect('Deload heavy: back-offs at 60% TM',  deloadHeavy.sets[1].targetWeight, deload60);

// Deload volume: 60% TM
expect('Deload volume: sets at 60% TM',      deloadVolume.sets[0].targetWeight, deload60);

// Deload paused: 55% TM
const deload55 = pct(TM, 55, BAR, PLATE);
expect('Deload paused: sets at 55% TM',      deloadPaused.sets[0].targetWeight, deload55);

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

// Day 2: Volume bench — has Hammer Strength Incline
const d2 = fourDay[1];
expectTrue('4-day Day 2: volume bench focus',        d2.benchFocus === 'volume');
expectTrue('4-day Day 2: has Hammer Strength Incline', d2.assistance.includes('Hammer Strength Incline'));
expectTrue('4-day Day 2: NO Pec Deck (HS Incline day)', !d2.assistance.includes('Pec Deck'));

// Day 3: OHP
const d3 = fourDay[2];
expectTrue('4-day Day 3: OHP focus',                d3.benchFocus === 'ohp');

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
expectTrue('5-day Day 2: has Hammer Strength Incline', fiveDay[1].assistance.includes('Hammer Strength Incline'));

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
// 18. calcConsistency — streak and attendance
// ════════════════════════════════════════════════════════════════
section('calcConsistency — streak and attendance');

function makeLogs(weeks) {
  // weeks: array of week numbers that have at least one non-skipped workout
  return weeks.map(w => ({ week: w, day: 1, date: new Date().toISOString(), exercises: [] }));
}

// No logs → streak 0, attendance 0/0
const noLogs = calcConsistency([], 1);
expect('No logs: streak = 0',        noLogs.streak, 0);
expect('No logs: done = 0',          noLogs.done,   0);
expect('No logs: total = 0',         noLogs.total,  0);

// Perfect 4-week streak (weeks 1-4, currently on week 5)
const perfect4 = calcConsistency(makeLogs([1,2,3,4]), 5);
expect('4-week streak: streak = 4',  perfect4.streak, 4);
expect('4-week streak: done = 4',    perfect4.done,   4);
expect('4-week streak: total = 4',   perfect4.total,  4);

// Missed week 3 — streak breaks (only weeks 4 counted going back from week 5)
const gap = calcConsistency(makeLogs([1,2,4]), 5);
expect('Gap at week 3: streak = 1',  gap.streak, 1); // only week 4 is contiguous
expect('Gap at week 3: done = 3',    gap.done,   3); // 3 weeks done out of 4 elapsed

// Currently in week 3, already trained this week → streak includes current week
const currentIncluded = calcConsistency(makeLogs([1,2,3]), 3);
expect('Trained this week: streak = 3', currentIncluded.streak, 3);

// Currently in week 3, NOT yet trained this week → streak counts back from week 2
const currentEmpty = calcConsistency(makeLogs([1,2]), 3);
expect('Not yet trained this week: streak = 2', currentEmpty.streak, 2);

// Skipped workouts don't count toward streak
const skippedLogs = [
  { week: 1, day: 1, date: new Date().toISOString(), exercises: [] },
  { week: 2, day: 1, date: new Date().toISOString(), skipped: true, exercises: [] },
  { week: 3, day: 1, date: new Date().toISOString(), exercises: [] },
];
const withSkip = calcConsistency(skippedLogs, 4);
expect('Skipped week 2 breaks streak', withSkip.streak, 1); // only week 3 contiguous

// 12-week cap on attendance window
const manyWeeks = makeLogs([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
const longRun = calcConsistency(manyWeeks, 16);
expect('12-week cap: total <= 12',   longRun.total, 12);
expect('12-week cap: done = 12',     longRun.done,  12);
expect('Long run: streak = 15',      longRun.streak, 15); // all 15 past weeks + current

// Single workout ever, currently week 2
const oneWorkout = calcConsistency(makeLogs([1]), 2);
expect('One workout: streak = 1',    oneWorkout.streak, 1);
expect('One workout: done = 1',      oneWorkout.done,   1);
expect('One workout: total = 1',     oneWorkout.total,  1);

// ════════════════════════════════════════════════════════════════
// 9. linearRegression
// ════════════════════════════════════════════════════════════════
section('linearRegression');

// Perfect ascending line y = 2x + 10
const ascPts = [{x:0,y:10},{x:1,y:12},{x:2,y:14},{x:3,y:16}];
const ascReg = linearRegression(ascPts);
expectClose('slope of y=2x+10 = 2',     ascReg.slope,     2,   0.001);
expectClose('intercept of y=2x+10 = 10',ascReg.intercept, 10,  0.001);

// Perfect flat line y = 5
const flatPts = [{x:0,y:5},{x:1,y:5},{x:2,y:5}];
const flatReg = linearRegression(flatPts);
expectClose('flat line: slope = 0',      flatReg.slope,     0,   0.001);
expectClose('flat line: intercept = 5',  flatReg.intercept, 5,   0.001);

// Too few points → null
expect('linearRegression with 1 pt returns null', linearRegression([{x:0,y:10}]), null);
expect('linearRegression with 0 pts returns null', linearRegression([]), null);

// Slope from realistic bench data (weeks 1-4, gains ~2.5 lbs/wk)
const benchPts = [{x:1,y:240},{x:2,y:242},{x:3,y:245},{x:4,y:247}];
const benchReg = linearRegression(benchPts);
expectTrue('bench regression: slope > 0', benchReg && benchReg.slope > 0);
expectTrue('bench regression: slope reasonable (1–5 lbs/wk)', benchReg && benchReg.slope >= 1 && benchReg.slope <= 5);

// ════════════════════════════════════════════════════════════════
// 10. getImplied1RMHistory
// ════════════════════════════════════════════════════════════════
section('getImplied1RMHistory');

// Empty / missing data
expect('empty logs → []', JSON.stringify(getImplied1RMHistory({ workoutLogs: [] })), '[]');
expect('null d → []', JSON.stringify(getImplied1RMHistory(null)), '[]');

// Single heavy bench log with RPE 8 — implied 1RM = 245 / 0.94 ≈ 261
const singleLog = {
  workoutLogs: [{
    week: 1, day: 1, date: '2026-01-07',
    exercises: [{
      name: 'Bench Press',
      sets: [
        { weight: 245, reps: 1, done: true, fail: false, isSingle: true, rpe: 8 },
        { weight: 205, reps: 5, done: true, fail: false, isSingle: false },
      ]
    }]
  }]
};
const h1 = getImplied1RMHistory(singleLog);
expect('one single: length = 1', h1.length, 1);
expectClose('one single: implied 1RM from RPE 8 ≈ 261', h1[0].rm, Math.round(245 / 0.94), 1);

// Single with no RPE → weight used directly as best estimate
const noRPELog = {
  workoutLogs: [{
    week: 2, day: 1, date: '2026-01-14',
    exercises: [{
      name: 'Bench Press',
      sets: [{ weight: 250, reps: 1, done: true, fail: false, isSingle: true, rpe: null }]
    }]
  }]
};
const h2 = getImplied1RMHistory(noRPELog);
expect('no RPE: length = 1', h2.length, 1);
expect('no RPE: rm = weight directly', h2[0].rm, 250);

// Failed single should be excluded
const failLog = {
  workoutLogs: [{
    week: 3, day: 1, date: '2026-01-21',
    exercises: [{
      name: 'Bench Press',
      sets: [{ weight: 260, reps: 1, done: false, fail: true, isSingle: true, rpe: 10 }]
    }]
  }]
};
expect('failed single excluded: length = 0', getImplied1RMHistory(failLog).length, 0);

// Non-Day1 log with no isSingle set should be excluded
const noBenchLog = {
  workoutLogs: [{
    week: 1, day: 2, date: '2026-01-08',
    exercises: [{
      name: 'Bench Press',
      sets: [{ weight: 185, reps: 6, done: true, fail: false, isSingle: false }]
    }]
  }]
};
expect('volume bench (no single): excluded', getImplied1RMHistory(noBenchLog).length, 0);

// Multiple logs sorted by week
const multiLog = {
  workoutLogs: [
    { week: 3, day: 1, date: '2026-01-21', exercises: [{ name: 'Bench Press', sets: [{ weight: 250, reps: 1, done: true, fail: false, isSingle: true, rpe: 8 }] }] },
    { week: 1, day: 1, date: '2026-01-07', exercises: [{ name: 'Bench Press', sets: [{ weight: 240, reps: 1, done: true, fail: false, isSingle: true, rpe: 8 }] }] },
    { week: 2, day: 1, date: '2026-01-14', exercises: [{ name: 'Bench Press', sets: [{ weight: 245, reps: 1, done: true, fail: false, isSingle: true, rpe: 8 }] }] },
  ]
};
const hMulti = getImplied1RMHistory(multiLog);
expect('multi: sorted by week, length = 3', hMulti.length, 3);
expect('multi: first entry is wk 1', hMulti[0].week, 1);
expect('multi: last entry is wk 3',  hMulti[2].week, 3);
expectTrue('multi: rms ascending', hMulti[0].rm <= hMulti[1].rm && hMulti[1].rm <= hMulti[2].rm);

// ════════════════════════════════════════════════════════════════
// 11. projectGoalDate
// ════════════════════════════════════════════════════════════════
section('projectGoalDate');

// Not enough data
expect('< 2 points → null', projectGoalDate([{week:1,rm:240,date:'2026-01-07'}], 300), null);

// Negative / zero slope → null
const flatHistory = [
  {week:1, rm:250, date:'2026-01-07'},
  {week:2, rm:250, date:'2026-01-14'},
];
expect('flat trendline → null', projectGoalDate(flatHistory, 300), null);

const descHistory = [
  {week:1, rm:260, date:'2026-01-07'},
  {week:2, rm:255, date:'2026-01-14'},
];
expect('declining trendline → null', projectGoalDate(descHistory, 300), null);

// Already at or above goal per trendline → null
const nearGoalHistory = [
  {week:1, rm:298, date:'2026-01-07'},
  {week:2, rm:302, date:'2026-01-14'},
];
const alreadyThere = projectGoalDate(nearGoalHistory, 300);
expect('trendline already at goal → null', alreadyThere, null);

// Realistic projection — should return a Date in the future
const realisticHistory = [
  {week:1,  rm:240, date:'2026-01-07'},
  {week:5,  rm:250, date:'2026-02-04'},
  {week:9,  rm:260, date:'2026-03-04'},
  {week:13, rm:270, date:'2026-04-01'},
];
const projD = projectGoalDate(realisticHistory, 300);
expectTrue('realistic projection: returns a Date', projD instanceof Date);
expectTrue('realistic projection: in the future', projD && projD > new Date('2026-01-01'));
expectTrue('realistic projection: not impossibly far (< 10 years)', projD && projD < new Date('2036-01-01'));

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
