const statusEl = document.getElementById("status");
const fillOnlyBtn = document.getElementById("fillOnlyBtn");
const fillAndRunBtn = document.getElementById("fillAndRunBtn");
const autoImportBtn = document.getElementById("autoImportBtn");
const pickZipBtn = document.getElementById("pickZipBtn");
const zipPicker = document.getElementById("zipPicker");
const openOptionsLink = document.getElementById("openOptions");

function setStatus(text, { error = false } = {}) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", Boolean(error));
}

function setBusy(isBusy) {
  fillOnlyBtn.disabled = isBusy;
  fillAndRunBtn.disabled = isBusy;
  if (autoImportBtn) autoImportBtn.disabled = isBusy;
  if (pickZipBtn) pickZipBtn.disabled = isBusy;
}

async function run(action) {
  setBusy(true);
  setStatus("処理中…");
  try {
    const resp = await chrome.runtime.sendMessage({ type: action });
    if (!resp?.ok) {
      setStatus(resp?.error ?? "失敗しました。", { error: true });
      return;
    }
    setStatus(resp.message ?? "完了しました。");
  } catch (e) {
    setStatus(e?.message ?? String(e), { error: true });
  } finally {
    setBusy(false);
  }
}

fillOnlyBtn.addEventListener("click", () => run("FILL_ONLY"));
fillAndRunBtn.addEventListener("click", () => run("FILL_AND_RUN"));

async function readAll(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function u16(dv, off) {
  return dv.getUint16(off, true);
}
function u32(dv, off) {
  return dv.getUint32(off, true);
}

async function unzipCsvFiles(zipArrayBuffer) {
  const dv = new DataView(zipArrayBuffer);
  const bytes = new Uint8Array(zipArrayBuffer);

  // EOCD: 0x06054b50 を末尾から探索（最大 64KB + 22）
  const maxScan = Math.min(bytes.length, 22 + 0xffff);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= bytes.length - maxScan; i--) {
    if (i < 0) break;
    if (u32(dv, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("ZIPの終端情報(EOCD)が見つかりません");

  const cdSize = u32(dv, eocdOffset + 12);
  const cdOffset = u32(dv, eocdOffset + 16);

  const files = [];
  let ptr = cdOffset;
  const cdEnd = cdOffset + cdSize;
  while (ptr < cdEnd) {
    if (u32(dv, ptr) !== 0x02014b50) break; // Central dir header

    const compression = u16(dv, ptr + 10);
    const compressedSize = u32(dv, ptr + 20);
    const uncompressedSize = u32(dv, ptr + 24);
    const fileNameLen = u16(dv, ptr + 28);
    const extraLen = u16(dv, ptr + 30);
    const commentLen = u16(dv, ptr + 32);
    const localHeaderOffset = u32(dv, ptr + 42);

    const nameBytes = bytes.slice(ptr + 46, ptr + 46 + fileNameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);
    const baseName = name.split("/").pop() || "";

    ptr = ptr + 46 + fileNameLen + extraLen + commentLen;

    if (!baseName.toLowerCase().endsWith(".csv")) continue;

    // local file header: 0x04034b50
    if (u32(dv, localHeaderOffset) !== 0x04034b50) {
      throw new Error(`ZIPのローカルヘッダが不正です: ${baseName}`);
    }
    const lfNameLen = u16(dv, localHeaderOffset + 26);
    const lfExtraLen = u16(dv, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lfNameLen + lfExtraLen;
    const dataEnd = dataStart + compressedSize;
    const compressed = bytes.slice(dataStart, dataEnd);

    let outBytes;
    if (compression === 0) {
      // stored
      outBytes = compressed;
    } else if (compression === 8) {
      // deflate
      const ds = new DecompressionStream("deflate-raw");
      const decompressedStream = new Blob([compressed]).stream().pipeThrough(ds);
      outBytes = await readAll(decompressedStream);
      if (uncompressedSize && outBytes.byteLength !== uncompressedSize) {
        // サイズ不一致でも致命ではないが、念のため警告
      }
    } else {
      throw new Error(
        `未対応の圧縮方式です（method=${compression}）: ${baseName}`
      );
    }

    files.push({
      name: baseName,
      bytes: outBytes.buffer.slice(outBytes.byteOffset, outBytes.byteOffset + outBytes.byteLength),
    });
  }

  if (files.length === 0) throw new Error("ZIP内にCSVが見つかりません");
  return files;
}

async function autoImportFlow() {
  setBusy(true);
  setStatus("ZIPダウンロード開始中…");
  const resp = await chrome.runtime.sendMessage({ type: "FILL_AND_RUN" });
  if (!resp?.ok) throw new Error(resp?.error ?? "失敗しました。");

  // ブラウザ仕様: ファイル選択ダイアログはユーザー操作(クリック)直後でないと開けない
  // ここでは次のクリックで開けるようにボタンを出す
  if (pickZipBtn) pickZipBtn.style.display = "block";
  setStatus("ZIPがダウンロードされたら「ZIPを選択 → 年間予算へ投入」を押してください。");
  setBusy(false);
}

autoImportBtn?.addEventListener("click", autoImportFlow);

pickZipBtn?.addEventListener("click", () => {
  zipPicker.value = "";
  zipPicker.click();
});

zipPicker?.addEventListener("change", async () => {
  const zipFile = zipPicker.files?.[0];
  if (!zipFile) {
    setStatus("キャンセルしました");
    return;
  }

  try {
    setBusy(true);
    setStatus("ZIPを解凍中…");
    const buf = await zipFile.arrayBuffer();
    const csvFiles = await unzipCsvFiles(buf);
    setStatus(`CSV ${csvFiles.length}件を年間予算へ投入中…`);

    const resp = await chrome.runtime.sendMessage({
      type: "IMPORT_TO_ANNUAL_BUDGET",
      files: csvFiles,
    });
    if (!resp?.ok) {
      setStatus(resp?.error ?? "投入に失敗しました。", { error: true });
      return;
    }
    setStatus(resp.message ?? "投入しました。");
    if (pickZipBtn) pickZipBtn.style.display = "none";
  } catch (e) {
    setStatus(e?.message ?? String(e), { error: true });
  } finally {
    setBusy(false);
  }
});

openOptionsLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await chrome.runtime.openOptionsPage();
  } catch (err) {
    // 一部環境で openOptionsPage が失敗することがあるのでフォールバック
    await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  }
});

setStatus("準備OK");


