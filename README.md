# MITO

<https://mito.bblab.org>

MITOは、JSONドキュメントを読み込み・編集・保存する、ブラウザ上で動く年表/ナレッジ整理ツールです。

## 現在の主な機能

- JSONファイルの新規作成・読み込み・保存
- `Ctrl+S` / `Cmd+S` で保存
- 未保存変更の検知と、画面離脱時の警告
- ローカルストレージへの自動下書き保存（デバウンス付き）と復元
- 左ペインのカテゴリツリー + ダッシュボード + 設定の切り替え
- エントリー詳細表示と、詳細画面からの削除済み移動
- 設定画面でのプロジェクト設定編集（`project`, `settings.*`）
- 削除済みエントリーの復元 / 完全削除
- カレンダーCSVの編集（セル編集、行列追加/削除、CSV入出力）
- 説明欄Markdown表示
- 内部リンク / `file:`リンク / `https:`リンクの解決
- リンクホバー・フォーカス時のプレビュー表示

## 実行方法

ビルド不要の静的構成です。

1. `index.html` をブラウザで開く
2. 画面上部の `新規作成` または `開く` で開始

補足:

- 一部機能（`showSaveFilePicker` / `showDirectoryPicker`）は対応ブラウザで有効になります。
- 未対応環境では保存時にダウンロード方式へフォールバックします。

## 開発

ビルドは不要ですが、型チェックとテストは用意しています。

```sh
# 型チェック（全JSファイルが // @ts-check 前提で書かれています）
npx tsc -p tsconfig.json

# ユニットテスト（依存パッケージなし）
node tests/unit.js
```

`tests/unit.js` はCSV解析・ドキュメント正規化・Markdown変換・カレンダー行マッチングといった
純粋関数を対象にしています。

`tests/smoke.js` はヘッドレスChromiumで主要フローを通し、
「データを変更したのに未保存フラグが立たない」類の回帰を検出します。
リポジトリをビルド不要のまま保つため依存は同梱していないので、実行手順は
ファイル冒頭のコメントを参照してください。

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

## ファイル構成（現状）

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
|  |- tokens.css
|  |- tree.css
|  `- wiki.css
`- js/
   |- app/
   |  |- actions/
   |  |  |- app-document-actions.js
   |  |  `- app-file-actions.js
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
      |  `- persistence.js
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

## レイヤー方針

- `js/app/*`: 画面全体の配線・起動順序・モジュール連携
- `js/modules/*`: 単一責務の実装（描画、フォーム、データ、保存）

## 主要モジュール

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

## データ形式

読み込み時に以下構造へ正規化されます。

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
