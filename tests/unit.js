// @ts-nocheck
//
// 純粋関数のユニットテスト。依存パッケージなしで動く。
//
//   node tests/unit.js
//
// 対象は引数と戻り値だけで完結しているモジュール（CSV解析、ドキュメント正規化、
// Markdown変換、カレンダー行マッチング）。DOMを触る描画系はここでは扱わない。

const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

let passed = 0;
let failed = 0;

function ok(label, condition, detail) {
	if (condition) {
		passed += 1;
		return;
	}
	failed += 1;
	console.log(`FAIL ${label}${detail !== undefined ? `\n       ${detail}` : ""}`);
}

function equal(label, actual, expected) {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	ok(label, a === e, `expected: ${e}\n       actual:   ${a}`);
}

// 各モジュールは window に自身を登録し、依存も window 経由で「呼び出し時に」引く。
// そのため window は読み込み後もそのまま残しておく必要がある。
global.window = global.window ?? {};
global.CSS = undefined;

/**
 * IIFEで window に登録するモジュールを読み込む。
 * @param {string} relativePath
 * @param {Record<string, any>} [extraGlobals] window に足しておく依存のスタブ
 */
function loadModule(relativePath, extraGlobals) {
	Object.assign(global.window, extraGlobals ?? {});
	const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
	const window = global.window;
	// eslint-disable-next-line no-eval
	eval(source);
	return window;
}

// モジュール本体から関数定義だけを切り出す（DOM依存の外側を避けるため）
function extractFunction(relativePath, name) {
	const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
	const start = source.indexOf(`function ${name}(`);
	if (start < 0) {
		throw new Error(`function not found: ${name} in ${relativePath}`);
	}
	let depth = 0;
	for (let i = source.indexOf("{", start); i < source.length; i += 1) {
		if (source[i] === "{") depth += 1;
		else if (source[i] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	throw new Error(`unbalanced braces for ${name}`);
}

// ---------------------------------------------------------------- CSV
{
	const w = loadModule("js/modules/renderers/calendar-utils.js");
	const utils = w.createCalendarUtils();

	equal("parseCsv: 基本", utils.parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
	equal("parseCsv: 引用符内のカンマ", utils.parseCsv('a,"b,c"'), [["a", "b,c"]]);
	equal("parseCsv: 引用符内の改行", utils.parseCsv('a,"b\nc"'), [["a", "b\nc"]]);
	equal("parseCsv: エスケープされた引用符", utils.parseCsv('a,"b""c"'), [["a", 'b"c']]);
	equal("parseCsv: CRLF", utils.parseCsv("a,b\r\n1,2"), [["a", "b"], ["1", "2"]]);
	equal("parseCsv: 空文字", utils.parseCsv(""), []);

	// Excel等が付けるBOMを落とす（残すと先頭ヘッダー名が不可視文字付きになる）
	const BOM = "﻿";
	equal("parseCsv: 先頭のBOMを除去", utils.parseCsv(`${BOM}a,b\n1,2`), [["a", "b"], ["1", "2"]]);
	equal("parseCsv: BOMは先頭のみ除去（セル内のものは残す）",
		utils.parseCsv(`a,${BOM}b`), [["a", `${BOM}b`]]);
	equal("resolveCalendarSchema: BOM付きCSVのヘッダー",
		utils.resolveCalendarSchema({ calendar: { csvText: `${BOM}A,B\n1,x\n` } }).headers, ["A", "B"]);
	equal("resolveInitialGrid: BOM付きCSVは編集グリッドにも残さない",
		utils.resolveInitialGrid({ calendar: { csvText: `${BOM}A,B\n1,x\n` } })[0], ["A", "B"]);

	// ラウンドトリップ: 特殊文字を含むグリッドが往復して一致すること
	const tricky = [
		["西暦", "和暦", "備考"],
		["1868", "慶応4年\n明治元年", 'a,b"c'],
		["", "明治2年", ""],
	];
	equal("gridToCsv → parseCsv のラウンドトリップ",
		utils.parseCsv(utils.gridToCsv(tricky)), tricky);

	// スキーマ: メモ化しても内容が正しいこと、csvText変更で更新されること
	const doc = { calendar: { csvText: "A,B\n1,x\n2,y\n" } };
	const s1 = utils.resolveCalendarSchema(doc);
	equal("resolveCalendarSchema: headers", s1.headers, ["A", "B"]);
	equal("resolveCalendarSchema: rows", s1.rows, [{ A: "1", B: "x" }, { A: "2", B: "y" }]);
	ok("resolveCalendarSchema: 同じcsvTextならキャッシュを返す",
		utils.resolveCalendarSchema(doc) === s1);
	doc.calendar.csvText = "A,B\n9,z\n";
	const s2 = utils.resolveCalendarSchema(doc);
	ok("resolveCalendarSchema: csvText変更でキャッシュが無効化される", s2 !== s1);
	equal("resolveCalendarSchema: 更新後のrows", s2.rows, [{ A: "9", B: "z" }]);

	// resolveInitialGrid は編集用なので毎回新しい配列を返す必要がある
	const g1 = utils.resolveInitialGrid(doc);
	const g2 = utils.resolveInitialGrid(doc);
	ok("resolveInitialGrid: 呼び出しごとに別インスタンス", g1 !== g2);
	g1[0][0] = "書き換え";
	equal("resolveInitialGrid: 書き換えが他へ漏れない", g2[0][0], "A");

	equal("resolveCalendarSchema: カレンダーなし", utils.resolveCalendarSchema({}), { headers: [], rows: [] });
	equal("resolveCalendarSchema: ヘッダーのみ",
		utils.resolveCalendarSchema({ calendar: { csvText: "A,B\n" } }), { headers: [], rows: [] });

	equal("resolveColumnLabel: A/Z/AA", [0, 25, 26].map(utils.resolveColumnLabel), ["A", "Z", "AA"]);
}

// ------------------------------------------------- normalizeDocument
{
	const w = loadModule("js/app/actions/app-document-actions.js", { nowJST: () => "2026-01-01T00:00:00.000+09:00" });
	const actions = w.createAppDocumentActions({
		renderOutlineFromData() {}, setFormModeAdd() {}, setFormStatus() {},
		setTopbarSaveStatus() {}, setCurrentFileName() {}, setCurrentFileHandle() {},
		renderFileLoadError() {},
	});
	const normalize = actions.normalizeDocument;

	const full = normalize({
		project: "  テスト  ",
		active: [{ id: "3", category: " 出来事 ", name: " 名前 ", description: "x", dashboardOrder: "2" }],
		deleted: [],
		settings: {},
		calendar: { csv: "A\n1" },
	});
	equal("normalizeDocument: projectをtrim", full.project, "テスト");
	equal("normalizeDocument: entryをtrim/型変換",
		[full.active[0].id, full.active[0].category, full.active[0].name, full.active[0].dashboardOrder],
		[3, "出来事", "名前", 2]);
	equal("normalizeDocument: settings既定値",
		[full.settings.focusCategory, full.settings.dashboardLabel], ["出来事", "年表"]);
	equal("normalizeDocument: calendar.csv を csvText へ移す", full.calendar, { csvText: "A\n1" });

	const empty = normalize({});
	equal("normalizeDocument: activeが空なら既定エントリを1件作る", empty.active.length, 1);
	ok("normalizeDocument: 既定エントリは dateCalendar を持つ（timelineではない）",
		"dateCalendar" in empty.active[0] && !("timeline" in empty.active[0]),
		JSON.stringify(empty.active[0]));
	equal("normalizeDocument: 既定エントリに dashboardOrder がある", empty.active[0].dashboardOrder, 0);
	equal("normalizeDocument: deletedは空のまま許容", empty.deleted, []);
	equal("normalizeDocument: カレンダー未指定はnull", empty.calendar, null);

	equal("normalizeDocument: 不正なエントリを除去",
		normalize({ active: [null, 1, "x", { name: "有効" }] }).active.length, 1);

	// 旧スキーマ from の移行（カレンダー導入前の単一日付フィールド）
	const legacy = normalize({
		calendar: { csvText: "西暦,和暦\n1868,明治元年\n" },
		active: [
			{ id: 1, name: "移行対象", from: "1868" },
			{ id: 2, name: "既に値あり", from: "1868", dateCalendar: { 西暦: "1900" } },
			{ id: 3, name: "空のfrom", from: "   " },
		],
	});
	equal("normalizeDocument: from を dateCalendar の先頭列へ移行",
		legacy.active[0].dateCalendar, { 西暦: "1868" });
	ok("normalizeDocument: 移行後は from を残さない", !("from" in legacy.active[0]),
		JSON.stringify(legacy.active[0]));
	equal("normalizeDocument: 先頭列に既に値があればそちらを優先",
		legacy.active[1].dateCalendar, { 西暦: "1900" });
	ok("normalizeDocument: 空のfromは移行対象外（fromは残る）",
		legacy.active[2].from === "   " && legacy.active[2].dateCalendar === undefined,
		JSON.stringify(legacy.active[2]));

	// カレンダー未設定なら列名が決まらないので from を保持し、値を失わない
	const legacyNoCalendar = normalize({ active: [{ id: 1, name: "x", from: "1868" }] });
	equal("normalizeDocument: カレンダー未設定なら from を保持", legacyNoCalendar.active[0].from, "1868");

	// 移行後の値が実際に行マッチングで使えること（結線の確認）
	{
		const w2 = loadModule("js/modules/renderers/calendar-utils.js");
		const u2 = w2.createCalendarUtils();
		const schema2 = u2.resolveCalendarSchema(legacy);
		equal("normalizeDocument: 移行値がカレンダー行に解決できる",
			u2.resolveTimelineValues(legacy.active[0], "date", schema2.headers),
			{ 西暦: "1868", 和暦: "" });
	}

	for (const bad of [null, undefined, 42, "text", []]) {
		let threw = false;
		try { normalize(bad); } catch { threw = true; }
		ok(`normalizeDocument: ${JSON.stringify(bad)} を拒否する`, threw);
	}
}

// -------------------------------------------------------- Markdown
{
	const w = loadModule("js/modules/renderers/markdown-engine.js");
	const md = w.createMarkdownEngine();

	equal("markdown: 見出し", md.renderToHtml("## 見出し"), "<h2>見出し</h2>");
	equal("markdown: 箇条書き", md.renderToHtml("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
	equal("markdown: 番号付き（開始番号を保持）", md.renderToHtml("5. a\n6. b"),
		'<ol start="5"><li>a</li><li>b</li></ol>');
	equal("markdown: 引用", md.renderToHtml("> q"), "<blockquote>q</blockquote>");
	equal("markdown: 強調", md.renderToHtml("**b** と *i*"), "<p><strong>b</strong> と <em>i</em></p>");
	equal("markdown: インラインコード", md.renderToHtml("`x`"), "<p><code>x</code></p>");
	equal("markdown: コードブロックはエスケープされる", md.renderToHtml("```\n<b>&\n```"),
		"<pre><code>&lt;b&gt;&amp;</code></pre>");
	equal("markdown: HTMLはエスケープされる", md.renderToHtml('<img src=x onerror="alert(1)">'),
		"<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
	equal("markdown: 内部リンク", md.renderToHtml("[[頁|表示]]"),
		'<p><a href="#" data-mito-link="頁">表示</a></p>');
	equal("markdown: fileリンク", md.renderToHtml("[file:a/b.md ラベル]"),
		'<p><a href="#" data-mito-file-path="a/b.md">ラベル</a></p>');
	equal("markdown: 外部リンク（&をエスケープ）", md.renderToHtml("[https://e.com/?a=1&b=2 L]"),
		'<p><a href="https://e.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">L</a></p>');
	ok("markdown: 属性への脱出を許さない",
		!md.renderToHtml('[https://e.com/" onmouseover="alert(1) L]').includes('" onmouseover="'),
		md.renderToHtml('[https://e.com/" onmouseover="alert(1) L]'));

	// インラインコードのプレースホルダ関連
	const many = md.renderToHtml(Array.from({ length: 15 }, (_, i) => `\`c${i}\``).join(" "));
	equal("markdown: 10個超のインラインコードを全て復元", (many.match(/<code>/g) || []).length, 15);
	ok("markdown: プレースホルダが漏れない", !many.includes("MITO_CODE"), many.slice(0, 80));
	equal("markdown: 本文中の旧プレースホルダは素通し",
		md.renderToHtml("__MITO_CODE_0__"), "<p>__MITO_CODE_0__</p>");

	equal("markdown: 空入力", md.renderToHtml(""), "");
	equal("markdown: null入力", md.renderToHtml(null), "");
}

// ------------------------------------------ カレンダー行マッチング
{
	const w = loadModule("js/modules/renderers/calendar-utils.js");
	const utils = w.createCalendarUtils();
	let resolveTimelineValues = utils.resolveTimelineValues;
	eval(extractFunction("js/modules/renderers/dashboard-renderer.js", "buildCalendarRowIndex"));
	eval(extractFunction("js/modules/renderers/dashboard-renderer.js", "findCalendarRowIndexForEntry"));

	const schema = utils.resolveCalendarSchema({
		calendar: { csvText: "A,B,C\n1,x,p\n1,y,q\n2,x,q\n,z,\n3,,r\n" },
	});
	const index = buildCalendarRowIndex(schema);
	const find = (entry) => findCalendarRowIndexForEntry(schema, index, entry);

	equal("行マッチ: 完全一致", find({ dateCalendar: { A: "1", B: "x", C: "p" } }), 0);
	equal("行マッチ: 一致数が多い行を選ぶ", find({ dateCalendar: { A: "1", B: "y" } }), 1);
	equal("行マッチ: 同点なら行番号が小さい方", find({ dateCalendar: { A: "1" } }), 0);
	equal("行マッチ: 同点（後方の列）", find({ dateCalendar: { C: "q" } }), 1);
	equal("行マッチ: 2点が1点に勝つ", find({ dateCalendar: { A: "2", C: "q" } }), 2);
	equal("行マッチ: 一致なし", find({ dateCalendar: { A: "99" } }), -1);
	equal("行マッチ: 値なし", find({ dateCalendar: {} }), -1);
	equal("行マッチ: dateCalendarなし", find({}), -1);
	equal("行マッチ: 空セルを含む行", find({ dateCalendar: { B: "z" } }), 3);
	equal("行マッチ: 前後の空白を無視", find({ dateCalendar: { A: "  1  ", B: " x " } }), 0);
	// 旧スキーマ from は読み込み時に dateCalendar へ移行される前提のため、
	// 描画時点で from だけを持つエントリーは一致しない（移行は normalizeDocument 側でテスト）
	equal("行マッチ: 生の from は参照しない", find({ from: "3" }), -1);
	equal("行マッチ: ヘッダーなしスキーマ",
		findCalendarRowIndexForEntry({ headers: [], rows: [] }, new Map(), { dateCalendar: { A: "1" } }), -1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
