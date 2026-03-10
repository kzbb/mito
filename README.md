# MITO

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

## ファイル構成（現状）

```text
.
|- index.html
|- README.md
|- style.css
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
   |  |  |- app-bridge.js
   |  |  `- app-outline-view.js
   |  |- startup/
   |  |  |- app-module-initializers.js
   |  |  `- app.js
   |  `- ui/
   |     `- app-layout.js
   `- modules/
      |- data/
      |  |- data-model.js
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
- `js/modules/data/persistence.js`
  - 保存処理（File System Access API + フォールバック）
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
      "description": "Markdown本文"
    }
  ],
  "deleted": []
}
```

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
- `file://` 形式: `[file:file:///Users/you/path/to/file.md 表示名]`
- 外部リンク: `[https://example.com 表示名]`

補足:

- 相対`file:`リンク初回クリック時は、基準フォルダ選択を要求します。
- HTMLはエスケープされるため、本文中のHTMLタグはそのまま文字列として扱われます。
