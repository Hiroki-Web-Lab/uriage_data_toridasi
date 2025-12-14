const DEFAULTS = {
  uriageAppUrl: "https://uriage-scraper-production.up.railway.app/",
  annualBudgetUrl: "https://annual-budget-nybz.vercel.app/summary",
};

async function getPhpSessId() {
  const cookie = await chrome.cookies.get({
    url: "https://hakataya.xsrv.jp/",
    name: "PHPSESSID",
  });
  return cookie?.value || null;
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return {
    uriageAppUrl: stored.uriageAppUrl || DEFAULTS.uriageAppUrl,
    annualBudgetUrl: stored.annualBudgetUrl || DEFAULTS.annualBudgetUrl,
  };
}

function isAllowedTargetUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".up.railway.app");
  } catch {
    return false;
  }
}

function isAllowedAnnualBudgetUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" && u.hostname === "annual-budget-nybz.vercel.app"
    );
  } catch {
    return false;
  }
}

async function waitForTabComplete(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab?.status === "complete") return;

  await new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureTab(url) {
  const u = new URL(url);
  const pattern = `${u.origin}/*`;
  const tabs = await chrome.tabs.query({ url: pattern });
  if (tabs[0]?.id) {
    // popupが閉じるのを避けるため、原則フォーカスしない（必要ならユーザーが自分で開く）
    await chrome.tabs.update(tabs[0].id, { active: false });
    await waitForTabComplete(tabs[0].id);
    return tabs[0];
  }
  const created = await chrome.tabs.create({ url, active: false });
  await waitForTabComplete(created.id);
  return created;
}

async function getOrOpenUriageTab() {
  const { uriageAppUrl } = await getSettings();
  if (!isAllowedTargetUrl(uriageAppUrl)) {
    throw new Error(
      `設定URLが許可ドメインではありません: ${uriageAppUrl}（*.up.railway.app のURLを設定してください）`
    );
  }
  return await ensureTab(uriageAppUrl);
}

async function getOrOpenAnnualBudgetTab() {
  const { annualBudgetUrl } = await getSettings();
  if (!isAllowedAnnualBudgetUrl(annualBudgetUrl)) {
    throw new Error(
      `設定URLが許可ドメインではありません: ${annualBudgetUrl}（annual-budget-nybz.vercel.app のURLを設定してください）`
    );
  }
  return await ensureTab(annualBudgetUrl);
}

async function findTargetTab() {
  // 1) いまアクティブなタブが対象アプリならそれを使う（設定URLと同一オリジン）
  const { uriageAppUrl } = await getSettings();
  const targetOrigin = new URL(uriageAppUrl).origin;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.url && active.url.startsWith(targetOrigin)) return active;

  // 2) それ以外は Railway の up.railway.app を検索して先頭を使う
  const tabs = await chrome.tabs.query({ url: `${targetOrigin}/*` });
  return tabs[0] || null;
}

async function injectAndRun(tabId, { phpsessid, submit }) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: ({ value, shouldSubmit }) => {
      const input =
        document.querySelector('input[name="phpsessid"]') ||
        document.querySelector("#phpsessid");
      if (!input) throw new Error("PHPSESSID入力欄が見つかりません");

      input.value = value;
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      if (shouldSubmit) {
        const submitBtn =
          document.querySelector("#submitBtn") ||
          document.querySelector('button[type="submit"]');
        const form =
          document.querySelector("#importForm") ||
          document.querySelector('form[action="/download"]');

        // 画面側のバリデーション（空チェック等）を通すため、クリックを優先
        if (submitBtn) {
          submitBtn.click();
        } else if (form) {
          form.requestSubmit?.();
          form.submit?.();
        } else {
          throw new Error("取り込みボタン/フォームが見つかりません");
        }
      }
    },
    args: [{ value: phpsessid, shouldSubmit: submit }],
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (!msg?.type) {
        sendResponse({ ok: false, error: "不正なメッセージです。" });
        return;
      }

      if (msg.type === "IMPORT_TO_ANNUAL_BUDGET") {
        const files = msg.files;
        if (!Array.isArray(files) || files.length === 0) {
          sendResponse({ ok: false, error: "投入するCSVがありません。" });
          return;
        }

        const tab = await getOrOpenAnnualBudgetTab();
        if (!tab?.id) {
          sendResponse({
            ok: false,
            error:
              "年間予算アプリのタブが見つかりません。設定のURLを確認してください。",
          });
          return;
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: async ({ files }) => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

            // React側で描画が遅れることがあるので最大5秒待つ
            let input = null;
            for (let i = 0; i < 25; i++) {
              input =
                document.querySelector(
                  'input[type="file"][accept=".csv"][multiple]'
                ) ||
                document.querySelector('input[type="file"][accept=".csv"]') ||
                document.querySelector('input[type="file"]');
              if (input) break;
              await sleep(200);
            }

            if (!input) {
              throw new Error(
                "CSV取り込み用の input[type=file] が見つかりません（/summary を開いているか確認してください）"
              );
            }

            const dt = new DataTransfer();
            for (const f of files) {
              if (!f?.name || typeof f?.text !== "string") {
                throw new Error("投入データ形式が不正です（name/textが必要）");
              }
              // annual-budget側は File.text() で読むので、UTF-8のテキストとして渡すのが最も安定
              dt.items.add(new File([f.text], f.name, { type: "text/csv" }));
            }

            // ファイル投入 → change発火
            input.files = dt.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          },
          args: [{ files }],
        });

        sendResponse({
          ok: true,
          message: `年間予算アプリにCSV ${files.length}件を投入しました。`,
        });
        return;
      }

      const phpsessid = await getPhpSessId();
      if (!phpsessid) {
        sendResponse({
          ok: false,
          error:
            "PHPSESSIDが取得できません（未ログイン/セッション切れの可能性）。先に https://hakataya.xsrv.jp にログインしてください。",
        });
        return;
      }

      // タブが無ければ、設定URLを自動で開く（要望対応）
      const tab = (await findTargetTab()) ?? (await getOrOpenUriageTab());
      if (!tab?.id) {
        sendResponse({
          ok: false,
          error:
            "取り込みアプリのタブが見つかりません。先に Railway アプリ（https://xxxxx.up.railway.app）を開いてください。",
        });
        return;
      }

      const submit = msg.type === "FILL_AND_RUN";
      await injectAndRun(tab.id, { phpsessid, submit });
      sendResponse({
        ok: true,
        message: submit
          ? "自動入力して「取り込み」を実行しました。ダウンロードが始まるのを待ってください。"
          : "自動入力しました。",
      });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message ?? String(e) });
    }
  })();

  // async response
  return true;
});


