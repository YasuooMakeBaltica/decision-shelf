const supabaseClient = window.supabase.createClient(
  'https://yodxhcgjwyeuxlvbjxhc.supabase.co',
  'sb_publishable_nqH6iq7Fjixse097VQFwYw_JaQ6nUKa'
);
const KEY = "decision-shelf-v1";
const $ = (selector) => document.querySelector(selector);
let activeFilter = "all";
let currentUser = null;
let decisions = [];
const formatDate = (value) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const escape = (value = "") => value.replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);
const save = () => currentUser && localStorage.setItem(`${KEY}-${currentUser.email}`, JSON.stringify(decisions));
const reviewDue = (decision) => !decision.outcome && new Date(`${decision.reviewDate}T23:59:59`) <= new Date();

function render() {
  const shown = decisions.filter(d => activeFilter === "all" || (activeFilter === "review" && reviewDue(d)) || (activeFilter === "open" && !d.outcome) || (activeFilter === "closed" && d.outcome));
  const labels = { all:["Recent choices", "Your decisions"], review:["A moment to look back", "Ready to review"], open:["Still in motion", "Unfolding decisions"], closed:["What you've learned", "Closed decisions"] };
  $("#list-kicker").textContent = labels[activeFilter][0]; $("#list-title").textContent = labels[activeFilter][1];
  $("#all-count").textContent = decisions.length; $("#review-count").textContent = decisions.filter(reviewDue).length; $("#decision-total").textContent = `${shown.length} ${shown.length === 1 ? "entry" : "entries"}`;
  const list = $("#decision-list"); list.innerHTML = "";
  if (!shown.length) { const empty = $("#empty-state").content.cloneNode(true); empty.querySelector("button").onclick = openForm; list.append(empty); return; }
  shown.sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || "")).forEach(d => {
    const status = d.outcome || (reviewDue(d) ? "review" : "open");
    const stateText = d.outcome ? ({good:"A good call",mixed:"Mixed outcome",poor:"A lesson learned"}[d.outcome]) : (reviewDue(d) ? "Review due" : `Review ${formatDate(d.reviewDate)}`);
    const reflection = d.reflection ? `<p class="reflection"><strong>Learned:</strong> ${escape(d.reflection)}</p>` : "";
    list.insertAdjacentHTML("beforeend", `<article class="decision-card"><i class="status-dot ${status}"></i><div><div class="card-top"><h3>${escape(d.title)}</h3><span class="tag">${escape(d.area)}</span></div>${d.context ? `<p>${escape(d.context)}</p>` : ""}${reflection}</div><div class="card-meta">${stateText}${!d.outcome ? `<br><button class="review-button" data-id="${d.id}">Review now</button>` : ""}</div></article>`);
  });
  document.querySelectorAll(".review-button").forEach(button => button.onclick = () => openReview(button.dataset.id));
}
function openForm() { const form = $("#decision-form"); form.reset(); form.reviewDate.value = new Date(Date.now() + 1000*60*60*24*30).toISOString().slice(0,10); $("#decision-dialog").showModal(); }
function openReview(id) { const d = decisions.find(item => item.id === id); $("#review-form").reset(); $("#review-form [name=id]").value = id; $("#review-heading").textContent = d.title; $("#review-dialog").showModal(); }

$("#open-form").onclick = openForm; $("#close-form").onclick = () => $("#decision-dialog").close(); document.querySelector("[data-close-review]").onclick = () => $("#review-dialog").close();
$("#decision-form").onsubmit = event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); decisions.push({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }); save(); event.target.closest("dialog").close(); render(); };
$("#review-form").onsubmit = event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const d = decisions.find(item => item.id === data.id); Object.assign(d, { outcome:data.outcome, reflection:data.reflection, reviewedAt:new Date().toISOString() }); save(); event.target.closest("dialog").close(); render(); };
document.querySelectorAll(".nav-link").forEach(button => button.onclick = () => { activeFilter = button.dataset.filter; document.querySelectorAll(".nav-link").forEach(item => item.classList.toggle("active", item === button)); render(); });
$("#theme-toggle").onclick = () => { document.body.classList.toggle("dark"); localStorage.setItem("decision-shelf-theme", document.body.classList.contains("dark") ? "dark" : "light"); };
$("#export-data").onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(decisions, null, 2)], {type:"application/json"})); const link = Object.assign(document.createElement("a"), {href:url, download:"decision-shelf-backup.json"}); link.click(); URL.revokeObjectURL(url); };
$("#import-data").onchange = async event => { try { const data = JSON.parse(await event.target.files[0].text()); if (!Array.isArray(data)) throw Error(); decisions = data; save(); render(); } catch { alert("That file isn't a Decision Shelf backup."); } event.target.value = ""; };
function showApp() {
  $("#auth-screen").hidden = true; $("#app-shell").hidden = false;
  $("#account-name").textContent = currentUser.name; $("#account-initial").textContent = currentUser.name.trim().charAt(0).toUpperCase();
  decisions = JSON.parse(localStorage.getItem(`${KEY}-${currentUser.email}`) || "[]"); render();
}
function showAuth() { $("#app-shell").hidden = true; $("#auth-screen").hidden = false; }
let authMode = "signup";
function setAuthMode(mode) {
  authMode = mode; document.querySelectorAll(".auth-tab").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
  $(".name-field").hidden = mode === "signin"; $(".name-field input").required = mode === "signup";
  $("#auth-form [name=password]").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("#auth-form [name=password]").placeholder = mode === "signup" ? "At least 4 characters" : "Your password";
  $("#auth-note").textContent = mode === "signup" ? "Your account is stored privately in this browser." : "Sign in on the browser where you created your shelf.";
  $(".auth-submit").innerHTML = `${mode === "signup" ? "Create my shelf" : "Open my shelf"} <span>→</span>`;
}
document.querySelectorAll(".auth-tab").forEach(button => button.onclick = () => setAuthMode(button.dataset.mode));
$("#auth-form").onsubmit = async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const email = data.email.trim().toLowerCase();

  if (authMode === "signup") {
    const { error } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: { data: { name: data.name.trim() } }
    });
    if (error) return alert(error.message);
    alert("Check your email to verify your account before signing in!");
    setAuthMode("signin");
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password: data.password });
    if (error) return alert(error.message);
  }
};

$("#sign-in-github").onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: "github" });
  if (error) alert(error.message);
};
$("#sign-out").onclick = async () => { await supabase.auth.signOut(); };
if (localStorage.getItem("decision-shelf-theme") === "dark") document.body.classList.add("dark");
$("#today").textContent = new Intl.DateTimeFormat(undefined, { weekday:"long", month:"long", day:"numeric" }).format(new Date());
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = { name: session.user.user_metadata?.name || session.user.email, email: session.user.email };
    showApp();
  } else {
    currentUser = null;
    showAuth();
    setAuthMode("signin");
  }
});
