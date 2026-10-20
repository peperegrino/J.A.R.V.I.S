const KEY = "jarvis.cyber.v2";
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ workouts: [], studies: [], notes: [], finance: [], tasks: [], chat: [] });
let data = blank();
let serverOn = false; // true quando o server.js está respondendo
const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "Sem data");
function setStatus(on) {
  const el = $("saveStatus");
  el.textContent = on ? "● SALVO NO DISCO (data.json)" : "○ SÓ NO NAVEGADOR — rode: node server.js";
  el.style.color = on ? "var(--lime)" : "var(--orange)";
}
function hasContent(d) {
  return ["workouts", "studies", "notes", "finance", "tasks"].some((k) => (d[k] || []).length);
}
function putToServer() {
  return fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => {
    if (!r.ok) throw new Error("PUT falhou");
    setStatus(true);
  });
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(data)); // cópia de segurança no navegador
  if (serverOn) putToServer().catch(() => setStatus(false));
  render();
}
// Ao abrir: lê o disco (fonte principal). Se o disco estiver vazio e o navegador tiver dados, migra.
async function init() {
  let local = {};
  try {
    local = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {}
  data = { ...blank(), ...local };
  try {
    const r = await fetch("/api/data");
    if (!r.ok) throw new Error("sem servidor");
    const remote = await r.json();
    serverOn = true;
    if (hasContent(remote)) data = { ...blank(), ...remote };
    else if (hasContent(local)) await putToServer();
    setStatus(true);
  } catch {
    serverOn = false;
    setStatus(false);
  }
  setDateDefaults();
  render();
  loadAiConfig();
}
function esc(s = "") {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
function empty(msg) {
  return `<div class="empty">${msg}</div>`;
}
function item(title, meta, right = "", done = false, del = "") {
  return `<div class="item ${done ? "done" : ""}"><div class="item-main"><div class="item-title">${title}</div><div class="item-meta">${meta}</div></div>${right}${del}</div>`;
}
function setDateDefaults() {
  document.querySelectorAll("input[type=date]").forEach((x) => {
    if (!x.value) x.value = today();
  });
}
function renderMain() {
  const open = data.tasks.filter((t) => !t.done),
    done = data.tasks.length - open.length,
    inc = data.finance.filter((x) => x.type === "in").reduce((a, x) => a + Number(x.amount), 0),
    out = data.finance.filter((x) => x.type === "out").reduce((a, x) => a + Number(x.amount), 0);
  $("statTasks").textContent = open.length;
  $("statWorkout").textContent = data.workouts.length;
  $("statStudy").textContent = data.studies.length;
  $("statBalance").textContent = money(inc - out);
  $("dashTasks").innerHTML =
    data.tasks
      .filter((t) => !t.done)
      .slice(0, 5)
      .map((t) =>
        item(
          esc(t.title),
          `${esc(t.category)} · ${dateFmt(t.date)}`,
          '<span class="tag">PENDENTE</span>',
        ),
      )
      .join("") || empty("Tudo em dia. Adicione tarefas na seção Dia a dia.");
  $("dashNotes").innerHTML =
    [...data.notes]
      .slice(-4)
      .reverse()
      .map((n) => item(esc(n.title), dateFmt(n.date)))
      .join("") || empty("Suas anotações aparecerão aqui.");
  $("workoutCount").textContent = data.workouts.length;
  $("workoutMinutes").textContent =
    data.workouts.reduce((a, x) => a + Number(x.duration), 0) + " min";
  $("workoutList").innerHTML =
    [...data.workouts]
      .reverse()
      .map((x, i) =>
        item(
          esc(x.name),
          `${dateFmt(x.date)} · ${x.duration} min${x.details ? " · " + esc(x.details) : ""}`,
          '<span class="tag" style="color:var(--pink)">LOG</span>',
          false,
          `<button class="btn danger" onclick="removeItem('workouts','${x.id}')">×</button>`,
        ),
      )
      .join("") || empty("Nenhum treino registrado ainda.");
  $("studyCount").textContent = data.studies.length;
  $("studyMinutes").textContent = data.studies.reduce((a, x) => a + Number(x.duration), 0) + " min";
  $("studyList").innerHTML =
    [...data.studies]
      .reverse()
      .map((x) =>
        item(
          esc(x.subject),
          `${dateFmt(x.date)} · ${x.duration} min${x.details ? " · " + esc(x.details) : ""}`,
          '<span class="tag">FOCUS</span>',
          false,
          `<button class="btn danger" onclick="removeItem('studies','${x.id}')">×</button>`,
        ),
      )
      .join("") || empty("Nenhuma sessão de estudo registrada.");
  $("noteList").innerHTML =
    [...data.notes]
      .reverse()
      .map(
        (n) =>
          `<button class="btn ${$("noteForm").elements.id.value === n.id ? "active-note" : ""}" onclick="editNote('${n.id}')">${esc(n.title || "Sem título")}</button>`,
      )
      .join("") || '<p class="small">Nenhuma nota salva.</p>';
  $("finBalance").textContent = money(inc - out);
  $("finIn").textContent = money(inc);
  $("finOut").textContent = money(out);
  $("finCount").textContent = data.finance.length;
  $("financeList").innerHTML =
    [...data.finance]
      .reverse()
      .map((x) =>
        item(
          esc(x.title),
          `${esc(x.category)} · ${dateFmt(x.date)}`,
          `<span class="amount ${x.type === "in" ? "positive" : "negative"}">${x.type === "in" ? "+" : "−"}${money(x.amount)}</span>`,
          false,
          `<button class="btn danger" onclick="removeItem('finance','${x.id}')">×</button>`,
        ),
      )
      .join("") || empty("Nenhum lançamento financeiro.");
  $("taskList").innerHTML =
    [...data.tasks]
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map(
        (t) =>
          `<div class="item ${t.done ? "done" : ""}"><input class="check" type="checkbox" ${t.done ? "checked" : ""} onchange="toggleTask('${t.id}')"><div class="item-main"><div class="item-title">${esc(t.title)}</div><div class="item-meta">${esc(t.category)} · ${dateFmt(t.date)}</div></div><button class="btn danger" onclick="removeItem('tasks','${t.id}')">×</button></div>`,
      )
      .join("") || empty("Sua lista está vazia. Adicione uma tarefa acima.");
  const pct = data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0;
  $("taskProgress").textContent = pct + "%";
  $("taskBar").style.width = pct + "%";
  $("taskSummary").textContent = `${done} de ${data.tasks.length} tarefas concluídas.`;
}
function removeItem(group, id) {
  data[group] = data[group].filter((x) => x.id !== id);
  save();
}
function toggleTask(id) {
  data.tasks = data.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  save();
}
function id() {
  return Math.random().toString(36).slice(2, 10);
}
function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function onSubmit(id, group, mapper) {
  $(id).addEventListener("submit", (e) => {
    e.preventDefault();
    const f = formData(e.target);
    data[group].push({ id: idFn(), ...mapper(f) });
    e.target.reset();
    setDateDefaults();
    save();
  });
}
function idFn() {
  return id();
}
onSubmit("workoutForm", "workouts", (f) => ({ ...f, duration: Number(f.duration) }));
onSubmit("studyForm", "studies", (f) => ({ ...f, duration: Number(f.duration) }));
onSubmit("financeForm", "finance", (f) => ({ ...f, amount: Number(f.amount) }));
onSubmit("taskForm", "tasks", (f) => ({ ...f, done: false }));
let selectedNote = null;
function editNote(noteId) {
  const n = data.notes.find((x) => x.id === noteId);
  if (!n) return;
  selectedNote = n.id;
  const f = $("noteForm");
  f.elements.id.value = n.id;
  f.elements.title.value = n.title;
  f.elements.body.value = n.body;
  render();
}
$("newNote").onclick = () => {
  selectedNote = null;
  $("noteForm").reset();
  $("noteForm").elements.id.value = "";
  setDateDefaults();
  $("noteForm").elements.title.focus();
  render();
};
$("noteForm").onsubmit = (e) => {
  e.preventDefault();
  const f = formData(e.target),
    old = data.notes.find((n) => n.id === f.id);
  if (old) Object.assign(old, { title: f.title, body: f.body, date: today() });
  else {
    const n = { id: id(), title: f.title, body: f.body, date: today() };
    data.notes.push(n);
    selectedNote = n.id;
  }
  e.target.elements.id.value = selectedNote || "";
  save();
};
$("deleteNote").onclick = () => {
  const noteId = $("noteForm").elements.id.value;
  if (!noteId) return;
  data.notes = data.notes.filter((n) => n.id !== noteId);
  selectedNote = null;
  $("noteForm").reset();
  save();
};
$("clearDone").onclick = () => {
  data.tasks = data.tasks.filter((t) => !t.done);
  save();
};
document.querySelectorAll("[data-page]").forEach((b) => (b.onclick = () => go(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach((b) => (b.onclick = () => go(b.dataset.goto)));
function go(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("hidden", p.id !== page));
  document
    .querySelectorAll(".nav[data-page]")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("crumb").textContent = page.toUpperCase();
  $("sidebar").classList.remove("open");
  window.scrollTo(0, 0);
}
$("menuBtn").onclick = () => $("sidebar").classList.toggle("open");
function tick() {
  $("clock").textContent = new Date().toLocaleTimeString("pt-BR");
  $("today").textContent = new Date()
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}
tick();
setInterval(tick, 1000);

// ===================== ASSISTENTE (Gemini via servidor local) =====================
function render() {
  renderMain();
  renderChat();
}

let ai = { hasKey: false, model: "gemini-2.5-flash" };
let chatBusy = false;

async function loadAiConfig() {
  try {
    const r = await fetch("/api/config");
    if (r.ok) ai = await r.json();
  } catch {}
  updateAiUi();
  if (serverOn && !ai.hasKey) $("cfgBox").classList.remove("hidden");
}
function updateAiUi() {
  $("aiStatus").textContent = !serverOn
    ? "SERVIDOR OFF"
    : ai.hasKey
      ? "ONLINE · " + ai.model.toUpperCase()
      : "SEM CHAVE";
  $("cfgModel").value = ai.model;
}
$("cfgToggle").onclick = () => $("cfgBox").classList.toggle("hidden");
$("cfgSave").onclick = async () => {
  const body = { model: $("cfgModel").value.trim() || "gemini-2.5-flash" };
  const key = $("cfgKey").value.trim();
  if (key) body.key = key;
  try {
    const r = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    ai = await r.json();
    $("cfgKey").value = "";
    $("cfgBox").classList.add("hidden");
  } catch {}
  updateAiUi();
};

function renderChat() {
  const log = $("chatLog");
  const fmt = (t) =>
    esc(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  const msgs = data.chat
    .map(
      (m) =>
        `<div class="msg ${m.role === "user" ? "user" : "model"}${m.error ? " error" : ""}">${fmt(m.text)}</div>`,
    )
    .join("");
  log.innerHTML =
    (msgs ||
      empty(
        'Pergunte sobre seus dados ou dê uma ordem: "registre um treino de pernas de 50 minutos".',
      )) + (chatBusy ? '<div class="msg model typing">Pensando…</div>' : "");
  log.scrollTop = log.scrollHeight;
}

function aiContext() {
  const L = (arr, fn, n = 15) => arr.slice(-n).map(fn).join("\n") || "nenhum";
  const inc = data.finance.filter((x) => x.type === "in").reduce((a, x) => a + Number(x.amount), 0);
  const out = data.finance
    .filter((x) => x.type === "out")
    .reduce((a, x) => a + Number(x.amount), 0);
  return [
    "Tarefas:\n" +
      L(data.tasks, (t) => `- [${t.done ? "x" : " "}] ${t.title} (${t.category}, ${t.date})`, 30),
    "Treinos:\n" + L(data.workouts, (w) => `- ${w.date} ${w.name}, ${w.duration} min`),
    "Estudos:\n" + L(data.studies, (x) => `- ${x.date} ${x.subject}, ${x.duration} min`),
    `Finanças (saldo ${money(inc - out)}):\n` +
      L(
        data.finance,
        (f) => `- ${f.date} ${f.type === "in" ? "+" : "-"}${f.amount} ${f.title} (${f.category})`,
        20,
      ),
    "Notas:\n" +
      L(data.notes, (n) => `- ${n.title}: ${(n.body || "").slice(0, 200).replace(/\n/g, " ")}`, 10),
  ].join("\n");
}

// Esquema que obriga o Gemini a responder em JSON: { resposta, acao }
const AI_SCHEMA = {
  type: "OBJECT",
  properties: {
    resposta: { type: "STRING" },
    acao: {
      type: "OBJECT",
      nullable: true,
      properties: {
        tipo: {
          type: "STRING",
          format: "enum",
          enum: ["tarefa", "nota", "treino", "estudo", "financeiro"],
        },
        titulo: { type: "STRING" },
        texto: { type: "STRING" },
        data: { type: "STRING" },
        categoria: { type: "STRING" },
        duracao: { type: "NUMBER" },
        valor: { type: "NUMBER" },
        movimento: { type: "STRING", format: "enum", enum: ["entrada", "despesa"] },
      },
      required: ["tipo", "titulo"],
    },
  },
  required: ["resposta"],
};

async function askGemini() {
  const system = `Você é o Jarvis, assistente pessoal do usuário, rodando localmente. Responda em português, curto e direto.
Hoje é ${new Date().toLocaleDateString("pt-BR", { dateStyle: "full" })} (${today()}).
Responda sempre no formato JSON pedido. Quando o usuário pedir para registrar algo (tarefa, nota, treino, estudo ou lançamento financeiro), preencha "acao" e confirme em "resposta". No máximo uma ação por resposta. Datas no formato AAAA-MM-DD; se não informada, use a data de hoje. Se faltar um dado essencial (ex.: o valor de uma despesa), pergunte em "resposta" e deixe "acao" nulo. Nos demais casos, "acao" deve ser nulo.
Dados atuais do usuário:
${aiContext()}`;

  let hist = data.chat.filter((m) => !m.error).slice(-12);
  while (hist.length && hist[0].role !== "user") hist.shift(); // Gemini exige começar por "user"

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: hist.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })),
      generationConfig: { responseMimeType: "application/json", responseSchema: AI_SCHEMA },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Erro " + r.status);
  const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  try {
    return JSON.parse(t);
  } catch {
    return { resposta: t || "(sem resposta)" };
  }
}

// Executa a ação pedida pelo Gemini. Devolve um texto de confirmação, ou null se faltou dado.
function applyAction(a) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(a.data || "") ? a.data : today();
  const title = String(a.titulo || "").trim();
  if (!title) return null;
  switch (a.tipo) {
    case "tarefa":
      data.tasks.push({ id: id(), title, category: a.categoria || "Rotina", date, done: false });
      return "✓ Tarefa criada.";
    case "nota":
      data.notes.push({ id: id(), title, body: a.texto || "", date });
      return "✓ Nota salva.";
    case "treino":
      if (!(a.duracao > 0)) return null;
      data.workouts.push({
        id: id(),
        name: title,
        duration: Number(a.duracao),
        date,
        details: a.texto || "",
      });
      return "✓ Treino registrado.";
    case "estudo":
      if (!(a.duracao > 0)) return null;
      data.studies.push({
        id: id(),
        subject: title,
        duration: Number(a.duracao),
        date,
        details: a.texto || "",
      });
      return "✓ Sessão de estudo registrada.";
    case "financeiro":
      if (!(a.valor > 0)) return null;
      data.finance.push({
        id: id(),
        title,
        date,
        type: a.movimento === "entrada" ? "in" : "out",
        amount: Number(a.valor),
        category: a.categoria || "Outros",
      });
      return "✓ Lançamento adicionado.";
  }
  return null;
}

async function sendChat(text) {
  text = text.trim();
  if (!text || chatBusy) return;
  data.chat.push({ role: "user", text });
  chatBusy = true;
  renderChat();
  try {
    const out = await askGemini();
    let reply = out.resposta || "(sem resposta)";
    if (out.acao) {
      const done = applyAction(out.acao);
      reply += done ? "\n\n" + done : "\n\n⚠ Não consegui registrar: faltou algum dado.";
    }
    data.chat.push({ role: "model", text: reply });
  } catch (e) {
    data.chat.push({
      role: "model",
      error: true,
      text: "Não consegui responder: " + e.message + ". Verifique a chave e o modelo em ⚙.",
    });
  }
  data.chat = data.chat.slice(-60);
  chatBusy = false;
  save();
}
$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const v = $("chatInput").value;
  $("chatInput").value = "";
  sendChat(v);
};
$("chatClear").onclick = () => {
  data.chat = [];
  save();
};

setDateDefaults();
init();
