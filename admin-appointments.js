(function () {
  var $ = function (id) { return document.getElementById(id); }, rows = [];
  var toMin = function (t) { var p = String(t).split(":"); return +p[0] * 60 + +p[1]; };
  function past(a) { var n = RC.lagosNow(); return a.appointment_date < n.date || (a.appointment_date === n.date && toMin(a.appointment_time) <= n.mins); }
  async function load() {
    var el = $("appt-wrap"); RC.loading(el);
    var q = RC.db.from("appointments").select("*, doctors(full_name), departments(name)").order("appointment_date", { ascending: false }).order("appointment_time", { ascending: false }).limit(200);
    var f = { date: $("f-date").value, doc: $("f-doctor").value, dep: $("f-dept").value, st: $("f-status").value, s: $("f-search").value.replace(/[^\w\s@.\-]/g, "").trim() };
    if (f.date) q = q.eq("appointment_date", f.date); if (f.doc) q = q.eq("doctor_id", f.doc); if (f.dep) q = q.eq("department_id", f.dep); if (f.st) q = q.eq("status", f.st);
    if (f.s) q = q.or("reference_number.ilike.%" + f.s + "%,patient_name.ilike.%" + f.s + "%");
    var r = await q; if (r.error) return RC.error(el);
    rows = r.data; $("count").textContent = rows.length + " appointment" + (rows.length === 1 ? "" : "s") + (rows.length === 200 ? " (showing latest 200)" : "");
    if (!rows.length) return RC.empty(el, "No appointments match your filters.");
    el.innerHTML = '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Reference</th><th>Patient</th><th>Doctor</th><th>Date and time</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (a) {
      var acts = '<button class="btn btn-outline btn-sm" type="button" data-view="' + RC.esc(a.id) + '">Details</button>';
      if (a.status === "pending") acts += '<button class="btn btn-primary btn-sm" type="button" data-set="confirmed" data-id="' + RC.esc(a.id) + '">Confirm</button>';
      if (a.status === "confirmed" && past(a)) acts += '<button class="btn btn-primary btn-sm" type="button" data-set="completed" data-id="' + RC.esc(a.id) + '">Complete</button>';
      if (a.status === "pending" || a.status === "confirmed") acts += '<button class="btn btn-danger btn-sm" type="button" data-set="cancelled" data-id="' + RC.esc(a.id) + '">Cancel</button>';
      return '<tr><td data-label="Reference">' + RC.esc(a.reference_number) + '</td><td data-label="Patient">' + RC.esc(a.patient_name) + '</td><td data-label="Doctor">' + RC.esc(a.doctors ? a.doctors.full_name : "") +
        '</td><td data-label="When">' + RC.esc(RC.fmtDate(a.appointment_date)) + " " + RC.esc(RC.fmtTime(a.appointment_time.slice(0, 5))) + '</td><td data-label="Status">' + RC.statusBadge(a.status) + '</td><td data-label="Actions"><div class="row-actions">' + acts + "</div></td></tr>";
    }).join("") + "</tbody></table></div>";
    el.querySelectorAll("[data-set]").forEach(function (b) { b.onclick = function () { setStatus(b.dataset.id, b.dataset.set, b); }; });
    el.querySelectorAll("[data-view]").forEach(function (b) { b.onclick = function () { view(b.dataset.view); }; });
  }
  async function setStatus(id, st, btn) {
    var a = rows.find(function (x) { return x.id === id; });
    if (st === "cancelled" && !confirm("Cancel appointment " + a.reference_number + "?")) return;
    btn.disabled = true;
    var r = await RC.db.from("appointments").update({ status: st }).eq("id", id).select("id").maybeSingle();
    if (r.error || !r.data) { btn.disabled = false; return RC.msg($("admin-message"), "error", r.error && r.error.code === "P0001" ? r.error.message : "Could not update the appointment."); }
    RC.msg($("admin-message"), "success", a.reference_number + " is now " + st + "."); load();
  }
  function view(id) {
    var a = rows.find(function (x) { return x.id === id; });
    $("appt-body").innerHTML = '<h2 id="appt-title">' + RC.esc(a.reference_number) + "</h2><p>" + RC.statusBadge(a.status) + '</p><dl class="dl"><dt>Patient</dt><dd>' + RC.esc(a.patient_name) + "</dd><dt>Phone</dt><dd>" + RC.esc(a.patient_phone) +
      "</dd><dt>Email</dt><dd>" + RC.esc(a.patient_email) + "</dd><dt>Doctor</dt><dd>" + RC.esc(a.doctors ? a.doctors.full_name : "") + "</dd><dt>Department</dt><dd>" + RC.esc(a.departments ? a.departments.name : "") +
      "</dd><dt>When</dt><dd>" + RC.esc(RC.fmtDate(a.appointment_date)) + " " + RC.esc(RC.fmtTime(a.appointment_time.slice(0, 5))) + "</dd><dt>Reason</dt><dd>" + RC.esc(a.reason || "Not provided") +
      '</dd></dl><div class="card-actions"><button class="btn btn-outline" type="button" id="dlg-close">Close</button></div>';
    $("dlg-close").onclick = function () { $("appt-dialog").close(); }; $("appt-dialog").showModal();
  }
  document.addEventListener("DOMContentLoaded", async function () {
    if (!$("appt-wrap")) return; if (!await RC.adminInit()) return;
    var d = await RC.db.from("doctors").select("id,full_name").order("full_name"), p = await RC.db.from("departments").select("id,name").order("name");
    var opt = function (l) { return (l || []).map(function (x) { return '<option value="' + RC.esc(x.id) + '">' + RC.esc(x.full_name || x.name) + "</option>"; }).join(""); };
    $("f-doctor").innerHTML = '<option value="">All doctors</option>' + opt(d.data); $("f-dept").innerHTML = '<option value="">All departments</option>' + opt(p.data);
    ["f-date", "f-doctor", "f-dept", "f-status"].forEach(function (i) { $(i).addEventListener("change", load); });
    $("f-search").addEventListener("input", RC.debounce(load, 300));
    $("f-clear").onclick = function () { ["f-date", "f-doctor", "f-dept", "f-status", "f-search"].forEach(function (i) { $(i).value = ""; }); load(); };
    load();
  });
})();
