(function () {
  var $ = function (id) { return document.getElementById(id); }, rows = [], depts = [], editing = null;
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], hh = function (t) { return String(t).slice(0, 5); };
  async function load() {
    RC.loading($("doc-wrap"));
    var r = await RC.db.from("doctors").select("*, departments(name)").order("full_name");
    if (r.error) return RC.error($("doc-wrap"));
    rows = r.data; render();
  }
  function render() {
    var t = $("search").value.trim().toLowerCase(), dep = $("filter-dept").value;
    var list = rows.filter(function (d) { return (!t || (d.full_name + " " + d.specialty).toLowerCase().indexOf(t) > -1) && (!dep || d.department_id === dep); });
    if (!list.length) return RC.empty($("doc-wrap"), rows.length ? "No doctors match your filters." : "No doctors yet. Add the first one.");
    $("doc-wrap").innerHTML = '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Name</th><th>Specialty</th><th>Department</th><th>Availability</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
      list.map(function (d) {
        return '<tr><td data-label="Name">' + RC.esc(d.full_name) + '</td><td data-label="Specialty">' + RC.esc(d.specialty) + '</td><td data-label="Department">' + RC.esc(d.departments ? d.departments.name : "") +
          '</td><td data-label="Availability">' + RC.esc(d.available_days.slice().sort().map(function (n) { return DAYS[n]; }).join(", ")) + " " + hh(d.slot_start) + "-" + hh(d.slot_end) + '</td><td data-label="Status">' +
          (d.is_active ? '<span class="badge badge-completed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>') + '</td><td data-label="Actions"><div class="row-actions"><button class="btn btn-outline btn-sm" type="button" data-edit="' + RC.esc(d.id) +
          '">Edit</button><button class="btn btn-outline btn-sm" type="button" data-toggle="' + RC.esc(d.id) + '">' + (d.is_active ? "Deactivate" : "Activate") + "</button></div></td></tr>";
      }).join("") + "</tbody></table></div>";
    document.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { openForm(rows.find(function (d) { return d.id === b.dataset.edit; })); }; });
    document.querySelectorAll("[data-toggle]").forEach(function (b) { b.onclick = async function () {
      var d = rows.find(function (x) { return x.id === b.dataset.toggle; });
      var r = await RC.db.from("doctors").update({ is_active: !d.is_active }).eq("id", d.id).select("id").maybeSingle();
      if (r.error || !r.data) return RC.msg($("admin-message"), "error", "Could not update the doctor.");
      RC.msg($("admin-message"), "success", d.full_name + (d.is_active ? " deactivated." : " activated.")); load();
    }; });
  }
  function openForm(d) {
    editing = d || null; var f = $("doc-form"); RC.msg($("doc-form-msg"), "", ""); $("doc-title").textContent = d ? "Edit doctor" : "Add doctor";
    f.elements.department_id.innerHTML = '<option value="">Select department</option>' + depts.map(function (x) { return '<option value="' + RC.esc(x.id) + '">' + RC.esc(x.name) + (x.is_active ? "" : " (inactive)") + "</option>"; }).join("");
    f.elements.full_name.value = d ? d.full_name : ""; f.elements.specialty.value = d ? d.specialty : ""; f.elements.department_id.value = d ? d.department_id : "";
    f.elements.bio.value = d ? d.bio : ""; f.elements.years_experience.value = d && d.years_experience != null ? d.years_experience : "";
    f.elements.slot_start.value = d ? hh(d.slot_start) : "09:00"; f.elements.slot_end.value = d ? hh(d.slot_end) : "16:00"; f.elements.slot_minutes.value = d ? d.slot_minutes : 30;
    f.elements.is_active.checked = d ? d.is_active : true;
    document.querySelectorAll("#doc-form input[name=days]").forEach(function (c) { c.checked = d ? d.available_days.indexOf(+c.value) > -1 : [1, 2, 3, 4, 5].indexOf(+c.value) > -1; });
    $("doc-dialog").showModal();
  }
  document.addEventListener("DOMContentLoaded", async function () {
    if (!$("doc-form")) return; if (!await RC.adminInit()) return;
    var f = $("doc-form"), box = $("doc-form-msg");
    var dr = await RC.db.from("departments").select("id,name,is_active").order("name"); depts = dr.data || [];
    $("filter-dept").innerHTML = '<option value="">All departments</option>' + depts.map(function (x) { return '<option value="' + RC.esc(x.id) + '">' + RC.esc(x.name) + "</option>"; }).join("");
    $("search").addEventListener("input", RC.debounce(render, 200)); $("filter-dept").addEventListener("change", render);
    $("add-doc").onclick = function () { openForm(null); }; $("doc-cancel").onclick = function () { $("doc-dialog").close(); };
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      var days = Array.from(document.querySelectorAll("#doc-form input[name=days]:checked")).map(function (c) { return +c.value; });
      var yrs = f.elements.years_experience.value.trim();
      var v = { full_name: f.elements.full_name.value.trim(), specialty: f.elements.specialty.value.trim(), department_id: f.elements.department_id.value, bio: f.elements.bio.value.trim(),
        years_experience: yrs === "" ? null : +yrs, available_days: days, slot_start: f.elements.slot_start.value, slot_end: f.elements.slot_end.value, slot_minutes: +f.elements.slot_minutes.value, is_active: f.elements.is_active.checked };
      if (v.full_name.length < 2) return RC.msg(box, "error", "Please enter the doctor's name.");
      if (v.specialty.length < 2) return RC.msg(box, "error", "Please enter a specialty.");
      if (!v.department_id) return RC.msg(box, "error", "Please select a department.");
      if (v.years_experience !== null && (!(v.years_experience >= 0 && v.years_experience <= 60))) return RC.msg(box, "error", "Years of experience must be between 0 and 60.");
      if (!days.length) return RC.msg(box, "error", "Select at least one available day.");
      if (!v.slot_start || !v.slot_end || v.slot_end <= v.slot_start) return RC.msg(box, "error", "End time must be after start time.");
      if (!(v.slot_minutes >= 10 && v.slot_minutes <= 120)) return RC.msg(box, "error", "Slot length must be 10 to 120 minutes.");
      var b = f.querySelector("button[type=submit]"); b.disabled = true;
      var r = editing ? await RC.db.from("doctors").update(v).eq("id", editing.id).select("id").maybeSingle() : await RC.db.from("doctors").insert(v).select("id").maybeSingle();
      b.disabled = false;
      if (r.error || !r.data) return RC.msg(box, "error", "Could not save the doctor. Check the details and try again.");
      $("doc-dialog").close(); RC.msg($("admin-message"), "success", "Doctor saved."); load();
    });
    load();
  });
})();
