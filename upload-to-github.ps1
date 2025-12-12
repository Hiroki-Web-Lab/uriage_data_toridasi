# GitHubへのアップロードスクリプト
# 使用方法: PowerShellでこのファイルを右クリック → 「PowerShellで実行」

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GitHubアップロードスクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 現在のディレクトリに移動
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Gitがインストールされているか確認
Write-Host "Gitのインストールを確認中..." -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "✓ Gitが見つかりました: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Gitがインストールされていません" -ForegroundColor Red
    Write-Host "  https://git-scm.com/ からインストールしてください" -ForegroundColor Red
    Read-Host "Enterキーを押して終了"
    exit 1
}

Write-Host ""

# Gitリポジトリが初期化されているか確認
if (Test-Path .git) {
    Write-Host "✓ Gitリポジトリは既に初期化されています" -ForegroundColor Green
} else {
    Write-Host "Gitリポジトリを初期化中..." -ForegroundColor Yellow
    git init
    Write-Host "✓ 初期化完了" -ForegroundColor Green
}

Write-Host ""

# ファイルを追加
Write-Host "ファイルを追加中..." -ForegroundColor Yellow
git add .
Write-Host "✓ ファイル追加完了" -ForegroundColor Green

Write-Host ""

# コミット
Write-Host "コミット中..." -ForegroundColor Yellow
$commitMessage = Read-Host "コミットメッセージを入力してください（Enterで「初回コミット」を使用）"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "初回コミット: 売上データ取り出しツール"
}
git commit -m $commitMessage
Write-Host "✓ コミット完了" -ForegroundColor Green

Write-Host ""

# ブランチ名を確認・設定
Write-Host "ブランチ名を確認中..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
if ($null -eq $currentBranch) {
    git branch -M main
    Write-Host "✓ ブランチ名を「main」に設定しました" -ForegroundColor Green
} else {
    Write-Host "✓ 現在のブランチ: $currentBranch" -ForegroundColor Green
}

Write-Host ""

# リモートリポジトリの設定
Write-Host "リモートリポジトリの設定" -ForegroundColor Yellow
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl) {
    Write-Host "✓ 既存のリモートURL: $remoteUrl" -ForegroundColor Green
    $changeRemote = Read-Host "リモートURLを変更しますか？ (y/n)"
    if ($changeRemote -eq "y" -or $changeRemote -eq "Y") {
        $newUrl = Read-Host "新しいGitHubリポジトリのURLを入力してください（例: https://github.com/ユーザー名/リポジトリ名.git）"
        git remote set-url origin $newUrl
        Write-Host "✓ リモートURLを更新しました" -ForegroundColor Green
    }
} else {
    Write-Host "リモートリポジトリが設定されていません" -ForegroundColor Yellow
    $newUrl = Read-Host "GitHubリポジトリのURLを入力してください（例: https://github.com/ユーザー名/リポジトリ名.git）"
    if ($newUrl) {
        git remote add origin $newUrl
        Write-Host "✓ リモートリポジトリを追加しました" -ForegroundColor Green
    } else {
        Write-Host "✗ URLが入力されませんでした。後で手動で設定してください:" -ForegroundColor Red
        Write-Host "  git remote add origin YOUR_GITHUB_URL" -ForegroundColor Yellow
        Read-Host "Enterキーを押して終了"
        exit 1
    }
}

Write-Host ""

# プッシュ
Write-Host "GitHubにアップロード中..." -ForegroundColor Yellow
Write-Host "（認証が求められる場合があります）" -ForegroundColor Yellow
Write-Host ""
try {
    git push -u origin main
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ アップロード完了！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "✗ アップロードに失敗しました" -ForegroundColor Red
    Write-Host "  エラー内容を確認してください" -ForegroundColor Red
    Write-Host ""
    Write-Host "よくある原因:" -ForegroundColor Yellow
    Write-Host "  1. GitHubの認証に失敗（Personal Access Tokenが必要な場合があります）" -ForegroundColor Yellow
    Write-Host "  2. リモートURLが間違っている" -ForegroundColor Yellow
    Write-Host "  3. リポジトリが存在しない" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Enterキーを押して終了"

