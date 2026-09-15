# Auto-Trigger JSON Schema

Per-message analysis triggered automatically on each new AI reply.

---

## LLM Input (Prompt)

Sent as `prompt` via `generateRaw()`:

```json
{
  "chat_history": "User: ...\nAI: ...\nUser: ...",
  "last_user_message": "The user's most recent message",
  "last_ai_response": "The character's most recent response"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `chat_history` | string | Last N messages formatted as `Name: message` lines (N = `contextMessages` setting, default 5) |
| `last_user_message` | string | The user's most recent message text |
| `last_ai_response` | string | The AI character's most recent response text |

---

## LLM System Prompt

```
Analyze the user's last message. For each of the 4 pairs below, choose
exactly ONE tag — the one that better describes this specific action.
If the action is genuinely neutral on an axis, omit both tags from that pair.

Pair 1 - Social energy: shadow vs flame
Pair 2 - Decision method: reason vs heart
Pair 3 - Information focus: clue vs pattern
Pair 4 - Approach to uncertainty: anchor vs drift

Respond strictly ONLY with valid JSON:
{
  "tags": [ { "tag": "tag1", "intensity": "clear" } ],
  "reasoning": "Brief 1-2 sentence explanation",
  "professor": "A sarcastic one-liner analyzing this moment like a psychology professor at a whiteboard"
}

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
  "tags": [ { "tag": "shadow", "intensity": "strong" }, { "tag": "reason", "intensity": "clear" } ],
  "reasoning": "User withdrew from the confrontation and relied on logical analysis to address the problem.",
  "professor": "Classic retreat-and-rationalize. The whiteboard writes itself."
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tags` | array | Yes | 1-4 tag objects from the allowed set. One per axis pair at most. |
| `tags[].tag` | string | Yes | One of the 8 allowed tags. |
| `tags[].intensity` | string | No | One of `subtle` / `clear` / `strong` / `defining`. Missing or unknown values fall back to `clear` (weight 1.0). |
| `reasoning` | string | Yes | Brief explanation of why these tags were chosen. |
| `professor` | string | No | A short, sarcastic one-liner analysis of the moment, in the voice of a psychology professor. Displayed in its own "Psy Professor" section in the panel. |

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

The **Weighted scoring** toggle (`extension_settings.mbti_widget.weightedScoring`) scales every delta by this weight. When off, every tag applies a fixed ±1 like pre-v3.7. Because `MAX_SCORE` (18) clamps each axis via `Math.max/min`, fractional weights saturate exactly at ±MAX_SCORE.

### Validation Rules

- Minimum 1 tag, maximum 4
- One tag per axis pair at most (e.g., cannot have both `shadow` and `flame`)
- Tags must be from the allowed set (case-insensitive, trimmed); unknown tags are dropped
- `intensity` must be one of the four labels (case-insensitive); unknown/missing → `clear`
- Bare strings (`"shadow"`) are also accepted for backward compatibility — they normalize to `clear` (weight 1.0)
- Markdown fences (` ```json ... ``` `) are stripped before parsing

---

## Parsed Output (Internal)

```javascript
{
  tags: [
    { tag: "shadow", intensity: "strong", weight: 1.5 },
    { tag: "reason", intensity: "clear", weight: 1.0 }
  ],                          // Filtered, lowercase, normalized
  reasoning: "User withdrew...",   // Trimmed string
  professor: "Classic retreat..."  // Trimmed string, may be empty
}
```

---

## LLM Backend / Transport

This schema is the same regardless of which LLM backend the user selects. Only the **transport** differs:

- **Use SillyTavern current API** — sent via `generateRaw({ prompt, systemPrompt })`, which uses the connection profile currently active in SillyTavern. It is a separate, out-of-band call (the main chat generation is unaffected).
- **Custom OpenAI-compatible API** — sent as a direct `fetch()` POST to `{baseUrl}/chat/completions` with `{ model, messages: [{role:"system"},{role:"user"}], max_tokens, temperature }` and an optional `Authorization: Bearer <key>` header.

`N` (the number of recent messages injected into `chat_history`) is set by the **Context Messages** setting in the extension drawer. The automatic analysis runs after each AI reply.
