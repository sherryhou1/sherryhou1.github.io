/* ============================================================
   Shared helper for carrying a participant's Prolific ID and
   assigned condition across pages in the study flow.

   On load, reads PROLIFIC_PID and cond from the URL query string
   (if present) and saves them to sessionStorage, so later pages in
   the flow can recover them even if a link forgot to pass them on.

   cond values used for routing: "concept" | "noconcept"
   (distinct from the CONDITION variable used inside task-engine.js,
   which is the longer "concept-given" / "no-concept" label used in
   the logged trial data).
   ============================================================ */
(function () {
  var params = new URLSearchParams(window.location.search);
  var pid = params.get("PROLIFIC_PID");
  var cond = params.get("cond");

  if (pid) { sessionStorage.setItem("PROLIFIC_PID", pid); }
  if (cond) { sessionStorage.setItem("cond", cond); }

  // Returns the value for a given key, preferring the URL, falling back
  // to whatever was previously stored in this browser session.
  window.getSessionParam = function (key) {
    return params.get(key) || sessionStorage.getItem(key) || "";
  };

  // Builds a "?PROLIFIC_PID=...&cond=..." query string (only including
  // keys that have a value) so links between pages can carry them forward.
  window.buildSessionQuery = function () {
    var pidVal = window.getSessionParam("PROLIFIC_PID");
    var condVal = window.getSessionParam("cond");
    var qp = new URLSearchParams();
    if (pidVal) { qp.set("PROLIFIC_PID", pidVal); }
    if (condVal) { qp.set("cond", condVal); }
    var s = qp.toString();
    return s ? ("?" + s) : "";
  };

  /* ----------------------------------------------------------
     Forward-only navigation guard.

     The browser Back button can't be truly disabled, but we can detect
     when a participant lands on a page they've already completed (either
     by pressing Back, or the browser restoring the page from its
     back/forward cache) and immediately redirect them forward again, so
     they never get a chance to see or resubmit an old answer.

     Each page in the flow calls window.protectStep("<step>") as early as
     possible, and window.markStepComplete("<step>") right when the
     participant successfully submits/continues from that page.
     ---------------------------------------------------------- */
  var FLOW = [
    { step: "consent", file: "consent.html" },
    { step: "get_ready", file: "get_ready.html" },
    { step: "task", file: null }, // resolved dynamically below, depends on condition
    { step: "almost_done", file: "almost_done.html" },
    { step: "demographic", file: "demographic.html" },
    { step: "feedback", file: "feedback.html" },
    { step: "thankyou", file: "thankyou.html" }
  ];

  function stepIndex(step) {
    for (var i = 0; i < FLOW.length; i++) {
      if (FLOW[i].step === step) { return i; }
    }
    return -1;
  }

  function fileForStep(step) {
    if (step === "task") {
      var condVal = window.getSessionParam("cond");
      return condVal === "noconcept" ? "task_noconcept.html" : "task_concept.html";
    }
    var entry = FLOW[stepIndex(step)];
    return entry ? entry.file : null;
  }

  // Call once a step's data has actually been submitted/finished.
  window.markStepComplete = function (step) {
    var idx = stepIndex(step);
    var current = parseInt(sessionStorage.getItem("furthestStepIndex") || "-1", 10);
    if (idx > current) {
      sessionStorage.setItem("furthestStepIndex", String(idx));
    }
  };

  // Call at the top of every page. If the participant has already moved
  // past this step, send them forward to where they currently are instead
  // of letting them view/edit the stale page.
  window.protectStep = function (step) {
    function check() {
      var idx = stepIndex(step);
      var furthest = parseInt(sessionStorage.getItem("furthestStepIndex") || "-1", 10);
      if (furthest > idx) {
        var nextFile = fileForStep(FLOW[furthest].step);
        if (nextFile) {
          window.location.replace(nextFile + window.buildSessionQuery());
        }
      }
    }
    check();
    // Some browsers restore a page from the back/forward cache without
    // re-running scripts on the initial parse; pageshow with
    // event.persisted catches that case too.
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) { check(); }
    });
  };
})();
