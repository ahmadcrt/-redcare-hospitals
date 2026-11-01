(function () {
  var $ = function (id) { return document.getElementById(id); };
  document.addEventListener("DOMContentLoaded", async function () {
    if (!$("admin-stats")) return;
    if (!await RC.adminInit()) return;
    var r = await RC.db.rpc("admin_stats");
    if (r.error) return RC.error($("admin-stats"), "Could not load statistics. Make sure your account is an administrator.");
    var s = r.data, cards = [["Registered patients", s.patients], ["Doctors", s.doctors], ["Departments", s.departments], ["Total appointments", s.appointments],
      ["Pending", s.pending], ["Confirmed", s.confirmed], ["Completed", s.completed], ["Cancelled", s.cancelled]];
    $("admin-stats").innerHTML = cards.map(function (c) { return '<div class="stat"><b>' + RC.esc(c[1]) + "</b><span>" + RC.esc(c[0]) + "</span></div>"; }).join("");
    var total = Math.max(1, s.appointments);
    $("status-bars").innerHTML = [["Pending", s.pending], ["Confirmed", s.confirmed], ["Completed", s.completed], ["Cancelled", s.cancelled]].map(function (c) {
      return "<div>" + RC.esc(c[0]) + " (" + c[1] + ')<div class="bar"><i style="width:' + Math.round(c[1] / total * 100) + '%"></i></div></div>';
    }).join("");
    var p = await RC.db.from("appointments").select("reference_number,appointment_date,appointment_time,patient_name").eq("status", "pending").order("appointment_date").limit(5);
    var el = $("pending-list");
    if (p.error) RC.error(el); else if (!p.data.length) RC.empty(el, "No pending appointments."); else
      el.innerHTML = p.data.map(function (a) { return '<div class="appt"><div><h3>' + RC.esc(a.patient_name) + "</h3><p>" + RC.esc(RC.fmtDate(a.appointment_date)) + " " + RC.esc(RC.fmtTime(a.appointment_time.slice(0, 5))) + " &middot; " + RC.esc(a.reference_number) + "</p></div></div>"; }).join("");
  });
})();
