/* Authentication + route protection. Real authorization is enforced by database RLS;
   these checks only provide navigation and friendly messages. */
window.RC = window.RC || {};
(function () {
  var base = location.origin + location.pathname.replace(/[^/]*$/, "");
  function safeNext(n) { return /^[a-z0-9-]+\.html(\?[\w=&%-]*)?$/i.test(n || "") ? n : null; }
  function friendly(err) {
    var m = (err && err.message || "").toLowerCase();
    if (m.indexOf("invalid login") > -1) return "Incorrect email or password.";
    if (m.indexOf("email not confirmed") > -1) return "Please verify your email first. Check your inbox for the verification link.";
    if (m.indexOf("already registered") > -1) return "An account with this email already exists. Try logging in.";
    if (m.indexOf("rate limit") > -1 || m.indexOf("too many") > -1) return "Too many attempts. Please wait a few minutes and try again.";
    if (m.indexOf("password") > -1) return "That password was not accepted. Use at least 8 characters with a letter and a number.";
    return "Something went wrong. Please try again.";
  }
  function validPassword(p) { return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p); }
  function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }
  function validPhone(p) { return !p || /^[0-9+()\-\s]{7,20}$/.test(p); }

  RC.auth = {
    safeNext: safeNext, friendly: friendly, validPhone: validPhone, validEmail: validEmail,
    async session() {
      if (!RC.db) return null;
      var r = await RC.db.auth.getSession();
      return r.data.session;
    },
    async profile() {
      var s = await this.session();
      if (!s) return null;
      var r = await RC.db.from("profiles").select("*").eq("id", s.user.id).maybeSingle();
      return r.error ? null : r.data;
    },
    /* Redirects signed-out users to login, and non-admins away from admin pages. */
    async require(opts) {
      opts = opts || {};
      var p = await this.profile();
      if (!p) {
        location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search));
        return null;
      }
      if (!p.is_active) { await this.signOut(false); location.replace("login.html?disabled=1"); return null; }
      if (opts.admin && p.role !== "admin") { location.replace("patient-dashboard.html"); return null; }
      return p;
    },
    async signOut(redirect) {
      if (RC.db) await RC.db.auth.signOut();
      if (redirect !== false) location.href = "index.html";
    },
    signUp(name, email, password, phone) {
      return RC.db.auth.signUp({ email: email, password: password,
        options: { data: { full_name: name, phone: phone || "" }, emailRedirectTo: base + "login.html" } });
    },
    signIn(email, password) { return RC.db.auth.signInWithPassword({ email: email, password: password }); },
    resetRequest(email) { return RC.db.auth.resetPasswordForEmail(email, { redirectTo: base + "login.html" }); },
    updatePassword(pw) { return RC.db.auth.updateUser({ password: pw }); }
  };

  function val(f, n) { return (f.elements[n].value || "").trim(); }
  function busy(f, on, label) { var b = f.querySelector("button[type=submit]"); if (!b) return; b.disabled = on; if (label) b.textContent = on ? "Please wait…" : label; }
  function bind(id, fn) { var f = document.getElementById(id); if (f) f.addEventListener("submit", function (e) { e.preventDefault(); fn(f); }); }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.querySelector("[data-auth]")) return;
    var box = document.getElementById("auth-message");
    function say(type, text) { RC.msg(box, type, text); }
    if (!RC.db) { say("error", RC.NOT_CONFIGURED_MSG); document.querySelectorAll("[data-auth] button[type=submit]").forEach(function (b) { b.disabled = true; }); return; }
    var q = new URLSearchParams(location.search);
    if (q.get("disabled")) say("error", "Your account has been disabled. Please contact the hospital administrator.");

    bind("register-form", async function (f) {
      var name = val(f, "full_name"), email = val(f, "email"), pw = f.elements.password.value, phone = val(f, "phone");
      if (name.length < 2) return say("error", "Please enter your full name.");
      if (!validEmail(email)) return say("error", "Please enter a valid email address.");
      if (!validPhone(phone)) return say("error", "Phone number may contain only digits, spaces and + ( ) -");
      if (!validPassword(pw)) return say("error", "Password must be at least 8 characters and include a letter and a number.");
      if (pw !== f.elements.confirm.value) return say("error", "Passwords do not match.");
      busy(f, true);
      var r = await RC.auth.signUp(name, email, pw, phone);
      busy(f, false, "Create account");
      if (r.error) return say("error", friendly(r.error));
      if (r.data.session) { location.href = "patient-dashboard.html"; return; }
      f.reset();
      say("success", "Account created. Check your email for a verification link, then log in.");
    });

    bind("login-form", async function (f) {
      var email = val(f, "email"), pw = f.elements.password.value;
      if (!validEmail(email) || !pw) return say("error", "Enter your email and password.");
      busy(f, true);
      var r = await RC.auth.signIn(email, pw);
      if (r.error) { busy(f, false, "Log in"); return say("error", friendly(r.error)); }
      var p = await RC.auth.profile();
      if (!p || !p.is_active) { await RC.auth.signOut(false); busy(f, false, "Log in"); return say("error", "This account is disabled or has no profile."); }
      location.href = safeNext(q.get("next")) || (p.role === "admin" ? "admin-dashboard.html" : "patient-dashboard.html");
    });

    bind("forgot-form", async function (f) {
      var email = val(f, "email");
      if (!validEmail(email)) return say("error", "Enter a valid email address.");
      busy(f, true);
      var r = await RC.auth.resetRequest(email);
      busy(f, false, "Send reset link");
      if (r.error) return say("error", friendly(r.error));
      say("success", "If an account exists for that email, a reset link has been sent.");
    });

    bind("reset-form", async function (f) {
      var pw = f.elements.password.value;
      if (!validPassword(pw)) return say("error", "Password must be at least 8 characters and include a letter and a number.");
      if (pw !== f.elements.confirm.value) return say("error", "Passwords do not match.");
      busy(f, true);
      var r = await RC.auth.updatePassword(pw);
      busy(f, false, "Update password");
      if (r.error) return say("error", friendly(r.error));
      say("success", "Password updated. Redirecting…");
      setTimeout(function () { location.href = "patient-dashboard.html"; }, 1200);
    });

    function show(name) {
      document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== name; });
      RC.msg(box, "", "");
    }
    document.querySelectorAll("[data-show]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); show(a.dataset.show); });
    });
    RC.db.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") show("reset"); });
  });
})();

/* Admin page guard. The database (RLS + is_admin()) is the real protection; this handles redirects/UI. */
RC.adminInit = async function () {
  var load = document.getElementById("portal-loading"), portal = document.getElementById("portal");
  if (!RC.db) { load.innerHTML = '<div class="state state-error">' + RC.esc(RC.NOT_CONFIGURED_MSG) + "</div>"; return null; }
  var p = await RC.auth.require({ admin: true });
  if (!p) return null;
  load.hidden = true; portal.hidden = false;
  return p;
};
