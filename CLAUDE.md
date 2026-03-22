# KimFoods 製造スケジュール管理アプリ v2

## プロジェクト概要

第一工場から第二工場（外注先・真田）への製造スケジュールをデジタル化するWebアプリ。
データはGoogleスプレッドシート（GAS Web API）に保存し、複数端末からリアルタイムで共有できる。

## アーキテクチャ

```
index.html（入力用・第一工場）
　↕ fetch（GAS Web API）
Google Apps Script（バックエンド）
　↕ SpreadsheetApp
Googleスプレッドシート（データベース）
　↑ fetch（GAS Web API）
view.html（閲覧用・第二工場）
```

## Googleスプレッドシート情報

- **スプレッドシートID**：1AKrhxJA3kxS7aQlnGl7R05e6MHHjHrrYBMT-vnhKXJk
- **シート構成**：
  - `schedules`：スケジュールデータ
  - `products`：商品マスタ
  - `categories`：カテゴリマスタ

---

## 実際のスケジュールデータ構造（手書きサンプルより）

```
真田  3/19  合計200k

【中辛】120k
  330g      × 252個
  CGC       × 30個
  ストック  × 370個

【BK】80k
  黒            × 50個
  キムさん      × 192個
  ストック      × 320個
  手しごと本格  × 36個
  匠            × 70個
```

---

## 原料計算

```
原料（kg）= 内容量（g）× 数量（個）× 係数 ÷ 1000
```

- 内容量・係数は商品ごとに設定画面で個別登録（デフォルト係数：0.68）
- カテゴリ合計kg・1日合計kgも自動集計して表示

---

## スプレッドシートのシート構成

### schedulesシート
| 列 | 内容 |
|---|---|
| A | date（YYYY-MM-DD）|
| B | productId |
| C | quantity（個）|
| D | note |
| E | updatedAt |

### productsシート
| 列 | 内容 |
|---|---|
| A | id |
| B | name |
| C | categoryId |
| D | contentG（内容量g）|
| E | coefficient（係数）|
| F | order |
| G | noCalc（原料計算しない: TRUE/FALSE）|

### categoriesシート
| 列 | 内容 |
|---|---|
| A | id |
| B | name |
| C | order |

---

## GAS（Code.gs）の実装

### エンドポイント（doGet/doPost）

```javascript
// GAS Web APIのエンドポイント
// GETリクエスト：データ取得
// POSTリクエスト：データ保存・更新・削除

doGet(e)  → action: getSchedules, getProducts, getCategories
doPost(e) → action: saveSchedule, deleteSchedule, saveProduct, deleteProduct, saveCategory, deleteCategory
```

### CORS対応
```javascript
// レスポンスヘッダーにCORSを設定
ContentService.createTextOutput(JSON.stringify(result))
  .setMimeType(ContentService.MimeType.JSON)
```

---

## ファイル構成

```
kimfoods-schedule-v2/
├── CLAUDE.md
├── Code.gs        ← GASバックエンド
├── index.html     ← 入力用（第一工場）
└── view.html      ← 閲覧用（第二工場）
```

---

## 技術スタック

- **フロントエンド**：HTML / CSS / JavaScript（シングルファイル）
- **バックエンド**：Google Apps Script（Web API）
- **データベース**：Googleスプレッドシート
- **デプロイ**：GAS Web App（URL公開）+ GitHub Pages（HTML）

## 対象デバイス

- スマートフォン・タブレット **メイン**
- タッチ操作に最適化（ボタン大きめ・入力しやすい）

---

## 画面構成

### 1. メイン画面（スケジュール表）
- 表形式グリッド：縦軸＝製品名、横軸＝日付
- 今日を中心に前後の日付を表示（横スクロール対応）
- 各セルに「数量（個）」と「原料（kg）」を表示
- セルをタップ → 入力モーダルを開く

### 2. 入力モーダル
- 対象商品名・日付を表示（読み取り専用）
- 数量の入力（数値キーボード）
- 原料kgをリアルタイム自動計算・表示
- 保存・キャンセルボタン

### 3. 閲覧画面（view.html）
- 同じスプレッドシートからデータを取得して表示
- 編集・入力は一切不可
- 第二工場がスマホで確認するための画面

### 4. LINE共有機能
- 当日スケジュールをテキスト形式でクリップボードにコピー
- LINEに貼り付けて第二工場に送信

### 5. 設定画面
- 商品マスタ管理（商品名・内容量・係数・カテゴリ・原料計算しないフラグ）
- カテゴリマスタ管理
- データはすべてスプレッドシートに保存

---

## UI・デザイン方針

- 工場現場で使いやすい：文字大きめ、コントラスト高め
- シンプルで迷わない：操作ステップを最小化
- タッチ操作最適化：ボタン・セルのタップ領域を広く
- 言語：日本語のみ

---

## 開発手順

### Step 1: Code.gsの作成
GAS Web APIを実装する

### Step 2: index.htmlの作成
入力用画面を実装（GAS APIと連携）

### Step 3: view.htmlの作成
閲覧用画面を実装（GAS APIからデータ取得）

### Step 4: GASのデプロイ
- Google Apps Scriptエディタに Code.gs をコピペ
- Web Appとしてデプロイ（全員アクセス可能）
- Web App URLをindex.html・view.htmlに設定

### Step 5: GitHub Pagesで公開
- index.html・view.htmlをGitHubにpush
- GitHub PagesでURL公開

---

## 注意事項

- GAS Web AppのURLはデプロイ後に取得してHTMLに設定する
- スプレッドシートは「リンクを知っている全員が編集可能」に設定する
- GASはデプロイのたびに新しいURLが発行される場合があるので注意
