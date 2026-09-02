# MBTI Widget

A SillyTavern extension that analyzes your chat messages to build and visualize your own evolving MBTI personality profile.

<img width="295" height="566" alt="Screenshot 2026-09-02 at 10-59-01 SillyTavern" src="https://github.com/user-attachments/assets/f102556a-01ff-4fb9-9502-568fb0654b18" />
<img height="587" alt="Screenshot 2026-09-02 at 10-56-54 SillyTavern" src="https://github.com/user-attachments/assets/88874478-53e6-4a02-8dcb-fde8e8a7fcc7" />
<img align="middle" width="600"  alt="Screenshot 2026-09-02 at 11-00-21 SillyTavern" src="https://github.com/user-attachments/assets/07880cee-0fcc-4e98-ad8f-cb4e63ec3ea5" />

## Features

- **Automatic Personality Analysis** - Every message you send is analyzed to update your MBTI profile
- **Visual Radar Chart** - See your personality as an octagon with 8 axes
- **Real-time Updates** - Watch your profile evolve as the conversation progresses
- **Per-Chat Profiles** - Each chat maintains its own personality profile
- **Trail History** - Track how your profile changed over time

## Installation

1. Download or clone this repository
2. Place the folder in your SillyTavern `public/scripts/extensions` directory
3. Restart SillyTavern
4. Enable the extension in Settings → Extensions

## How It Works

The extension uses AI to analyze your messages and the conversation context. It looks for personality cues across 4 MBTI axes:

| Axis | Traits |
|------|--------|
| I / E | Introverted ↔ Extroverted |
| T / F | Thinking ↔ Feeling |
| S / N | Sensing ↔ Intuitive |
| J / P | Judging ↔ Perceiving |


- Each message can contribute points to either side of each axis, building up a nuanced personality profile over time.
- Each profile is attached separately for every chat.
## Usage

- The floating panel shows your current MBTI type (e.g., "INTJ", "ENFP")
- Click the toggle in the extensions drawer to show/hide the panel
- Each chat has its own independent profile
- The panel shows your trail history - hover over dots to see what triggered changes

## Requirements

- SillyTavern
- An AI character with an API configured

## Support

For issues and feature requests: [GitHub Repository](https://github.com/Mezi99/SillyTavern-MBTI_Widget)
