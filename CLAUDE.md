# loom（我們的 fork）— 「不會歪的 dev 系統」底座

> ⚠️ 這是 `valkor-ai/loom` 的 fork。我們拿它當底座,要在上面疊一層**沒人做過的「架構執法層」**。動手前**務必先讀下面的設計脈絡**,不要把它當普通 upstream loom 開發。

## 這個 fork 的任務

我們要一套「對活的系統做不會歪、不會腐爛的小改動」的 agent 開發系統。調查後決定:**不從零自己蓋,fork loom 白拿它的水電(持久狀態機、跨 session continue、lease、agent-neutral 協議、deploy-preview 反空殼、hooks),再加上我們真正的價值——架構即可執行的牆。**

## 設計脈絡（先讀,在全域知識庫）

```
~/.claude/knowledge/notes/2026-06-12-loom-fork-decision.md          ← fork 決策 + loom 深挖 + 留vs加（最重要,先讀這篇）
~/.claude/knowledge/notes/2026-06-12-ultracode-dev-system-design-v2.md  ← 完整系統設計（v2）
~/.claude/knowledge/notes/2026-06-12-loop-engineering.md            ← loop engineering 背景
```

## 我們要留 vs 要加

- **留(loom 已做好,別重寫)**:`.loom/` 狀態機、`continue`、lease、協議、deploy-preview 反空殼、Claude hooks、乾淨的專案/per-delivery 分層。
- **加(我們的層,沒人做過)**:
  1. 專案級、持久、隨事故長大的**架構憲法**（放 `.loom/contracts/constitution/`）
  2. 每次交付**強制讀+遵守**憲法（在 brainstorm/plan/taskplan 入口插注入）
  3. 架構 artifact 解析層可指**專案級**（唯一「動骨」處,不碰狀態機）
  4. **真執法**:可執行架構約束(dependency-cruiser/eslint-boundaries/arch test)、writeBoundary 從 `['.loom']` 擴成憲法 deny 清單(PreToolUse hook 真擋)、真 diff vs 宣稱 diff 對賬、撞牆不可繞過升級、牆從事故長大、獨立驗手、成本護欄

## 關鍵發現（深挖 loom code 得出）

- loom 本質是**協議 CLI**(吐 JSON 指令,真正改 code 的是 agent),不是 runtime。
- 它的「architecture contract」9 成是散文,只校驗 JSON 自洽,**從不檢查真 codebase**——這正是我們要補的。
- 它有 **per-delivery 失憶 DNA**(每次交付 blank-slate,不讀過去),但專案/交付界線乾淨(單一 `deliveryDir()`),`.loom/contracts/` 是現成空地放憲法,失憶反而讓我們的注入沒有舊邏輯要打架。

## 路線圖

1. **Spike（issue #1,進行中）**:驗證 AAC 可改讀專案級 `.loom/contracts/constitution/` 且不破壞 review 對賬（「動骨」乾不乾淨）。
2. Spike 過 → 分階段建架構執法層（憲法層 → 強制注入 → 真執法 → 牆長大）。

## Git

- 在 feature branch 開發,PR 到本 fork 的 `main`。
- `upstream` = `valkor-ai/loom`(同步上游用);`origin` = `SkylerChenTaiwan/loom`(我們的)。
- 所有改動 commit + push,不需問 PM(全域規則)。
