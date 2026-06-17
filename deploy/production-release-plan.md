# 莎莎保險助理工作台正式版前進計畫

更新日期：2026-06-18

## 目前狀態

階段 0、階段 1、階段 2、階段 3 已完成到可進入正式外部驗收的程度。

已通過的自動化驗證包含：

- 本機正式版驗證：`npm run verify:release`
- Docker staging：PostgreSQL、ClamAV、HTTPS、Secure Cookie、OCR、Phase 2 API、Phase 3 OCR、pg_dump/pg_restore
- 10 萬筆客戶資料壓測
- 備份還原演練
- 金鑰輪替演練
- 個資加密稽核

目前最新通過的 Docker staging 報告：

- `outputs/staging-validation-20260618-012830`

## 接下來順序

### 1. 建立 RC 候選版

執行：

```text
npm run release:rc
```

這會完成：

- 重新執行正式版本機驗證。
- 讀取最近一次通過的 Docker staging 報告。
- 產生 `outputs/release-candidate-*` 封版資料夾。
- 產生機器可讀的 `manifest.json` 與人工可讀的 `checklist.md`。

### 2. 推送到 GitHub 並建立版本標記

建議版本：

```text
v1.0.0-rc1
```

在一般 Windows PowerShell 或直接雙擊執行：

```text
create-rc-git-release.bat
```

這會依序完成：

- 設定 Git safe.directory。
- 切換主分支為 `main`。
- `git add .`
- `git commit -m "Release candidate v1.0.0-rc1"`
- 建立 `v1.0.0-rc1` tag。
- 推送 `main` 與 tag 到 GitHub。

完成後，GitHub 上應該要看得到：

- 最新正式版候選程式碼。
- `v1.0.0-rc1` tag。
- GitHub Actions `staging-gate` 通過紀錄。

### 3. 部署真實外部 staging

外部 staging 需要真實服務，不能由本機自動憑空建立。

需要先準備：

- 真實受管理 PostgreSQL。
- 真實 staging 網域。
- 有效 HTTPS 憑證。
- KMS 或秘密管理服務。
- ClamAV 或等效檔案掃毒服務。
- OCR 廠商正式或 staging API key。
- 測試用登入帳號。

環境變數範本：

- `deploy/external-staging.env.example`

### 4. 執行外部 staging 一鍵驗收

環境變數設定完成後，在專案根目錄執行：

```text
run-external-staging-acceptance.bat
```

這會依序驗證：

- `npm ci`
- `npm audit --omit=dev --audit-level=high`
- production preflight
- 真實 PostgreSQL migration / encryption / key rotation
- ClamAV clean / EICAR
- HTTPS / Secure Cookie / endpoint
- Phase 2 PostgreSQL 10 萬筆壓測
- data protection audit

驗收報告會輸出到：

```text
outputs/external-staging-acceptance-*
```

### 5. OCR 正式服務驗收

使用去識別化真實保單樣本，確認：

- 主要欄位辨識率。
- 低信心欄位會進入人工檢閱。
- 人工修正有稽核紀錄。
- 審核通過後可以正確建立保單。
- OCR 廠商資料保存與刪除政策可接受。

### 6. 手機與電腦實機簽署

依照以下文件逐項確認：

- `deploy/browser-acceptance.md`

必要裝置：

- Windows Chrome 或 Edge。
- macOS Safari 或 Chrome。
- iPhone Safari。
- Android Chrome。

### 7. 開始階段 4

只有在外部 staging、OCR、實機操作都通過後，才開始階段 4。

階段 4 內容：

- 國際財經新聞排程。
- 國內財經、保險、稅務、金融法規更新排程。
- 國內保險商品資料整理與比較。
- Email、LINE、行事曆、推播通知。
- PDF 建議書與保障分析報告。
- 重複客戶偵測與資料品質工具。

## 目前不能完全自動完成的事項

以下事項需要張經理或雲端帳號管理者提供真實權限：

- 建立或提供正式 staging 網域。
- 建立受管理 PostgreSQL。
- 建立 KMS / Secret Manager 金鑰。
- 提供 OCR 廠商 API key。
- 提供 Email / LINE 官方帳號或 API 權限。
- 完成手機與電腦實機簽署。

這些資料準備完成後，外部 staging 驗收可以用 `run-external-staging-acceptance.bat` 自動執行。
