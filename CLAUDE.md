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

## GAS情報（clasp運用）

- **プロジェクト名**：KimFoods製造スケジュール（スプレッドシートに紐づくコンテナバインド型なので
  Driveのファイル一覧には単体で出てこない。`script.google.com/home` から探す）
- **スクリプトID**：`1orvjq6bKfqRUuJy1wCna6QzDojQag3cLUIbYBI-Nw6764dAOdmX_BykS`
- **本番デプロイID**：`AKfycbzvzntecxYTsOOFEgyr5ZX8ikDXs7Zsx7JrpDlW42RUBW16yEuMVwsLvpg6pL15qlVLZg`
  （index.html / view.html の `API_URL` がこのIDを指している。**変えると両方の書き換えが必要**）
- **HEAD用デプロイ**：`AKfycbyOUB7ntBFeZWMCGlJIfHCohnYoQgYXs06hYQUNqpZQ`
  （要ログイン。本番を触る前の動作確認に使える）
- **GAS側のファイル名は `コード.js`**。`Code.gs` として push すると別ファイルが増えて
  関数が二重定義になるので注意。

clasp作業フォルダは **リポジトリの外**（`~/sanada-schedule-gas`）に置く。
リポジトリ直下に `.clasp.json` を置くと index.html / view.html まで
GASのHTMLファイルとして push されてしまう。

```bash
cd ~/sanada-schedule-gas
cp ~/sanada-schedule/Code.gs コード.js
clasp push -f
clasp create-version "変更内容"
clasp redeploy AKfycbzvzntecxYTsOOFEgyr5ZX8ikDXs7Zsx7JrpDlW42RUBW16yEuMVwsLvpg6pL15qlVLZg -V <番号>
```

`redeploy` を使えば **URLを維持したままバージョンだけ上げられる**。
`clasp deploy`（新規デプロイ）はURLが変わるので使わない。

## Googleスプレッドシート情報

- **スプレッドシートID**：1AKrhxJA3kxS7aQlnGl7R05e6MHHjHrrYBMT-vnhKXJk
- **シート構成**：
  - `schedules`：スケジュールデータ
  - `products`：商品マスタ
  - `categories`：カテゴリマスタ
  - `categoryOrders`：カテゴリ作業順序（日付ごと）

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

### categoryOrdersシート
| 列 | 内容 |
|---|---|
| A | date（YYYY-MM-DD）|
| B | categoryId |
| C | orderNum（作業順序番号）|

---

## GAS（Code.gs）の実装

### エンドポイント（doGet/doPost）

```javascript
// GAS Web APIのエンドポイント
// 実際のフロントは書き込みもGET（?data=JSON）で送っている（CORSプリフライトを避けるため）

doGet(e)  → action: getAll, getDay, getSchedules, getProducts, getCategories, getCategoryOrders
          → ?data=JSON の場合は書き込み系（下記）を実行
doPost(e) → action: saveSchedule, deleteSchedule, saveProduct, deleteProduct, saveCategory, deleteCategory, saveCategoryOrder, deleteCategoryOrder
```

- `getAll`（`?date=`）：products / categories / schedules / categoryOrders をまとめて返す。起動時用。
- `getDay`（`?date=`）：schedules / categoryOrders だけ返す。日付移動・自動更新用。
- 書き込み系のレスポンスには `day`（その日の最新データ）と、マスタ更新時は `masters` が付く。
  クライアントは保存後に読み直す必要がない。

### CORS対応
```javascript
// レスポンスヘッダーにCORSを設定
ContentService.createTextOutput(JSON.stringify(result))
  .setMimeType(ContentService.MimeType.JSON)
```

---

## ハマりどころ（2026-08-13 修正）

### 「シートには保存されるのにアプリは保存に失敗しましたと出る」

GAS Web Appは **①doGetでシートに書き込む → ②302で script.googleusercontent.com に
リダイレクトして結果を返す** という2段構え。①が終わった後に②が失敗することがある
（Googleのエラーページ＝HTMLが返る／タイムアウトする）。

旧コードは `fetch(url).then(r => r.json())` だけだったので、②の失敗で
`r.json()` が例外を投げ、**書き込み済みなのに保存失敗と表示していた**。

対策：
- レスポンスは `text()` で受けてから自分でJSONパースし、HTTPステータスとパース失敗を区別する
- **通信エラー＝保存失敗と決めつけない。** 失敗したらシートを読み直して反映を確認し、
  入っていれば成功として扱う（`apiWrite(payload, verify)`）
- 書き込み自体はリトライしない（商品・カテゴリの新規追加が二重登録になるため）

### GASの実行は同一ユーザーで直列化される

起動時に4本のAPIを `Promise.all` で並列に投げても待ち時間は足し算になる。
`getAll` / `getDay` で1リクエストにまとめること。1回の保存で3リクエスト飛ばすのもNG。

### 数量の保存は楽観的更新（2026-08-13 追加）

GASの往復は5秒前後かかるので、保存ボタンを押したら**待たせずに先に画面へ反映**し、
裏で確定させる。確定するまで `pendingEdits` / `pendingCatOrders` に保持する。

- 未確定の値は薄字＋●で表示し、上部に「保存中…」バッジを出す（画面は操作できたまま）
- サーバー応答で `schedules` を差し替えたあとは必ず `reapplyPending()` を呼ぶ。
  **これを忘れると、複数を続けて保存したときに先の応答が後の未確定値を消す**
- 失敗したら元の値に戻し、赤トーストで「表示を元に戻しました」と伝える
- 保存中に日付を移動したら、その日のデータで今の画面を上書きしない（`isCurrentDate`）
- 商品・カテゴリマスタの操作は従来どおりローディング表示のまま。
  新規追加はサーバーがIDを返すまで巻き戻し先が無いため、楽観的更新にしていない

### `alert()` は使わない

`alert` はページ全体をブロックし、ダイアログを閉じるまで何も操作できなくなる。
エラー通知は `showToast(msg, 'error' | 'warn')` を使う。

### デプロイ順序

`getAll` / `getDay` はCode.gs側の新アクション。フロントには未対応GAS向けの
フォールバックを入れてあるのでどちらを先に更新しても壊れないが、
**Code.gsを再デプロイしないと速度改善は効かない**（既存の/exec URLを維持するため、
「デプロイを管理」→ 既存デプロイを編集 → バージョン「新しいバージョン」で更新する）。

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
