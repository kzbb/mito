# MITO

<https://mito.bblab.org>

MITOは、年表やナレッジを整理するためのブラウザツールです。
アカウント登録もインストールも要りません。データはJSONファイル1つにまとまり、
編集した結果はお使いのパソコンにファイルとして保存されます。

サーバーに預けないので、書いたものが外に出ることはありません。
そのぶん、人に見せたいときはファイルかURLを渡す形になります。

## 主な機能

- ドキュメントの新規作成・読み込み・保存（`Ctrl+S` / `Cmd+S` でも保存）
- 未保存の変更を検知し、画面を閉じようとしたときに警告
- 編集内容の自動下書き保存と、次回起動時の復元
- 左ペインのカテゴリツリー、ダッシュボード（年表）、設定画面の切り替え
- 独自のカレンダー（年表の軸）をCSVで定義・編集
- 説明欄のMarkdown表示と、内部リンク / ファイルリンク / 外部リンクの解決
- リンクにカーソルを合わせたときのプレビュー表示
- 削除したエントリーの復元と完全削除
- 共有URLの生成と読み込み

## 使い方

### 始める

<https://mito.bblab.org>を開き、画面上部の `新規作成` か `開く` を押します。

- `新規作成` … 空のドキュメントから始めます
- `開く` … 手元のJSONファイルを選んで続きから編集します
- `URLで開く` … Web上に置かれたJSONファイルを直接読み込みます

### 保存する

`保存` ボタン、または `Ctrl+S` / `Cmd+S` で保存します。

`開く` からファイルを選んだ場合は、同じファイルへそのまま上書きします
（対応ブラウザのみ。未対応の場合はダウンロード形式での保存になります）。

編集中の内容はブラウザ内に自動で下書き保存されます。
保存し忘れて閉じてしまっても、次に開いたときに復元するかどうかを確認します。

### 共有する

`共有` ボタンから共有用のURLを作れます。
そのURLを相手に渡すと、相手はMITOを開いた時点で同じドキュメントを見られます。

#### ファイルのURLを参照する

JSONファイルをどこかに置き、その共有リンクを貼り付けてURLを作ります。
開いた人のブラウザが、そのファイルを直接読みに行きます。

**元のファイルを更新すれば、配ったURLはそのままで最新版が読まれます。**
継続的に更新するドキュメントを共有するときは、こちらが向いています。

貼り付けるのは各サービスの共有リンクそのままで構いません。

| 置き場所 | 共有できるか |
| --- | --- |
| GitHub（ファイルページのURL） | できる |
| Dropbox | できる |
| OneDrive | できる |
| Googleドライブ | できる |
| 自分のサーバー | サーバー側がCORSを許可していればできる |

どの置き場所でも、**リンクを知っていれば閲覧できる状態**にしておく必要があります。
開いた人のブラウザがそのファイルを直接読みに行くためです。

Googleドライブは既定が「制限付き」なので、ここだけひと手間かかります。
対象のファイルを右クリック →「共有」→「一般的なアクセス」を
「リンクを知っている全員」に変更してください。

ブラウザが他のサイトのファイルを読むには、置き場所側の許可（CORS）が必要です。
これはMITO側では変えられないため、上の表にない置き場所では読めないことがあります。
読み込めなかった場合は、画面下部に理由が表示されます。

#### 置き場所を使わずに共有する

共有ダイアログの「置き場所を使わずに共有する」を開くと、もう1つの方式が使えます。
ドキュメントそのものを圧縮してURLに入れるので、ファイルをどこにも置かずに済み、
開いた相手はどこにもアクセスしません。

そのかわりURLが長くなります。生成すると文字数が表示されるので、
長すぎる場合（メールやチャットで途中で切られることがあります）は
上の方式に切り替えてください。

内容はURLを作った時点のコピーで固定されます。あとから編集しても、
配ったURLの中身は変わりません。「この時点の版を渡したい」ときや、
とりあえず手早く送りたいときに向いています。

#### 共有されたドキュメントを開いたとき

共有URLから開いたドキュメントは、元のファイルとは切り離されています。
保存すると手元の新しいファイルになり、**相手のファイルが書き換わることはありません**。

他の人から受け取ったリンクを開いたときは、読み込む前に取得元のURLが表示されます。
心当たりのないURLであれば、そこで中止できます。

## データ形式

ドキュメントは以下の構造のJSONです。読み込み時にこの形へ正規化されます。

```json
{
  "project": "プロジェクト名",
  "generatedAt": "2026-03-10T00:00:00.000Z",
  "updatedAt": "2026-03-10T00:00:00.000Z",
  "version": 1,
  "calendar": { "csvText": "..." },
  "settings": {
    "focusCategory": "出来事",
    "dashboardLabel": "年表"
  },
  "active": [
    {
      "id": 1,
      "category": "出来事",
      "name": "項目名",
      "dateCalendar": {
        "列ヘッダ1": "値1",
        "列ヘッダ2": "値2"
      },
      "description": "Markdown本文",
      "color": "#ffffff",
      "dashboardOrder": 0
    }
  ],
  "deleted": []
}
```

`color` はダッシュボードのカードの背景色です。入力フォームで選べる5色
（`#ffffff` / `#ffeef3` / `#fffde7` / `#eaf8ec` / `#e9f2fb`）のいずれかで、
それ以外の値や未指定の場合は `#ffffff` として扱われます。

## 説明欄Markdown仕様

対象:

- 入力フォームの `説明`
- ダッシュボードや詳細表示での本文レンダリング

対応記法:

- 見出し: `#` 〜 `######`
- 箇条書き: `- item` / `* item`
- 番号付きリスト: `1. item`（開始番号保持）
- 引用: `> quote`
- 太字: `**text**`
- 斜体: `*text*`
- インラインコード: `` `code` ``
- コードブロック: `` ``` ``
- 段落: 空行で分割
- 通常改行: `<br>` として反映

リンク記法:

- 内部リンク: `[[ページ名]]` / `[[ページ名|表示名]]`
- ファイルリンク: `[file:docs/memo.md メモ]`
- 絶対ファイルパス: `[file:/Users/you/path/to/file.md 表示名]`
- 外部リンク: `[https://example.com 表示名]`

補足:

- 相対`file:`リンク初回クリック時は、基準フォルダー選択を要求します。
- HTMLはエスケープされるため、本文中のHTMLタグはそのまま文字列として扱われます。

---

## 開発

ここから先は、MITOの中身に手を入れる人向けの情報です。

### 手元で動かす

ビルド不要の静的構成です。`index.html` をブラウザで開けば動きます。

Googleドライブ経由の読み込みだけは、APIキーのリファラー制限の都合で手元では動きません
（正常な挙動です。詳しくは `js/config.js` のコメントを参照）。

### 配信環境の設定

`js/config.js` に、配信環境ごとに書き換える設定を置いています。
現在はGoogleドライブ読み込み用のAPIキーだけです。
取得手順・制限のかけ方・トラブル時の切り分けは、同ファイルのコメントに書いてあります。

### 型チェックとテスト

```sh
# 型チェック（全JSファイルが // @ts-check 前提で書かれています）
npx tsc -p tsconfig.json

# ユニットテスト（依存パッケージなし）
node tests/unit.js
```

`tests/unit.js` はCSV解析・ドキュメント正規化・Markdown変換・カレンダー行マッチング・
共有URLの解釈といった純粋関数を対象にしています。

`tests/smoke.js` はヘッドレスChromiumで主要フローを通し、
「データを変更したのに未保存フラグが立たない」類の回帰を検出します。
リポジトリをビルド不要のまま保つため依存は同梱していないので、実行手順は
ファイル冒頭のコメントを参照してください。
共有リンクの取得はネットワークを前提にしないよう、`fetch` を差し替えて検証しています。

### モジュール間の呼び出し

`js/app/*` から各モジュールを呼ぶときは、`app-module-initializers.js` の
`callRenderer` / `callTree` / `callForm` / `callModel` を経由します。
参照は呼び出し時に解決され、目的の関数が無ければコンソールにどのAPIの
どの関数が欠けているかを出します。

代替実装（フォールバック）を呼び出し側に書かないでください。
同じ処理の劣化コピーが増えると、本体を直したときに片方だけ古くなります。
レンダラー共通のヘルパーは `renderer-fallbacks.js` に1つだけ置いています。

### データ変更時の約束

`currentData` を書き換える処理は、必ず `mito:data-changed` の通知を伴わせてください。
通知を忘れると未保存フラグが立たず、離脱警告もオートセーブも働かないまま編集内容が失われます。
これを取り違えないよう、変更と通知を対で行う `mutateDocument()`
（`js/modules/data/document-mutations.js`）を経由させる方針にしています。

### レイヤー方針

- `js/app/*`: 画面全体の配線・起動順序・モジュール連携
- `js/modules/*`: 単一責務の実装（描画、フォーム、データ、保存）

### ファイル構成（現状）

```text
.
|- index.html
|- README.md
|- style.css
|- tsconfig.json
|- tests/
|  |- unit.js
|  `- smoke.js
|- styles/
|  |- base.css
|  |- calendar.css
|  |- dashboard.css
|  |- form.css
|  |- layout-controls.css
|  |- layout-panels.css
|  |- layout-resizers.css
|  |- layout-shell.css
|  |- layout.css
|  |- markdown.css
|  |- settings.css
|  |- share.css
|  |- tokens.css
|  |- tree.css
|  `- wiki.css
`- js/
   |- config.js
   |- app/
   |  |- actions/
   |  |  |- app-document-actions.js
   |  |  |- app-file-actions.js
   |  |  `- app-share-actions.js
   |  |- core/
   |  |  `- app-outline-view.js
   |  |- startup/
   |  |  |- app-module-initializers.js
   |  |  `- app.js
   |  `- ui/
   |     `- app-layout.js
   `- modules/
      |- data/
      |  |- data-model.js
      |  |- document-mutations.js
      |  |- file-download.js
      |  |- persistence.js
      |  `- share-link.js
      |- forms/
      |  `- entry-form.js
      `- renderers/
         |- calendar-renderer.js
         |- calendar-utils.js
         |- dashboard-renderer.js
         |- entry-detail-renderer.js
         |- link-preview-handler.js
         |- markdown-engine.js
         |- renderer-composer.js
         |- renderer-fallbacks.js
         |- settings-renderer.js
         `- tree-renderer.js
```

### 主要モジュール

- `js/app/startup/app.js`
  - アプリの状態管理
  - `mito:data-changed` 監視
  - オートセーブ/復元
  - ファイル操作イベント接続
- `js/app/startup/app-module-initializers.js`
  - 各モジュールの生成と依存注入
  - ファイルリンク解決・プレビュー補助
- `js/app/actions/app-document-actions.js`
  - 新規テンプレート作成
  - 読み込みJSONの正規化
- `js/app/actions/app-share-actions.js`
  - 共有URLの取得・確認・生成UI
  - 取得したJSONは通常の読み込み経路へ流す（正規化と描画を作り直さない）
- `js/modules/data/share-link.js`
  - 共有URLの解釈と組み立て、置き場所ごとの取得用URLへの変換、gzip圧縮
- `js/config.js`
  - 配信環境ごとに書き換える設定（Googleドライブ用APIキー）
- `js/modules/data/document-mutations.js`
  - ドキュメント変更と `mito:data-changed` 通知の対管理
- `js/modules/renderers/renderer-fallbacks.js`
  - レンダラー間で共有するヘルパー（カレンダー解析・Markdown変換・エスケープ）の一元管理
- `js/modules/data/persistence.js`
  - 保存処理（File System Access API + フォールバック）
- `js/modules/data/file-download.js`
  - テキストのダウンロード保存（JSONとCSVで共通）
- `js/modules/renderers/renderer-composer.js`
  - 詳細/設定/ダッシュボード/カレンダー描画の統合
- `js/modules/renderers/calendar-renderer.js`
  - カレンダー編集UIとCSV入出力
- `js/modules/renderers/settings-renderer.js`
  - 設定画面と削除済み一覧管理
- `js/modules/renderers/link-preview-handler.js`
  - リンクプレビューの表示・非表示・位置調整
- `js/modules/renderers/markdown-engine.js`
  - 説明欄MarkdownのHTML変換
