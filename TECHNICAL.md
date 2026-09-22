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

Changelog: see [VersionHistory.md](VersionHistory.md).

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