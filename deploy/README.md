# 階段 0、階段 1 外部驗證手冊

本手冊將驗證分成兩層：

- 自動 staging：使用 Docker Compose 啟動 PostgreSQL、ClamAV、應用程式及內部 HTTPS，供 CI 重複驗證。
- 外部 staging：使用真實受管理 PostgreSQL、秘密管理／KMS、有效 TLS 憑證及正式網域，作為上線前簽署環境。

階段 2、3 的程式建置已完成；外部 staging 仍是正式上線前必要簽署條件。

## 自動 staging

需求：Docker Engine、Docker Compose、Node.js 24.14.x。

Windows 使用者可直接執行：

```text
powershell -ExecutionPolicy Bypass -File scripts/run-staging-validation.ps1
```

也可以直接雙擊專案根目錄的 `run-staging-validation.bat`。

Windows 版本會自動使用專案內 `.tmp-docker-config` 作為臨時 Docker 設定目錄，避免全域
`%USERPROFILE%\.docker\config.json` 權限造成驗證中斷。
每次啟動 staging 前也會先清除舊的 staging 容器與 volume，避免上一輪 PostgreSQL 密碼殘留造成
`password authentication failed for user "sasha"`。

此指令會自動產生一次性測試密碼與金鑰，完成後刪除容器及 volume，報告輸出至
`outputs/staging-validation-日期時間`。

```text
複製 deploy/staging/.env.example 為 deploy/staging/.env
docker compose -f deploy/staging/compose.yml up --build --detach
docker compose -f deploy/staging/compose.yml exec -T app node scripts/test-clamav-integration.mjs
```

接著在主機設定：

```text
SASHA_STAGING_BASE_URL=https://localhost:8443
SASHA_STAGING_ALLOW_SELF_SIGNED=true
SASHA_STAGING_USERNAME=staging.manager
SASHA_STAGING_PASSWORD=deploy/staging/.env 內的 SASHA_STAGING_PASSWORD
```

執行：

```text
node scripts/test-staging-endpoint.mjs
docker compose -f deploy/staging/compose.yml exec -T app node scripts/audit-data-protection.mjs
docker compose -f deploy/staging/compose.yml down --volumes
```

Compose 內的帳號與金鑰僅供隔離測試，不可用於外部 staging 或 production。

## 外部 staging

1. 建立與 production 分離的受管理 PostgreSQL 資料庫。
2. 建立 staging 專用 KMS／秘密管理項目，不得與 production 共用金鑰。
3. 部署 ClamAV 1.4 功能版本，至少配置 4 GB RAM，TCP 3310 只能在內部網路開放。
4. 建立 staging 網域與受信任 TLS 憑證。
5. 依 [external-staging.env.example](external-staging.env.example) 設定秘密。
6. 執行 `node scripts/validate-production-environment.mjs`。
7. 執行 PostgreSQL 遷移與整合測試。
8. 一次性執行 `node scripts/bootstrap-owner.mjs`，完成後移除 bootstrap 密碼並關閉開關。
9. 啟動服務並執行 `node scripts/test-staging-endpoint.mjs`。
10. 執行 `node scripts/test-clamav-integration.mjs`。
11. 執行 `node scripts/test-phase2-postgresql-scale.mjs`。
12. 執行 `node scripts/audit-data-protection.mjs`。
13. 使用真實保單樣本完成 OCR 供應商準確率與錯誤處理驗收。
14. 依 [browser-acceptance.md](browser-acceptance.md) 完成桌面與手機實機簽署。

## 固定驗證順序

```text
npm ci
npm run verify:release
npm run postgres:test
npm audit --omit=dev --audit-level=high
npm run production:preflight
npm run staging:clamav
npm run staging:endpoint
npm run phase2:postgres-scale
npm run data:protection:audit
```

其中 `postgres:test`、`production:preflight`、`staging:clamav`、`staging:endpoint`、`phase2:postgres-scale`
必須在對應外部環境變數已設定時執行。

## PostgreSQL 驗收

- 六個遷移檔 checksum 必須一致。
- 敏感欄位與附件原始檔名在資料庫中必須為 `enc.v1` 格式。
- v1 金鑰切換至 v2 後，`plaintextValues` 與舊金鑰數量必須為 0。
- 必須完成供應商的時間點還原或快照還原演練。
- 還原後重新執行應用程式健康檢查、登入、客戶與保單查詢。

## KMS／秘密管理驗收

- 主金鑰、資料金鑰與資料庫密碼只能由秘密管理服務注入。
- 日誌、CI artifact、映像檔及原始碼不得含有正式秘密。
- 輪替時先同時保留舊、新金鑰，再將 `SASHA_DATA_KEY_ID` 指向新金鑰。
- 執行 `npm run data:protection:audit`，確認明文、舊金鑰與附件缺檔皆為 0。
- 完成備份保存期及還原演練後，才能移除舊金鑰。

## ClamAV 驗收

- 乾淨檔案回傳 `clean`。
- EICAR 標準測試字串回傳 `infected`。
- ClamAV 停止時，新附件必須保持 `quarantined`，不可下載或進入 OCR。
- TCP 3310 不得暴露到公網，ClamAV 官方文件說明該連線本身沒有加密保護。

## HTTPS 與 Cookie 驗收

- 有效憑證，無瀏覽器警告。
- HSTS、CSP、`X-Content-Type-Options` 存在。
- Session Cookie 包含 `HttpOnly`、`Secure`、`SameSite=Strict`。
- 反向代理必須傳遞 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto=https`。
- 未登入資料 API 回傳 `401`，缺少 CSRF token 的修改請求回傳 `403`。

## 上線閘門

只有下列項目全部有證據且結果為通過，才能凍結階段 0、1：

- GitHub Actions `verify` 通過。
- GitHub Actions `staging-gate` 通過。
- 受管理 PostgreSQL 還原演練通過。
- 真實 KMS／秘密管理輪替通過。
- 真實 ClamAV 通過。
- 有效 TLS 與 Secure Cookie 通過。
- 桌面及手機實機驗收簽署完成。

任何一項未完成，都不應宣稱已達正式上線標準。
