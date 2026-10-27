# 台灣麻將（簡易版）

純前端專案，不需要 server、不需要安裝套件。

## 在 VS Code 執行

方法 A（建議）：安裝推薦的 Live Server 擴充套件 → 對 `index.html` 按右鍵 →「Open with Live Server」。
方法 B：按 F5，選「以 Chrome 開啟並除錯」，可在 `script.js`、`app.js` 設中斷點。
方法 C：直接用瀏覽器開啟 `index.html`。

## 檔案

| 檔案 | 內容 |
|---|---|
| index.html | 頁面結構 |
| style.css | 牌桌與牌面樣式 |
| script.js | 核心邏輯：牌編碼、牌牆、胡牌拆解、台數計算 |
| app.js | 畫面、玩家操作、回合流程、電腦玩家 |

載入順序：先 `script.js`，再 `app.js`。

## 目前進度

已完成 M1～M5 精簡版（吃、碰、胡、過水、流局、階段 1 台數）。
尚未實作：槓類、搶槓、八仙過海、七搶一、天地人胡／聽、開局動畫、存檔與成績（M8）。
