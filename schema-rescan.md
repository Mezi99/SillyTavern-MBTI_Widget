# Re-Scan JSON Schema

Batch analysis of chat history triggered manually via refresh button.

---

## LLM Input (Prompt)

Sent as `prompt` via the selected backend (`generateRaw()` for ST API, or direct `fetch()` for a custom API):

```
[12] [user] UserName: I think we should analyze the data first...
[13] [ai] Character: That's a good idea. Here's what I found...
[14] [user] UserName: Let me check the records...
[15] [ai] Character: I'll wait while you look...
```

### Format

Each line: `[index] [role] Name: message` — `index` is the message's **global chat index** (its position in the chat array), so re-scan records share the same `messageIndex` keys as the auto-analysis records and overwrite them instead of duplicating.

| Marker | Meaning |
|--------|---------|
| `[user]` | User message |
| `[ai]` | AI character message |

System messages (`is_system`) are **excluded** from the payload — they are not user behavior to analyze and would otherwise be mislabeled as `[ai]`.

> **Context guard:** the re-scan request is capped to fit the model's context window. Messages are packed **newest-first** up to the budget (ST API: `getMaxPromptTokens()`; custom API: the configured "Context size (tokens)" field, falling back to ST's budget when unset). If older messages are dropped, a note line is prepended and a non-blocking warning is shown in the re-scan popup.

---

## LLM System Prompt

```
Analyze the following chat history. For EACH user message (marked with
[user]), determine which MBTI tags apply based on the user's behavior
in that specific message.

For each user message, return an analysis with the message index shown
in the history and the applicable tags.

Respond strictly ONLY with valid JSON:
{
  "analyses": [
    {
      "messageIndex": 0,
      "tags": [ { "tag": "tag1", "intensity": "clear" } ],
      "reasoning": "Brief 1-2 sentence explanation"
    }
  ]
}

Tags (choose 1-4 per message):
Pair 1 - Social energy: shadow vs flame
Pair 2 - Decision method: reason vs heart
Pair 3 - Information focus: clue vs pattern
Pair 4 - Approach to uncertainty: anchor vs drift

If a message is genuinely neutral on an axis, omit both tags from that pair.

Intensity guide (choose one per tag):
- "subtle": the trait is only faintly implied by this turn
- "clear": a normal, ordinary-strength signal (default)
- "strong": the turn is clearly and directly driven by this trait
- "defining": this turn is centrally, unmistakably about this trait
```

---

## LLM Expected Output

```json
{
  "analyses": [
    {
      "messageIndex": 0,
      "tags": [ { "tag": "reason", "intensity": "clear" }, { "tag": "anchor", "intensity": "strong" } ],
      "reasoning": "User proposed a structured analytical approach."
    },
    {
      "messageIndex": 2,
      "tags": [ { "tag": "clue", "intensity": "subtle" }, { "tag": "drift", "intensity": "clear" } ],
      "reasoning": "User focused on concrete details and kept options open."
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `analyses` | array | Yes | Array of per-message analysis objects |
| `analyses[].messageIndex` | number | Yes | Global chat message index (as numbered by the `[index]` markers in the provided history) — matches the auto-analysis records so re-scan overwrites them |
| `analyses[].tags` | array | Yes | 1-4 tag objects from the allowed set |
| `analyses[].tags[].tag` | string | Yes | One of the 8 allowed tags |
| `analyses[].tags[].intensity` | string | No | One of `subtle` / `clear` / `strong` / `defining`. Missing or unknown → `clear` (weight 1.0) |
| `analyses[].reasoning` | string | Yes | Brief explanation of tag choices |

### Valid Tags & Intensity Weights

| Tag | Axis | Direction | Meaning |
|-----|------|-----------|---------|
| `shadow` | I/E | I (negative) | Withdrew, avoided, observed from distance |
| `flame` | I/E | E (positive) | Engaged, confronted, inserted themselves |
| `reason` | T/F | T (negative) | Used logic, evidence, analysis |
| `heart` | T/F | F (positive) | Used emotion, empathy, gut feeling |
| `clue` | S/N | S (negative) | Focused on concrete physical details |
| `pattern` | S/N | N (positive) | Made a connection, inference, or intuitive leap |
| `anchor` | J/P | J (negative) | Committed to a position or plan |
| `drift` | J/P | P (positive) | Kept options open, adapted, stayed flexible |

| Intensity | Delta weight | Meaning |
|-----------|--------------|---------|
| `subtle` | 0.5 | Trait only faintly implied |
| `clear` | 1.0 | Normal-strength signal (default) |
| `strong` | 1.5 | Turn clearly driven by the trait |
| `defining` | 2.0 | Turn centrally about the trait |

The **Weighted scoring** toggle (`extension_settings.mbti_widget.weightedScoring`) scales every delta by this weight; off = fixed ±1 like pre-v3.7. `MAX_SCORE` (18) clamps each axis via `Math.max/min`, so fractional weights saturate exactly at ±MAX_SCORE.

### Validation Rules

- Each analysis must have `messageIndex`, `tags`, and `reasoning`
- Tags: minimum 1, maximum 4 per message
- One tag per axis pair at most
- Tags must be from the allowed set (case-insensitive, trimmed); unknown tags are dropped; an analysis whose tags all normalize to invalid is dropped with it
- `intensity` must be one of the four labels (case-insensitive); unknown/missing → `clear`
- Bare strings (`"shadow"`) are also accepted for backward compatibility — they normalize to `clear` (weight 1.0)
- Only user messages (marked `[user]`) should have analyses
- Markdown fences (` ```json ... ``` `) are stripped before parsing

---

## Parsed Output (Internal)

```javascript
{
  analyses: [
    {
      messageIndex: 0,
      tags: [
        { tag: "reason", intensity: "clear", weight: 1.0 },
        { tag: "anchor", intensity: "strong", weight: 1.5 }
      ],
      reasoning: "User proposed a structured analytical approach."
    },
    // ... one entry per user message
  ]
}
```

---

## Score Application

Tag objects are applied sequentially (message 0 → message 1 → message 2...), building scores incrementally. Each tag moves its axis by `weight` (scaled by the `weightedScoring` toggle) toward ±MAX_SCORE via clamping. Each entry produces a trail snapshot, including the normalized `appliedTags` that produced it.

```javascript
// After processing all analyses:
trail = [
  { scores: { ie: -1, tf: -2, sn: 0, jp: -1 }, previousScores: { ie: 0, tf: 0, sn: 0, jp: 0 }, appliedTags: [{ tag: "reason", intensity: "clear" }, { tag: "anchor", intensity: "strong" }], reasoning: "..." },
  { scores: { ie: -1, tf: -2, sn: 1, jp: -2 }, previousScores: { ie: -1, tf: -2, sn: 0, jp: -1 }, appliedTags: [{ tag: "pattern", intensity: "clear" }, { tag: "drift", intensity: "clear" }], reasoning: "..." },
  // ... one trail entry per analyzed message
]
```

---

## LLM Backend / Transport

This schema is the same regardless of which LLM backend the user selects. Only the **transport** differs:

- **Use SillyTavern current API** — sent via `generateRaw({ prompt, systemPrompt })`, which uses the connection profile currently active in SillyTavern. It is a separate, out-of-band call (the main chat generation is unaffected).
- **Custom OpenAI-compatible API** — sent as a direct `fetch()` POST to `{baseUrl}/chat/completions` with `{ model, messages: [{role:"system"},{role:"user"}], max_tokens, temperature }` and an optional `Authorization: Bearer <key>` header.

The number of messages included in the re-scan is set via the slider in the re-scan popup (persisted per user across sessions). The manual re-scan uses the same backend as the automatic analysis. If the selected range exceeds the model's context window, messages are automatically trimmed newest-first to fit (with a warning), so older messages may be omitted.
