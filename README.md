# MBTI Widget

A SillyTavern extension that analyzes your chat messages to build and visualize your own evolving MBTI personality profile.

<div align="center">
<img height="400" alt="MBTI1" src="https://github.com/user-attachments/assets/73158aea-8654-47d2-8e8b-454bd73f5b30" />
<img height="400" alt="MBTI2" src="https://github.com/user-attachments/assets/a84efb88-3d5a-4cdc-8d45-ef16cc4418ea" />
</div>

<div align="center">
<img height="400" alt="MBTI3" src="https://github.com/user-attachments/assets/f3998dbd-d66a-4cff-a572-1eb6ee5efb78" />
<img height="400" alt="MBTI4" src="https://github.com/user-attachments/assets/613086ea-6712-417e-a2f4-805c54860ae2" />
</div>


## Features

- **Automatic analysis** — every message you send is scored and updates your profile
- **Radar chart** — your personality visualized as an octagon across 8 dimensions
- **Per-chat profiles** — each chat gets its own personality story
- **Trail history** — see how your profile evolved over time and what drove each change
- **Re-scan history** — rebuild the trail by re-analyzing past messages
- **Latest Analysis + Commenter** — a short reasoning for each turn plus a personality commentary (default: the opinionated penguin Dr. Mike Flapjack)
- **Editable prompts** — tune the analysis wording and the commenter's name and prompt

## Installation

1. Download or clone this repository
2. Place the folder in your SillyTavern `public/scripts/extensions` directory
3. Restart SillyTavern and enable the extension in Settings → Extensions

## Backend

The analysis runs as a separate background call, so your main chat stays untouched. You can power it with:

- **SillyTavern's current API** (default) — uses whatever connection profile is active
- **Any OpenAI-compatible API** — provide a Base URL, API Key, and Model, and test the connection from the panel

The key stays in your browser and is never sent to the server.

## Usage

- Floating panel shows your current type (e.g. INTJ)
- Each chat keeps its own profile
- Hover the history dots to see what changed and why
- Re-analyze the last turn or re-scan the whole history — and stop any running analysis whenever you want

## Support

For issues and feature requests: [GitHub Repository](https://github.com/Mezi99/SillyTavern-MBTI_Widget)
