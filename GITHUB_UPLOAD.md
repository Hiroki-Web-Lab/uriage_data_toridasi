# GitHubへのアップロード手順

## 📋 事前準備

1. **GitHubアカウントを持っているか確認**
   - 持っていない場合：[github.com](https://github.com) でアカウントを作成

2. **Gitがインストールされているか確認**
   - PowerShellで以下を実行：
   ```powershell
   git --version
   ```
   - エラーが出る場合：[Git公式サイト](https://git-scm.com/) からインストール

---

## 🚀 アップロード手順

### ステップ1: GitHubでリポジトリを作成

1. [github.com](https://github.com) にログイン
2. 右上の「+」ボタン → 「New repository」をクリック
3. 以下を入力：
   - **Repository name**: `uriage-scraper`（好きな名前でOK）
   - **Description**: 「売上データ取り出しツール」（任意）
   - **Public** または **Private** を選択
   - **⚠️ 重要**: 「Initialize this repository with a README」のチェックは**外す**
4. 「Create repository」をクリック
5. 次の画面で表示されるURLをコピー（例：`https://github.com/あなたのユーザー名/uriage-scraper.git`）

---

### ステップ2: ローカルでGitリポジトリを初期化

PowerShellで以下のコマンドを**順番に**実行してください：

```powershell
# 1. プロジェクトフォルダに移動
cd "D:\Hiroki\Dropbox\バイブコーディング\売上データ取り出し"

# 2. Gitリポジトリを初期化
git init

# 3. すべてのファイルを追加
git add .

# 4. 初回コミット
git commit -m "初回コミット: 売上データ取り出しツール"

# 5. メインブランチを設定（GitHubのデフォルトに合わせる）
git branch -M main

# 6. リモートリポジトリを追加（ステップ1でコピーしたURLを使用）
# ⚠️ 以下のコマンドの「YOUR_GITHUB_URL」を、ステップ1でコピーしたURLに置き換えてください
git remote add origin YOUR_GITHUB_URL

# 7. GitHubにアップロード
git push -u origin main
```

---

### ステップ3: 認証

`git push` を実行すると、GitHubの認証が求められます：

- **Personal Access Token** を使用する方法（推奨）：
  1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. 「Generate new token (classic)」をクリック
  3. 「repo」にチェックを入れる
  4. トークンを生成してコピー
  5. パスワードの代わりにこのトークンを入力

- **GitHub CLI** を使用する方法：
  ```powershell
  gh auth login
  ```

---

## ✅ 確認

アップロードが成功すると、GitHubのリポジトリページに以下のファイルが表示されます：

- `package.json`
- `server.js`
- `scrapeUriage.js`
- `public/index.html`
- `render.yaml`
- `DEPLOY.md`
- `README.md`
- `.gitignore`

**⚠️ `node_modules/` フォルダは表示されないはずです**（`.gitignore`で除外されているため）

---

## 🔧 トラブルシューティング

### 「git: コマンドが見つかりません」

→ Gitがインストールされていません。[Git公式サイト](https://git-scm.com/) からインストールしてください。

### 「remote origin already exists」

→ 既にリモートリポジトリが設定されています。以下のコマンドで確認：
```powershell
git remote -v
```
別のURLに変更する場合：
```powershell
git remote set-url origin YOUR_NEW_GITHUB_URL
```

### 「Permission denied」エラー

→ GitHubの認証に失敗しています。Personal Access Tokenを正しく設定してください。

### 「fatal: not a git repository」

→ `git init` を実行していないか、間違ったフォルダにいます。正しいフォルダに移動して `git init` を実行してください。

---

## 📝 次回からの更新方法

ファイルを変更した後、GitHubに反映するには：

```powershell
cd "D:\Hiroki\Dropbox\バイブコーディング\売上データ取り出し"
git add .
git commit -m "変更内容の説明"
git push
```

---

## 🎯 次のステップ

GitHubへのアップロードが完了したら、`DEPLOY.md` の手順に従ってRailwayやRenderでデプロイできます！

