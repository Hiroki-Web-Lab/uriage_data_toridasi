import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// ★ ここを変更すれば、取得したい月と店舗IDをまとめて指定できます
const TARGET_MONTH = "2025-11-01"; // 例: "2025-11-01"
const TENPO_IDS = [1, 2, 3]; // 取得したい店舗IDを配列で並べる

// ★ PHPSESSID は毎回ログイン後の値に書き換えてください
const COOKIE_VALUE = "481ba121fb0c131cb9727bdbcb7e9fa8";

async function fetchUriageForTenpo(month, tenpoId, cookieValue) {
  const url = `https://hakataya.xsrv.jp/uriage_list.html?month=${month}&tenpo_id=${tenpoId}`;

  const res = await axios.get(url, {
    headers: {
      Cookie: `PHPSESSID=${cookieValue}`,
    },
  });

  const $ = cheerio.load(res.data);

  // ページ内の一番最初の table を対象にする
  const table = $("table").first();

  const rows = [];
  table.find("tr").each((_, tr) => {
    const cols = [];
    $(tr)
      .find("th, td")
      .each((_, td) => {
        cols.push($(td).text().trim());
      });
    // 空行は除外
    if (cols.length > 0) {
      rows.push(cols);
    }
  });

  return rows;
}

async function main() {
  // 複数店舗を順番に処理
  for (const tenpoId of TENPO_IDS) {
    console.log(`▶ 店舗ID ${tenpoId} を取得中...`);

    const rows = await fetchUriageForTenpo(TARGET_MONTH, tenpoId, COOKIE_VALUE);

    // ファイル名に店舗IDと月を含める（例: uriage_2025-11-01_tenpo2.csv）
    const baseName = `uriage_${TARGET_MONTH}_tenpo${tenpoId}`;

    // JSON 保存
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(rows, null, 2), "utf-8");

    // CSV 変換（カンマ区切り）
    const csv = rows.map((r) => r.join(",")).join("\n");
    fs.writeFileSync(`${baseName}.csv`, csv, "utf-8");

    console.log(`✅ 完了：${baseName}.json / ${baseName}.csv を出力しました`);
  }

  console.log("🎉 すべての店舗の取得が完了しました");
}

main().catch((e) => console.error(e));


