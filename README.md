# MITO

## レイヤー方針

このリポジトリでは、ファイルを次の2層で分けます。

- `app` 層: 画面全体の流れを組み立てる層
- 機能モジュール層: 単一責務の処理を提供する層

判断基準:

- 「いつ・どれを呼ぶか」を決めるコードは `app` 層
- 「何をするか」を実装するコードは機能モジュール層

## ファイル役割

### app 層

- `app.js`: 起動エントリ。各モジュールの初期化と全体配線。
- `app-bridge.js`: renderer/tree/model/formへの橋渡しAPI。
- `app-outline-view.js`: 左ツリー描画と待機/エラー表示のオーケストレーション。
- `app-document-actions.js`: 新規作成・開く・テンプレート生成・設定キー正規化。
- `app-layout.js`: 左右/上下スプリッターなどのレイアウト操作。
- `app-file-actions.js`: topbarの新規/開く/保存のUIイベント配線。

### 機能モジュール層

- `renderers.js`: 各rendererを束ねるオーケストレーター。
- `entry-detail-renderer.js`: 個別エントリー表示・インライン編集UI。
- `settings-renderer.js`: 設定画面と設定ボタン表示。
- `dashboard-renderer.js`: ダッシュボード（年表）表示。
- `tree-renderer.js`: 左ツリー描画・選択・フォーカス処理。
- `entry-form.js`: 左下入力フォームの追加/更新モード制御。
- `data-model.js`: ID採番、検索、グルーピングなどのデータ操作。
- `persistence.js`: 保存処理、保存ステータス更新。

## 命名規約

- app層のファイルは`app-*.js`を使う。
- 機能モジュールは責務名ベースで命名する（例: `tree-renderer.js`）。

## 変更時のルール

- 新しいコードを追加するときは、先に層を決めてからファイルを作る。
- app層にロジックが増えすぎたら、機能モジュールへ分離する。
- 逆に、モジュール間の接続だけをする処理はapp層へ寄せる。
