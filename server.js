import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import archiver from "archiver";
import path from "path";
import { fileURLToPath } from "url";
import iconv from "iconv-lite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 店舗情報
const TENPO_NAMES = {
  2: "八田店",
  4: "松島店",
  5: "古賀店",
  7: "鳥栖店",
  50: "野芥店",
};

// 店舗グループ定義（全店舗など）
// 全店舗＝ID2,4,5,7,50
const TENPO_GROUPS = {
  all: { name: "全店舗", ids: [2, 4, 5, 7, 50] },
  hatta: { name: "八田店", ids: [2] },
  matsushima: { name: "松島店", ids: [4] },
  koga: { name: "古賀店", ids: [5] },
  tosu: { name: "鳥栖店", ids: [7] },
  noge: { name: "野芥店", ids: [50] },
};

// 月の指定（今月 or 先月 or 任意）から "YYYY-MM-01" を作る
function getMonthString(period, customYear = null, customMonth = null) {
  if (period === "custom" && customYear && customMonth) {
    // 任意の年月が指定された場合
    const year = parseInt(customYear, 10);
    // customMonthは "01", "02" などの文字列で来る可能性があるので、parseIntで数値に変換
    const month = parseInt(customMonth, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new Error(`無効な年月が指定されました: 年=${customYear}, 月=${customMonth}`);
    }
    // 月は既に2桁の文字列（"01"など）で来る可能性があるので、そのまま使うか、数値から再生成
    const monthStr = String(month).padStart(2, "0");
    return `${year}-${monthStr}-01`;
  }

  // 今月 or 先月
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-11

  if (period === "last") {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  const mm = String(month + 1).padStart(2, "0");
  return `${year}-${mm}-01`;
}

async function fetchUriageForTenpo(month, tenpoId, cookieValue) {
  const url = `https://hakataya.xsrv.jp/uriage_list.html?month=${month}&tenpo_id=${tenpoId}`;

  const res = await axios.get(url, {
    headers: {
      Cookie: `PHPSESSID=${cookieValue}`,
    },
  });

  const $ = cheerio.load(res.data);

  const table = $("table").first();
  const rows = [];

  table.find("tr").each((_, tr) => {
    const cols = [];
    $(tr)
      .find("th, td")
      .each((_, td) => {
        cols.push($(td).text().trim());
      });
    if (cols.length > 0) {
      rows.push(cols);
    }
  });

  return rows;
}

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ホーム画面
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 取り込みボタン押下時
app.post("/download", async (req, res) => {
  const { period, store, phpsessid, customYear, customMonth } = req.body;

  // デバッグ用ログ（本番環境では削除推奨）
  console.log("受信したパラメータ:", { period, customYear, customMonth });

  if (!phpsessid) {
    return res.status(400).send("PHPSESSID を入力してください。");
  }

  const group = TENPO_GROUPS[store];
  if (!group) {
    return res.status(400).send("店舗の選択が不正です。");
  }

  let monthStr;
  try {
    monthStr = getMonthString(period, customYear, customMonth);
    console.log("生成された月文字列:", monthStr);
  } catch (e) {
    console.error("月文字列生成エラー:", e.message);
    return res.status(400).send(e.message);
  }
  const monthLabel = monthStr.slice(0, 7); // "YYYY-MM-01" → "YYYY-MM"
  // ヘッダーに入れるファイル名は ASCII のみを使う（日本語はエラーになるため）
  const fileLabel = period === "last" ? "last" : "this";

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="uriage_${fileLabel}_${store}.zip"`
  );
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).send("ZIP 作成中にエラーが発生しました。");
    }
  });

  archive.pipe(res);

  // CSVの値をダブルクォートで囲む（カンマを含む値でも正しく列分けされるように）
  function escapeCsvValue(value) {
    if (value === null || value === undefined) {
      return "";
    }
    const str = String(value);
    // カンマ、改行、ダブルクォートが含まれる場合はダブルクォートで囲む
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  try {
    for (const tenpoId of group.ids) {
      console.log(`▶ 店舗ID ${tenpoId} (${group.name}) を取得中...`);
      const rows = await fetchUriageForTenpo(monthStr, tenpoId, phpsessid);
      // 各セルをダブルクォートで囲む（数値内のカンマが区切りとして解釈されないように）
      const csvUtf8 = rows
        .map((r) => r.map(escapeCsvValue).join(","))
        .join("\n");
      const storeName = TENPO_NAMES[tenpoId] || `tenpo${tenpoId}`;
      // 例: "2025-11_八田店.csv"
      const fileName = `${monthLabel}_${storeName}.csv`;
      // Excel（日本語環境）で開きやすいように Shift_JIS に変換
      const csvShiftJis = iconv.encode(csvUtf8, "Shift_JIS");
      archive.append(csvShiftJis, { name: fileName });
    }
    await archive.finalize();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res
        .status(500)
        .send("データ取得中にエラーが発生しました。PHPSESSID などを確認してください。");
    } else {
      archive.abort();
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ サーバ起動: http://localhost:${PORT}`);
});


