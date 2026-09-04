(function () {
    'use strict';

    const MODULE_NAME = 'MBTI_Widget';

    let extension_settings, saveSettingsDebounced;

    let scores = { ie: 0, tf: 0, sn: 0, jp: 0 };
    let trail = [];
    let isProcessing = false;
    let panelCreated = false;
    let isPanelOpen = false;

    const MAX_SCORE = 18;

    // Shared axis metadata: icon mask image, sign colors, and the tag names
    // each sign maps to (used by the main meters, history modal rows, totals
    // and legend). Mirrors the icons/colors in the panel axis bars.
    const AXIS_META = [
        { axis: 'ie', icon: 'https://img.icons8.com/ios-filled/50/ffffff/fire-element.png', pos: '#f97316', neg: '#94a3b8', posTag: 'flame', negTag: 'shadow' },
        { axis: 'tf', icon: 'https://img.icons8.com/ios-filled/50/ffffff/like--v1.png', pos: '#f472b6', neg: '#60a5fa', posTag: 'heart', negTag: 'reason' },
        { axis: 'sn', icon: 'https://img.icons8.com/ios-filled/50/ffffff/idea.png', pos: '#a78bfa', neg: '#34d399', posTag: 'pattern', negTag: 'clue' },
        { axis: 'jp', icon: 'https://img.icons8.com/ios-filled/50/ffffff/wind.png', pos: '#94a3b8', neg: '#fbbf24', posTag: 'drift', negTag: 'anchor' },
    ];

    const ILLUSTRATIONS = {
        unknown: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#020508"/><circle cx="290" cy="100" r="120" fill="none" stroke="rgba(212,175,55,0.06)" stroke-width="1"/><circle cx="290" cy="100" r="80" fill="none" stroke="rgba(212,175,55,0.08)" stroke-width="1"/><circle cx="290" cy="100" r="40" fill="none" stroke="rgba(212,175,55,0.12)" stroke-width="1"/><text x="290" y="115" text-anchor="middle" font-family="Cinzel,serif" font-size="56" font-weight="700" fill="rgba(212,175,55,0.08)" letter-spacing="8">????</text></svg>`,
        architect: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#020a18"/><g stroke="rgba(96,165,250,0.12)" stroke-width="0.75" fill="none"><line x1="0" y1="40" x2="580" y2="40"/><line x1="0" y1="80" x2="580" y2="80"/><line x1="0" y1="120" x2="580" y2="120"/><line x1="0" y1="160" x2="580" y2="160"/></g><polygon points="290,30 420,160 160,160" fill="none" stroke="rgba(96,165,250,0.3)" stroke-width="1.5"/><circle cx="290" cy="100" r="4" fill="rgba(96,165,250,0.8)"/></svg>`,
        witness: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#060310"/><ellipse cx="290" cy="100" rx="160" ry="80" fill="none" stroke="rgba(167,139,250,0.1)" stroke-width="1"/><ellipse cx="290" cy="100" rx="100" ry="50" fill="none" stroke="rgba(167,139,250,0.12)" stroke-width="1"/><ellipse cx="290" cy="100" rx="40" ry="20" fill="rgba(167,139,250,0.06)" stroke="rgba(167,139,250,0.2)" stroke-width="1"/><ellipse cx="290" cy="100" rx="8" ry="8" fill="rgba(167,139,250,0.6)"/></svg>`,
        examiner: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#021008"/><rect x="100" y="50" width="380" height="100" fill="none" stroke="rgba(52,211,153,0.15)" stroke-width="1"/><line x1="100" y1="100" x2="480" y2="100" stroke="rgba(52,211,153,0.2)" stroke-width="1"/><circle cx="290" cy="100" r="10" fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.5)" stroke-width="1"/></svg>`,
        keeper: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><path d="M290,50 C260,50 230,70 230,100 C230,130 260,160 290,170 C320,160 350,130 350,100 C350,70 320,50 290,50 Z" fill="rgba(244,114,182,0.06)" stroke="rgba(244,114,182,0.25)" stroke-width="1.5"/><circle cx="290" cy="100" r="8" fill="rgba(244,114,182,0.5)"/></svg>`,
        theorist: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#040210"/><g fill="none" stroke="rgba(167,139,250,0.2)" stroke-width="1"><circle cx="200" cy="100" r="30"/><circle cx="290" cy="70" r="30"/><circle cx="380" cy="100" r="30"/><circle cx="290" cy="130" r="30"/></g><circle cx="290" cy="100" r="6" fill="rgba(167,139,250,0.3)" stroke="rgba(167,139,250,0.4)" stroke-width="1"/></svg>`,
        dreamer: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#06020e"/><path d="M100,150 Q200,20 290,100 Q380,180 480,50" fill="none" stroke="rgba(244,114,182,0.2)" stroke-width="1.5"/><circle cx="290" cy="100" r="3" fill="rgba(244,114,182,0.8)"/></svg>`,
        operator: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#021008"/><rect x="240" y="60" width="100" height="80" fill="none" stroke="rgba(52,211,153,0.3)" stroke-width="1.5"/><line x1="80" y1="100" x2="240" y2="100" stroke="rgba(52,211,153,0.2)" stroke-width="1"/><circle cx="290" cy="100" r="5" fill="rgba(52,211,153,0.7)"/></svg>`,
        empath: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><path d="M290,60 C275,45 250,45 250,65 C250,85 290,110 290,110 C290,110 330,85 330,65 C330,45 305,45 290,60Z" fill="rgba(244,114,182,0.2)" stroke="rgba(244,114,182,0.4)" stroke-width="1.5"/></svg>`,
        conductor: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0d0500"/><g stroke="rgba(249,115,22,0.15)" stroke-width="1" fill="none"><line x1="290" y1="20" x2="100" y2="160"/><line x1="290" y1="20" x2="290" y2="180"/><line x1="290" y1="20" x2="480" y2="160"/></g><circle cx="290" cy="20" r="5" fill="rgba(249,115,22,0.8)"/></svg>`,
        anchor: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><circle cx="290" cy="80" r="30" fill="none" stroke="rgba(244,114,182,0.2)" stroke-width="1.5"/><circle cx="290" cy="80" r="8" fill="rgba(244,114,182,0.3)"/><line x1="290" y1="110" x2="290" y2="160" stroke="rgba(244,114,182,0.25)" stroke-width="2"/></svg>`,
        commander: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0a0800"/><rect x="140" y="50" width="300" height="100" fill="none" stroke="rgba(251,191,36,0.2)" stroke-width="2"/><rect x="140" y="50" width="300" height="18" fill="rgba(251,191,36,0.08)"/><circle cx="290" cy="59" r="3" fill="rgba(251,191,36,0.6)"/></svg>`,
        caretaker: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#020e06"/><g fill="none" stroke="rgba(52,211,153,0.15)" stroke-width="1"><circle cx="200" cy="100" r="25"/><circle cx="290" cy="80" r="25"/><circle cx="380" cy="100" r="25"/></g><path d="M175,100 Q245,60 290,80 Q335,100 405,100" fill="none" stroke="rgba(52,211,153,0.2)" stroke-width="1"/></svg>`,
        provocateur: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#040210"/><line x1="290" y1="100" x2="120" y2="60" stroke="rgba(167,139,250,0.25)" stroke-width="1.5"/><line x1="290" y1="100" x2="460" y2="60" stroke="rgba(167,139,250,0.25)" stroke-width="1.5"/><circle cx="290" cy="100" r="8" fill="rgba(167,139,250,0.5)"/></svg>`,
        catalyst: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><path d="M290,100 L310,50 L330,100 L290,80 L350,80 Z" fill="rgba(244,114,182,0.15)" stroke="rgba(244,114,182,0.4)" stroke-width="1.5"/><circle cx="290" cy="100" r="50" fill="none" stroke="rgba(167,139,250,0.06)" stroke-width="1"/></svg>`,
        livewire: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0d0500"/><path d="M80,100 L160,40 L200,100 L260,30 L290,100 L340,50 L380,120 L430,60 L500,100" fill="none" stroke="rgba(249,115,22,0.4)" stroke-width="2"/><circle cx="290" cy="100" r="5" fill="rgba(249,115,22,0.8)"/></svg>`,
        storm: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0d0500"/><circle cx="290" cy="100" r="90" fill="none" stroke="rgba(249,115,22,0.06)" stroke-width="1"/><circle cx="290" cy="100" r="60" fill="none" stroke="rgba(244,114,182,0.08)" stroke-width="1"/><circle cx="290" cy="100" r="30" fill="rgba(249,115,22,0.04)" stroke="rgba(249,115,22,0.15)" stroke-width="1"/><circle cx="290" cy="100" r="6" fill="rgba(249,115,22,0.7)"/></svg>`
    };

    const VERTICES = [
        { x: 110, y: 18 },
        { x: 190, y: 43 },
        { x: 202, y: 110 },
        { x: 190, y: 177 },
        { x: 110, y: 202 },
        { x: 30, y: 177 },
        { x: 18, y: 110 },
        { x: 30, y: 43 },
    ];
    const CENTER = { x: 110, y: 110 };

    const ARCHETYPES = {
        unknown: { mbti: '????', name: 'THE UNKNOWN', tagline: 'Start chatting to build your MBTI profile...', color: '#d4af37', traits: [], illustration: 'unknown', bullets: [], asset: '', risk: '', famous: [] },
        INTJ: { mbti: 'INTJ', name: 'THE ARCHITECT', tagline: 'You see the structure beneath the chaos.', color: '#60a5fa', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'architect', bullets: ["You see patterns others miss.", "You trust your analysis over opinions."], asset: "Strategic thinking", risk: "Overthinking", famous: ['Hannibal Lecter', 'Clarice Starling'] },
        INFJ: { mbti: 'INFJ', name: 'THE WITNESS', tagline: 'You absorb everything and say little.', color: '#a78bfa', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'witness', bullets: ["You see beneath the surface.", "People trust your quiet wisdom."], asset: "Deep understanding", risk: "Withdrawal", famous: ['Atticus Finch'] },
        ISTJ: { mbti: 'ISTJ', name: 'THE EXAMINER', tagline: 'You deal in facts.', color: '#34d399', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Concrete', color: '#34d399' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'examiner', bullets: ["You trust evidence over assumptions.", "You build reliable systems."], asset: "Reliability", risk: "Inflexibility", famous: ['Sherlock Holmes'] },
        ISFJ: { mbti: 'ISFJ', name: 'THE KEEPER', tagline: 'You protect the people around you.', color: '#f472b6', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Concrete', color: '#34d399' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'keeper', bullets: ["You notice what people need.", "You quietly support others."], asset: "Loyal support", risk: "Self-sacrifice", famous: ['Samwise Gamgee'] },
        INTP: { mbti: 'INTP', name: 'THE THEORIST', tagline: "You build models in your mind.", color: '#a78bfa', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'theorist', bullets: ["You question everything.", "You seek understanding, not answers."], asset: "Analytical thinking", risk: "Indecision", famous: ['Adrian Monk'] },
        INFP: { mbti: 'INFP', name: 'THE DREAMER', tagline: "You're looking for deeper meaning.", color: '#f472b6', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'dreamer', bullets: ["You see the story behind events.", "You care about authentic expression."], asset: "Creativity", risk: "Idealism", famous: ['Frodo Baggins'] },
        ISTP: { mbti: 'ISTP', name: 'THE OPERATOR', tagline: 'You handle what\'s in front of you.', color: '#34d399', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Concrete', color: '#34d399' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'operator', bullets: ["You act rather than analyze.", "You trust your hands more than words."], asset: "Practical action", risk: "Impulsiveness", famous: ['James Bond'] },
        ISFP: { mbti: 'ISFP', name: 'THE EMPATH', tagline: 'You feel things deeply.', color: '#f472b6', traits: [{ label: 'Introverted', color: '#94a3b8' }, { label: 'Concrete', color: '#34d399' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'empath', bullets: ["You respond authentically.", "You feel the room's energy."], asset: "Authenticity", risk: "Overwhelm", famous: ['Offred'] },
        ENTJ: { mbti: 'ENTJ', name: 'THE CONDUCTOR', tagline: 'Someone has to take charge.', color: '#f97316', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'conductor', bullets: ["You organize chaos.", "You drive toward goals."], asset: "Leadership", risk: "Domination", famous: ['Frank Underwood'] },
        ENFJ: { mbti: 'ENFJ', name: 'THE ANCHOR', tagline: 'You hold people together.', color: '#f472b6', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'anchor', bullets: ["You bring out the best in others.", "You read people intuitively."], asset: "Inspiration", risk: "People-pleasing", famous: ['Coach Taylor'] },
        ESTJ: { mbti: 'ESTJ', name: 'THE COMMANDER', tagline: 'Order creates safety.', color: '#fbbf24', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Concrete', color: '#34d399' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'commander', bullets: ["You impose structure.", "You believe in systems."], asset: "Organization", risk: "Rigidity", famous: ['Inspector Javert'] },
        ESFJ: { mbti: 'ESFJ', name: 'THE CARETAKER', tagline: 'You keep things running.', color: '#34d399', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Concrete', color: '#34d399' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Decisive', color: '#fbbf24' }], illustration: 'caretaker', bullets: ["You notice who needs what.", "You maintain social harmony."], asset: "Community", risk: "Neglecting self", famous: ['Molly Weasley'] },
        ENTP: { mbti: 'ENTP', name: 'THE PROVOCATEUR', tagline: 'You test people\'s ideas.', color: '#a78bfa', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'provocateur', bullets: ["You debate for discovery.", "You spot weaknesses in arguments."], asset: "Innovation", risk: "Argumentative", famous: ['Sherlock Holmes'] },
        ENFP: { mbti: 'ENFP', name: 'THE CATALYST', tagline: 'You bring energy everywhere.', color: '#f472b6', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Intuitive', color: '#a78bfa' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'catalyst', bullets: ["You connect ideas others miss.", "You inspire possibility."], asset: "Enthusiasm", risk: "Distraction", famous: ['Veronica Mars'] },
        ESTP: { mbti: 'ESTP', name: 'THE LIVE WIRE', tagline: 'You act in the moment.', color: '#f97316', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Concrete', color: '#34d399' }, { label: 'Logical', color: '#60a5fa' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'livewire', bullets: ["You thrive on action.", "You read the room and adapt."], asset: "Adaptability", risk: "Recklessness", famous: ['Tony Stark'] },
        ESFP: { mbti: 'ESFP', name: 'THE STORM', tagline: 'You feel everything fully.', color: '#f97316', traits: [{ label: 'Extroverted', color: '#f97316' }, { label: 'Concrete', color: '#34d399' }, { label: 'Empathic', color: '#f472b6' }, { label: 'Flexible', color: '#94a3b8' }], illustration: 'storm', bullets: ["You're fully present.", "You bring life to any room."], asset: "Authentic energy", risk: "Overwhelm", famous: ['Every final girl'] }
    };

    const RATING_PROMPT = `Analyze the user's last message. For each of the 4 pairs below, choose exactly ONE tag — the one that better describes this specific action. If the action is genuinely neutral on an axis, omit both tags from that pair.

Pair 1 - Social energy: shadow (withdrew, avoided, observed from distance) vs flame (engaged, confronted, inserted themselves)
Pair 2 - Decision method: reason (used logic, evidence, analysis) vs heart (used emotion, empathy, gut feeling)
Pair 3 - Information focus: clue (focused on concrete physical details) vs pattern (made a connection, inference, or intuitive leap)
Pair 4 - Approach to uncertainty: anchor (committed to a position or plan) vs drift (kept options open, adapted, stayed flexible)

Respond strictly ONLY with valid JSON:
{
 "tags": ["tag1", "tag2"],  // Minimum 1 tag, maximum 4 (one per pair).
"reasoning": "Brief 1-2 sentence explanation",
"professor": "A sarcastic one-liner analyzing this moment like a psychology professor at a whiteboard. Be witty and punchy, keep it short."
}`;

    const RESCAN_PROMPT = `Analyze the following chat history. For EACH user message (marked with [user]), determine which MBTI tags apply based on the user's behavior in that specific message.

For each user message, return an analysis with the message index and applicable tags.

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
Pair 1 - Social energy: shadow (withdrew, avoided, observed from distance) vs flame (engaged, confronted, inserted themselves)
Pair 2 - Decision method: reason (used logic, evidence, analysis) vs heart (used emotion, empathy, gut feeling)
Pair 3 - Information focus: clue (focused on concrete physical details) vs pattern (made a connection, inference, or intuitive leap)
Pair 4 - Approach to uncertainty: anchor (committed to a position or plan) vs drift (kept options open, adapted, stayed flexible)

If a message is genuinely neutral on an axis, omit both tags from that pair.`;

    function getMessageContext(count) {
        const context = SillyTavern.getContext();
        if (!context.chat) return '';
        const chat = context.chat;  // chat IS the array (not chat.messages)
        const recent = chat.slice(-count).filter(m => !m.is_system);
        return recent.map(m => `${m.is_user ? '[user]' : '[ai]'} ${m.name}: ${m.mes}`).join('\n');  // .mes, not .msg
    }

function getLastUserMessage() {
        const context = SillyTavern.getContext();
        if (!context.chat) return { userMessage: null, aiResponse: null };
        const chat = context.chat;
        const len = chat.length;
        if (len === 0) return { userMessage: null, aiResponse: null };
        
        // Find last user message and last AI response (most recent messages at end)
        let userMessage = null;
        let aiResponse = null;
        
        for (let i = len - 1; i >= 0; i--) {
            if (!userMessage && chat[i].is_user) {
                userMessage = chat[i].mes;
            } else if (!aiResponse && !chat[i].is_user) {
                aiResponse = chat[i].mes;
            }
            if (userMessage && aiResponse) break;
        }
        
        return { userMessage, aiResponse };
    }
    
    function getLastUserMessage_text() {
        const { userMessage } = getLastUserMessage();
        return userMessage;
    }

    /* ============================================
       LLM Backend abstraction (ST API or custom)
       ============================================ */

    const MBTI_API_KEY_STORAGE = 'mbti_widget_api_key';

    function getCustomApiSettings() {
        const cfg = extension_settings?.mbti_widget?.customApi || {};
        const apiKey = localStorage.getItem(MBTI_API_KEY_STORAGE) || '';
        return {
            baseUrl: cfg.baseUrl || '',
            model: cfg.model || '',
            maxTokens: cfg.maxTokens ?? 8192,
            temperature: cfg.temperature ?? 0.7,
            contextLength: cfg.contextLength ?? 0,
            apiKey: apiKey,
        };
    }

    function isCustomBackend() {
        return (extension_settings?.mbti_widget?.backend || 'st') === 'custom';
    }

    // Effective LLM context budget (in tokens) for the selected backend.
    // ST backend: use ST's own per-model budget (context minus reserved response).
    // Custom backend: use the user-configured contextLength if set, otherwise fall
    // back to ST's budget as a conservative baseline. Never a hardcoded guess.
    //
    // Uses a guarded dynamic import() (not a top-level static import) so a missing
    // or mis-pathed script.js can never prevent the extension from loading. The
    // relative path is the documented depth for third-party installs; fallbacks
    // handle other mount points and older/newer ST versions.
    async function getStBudget() {
        const ST_IMPORT_PATHS = [
            '../../../../script.js',
            '../../../script.js',
        ];
        // Sequential attempt across candidate paths.
        for (const p of ST_IMPORT_PATHS) {
            try {
                const mod = await import(p).catch(() => null);
                if (mod && typeof mod.getMaxPromptTokens === 'function') {
                    const result = mod.getMaxPromptTokens();
                    if (typeof result === 'number' && result > 0) return result;
                }
            } catch (e) {
                // continue to next candidate
            }
        }
        return null;
    }

    async function getContextBudget() {
        const stBudget = await getStBudget();

        // Custom backend: user-configured context takes priority.
        if (isCustomBackend()) {
            const custom = getCustomApiSettings();
            if (custom.contextLength && custom.contextLength > 0) {
                return custom.contextLength;
            }
        }

        // Otherwise use ST's own per-model budget (context minus reserved response).
        if (typeof stBudget === 'number' && stBudget > 0) return stBudget;

        // Final fallbacks if the script.js import is unavailable: read the active
        // API's context from the SillyTavern context object directly.
        try {
            const context = SillyTavern.getContext();
            if (context && context.chatCompletionSettings) {
                const openaiMax = Number(context.chatCompletionSettings.openai_max_context);
                if (openaiMax > 0) return openaiMax;
            }
            if (context && context.maxContext) {
                const genericMax = Number(context.maxContext);
                if (genericMax > 0) return genericMax;
            }
        } catch (e) {
            console.warn('MBTI Widget: Could not determine context budget', e);
        }

        return 0;
    }

    // Unified entry point used by both auto-trigger and re-scan.
    async function generateMBTI({ prompt, systemPrompt, maxTokensOverride }) {
        if (isCustomBackend()) {
            return await generateWithCustomOpenAI({ prompt, systemPrompt, maxTokensOverride });
        }
        const ctx = SillyTavern.getContext();
        return await ctx.generateRaw({
            prompt: prompt,
            systemPrompt: systemPrompt,
        });
    }

    // Direct call to a user-configured OpenAI-compatible endpoint via fetch().
    async function generateWithCustomOpenAI({ prompt, systemPrompt, maxTokensOverride }) {
        const { baseUrl, model, maxTokens, temperature, apiKey } = getCustomApiSettings();

        if (!baseUrl || !baseUrl.trim()) {
            throw new Error('Custom API base URL is not configured');
        }
        if (!model || !model.trim()) {
            throw new Error('Custom API model is not configured');
        }

        const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
        const endpoint = `${normalizedBaseUrl}/chat/completions`;

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey && apiKey.trim()) {
            headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: model.trim(),
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                    max_tokens: maxTokensOverride || maxTokens || 2048,
                    temperature: temperature ?? 0.7,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Custom API error: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error?.message) {
                        errorMessage = `Custom API error: ${errorJson.error.message}`;
                    }
                } catch (e) {
                    if (errorText && errorText.length < 200) {
                        errorMessage = `Custom API error: ${errorText}`;
                    }
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const content = extractOpenAIContent(data);
            if (!content || !content.trim()) {
                const finishReason = data?.choices?.[0]?.finish_reason || 'unknown';
                const hasReasoning = !!(data?.choices?.[0]?.message?.reasoning);
                let hint = '';
                if (finishReason === 'length') {
                    hint = ' (output hit max_tokens — try raising "Max Tokens" in extension settings)';
                }
                const reasonInfo = hasReasoning ? ' [model provided reasoning content only]' : '';
                throw new Error(
                    `Custom API returned no text content (finish_reason: "${finishReason}"${reasonInfo}${hint}). ` +
                    `Response structure: ${JSON.stringify(Object.keys(data || {}))}`
                );
            }
            return content;
        } catch (error) {
            if (error.name === 'TypeError' && (String(error.message).includes('fetch') || String(error.message).includes('Failed to fetch') || String(error.message).includes('NetworkError'))) {
                throw new Error(`CORS Access Blocked: This API endpoint (${normalizedBaseUrl}) does not allow direct access from the browser. This is a browser security restriction (CORS). Use an endpoint that supports CORS (like OpenRouter or a proxy) or switch back to "Use SillyTavern current API".`);
            }
            throw error;
        }
    }

    function extractOpenAIContent(data) {
        if (data && typeof data === 'object') {
            const choices = data.choices;
            if (Array.isArray(choices) && choices.length > 0) {
                const message = choices[0].message;
                if (message && typeof message.content === 'string') {
                    return message.content;
                }
            }
        }
        return '';
    }

    // Fetch available model IDs from the custom API (GET {base}/models).
    async function fetchModels() {
        const { baseUrl, apiKey } = getCustomApiSettings();
        if (!baseUrl || !baseUrl.trim()) {
            throw new Error('Custom API base URL is not configured');
        }
        const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
        const endpoint = `${normalizedBaseUrl}/models`;

        const headers = {};
        if (apiKey && apiKey.trim()) {
            headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        }

        const response = await fetch(endpoint, { method: 'GET', headers: headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (Array.isArray(data?.data)) {
            // Return model objects ({id, contextLength?}) so the caller can auto-fill
            // the context-window setting from the provider's metadata.
            return data.data
                .map(m => {
                    if (!m || typeof m !== 'object') return null;
                    const id = typeof m.id === 'string' ? m.id : null;
                    if (!id) return null;
                    const ctx = extractModelContextLength(m);
                    return { id: id, contextLength: ctx };
                })
                .filter(Boolean);
        }
        return [];
    }

    // Pull a context-window size (tokens) from provider model metadata. Providers
    // expose it under various keys; ST reads the same set. Returns 0 when unknown.
    function extractModelContextLength(m) {
        const candidates = [
            m.context_length,
            m.max_model_len,
            m.max_context_length,
            m.context_window,
            m.inputTokenLimit,
            m.input_token_limit,
        ];
        for (const c of candidates) {
            if (typeof c === 'number' && c > 0) return c;
            if (typeof c === 'string' && c.trim() !== '') {
                const num = parseInt(c, 10);
                if (!isNaN(num) && num > 0) return num;
            }
        }
        return 0;
    }

    // Test the custom API connection with a minimal prompt.
    async function testCustomConnection() {
        try {
            const content = await generateWithCustomOpenAI({
                prompt: 'Respond with exactly: "Connection successful"',
                systemPrompt: 'You are a helpful assistant.',
            });
            const model = getCustomApiSettings().model;
            return { success: true, message: `Connection successful! Model: ${model}`, model: model };
        } catch (error) {
            return { success: false, message: error.message || 'Connection failed' };
        }
    }

    async function queryRating(lastUserMessage, lastAiResponse, chatHistory) {
        const promptData = {
            chat_history: chatHistory,
            last_user_message: lastUserMessage,
            last_ai_response: lastAiResponse
        };
        
        console.log('[MBTI] queryRating - promptData:', JSON.stringify(promptData, null, 2));
        console.log('[MBTI] queryRating - RATING_PROMPT:', RATING_PROMPT);
        
        try {
            console.log('[MBTI] queryRating - backend:', (extension_settings?.mbti_widget?.backend || 'st'));
            const response = await generateMBTI({
                prompt: JSON.stringify(promptData, null, 2),
                systemPrompt: RATING_PROMPT,
            });
            console.log('[MBTI] queryRating - raw response:', response);
            return parseRatingResponse(response);
        } catch (error) {
            console.error('MBTI Widget: Rating query failed', error);
            if (isCustomBackend()) {
                showTestResult(`Analysis failed: ${error.message}`, 'err');
            }
            return { tags: [], reasoning: '', professor: '', error: false };
        }
    }

    // Analyze the most recent turn (last user message) end-to-end and record it.
    // Shared by the auto-trigger (MESSAGE_RECEIVED) and the manual "re-analyze"
    // button. Returns true if a new analysis was recorded, false otherwise.
    async function reAnalyzeLastTurn() {
        if (isProcessing) return false;
        const settings = extension_settings?.mbti_widget;
        if (!settings?.enabled) return false;

        const { userMessage, aiResponse } = getLastUserMessage();
        if (!userMessage) return false;

        const chatHistory = getMessageContext(settings?.contextMessages || 5);
        if (!chatHistory) return false;

        isProcessing = true;
        setStatus('busy', 'Analyzing the last turn...');
        try {
            const previousScores = JSON.parse(JSON.stringify(scores));
            const result = await queryRating(userMessage, aiResponse, chatHistory);

            if (result.error) {
                setStatus('error', 'Response format error');
                errorResendHandler = reAnalyzeLastTurn;
                showErrorPopup('The analysis returned an invalid response format. Re-send to try again.');
                return false;
            }

            if (result.tags && result.tags.length > 0) {
                result.tags.forEach(tag => applyTag(tag));
                const ctx = SillyTavern.getContext();
                const chat = ctx.chat;
                const msgIndex = chat ? chat.length - 1 : trail.length;
                trail.push({
                    messageIndex: msgIndex,
                    scores: JSON.parse(JSON.stringify(scores)),
                    reasoning: result.reasoning || '',
                    professor: result.professor || '',
                    previousScores: previousScores,
                });
                await saveToChatMetadata();
                updatePanel();
                setStatus('done', 'Analysis complete');
                return true;
            }
            setStatus('done', 'No tags detected');
            return false;
        } catch (error) {
            console.error('MBTI Widget: Analysis error', error);
            setStatus('error', 'Analysis failed');
            errorResendHandler = reAnalyzeLastTurn;
            showErrorPopup('The analysis failed. Re-send to try again.');
            return false;
        } finally {
            isProcessing = false;
        }
    }

    function parseRatingResponse(response) {
        const knownTags = ['shadow', 'flame', 'reason', 'heart', 'clue', 'pattern', 'anchor', 'drift'];
        try {
            const parsed = JSON.parse(stripMarkdownFences(response));
            if (parsed.tags && Array.isArray(parsed.tags)) {
                const tags = parsed.tags
                    .map(t => t.toLowerCase().trim())
                    .filter(t => knownTags.includes(t));
                
                const reasoning = (parsed.reasoning || '').toString().trim();
                const professor = (parsed.professor || '').toString().trim();
                
                // Validate: 1-4 tags required
                if (tags.length >= 1 && tags.length <= 4) {
                    console.log('[MBTI] parseRatingResponse - tags:', tags);
                    console.log('[MBTI] parseRatingResponse - reasoning:', reasoning);
                    console.log('[MBTI] parseRatingResponse - professor:', professor);
                    return { tags, reasoning, professor, error: false };
                }
            }
        } catch (e) {
            console.error('MBTI Widget: Invalid JSON response', e);
        }
        
        // Hard failure: response wasn't valid/parseable (empty, malformed, etc).
        // The caller surfaces this to the user.
        console.error('MBTI Widget: Failed to parse valid JSON response');
        return { tags: [], reasoning: '', professor: '', error: true };
    }

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

    async function saveToChatMetadata() {
        const context = SillyTavern.getContext();
        const metadata = context.chatMetadata;
        if (!metadata) return;
        metadata.mbti_scores = scores;
        metadata.mbti_trail = trail;
        await context.saveMetadata();
    }

    function loadFromChatMetadata() {
        const context = SillyTavern.getContext();
        const metadata = context.chatMetadata;
        if (metadata?.mbti_scores) {
            scores = metadata.mbti_scores;
            trail = metadata.mbti_trail || [];
            updatePanel();
        } else {
            scores = { ie: 0, tf: 0, sn: 0, jp: 0 };
            trail = [];
            updatePanel();
        }
    }

    function updatePanel() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];

        const mbtiEl = document.getElementById('mbti-code');
        if (mbtiEl) {
            mbtiEl.textContent = arch.mbti;
            mbtiEl.classList.toggle('is-known', key !== 'unknown');
        }

        const nameEl = document.getElementById('archetype-name');
        if (nameEl) {
            nameEl.textContent = arch.name;
            nameEl.style.color = arch.color;
        }

        const descEl = document.getElementById('archetype-desc');
        if (descEl) {
            descEl.textContent = arch.tagline;
        }

        const pts = scoresToOctagonPoints(scores);
        const poly = document.getElementById('oct-current');
        if (poly) {
            poly.setAttribute('points', pointsToStr(pts));
            poly.setAttribute('fill', `${hexToRgba(arch.color, 0.12)}`);
            poly.setAttribute('stroke', arch.color);
        }

        const dotIds = ['dot-reason', 'dot-pattern', 'dot-flame', 'dot-clue', 'dot-heart', 'dot-drift', 'dot-shadow', 'dot-anchor'];
        dotIds.forEach((id, i) => {
            const dot = document.getElementById(id);
            if (dot) {
                dot.setAttribute('cx', pts[i].x.toFixed(1));
                dot.setAttribute('cy', pts[i].y.toFixed(1));
                dot.setAttribute('opacity', '0.9');
            }
        });

        const trailEl = document.getElementById('oct-trail');
        if (trailEl) {
            trailEl.innerHTML = trail.map((entry, i) => {
                const s = entry.scores || entry;
                const tPts = scoresToOctagonPoints(s);
                const alpha = (i + 1) / trail.length * 0.2;
                return `<polygon points="${pointsToStr(tPts)}" fill="none" stroke="${hexToRgba(arch.color, alpha)}" stroke-width="1"/>`;
            }).join('');
        }

        updateBar('ie', scores.ie, MAX_SCORE);
        updateBar('tf', scores.tf, MAX_SCORE);
        updateBar('sn', scores.sn, MAX_SCORE);
        updateBar('jp', scores.jp, MAX_SCORE);

        setBarIcon('icon-ie', scores.ie, '#94a3b8', '#f97316');
        setBarIcon('icon-tf', scores.tf, '#60a5fa', '#f472b6');
        setBarIcon('icon-sn', scores.sn, '#34d399', '#a78bfa');
        setBarIcon('icon-jp', scores.jp, '#fbbf24', '#94a3b8');

        updateDeltas();

        const reasoningEl = document.getElementById('reasoning-text');
        if (reasoningEl) {
            const lastEntry = trail[trail.length - 1];
            const reasoning = lastEntry && lastEntry.reasoning ? lastEntry.reasoning : '';
            if (reasoning) {
                reasoningEl.textContent = reasoning;
                reasoningEl.style.color = 'rgba(212, 197, 169, 0.8)';
            } else {
                reasoningEl.textContent = 'Start chatting to see analysis...';
                reasoningEl.style.color = 'rgba(212, 197, 169, 0.5)';
            }
        }

        const professorEl = document.getElementById('professor-text');
        const professorSection = document.getElementById('professor-section');
        const lastEntry = trail[trail.length - 1];
        const professor = lastEntry && lastEntry.professor ? lastEntry.professor : '';
        if (professorEl) {
            professorEl.textContent = professor;
        }
        if (professorSection) {
            professorSection.style.display = professor ? 'block' : 'none';
        }

        scheduleDeltaFade();
    }

    // Show the point change for each axis from the previous turn, if any.
    // deltaEl elements are populated with +N / -N in the axis's direction color.
    function updateDeltas() {
        const axes = ['ie', 'tf', 'sn', 'jp'];
        const lastEntry = trail[trail.length - 1];
        if (!lastEntry) {
            axes.forEach(a => {
                const el = document.getElementById(`delta-${a}`);
                if (el) { el.textContent = ''; el.classList.remove('fade'); }
            });
            return;
        }
        const before = lastEntry.previousScores || { ie: 0, tf: 0, sn: 0, jp: 0 };
        const after = lastEntry.scores || lastEntry;
        const axisColors = {
            ie: { neg: '#94a3b8', pos: '#f97316' },
            tf: { neg: '#60a5fa', pos: '#f472b6' },
            sn: { neg: '#34d399', pos: '#a78bfa' },
            jp: { neg: '#fbbf24', pos: '#94a3b8' },
        };
        axes.forEach(a => {
            const el = document.getElementById(`delta-${a}`);
            if (!el) return;
            const delta = (after[a] || 0) - (before[a] || 0);
            if (delta !== 0) {
                el.textContent = delta > 0 ? `+${delta}` : `${delta}`;
                el.style.color = delta > 0 ? axisColors[a].pos : axisColors[a].neg;
                el.classList.remove('fade');
            } else {
                el.textContent = '';
                el.classList.remove('fade');
            }
        });
    }

    // Fade out the delta numbers a while after they are shown.
    let deltaFadeTimer = null;
    function scheduleDeltaFade() {
        if (deltaFadeTimer) clearTimeout(deltaFadeTimer);
        deltaFadeTimer = setTimeout(() => {
            ['ie', 'tf', 'sn', 'jp'].forEach(a => {
                const el = document.getElementById(`delta-${a}`);
                if (el && el.textContent) el.classList.add('fade');
            });
        }, 8000);
    }

    // Footer status indicator. states: 'idle' | 'busy' | 'done' | 'error'
    function setStatus(state, msg) {
        const textEl = document.getElementById('mbti-footer-text');
        const spinnerEl = document.getElementById('mbti-footer-spinner');
        if (!textEl) return;

        const footer = document.getElementById('mbti-footer');
        if (footer) footer.classList.remove('is-error', 'is-done', 'is-busy');

        if (state === 'busy') {
            if (spinnerEl) spinnerEl.style.display = 'inline-block';
            textEl.textContent = msg || 'Analyzing...';
            if (footer) footer.classList.add('is-busy');
        } else {
            if (spinnerEl) spinnerEl.style.display = 'none';
            if (state === 'done') {
                textEl.textContent = msg || 'Completed';
                if (footer) footer.classList.add('is-done');
            } else if (state === 'error') {
                textEl.textContent = msg || 'Analysis failed — see popup';
                if (footer) footer.classList.add('is-error');
            } else {
                textEl.textContent = msg || 'Idle';
            }
        }
    }

    // Remember which flow triggered the error popup, so Re-send re-runs it.
    let errorResendHandler = null;
    // Remember the last re-scan depth, so Re-send re-runs the same scan.
    let lastScanCount = 5;

    function showErrorPopup(message) {
        const popup = document.getElementById('mbti-error-popup');
        const msgEl = document.getElementById('mbti-error-message');
        if (!popup) return;
        if (msgEl) msgEl.textContent = message || 'The analysis returned an invalid response format.';
        popup.classList.add('is-open');
    }

    function closeErrorPopup() {
        const popup = document.getElementById('mbti-error-popup');
        if (popup) popup.classList.remove('is-open');
        errorResendHandler = null;
    }

    function bindErrorPopup() {
        const closeBtn = document.getElementById('mbti-error-close');
        const resendBtn = document.getElementById('mbti-error-resend');
        if (closeBtn) closeBtn.addEventListener('click', closeErrorPopup);
        if (resendBtn) resendBtn.addEventListener('click', () => {
            const handler = errorResendHandler;
            closeErrorPopup();
            if (handler) handler();
        });
    }

    function getMBTIKey(s) {
        if (s.ie === 0 && s.tf === 0 && s.sn === 0 && s.jp === 0) return 'unknown';
        const i_e = (s.ie || 0) >= 0 ? 'E' : 'I';
        const s_n = (s.sn || 0) >= 0 ? 'N' : 'S';
        const t_f = (s.tf || 0) >= 0 ? 'F' : 'T';
        const j_p = (s.jp || 0) >= 0 ? 'P' : 'J';
        return i_e + s_n + t_f + j_p;
    }

    function scoresToOctagonPoints(s) {
        const axisVals = [
            Math.max(0, -(s.tf || 0)) / MAX_SCORE,
            Math.max(0, (s.sn || 0)) / MAX_SCORE,
            Math.max(0, (s.ie || 0)) / MAX_SCORE,
            Math.max(0, -(s.sn || 0)) / MAX_SCORE,
            Math.max(0, (s.tf || 0)) / MAX_SCORE,
            Math.max(0, (s.jp || 0)) / MAX_SCORE,
            Math.max(0, -(s.ie || 0)) / MAX_SCORE,
            Math.max(0, -(s.jp || 0)) / MAX_SCORE,
        ];
        const BASE = 8;
        const MAX_R = 92;
        return VERTICES.map((v, i) => {
            const t = BASE + axisVals[i] * MAX_R;
            const dx = v.x - CENTER.x;
            const dy = v.y - CENTER.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ratio = t / dist;
            return { x: CENTER.x + dx * ratio, y: CENTER.y + dy * ratio };
        });
    }

    function pointsToStr(pts) {
        return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function stripMarkdownFences(response) {
        let cleaned = response.trim();
        const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            cleaned = fenceMatch[1].trim();
        }
        return cleaned;
    }

    function estimateTokens(messageCount) {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        if (!chat) return 0;

        const messages = chat.slice(-messageCount);
        let totalChars = 0;

        messages.forEach(m => {
            totalChars += (m.mes || '').length + (m.name || '').length + 5;
        });

        totalChars += RESCAN_PROMPT.length;
        return Math.round(totalChars / 4);
    }

    // Build the text representation of messages for the re-scan payload/sizing.
    function buildRescanChatText(messages) {
        return messages.map((m, i) =>
            `[${i}] ${m.is_user ? '[user]' : '[ai]'} ${m.name}: ${m.mes}`
        ).join('\n');
    }

    // Count tokens of the full re-scan prompt (RESCAN_PROMPT + chat text) using
    // SillyTavern's tokenizer. Falls back to a chars/4 heuristic if unavailable.
    async function countRescanTokens(messages) {
        try {
            const context = SillyTavern.getContext();
            if (context && typeof context.getTokenCountAsync === 'function') {
                const text = buildRescanChatText(messages);
                const promptTokens = await context.getTokenCountAsync(RESCAN_PROMPT + '\n' + text);
                return promptTokens || 0;
            }
        } catch (e) {
            console.warn('MBTI Widget: getTokenCountAsync failed, using heuristic', e);
        }
        let totalChars = RESCAN_PROMPT.length;
        messages.forEach(m => {
            totalChars += (m.mes || '').length + (m.name || '').length + 5;
        });
        return Math.round(totalChars / 4);
    }

    function countUserMessages(messageCount) {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        if (!chat) return 0;

        const messages = chat.slice(-messageCount);
        return messages.filter(m => m.is_user).length;
    }

    function openRescanPopup() {
        const popup = document.getElementById('rescan-popup');
        if (!popup) return;

        const isVisible = popup.style.display === 'block';
        popup.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            const slider = document.getElementById('rescan-slider');
            if (slider && extension_settings?.mbti_widget?.rescanMessages) {
                slider.value = extension_settings.mbti_widget.rescanMessages;
            }
            updateRescanSlider();
        }
    }

    function closeRescanPopup() {
        const popup = document.getElementById('rescan-popup');
        if (popup) popup.style.display = 'none';
    }

    async function updateRescanSlider() {
        const slider = document.getElementById('rescan-slider');
        const countEl = document.getElementById('rescan-count');
        const userCountEl = document.getElementById('rescan-user-count');
        const tokensEl = document.getElementById('rescan-tokens');

        if (!slider) return;

        const context = SillyTavern.getContext();
        const chat = context.chat;
        const totalMessages = chat ? chat.length : 10;

        slider.min = Math.min(5, totalMessages);
        slider.max = totalMessages;

        if (parseInt(slider.value) > totalMessages) {
            slider.value = totalMessages;
        }

        const messageCount = parseInt(slider.value);
        countEl.textContent = `${messageCount} messages`;

        const userCount = countUserMessages(messageCount);
        userCountEl.textContent = `~${userCount} user messages`;

        const messages = chat ? chat.slice(-messageCount) : [];
        const tokens = await countRescanTokens(messages);
        tokensEl.textContent = `~${tokens.toLocaleString()} tokens`;
    }

    function parseRescanResponse(response) {
        try {
            const parsed = JSON.parse(stripMarkdownFences(response));

            if (parsed.analyses && Array.isArray(parsed.analyses)) {
                const validAnalyses = parsed.analyses.filter(a =>
                    a.messageIndex !== undefined &&
                    Array.isArray(a.tags) &&
                    a.tags.length >= 1 &&
                    a.tags.length <= 4
                );

                return { analyses: validAnalyses, error: false };
            }
        } catch (e) {
            console.error('MBTI Widget: Invalid re-scan JSON', e);
        }

        return { analyses: [], error: true };
    }

    // Compute output token budget for re-scan: scale by user message count so
    // long chats aren't truncated, capped to avoid wasteful allocation.
    function getRescanOutputBudget(userMessageCount) {
        const configured = getCustomApiSettings().maxTokens;
        const estimated = userMessageCount * 120;
        const MAX_OUTPUT = 32768;
        return Math.min(Math.max(configured, estimated), MAX_OUTPUT);
    }

    async function reScanHistory(messageCount) {
        if (isProcessing) return;

        const context = SillyTavern.getContext();
        const chat = context.chat;
        if (!chat || chat.length === 0) return;

        // Use the newest N messages, skipping system messages (not user behavior).
        const sliced = chat.slice(-messageCount);
        const messages = sliced.filter(m => !m.is_system);
        if (messages.length === 0) return;

        // Remember depth so the error popup's Re-send re-runs the same scan.
        lastScanCount = messageCount;

        scores = { ie: 0, tf: 0, sn: 0, jp: 0 };
        trail = [];

        isProcessing = true;
        showRescanProgress(true);
        setStatus('busy', `Re-scanning last ${messageCount} messages...`);

        const budget = await getContextBudget();
        let overflowing = false;

        try {
            // Greedily include messages newest-first until we hit the context budget.
            // The prompt is RESCAN_PROMPT + the formatted history.
            let includedMsgs = [];
            for (const m of [...messages].reverse()) {
                const candidateAll = [m, ...includedMsgs];
                const est = await countRescanTokens(candidateAll);
                if (budget > 0 && est > budget) {
                    overflowing = true;
                    break;
                }
                includedMsgs = candidateAll;
            }
            // includedMsgs is newest-first; keep it chronological for the prompt.
            includedMsgs = includedMsgs.reverse();

            let chatText = buildRescanChatText(includedMsgs);
            if (overflowing && includedMsgs.length < messages.length) {
                const omitted = messages.length - includedMsgs.length;
                chatText = `[NOTE: ${omitted} earlier message(s) omitted to fit the model context window.]\n${chatText}`;
                console.warn(`[MBTI] Re-scan truncated: omitted ${omitted} earlier messages (budget ${budget} tokens).`);
            }

            const warnEl = document.getElementById('rescan-warning');
            if (warnEl) {
                warnEl.style.display = overflowing ? 'block' : 'none';
                if (overflowing) {
                    const omittedTotal = messages.length - includedMsgs.length;
                    warnEl.textContent = `Chat exceeds the model context (~${budget.toLocaleString()} tokens) — analyzing the newest ${includedMsgs.length} messages. ${omittedTotal} earlier message(s) omitted.`;
                }
            }

            // Re-scan output grows linearly with user messages (one analysis entry
            // each: tags + reasoning). Scale output tokens to prevent truncation.
            const includedUserCount = includedMsgs.filter(m => m.is_user).length;
            const outputBudget = getRescanOutputBudget(includedUserCount);

            const response = await generateMBTI({
                prompt: chatText,
                systemPrompt: RESCAN_PROMPT,
                maxTokensOverride: outputBudget,
            });

            console.log('[MBTI] Re-scan response:', response);

            const parsed = parseRescanResponse(response);
            console.log('[MBTI] Parsed analyses:', parsed.analyses.length);

            if (parsed.error) {
                setStatus('error', 'Re-scan format error');
                errorResendHandler = () => reScanHistory(lastScanCount);
                showErrorPopup('The re-scan returned an invalid response format. Re-send to try again.');
                return;
            }

            parsed.analyses.forEach(analysis => {
                if (analysis.tags && analysis.tags.length > 0) {
                    const previousScores = JSON.parse(JSON.stringify(scores));
                    analysis.tags.forEach(tag => applyTag(tag));
                    trail.push({
                        messageIndex: analysis.messageIndex,
                        scores: JSON.parse(JSON.stringify(scores)),
                        reasoning: analysis.reasoning || '',
                        professor: '',
                        previousScores: previousScores,
                    });
                }
            });

            if (parsed.analyses.length === 0 && response.trim()) {
                console.warn('[MBTI] Re-scan: response parsed but contained no valid analyses.');
            }

            await saveToChatMetadata();
            updatePanel();
            setStatus('done', 'Re-scan complete');

            console.log('[MBTI] Re-scan complete. Final scores:', scores);

        } catch (error) {
            console.error('MBTI Widget: Re-scan failed', error);
            setStatus('error', 'Re-scan failed');
            errorResendHandler = () => reScanHistory(lastScanCount);
            showErrorPopup('The re-scan failed. Re-send to try again.');
        } finally {
            isProcessing = false;
            showRescanProgress(false);
            closeRescanPopup();
        }
    }

    function showRescanProgress(show) {
        const progressEl = document.getElementById('rescan-progress');
        const goBtn = document.getElementById('rescan-go-btn');

        if (progressEl) {
            progressEl.style.display = show ? 'flex' : 'none';
        }
        if (goBtn) {
            goBtn.disabled = show;
            goBtn.textContent = show ? 'Scanning...' : 'Re-scan';
        }
    }

    function updateBar(axis, val, max) {
        const pct = Math.abs(val) / max * 50;
        const leftEl = document.getElementById(`bar-${axis}-left`);
        const rightEl = document.getElementById(`bar-${axis}-right`);
        if (val < 0) {
            if (leftEl) leftEl.style.width = pct + '%';
            if (rightEl) rightEl.style.width = '0%';
        } else if (val > 0) {
            if (leftEl) leftEl.style.width = '0%';
            if (rightEl) rightEl.style.width = pct + '%';
        } else {
            if (leftEl) leftEl.style.width = '0%';
            if (rightEl) rightEl.style.width = '0%';
        }
    }

    function setBarIcon(id, val, negColor, posColor) {
        const el = document.getElementById(id);
        if (!el) return;
        if (val < 0) el.style.backgroundColor = negColor;
        else if (val > 0) el.style.backgroundColor = posColor;
        else el.style.backgroundColor = 'rgba(212,197,169,0.3)';
    }

    function openFullArchModal() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];

        const illKey = arch.illustration || 'unknown';
        const illustrationEl = document.getElementById('mbti-full-arch-illustration');
        if (illustrationEl) {
            illustrationEl.innerHTML = (ILLUSTRATIONS[illKey] || ILLUSTRATIONS['unknown']) +
                '<div class="full-arch-illustration-overlay"></div>' +
                '<button class="full-arch-close" id="mbti-full-arch-close-btn">×</button>';
        }

        const bodyEl = document.getElementById('mbti-full-arch-body');
        if (bodyEl) {
            const traitHTML = arch.traits.map(t =>
                `<span class="full-arch-trait" style="color:${t.color};border-color:${t.color}40;background:${t.color}10">${t.label}</span>`
            ).join('');

            const bulletsHTML = arch.bullets.map(b => `<div class="full-arch-bullet">${b}</div>`).join('');
            const famousHTML = arch.famous.map(f => `<span class="full-arch-famous-name">${f}</span>`).join('');
            const mbtiLine = key !== 'unknown' ? `<div class="full-arch-mbti-badge">${arch.mbti} · MBTI Analog</div>` : '';
            const twoCol = arch.asset ? `<div class="full-arch-two-col"><div class="full-arch-col"><div class="full-arch-col-label is-asset">Greatest Asset</div><p>${arch.asset}</p></div><div class="full-arch-col"><div class="full-arch-col-label is-risk">Hidden Risk</div><p>${arch.risk}</p></div></div>` : '';
            const famousSection = arch.famous.length ? `<div class="full-arch-section-label">Known Examples</div><div class="full-arch-famous">${famousHTML}</div>` : '';
            const investigationSection = arch.bullets.length ? `<div class="full-arch-section-label">In This Investigation</div><div class="full-arch-bullets">${bulletsHTML}</div><div class="full-arch-divider"></div>${twoCol}<div class="full-arch-divider"></div>${famousSection}` : '';

            bodyEl.innerHTML = `${mbtiLine}<div class="full-arch-title" style="color:${arch.color}">${arch.name}</div><div class="full-arch-tagline">${arch.tagline}</div>${traitHTML ? `<div class="full-arch-traits">${traitHTML}</div>` : ''}${investigationSection}`;
        }

        const overlay = document.getElementById('mbti-full-arch-overlay');
        if (overlay) overlay.classList.add('is-open');
    }

    function openHistoryModal() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];

        const mbtiCodeEl = document.getElementById('history-mbti-code');
        if (mbtiCodeEl) {
            mbtiCodeEl.textContent = arch.mbti;
            mbtiCodeEl.style.color = arch.color;
        }

        const nameEl = document.getElementById('history-archetype-name');
        if (nameEl) {
            nameEl.textContent = arch.name;
            nameEl.style.color = arch.color;
        }

        const taglineEl = document.getElementById('history-tagline');
        if (taglineEl) {
            taglineEl.textContent = arch.tagline;
        }

        const gridEl = document.getElementById('history-grid');
        if (gridEl) {
            if (trail.length === 0) {
                gridEl.innerHTML = '<div class="history-empty">No analysis data yet. Start chatting or re-scan to build history.</div>';
            } else {
                gridEl.innerHTML = trail.map((entry, i) => {
                    const chips = buildRatingChips(entry, i);
                    const chipsHTML = chips.length > 0
                        ? chips.join('')
                        : '<span class="history-tag-empty">No change</span>';

                    const rowNum = entry.messageIndex !== undefined ? entry.messageIndex : i + 1;
                    const professorHTML = entry.professor
                        ? `<div class="history-row-professor">${entry.professor}</div>`
                        : '';

                    return `
                        <div class="history-row">
                            <div class="history-row-num">${rowNum}</div>
                            <div class="history-row-body">
                                <div class="history-row-tags">${chipsHTML}</div>
                                <div class="history-row-reasoning">${entry.reasoning || 'No reasoning recorded'}</div>
                                ${professorHTML}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        renderHistorySummary();
        renderHistoryLegend();

        const overlay = document.getElementById('history-overlay');
        if (overlay) overlay.classList.add('is-open');
    }

    // Per-axis delta for one trail entry, falling back to the previous entry's
    // scores when previousScores is missing (old data).
    function entryDelta(entry, i) {
        const before = entry.previousScores && (entry.previousScores.ie !== undefined || entry.previousScores.tf !== undefined)
            ? { ie: entry.previousScores.ie || 0, tf: entry.previousScores.tf || 0, sn: entry.previousScores.sn || 0, jp: entry.previousScores.jp || 0 }
            : (() => {
                const prev = trail[i - 1];
                const p = prev ? (prev.scores || prev) : {};
                return { ie: p.ie || 0, tf: p.tf || 0, sn: p.sn || 0, jp: p.jp || 0 };
            })();
        const s = entry.scores || entry;
        return {
            ie: (s.ie || 0) - before.ie,
            tf: (s.tf || 0) - before.tf,
            sn: (s.sn || 0) - before.sn,
            jp: (s.jp || 0) - before.jp,
        };
    }

    // Mask-styled icon like the main panel bars.
    function ratingIconHTML(meta, color) {
        return '<div class="mbti-rating-icon" style="-webkit-mask-image:url(\'' + meta.icon + '\');mask-image:url(\'' + meta.icon + '\');background-color:' + color + ';"></div>';
    }

    // One chip: icon + signed delta for a non-zero axis.
    function ratingChipHTML(meta, delta) {
        const color = delta > 0 ? meta.pos : meta.neg;
        const text = (delta > 0 ? '+' : '') + delta;
        return '<span class="mbti-rating-chip" style="color:' + color + ';">' + ratingIconHTML(meta, color) + '<span class="mbti-rating-chip-num">' + text + '</span></span>';
    }

    // Chips for a single history row (all axes with non-zero delta).
    function buildRatingChips(entry, i) {
        const deltas = entryDelta(entry, i);
        return AXIS_META
            .filter(m => deltas[m.axis] !== 0)
            .map(m => ratingChipHTML(m, deltas[m.axis]));
    }

    // Totals row under the modal header: current score per axis (the same
    // values that fill the meters) as icon + signed number.
    function renderHistorySummary() {
        const el = document.getElementById('history-summary');
        if (!el) return;
        el.innerHTML = AXIS_META.map(m => {
            const val = scores[m.axis] || 0;
            const color = val > 0 ? m.pos : (val < 0 ? m.neg : 'rgba(212,197,169,0.35)');
            const text = (val > 0 ? '+' : '') + val;
            return '<span class="mbti-rating-chip is-summary" style="color:' + color + ';">' + ratingIconHTML(m, color) + '<span class="mbti-rating-chip-num">' + text + '</span></span>';
        }).join('');
    }

    // Legend footer: each icon with its positive/negative tag names.
    function renderHistoryLegend() {
        const el = document.getElementById('history-legend');
        if (!el) return;
        el.innerHTML = AXIS_META.map(m =>
            '<div class="legend-item">' +
                ratingIconHTML(m, m.pos) +
                '<span class="legend-text"><span class="legend-pos" style="color:' + m.pos + ';">' + m.posTag + '</span> <span class="legend-arrow">/</span> <span class="legend-neg" style="color:' + m.neg + ';">' + m.negTag + '</span></span>' +
            '</div>'
        ).join('');
    }

    function closeHistoryModal() {
        const overlay = document.getElementById('history-overlay');
        if (overlay) overlay.classList.remove('is-open');
    }

    window.MBTI_Widget = {
        closeFullArchModal: function() {
            const overlay = document.getElementById('mbti-full-arch-overlay');
            if (overlay) overlay.classList.remove('is-open');
        },
        closeHistoryModal: function() {
            closeHistoryModal();
        }
    };

    function createPanel() {
        const existing = document.getElementById('mbti-widget-panel');
        if (existing) return;

        const panel = document.createElement('div');
        panel.id = 'mbti-widget-panel';
        panel.className = 'mbti-panel';
        panel.innerHTML = `
            <div class="profile-shell" id="profile-shell">
                <div class="profile-header">
                    <div class="mbti-code" id="mbti-code">????</div>
                    <div class="header-buttons">
                        <button class="history-btn" id="history-btn" title="View analysis history">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                        </button>
                        <button class="rescan-btn" id="rescan-btn" title="Re-scan chat history">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 4v6h6M23 20v-6h-6"/>
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                            </svg>
                        </button>
                        <button class="magnify-btn" id="magnify-btn">
                            <div class="magnify-icon"></div>
                        </button>
                    </div>
                </div>
                <div class="profile-eyebrow">Your Nature</div>
                <div class="archetype-name" id="archetype-name" style="color: var(--theme-gold)">THE UNKNOWN</div>
                <div class="archetype-desc" id="archetype-desc">Start chatting to build your MBTI profile...</div>
                <div class="octagon-wrapper">
                    <svg id="octagon-svg" viewBox="0 0 220 220" width="100%" style="display:block;overflow:visible;position:relative;z-index:2;">
                        <defs><filter id="glow-radar-oct" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                        <g id="oct-grid" stroke="rgba(212,197,169,0.08)" stroke-width="1" fill="none">
                            <polygon points="110,18 167,36 202,90 202,130 167,184 110,202 53,184 18,130 18,90 53,36"/>
                            <polygon points="110,38 154,52 181,97 181,123 154,168 110,182 66,168 39,123 39,97 66,52"/>
                            <polygon points="110,58 141,68 160,103 160,117 141,152 110,162 79,152 60,117 60,103 79,68"/>
                            <polygon points="110,78 128,84 139,110 139,110 128,136 110,142 92,136 81,110 81,110 92,84"/>
                        </g>
                        <g stroke="rgba(212,197,169,0.08)" stroke-width="1">
                            <line x1="110" y1="110" x2="110" y2="18"/><line x1="110" y1="110" x2="167" y2="36"/><line x1="110" y1="110" x2="202" y2="110"/>
                            <line x1="110" y1="110" x2="167" y2="184"/><line x1="110" y1="110" x2="110" y2="202"/><line x1="110" y1="110" x2="53" y2="184"/>
                            <line x1="110" y1="110" x2="18" y2="110"/><line x1="110" y1="110" x2="53" y2="36"/>
                        </g>
                        <g id="oct-trail"></g>
                        <polygon id="oct-current" points="110,18 167,36 202,110 167,184 110,202 53,184 18,110 53,36" fill="rgba(212,175,55,0.0)" stroke="rgba(212,175,55,0.0)" stroke-width="1.5" filter="url(#glow-radar-oct)"/>
                        <g id="oct-dots" filter="url(#glow-radar-oct)">
                            <circle id="dot-reason" cx="110" cy="110" r="2.5" fill="#60a5fa" opacity="0"/><circle id="dot-pattern" cx="110" cy="110" r="2.5" fill="#a78bfa" opacity="0"/>
                            <circle id="dot-flame" cx="110" cy="110" r="2.5" fill="#f97316" opacity="0"/><circle id="dot-clue" cx="110" cy="110" r="2.5" fill="#34d399" opacity="0"/>
                            <circle id="dot-heart" cx="110" cy="110" r="2.5" fill="#f472b6" opacity="0"/><circle id="dot-drift" cx="110" cy="110" r="2.5" fill="#94a3b8" opacity="0"/>
                            <circle id="dot-shadow" cx="110" cy="110" r="2.5" fill="#94a3b8" opacity="0"/><circle id="dot-anchor" cx="110" cy="110" r="2.5" fill="#fbbf24" opacity="0"/>
                        </g>
                    </svg>
                </div>
                <div class="axis-bars-grid">
                    <div class="axis-bar-item"><div class="axis-track" id="bar-ie"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-ie-left" style="background:#94a3b8;box-shadow:0 0 6px rgba(148,163,184,0.6);width:0%"></div><div class="axis-fill-right" id="bar-ie-right" style="background:#f97316;box-shadow:0 0 6px rgba(249,115,22,0.6);width:0%"></div><div id="icon-ie" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/fire-element.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/fire-element.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-ie"></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-tf"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-tf-left" style="background:#60a5fa;box-shadow:0 0 6px rgba(96,165,250,0.6);width:0%"></div><div class="axis-fill-right" id="bar-tf-right" style="background:#f472b6;box-shadow:0 0 6px rgba(244,114,182,0.6);width:0%"></div><div id="icon-tf" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/like--v1.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/like--v1.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-tf"></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-sn"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-sn-left" style="background:#34d399;box-shadow:0 0 6px rgba(52,211,153,0.6);width:0%"></div><div class="axis-fill-right" id="bar-sn-right" style="background:#a78bfa;box-shadow:0 0 6px rgba(167,139,250,0.6);width:0%"></div><div id="icon-sn" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/idea.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/idea.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-sn"></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-jp"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-jp-left" style="background:#fbbf24;box-shadow:0 0 6px rgba(251,191,36,0.6);width:0%"></div><div class="axis-fill-right" id="bar-jp-right" style="background:#94a3b8;box-shadow:0 0 6px rgba(148,163,184,0.6);width:0%"></div><div id="icon-jp" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/wind.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/wind.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-jp"></div></div>
                </div>
                <div class="reasoning-display" id="reasoning-display">
                    <div class="reasoning-header">
                        <div class="reasoning-label">Latest Analysis</div>
                        <button class="magnify-btn reanalyze-btn" id="reanalyze-btn" title="Re-analyze the last turn">
                            <div class="reanalyze-icon"></div>
                        </button>
                    </div>
                    <div class="reasoning-text" id="reasoning-text">Start chatting to see analysis...</div>
                    <div class="professor-section" id="professor-section">
                        <div class="professor-label">Psy Professor</div>
                        <div class="professor-text" id="professor-text"></div>
                    </div>
                </div>
                <div class="mbti-footer" id="mbti-footer">
                    <div class="mbti-footer-spinner" id="mbti-footer-spinner" style="display:none;"></div>
                    <span class="mbti-footer-text" id="mbti-footer-text">Idle</span>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        const rescanPopup = document.createElement('div');
        rescanPopup.id = 'rescan-popup';
        rescanPopup.className = 'rescan-popup';
        rescanPopup.innerHTML = `
            <div class="rescan-title">Re-scan Chat History</div>
            <div class="rescan-slider-row">
                <input type="range" id="rescan-slider" min="5" max="10" value="5" class="rescan-slider">
                <span id="rescan-count" class="rescan-count">5 messages</span>
            </div>
            <div class="rescan-info">
                <span id="rescan-user-count" class="rescan-user-count">~3 user messages</span>
                <span id="rescan-tokens" class="rescan-tokens">~1,500 tokens</span>
            </div>
            <div class="rescan-warning" id="rescan-warning" style="display:none;"></div>
            <button class="rescan-go-btn" id="rescan-go-btn">Re-scan</button>
            <div class="rescan-progress" id="rescan-progress" style="display:none;">
                <div class="rescan-spinner"></div>
                <span id="rescan-progress-text">Analyzing chat history...</span>
            </div>
        `;
        panel.appendChild(rescanPopup);

        const errorPopup = document.createElement('div');
        errorPopup.id = 'mbti-error-popup';
        errorPopup.className = 'mbti-error-popup';
        errorPopup.innerHTML = `
            <div class="mbti-error-title">Analysis Error</div>
            <div class="mbti-error-message" id="mbti-error-message"></div>
            <div class="mbti-error-actions">
                <button class="mbti-error-btn" id="mbti-error-close">Close</button>
                <button class="mbti-error-btn is-primary" id="mbti-error-resend">Re-send</button>
            </div>
        `;
        panel.appendChild(errorPopup);

        const fullArchOverlay = document.createElement('div');
        fullArchOverlay.id = 'mbti-full-arch-overlay';
        fullArchOverlay.className = 'full-arch-overlay';
        fullArchOverlay.innerHTML = `
            <div class="full-arch-modal" id="mbti-full-arch-modal">
                <div class="full-arch-illustration" id="mbti-full-arch-illustration">
                    <div class="full-arch-illustration-overlay"></div>
                    <button class="full-arch-close" id="mbti-full-arch-close">×</button>
                </div>
                <div class="full-arch-body" id="mbti-full-arch-body"></div>
            </div>
        `;
        document.body.appendChild(fullArchOverlay);

        const historyOverlay = document.createElement('div');
        historyOverlay.id = 'history-overlay';
        historyOverlay.className = 'history-overlay';
        historyOverlay.innerHTML = `
            <div class="history-modal" id="history-modal">
                <div class="history-header">
                    <button class="history-close" id="history-close">×</button>
                    <div class="history-mbti-code" id="history-mbti-code">????</div>
                    <div class="history-archetype-name" id="history-archetype-name">THE UNKNOWN</div>
                    <div class="history-tagline" id="history-tagline">Start chatting to build your MBTI profile...</div>
                </div>
                <div class="history-divider"></div>
                <div class="history-summary">
                    <div class="history-summary-label">Total points</div>
                    <div class="history-summary-chips" id="history-summary"></div>
                </div>
                <div class="history-section-label">Analysis History</div>
                <div class="history-grid" id="history-grid"></div>
                <div class="history-footer">
                    <div class="history-footer-title">Legend</div>
                    <div class="history-legend" id="history-legend"></div>
                </div>
            </div>
        `;
        document.body.appendChild(historyOverlay);

        fullArchOverlay.addEventListener('click', function(e) {
            if (e.target === this) window.MBTI_Widget.closeFullArchModal();
        });
        document.getElementById('mbti-full-arch-close').addEventListener('click', function() {
            window.MBTI_Widget.closeFullArchModal();
        });

        document.getElementById('magnify-btn').addEventListener('click', openFullArchModal);

        document.getElementById('rescan-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            openRescanPopup();
        });

        document.getElementById('history-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            openHistoryModal();
        });

        document.getElementById('history-close').addEventListener('click', function() {
            closeHistoryModal();
        });

        document.getElementById('history-overlay').addEventListener('click', function(e) {
            if (e.target === this) closeHistoryModal();
        });

        document.getElementById('rescan-slider').addEventListener('input', function() {
            extension_settings.mbti_widget.rescanMessages = parseInt(this.value);
            saveSettingsDebounced();
            updateRescanSlider();
        });

        document.getElementById('reanalyze-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            reAnalyzeLastTurn();
        });

        bindErrorPopup();

        document.getElementById('rescan-go-btn').addEventListener('click', function() {
            const slider = document.getElementById('rescan-slider');
            const messageCount = parseInt(slider.value);
            reScanHistory(messageCount);
        });

        document.addEventListener('click', function(e) {
            const popup = document.getElementById('rescan-popup');
            const btn = document.getElementById('rescan-btn');
            if (popup && popup.style.display === 'block') {
                if (!popup.contains(e.target) && !btn.contains(e.target)) {
                    popup.style.display = 'none';
                }
            }
        });

        // Make panel draggable via header
        const header = panel.querySelector('.profile-header');
        let isDraggingPanel = false;
        let panelStartX, panelStartY, panelInitialX, panelInitialY;

        header.addEventListener('mousedown', (e) => {
            isDraggingPanel = true;
            panelStartX = e.clientX;
            panelStartY = e.clientY;
            const rect = panel.getBoundingClientRect();
            panelInitialX = rect.left;
            panelInitialY = rect.top;
            panel.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDraggingPanel) return;
            const dx = e.clientX - panelStartX;
            const dy = e.clientY - panelStartY;
            panel.style.left = (panelInitialX + dx) + 'px';
            panel.style.top = (panelInitialY + dy) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDraggingPanel) {
                isDraggingPanel = false;
                panel.style.cursor = '';
            }
        });

        header.style.cursor = 'grab';

        updatePanel();
        panelCreated = true;
    }

    function createFab() {
        const existing = document.getElementById('mbti-widget-fab');
        if (existing) return;

        const fab = document.createElement('div');
        fab.id = 'mbti-widget-fab';
        fab.className = 'mbti-fab';
        fab.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
        
        // Click to toggle panel
        fab.addEventListener('click', () => {
            isPanelOpen = !isPanelOpen;
            const panel = document.getElementById('mbti-widget-panel');
            if (panel) {
                panel.style.display = isPanelOpen ? 'block' : 'none';
            }
        });
        
        // Make draggable
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        fab.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = fab.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            fab.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            fab.style.left = (initialX + dx) + 'px';
            fab.style.top = (initialY + dy) + 'px';
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                fab.style.cursor = 'grab';
            }
        });
        
        fab.style.cursor = 'grab';
        document.body.appendChild(fab);
    }


    async function init() {
        
        const scripts = document.querySelectorAll('script[src*="index.js"]');
        let BASE_URL = '';
        for (const script of scripts) {
            if (script.src.includes('MBTI_Widget')) {
                BASE_URL = script.src.split('/').slice(0, -1).join('/');
                break;
            }
        }
        if (!BASE_URL) {
            BASE_URL = '/scripts/extensions/third-party/SillyTavern-MBTI_Widget';
        }

        const ctx = SillyTavern.getContext();
        extension_settings = ctx.extension_settings || ctx.extensionSettings;
        saveSettingsDebounced = ctx.saveSettingsDebounced;
        
        console.log('[MBTI] Context keys:', Object.keys(ctx).slice(0, 20));
        console.log('[MBTI] extension_settings:', extension_settings);
        console.log('[MBTI] mbti_widget:', extension_settings?.mbti_widget);

        // Register settings with extension panel
        try {
            const resp = await fetch(`${BASE_URL}/settings.html`);
            if (resp.ok) {
                const html = await resp.text();
                jQuery('#extensions_settings').append(html);
            }
        } catch (err) {
            console.error('MBTI Widget: Failed to load settings:', err);
        }

        // Register event handlers
        const context = SillyTavern.getContext();
        
        // Debug: check what events are available
        console.log('[MBTI] event_types:', context.event_types);
        console.log('[MBTI] MESSAGE_RECEIVED:', context.event_types?.MESSAGE_RECEIVED);
        
        context.eventSource.on(context.event_types.CHAT_LOADED, () => {
            console.log('[MBTI] CHAT_LOADED event fired');
            loadFromChatMetadata();
            if (panelCreated) updatePanel();
        });

        context.eventSource.on(context.event_types.MESSAGE_RECEIVED, async (data) => {
            console.log('[MBTI] MESSAGE_RECEIVED event fired, data:', data);
            setStatus('busy', 'New message received — analyzing...');
            const analyzed = await reAnalyzeLastTurn();
            console.log('[MBTI] reAnalyzeLastTurn analyzed:', analyzed);
        });

        extension_settings.mbti_widget = extension_settings.mbti_widget || {
            enabled: true,
            contextMessages: 5,
            autoOpenOnLoad: false,
        };
        // Ensure nested backend settings exist (v3)
        if (!extension_settings.mbti_widget.backend) {
            extension_settings.mbti_widget.backend = 'st';
        }
        if (!extension_settings.mbti_widget.customApi) {
            extension_settings.mbti_widget.customApi = {
                baseUrl: '',
                model: '',
                maxTokens: 8192,
                temperature: 0.7,
                contextLength: 0,
            };
        }
        // Migrate existing settings that predate contextLength
        if (extension_settings.mbti_widget.customApi.contextLength === undefined) {
            extension_settings.mbti_widget.customApi.contextLength = 0;
        }
        // Persisted re-scan depth (default 5)
        if (extension_settings.mbti_widget.rescanMessages === undefined) {
            extension_settings.mbti_widget.rescanMessages = 5;
        }


        createFab();
        createPanel();

        // Initialize toggle states from settings
        jQuery('#mbti_enabled').prop('checked', extension_settings.mbti_widget.enabled);
        jQuery('#mbti_context_messages').val(extension_settings.mbti_widget.contextMessages);
        jQuery('#mbti_context_messages_value').text(extension_settings.mbti_widget.contextMessages);

        initializeBackendSettings();

        // Sync quick toggle if present
        if (jQuery('#mbti_enabled_quick').length) {
            jQuery('#mbti_enabled_quick').prop('checked', extension_settings.mbti_widget.enabled);
        }

        // Set initial visibility based on enabled state
        if (extension_settings.mbti_widget.enabled) {
            showWidget();
        } else {
            hideWidget();
        }

        // Event handlers for settings
        jQuery('#mbti_enabled').on('change', function() {
            const enabled = jQuery(this).is(':checked');
            extension_settings.mbti_widget.enabled = enabled;
            saveSettingsDebounced();
            if (enabled) {
                showWidget();
            } else {
                hideWidget();
            }
            // Sync quick toggle
            if (jQuery('#mbti_enabled_quick').length) {
                jQuery('#mbti_enabled_quick').prop('checked', enabled);
            }
        });

        jQuery('#mbti_enabled_quick').on('change', function() {
            const enabled = jQuery(this).is(':checked');
            extension_settings.mbti_widget.enabled = enabled;
            saveSettingsDebounced();
            if (enabled) {
                showWidget();
            } else {
                hideWidget();
            }
            // Sync main toggle
            jQuery('#mbti_enabled').prop('checked', enabled);
        });

        jQuery('#mbti_context_messages').on('input', function() {
            const val = parseInt(jQuery(this).val());
            extension_settings.mbti_widget.contextMessages = val;
            jQuery('#mbti_context_messages_value').text(val);
            saveSettingsDebounced();
        });

        loadFromChatMetadata();
        updatePanel();

        console.log('MBTI Widget loaded');
    }

    function showTestResult(message, type) {
        const el = document.getElementById('mbti_test_result');
        if (!el) return;
        el.textContent = message || '';
        el.className = 'mbti-test-result';
        if (type === 'ok') el.classList.add('mbti-ok');
        else if (type === 'err') el.classList.add('mbti-err');
        else if (type === 'mut') el.classList.add('mbti-mut');
    }

    function updateBackendVisibility() {
        const custom = isCustomBackend();
        const customEl = document.getElementById('mbti_custom_api');
        if (customEl) {
            customEl.style.display = custom ? 'flex' : 'none';
        }
        const stRadio = document.getElementById('mbti_backend_st');
        const customRadio = document.getElementById('mbti_backend_custom');
        if (stRadio) stRadio.checked = !custom;
        if (customRadio) customRadio.checked = custom;
    }

    function initializeBackendSettings() {
        // Populate radio + custom fields from saved settings
        updateBackendVisibility();

        const customApi = extension_settings.mbti_widget.customApi || {};
        const baseUrlEl = document.getElementById('mbti_custom_base_url');
        const modelEl = document.getElementById('mbti_custom_model');
        const apiKeyEl = document.getElementById('mbti_custom_api_key');
        const maxTokensEl = document.getElementById('mbti_custom_max_tokens');
        const tempEl = document.getElementById('mbti_custom_temperature');
        const contextLenEl = document.getElementById('mbti_custom_context_length');

        if (baseUrlEl) baseUrlEl.value = customApi.baseUrl || '';
        if (modelEl) modelEl.value = customApi.model || '';
        if (apiKeyEl) {
            apiKeyEl.value = localStorage.getItem(MBTI_API_KEY_STORAGE) || '';
        }
        if (maxTokensEl) maxTokensEl.value = customApi.maxTokens ?? 8192;
        if (tempEl) tempEl.value = customApi.temperature ?? 0.7;
        if (contextLenEl) contextLenEl.value = customApi.contextLength || 0;

        // --- Event handlers ---

        jQuery('input[name="mbti_backend"]').on('change', function() {
            extension_settings.mbti_widget.backend = jQuery(this).val();
            updateBackendVisibility();
            saveSettingsDebounced();
        });

        jQuery('#mbti_custom_base_url').on('change', function() {
            extension_settings.mbti_widget.customApi.baseUrl = String(jQuery(this).val()).trim();
            // Clear stale model list when base URL changes
            const dd = document.getElementById('mbti_model_dropdown');
            if (dd) { dd.innerHTML = ''; dd.classList.remove('open'); }
            const countEl = document.getElementById('mbti_model_count');
            if (countEl) countEl.textContent = '';
            saveSettingsDebounced();
        });

        jQuery('#mbti_custom_api_key').on('change', function() {
            const apiKey = String(jQuery(this).val()).trim();
            localStorage.setItem(MBTI_API_KEY_STORAGE, apiKey);
        });

        // --- Model field: change, dropdown filter, select, outside-click ---

        function closeModelDropdown() {
            const dd = document.getElementById('mbti_model_dropdown');
            if (dd) dd.classList.remove('open');
        }

        function filterModelDropdown(query) {
            const dd = document.getElementById('mbti_model_dropdown');
            if (!dd) return;
            const q = String(query).toLowerCase();
            const items = dd.querySelectorAll('.mbti-model-item');
            let visible = 0;
            items.forEach(item => {
                const match = !q || item.dataset.id.toLowerCase().includes(q);
                item.classList.toggle('hidden', !match);
                if (match) visible++;
            });
            dd.classList.toggle('open', visible > 0);
        }

        function selectModel(id, contextLength) {
            const modelInput = document.getElementById('mbti_custom_model');
            if (modelInput) modelInput.value = id;
            extension_settings.mbti_widget.customApi.model = id;
            // Auto-fill context window from provider metadata when available.
            if (contextLength && contextLength > 0) {
                extension_settings.mbti_widget.customApi.contextLength = contextLength;
                const ctxField = document.getElementById('mbti_custom_context_length');
                if (ctxField) ctxField.value = contextLength;
            }
            saveSettingsDebounced();
            closeModelDropdown();
        }

        jQuery('#mbti_custom_model').on('change', function() {
            extension_settings.mbti_widget.customApi.model = String(jQuery(this).val()).trim();
            saveSettingsDebounced();
        });

        jQuery('#mbti_custom_model').on('input', function() {
            filterModelDropdown(jQuery(this).val());
        });

        jQuery('#mbti_custom_model').on('focus', function() {
            filterModelDropdown(jQuery(this).val());
        });

        // Close dropdown when clicking outside the model field
        document.addEventListener('click', function(e) {
            const field = document.getElementById('mbti_custom_model');
            const dd = document.getElementById('mbti_model_dropdown');
            if (!field || !dd) return;
            if (e.target === field || e.target === dd || dd.contains(e.target)) return;
            closeModelDropdown();
        });

        jQuery('#mbti_custom_max_tokens').on('change', function() {
            extension_settings.mbti_widget.customApi.maxTokens = parseInt(jQuery(this).val(), 10) || 8192;
            saveSettingsDebounced();
        });

        jQuery('#mbti_custom_temperature').on('change', function() {
            extension_settings.mbti_widget.customApi.temperature = parseFloat(jQuery(this).val());
            if (isNaN(extension_settings.mbti_widget.customApi.temperature)) {
                extension_settings.mbti_widget.customApi.temperature = 0.7;
            }
            saveSettingsDebounced();
        });

        jQuery('#mbti_custom_context_length').on('change', function() {
            const val = parseInt(jQuery(this).val(), 10);
            extension_settings.mbti_widget.customApi.contextLength = isNaN(val) || val < 0 ? 0 : val;
            saveSettingsDebounced();
        });

        // Show/hide API key
        jQuery('#mbti_toggle_key').on('click', function() {
            const input = document.getElementById('mbti_custom_api_key');
            const icon = jQuery(this).find('i');
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            if (isPassword) {
                icon.removeClass('fa-eye').addClass('fa-eye-slash');
            } else {
                icon.removeClass('fa-eye-slash').addClass('fa-eye');
            }
        });

        // Fetch models → populate custom dropdown
        jQuery('#mbti_fetch_models').on('click', async function() {
            const btn = jQuery(this);
            const orig = btn.html();
            btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Fetching...');
            showTestResult('', '');
            try {
                const models = await fetchModels();
                const dd = document.getElementById('mbti_model_dropdown');
                const modelInput = document.getElementById('mbti_custom_model');
                const countEl = document.getElementById('mbti_model_count');
                if (dd) dd.innerHTML = '';
                if (models.length === 0) {
                    showTestResult('No models returned by the API.', 'err');
                    if (countEl) countEl.textContent = '';
                } else {
                    models.forEach(m => {
                        const id = typeof m === 'string' ? m : (m && m.id);
                        const ctxLen = (typeof m === 'object' && m) ? m.contextLength : 0;
                        const item = document.createElement('div');
                        item.className = 'mbti-model-item';
                        item.dataset.id = id;
                        item.textContent = id;
                        item.addEventListener('click', function() { selectModel(id, ctxLen); });
                        if (dd) dd.appendChild(item);
                    });
                    if (modelInput && !modelInput.value && models.length > 0) {
                        const first = models[0];
                        const firstId = typeof first === 'string' ? first : first.id;
                        const firstCtx = (typeof first === 'object' && first) ? first.contextLength : 0;
                        selectModel(firstId, firstCtx);
                    }
                    if (countEl) countEl.textContent = `${models.length} model${models.length === 1 ? '' : 's'} available`;
                    if (dd) dd.classList.add('open');
                    showTestResult('', '');
                }
            } catch (error) {
                showTestResult(error.message, 'err');
            } finally {
                btn.prop('disabled', false).html(orig);
            }
        });

        // Test connection
        jQuery('#mbti_test_connection').on('click', async function() {
            const btn = jQuery(this);
            const orig = btn.html();
            btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Testing...');
            showTestResult('', '');
            try {
                const result = await testCustomConnection();
                if (result.success) {
                    showTestResult(result.message, 'ok');
                    toastr?.success(result.message);
                } else {
                    showTestResult(result.message, 'err');
                    toastr?.error(result.message);
                }
            } catch (error) {
                showTestResult(error.message || 'Connection failed', 'err');
                toastr?.error(error.message || 'Connection failed');
            } finally {
                btn.prop('disabled', false).html(orig);
            }
        });
    }

    function showWidget() {
        jQuery('#mbti-widget-fab').show();
        jQuery('#mbti-widget-panel').show();
        isPanelOpen = true;
    }

    function hideWidget() {
        jQuery('#mbti-widget-fab').hide();
        jQuery('#mbti-widget-panel').hide();
        isPanelOpen = false;
    }

    if (window.SillyTavern) {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();