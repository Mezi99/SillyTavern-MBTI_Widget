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
  - If the endpoint rejects `max_tokens` as too large for the model, it retries once with the configured value. Context-limit errors ("Max context tokens: N", etc.) are parsed by `learnContextLimitFromError()` and stored in `customApi.learnedContextLength` (informational only — never overrides the user's setting).

Supporting helpers: `isCustomBackend()`, `getCustomApiSettings()`, `fetchModels()` (`GET {baseUrl}/models`), `testCustomConnection()`, `extractOpenAIContent()`.

The custom API key is stored in `localStorage` under `mbti_widget_api_key` (never in `extension_settings`, so it is not synced to the server or written to chat metadata). All other backend settings live in `extension_settings.mbti_widget.{backend, customApi}`.

### Context budget / overflow guard (re-scan)

The re-scan request can include a large slice of the chat, so it is guarded against exceeding the model's context window. The effective budget comes from `getContextBudget()`:

- **`st` backend**: reads `getMaxPromptTokens()` from SillyTavern's `script.js` via a **guarded dynamic `import()`** (tries the documented third-party mount depth `../../../../script.js`, then `../../../script.js` as a fallback, aligning with the repo's "no ES6 static imports" design). This is the same authoritative per-model budget SillyTavern itself uses (context minus reserved response). Never hardcoded.
- **`custom` backend**: uses `customApi.contextLength`. This is **user-managed**, defaults to **64,000** (migrates the old `0` default), and is auto-filled from the provider's `/models` metadata via `extractModelContextLength()`. The provider-reported real limit learned from errors (`customApi.learnedContextLength`) is **informational only** — the user's value always wins for budgeting — and is surfaced in the re-scan popup when it differs.

If the `script.js` dynamic import is unavailable (path/export differences across ST versions), `getContextBudget()` falls back to reading `context.chatCompletionSettings.openai_max_context` (OpenAI) or `context.maxContext` (local/text-generation backends), and finally `0` (no cap). Because the import is dynamic and wrapped in try/catch, a failure can never prevent the extension from loading.

Message packing is **newest-first greedy**: `reScanHistory()` adds the newest messages until the estimated prompt **plus the requested output** would exceed the budget (`input + output ≤ context`), which reserves room for the analysis reply. `countRescanTokens()` uses `context.getTokenCountAsync()` (SillyTavern's tokenizer) with a `chars/4` heuristic fallback. If older messages are dropped, a note line is prepended to the prompt and a non-blocking warning is shown in the re-scan popup (which also previews the fit count live via `countFittingMessages()`). The auto-trigger (`reAnalyzeLastTurn()`) is **not** token-capped — it only rates the newest user input with a bounded `contextMessages` window. It fires on `MESSAGE_RECEIVED` **only when a genuinely new user message arrived**: the latest `is_user` chat index must be greater than the last trail record's `messageIndex`. ST's **Continue**, regenerate, and swipe append an AI message with no new user input, so they never fire; consecutive-AI chats are handled because the check is purely index-based (record indices are the user messages' chat-file numbers, matching the re-scan). The manual **Re-analyze** button and the error popup's **Re-send** pass `force: true` to analyze the current turn regardless.

**Two related knobs — don't confuse them:** (1) **Re-scan** (`#rescan-slider` → `rescanMessages`): *boundless*. On popup open, `slider.max` is set to the full `chat.length` (`updateRescanSlider()`), and an unset or `0` value defaults the slider to the **whole chat including message 0** (`openRescanPopup()`) — so a re-scan can cover any number of messages up to the entire history, then context-trims newest-first to fit. The `min="5" max="10"` in the popup HTML is only the initial geometry before it is rescaled. (2) **Auto-trigger context** (`extension_settings.mbti_widget.contextMessages`, the settings-drawer slider `#mbti_context_messages`, min 1 max 10, default 5): the number of recent messages included in the `chat_history` block when analyzing the *last* turn. One changes/rebuilds recorded analyses; the other only controls the per-turn rating context.

**Regex cleaning (foundational):** SillyTavern's main prompt path and ST-Copilot run ST's **Regex Scripts** engine over message content (stripping CYOA option markers, tracker dumps, etc.) before it reaches the model. This extension sends message text directly, so it mirrors that behavior: `cleanMessageText()` applies the active regex engine via a guarded dynamic `import('/scripts/extensions/regex/engine.js')` (placements `USER_INPUT` for user messages, `AI_OUTPUT` otherwise; `depth` = messages-from-the-end), cached per message. Both `buildRescanChatText()` and `getMessageContext()` run cleaned text, so the model sees the clean story **and** the token estimate matches the payload that is actually sent (previously the raw history over-counted by ~40k tokens of regex-strippable content).

**Re-scan output scaling:** The re-scan prompt asks the model to return one analysis entry per user message (tags + reasoning), so output grows with user message count. `getRescanOutputBudget(userMessageCount, inputEstimate, contextBudget)` requests the **remaining context** (`context − inputEstimate`, floored at 1024, capped at 32,768 tokens) — the largest output that still fits — so reasoning-model "thinking" is never truncated; when the context window is unknown it falls back to `max(configured maxTokens, userMessageCount × 160)` capped at 32,768. `generateWithCustomOpenAI()` retries once at the configured `max_tokens` if the provider rejects a too-large request, so low-output-cap models still work. If the custom API still returns empty content despite the scaling, the error includes `finish_reason` and response structure details for diagnosis.

### Message role handling

Both `getMessageContext()` (auto-trigger) and `reScanHistory()` (re-scan) **skip `is_system` messages** (they aren't user behavior and would be mislabeled) and run each message's text through the regex engine via `cleanMessageText()`. Messages are labeled `[user]` / `[ai]` inline (with the speaker's name) rather than relying on native role arrays, so a one-shot re-scan can ask the model to return the `messageIndex` of each analyzed message.

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
        return { tags: [], reasoning: '', professor: '', error: true };
    }
}
```

**Prompt payload:** `chat_history` comes from `getMessageContext()` (each message regex-cleaned), and `last_user_message` / `last_ai_response` are cleaned via `cleanMessageText()` on the message objects before this call — so the whole on-the-wire payload is stripped (grading markers, CYOA syntax, trailing whitespace) exactly like the re-scan path. `cleanMessageText` never throws; a regex-engine import failure falls back to raw text.

**Failure semantics:** both a parse failure (`parseRatingResponse` → `error: true`) and a transport/generation exception now return `error: true`. `reAnalyzeLastTurn()` treats either as "no write": it shows the error plus a Re-send popup and never calls `upsertTrailEntry`/`saveToChatMetadata`, so failed requests cannot remove or append garbage in the metadata. A successful response (`error: false`, guaranteed 1–4 valid tags) is the only path that records — replacement or append, per `upsertTrailEntry`.

**Note:** Uses the same `generateMBTI()` backend abstraction as the rest of the extension.

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

#### `loadFromChatMetadata()` (line 829)
Loads scores when a chat opens, then prunes stale records for branched/shortened chats.

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
    if (pruneStaleTrailEntries()) {   // branched/shortened chat?
        await saveToChatMetadata();    // persist the pruned state
        updatePanel();
    }
}
```

**Branch handling:** ST's "branch from message N" copies the chat metadata but truncates the chat file. `pruneStaleTrailEntries()` (called on every chat load) keeps only trail records whose `messageIndex` still maps to a real `is_user` message in the current chat, dedupes last-wins, and rebuilds the cumulative chain from each record's own tag contribution (`scores − previousScores`). Stale tail records (referencing messages that no longer exist) and legacy AI-indexed rows are dropped, so the auto-trigger guard (`userIdx <= lastRecordIdx`) can fire again on the branched chat's next user message and the history modal only shows the valid prefix.

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