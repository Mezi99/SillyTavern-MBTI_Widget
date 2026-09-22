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
├── index.js         # Main extension code (~4800 lines)
├── settings.html   # Settings UI (injects into extensions drawer)
└── style.css        # Scoped styles (~2660 lines)
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
reAnalyzeLastTurn()        → Skips unless a NEW user message (is_user) arrived
                             since the last record (Continue/regenerate/swipe
                             add no user input and never fire). Records are keyed
                             to the user message's chat index.
    ↓
getLastUserMessage()     → Get user's latest message + its chat index from context.chat
    ↓
getMessageContext(n)    → Get n recent messages for LLM context
    ↓
queryRating()          → Call generateMBTI() with prompt + systemPrompt
    ↓
parseRatingResponse() → Extract tags (normalized {tag, intensity, weight}) from LLM JSON response
    ↓
applyTagsTo(next, tags) → Update scores based on tag weights
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
  - If the endpoint rejects `max_tokens` as too large for the model, it retries once with the configured value. Context-limit errors ("Max context tokens: N", etc.) are parsed by `learnContextLimitFromError()` and stored in `customApi.learnedContextLength` (informational only — never overrides the user's setting).

Supporting helpers: `isCustomBackend()`, `getCustomApiSettings()`, `fetchModels()` (`GET {baseUrl}/models`), `testCustomConnection()`, `extractOpenAIContent()`. `generateWithCustomOpenAI()` attaches `error.status` and `error.isRetryable` (429/5xx) to thrown HTTP errors so the re-scan chunk loop can decide what to retry; CORS errors are marked non-retryable.

The custom API key is stored in `localStorage` under `mbti_widget_api_key` (never in `extension_settings`, so it is not synced to the server or written to chat metadata). All other backend settings live in `extension_settings.mbti_widget.{backend, customApi}`.

### Context budget / overflow guard (re-scan)

The re-scan request can include a large slice of the chat, so it is guarded against exceeding the model's context window. The effective budget comes from `getContextBudget()`:

- **`st` backend**: reads `getMaxPromptTokens()` from SillyTavern's `script.js` via a **guarded dynamic `import()`** (tries the documented third-party mount depth `../../../../script.js`, then `../../../script.js` as a fallback, aligning with the repo's "no ES6 static imports" design). This is the same authoritative per-model budget SillyTavern itself uses (context minus reserved response). Never hardcoded.
- **`custom` backend**: uses `customApi.contextLength`. This is **user-managed**, defaults to **64,000** (migrates the old `0` default), and is auto-filled from the provider's `/models` metadata via `extractModelContextLength()`. The provider-reported real limit learned from errors (`customApi.learnedContextLength`) is **informational only** — the user's value always wins for budgeting — and is surfaced in the re-scan popup when it differs.

If the `script.js` dynamic import is unavailable (path/export differences across ST versions), `getContextBudget()` falls back to reading `context.chatCompletionSettings.openai_max_context` (OpenAI) or `context.maxContext` (local/text-generation backends), and finally `0` (no cap). Because the import is dynamic and wrapped in try/catch, a failure can never prevent the extension from loading.

Message packing is **contiguous chunks, oldest-first, no overlap** (v3.8): when the requested window plus its expected output would exceed the budget, `fitChunks()` splits the messages into as many separate requests as needed so **every** message is analyzed — nothing is omitted. `fitChunks(messages, budget)` counts each message's cleaned line once (token counts cached per line, prompt tokens counted once) and accumulates messages until `input + output ≤ context` stops fitting, then starts a new chunk; a single message that alone exceeds the budget is forced into its own oversized chunk so the loop always terminates. The scan runs through `scanChunkWithRetry()` (transient failures — 429 / 5xx / timeouts / network — retried with capped exponential backoff: max 2 retries, 1.5s base → 8s max, ±300ms jitter; aborts and 4xx/CORS are never retried) with a 250ms `CHUNK_BREATHE_MS` idle between consecutive chunks for local models. When the whole window fits in one request the scan degrades exactly to the v3.7 single-shot path. `countRescanTokens()` uses `context.getTokenCountAsync()` (SillyTavern's tokenizer) with a `chars/4` heuristic fallback, and the re-scan popup previews the live chunk plan (`"N contiguous chunks, oldest first, no messages omitted"`) via the same `fitChunks()`. The auto-trigger (`reAnalyzeLastTurn()`) is **not** token-capped — it only rates the newest user input with a bounded `contextMessages` window. It fires on `MESSAGE_RECEIVED` **only when a genuinely new user message arrived**: the latest `is_user` chat index must be greater than the last trail record's `messageIndex`. ST's **Continue**, regenerate, and swipe append an AI message with no new user input, so they never fire; consecutive-AI chats are handled because the check is purely index-based (record indices are the user messages' chat-file numbers, matching the re-scan). The manual **Re-analyze** button and the error popup's **Re-send** pass `force: true` to analyze the current turn regardless.

**Two related knobs — don't confuse them:** (1) **Re-scan** (`#rescan-slider` → `rescanMessages`): *boundless*. On popup open, `slider.max` is set to the full `chat.length` (`updateRescanSlider()`), and an unset or `0` value defaults the slider to the **whole chat including message 0** (`openRescanPopup()`) — so a re-scan can cover any number of messages up to the entire history, then chunks oldest-first to fit. The `min="5" max="10"` in the popup HTML is only the initial geometry before it is rescaled. (2) **Auto-trigger context** (`extension_settings.mbti_widget.contextMessages`, the settings-drawer slider `#mbti_context_messages`, min 1 max 10, default 5): the number of recent messages included in the `chat_history` block when analyzing the *last* turn. One changes/rebuilds recorded analyses; the other only controls the per-turn rating context.

**Regex cleaning (foundational):** SillyTavern's main prompt path and ST-Copilot run ST's **Regex Scripts** engine over message content (stripping CYOA option markers, tracker dumps, etc.) before it reaches the model. This extension sends message text directly, so it mirrors that behavior: `cleanMessageText()` applies the active regex engine via a guarded dynamic `import('/scripts/extensions/regex/engine.js')` (placements `USER_INPUT` for user messages, `AI_OUTPUT` otherwise; `depth` = messages-from-the-end), cached per message. Both `buildRescanChatText()` and `getMessageContext()` run cleaned text, so the model sees the clean story **and** the token estimate matches the payload that is actually sent (previously the raw history over-counted by ~40k tokens of regex-strippable content).

**Re-scan output scaling:** The re-scan prompt asks the model to return one analysis entry per user message (tags + reasoning), so output grows with user message count. `getRescanOutputBudget(userMessageCount, inputEstimate, contextBudget)` requests the **remaining context** (`context − inputEstimate`, floored at 1024, capped at 32,768 tokens) — the largest output that still fits — so reasoning-model "thinking" is never truncated; when the context window is unknown it falls back to `max(configured maxTokens, userMessageCount × 160)` capped at 32,768. In v3.8 the budget is applied **per chunk**: each chunk's user messages get the largest output that fits its own remaining context, but `fitChunks()` no longer packs to the last token. Two problems surfaced in testing: packing to `input + ≤ budget` is a tautology (the chunk is closed only when the 1024-token floor kicks in, leaving ~1k output tokens for dozens of analyses) and requesting "the largest output that fits" cancels the reservation that used to work against an **unknown** window. The fix reserves output explicitly while packing: a chunk is flushed when `candidate input + requiredRescanOutput(candidateUsers) > budget`, where `requiredRescanOutput(userCount) = min(32768, max(1024, userCount × RESCAN_OUTPUT_PER_USER))` with `RESCAN_OUTPUT_PER_USER = 160` — the same per-analysis allowance the unknown-window fallback already used. The single-shot decision in `reScanHistory()` uses the same guard, so a whole-window scan only happens when the window plus the reservation fits. Output room is also cheapened when that room would be thrown away: the re-scan **omits the `reasoning` schema line unless Analysis is Active AND Save is on** (a re-scan with save-off is ratings-only — the reasoning text would be discarded — so the model writes a smaller, cheaper record). Even so, both `getRescanOutputBudget` and the packer keep a 1024-token floor so a chunk always has room for at least the tags. `generateWithCustomOpenAI()` retries once at the configured `max_tokens` if the provider rejects a too-large request, so low-output-cap models still work, and logs a `finish_reason: length` warning so a truncated reply is diagnosable. If the custom API still returns empty content despite the scaling, the error includes `finish_reason` and response structure details for diagnosis.

### Message role handling

Both `getMessageContext()` (auto-trigger) and `reScanHistory()` (re-scan) **skip `is_system` messages** (they aren't user behavior and would be mislabeled) and run each message's text through the regex engine via `cleanMessageText()`. Messages are labeled `[user]` / `[ai]` inline (with the speaker's name) rather than relying on native role arrays, so a one-shot re-scan can ask the model to return the `messageIndex` of each analyzed message.

### Chunked re-scan pipeline (v3.8)

The re-scan scan splits into chunks only when one request would overflow the budget; otherwise it is the single v3.7 call. New helpers:

- `sleep(ms)` — promise-based delay (used for the inter-chunk breathe and retry backoff).
- `isTransientError(err)` — true for `429`, `5xx`, timeout/ECONNRESET/network messages; false for `AbortError`, stopped scans, CORS, and anything tagged `isRetryable === false`.
- `SCAN_RETRY` — `{ maxRetries: 2, baseDelayMs: 1500, maxDelayMs: 8000, multiplier: 2, jitterMs: 300 }`, applied by `scanChunkWithRetry()` with capped exponential backoff.
- `CHUNK_BREATHE_MS` — 250ms idle between consecutive chunks.
- `countTokens(text)` — arbitrary-text token count (`getTokenCountAsync`, `chars/4` fallback).
- `buildRescanLine(m)` / `buildRescanChatText(messages)` — one-line (`[idx] [user|ai] name: cleaned`) formatting; the chat payload.
- `fitChunks(messages, budget)` — contiguous oldest-first packing returning `[{ messages, inputTokens }]`; used by both the scanner and the popup preview so the plan always matches the actual scan. Closes a chunk when `candidate input + requiredRescanOutput(candidateUsers) > budget` (explicit per-user output reservation, not `getRescanOutputBudget`'s "remaining context" — see Re-scan output scaling).
- `RESCAN_OUTPUT_PER_USER` / `requiredRescanOutput(userCount)` — `160` tokens reserved per user message; `min(32768, max(1024, userCount × 160))`. Shared by `fitChunks()` and the single-shot decision in `reScanHistory()`, so a whole-window scan only happens when the window plus its reservation fits.
- `scanChunkWithRetry(chatText, outputBudget)` — one LLM chunk request, running `generateMBTI` (ST or custom backend) with transient retry.
- `looksTruncated(text)` — classifies an unparsable reply as an output **truncation** (odd ` ``` ` fence count, or more `{` than `}`) so the popup says "cut off before the JSON completed" instead of a generic format error.

The scan loop in `reScanHistory()` merges every chunk's resolved analyses in one global map keyed by `messageIndex`, then rebuilds the trail once. A failed chunk aborts the whole scan (trail untouched, Re-send popup); `Stop` aborts between/inside chunks and records nothing.

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

#### `getLastUserMessage()` (line 228)
Finds the user's most recent message by scanning backward (skipping `is_system`), and returns the message text plus its chat index, the user message object, and the AI response object — so callers can key records to the user message's number and regex-clean both texts before sending.

```javascript
function getLastUserMessage() {
    const context = SillyTavern.getContext();
    if (!context.chat) return { userMessage: null, aiResponse: null, userIdx: -1, userMsgObj: null, aiMsgObj: null };
    const chat = context.chat;
    let userMessage = null, userMsgObj = null, userIdx = -1, aiResponse = null, aiMsgObj = null;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!userMessage && chat[i].is_user && !chat[i].is_system) {
            userMessage = chat[i].mes; userMsgObj = chat[i]; userIdx = i;
        } else if (!aiResponse && !chat[i].is_user && !chat[i].is_system) {
            aiResponse = chat[i].mes; aiMsgObj = chat[i];
        }
        if (userMessage && aiResponse) break;
    }
    return { userMessage, aiResponse, userIdx, userMsgObj, aiMsgObj };
}
```

---

#### `queryRating(lastUserMessage, lastAiResponse, chatHistory)` (line 571)
Sends the cleaned last turn plus the recent chat-history block to the LLM for MBTI tag analysis.

```javascript
async function queryRating(lastUserMessage, lastAiResponse, chatHistory) {
    const promptData = {
        chat_history: chatHistory,
        last_user_message: lastUserMessage,
        last_ai_response: lastAiResponse
    };
    try {
        const response = await generateMBTI({
            prompt: JSON.stringify(promptData, null, 2),
            systemPrompt: buildRatingSystemPrompt(),
        });
        return parseRatingResponse(response);
    } catch (error) {
        console.error('MBTI Widget: Rating query failed', error);
        if (isCustomBackend()) showTestResult(`Analysis failed: ${error.message}`, 'err');
        return { tags: [], reasoning: '', commenter: '', error: true };
    }
}
```

**Prompt payload:** `chat_history` comes from `getMessageContext()` (each message regex-cleaned), and `last_user_message` / `last_ai_response` are cleaned via `cleanMessageText()` on the message objects before this call — so the whole on-the-wire payload is stripped (grading markers, CYOA syntax, trailing whitespace) exactly like the re-scan path. `cleanMessageText` never throws; a regex-engine import failure falls back to raw text.

**Failure semantics:** both a parse failure (`parseRatingResponse` → `error: true`) and a transport/generation exception now return `error: true`. `reAnalyzeLastTurn()` treats either as "no write": it shows the error plus a Re-send popup and never calls `upsertTrailEntry`/`saveToChatMetadata`, so failed requests cannot remove or append garbage in the metadata. A successful response (`error: false`, guaranteed 1–4 valid tags) is the only path that records — replacement or append, per `upsertTrailEntry`.

**Note:** Uses the same `generateMBTI()` backend abstraction as the rest of the extension.

---

#### `buildRatingSystemPrompt()` (Prompt builders)
Builds the system prompt sent for the per-turn rating. The **tag pairs and the JSON schema are fixed and locked**; only the description lines are filled from the `Prompts` settings, and each is **omitted wholesale when its prompt's Active toggle is off** (so the model never produces output the widget would discard):

- `reasoning` line ← `prompts.analysis` (default `Brief 1-2 sentence explanation`) — present only while `prompts.activeAnalysis !== false`
- `commenter` line ← `prompts.commenter.prompt` (default the "psychology professor at a whiteboard" wording) — present only while `prompts.activeCommenter !== false`

`buildRescanPrompt()` is the re-scan variant: same locked schema, reasoning line injected (omitted when Analysis is **inactive** OR its Save toggle is off — a save-off re-scan is ratings-only, so the text the model would otherwise write is neither requested nor discarded), and **no** commenter line (re-scan stores no comments). `sanitizePromptText()` collapses whitespace so multiline textarea content cannot corrupt the JSON schema shown to the model. The commenter **name** (`prompts.commenter.name`, default `Psy Professor`) is display-only — it is never sent to the model; it renders as the panel section header via `updatePanel()`.

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
async function saveToChatMetadata() {
    const context = SillyTavern.getContext();
    const metadata = context.chatMetadata;
    if (!metadata) return;
    metadata.mbti_scores = scores;
    metadata.mbti_trail = trail;
    // Last-state keys: written ONLY when a prompt is Active but its per-turn
    // records are NOT saved to the trail (see "Personalization / persistence
    // toggles"); deleted otherwise so stale values never linger.
    if (analysisEnabled() && !analysisSaved()) {
        metadata.mbti_last_analysis = lastAnalysis;
        metadata.mbti_last_analysis_name = analysisDisplayName();
    } else {
        delete metadata.mbti_last_analysis;
        delete metadata.mbti_last_analysis_name;
    }
    if (commenterEnabled() && !commenterSaved()) {
        metadata.mbti_last_commenter = lastCommenter;
        metadata.mbti_last_commenter_name = commenterDisplayName();
    } else {
        delete metadata.mbti_last_commenter;
        delete metadata.mbti_last_commenter_name;
    }
    await context.saveMetadata();
}
```

**Important:** Uses `context.chat.metadata` - not `localStorage` or `characterData`. This ensures per-chat profiles.

---

#### `loadFromChatMetadata()` (line 829)
Loads scores when a chat opens, restores the last-analysis / last-commenter display state, then prunes stale records for branched/shortened chats.

```javascript
async function loadFromChatMetadata() {
    const context = SillyTavern.getContext();
    const metadata = context.chatMetadata;
    if (metadata?.mbti_scores) {
        scores = metadata.mbti_scores;
        trail = metadata.mbti_trail || [];
    } else {
        scores = { ie: 0, tf: 0, sn: 0, jp: 0 };
        trail = [];
    }
    refreshLastState();          // rebuild lastAnalysis/lastCommenter display state
    updatePanel();
    if (pruneStaleTrailEntries()) {   // branched/shortened chat?
        lastAnalysis = '';            // ...and cleared last state → empty panel
        lastCommenter = '';
        await saveToChatMetadata();   // persist the pruned state
        updatePanel();
    }
}
```

**Last-state restore (`refreshLastState()`):** for a Save=on prompt the display text comes from the trail's final record (with a fallback to the last-state keys for older chats); for a Save=off prompt it comes from the `mbti_last_*` metadata keys alone. A disabled (inactive) prompt always yields `''`, hiding its panel section.

**Branch handling:** ST's "branch from message N" copies the chat metadata but truncates the chat file. `pruneStaleTrailEntries()` (called on every chat load) keeps only trail records whose `messageIndex` still maps to a real `is_user` message in the current chat, dedupes last-wins, and rebuilds the cumulative chain from each record's own tag contribution (`scores − previousScores`). Stale tail records (referencing messages that no longer exist) and legacy AI-indexed rows are dropped — and the last analysis/commenter state is cleared to `''` at the same time — so the auto-trigger guard (`userIdx <= lastRecordIdx`) can fire again on the branched chat's next user message and the history modal and panel only show the valid prefix.

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
const MAX_SCORE = 18;  // Maximum score per axis — normalization constant, deliberately unchanged in v3.7
```

**Why MAX_SCORE is still 18 (v3.7):** weighted deltas (0.5 / 1.0 / 1.5 / 2.0) are clamped by `Math.max/min` in `applyTagsTo()` exactly like integer deltas were, so fractional increments saturate at ±18 without ever overshooting. The constant is used by 26 sites purely as a shared ceiling/scaling factor (bar widths, radar polygon coordinates, conviction % `Σ|s|/(4·MAX_SCORE)`, stats domain). Because float clamping at an integer bound is mathematically identical to int clamping, scores stay in `[-18, 18]` and no UI geometry needs to change — that is why the value is left untouched rather than bumped.

```javascript
let scores = {
    ie: 0,  // Introvert (neg) / Extrovert (pos)
    tf: 0,  // Thinking (neg) / Feeling (pos)
    sn: 0,  // Sensing (neg) / Intuitive (pos)
    jp: 0   // Judging (neg) / Perceiving (pos)
};
```

### Weighted scoring (v3.7)

Prompts ask for tag objects with one of four fixed intensity labels; the parser maps them to delta weights (never floats from the model):

```javascript
const INTENSITY_WEIGHTS = { subtle: 0.5, clear: 1.0, strong: 1.5, defining: 2.0 };
const DEFAULT_INTENSITY = 'clear';   // fallback for missing/unknown/legacy-bare entries
const VALID_TAGS = ['shadow', 'flame', 'reason', 'heart', 'clue', 'pattern', 'anchor', 'drift'];
```

- LLM output shape: `{ "tags": [ { "tag": "flame", "intensity": "strong" } ], "reasoning": "...", "commenter": "..." }` (re-scan per analysis; pre-v3.7.1 responses may say `professor` instead of `commenter` — both are parsed).
- Every raw entry goes through `normalizeTagEntry()` → `{tag, intensity, weight}`; bare strings and unknown intensities normalize to `clear`/1.0, preserving pre-v3.7 behavior for flaky models.
- `applyTagsTo(scoresObj, tags)` (index.js, module-level setting gate `extension_settings.mbti_widget.weightedScoring !== false`) applies `weight` per tag instead of fixed 1; the toggle off reproduces old fixed-±1 scoring exactly.
- Trail records store `appliedTags: [{ tag, intensity }]`; the history chips and panel deltas render intensity via `data-intensity` attributes. Per-turn `reasoning`/`commenter`/names appear in a record **only when that prompt is Active and its Save toggle is on** (`analysisSaved()` / `commenterSaved()`); otherwise the latest text lives solely in the last-state metadata.
- Example trail entry (auto-trigger record):

```javascript
{
  messageIndex: 12,
  previousScores: { ie: 0, tf: 0, sn: 0, jp: 0 },
  scores: { ie: 1.5, tf: 0, sn: 0, jp: 0 },          // flame/strong applied
  appliedTags: [{ tag: "flame", intensity: "strong" }],
  reasoning: "The user jumped straight into the argument.",
  commenter: "Directly to the chalk — no detour through caution.",
  commenterName: "Psy Professor"
}
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

- **3.8.0** - Chunked full-history re-scan. When the scanned window (plus the output it would request) exceeds the context budget, the re-scan is split into **contiguous, oldest-first, gap-free chunks** (`fitChunks()`) so the **entire** requested history is analyzed — long chats and small local models are no longer truncated to the newest messages (the v3.7 "omitted" note line is gone). Each message's cleaned line is token-counted once (per-line cache) for O(N) fit; a single over-budget message is forced into its own oversized chunk so the loop terminates. Chunks run through `scanChunkWithRetry()` (transient failures — 429 / 5xx / timeout / network — retried up to 2× with capped exponential backoff + jitter; aborts and CORS/4xx never retried; `generateWithCustomOpenAI()` now tags errors with `status`/`isRetryable`), paced with a 250ms `CHUNK_BREATHE_MS` between chunks, and the footer shows live progress (`Re-scan chunk i/N (messages a–b)...`). Per-chunk results are merged by resolved `messageIndex` (exact / ±1 snap / drop), then the trail is rebuilt **once** from the merged set, so a mid-scan failure or Stop never leaves partial data and the whole scan fails atomically with the existing Re-send popup. A whole-history scan that fits one request is byte-identical to the old single-shot path. The popup preview now computes the live chunk plan via `fitChunks()` and shows an info-styled banner (`N chunks · no messages omitted`) instead of an omission count; `countFittingMessages()` is removed. When the scan window exceeds the budget but is a single giant message the banner states it runs as one oversized request. Version bumped 3.7.1 → 3.8.0 (manifest + load banner). Debugging the first chunked scans exposed a packing tautology fixed before release: `fitChunks` flushed only when `input + "remaining context" > budget` (a tautology — the 1024 floor closed chunks with ~1k tokens of output room), so every chunk hit `finish_reason: length` and died mid-JSON (the unclosed ```json fence). The scan now reserves output explicitly (`RESCAN_OUTPUT_PER_USER = 160` per user message via `requiredRescanOutput()`), the single-shot guard uses the same reservation, and the re-scan omits the `reasoning` schema line when Analysis is inactive **or** save-off (ratings-only re-scan). Truncation is classified (`looksTruncated()` — odd fence count or unbalanced braces → "cut off before the JSON completed" popup), `generateWithCustomOpenAI()` warns on `finish_reason: length`, and failures dump the **full** raw response (plus a hex head) and each chunk's full system + user prompt to the console while the popup keeps a 240-char snippet.

- **3.7.1** - Per-prompt Activity + persistence toggles (save-on/off + active-on/off for the **Analysis** and **Commenter** prompts) and the `professor` → `commenter` rename. New `prompts` settings, all bootstrapped with `=== undefined` guards and defaults (both prompts **Active**, **Analysis saved**, **Commenter not saved**): `activeAnalysis`, `saveAnalysis`, `activeCommenter`, `saveCommenter`. A disabled (inactive) prompt is omitted **entirely** from every built system prompt (`buildRatingSystemPrompt()` drops the `reasoning` line, the `commenter` line, or both; `buildRescanPrompt()` drops its `reasoning` line) and its save flag is force-cleared at bootstrap + UI level (the Save checkbox is disabled while Active is off — "must be toggled on for the save on/off to be usable"). Trail records are gated in the single writer `upsertTrailEntry()` and in `rebuildTrailFromAnalyses()`: the per-turn `reasoning`/`analysisName`/`commenter`/`commenterName` fields land in `mbti_trail` only when that prompt is active AND saved — the "crucial" rating part (scores, deltas, `appliedTags` chips) is **always** saved, so the history modal still shows every entry. When a prompt is active but save-off, only its **latest** output survives via new module vars `lastAnalysis`/`lastCommenter` persisted to new chat-metadata keys `mbti_last_analysis`/`mbti_last_analysis_name`/`mbti_last_commenter`/`mbti_last_commenter_name` (written in `saveToChatMetadata`, deleted when redundant); `refreshLastState()` rebuilds them on chat load, and `pruneStaleTrailEntries()` fixes them to `''` too, so a branched chat displays nothing rather than stale text. `updatePanel()` now reads the display from those module vars, hides the whole `.reasoning-display` when Analysis is inactive, keeps the (moved-out-of-`reasoning-display`) `.professor-section` hidden unless Commenter is active with text, and uses `analysisDisplayName()`/`commenterDisplayName()`. The history modal renders rows through `entryCommenter()`/`entryCommenterName()` (which read the new `commenter`/`commenterName` keys with a silent fallback to legacy `professor`/`professorName` saved by long-existing chats) and **omits** any reasoning/comment row a record does not store — no more "No reasoning recorded" filler. Default display name renamed `'Latest Analysis'` → `'Analysis'` (`DEFAULT_ANALYSIS_NAME`, drawer block, panel label). The commenter is `commenter` everywhere in code/JSON (`professor` kept only as a read-back-compat alias). Manifest + load banner → 3.7.1; schema docs note the omitted fields; storage docs updated.

- **3.7.0** - Scoring Model: weighted, graded tags. The LLM is now prompted to return each tag as `{ "tag": ..., "intensity": ... }` with one of four fixed labels — `subtle` (0.5), `clear` (1.0), `strong` (1.5), `defining` (2.0) — mapped to delta weights by the new module constants `INTENSITY_WEIGHTS` / `DEFAULT_INTENSITY`. `parseRatingResponse()` / `parseRescanResponse()` normalize every entry through `normalizeTagEntry()` into `{tag, intensity, weight}` triples (bare strings and unknown/missing intensities fall back to `clear`/1.0, so legacy responses behave exactly like the old fixed-±1), and `applyTagsTo()` (the real scoring entry point; there is no `applyTag`) applies `weight` instead of a hardcoded 1, gated by the new **Weighted scoring** setting (`extension_settings.mbti_widget.weightedScoring`, default `true`, toggle in the extension drawer, wired and saved like `mbti_enabled`) — when off it deterministically reproduces pre-v3.7. Each trail record now stores `appliedTags` (`{tag, intensity}` pairs, spread automatically through `pruneStaleTrailEntries`' rebuild) so the history UI can restate intensity; chips carry `data-intensity` and deltas render through the new `formatSigned()` helper (`+1.5`, no trailing `.0`). CSS adds `[data-intensity]` shading for both the panel's `.axis-delta` numbers and history `.mbti-rating-chip` numbers (the icon keeps its polarity tag color), with the 8s delta fade re-declared at strictly higher specificity (`#mbti-widget-panel .axis-delta[data-intensity].fade`) so intensity colors can never defeat it. **`MAX_SCORE` stays 18 by design:** it is a pure normalization constant (clamp ceiling, bar/radar scale, conviction % = Σ|s|/(4·18)) shared by 26 call sites, and since every write path clamps via `Math.max/min`, fractional weights (0.5/1.5/...) simply saturate at ±18 exactly as integers do — running the widget mathematically changes nothing structurally, so the constant is left untouched. Schema docs (`schema-auto-trigger.md`, `schema-rescan.md`) updated to the `{tag, intensity}` shape. Follow-up fixes on the same release: intensity emphasis is **bold/opacity only** (delays keep their polarity `mbti-tag-*` colors everywhere — the v3.7 `strong`/`defining` rules originally recolored them away), and `scoresToOctagonPoints` now uses `MAX_R = 84` (`BASE + MAX_R = 92`, the outer web ring) so the radar polygon previously pegged at radius 100 no longer escapes the grid — fixing the main-window overflow and the radar-modal tag-label overlap. Version bumped 3.6.0 → 3.7.0 (manifest + load banner). Implemented on branch `v3.7`; `main` untouched.

- **3.6.0** - MBTI Widget is now enabled by default on first install. The settings bootstrap previously set `enabled: true` only via the `extension_settings.mbti_widget = extension_settings.mbti_widget || {...}` short-circuit, which fires solely when the whole object is absent. If the key existed from an older version but lacked `enabled` (or held `false`), the default never applied, leaving the drawer toggle unchecked and the auto-trigger guard (`index.js` `if (!settings?.enabled) return;`) silently inactive — the "where is it?" confusion. The bootstrap is now `mbti_widget = mbti_widget || {}` followed by explicit `=== undefined` guards for `enabled` (→ `true`), `contextMessages` (→ 5) and `autoOpenOnLoad` (→ `false`), so a missing field defaults to enabled on first load while a deliberately-saved `false` is still honored. Version bumped 3.5.7 → 3.6.0 (manifest + load banner).

- **3.5.7** - Added a Stop button that cancels an in-flight prompt request (auto-trigger, Re-scan All, or Re-scan Last). New module globals `isStopped` and `activeAbortController`: `generateMBTI()` now creates a fresh `AbortController` per call and clears it in `finally`; the custom-OAI path passes its `signal` straight into the `fetch()` request (real cancellable network call), while the SillyTavern path relies on `generateRaw`, whose internal `AbortController` is bound to the `GENERATION_STOPPED` event (see ST `generateRawData`, script.js:3959) — so the new `#stop-btn` handler sets `isStopped`, calls `activeAbortController.abort()`, and `ctx.eventSource.emit(ctx.event_types.GENERATION_STOPPED)`. It deliberately does NOT call `ctx.stopGeneration()` (that method would also abort the main-chat reply via `abortController.abort()` in script.js:5554). `updateProcessingUI(busy)` (driven by `setStatus` state, `state === 'busy'`) hides the two bottom pills and shows `#stop-btn` full-width while a request runs; it is state-driven (not `isProcessing`) so a "Response format error" path (`setStatus('error')`) can never leave Stop stuck. Both `reAnalyzeLastTurn` and `reScanHistory` treat `isStopped || error?.name === 'AbortError'` as a clean abort: status "Analysis aborted"/"Re-scan aborted", `showErrorPopup('The analysis/re-scan was aborted', { resend: false, title: '… Stopped' })`, record nothing, and a post-`await` `if (isStopped)` guard discards late-resolving backend responses. `showErrorPopup(message, opts)` gained `opts.title` (defaults 'Analysis Error', written to the new `#mbti-error-title` element) and `opts.resend === false` hides the `#mbti-error-resend` button. Visually `#stop-btn` reuses the `.action-btn` gold border/bg (4px radius, 26px, flex:1) but its label + small square `.stop-icon` (CSS mask of an icons8 stop glyph, mirroring `.reanalyze-icon`) render in a muted orange (`rgba(222,160,90,0.9)`) instead of alert red.

- **3.5.6** - Small layout and affordance fixes. The bottom menu labeled buttons (`#rescan-btn`, `#reanalyze-btn`) switched from pill-shaped (`border-radius: 999px`) to 4px rounded rectangles to match the header icon buttons. The MBTI type code (`#mbti-code`) moved out of the top header (which now holds only the four action buttons) and sits centered under the archetype name; the profile header flex changed from `space-between` to `flex-end` and `margin-bottom` increased 4px→10px so "Your Nature" is no longer crowded. The clickable reasoning and commenter titles gained a visual affordance: a chevron caret (`▾` via `::after`) that rotates to `▴` when that block is expanded, plus a subtle rounded hover-background chip and a persistent tinted chip when `.is-expanded`, all driven by `reasoningLabel`/`professorLabel` class toggles in `updatePanel()`.

- **3.5.5** - Main-window button reorganization + spacing/popup cleanup. Header actions are now Wiki · History · Radar zoom · Stats (`#history-btn` moved up from the bottom menu). The bottom `#mbti-actions` row became two equal-width slim (26px) labeled pill buttons under a shared `.action-btn` rule (gold border/bg theme, flex:1 spread, 12px icon left of the label): `#rescan-btn` → "Re-scan All" (opens the re-scan popup, tooltip explains it rebuilds the rating trail) and `#reanalyze-btn` → "Re-scan Last" (moved down out of `.reasoning-header`, which now holds only the clickable title; tooltip "Re-analyze the most recent turn"). All button IDs and their click/close handlers are unchanged. The redundant in-popup loader was removed - the main-window footer spinner already signals busy state via `setStatus()` - so `showRescanProgress()` now only toggles the go-button disabled state/"Scanning..." label, the `#rescan-progress` HTML block is gone, and the `.rescan-progress/.rescan-spinner/.rescan-progress-text` CSS deleted (the shared `@keyframes rescan-spin` kept for the footer spinner). Spacing trimmed below the main-window loader: `.mbti-footer` vertical padding 10px→6px and `.profile-shell` bottom padding 14px→8px.

- **3.5.4** - Polish batch. The "Latest Analysis" block in the extension drawer now mirrors the Commenter block (a `Name` field + a `Prompt` textarea), and all prompt-section hint texts were removed (self-explanatory fields). The new `prompts.analysisName` (default `DEFAULT_ANALYSIS_NAME = 'Latest Analysis'`) makes that title fully editable: `updatePanel()` writes it into the main-window reasoning label (`#reasoning-label`), it is captured at analysis time and stored per-trail-record (`record.analysisName`, saved via `mbti_trail` metadata, re-scan records also store it), and the history modal prefixes the reasoning line with it (`<span class="history-row-analysis-name">`) exactly like the commenter title prefix. Main-window reasoning and commenter text are clamped to 3 lines (`-webkit-line-clamp`) with an `.expanded` override; clicking the reasoning or commenter title toggles that block (exclusive — opening one closes the other, default collapsed; `reasoningExpanded`/`professorExpanded` flags drive `updatePanel`). The two clickable title styles were unified to one gold Cinzel rule (10px, uppercase, `rgba(212,175,55,0.6)`, hover brightens).

- **3.5.3** - Wiki content converted to a data-driven model. The per-archetype HTML panes in `WIKI_CONTENT` (ESTJ only) are replaced by embedded JSON for all 16 types, distilled from the user's `MBTI_WIKI_DATA.json`: bullets, asset / risk / secondaryAsset / secondaryRisk, `mind` functions with explicit `role` (Dominant/Auxiliary/Tertiary/Inferior) rather than key order, `pressure`, `growth`, and `fiction` (3 tone-tagged entries). New `FUNCTION_NAMES`, `ROLE_PRIORITY`, `ROLE_DOTS`, and `COGNITIVE_STACKS` tables drive a single renderer path. `buildWikiOverview/Mind/Pressure/Growth/Fiction` emit the exact prototype classes (verified: token stream identical to the v3.5.2 ESTJ HTML), `renderWikiPanes(key)` concatenates the five panes, and `openFullArchModal()` now calls `renderWikiPanes()` instead of injecting raw HTML - the simple fallback card and hidden-tab behavior remain for keys without an entry. Mind rows are sorted by role priority (never JSON key order); dots reflect role maturity (Dominant 4 → Inferior 1). The wiki JSON is also the authoritative source for primary asset/risk, which is propagated back into `ARCHETYPES` so the fallback card matches the Overview pane. `MBTI_WIKI_SPEC.txt` documents the JSON schema.

- **3.5.2** - Tabbed encyclopedia wiki modal (the "magnify" modal). The single-scroll archetype card is replaced with the user's finalized 5-tab prototype (Overview / Mind / Pressure / Growth / Fiction). The modal skeleton gained `#mbti-full-arch-identity` (badge / title / tagline left + 2×2 traits grid right, prototype-styled) and `#mbti-full-arch-tabs-wrap` (5 buttons + sliding gold underline) between the illustration and the now-scrollable body. `openFullArchModal()` renders the identity from `ARCHETYPES` (title-cased via new `toTitleCase()` helper, colored per-archetype) and injects the five panes from the new `WIKI_CONTENT` map (keyed by MBTI code, raw HTML; ESTJ shipped, others fall back to the old simple card with tabs hidden, so content can drop in incrementally). Tab switching mirrors the prototype: active classes, animated underline (`offsetLeft/offsetWidth`), content scroll reset. All prototype styles appended to style.css scoped under `#mbti-full-arch-modal` (zero collision risk), so future archetype panes can be pasted verbatim from `MBTI_WIKI.txt`. Modal is now a fixed 680px (`max-height:95vh`), illustration 220→170px, illustration overlay 90→70px, body font 12px. Close button re-binding switched to a document-level delegated listener so the re-injected `#mbti-full-arch-close-btn` works after the first open. Sizing/content copy all match the user's `estj_modal_prototype.html` final version.

- **3.5.1** - MBTI modal illustration refresh. All 16 archetype SVGs + the `unknown` placeholder in `ILLUSTRATIONS` replaced with new animated versions (twinkling starfield dots, dashed construction rings, sweeping connectors, pulsing cores, SMIL `animate` opacity/`r` tweens with staggered `begin` offsets). Keys and usage site unchanged - `openFullArchModal()` still injects `ILLUSTRATIONS[illKey]` with `unknown` fallback. Art pasted verbatim from the user's `MBTI_SVG.txt` with commas normalized so the map stays order-independent.

- **3.5.0** - Axis Key in the stats modal. A static reference card added as the last section, always rendered (even in the empty state): each row shows the axis initials in its signature color, the two MBTI letters it spans (I/E, T/F, S/N, J/P), the full pole names (matching `AXIS_LETTERS`), and a one-line plain-language explanation of what the axis measures. Copy approved as-is per the user (with "Intuitive" written normally, not "iNtuitive").

- **3.4.9** - Stats modal + radar modal slim-down. The **Axis Journey** micro-block moved out of the radar modal (`buildRadarFooter()` now only returns the "N observed turns" line, so the radar window keeps just the radar + the 2×2 stat cards and its scrollbar/clutter pressure drops) into a new **Stats modal** wired to the previously dead `#stats-btn`. The modal mirrors the radar modal's chrome (archetype code + colored name header, × / overlay-click close) and adds a **Score Trajectory** chart — a per-axis line chart of cumulative scores across observed turns. Fixed ±18 domain (every write path clamps via `applyTagsTo`, so lines always fit), zero line at true center, guide at ±9, per-axis pos-color polylines, first/last turn captions, dots with hover tooltips when ≤40 turns, flip ticks marking zero-crossings between consecutive turns, and a gold ring on the single biggest single-turn delta (reuses `entryDelta`). Empty state shown when no trail yet. `.stats-*` CSS mirrors the radar modal's design language; the scrollable `.stats-body` avoids a whole-modal scrollbar.

- **3.4.8** - Latest-analysis button styling. `#reanalyze-btn` now carries the `header-action-btn` class so it shares the panel's unified gold-tinted bordered look (24px, border `rgba(212,175,55,0.2)`, bg `rgba(212,175,55,0.05)`, hover brightens) instead of a bare dimmed icon; its standalone opacity rules were removed. No behavior change.

- **3.4.7** - Header refinement (v3.4.6 follow-up). The action cluster moved back out of the radar into the restored `.profile-header`: `#mbti-code` sits left at a modest **13px bold gold** (Cinzel, letter-spacing 4px — one step up from the original 12px, styled to read as a subtitle rather than compete with the 16px archetype name), and the `#header-actions` group (`#magnify-btn` wiki · `#radar-zoom-btn` magnifier · `#stats-btn` placeholder) sits right, styled identically to the `.history-btn`/`.rescan-btn` (24px, gold-tinted bordered squares) so every panel button shares one visual language. The `#octagon-tools` corner overlay and hero-sized `#mbti-code` block are gone — the radar keeps its clean artwork and the panel regains vertical space. ESFJ order is `eyebrow → archetype-name → archetype-desc`; drag remains bound to `.profile-shell` with the `button/input/a` guard.

- **3.4.6** - Panel restructure. Header row removed: the `MBTI` code moved out of the header to sit as a bold gold hero element between the archetype name and its motto; `#history-btn` and `#rescan-btn` moved into a new centered `#mbti-actions` menu row between the reasoning display and the footer status bar (IDs unchanged, so the existing handlers survive). The octagon's top-right corner is now a mini-menu (`#octagon-tools`): `#magnify-btn` (relabelled "MBTI Type Encyclopedia", book icon, bordered like the radar-zoom button) sits left of `#radar-zoom-btn` (icon swapped to a magnifier) with a `#stats-btn` placeholder to its right. `#reanalyze-btn` uses a single repeat-arrow icon instead of the circled-play to stop it being confused with the re-scan button. Panel dragging now binds to the whole `.profile-shell` (guards ignore `button/input/a`), and the re-scan popup anchors to the panel's bottom so it opens near its moved button. No handler logic changed; the wiki button still opens the existing static full-arch card (content to be revised/populated later).

- **3.4.5** - Console hygiene + terminology clarity. Removed load-time config dumps (the full `extension_settings` / `mbti_widget` objects and context/event-type probes) and per-request content dumps (full prompts and raw model responses), keeping only short diagnostics (backend, parsed-analysis count, final scores, and warnings/errors) — the API key is never logged and never lives in `extension_settings` (it's in `localStorage` as `MBTI_API_KEY_STORAGE`), mirroring how ST extensions handle connection keys. Dead code `getLastUserMessage_text()` removed. Documented the two easily-confused knobs: re-scan (`rescanMessages`) is boundless — its popup slider maxes out at the full `chat.length` and unset/`0` defaults to the whole chat — while `contextMessages` (settings drawer, 1–10) only bounds the auto-trigger's per-turn context window.

- **3.4.4** - Auto-trigger token correctness + shared failure semantics. `reAnalyzeLastTurn()` now regex-cleans both the last user message and the last AI response (`cleanMessageText()` on the message objects, same engine as the re-scan path) before sending, closing the last raw-text gap in the per-turn payload (`chat_history` was already cleaned). `queryRating()`'s transport catch now returns `error: true` consistently with parse failures, so a network/generation failure is never mistaken for a successful "no tags" analysis — before this fix such a failure deleted the message's record (empty-tags-removes path) and saved garbage to metadata. Any failed request now writes nothing and surfaces the Re-send popup. `reAnalyzeLastTurn()` remains the single shared path for the auto-trigger, the manual Re-analyze button, and the error Re-send: auto appends (always a new user message); force re-evaluates the current turn via `upsertTrailEntry`, which replaces the record in place if one exists (Regenerate) or appends if the failed run wrote nothing. `getLastUserMessage()` additionally returns `aiMsgObj` for the cleaning step.

- **3.4.3** - Branch-aware metadata pruning. ST's "branch from message N" copies chat metadata into a truncated chat file; `pruneStaleTrailEntries()` now runs on every chat load and drops any trail record whose `messageIndex` no longer maps to a real `is_user` message in the current chat (stale tail beyond the branch point, plus legacy AI-indexed rows), dedupes last-wins, and rebuilds the cumulative `scores` chain from each record's own tag contribution before persisting. Without it, a branched chat's `lastRecordIdx` (e.g. 61 from a 63-message chat) silently blocked the new-user auto-trigger until the branch outgrew that index. Normal chats are untouched (all records map cleanly → no change, no write); `loadFromChatMetadata()` became async.

- **3.4.2** - Auto-trigger only on user inputs. `reAnalyzeLastTurn()` now keys every auto-analysis record to the **user message's chat index** (via an extended `getLastUserMessage()` returning `userIdx`) instead of `chat.length - 1`, so records carry the chat-file message number and collide correctly with re-scan entries. The trigger is guarded: analysis runs on `MESSAGE_RECEIVED` only when a **new** `is_user` message exists (its index is greater than the last trail record's), so ST's Continue / regenerate / swipe — which append an AI message with no new user input — no longer fire or spam history with duplicates (the "last message is assistant yet the extension fired" case). The manual Re-analyze button and error-popup Re-send pass `force: true` to analyze the current turn regardless; the `busy` status is set only after the guard passes. Backfills: legacy records keyed to AI indexes are cleared by the next re-scan rebuild (v3.4.1 semantics).

- **3.4.1** - Re-scan correctness: (1) `getRescanOutputBudget()` now requests the **remaining context** (≥1024, ≤32,768) instead of a configured-output floor, so the re-scan genuinely asks the model for as much output as fits (retry-once at the configured `max_tokens` covers low-output-cap providers). (2) **Prompt hardening**: the re-scan system prompt now states every history line is numbered with its exact chat-file index in brackets, that `messageIndex` must copy that number verbatim, that indices are consecutive regardless of role, and that exactly one analysis is returned per `[user]` line. (3) **Index validation & snap**: after parsing, each returned `messageIndex` is validated against the actual scanned user-message indexes — exact matches are kept, `±1` off-by-one/shifted numbers are snapped (counter in the completion status), and unresolvable ones are dropped; if every analysis is unresolvable the trail is **not** wiped (popup prompts a re-send). (4) **Authoritative rebuild**: a successful re-scan now clears the trail and rebuilds it fresh from the resolved analyses (chronological `previousScores`/`scores` chain via `applyTagsTo`), so stale/duplicate records from older scans can no longer accumulate ("message 67 ×4" is gone). (5) Fixed the re-scan progress text span to carry `class="rescan-progress-text"` so the intended CSS applies.

- **3.4.0** - Token-correctness overhaul. (1) **Regex cleaning**: sent message text now runs through ST's Regex Scripts engine (`cleanMessageText()` → `applyRegexScripts()`), matching ST's main-chat/ST-Copilot behavior. Previously the raw history was shipped, over-counting input by ~40k tokens of CYOA/tracker content and inflating API billing against the "Total tokens" figure ST shows; estimates and payload now agree. Applied to both `buildRescanChatText()` (re-scan) and `getMessageContext()` (auto analysis). (2) **Budgeting**: `Context size (tokens)` defaults to 64,000 (old `0` migrates), is user-managed and never overridden by the provider's learned limit; the re-scan truncation loop now reserves output room (`input + output ≤ context`); `getRescanOutputBudget()` requests the largest output that fits so reasoning-model thinking isn't truncated, with a one-shot retry at the configured `max_tokens` if the API rejects a too-large request. (3) **Transparency**: the re-scan popup shows input/output token estimates plus the context ceiling (with the learned real limit when it differs) and previews the oldest-message omission count; new installs default to scanning the full chat including message 0.

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
      { "scores": { "ie": 1, "tf": 0, "sn": 2, "jp": 0 }, "reasoning": "...", "commenter": "...", "commenterName": "Psy Professor", "previousScores": { "ie": 0, "tf": 0, "sn": 1, "jp": 0 } }
    ],
    "mbti_last_analysis": "… (only when Analysis Active & Save off)",
    "mbti_last_analysis_name": "Analysis",
    "mbti_last_commenter": "… (only when Commenter Active & Save off)",
    "mbti_last_commenter_name": "Psy Professor"
  }
}
```

`reasoning` and `commenter` are the LLM's analysis and its configured commenter one-liner for the turn, stored only when the matching prompt is Active **and** its "Save history to chat file" toggle is on. `previousScores` is a snapshot of `scores` taken *before* that turn's tags were applied, used to render the per-axis point deltas in the panel. `commenterName` is the commenter name captured when the turn was generated, so history records keep their original author even if the commenter is renamed later. The `mbti_last_*` keys persist only the **latest** analysis/commenter text (plus names) exactly when the corresponding prompt is save-off — they let the panel survive a chat reload without a per-turn entry, and a branch prune clears them. All of `reasoning`/`commenter`/names are optional for backward compatibility: pre-v3.7.1 trails used `professor` / `professorName`, which readers (`entryCommenter()` / `entryCommenterName()`) fall back to silently, and the history modal omits any rows a record does not have.

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

The `trail` array stores the history of MBTI score changes, including the LLM's reasoning and the commenter's commentary (each present only while its prompt is Active + Save on):

```javascript
trail = [
    {
        scores: { ie: 1, tf: 0, sn: 2, jp: 0 },
        reasoning: "User's question showed analytical thinking...",
        commenter: "A chalkboard that answers questions — how adorably academic.",
        previousScores: { ie: 0, tf: 0, sn: 1, jp: 0 }
    },
    // ... more entries
];
```

Each entry is added after each message exchange (auto-trigger) or after a re-scan / manual "Re-analyze last turn", capturing how the personality profile evolves over time. `previousScores` drives the per-axis point deltas (`+N`/`-N`) shown under each meter.