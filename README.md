# MITO

## ファイル構成（階層）

```text
.
|- index.html
|- style.css
|- styles/
|  |- base.css
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
			|- dashboard-renderer.js
			|- entry-detail-renderer.js
			|- renderer-composer.js
			|- settings-renderer.js
			`- tree-renderer.js
```

## ディレクトリ役割

- `js/app/startup/`: 起動処理
- `js/app/core/`: app層の中核配線
- `js/app/actions/`: ファイル操作系のイベント配線
- `js/app/ui/`: app層のUI操作（レイアウト）
- `js/modules/renderers/`: 描画モジュール群
- `js/modules/forms/`: フォーム制御
- `js/modules/data/`: データ操作と保存処理

## レイヤー方針

- `app` 層: 画面全体で「いつ・どれを呼ぶか」を決める
- `modules` 層: 単一責務で「何をするか」を実装する

## 主要ファイル

- `js/app/startup/app.js`: 起動エントリ。各モジュールの初期化と全体配線。
- `js/app/core/app-bridge.js`: renderer/tree/model/formへの橋渡しAPI。
- `js/app/core/app-outline-view.js`: 左ツリー描画と待機/エラー表示の制御。
- `js/app/actions/app-document-actions.js`: 新規作成・開く・テンプレート生成・設定キー正規化。
- `js/app/actions/app-file-actions.js`: topbarの新規/開く/保存のUIイベント配線。
- `js/app/ui/app-layout.js`: 左右/上下スプリッターなどのレイアウト操作。
- `js/modules/renderers/renderer-composer.js`: 各rendererを束ねるオーケストレーター。
- `js/modules/forms/entry-form.js`: 左下入力フォームの追加/更新モード制御。
- `js/modules/data/data-model.js`: ID採番、検索、グルーピングなどのデータ操作。
- `js/modules/data/persistence.js`: 保存処理、保存ステータス更新。

## 命名ルール

- app層は `app-*.js` を基本とし、起動エントリのみ `app.js` を使う。
- 機能モジュールは責務名ベースで命名する。

## 変更ルール

- 新しいコードを追加するときは、先に層を決めてから配置する。
- app層にロジックが増えすぎたら、modules層へ分離する。
- モジュール間の接続だけをする処理はapp層へ寄せる。

## 説明欄Markdown（現時点）

- 対象範囲: 左下のデータ入力フォーム「説明」→ ダッシュボードのカード説明表示。
- データ保存: 入力値はMarkdownテキストのまま保存され、ダッシュボード描画時にHTMLへ変換される。

有効な記法:

- 見出し: `#` 〜 `######`
- 箇条書き: `- item` / `* item`
- 番号付きリスト: `1. item`（自動連番。`1.`を続けて書いても連番表示される。`3.`開始も可）
- 引用: `> quote`
- リンク（Wikipedia準拠）:
	- 内部リンク形式: `[[ページ名]]` / `[[ページ名|表示名]]`（MITO内部で同名エントリーの個別表示へジャンプ）
	- ローカルファイルリンク（相対）: `[file:docs/memo.md メモ]`
	- 相対リンク初回クリック時、基準フォルダー選択ダイアログが開く（以後は同フォルダー基準で解決）
	- 絶対パスも可: `[file:/Users/you/path/to/file.md 表示名]`
	- `file://` を直接指定する場合: `[file:file:///Users/you/path/to/file.md 表示名]`
	- 外部リンク形式: `[https://example.com 表示名]`
- 太字: `**text**`
- 斜体: `*text*`
- インラインコード: `` `code` ``
- コードブロック: `` ``` `` で囲む
- 段落: 空行で段落分割
- 改行: 普通の改行をそのまま反映（内部的には `<br>` に変換）

補足:

- HTMLはエスケープされるため、説明欄に直接HTMLタグを書いてもそのまま文字列として扱われる。
- 個別エントリー画面側のMarkdown表示は未対応（別途対応予定）。
