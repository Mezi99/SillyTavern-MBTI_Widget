# Re-Scan JSON Schema

Batch analysis of chat history triggered manually via refresh button.

---

## LLM Input (Prompt)

Sent as `prompt` via the selected backend (`generateRaw()` for ST API, or direct `fetch()` for a custom API):

```
[0] [user] UserName: I think we should analyze the data first...
[1] [ai] Character: That's a good idea. Here's what I found...
[2] [user] UserName: Let me check the records...
[3] [ai] Character: I'll wait while you look...
```

### Format

Each line: `[index] [role] Name: message`

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

For each user message, return an analysis with the message index and
applicable tags.

Respond strictly ONLY with valid JSON:
{
  "analyses": [
    {
      "messageIndex": 0,
      "tags": ["tag1", "tag2"],
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
```

---

## LLM Expected Output

```json
{
  "analyses": [
    {
      "messageIndex": 0,
      "tags": ["reason", "anchor"],
      "reasoning": "User proposed a structured analytical approach."
    },
    {
      "messageIndex": 2,
      "tags": ["clue", "drift"],
      "reasoning": "User focused on concrete details and kept options open."
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `analyses` | array | Yes | Array of per-message analysis objects |
| `analyses[].messageIndex` | number | Yes | Index of the message in the input (0-based) |
| `analyses[].tags` | string[] | Yes | 1-4 tags from the allowed set |
| `analyses[].reasoning` | string | Yes | Brief explanation of tag choices |

### Valid Tags

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

### Validation Rules

- Each analysis must have `messageIndex`, `tags`, and `reasoning`
- Tags: minimum 1, maximum 4 per message
- One tag per axis pair at most
- Tags must be from the allowed set (case-insensitive, trimmed)
- Only user messages (marked `[user]`) should have analyses
- Markdown fences (` ```json ... ``` `) are stripped before parsing

---

## Parsed Output (Internal)

```javascript
{
  analyses: [
    {
      messageIndex: 0,
      tags: ["reason", "anchor"],
      reasoning: "User proposed a structured analytical approach."
    },
    // ... one entry per user message
  ]
}
```

---

## Score Application

Tags are applied sequentially (message 0 → message 1 → message 2...), building scores incrementally. Each entry produces a trail snapshot.

```javascript
// After processing all analyses:
trail = [
  { scores: { ie: -1, tf: -2, sn: 0, jp: -1 }, reasoning: "..." },
  { scores: { ie: -1, tf: -2, sn: 1, jp: -2 }, reasoning: "..." },
  // ... one trail entry per analyzed message
]
```

---

## LLM Backend / Transport

This schema is the same regardless of which LLM backend the user selects. Only the **transport** differs:

- **Use SillyTavern current API** — sent via `generateRaw({ prompt, systemPrompt })`, which uses the connection profile currently active in SillyTavern. It is a separate, out-of-band call (the main chat generation is unaffected).
- **Custom OpenAI-compatible API** — sent as a direct `fetch()` POST to `{baseUrl}/chat/completions` with `{ model, messages: [{role:"system"},{role:"user"}], max_tokens, temperature }` and an optional `Authorization: Bearer <key>` header.

The number of messages included in the re-scan is set via the slider in the re-scan popup (persisted per user across sessions). The manual re-scan uses the same backend as the automatic analysis. If the selected range exceeds the model's context window, messages are automatically trimmed newest-first to fit (with a warning), so older messages may be omitted.
