# MBTI Widget - Technical Documentation

## Overview

MBTI Widget is a SillyTavern extension that analyzes user chat messages to build an evolving MBTI personality profile. It sends the user's message + recent context to the LLM via `generateRaw`, receives MBTI-relevant tags, and visualizes the resulting personality in a floating panel with an octagon radar chart.

---

## Architecture

### Architecture

### File Structure

```
SillyTavern-MBTI_Widget/
├── manifest.json    # Extension metadata (author, version, loading order)
├── index.js         # Main extension code (~668 lines)
├── settings.html   # Settings UI (injects into extensions drawer)
└── style.css        # Scoped styles (~470 lines)
```

### Extension Pattern

The extension uses SillyTavern's global pattern (NOT ES6 imports):

```javascript
(function () {
    'use strict';
    // ... code ...
    if (window.SillyTavern) {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();
```

---

## Data Flow

```
User sends message → AI responds → MESSAGE_RECEIVED fires
    ↓
getLastUserMessage()     → Get user's latest message from context.chat
    ↓
getMessageContext(n)    → Get n recent messages for LLM context
    ↓
queryRating()          → Call generateMBTI() with prompt + systemPrompt
    ↓
parseRatingResponse() → Extract tags from LLM JSON response
    ↓
applyTag()             → Update scores based on tags
    ↓
saveToChatMetadata()  → Persist scores to chat metadata
    ↓
updatePanel()          → Update UI (octagon, bars, archetype info)
```

---

## LLM Backend (v3)

All MBTI LLM calls go through a single dispatcher, `generateMBTI({ prompt, systemPrompt, maxTokensOverride? })`, used by both the auto-trigger (`queryRating`) and the manual re-scan (`reScanHistory`). The transport depends on the **LLM Backend** setting:

- **`st`** (default): calls `SillyTavern.getContext().generateRaw({ prompt, systemPrompt })` — a separate, out-of-band request using the currently active SillyTavern connection profile. It does not include the character card, jailbreak, or full chat; only the injected context.
- **`custom`**: calls `generateWithCustomOpenAI({ prompt, systemPrompt, maxTokensOverride? })` — a direct browser `fetch()` to a user-configured OpenAI-compatible endpoint (`POST {baseUrl}/chat/completions`), with:
  - `messages: [{role:"system",content:systemPrompt},{role:"user",content:prompt}]`
  - `model`, `max_tokens` (defaults to 8192, overridden by re-scan scaling), `temperature`
  - optional `Authorization: Bearer <key>`

Supporting helpers: `isCustomBackend()`, `getCustomApiSettings()`, `fetchModels()` (`GET {baseUrl}/models`), `testCustomConnection()`, `extractOpenAIContent()`.

The custom API key is stored in `localStorage` under `mbti_widget_api_key` (never in `extension_settings`, so it is not synced to the server or written to chat metadata). All other backend settings live in `extension_settings.mbti_widget.{backend, customApi}`.

### Context budget / overflow guard (re-scan)

The re-scan request can include a large slice of the chat, so it is guarded against exceeding the model's context window. The effective budget comes from `getContextBudget()`:

- **`st` backend**: reads `getMaxPromptTokens()` from SillyTavern's `script.js` via a **guarded dynamic `import()`** (tries the documented third-party mount depth `../../../../script.js`, then `../../../script.js` as a fallback, aligning with the repo's "no ES6 static imports" design). This is the same authoritative per-model budget SillyTavern itself uses (context minus reserved response). Never hardcoded.
- **`custom` backend**: uses `customApi.contextLength` when set to a positive number (auto-filled from the provider's `/models` metadata via `extractModelContextLength()`), otherwise **falls back to `getMaxPromptTokens()`** as a conservative baseline.

If the `script.js` dynamic import is unavailable (path/export differences across ST versions), `getContextBudget()` falls back to reading `context.chatCompletionSettings.openai_max_context` (OpenAI) or `context.maxContext` (local/text-generation backends), and finally `0` (no cap). Because the import is dynamic and wrapped in try/catch, a failure can never prevent the extension from loading.

Message packing is **newest-first greedy**: `reScanHistory()` adds the newest messages until the estimated prompt would exceed the budget, then stops. `countRescanTokens()` uses `context.getTokenCountAsync()` (SillyTavern's tokenizer) with a `chars/4` heuristic fallback. If older messages are dropped, a note line is prepended to the prompt and a non-blocking warning is shown in the re-scan popup. The auto-trigger (`queryRating`) is **not** capped — it only rates the newest reply with a bounded `contextMessages` window.

**Re-scan output scaling:** The re-scan prompt asks the model to return one analysis entry per user message (tags + reasoning). This output grows linearly with user message count and can exceed a fixed `max_tokens`. `getRescanOutputBudget(userMessageCount)` computes a scaled output limit: `max(userMessageCount × 120, configured maxTokens)`, capped at 32,768. The auto-trigger is unaffected (its small output fits the default). If the custom API still returns empty content despite the scaling, the error now includes `finish_reason` and response structure details for diagnosis.

### Message role handling

Both `getMessageContext()` (auto-trigger) and `reScanHistory()` (re-scan) **skip `is_system` messages** (they aren't user behavior and would be mislabeled). Messages are labeled `[user]` / `[ai]` inline (with the speaker's name) rather than relying on native role arrays, so a one-shot re-scan can ask the model to return the `messageIndex` of each analyzed message.

---

---

## Key Functions

### Core Analysis Functions

#### `getMessageContext(count)` (line 65-71)
Gets recent messages for LLM context building.

```javascript
function getMessageContext(count) {
    const context = SillyTavern.getContext();
    if (!context.chat) return '';
    const chat = context.chat;  // chat IS the array
    const recent = chat.slice(-count);
    return recent.map(m => `${m.name}: ${m.mes}`).join('\n');  // .mes, not .msg
}
```

**Critical SillyTavern specifics:**
- `context.chat` is an **array** (not `context.chat.messages`)
- Message content is `.mes` (not `.msg`)
- Each message: `{ name: string, mes: string, is_user: boolean }`

---

#### `getLastUserMessage()` (line 73-83)
Finds the user's most recent message by scanning backward.

```javascript
function getLastUserMessage() {
    const context = SillyTavern.getContext();
    if (!context.chat) return null;
    const chat = context.chat;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].is_user) {
            return chat[i].mes;
        }
    }
    return null;
}
```

---

#### `queryRating(userMessage, context)` (line 85-102)
Sends message to LLM for MBTI tag analysis.

```javascript
async function queryRating(userMessage, context) {
    const fullPrompt = `Recent context:\n${context}\n\nCharacter's action: "${userMessage}"`;
    try {
        const ctx = SillyTavern.getContext();
        const response = await ctx.generateRaw({
            prompt: fullPrompt,
            systemPrompt: buildRatingSystemPrompt(),
        });
        return parseRatingResponse(response);
    } catch (error) {
        console.error('MBTI Widget: Rating query failed', error);
        return [];
    }
}
```

**Note:** Uses `SillyTavern.getContext().generateRaw()` - the same API SillyTavern uses for AI generation.

---

#### `buildRatingSystemPrompt()` (Prompt builders)
Builds the system prompt sent for the per-turn rating. The **tag pairs and the JSON schema are fixed and locked**; only the two description lines are filled from the `Prompts` settings:

- `reasoning` line ← `prompts.analysis` (default `Brief 1-2 sentence explanation`)
- `professor` (commenter) line ← `prompts.commenter.prompt` (default the "psychology professor at a whiteboard" wording)

`buildRescanPrompt()` is the re-scan variant: same locked schema, reasoning line injected, and **no** commenter line (re-scan stores no comments). `sanitizePromptText()` collapses whitespace so multiline textarea content cannot corrupt the JSON schema shown to the model. The commenter **name** (`prompts.commenter.name`, default `Psy Professor`) is display-only — it is never sent to the model; it renders as the panel section header via `updatePanel()`.

---

#### `applyTag(tag)` (line 116-127)
Maps tags to MBTI axis scores:

```javascript
function applyTag(tag) {
    switch (tag) {
        case 'shadow': scores.ie = Math.max(-MAX_SCORE, scores.ie - 1); break;
        case 'flame': scores.ie = Math.min(MAX_SCORE, scores.ie + 1); break;
        case 'reason': scores.tf = Math.max(-MAX_SCORE, scores.tf - 1); break;
        case 'heart': scores.tf = Math.min(MAX_SCORE, scores.tf + 1); break;
        case 'clue': scores.sn = Math.max(-MAX_SCORE, scores.sn - 1); break;
        case 'pattern': scores.sn = Math.min(MAX_SCORE, scores.sn + 1); break;
        case 'anchor': scores.jp = Math.max(-MAX_SCORE, scores.jp - 1); break;
        case 'drift': scores.jp = Math.min(MAX_SCORE, scores.jp + 1); break;
    }
}
```

**Tag → Axis mapping:**
| Tag | Axis | Direction |
|-----|------|-----------|
| shadow | I/E | -I (negative = Introverted) |
| flame | I/E | +E (positive = Extroverted) |
| reason | T/F | -T (negative = Thinking) |
| heart | T/F | +F (positive = Feeling) |
| clue | S/N | -S (negative = Sensing) |
| pattern | S/N | +N (positive = Intuitive) |
| anchor | J/P | -J (negative = Judging) |
| drift | J/P | +P (positive = Perceiving) |

---

### Storage Functions

#### `saveToChatMetadata()` (line 129-135)
Persists scores per chat:

```javascript
function saveToChatMetadata() {
    const context = SillyTavern.getContext();
    if (!context.chat) return;
    if (!context.chat.metadata) context.chat.metadata = {};
    context.chat.metadata.mbti_scores = scores;
    context.chat.metadata.mbti_trail = trail;
}
```

**Important:** Uses `context.chat.metadata` - not `localStorage` or `characterData`. This ensures per-chat profiles.

---

#### `loadFromChatMetadata()` (line 137-146)
Loads scores when chat opens:

```javascript
function loadFromChatMetadata() {
    const context = SillyTavern.getContext();
    if (context.chat?.metadata?.mbti_scores) {
        scores = context.chat.metadata.mbti_scores;
        trail = context.chat.metadata.mbti_trail || [];
    } else {
        scores = { ie: 0, tf: 0, sn: 0, jp: 0 };
        trail = [];
    }
}
```

---

### UI Functions

#### `updatePanel()` (line 191-250)
Updates all UI elements:
- MBTI code text
- Archetype name + description
- Octagon polygon points
- Individual dot positions
- Trail history (past 5 states)
- Axis bars (I/E, T/F, S/N, J/P)

#### `scoresToOctagonPoints(s)` (line 157-178)
Converts `{ie, tf, sn, jp}` scores to SVG polygon coordinates.

---

## Event Handling

The extension uses direct context access via `SillyTavern.getContext()`:

```javascript
const context = SillyTavern.getContext();

// CHAT_LOADED: Fires when a chat is loaded
context.eventSource.on(context.event_types.CHAT_LOADED, () => {
    loadFromChatMetadata();
    if (panelCreated) updatePanel();
});

// MESSAGE_RECEIVED: Fires after AI generates response (data = message index)
context.eventSource.on(context.event_types.MESSAGE_RECEIVED, async (data) => {
    // Process the message exchange
});
```

**Critical:** `MESSAGE_RECEIVED` fires AFTER the AI response is generated. At this point:
- User's message is in `context.chat`
- AI response is in `context.chat`
- All messages are accessible via `context.chat` array

---

## Settings System

### Settings Storage

Settings are stored in SillyTavern's global `extension_settings`:

```javascript
extension_settings = ctx.extension_settings || ctx.extensionSettings;

// Our settings are nested under our extension key:
extension_settings.mbti_widget = {
    enabled: true,           // Master toggle
    contextMessages: 5,     // How many messages for LLM context
    autoOpenOnLoad: false,  // Not currently used
};
```

### Settings UI (settings.html)

Uses SillyTavern's drawer classes:
- `.inline-drawer` - Collapsible accordion
- `.et-toggle-row` - Toggle switch
- `.et-range` - Slider input

---

## Constants

### MBTI Axis Scores

```javascript
const MAX_SCORE = 18;  // Maximum score per axis

let scores = {
    ie: 0,  // Introvert (neg) / Extrovert (pos)
    tf: 0,  // Thinking (neg) / Feeling (pos)
    sn: 0,  // Sensing (neg) / Intuitive (pos)
    jp: 0   // Judging (neg) / Perceiving (pos)
};
```

### VERTICES (octagon points)
Fixed SVG vertices for the radar chart (8 points forming an octagon).

---

## Common Issues & Fixes

### 1. `context.chat.messages` is undefined

**Wrong:**
```javascript
const messages = context.chat.messages || [];
```

**Correct:**
```javascript
const chat = context.chat;  // chat IS the array
```

### 2. Using `.msg` instead of `.mes`

**Wrong:**
```javascript
return messages[i].msg;
```

**Correct:**
```javascript
return chat[i].mes;
```

### 3. Using stale reference in event handler

In MESSAGE_RECEIVED handler, use module-level `extension_settings` (assigned at init):

```javascript
// DON'T call SillyTavern.getContext() fresh
const ctx = SillyTavern.getContext();
const settings = ctx.extension_settings?.mbti_widget;  // UNDEFINED

// DO use module-level variable
const settings = extension_settings?.mbti_widget;  // HAS VALUE
```

---

## Version History

- **3.3.1** - Radar modal refinements: thinner chart strokes (grid/trail 0.5px, current outline 0.9px) for a delicate look; axis labels switched to the header's `Cinzel` face at 9px; the Signature Axis stat now explains the MBTI letter with the full trait name (e.g. "toward E · Extraverted"); added the modal footer with **Journey** (`trail.length` observations + first/last `messageIndex` span) and **Axis Journey** — per-axis start→mid→current sparkline dots plus the net change chip (`last - first`), via `radarJourneyHTML()`/`radarMicroHTML()`.

- **3.3.0** - Radar zoom modal: a small expand button on the octagon chart opens a `#radar-overlay` modal rendering the same 0-220 coordinate-space radar at large scale, so the trail snapshots become clearly visible. The modal adds axis tag labels (`reason`/`pattern`/`flame`/`clue`/`heart`/`drift`/`shadow`/`anchor`) plus four derived stats: **Signature Axis** (axis with max `|score|`, its tag, and the MBTI letter it pushes toward), **Conviction %** (`Σ|s|/(4·MAX_SCORE)`, bucketed Building/Emerging/Firm/Set), **Biggest Turnaround** (largest `|entryDelta|` across consecutive entries, with the turn's `messageIndex`), and **Volatility** (total sign flips per axis across snapshots, most/least flip-prone tags).

- **3.2.4** - One record per reply: trail writes go through `upsertTrailEntry()` (replace/insert/remove-by-`messageIndex`), so re-analyzing or re-scanning the same reply overwrites its previous record instead of appending. Re-analyze rebases from the preceding record (no more score inflation on repeat analysis); "no tags" now removes a stale record. Re-scan dedupes analyses by `messageIndex` (last-wins), processes them chronologically, and numbers messages by their global chat index so re-scan keys collide with auto-analysis records; the `scores`/`trail` reset was removed from the pre-LLM phase so a failed scan no longer wipes the existing history.

- **3.2.3** - History modal now reads the commenter name strictly from metadata (`professorName`, captured per record at analysis time); the current-settings fallback in the render path is removed. Records with a comment but no stored name render without a prefix, so the history never mislabels old entries if the commenter is changed later.

- **3.2.2** - History modal: the commenter line now sits under a subtle top separator and is prefixed inline with the commenter name that was active when the entry was generated (`professorName`, captured at analysis time via `professorName: getPromptsSettings().commenter?.name || DEFAULT_COMMENT_NAME`). Re-scan stores no comments (and no name), as before.
- **3.2.1** - All UI fonts increased by 1px. Colors are now class-driven by sign instead of inline styles: new `mbti-tag-*` classes (flame/shadow/heart/reason/pattern/clue/drift/anchor — one per positive/negative tag) color the text and any child icon, used by the main meters (delta numbers, meter icons via `applyTagClass()`, bar fills via `bar-fill-<axis>-<neg|pos>` classes), the history sums, per-record icon/point chips, and the 8-color legend. `ratingIconHTML()`/`ratingChipHTML()`/`renderHistorySummary()`/`renderHistoryLegend()` no longer emit inline colors; neutral/zero state uses `mbti-tag-neutral`. Commenter text now matches the analysis text in both the main panel and history modal (no italics, same color/size; shared CSS rules).
- **3.2.0** - New "Prompts" settings section (below LLM Backend): "Latest Analysis" (reasoning instruction) and "Commenter" (Name + Prompt). The rating tags/pairs stay locked; the fixed `RATING_PROMPT`/`RESCAN_PROMPT` strings are replaced by `buildRatingSystemPrompt()` / `buildRescanPrompt()`, which inject the configured wording into the reasoning/commenter JSON-schema description lines. Commenter name is display-only (panel section label, default "Psy Professor", configurable via `prompts.commenter.name`); it is not sent to the model. Re-scan stores no comments, as before.
- **3.1.2** - History modal reworked: rows now show the msg number plus per-turn rating chips (axis icon + signed point change, colored per the main meters) on their own row, followed by the reasoning and the Psy Professor one-liner on separate rows; added a totals row under the header (current score per axis) and a legend footer for the icons. Shared `AXIS_META` constant drives the icons/colors for the meters and the modal; `extractTagsFromReasoning()` removed in favor of exact per-entry deltas from stored scores/previousScores.
- **3.1.1** - Response-format errors are surfaced to the user: `parseRatingResponse()` / `parseRescanResponse()` now return an `error` flag on hard failures (empty/malformed response), `reAnalyzeLastTurn()` / `reScanHistory()` show a styled, dismissible error popup with a context-aware **Re-send** button, and a persistent footer status bar (`setStatus()`) reflects busy/done/error/idle states.
- **3.1.0** - Manual "Re-analyze last turn" button; per-axis point deltas (`+N`/`-N`) on the meters with auto-fade; "Psy Professor" sarcastic one-liner in the analysis output (stored per trail entry, displayed in its own section)
- **3.0.0** - LLM Backend selection (SillyTavern current API vs custom OpenAI-compatible), re-scan context-safety guard, backend dispatcher (`generateMBTI`)
- **1.0.0** - Per-chat persistence, structured prompt system, trail history with reasoning
- **0.1.0** - Initial release with LLM-based MBTI tag analysis

---

## Storage Implementation

### Chat Metadata

The extension uses `context.chatMetadata` (SillyTavern's per-chat metadata object) for persistence:

```javascript
function saveToChatMetadata() {
    const context = SillyTavern.getContext();
    const metadata = context.chatMetadata;
    if (!metadata) return;
    metadata.mbti_scores = scores;
    metadata.mbti_trail = trail;
}
```

This data is stored in the chat file (`.jsonl`) under `chat_metadata`:
```json
{
  "chat_metadata": {
    "mbti_scores": { "ie": 2, "tf": -1, "sn": 3, "jp": 0 },
    "mbti_trail": [
      { "scores": { "ie": 1, "tf": 0, "sn": 2, "jp": 0 }, "reasoning": "...", "professor": "...", "professorName": "Psy Professor", "previousScores": { "ie": 0, "tf": 0, "sn": 1, "jp": 0 } }
    ]
  }
}
```

`reasoning` and `professor` are the LLM's analysis and its sarcastic "Psy Professor" one-liner for the turn. `previousScores` is a snapshot of `scores` taken *before* that turn's tags were applied, used to render the per-axis point deltas in the panel. `professorName` is the commenter name captured when the turn was generated, so history records keep their original author even if the commenter is renamed later. All four are optional for backward compatibility with trails saved before these fields existed (the history modal shows the comment without a name prefix when `professorName` is missing).

---

## Prompt System

### Structured Prompt Format

The LLM receives a structured prompt with conversation history:

```javascript
const prompt = `Analyze this conversation for MBTI personality profiling.
Respond with a JSON object containing "tags" and "reasoning".

## Recent Chat History
{last N messages}

## Last User Message
{user's message}

## Last AI Response
{character's response}

Tags: shadow, flame, reason, heart, clue, pattern, anchor, drift`;
```

The LLM returns:
```json
{
  "tags": ["shadow", "reason"],
  "reasoning": "User's message showed reflective thinking..."
}
```

---

## Trail System

The `trail` array stores the history of MBTI score changes, including the LLM's reasoning and Psy Professor commentary:

```javascript
trail = [
    {
        scores: { ie: 1, tf: 0, sn: 2, jp: 0 },
        reasoning: "User's question showed analytical thinking...",
        professor: "A chalkboard that answers questions — how adorably academic.",
        previousScores: { ie: 0, tf: 0, sn: 1, jp: 0 }
    },
    // ... more entries
];
```

Each entry is added after each message exchange (auto-trigger) or after a re-scan / manual "Re-analyze last turn", capturing how the personality profile evolves over time. `previousScores` drives the per-axis point deltas (`+N`/`-N`) shown under each meter.