(function () {
  var $ = function (id) { return document.getElementById(id); }, rows = [], editing = null, slugTouched = false;
  var slugify = function (s) { return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
  async function load() {
    RC.loading($("dept-body-wrap"));
    var r = await RC.db.from("departments").select("*, doctors(id, is_active)").order("name");
    if (r.error) return RC.error($("dept-body-wrap"));
    rows = r.data; render();
  }
  function render() {
    if (!rows.length) return RC.empty($("dept-body-wrap"), "No departments yet. Add the first one.");
    $("dept-body-wrap").innerHTML = '<div class="table-wrap"><table class="table-stack"><thead><tr><th>Name</th><th>Slug</th><th>Doctors</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
      rows.map(function (d) {
        return '<tr><td data-label="Name">' + RC.esc(d.name) + '</td><td data-label="Slug">' + RC.esc(d.slug) + '</td><td data-label="Doctors">' + d.doctors.length + '</td><td data-label="Status">' +
          (d.is_active ? '<span class="badge badge-completed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>') + '</td><td data-label="Actions"><div class="row-actions">' +
          '<button class="btn btn-outline btn-sm" type="button" data-edit="' + RC.esc(d.id) + '">Edit</button><button class="btn btn-outline btn-sm" type="button" data-toggle="' + RC.esc(d.id) + '">' + (d.is_active ? "Deactivate" : "Activate") + "</button></div></td></tr>";
      }).join("") + "</tbody></table></div>";
    document.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { openForm(rows.find(function (d) { return d.id === b.dataset.edit; })); }; });
    document.querySelectorAll("[data-toggle]").forEach(function (b) { b.onclick = function () { toggle(rows.find(function (d) { return d.id === b.dataset.toggle; })); }; });
  }
  async function toggle(d) {
    var msg = $("admin-message");
    if (d.is_active && d.doctors.some(function (x) { return x.is_active; })) return RC.msg(msg, "error", "Cannot deactivate " + d.name + " while it still has active doctors. Reassign or deactivate them first.");
    var r = await RC.db.from("departments").update({ is_active: !d.is_active }).eq("id", d.id).select("id").maybeSingle();
    if (r.error || !r.data) return RC.msg(msg, "error", "Could not update the department.");
    RC.msg(msg, "success", d.name + (d.is_active ? " deactivated." : " activated.")); load();
  }
  function openForm(d) {
    editing = d || null; slugTouched = !!d; var f = $("dept-form"); RC.msg($("dept-form-msg"), "", "");
    $("dept-title").textContent = d ? "Edit department" : "Add department";
    f.elements.name.value = d ? d.name : ""; f.elements.slug.value = d ? d.slug : ""; f.elements.description.value = d ? d.description : "";
    f.elements.services.value = d ? (d.services || []).join("\n") : ""; f.elements.is_active.checked = d ? d.is_active : true;
    $("dept-dialog").showModal();
  }
  document.addEventListener("DOMContentLoaded", async function () {
    if (!$("dept-form")) return; if (!await RC.adminInit()) return;
    var f = $("dept-form"), box = $("dept-form-msg");
    f.elements.name.addEventListener("input", function () { if (!slugTouched) f.elements.slug.value = slugify(f.elements.name.value); });
    f.elements.slug.addEventListener("input", function () { slugTouched = true; });
    $("add-dept").onclick = function () { openForm(null); }; $("dept-cancel").onclick = function () { $("dept-dialog").close(); };
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      var v = { name: f.elements.name.value.trim(), slug: f.elements.slug.value.trim(), description: f.elements.description.value.trim(),
        services: f.elements.services.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean), is_active: f.elements.is_active.checked };
      if (v.name.length < 2 || v.name.length > 80) return RC.msg(box, "error", "Name must be 2 to 80 characters.");
      if (!/^[a-z0-9-]+$/.test(v.slug)) return RC.msg(box, "error", "Slug may contain only lowercase letters, numbers and hyphens.");
      if (!v.description) return RC.msg(box, "error", "Please enter a description.");
      if (editing && !v.is_active && editing.is_active && editing.doctors.some(function (x) { return x.is_active; })) return RC.msg(box, "error", "This department still has active doctors, so it cannot be deactivated.");
      var b = f.querySelector("button[type=submit]"); b.disabled = true;
      var r = editing ? await RC.db.from("departments").update(v).eq("id", editing.id).select("id").maybeSingle() : await RC.db.from("departments").insert(v).select("id").maybeSingle();
      b.disabled = false;
      if (r.error || !r.data) return RC.msg(box, "error", r.error && r.error.code === "23505" ? "A department with that name or slug already exists." : "Could not save the department.");
      $("dept-dialog").close(); RC.msg($("admin-message"), "success", "Department saved."); load();
    });
    load();
  });
})();
