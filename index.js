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

    function getMessageContext(count) {
        const context = SillyTavern.getContext();
        if (!context.chat) return '';
        const messages = context.chat.messages || [];
        const recent = messages.slice(-count);
        return recent.map(m => `${m.name}: ${m.msg}`).join('\n');
    }

    function getLastUserMessage() {
        const context = SillyTavern.getContext();
        if (!context.chat) return null;
        const messages = context.chat.messages || [];
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].is_user) {
                return messages[i].msg;
            }
        }
        return null;
    }

    async function queryRating(userMessage, context) {
        const fullPrompt = `Recent context:\n${context}\n\nCharacter's action: "${userMessage}"`;
        console.log('[MBTI] queryRating - fullPrompt:', fullPrompt);
        console.log('[MBTI] queryRating - RATING_PROMPT:', RATING_PROMPT);
        try {
            const ctx = SillyTavern.getContext();
            console.log('[MBTI] queryRating - ctx.generateRaw exists:', typeof ctx.generateRaw);
            const response = await ctx.generateRaw({
                prompt: fullPrompt,
                systemPrompt: RATING_PROMPT,
            });
            console.log('[MBTI] queryRating - raw response:', response);
            return parseRatingResponse(response);
        } catch (error) {
            console.error('MBTI Widget: Rating query failed', error);
            return [];
        }
    }

    function parseRatingResponse(response) {
        const knownTags = ['shadow', 'flame', 'reason', 'heart', 'clue', 'pattern', 'anchor', 'drift'];
        try {
            const parsed = JSON.parse(response);
            if (Array.isArray(parsed.tags)) {
                return parsed.tags.filter(t => knownTags.includes(t.toLowerCase()));
            }
        } catch { }
        const lowerResponse = response.toLowerCase();
        return knownTags.filter(tag => lowerResponse.includes(tag));
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

    function saveToChatMetadata() {
        const context = SillyTavern.getContext();
        if (!context.chat) return;
        if (!context.chat.metadata) context.chat.metadata = {};
        context.chat.metadata.mbti_scores = scores;
        context.chat.metadata.mbti_trail = trail;
    }

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

        trail.push(JSON.parse(JSON.stringify(scores)));
        if (trail.length > 5) trail.shift();
        const trailEl = document.getElementById('oct-trail');
        if (trailEl) {
            trailEl.innerHTML = trail.map((s, i) => {
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

    function openArchModal() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];

        const illKey = arch.illustration || 'unknown';
        const illustrationEl = document.getElementById('arch-illustration');
        if (illustrationEl) {
            const illustrations = getIllustrations();
            illustrationEl.innerHTML = (illustrations[illKey] || illustrations['unknown']) +
                '<div class="arch-illustration-overlay"></div>' +
                '<button class="arch-close" onclick="window.MBTI_Widget.closeArchModal()">×</button>';
        }

        const bodyEl = document.getElementById('arch-body');
        if (bodyEl) {
            const traitHTML = arch.traits.map(t =>
                `<span class="arch-trait" style="color:${t.color};border-color:${t.color}40;background:${t.color}10">${t.label}</span>`
            ).join('');

            const bulletsHTML = arch.bullets.map(b => `<div class="arch-bullet">${b}</div>`).join('');
            const famousHTML = arch.famous.map(f => `<span class="arch-famous-name">${f}</span>`).join('');
            const mbtiLine = key !== 'unknown' ? `<div class="arch-mbti-badge">${arch.mbti} · MBTI Analog</div>` : '';
            const twoCol = arch.asset ? `<div class="arch-two-col"><div class="arch-col"><div class="arch-col-label is-asset">Greatest Asset</div><p>${arch.asset}</p></div><div class="arch-col"><div class="arch-col-label is-risk">Hidden Risk</div><p>${arch.risk}</p></div></div>` : '';
            const famousSection = arch.famous.length ? `<div class="arch-section-label">Known Examples</div><div class="arch-famous">${famousHTML}</div>` : '';
            const investigationSection = arch.bullets.length ? `<div class="arch-section-label">In This Investigation</div><div class="arch-bullets">${bulletsHTML}</div><div class="arch-divider"></div>${twoCol}<div class="arch-divider"></div>${famousSection}` : '';

            bodyEl.innerHTML = `${mbtiLine}<div class="arch-title" style="color:${arch.color}">${arch.name}</div><div class="arch-tagline">${arch.tagline}</div>${traitHTML ? `<div class="arch-traits">${traitHTML}</div>` : ''}${investigationSection}`;
        }

        const overlay = document.getElementById('arch-overlay');
        if (overlay) overlay.classList.add('is-open');
    }

    window.MBTI_Widget = {
        closeArchModal: function() {
            const overlay = document.getElementById('arch-overlay');
            if (overlay) overlay.classList.remove('is-open');
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
                    <button class="magnify-btn" id="magnify-btn">
                        <div class="magnify-icon"></div>
                    </button>
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
                    <div class="axis-bar-item"><div class="axis-track" id="bar-ie"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-ie-left" style="background:#94a3b8;box-shadow:0 0 6px rgba(148,163,184,0.6);width:0%"></div><div class="axis-fill-right" id="bar-ie-right" style="background:#f97316;box-shadow:0 0 6px rgba(249,115,22,0.6);width:0%"></div><div id="icon-ie" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/fire-element.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/fire-element.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-tf"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-tf-left" style="background:#60a5fa;box-shadow:0 0 6px rgba(96,165,250,0.6);width:0%"></div><div class="axis-fill-right" id="bar-tf-right" style="background:#f472b6;box-shadow:0 0 6px rgba(244,114,182,0.6);width:0%"></div><div id="icon-tf" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/like--v1.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/like--v1.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-sn"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-sn-left" style="background:#34d399;box-shadow:0 0 6px rgba(52,211,153,0.6);width:0%"></div><div class="axis-fill-right" id="bar-sn-right" style="background:#a78bfa;box-shadow:0 0 6px rgba(167,139,250,0.6);width:0%"></div><div id="icon-sn" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/idea.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/idea.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-jp"><div class="axis-center-mark"></div><div class="axis-fill-left" id="bar-jp-left" style="background:#fbbf24;box-shadow:0 0 6px rgba(251,191,36,0.6);width:0%"></div><div class="axis-fill-right" id="bar-jp-right" style="background:#94a3b8;box-shadow:0 0 6px rgba(148,163,184,0.6);width:0%"></div><div id="icon-jp" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;background-color:#94a3b8;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/wind.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/wind.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div></div>
                </div>
            </div>
            <div class="arch-overlay" id="arch-overlay">
                <div class="arch-modal" id="arch-modal">
                    <div class="arch-illustration" id="arch-illustration"></div>
                    <div class="arch-body" id="arch-body"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById('magnify-btn').addEventListener('click', openArchModal);
        document.getElementById('arch-overlay').addEventListener('click', function(e) {
            if (e.target === this) window.MBTI_Widget.closeArchModal();
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

    function getIllustrations() {
        return {
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
    }

    async function init() {
        // Get BASE_URL like EchoText does
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

        // Register settings with SillyTavern extension panel (EchoText pattern)
        try {
            const resp = await fetch(`${BASE_URL}/settings.html`);
            if (resp.ok) {
                const html = await resp.text();
                jQuery('#extensions_settings').append(html);
            }
        } catch (err) {
            console.error('MBTI Widget: Failed to load settings:', err);
        }

        // Use direct context access like EchoText
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
            
            // Use fresh context access like EchoText
            const ctx = SillyTavern.getContext();
            const settings = ctx.extension_settings?.mbti_widget;
            console.log('[MBTI] Fresh settings:', settings);
            console.log('[MBTI] enabled?:', settings?.enabled);
            console.log('[MBTI] isProcessing?:', isProcessing);
            
            if (!settings?.enabled || isProcessing) {
                console.log('[MBTI] Skipping - not enabled or processing');
                return;
            }

            const lastUserMessage = getLastUserMessage();
            console.log('[MBTI] lastUserMessage:', lastUserMessage);
            if (!lastUserMessage) return;

            const contextMsgCount = settings?.contextMessages || 5;
            console.log('[MBTI] contextMsgCount:', contextMsgCount);
            const msgContext = getMessageContext(contextMsgCount);
            console.log('[MBTI] context length:', msgContext?.length);
            if (!msgContext) return;

            isProcessing = true;
            try {
                console.log('[MBTI] Calling queryRating...');
                const ratings = await queryRating(lastUserMessage, msgContext);
                console.log('[MBTI] Ratings returned:', ratings);
                if (ratings.length > 0) {
                    ratings.forEach(tag => applyTag(tag));
                    saveToChatMetadata();
                    updatePanel();
                    console.log('[MBTI] Panel updated with ratings:', ratings);
                } else {
                    console.log('[MBTI] No ratings returned!');
                }
            } catch (error) {
                console.error('MBTI Widget: Rating error', error);
            } finally {
                isProcessing = false;
            }
        });

        extension_settings.mbti_widget = extension_settings.mbti_widget || {
            enabled: true,
            contextMessages: 5,
            autoOpenOnLoad: false,
        };

        createFab();
        createPanel();

        // Initialize toggle states from settings
        jQuery('#mbti_enabled').prop('checked', extension_settings.mbti_widget.enabled);
        jQuery('#mbti_context_messages').val(extension_settings.mbti_widget.contextMessages);
        jQuery('#mbti_context_messages_value').text(extension_settings.mbti_widget.contextMessages);

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