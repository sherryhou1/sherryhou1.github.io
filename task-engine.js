/* ============================================================
   Shared trial engine for the relational-concept discovery task.
   Used by task_concept.html (concept-given condition) and
   task_noconcept.html (no-concept condition).

   Expects a global `CONDITION` variable ("concept-given" | "no-concept")
   to be set in the page BEFORE this script is loaded.
   ============================================================ */

const TRIALS_TOTAL = 15;

/* Balanced set of 15 hidden rules, out of the larger space of possible
   node/operator/state combinations:
     - 3 single-feature rules (IF [node]=ON THEN N4=ON) — one per node (N1, N2, N3),
       no repeats, since there are only 3 possible single-feature rules.
     - 6 conjunctive/disjunctive rules (IF A=ON AND/OR B=ON THEN N4=ON) — full
       coverage of all 3 node pairs x 2 operators (AND/OR), no repeats.
     - 3 pairwise "match" rules where both nodes must be OFF (IF A=OFF AND B=OFF
       THEN N4=ON) — one per pair (N1-N2, N1-N3, N2-N3). This is a matching
       relationship (both nodes share the same state), not a plain conjunction,
       so it's classified as "match" rather than "conj" even though the truth
       table looks like an AND of negations.
     - 1 pairwise "match" rule where both nodes must be ON (N1 and N3 specifically).
       NOTE: this has the identical truth table to the "conj AND N1,N3" rule above
       (item 6) — it's kept as a deliberate duplicate-logic/different-label trial
       rather than being made symmetric across all 3 pairs, per design choice.
     - 2 x the 3-way relational "match" rule (N4 = ON when N1, N2, AND N3 are ALL in
       the same state — all ON or all OFF). There's only one distinct 3-way
       combination, so it's repeated to give the core relational-concept test
       some weight, though less than the other categories since the both-ON
       pairwise trial above took one of its slots.
   Order is randomized per participant at load time. */
const BASE_TRIALS = [
  { type: "single", node: "N1", description: "N1 = ON causes N4 to turn ON. N2 and N3 are irrelevant." },
  { type: "single", node: "N2", description: "N2 = ON causes N4 to turn ON. N1 and N3 are irrelevant." },
  { type: "single", node: "N3", description: "N3 = ON causes N4 to turn ON. N1 and N2 are irrelevant." },

  { type: "conj", op: "AND", nodes: ["N1", "N2"], description: "N1 AND N2 must both be ON for N4 to turn ON. N3 is irrelevant." },
  { type: "conj", op: "OR",  nodes: ["N1", "N2"], description: "N1 OR N2 being ON is enough for N4 to turn ON. N3 is irrelevant." },
  { type: "conj", op: "AND", nodes: ["N1", "N3"], description: "N1 AND N3 must both be ON for N4 to turn ON. N2 is irrelevant." },
  { type: "conj", op: "OR",  nodes: ["N1", "N3"], description: "N1 OR N3 being ON is enough for N4 to turn ON. N2 is irrelevant." },
  { type: "conj", op: "AND", nodes: ["N2", "N3"], description: "N2 AND N3 must both be ON for N4 to turn ON. N1 is irrelevant." },
  { type: "conj", op: "OR",  nodes: ["N2", "N3"], description: "N2 OR N3 being ON is enough for N4 to turn ON. N1 is irrelevant." },

  { type: "match", state: "OFF", nodes: ["N1", "N2"], description: "N4 turns ON when N1 and N2 match by both being OFF. N3 is irrelevant." },
  { type: "match", state: "OFF", nodes: ["N1", "N3"], description: "N4 turns ON when N1 and N3 match by both being OFF. N2 is irrelevant." },
  { type: "match", state: "OFF", nodes: ["N2", "N3"], description: "N4 turns ON when N2 and N3 match by both being OFF. N1 is irrelevant." },
  { type: "match", state: "ON", nodes: ["N1", "N3"], description: "N4 turns ON when N1 and N3 match by both being ON. N2 is irrelevant." },

  { type: "match", nodes: ["N1", "N2", "N3"], description: "N4 turns ON when N1, N2, and N3 are all in the same state (all ON or all OFF)." },
  { type: "match", nodes: ["N1", "N2", "N3"], description: "N4 turns ON when N1, N2, and N3 are all in the same state (all ON or all OFF)." }
];

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

const TRIALS = shuffleArray(BASE_TRIALS);

let trialIndex = 1; // 1-indexed, 1..TRIALS_TOTAL

/* ---------- Node / outcome state ---------- */
let stateA = false; // N1
let stateB = false; // N2
let stateD = false; // N3
let outcomeOn = false; // N4

let testHistory = []; // history within the current trial
let chosenStrategy = null;
let testCount = 0;

/* ---------- Data log across the whole session ---------- */
let sessionLog = [];

/* ---------- Outcome rule logic ---------- */
function evaluateOutcome(rule, n1, n2, n3) {
  const state = { N1: n1, N2: n2, N3: n3 };
  if (rule.type === "single") {
    return state[rule.node] === true;
  }
  if (rule.type === "conj") {
    const a = state[rule.nodes[0]];
    const b = state[rule.nodes[1]];
    return rule.op === "OR" ? (a || b) : (a && b);
  }
  if (rule.type === "match") {
    const values = rule.nodes.map(function (n) { return state[n]; });
    if (rule.state === "ON") {
      return values.every(function (v) { return v === true; });
    }
    if (rule.state === "OFF") {
      return values.every(function (v) { return v === false; });
    }
    // no specific state required: symmetric match (all equal, either all ON or all OFF)
    return values.every(function (v) { return v === values[0]; });
  }
  return false;
}

/* ---------- Begin task (after instructions) ---------- */
function beginTask() {
  document.getElementById("instructions-screen").style.display = "none";
  document.getElementById("task-wrapper").style.display = "block";
  startTrial();
}

/* ---------- Intervention on N1 / N2 / N3 ---------- */
/* Toggling a switch only changes that switch. N4 (the outcome) is not
   revealed until the Test button is clicked. */
function intervene(node) {
  if (node === "A") { stateA = !stateA; }
  else if (node === "B") { stateB = !stateB; }
  else if (node === "D") { stateD = !stateD; }

  outcomeOn = false; // outcome unknown for the new configuration until tested
  updateNodeDisplay();
  document.getElementById("message").innerText = "Configuration changed. Click Test to check N4.";
}

/* ---------- Test button ---------- */
function runTest() {
  const rule = TRIALS[trialIndex - 1];
  outcomeOn = evaluateOutcome(rule, stateA, stateB, stateD);
  updateNodeDisplay();
  testCount++;
  const entry = { testNumber: testCount, n1: stateA, n2: stateB, n3: stateD, n4: outcomeOn };
  testHistory.push(entry);
  logHistoryRow(entry);
  document.getElementById("message").innerText = outcomeOn ? "N4 turned ON." : "N4 is OFF.";
  document.getElementById("submitTrialButton").disabled =
    !(chosenStrategy !== null && testCount > 0 && ruleTextEntered());
}

function updateNodeDisplay() {
  document.getElementById("A").style.backgroundColor = stateA ? "#EF9F27" : "grey";
  document.getElementById("B").style.backgroundColor = stateB ? "#EF9F27" : "grey";
  document.getElementById("D").style.backgroundColor = stateD ? "#EF9F27" : "grey";
  document.getElementById("C").style.backgroundColor = outcomeOn ? "#43a047" : "grey";

  document.getElementById("A-state").innerText = stateA ? "ON" : "OFF";
  document.getElementById("B-state").innerText = stateB ? "ON" : "OFF";
  document.getElementById("D-state").innerText = stateD ? "ON" : "OFF";
  document.getElementById("C-state").innerText = outcomeOn ? "ON" : "OFF";
}

function logHistoryRow(entry) {
  const log = document.getElementById("history-log");
  const row = document.createElement("div");
  row.innerText = "Test " + entry.testNumber + ": N1=" + (entry.n1 ? "ON" : "OFF") +
    ", N2=" + (entry.n2 ? "ON" : "OFF") +
    ", N3=" + (entry.n3 ? "ON" : "OFF") +
    " -> N4 " + (entry.n4 ? "ON" : "OFF");
  log.prepend(row);
}

function resetNodes() {
  stateA = false;
  stateB = false;
  stateD = false;
  outcomeOn = false;
  updateNodeDisplay();
  document.getElementById("message").innerText = "Set the switches, then click Test.";
}

/* ---------- Strategy choice ---------- */
function chooseStrategy(strategy, btn) {
  chosenStrategy = strategy;
  document.querySelectorAll("#strategy-choices .choice").forEach(function (b) {
    b.classList.remove("selected");
  });
  btn.classList.add("selected");
  document.getElementById("submitTrialButton").disabled =
    !(chosenStrategy !== null && testCount > 0 && ruleTextEntered());
}

/* ---------- Hidden rule free-text response ---------- */
function ruleTextEntered() {
  return document.getElementById("ruleTextInput").value.trim().length > 0;
}

function getRuleText() {
  return document.getElementById("ruleTextInput").value.trim();
}

function onRuleTextInput() {
  document.getElementById("submitTrialButton").disabled =
    !(chosenStrategy !== null && testCount > 0 && ruleTextEntered());
}

/* ---------- Trial submission and feedback ---------- */
function submitTrial() {
  const rule = TRIALS[trialIndex - 1];
  const ruleGuess = getRuleText();

  const trialRecord = {
    condition: CONDITION,
    trialNumber: trialIndex,
    ruleType: rule.type,
    ruleNodes: rule.nodes || [rule.node],
    ruleOp: rule.op || null,
    ruleState: rule.state || null,
    testHistory: testHistory.slice(),
    numberOfTests: testCount,
    chosenStrategy: chosenStrategy,
    ruleGuess: ruleGuess,
    correctRuleDescription: rule.description
  };
  sessionLog.push(trialRecord);
  console.log(trialRecord);

  const feedbackBox = document.getElementById("feedback-box");
  feedbackBox.style.display = "block";
  feedbackBox.className = "info";
  feedbackBox.innerHTML =
    "<strong>Your answer has been recorded:</strong><br>" + ruleGuess +
    "<br><br>Click “Next trial” when you're ready to continue. The correct rule is not shown, so that it doesn't influence later trials.";

  document.getElementById("submitTrialButton").style.display = "none";
  document.getElementById("nextTrialButton").style.display = "inline-block";

  document.querySelectorAll("#strategy-choices .choice").forEach(function (b) { b.disabled = true; });
  document.getElementById("ruleTextInput").disabled = true;
  document.getElementById("testButton").disabled = true;

  document.getElementById("A").classList.add("disabled");
  document.getElementById("B").classList.add("disabled");
  document.getElementById("D").classList.add("disabled");
  document.getElementById("A").onclick = null;
  document.getElementById("B").onclick = null;
  document.getElementById("D").onclick = null;
}

function nextTrial() {
  if (trialIndex >= TRIALS_TOTAL) {
    showSessionComplete();
    return;
  }
  trialIndex++;
  startTrial();
}

function startTrial() {
  // reset per-trial state
  stateA = false;
  stateB = false;
  stateD = false;
  outcomeOn = false;
  testHistory = [];
  chosenStrategy = null;
  testCount = 0;

  updateNodeDisplay();
  document.getElementById("history-log").innerHTML = "";
  document.getElementById("message").innerText = "Set the switches, then click Test.";

  document.querySelectorAll("#strategy-choices .choice").forEach(function (b) {
    b.classList.remove("selected");
    b.disabled = false;
  });

  const ruleInput = document.getElementById("ruleTextInput");
  ruleInput.value = "";
  ruleInput.disabled = false;

  document.getElementById("A").classList.remove("disabled");
  document.getElementById("B").classList.remove("disabled");
  document.getElementById("D").classList.remove("disabled");
  document.getElementById("A").onclick = function () { intervene("A"); };
  document.getElementById("B").onclick = function () { intervene("B"); };
  document.getElementById("D").onclick = function () { intervene("D"); };

  document.getElementById("testButton").disabled = false;
  document.getElementById("submitTrialButton").disabled = true;
  document.getElementById("submitTrialButton").style.display = "inline-block";
  document.getElementById("nextTrialButton").style.display = "none";

  const feedbackBox = document.getElementById("feedback-box");
  feedbackBox.style.display = "none";
  feedbackBox.className = "";
  feedbackBox.innerHTML = "";

  document.getElementById("trial-counter").innerText = "Trial " + trialIndex + " of " + TRIALS_TOTAL;
}

function showSessionComplete() {
  document.getElementById("task-wrapper").innerHTML =
    "<h1>Session complete</h1>" +
    "<p>Thank you for completing all trials. Taking you to a few final questions...</p>";
  console.log("FULL SESSION LOG (" + CONDITION + "):", sessionLog);

  try {
    sessionStorage.setItem("taskSessionLog", JSON.stringify(sessionLog));
    sessionStorage.setItem("taskCondition", CONDITION);
  } catch (e) {}

  var query = (typeof window.buildSessionQuery === "function") ? window.buildSessionQuery() : "";
  window.setTimeout(function () {
    window.location.href = "demographic.html" + query;
  }, 1200);
}

/* ---------- Initialise ---------- */
document.getElementById("trial-counter").innerText = "Trial 1 of " + TRIALS_TOTAL;
