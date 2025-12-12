@echo off
chcp 65001 >nul
echo ========================================
echo GitHubアップロードスクリプト
echo ========================================
echo.

cd /d "%~dp0"

echo [1/7] Gitリポジトリを初期化中...
git init
if errorlevel 1 (
    echo エラー: Gitがインストールされていない可能性があります
    pause
    exit /b 1
)

echo.
echo [2/7] ファイルを追加中...
git add .
if errorlevel 1 (
    echo エラー: ファイルの追加に失敗しました
    pause
    exit /b 1
)

echo.
echo [3/7] コミット中...
git commit -m "初回コミット: 売上データ取り出しツール"
if errorlevel 1 (
    echo 警告: コミットに失敗しました（既にコミット済みの可能性があります）
)

echo.
echo [4/7] ブランチ名を設定中...
git branch -M main

echo.
echo [5/7] リモートリポジトリを確認中...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo リモートリポジトリを追加中...
    git remote add origin https://github.com/Hiroki-Web-Lab/uriage_data_toridasi.git
) else (
    echo 既存のリモートURLを更新中...
    git remote set-url origin https://github.com/Hiroki-Web-Lab/uriage_data_toridasi.git
)

echo.
echo [6/7] リモートリポジトリの設定を確認...
git remote -v

echo.
echo [7/7] GitHubにアップロード中...
echo （認証が求められる場合があります）
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo ========================================
    echo エラー: アップロードに失敗しました
    echo ========================================
    echo.
    echo よくある原因:
    echo   1. GitHubの認証に失敗
    echo      → Personal Access Tokenが必要な場合があります
    echo      → GitHub Settings → Developer settings → Personal access tokens
    echo   2. リポジトリへのアクセス権限がない
    echo.
) else (
    echo.
    echo ========================================
    echo アップロード完了！
    echo ========================================
    echo.
    echo リポジトリURL:
    echo https://github.com/Hiroki-Web-Lab/uriage_data_toridasi
    echo.
)

pause


