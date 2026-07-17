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
})();
