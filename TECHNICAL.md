# MBTI Widget - Technical Documentation

## Overview

MBTI Widget is a SillyTavern extension that analyzes user chat messages to build an evolving MBTI personality profile. It sends the user's message + recent context to the LLM via `generateRaw`, receives MBTI-relevant tags, and visualizes the resulting personality in a floating panel with an octagon radar chart.

---

## Architecture

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
queryRating()          → Call generateRaw with prompt + systemPrompt
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
            systemPrompt: RATING_PROMPT,
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

#### `RATING_PROMPT` (line 48-63)
System prompt sent to LLM instructing it to return MBTI tags:

```javascript
const RATING_PROMPT = `You are analyzing a character's recent action for MBTI personality profiling.
Evaluate the character's behavior along 4 axes (8 tags total). Respond with ONLY a JSON object:
{"tags": ["tag1", "tag2", ...]} - choose 1-3 tags that best describe the character's recent action.

Tags and their meanings:
- shadow: Introverted, reflective, guarded response
- flame: Extroverted, energetic, bold response
- reason: Logical, analytical, detached decision-making
- heart: Emotional, empathetic, values-driven decision-making
- clue: Concrete, practical, focus on real-world facts
- pattern: Intuitive, theoretical, focus on possibilities
- anchor: Structured, planned, decisive approach
- drift: Flexible, spontaneous, adaptable approach

Analyze the character's last message considering the recent conversation context.
Respond with JSON only, no explanation.`;
```

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

### How Events Work (EchoText Pattern)

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

**Correct (EchoText pattern):**
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

## References

- **EchoText** - Reference extension: `D:\OpenCodeProjects\SillyTavern-EchoText`
- **st-context-emotion.js** - EchoText's MESSAGE_RECEIVED handler pattern
- **SillyTavern Context** - Use `SillyTavern.getContext()` for direct access

---

## Version History

- **0.1.0** - Initial release with LLM-based MBTI tag analysis