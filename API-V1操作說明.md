# 莎莎保險助理工作台 API v1

## 共通規則

- 基底路徑：`/api/v1`
- 階段 2 結構狀態：`GET /api/v1/status`（主人與管理者）
- 所有端點都需要登入；寫入另需 CSRF Token。
- 每個回應都有 `X-Request-ID`，可用於追查稽核紀錄。
- 清單以 `limit` 與 `cursor` 分頁，`limit` 最大為 100。
- 排序支援 `sort=-updatedAt`（新到舊）及 `sort=updatedAt`（舊到新）。
- 修改、封存及還原必須帶 `If-Match`；版本不一致回傳 `409`。

## 核心資源

- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `GET /api/v1/customers/{id}`
- `PUT|PATCH /api/v1/customers/{id}`
- `DELETE /api/v1/customers/{id}`：軟封存
- `POST /api/v1/customers/{id}/restore`：還原封存

`policies` 與 `events` 使用相同格式。

允許的篩選：

- 客戶：`ownerUserId`、`stage`
- 保單：`customerId`、`company`、`type`
- 行程：`customerId`、`category`、`status`
- 主人與管理者可用 `archived=active|only|all`

## 團隊資料

- `GET /api/v1/team-state`
- `PUT /api/v1/team-state`

團隊成員、團隊任務及共同目標使用組織修訂版控制。舊 `/api/state` 已停止寫入，只保留相容讀取。

## 匯入與匯出

- `POST /api/v1/customers/import/preview`：預覽、驗證及重複 id 檢查，不寫入資料。
- `POST /api/v1/customers/import`：執行已驗證資料，單次最多 500 筆。
- `POST /api/v1/import-jobs`：建立 CSV／XLSX 背景匯入工作，最多 50,000 筆。
- `GET /api/v1/import-jobs`：取得近期匯入工作。
- `GET /api/v1/import-jobs/{id}`：取得進度與結果。
- `POST /api/v1/import-jobs/{id}/cancel`：要求取消尚未完成的工作。
- `GET /api/v1/import-jobs/{id}/errors.csv`：下載錯誤資料列。
- `GET /api/v1/exports/{customers|policies|events}`：主人與管理者限定，分頁匯出並寫入稽核紀錄。

## 客戶 360 與搜尋

- `GET /api/v1/customers/{id}/workspace`：一次取得客戶、保單及六類服務資料。
- `/api/v1/customers/{id}/contacts`
- `/api/v1/customers/{id}/relationships`
- `/api/v1/customers/{id}/interactions`
- `/api/v1/customers/{id}/tasks`
- `/api/v1/customers/{id}/documents`
- `/api/v1/customers/{id}/consents`
- `GET /api/v1/search?q=關鍵字`：使用加密欄位盲索引搜尋客戶與保單。

上述客戶子資源支援新增、修改及軟封存；修改需提供資料版本。

## OCR 工作

- `POST /api/v1/ocr/jobs`：以已通過安全掃描的附件建立辨識工作。
- `GET /api/v1/ocr/jobs`：取得近期工作。
- `GET /api/v1/ocr/jobs/{id}`：取得狀態、欄位與信心值。
- `PATCH /api/v1/ocr/jobs/{id}/fields/{fieldId}`：保存人工修正並留下稽核紀錄。
- `POST /api/v1/ocr/jobs/{id}/approve`：明確核准後建立正式保單。

正式環境未設定 HTTPS OCR 供應商時會拒絕啟動，避免誤用測試辨識器。

## 錯誤碼

- `403`：權限不足或 CSRF 驗證失敗
- `409`：版本衝突、重複 id 或關聯資料衝突
- `410`：舊 `/api/state` 寫入已退役
- `422`：欄位驗證失敗
- `428`：缺少 `If-Match`
