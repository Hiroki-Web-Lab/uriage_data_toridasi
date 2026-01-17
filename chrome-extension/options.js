const DEFAULTS = {
  uriageAppUrl: "https://uriage-data-toridasi.onrender.com/",
  annualBudgetUrl: "https://annual-budget-nybz.vercel.app/summary",
};

const uriageAppUrlEl = document.getElementById("uriageAppUrl");
const annualBudgetUrlEl = document.getElementById("annualBudgetUrl");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

function setStatus(text, { error = false } = {}) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", Boolean(error));
}

function normalizeUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const u = new URL(trimmed);
  // 末尾スラッシュが無いと url-pattern 検索の都合が悪いので整える（/summary等は残る）
  return u.toString();
}

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  uriageAppUrlEl.value = stored.uriageAppUrl || DEFAULTS.uriageAppUrl;
  annualBudgetUrlEl.value =
    stored.annualBudgetUrl || DEFAULTS.annualBudgetUrl;
  setStatus("読み込み完了");
}

async function save() {
  try {
    setStatus("保存中…");
    const uriageAppUrl = normalizeUrl(uriageAppUrlEl.value || DEFAULTS.uriageAppUrl);
    const annualBudgetUrl = normalizeUrl(
      annualBudgetUrlEl.value || DEFAULTS.annualBudgetUrl
    );

    await chrome.storage.sync.set({ uriageAppUrl, annualBudgetUrl });
    setStatus("保存しました");
  } catch (e) {
    setStatus(e?.message ?? String(e), { error: true });
  }
}

saveBtn.addEventListener("click", save);
load().catch((e) => setStatus(e?.message ?? String(e), { error: true }));


