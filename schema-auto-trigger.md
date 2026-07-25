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
  "tags": ["tag1", "tag2"],
  "reasoning": "Brief 1-2 sentence explanation"
}
```

---

## LLM Expected Output

```json
{
  "tags": ["shadow", "reason"],
  "reasoning": "User withdrew from the confrontation and relied on logical analysis to address the problem."
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tags` | string[] | Yes | 1-4 tags from the allowed set. One per axis pair at most. |
| `reasoning` | string | Yes | Brief explanation of why these tags were chosen. |

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

- Minimum 1 tag, maximum 4
- One tag per axis pair at most (e.g., cannot have both `shadow` and `flame`)
- Tags must be from the allowed set (case-insensitive, trimmed)
- Markdown fences (` ```json ... ``` `) are stripped before parsing

---

## Parsed Output (Internal)

```javascript
{
  tags: ["shadow", "reason"],      // Filtered, lowercase
  reasoning: "User withdrew..."    // Trimmed string
}
```
