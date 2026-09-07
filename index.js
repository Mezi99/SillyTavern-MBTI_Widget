(function () {
    'use strict';

    const MODULE_NAME = 'MBTI_Widget';

    let extension_settings, saveSettingsDebounced;

    let scores = { ie: 0, tf: 0, sn: 0, jp: 0 };
    let trail = [];
    let isProcessing = false;
    let panelCreated = false;
    let isPanelOpen = false;
    let reasoningExpanded = false;
    let professorExpanded = false;

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

    // Quick lookup by axis name (ie/tf/sn/jp).
    const AXIS_BY_NAME = Object.fromEntries(AXIS_META.map(m => [m.axis, m]));

    const ILLUSTRATIONS = {
    unknown: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#020508"/><circle cx="290" cy="100" r="120" fill="none" stroke="rgba(212,175,55,0.06)" stroke-width="1"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="5.5s" repeatCount="indefinite"/></circle><circle cx="290" cy="100" r="80" fill="none" stroke="rgba(212,175,55,0.08)" stroke-width="1"><animate attributeName="opacity" values="0.9;0.5;0.9" dur="4.6s" begin="-1.8s" repeatCount="indefinite"/></circle><circle cx="290" cy="100" r="40" fill="none" stroke="rgba(212,175,55,0.12)" stroke-width="1"><animate attributeName="opacity" values="0.5;0.85;0.5" dur="3.9s" begin="-0.9s" repeatCount="indefinite"/></circle><g stroke="rgba(212,175,55,0.3)" stroke-width="0.6" stroke-dasharray="1 3" fill="none"><line x1="230" y1="60" x2="290" y2="50"><animate attributeName="opacity" values="0.1;0.6;0.1;0.5;0.1" dur="1.8s" repeatCount="indefinite"/></line><line x1="350" y1="55" x2="290" y2="50"><animate attributeName="opacity" values="0.5;0.1;0.4;0.1;0.5" dur="2.1s" begin="-0.6s" repeatCount="indefinite"/></line><line x1="370" y1="140" x2="290" y2="150"><animate attributeName="opacity" values="0.1;0.5;0.1;0.6;0.1" dur="1.6s" begin="-1s" repeatCount="indefinite"/></line><line x1="220" y1="145" x2="290" y2="150"><animate attributeName="opacity" values="0.4;0.1;0.5;0.1;0.4" dur="2s" begin="-1.4s" repeatCount="indefinite"/></line><line x1="230" y1="60" x2="220" y2="145"><animate attributeName="opacity" values="0.1;0.4;0.1" dur="2.4s" begin="-0.3s" repeatCount="indefinite"/></line><line x1="350" y1="55" x2="370" y2="140"><animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.2s" begin="-1.1s" repeatCount="indefinite"/></line></g><g fill="rgba(212,175,55,0.55)"><circle cx="230" cy="60" r="2"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.6s" repeatCount="indefinite"/></circle><circle cx="350" cy="55" r="2"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="3.1s" begin="-1s" repeatCount="indefinite"/></circle><circle cx="370" cy="140" r="2"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="2.8s" begin="-1.6s" repeatCount="indefinite"/></circle><circle cx="220" cy="145" r="2"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="3.4s" begin="-0.5s" repeatCount="indefinite"/></circle><circle cx="290" cy="50" r="2"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.4s" begin="-1.9s" repeatCount="indefinite"/></circle><circle cx="290" cy="150" r="2"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.9s" begin="-0.8s" repeatCount="indefinite"/></circle></g><text x="290" y="115" text-anchor="middle" font-family="Cinzel,serif" font-size="56" font-weight="700" fill="rgba(212,175,55,0.08)" letter-spacing="8">????<animate attributeName="opacity" values="0.5;1;0.5" dur="4.2s" repeatCount="indefinite"/></text></svg>`,
    architect: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#020a18"/><g stroke="rgba(96,165,250,0.08)" stroke-width="0.5"><line x1="0" y1="40" x2="580" y2="40"/><line x1="0" y1="80" x2="580" y2="80"/><line x1="0" y1="120" x2="580" y2="120"/><line x1="0" y1="160" x2="580" y2="160"/><line x1="96" y1="0" x2="96" y2="200"/><line x1="192" y1="0" x2="192" y2="200"/><line x1="290" y1="0" x2="290" y2="200"/><line x1="388" y1="0" x2="388" y2="200"/><line x1="484" y1="0" x2="484" y2="200"/></g><g stroke="rgba(96,165,250,0.05)" stroke-width="0.5"><line x1="0" y1="0" x2="290" y2="105"/><line x1="580" y1="0" x2="290" y2="105"/><line x1="0" y1="200" x2="290" y2="105"/><line x1="580" y1="200" x2="290" y2="105"/></g><circle cx="290" cy="105" r="95" fill="none" stroke="rgba(96,165,250,0.12)" stroke-width="0.75" stroke-dasharray="2 5"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="5.5s" repeatCount="indefinite"/></circle><g fill="rgba(96,165,250,0.55)"><circle cx="50" cy="150" r="1.3"><animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.6s" repeatCount="indefinite"/></circle><circle cx="520" cy="40" r="1.4"><animate attributeName="opacity" values="0.8;0.25;0.8" dur="4.1s" begin="-1.2s" repeatCount="indefinite"/></circle><circle cx="70" cy="55" r="1.2"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="4.6s" begin="-0.5s" repeatCount="indefinite"/></circle><circle cx="500" cy="170" r="1.5"><animate attributeName="opacity" values="0.75;0.3;0.75" dur="3.9s" begin="-2s" repeatCount="indefinite"/></circle><circle cx="430" cy="45" r="1.2"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.3s" begin="-1.6s" repeatCount="indefinite"/></circle></g><g stroke="rgba(96,165,250,0.3)" stroke-width="0.6" stroke-dasharray="1 3" fill="none"><line x1="110" y1="70" x2="220" y2="95"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.2s" repeatCount="indefinite"/></line><line x1="470" y1="140" x2="365" y2="115"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.8s" begin="-1.5s" repeatCount="indefinite"/></line></g><circle cx="110" cy="70" r="3" fill="none" stroke="rgba(96,165,250,0.5)" stroke-width="1"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.4s" repeatCount="indefinite"/></circle><circle cx="470" cy="140" r="3" fill="none" stroke="rgba(96,165,250,0.5)" stroke-width="1"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="3.9s" begin="-2s" repeatCount="indefinite"/></circle><path d="M290,30 A100,100 0 0,1 388,110" fill="none" stroke="rgba(96,165,250,0.18)" stroke-width="0.75" stroke-dasharray="2 4"/><polygon points="290,32 400,95 400,150 290,178 180,150 180,95" fill="rgba(96,165,250,0.04)" stroke="none"/><g fill="none" stroke="rgba(96,165,250,0.45)"><polygon points="290,32 400,95 400,150 290,178 180,150 180,95" stroke-width="1.2"/><line x1="290" y1="32" x2="290" y2="105" stroke-width="1.2"><animate attributeName="opacity" values="0.35;0.9;0.35" dur="3.4s" repeatCount="indefinite"/></line><line x1="180" y1="95" x2="290" y2="105" stroke-width="1.2"><animate attributeName="opacity" values="0.9;0.35;0.9" dur="4.1s" repeatCount="indefinite"/></line><line x1="400" y1="95" x2="290" y2="105" stroke-width="1.2"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.7s" begin="-0.6s" repeatCount="indefinite"/></line><line x1="180" y1="150" x2="290" y2="105" stroke-width="1.2"><animate attributeName="opacity" values="0.35;0.75;0.35" dur="3.9s" begin="-1.2s" repeatCount="indefinite"/></line><line x1="400" y1="150" x2="290" y2="105" stroke-width="1.2"><animate attributeName="opacity" values="0.9;0.5;0.9" dur="3.1s" begin="-0.3s" repeatCount="indefinite"/></line><line x1="290" y1="178" x2="290" y2="105" stroke-width="1.2"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="4.6s" begin="-2.1s" repeatCount="indefinite"/></line></g><circle cx="290" cy="105" r="4.5" fill="#60a5fa"><animate attributeName="r" values="4;6;4" dur="3.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;1;0.8" dur="3.2s" repeatCount="indefinite"/></circle><circle cx="290" cy="105" r="9" fill="none" stroke="rgba(96,165,250,0.35)" stroke-width="0.75"/></svg>`,
    witness: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#060310"/><circle cx="290" cy="100" r="95" fill="none" stroke="rgba(167,139,250,0.08)" stroke-width="0.75" stroke-dasharray="2 5"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="6s" repeatCount="indefinite"/></circle><g fill="rgba(230,210,255,0.6)"><circle cx="60" cy="35" r="1.3"><animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.7s" repeatCount="indefinite"/></circle><circle cx="520" cy="45" r="1.4"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="4.3s" begin="-1.4s" repeatCount="indefinite"/></circle><circle cx="70" cy="165" r="1.2"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="4.1s" begin="-0.7s" repeatCount="indefinite"/></circle><circle cx="510" cy="160" r="1.5"><animate attributeName="opacity" values="0.75;0.25;0.75" dur="4.7s" begin="-2.1s" repeatCount="indefinite"/></circle></g><g stroke="rgba(167,139,250,0.5)" fill="none" stroke-width="0.75"><line x1="335" y1="100" x2="380" y2="100"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.3s" repeatCount="indefinite"/></line><line x1="321.8" y1="115.9" x2="353.6" y2="131.8"><animate attributeName="opacity" values="0.6;0.2;0.6" dur="4s" begin="-1s" repeatCount="indefinite"/></line><line x1="290" y1="122.5" x2="290" y2="145"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.8s" begin="-0.4s" repeatCount="indefinite"/></line><line x1="258.2" y1="115.9" x2="226.4" y2="131.8"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="3.7s" begin="-1.6s" repeatCount="indefinite"/></line><line x1="245" y1="100" x2="200" y2="100"><animate attributeName="opacity" values="0.2;0.65;0.2" dur="4.4s" begin="-2.2s" repeatCount="indefinite"/></line><line x1="258.2" y1="84.1" x2="226.4" y2="68.2"><animate attributeName="opacity" values="0.65;0.25;0.65" dur="3.1s" begin="-0.8s" repeatCount="indefinite"/></line><line x1="290" y1="77.5" x2="290" y2="55"><animate attributeName="opacity" values="0.25;0.7;0.25" dur="3.9s" begin="-1.3s" repeatCount="indefinite"/></line><line x1="321.8" y1="84.1" x2="353.6" y2="68.2"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.6s" begin="-2.7s" repeatCount="indefinite"/></line></g><ellipse cx="290" cy="100" rx="160" ry="80" fill="none" stroke="rgba(167,139,250,0.1)" stroke-width="1"><animate attributeName="opacity" values="0.6;1;0.6" dur="5.2s" repeatCount="indefinite"/></ellipse><ellipse cx="290" cy="100" rx="100" ry="50" fill="none" stroke="rgba(167,139,250,0.14)" stroke-width="1"><animate attributeName="opacity" values="1;0.55;1" dur="4.3s" begin="-1.5s" repeatCount="indefinite"/></ellipse><ellipse cx="290" cy="100" rx="40" ry="20" fill="rgba(167,139,250,0.06)" stroke="rgba(167,139,250,0.25)" stroke-width="1"><animate attributeName="opacity" values="0.7;1;0.7" dur="3.6s" begin="-0.7s" repeatCount="indefinite"/></ellipse><circle cx="290" cy="100" r="8" fill="rgba(167,139,250,0.7)"><animate attributeName="r" values="7;9.5;7" dur="3.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0.9;0.6" dur="3.6s" repeatCount="indefinite"/></circle></svg>`,
    examiner: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#021008"/><g stroke="rgba(52,211,153,0.18)" stroke-width="0.5"><line x1="140" y1="50" x2="140" y2="56"/><line x1="180" y1="50" x2="180" y2="56"/><line x1="220" y1="50" x2="220" y2="56"/><line x1="260" y1="50" x2="260" y2="56"/><line x1="340" y1="50" x2="340" y2="56"/><line x1="380" y1="50" x2="380" y2="56"/><line x1="420" y1="50" x2="420" y2="56"/><line x1="140" y1="144" x2="140" y2="150"/><line x1="180" y1="144" x2="180" y2="150"/><line x1="220" y1="144" x2="220" y2="150"/><line x1="260" y1="144" x2="260" y2="150"/><line x1="340" y1="144" x2="340" y2="150"/><line x1="380" y1="144" x2="380" y2="150"/><line x1="420" y1="144" x2="420" y2="150"/><line x1="300" y1="50" x2="300" y2="56"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.6s" repeatCount="indefinite"/></line></g><g fill="rgba(52,211,153,0.35)"><circle cx="160" cy="70" r="1"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="4s" repeatCount="indefinite"/></circle><circle cx="220" cy="130" r="1"><animate attributeName="opacity" values="0.6;0.2;0.6" dur="3.6s" begin="-1s" repeatCount="indefinite"/></circle><circle cx="360" cy="70" r="1"><animate attributeName="opacity" values="0.3;0.6;0.3" dur="4.4s" begin="-0.5s" repeatCount="indefinite"/></circle><circle cx="420" cy="130" r="1"><animate attributeName="opacity" values="0.6;0.25;0.6" dur="3.9s" begin="-1.8s" repeatCount="indefinite"/></circle></g><rect x="130" y="65" width="320" height="70" fill="none" stroke="rgba(52,211,153,0.15)" stroke-width="0.75" stroke-dasharray="2 4"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="5s" repeatCount="indefinite"/></rect><line x1="100" y1="100" x2="480" y2="100" stroke="rgba(52,211,153,0.22)" stroke-width="1" stroke-dasharray="3 4"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="4.2s" repeatCount="indefinite"/></line><g fill="none" stroke="rgba(52,211,153,0.5)" stroke-width="1.3"><path d="M100,72 L100,50 L122,50"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.1s" repeatCount="indefinite"/></path><path d="M458,50 L480,50 L480,72"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="3.8s" begin="-1.2s" repeatCount="indefinite"/></path><path d="M100,128 L100,150 L122,150"><animate attributeName="opacity" values="0.5;0.85;0.5" dur="4.4s" begin="-0.6s" repeatCount="indefinite"/></path><path d="M458,150 L480,150 L480,128"><animate attributeName="opacity" values="0.85;0.45;0.85" dur="3.4s" begin="-2s" repeatCount="indefinite"/></path></g><path d="M495,35 L503,43 L517,25" fill="none" stroke="rgba(52,211,153,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.8s" repeatCount="indefinite"/></path><circle cx="505" cy="30" r="14" fill="none" stroke="rgba(52,211,153,0.2)" stroke-width="0.75" stroke-dasharray="1 3"/><g stroke="rgba(52,211,153,0.6)" stroke-width="1"><line x1="278" y1="100" x2="302" y2="100"/><line x1="290" y1="88" x2="290" y2="112"/></g><circle cx="290" cy="100" r="11" fill="rgba(52,211,153,0.05)" stroke="rgba(52,211,153,0.55)" stroke-width="1"><animate attributeName="r" values="10;12.5;10" dur="3.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;1;0.6" dur="3.6s" repeatCount="indefinite"/></circle></svg>`,
    keeper: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><path d="M290,15 C245,15 200,45 200,95 C200,145 245,190 290,206 C335,190 380,145 380,95 C380,45 335,15 290,15 Z" fill="none" stroke="rgba(244,114,182,0.08)" stroke-width="0.75"><animate attributeName="opacity" values="0.35;0.7;0.35" dur="6.2s" repeatCount="indefinite"/></path><path d="M290,35 C255,35 220,58 220,98 C220,138 255,175 290,188 C325,175 360,138 360,98 C360,58 325,35 290,35 Z" fill="none" stroke="rgba(244,114,182,0.14)" stroke-width="1"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="5s" repeatCount="indefinite"/></path><path d="M150,60 Q118,100 150,150" fill="none" stroke="rgba(244,114,182,0.2)" stroke-width="1"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.5s" begin="-1s" repeatCount="indefinite"/></path><path d="M430,60 Q462,100 430,150" fill="none" stroke="rgba(244,114,182,0.2)" stroke-width="1"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.9s" begin="-2.2s" repeatCount="indefinite"/></path><g fill="rgba(244,114,182,0.5)"><circle cx="130" cy="45" r="1.3"><animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.8s" repeatCount="indefinite"/></circle><circle cx="450" cy="50" r="1.4"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="4.3s" begin="-1.3s" repeatCount="indefinite"/></circle><circle cx="120" cy="155" r="1.2"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="4.1s" begin="-0.6s" repeatCount="indefinite"/></circle><circle cx="460" cy="160" r="1.5"><animate attributeName="opacity" values="0.75;0.3;0.75" dur="4.6s" begin="-2s" repeatCount="indefinite"/></circle><circle cx="290" cy="20" r="1.2"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="3.6s" begin="-1.7s" repeatCount="indefinite"/></circle></g><path d="M290,50 C260,50 230,70 230,100 C230,130 260,160 290,170 C320,160 350,130 350,100 C350,70 320,50 290,50 Z" fill="rgba(244,114,182,0.07)" stroke="rgba(244,114,182,0.35)" stroke-width="1.3"><animate attributeName="opacity" values="0.7;1;0.7" dur="3.8s" begin="-1s" repeatCount="indefinite"/></path><g fill="rgba(244,114,182,0.55)"><circle cx="290" cy="50" r="2.3"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.2s" repeatCount="indefinite"/></circle><circle cx="230" cy="100" r="2.3"><animate attributeName="opacity" values="0.8;0.35;0.8" dur="4.1s" begin="-1.4s" repeatCount="indefinite"/></circle><circle cx="350" cy="100" r="2.3"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="3.6s" begin="-0.5s" repeatCount="indefinite"/></circle><circle cx="290" cy="170" r="2.3"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.6s" begin="-2.2s" repeatCount="indefinite"/></circle></g><circle cx="290" cy="100" r="8" fill="rgba(244,114,182,0.6)"><animate attributeName="r" values="7;9.5;7" dur="3.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.65;1;0.65" dur="3.4s" repeatCount="indefinite"/></circle></svg>`,
    theorist: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#040210"/><circle cx="290" cy="100" r="110" fill="none" stroke="rgba(167,139,250,0.08)" stroke-width="0.75" stroke-dasharray="2 5"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="6.4s" repeatCount="indefinite"/></circle><g fill="rgba(167,139,250,0.5)"><circle cx="70" cy="40" r="1.3"><animate attributeName="opacity" values="0.2;0.75;0.2" dur="3.9s" repeatCount="indefinite"/></circle><circle cx="510" cy="45" r="1.4"><animate attributeName="opacity" values="0.75;0.3;0.75" dur="4.4s" begin="-1.5s" repeatCount="indefinite"/></circle><circle cx="60" cy="160" r="1.2"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.2s" begin="-0.7s" repeatCount="indefinite"/></circle><circle cx="520" cy="155" r="1.5"><animate attributeName="opacity" values="0.7;0.25;0.7" dur="4.7s" begin="-2.1s" repeatCount="indefinite"/></circle></g><g stroke="rgba(167,139,250,0.12)" stroke-width="0.5" stroke-dasharray="1 3" fill="none"><line x1="200" y1="100" x2="380" y2="100"><animate attributeName="opacity" values="0.3;0.6;0.3" dur="4.8s" begin="-1s" repeatCount="indefinite"/></line><line x1="290" y1="70" x2="290" y2="130"><animate attributeName="opacity" values="0.6;0.3;0.6" dur="5.2s" begin="-2.4s" repeatCount="indefinite"/></line></g><g stroke="rgba(167,139,250,0.3)" stroke-width="0.6" stroke-dasharray="1 3" fill="none"><line x1="130" y1="60" x2="200" y2="100"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.3s" repeatCount="indefinite"/></line><line x1="450" y1="140" x2="380" y2="100"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.9s" begin="-1.8s" repeatCount="indefinite"/></line></g><circle cx="130" cy="60" r="8" fill="none" stroke="rgba(167,139,250,0.35)" stroke-width="0.75" stroke-dasharray="1 3"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="3.7s" repeatCount="indefinite"/></circle><circle cx="450" cy="140" r="8" fill="none" stroke="rgba(167,139,250,0.35)" stroke-width="0.75" stroke-dasharray="1 3"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.2s" begin="-2s" repeatCount="indefinite"/></circle><g stroke="rgba(167,139,250,0.15)" stroke-width="0.6" stroke-dasharray="2 4" fill="none"><line x1="200" y1="100" x2="290" y2="70"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="3.9s" repeatCount="indefinite"/></line><line x1="290" y1="70" x2="380" y2="100"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.4s" begin="-1s" repeatCount="indefinite"/></line><line x1="380" y1="100" x2="290" y2="130"><animate attributeName="opacity" values="0.3;0.6;0.3" dur="3.5s" begin="-2s" repeatCount="indefinite"/></line><line x1="290" y1="130" x2="200" y2="100"><animate attributeName="opacity" values="0.6;0.25;0.6" dur="4.1s" begin="-0.6s" repeatCount="indefinite"/></line></g><g fill="none" stroke="rgba(167,139,250,0.2)" stroke-width="1"><circle cx="200" cy="100" r="30"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.7s" repeatCount="indefinite"/></circle><circle cx="290" cy="70" r="30"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="4.3s" begin="-1.5s" repeatCount="indefinite"/></circle><circle cx="380" cy="100" r="30"><animate attributeName="opacity" values="0.45;0.85;0.45" dur="3.1s" begin="-0.4s" repeatCount="indefinite"/></circle><circle cx="290" cy="130" r="30"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.6s" begin="-2.3s" repeatCount="indefinite"/></circle></g><circle cx="290" cy="100" r="6" fill="rgba(167,139,250,0.3)" stroke="rgba(167,139,250,0.4)" stroke-width="1"><animate attributeName="r" values="5;7.5;5" dur="3.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;1;0.6" dur="3.4s" repeatCount="indefinite"/></circle></svg>`,
    dreamer: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#06020e"/><g fill="rgba(230,210,255,0.7)"><circle cx="90" cy="40" r="1.4"><animate attributeName="opacity" values="0.2;0.9;0.2" dur="3.4s" repeatCount="indefinite"/></circle><circle cx="150" cy="25" r="1.2"><animate attributeName="opacity" values="0.8;0.25;0.8" dur="4.2s" begin="-1s" repeatCount="indefinite"/></circle><circle cx="230" cy="55" r="1.6"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.8s" begin="-2s" repeatCount="indefinite"/></circle><circle cx="340" cy="30" r="1.3"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="4.6s" begin="-0.5s" repeatCount="indefinite"/></circle><circle cx="60" cy="120" r="1.3"><animate attributeName="opacity" values="0.25;0.8;0.25" dur="3.6s" begin="-1.6s" repeatCount="indefinite"/></circle><circle cx="380" cy="160" r="1.5"><animate attributeName="opacity" values="0.85;0.3;0.85" dur="4s" begin="-2.4s" repeatCount="indefinite"/></circle><circle cx="500" cy="150" r="1.4"><animate attributeName="opacity" values="0.3;0.85;0.3" dur="3.9s" begin="-0.8s" repeatCount="indefinite"/></circle><circle cx="505" cy="20" r="1.2"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="4.4s" begin="-1.9s" repeatCount="indefinite"/></circle></g><g stroke="rgba(230,210,255,0.15)" stroke-width="0.5" stroke-dasharray="1 3" fill="none"><line x1="90" y1="40" x2="150" y2="25"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="5s" repeatCount="indefinite"/></line><line x1="150" y1="25" x2="230" y2="55"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.5s" begin="-1.2s" repeatCount="indefinite"/></line><line x1="230" y1="55" x2="340" y2="30"><animate attributeName="opacity" values="0.3;0.65;0.3" dur="5.4s" begin="-2.6s" repeatCount="indefinite"/></line></g><g fill="rgba(244,114,182,0.18)"><circle cx="480" cy="60" r="32"><animate attributeName="opacity" values="0.1;0.22;0.1" dur="6s" repeatCount="indefinite"/></circle><circle cx="480" cy="60" r="24" fill="rgba(244,114,182,0.28)"/><circle cx="480" cy="60" r="15" fill="rgba(244,114,182,0.5)"><animate attributeName="opacity" values="0.4;0.65;0.4" dur="4s" repeatCount="indefinite"/></circle></g><path d="M50,170 Q180,110 290,150 Q400,190 530,130" fill="none" stroke="rgba(167,139,250,0.16)" stroke-width="1"><animate attributeName="opacity" values="0.4;0.75;0.4" dur="5.2s" begin="-1.4s" repeatCount="indefinite"/></path><path d="M40,90 Q160,150 290,70 Q420,10 540,110" fill="none" stroke="rgba(244,114,182,0.16)" stroke-width="1"><animate attributeName="opacity" values="0.75;0.35;0.75" dur="4.6s" begin="-2.1s" repeatCount="indefinite"/></path><path d="M60,150 Q170,40 290,100 Q410,170 520,50" fill="none" stroke="rgba(244,114,182,0.4)" stroke-width="1.5"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="3.8s" repeatCount="indefinite"/></path><circle cx="290" cy="100" r="5" fill="rgba(255,255,255,0.15)"/><circle cx="290" cy="100" r="3" fill="rgba(244,114,182,0.85)"><animate attributeName="r" values="2.6;4;2.6" dur="3.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;1;0.7" dur="3.2s" repeatCount="indefinite"/></circle></svg>`,
    operator: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#021008"/><polygon points="380,100 335,22.1 245,22.1 200,100 245,177.9 335,177.9" fill="none" stroke="rgba(52,211,153,0.12)" stroke-width="0.75" stroke-dasharray="2 5"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="5.8s" repeatCount="indefinite"/></polygon><g fill="rgba(52,211,153,0.5)"><circle cx="255" cy="45" r="1.3"><animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="330" cy="150" r="1.2"><animate attributeName="opacity" values="0.9;0.2;0.9" dur="2.9s" begin="-1s" repeatCount="indefinite"/></circle><circle cx="360" cy="60" r="1.4"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="2.6s" begin="-0.5s" repeatCount="indefinite"/></circle><circle cx="225" cy="140" r="1.3"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="3.1s" begin="-1.6s" repeatCount="indefinite"/></circle></g><line x1="80" y1="100" x2="240" y2="100" stroke="rgba(52,211,153,0.2)" stroke-width="1"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="4.1s" repeatCount="indefinite"/></line><line x1="340" y1="100" x2="500" y2="100" stroke="rgba(52,211,153,0.2)" stroke-width="1"><animate attributeName="opacity" values="0.8;0.4;0.8" dur="3.8s" begin="-1.8s" repeatCount="indefinite"/></line><rect x="240" y="60" width="100" height="80" fill="rgba(52,211,153,0.03)" stroke="rgba(52,211,153,0.3)" stroke-width="1.5"/><g stroke="rgba(52,211,153,0.2)" stroke-width="0.75"><line x1="240" y1="60" x2="340" y2="140"><animate attributeName="opacity" values="0.3;0.6;0.3" dur="4.4s" repeatCount="indefinite"/></line><line x1="340" y1="60" x2="240" y2="140"><animate attributeName="opacity" values="0.6;0.3;0.6" dur="4.9s" begin="-2s" repeatCount="indefinite"/></line></g><circle cx="290" cy="100" r="5" fill="rgba(52,211,153,0.7)"><animate attributeName="r" values="4.5;6.5;4.5" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite"/></circle></svg>`,
    empath: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><circle cx="290" cy="100" r="70" fill="rgba(244,114,182,0.04)"/><circle cx="290" cy="100" r="50" fill="rgba(244,114,182,0.05)"/><g fill="rgba(244,114,182,0.6)"><circle cx="120" cy="50" r="1.3"><animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.8s" repeatCount="indefinite"/></circle><circle cx="460" cy="55" r="1.4"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="4.3s" begin="-1.3s" repeatCount="indefinite"/></circle><circle cx="110" cy="160" r="1.2"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="4.1s" begin="-0.6s" repeatCount="indefinite"/></circle><circle cx="470" cy="155" r="1.5"><animate attributeName="opacity" values="0.75;0.3;0.75" dur="4.6s" begin="-2s" repeatCount="indefinite"/></circle><circle cx="290" cy="25" r="1.2"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="3.6s" begin="-1.7s" repeatCount="indefinite"/></circle><circle cx="200" cy="170" r="1.3"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="4.2s" begin="-0.9s" repeatCount="indefinite"/></circle></g><g fill="rgba(244,114,182,0.18)" stroke="rgba(244,114,182,0.4)" stroke-width="1"><path d="M290,100 C280,90 278,65 290,55 C302,65 300,90 290,100 Z"><animate attributeName="opacity" values="0.5;0.95;0.5" dur="3.6s" repeatCount="indefinite"/></path><path d="M290,100 C280,90 278,65 290,55 C302,65 300,90 290,100 Z" transform="rotate(72 290 100)"><animate attributeName="opacity" values="0.95;0.5;0.95" dur="4.1s" begin="-1.4s" repeatCount="indefinite"/></path><path d="M290,100 C280,90 278,65 290,55 C302,65 300,90 290,100 Z" transform="rotate(144 290 100)"><animate attributeName="opacity" values="0.5;0.85;0.5" dur="3.4s" begin="-0.5s" repeatCount="indefinite"/></path><path d="M290,100 C280,90 278,65 290,55 C302,65 300,90 290,100 Z" transform="rotate(216 290 100)"><animate attributeName="opacity" values="0.85;0.45;0.85" dur="4.4s" begin="-2.1s" repeatCount="indefinite"/></path><path d="M290,100 C280,90 278,65 290,55 C302,65 300,90 290,100 Z" transform="rotate(288 290 100)"><animate attributeName="opacity" values="0.45;0.9;0.45" dur="3.9s" begin="-1s" repeatCount="indefinite"/></path></g><circle cx="290" cy="100" r="6" fill="rgba(244,114,182,0.75)"><animate attributeName="r" values="5;7.5;5" dur="3.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.65;1;0.65" dur="3.2s" repeatCount="indefinite"/></circle></svg>`,
    conductor: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0d0500"/><path d="M170,20 A170,170 0 0,1 410,20" fill="none" stroke="rgba(249,115,22,0.08)" stroke-width="0.75" stroke-dasharray="2 5"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="6s" repeatCount="indefinite"/></path><path d="M110,20 A180,180 0 0,1 470,20" fill="none" stroke="rgba(249,115,22,0.05)" stroke-width="0.75" stroke-dasharray="2 5" transform="translate(0,60) scale(1,0.6)"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="6.6s" begin="-2s" repeatCount="indefinite"/></path><g stroke="rgba(249,115,22,0.15)" stroke-width="1" fill="none"><line x1="290" y1="20" x2="100" y2="180"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="3.6s" repeatCount="indefinite"/></line><line x1="290" y1="20" x2="195" y2="180"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.1s" begin="-1.2s" repeatCount="indefinite"/></line><line x1="290" y1="20" x2="290" y2="180"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="3.2s" begin="-0.5s" repeatCount="indefinite"/></line><line x1="290" y1="20" x2="385" y2="180"><animate attributeName="opacity" values="0.8;0.4;0.8" dur="4.4s" begin="-2.2s" repeatCount="indefinite"/></line><line x1="290" y1="20" x2="480" y2="180"><animate attributeName="opacity" values="0.3;0.65;0.3" dur="3.9s" begin="-1.6s" repeatCount="indefinite"/></line></g><g fill="rgba(249,115,22,0.6)"><circle cx="100" cy="180" r="2.5"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.4s" repeatCount="indefinite"/></circle><circle cx="195" cy="180" r="2.5"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="3.9s" begin="-1s" repeatCount="indefinite"/></circle><circle cx="290" cy="180" r="2.5"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="3.1s" begin="-0.4s" repeatCount="indefinite"/></circle><circle cx="385" cy="180" r="2.5"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.2s" begin="-2s" repeatCount="indefinite"/></circle><circle cx="480" cy="180" r="2.5"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="3.7s" begin="-1.5s" repeatCount="indefinite"/></circle></g><g fill="rgba(249,115,22,0.5)"><circle cx="60" cy="60" r="1.2"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="4s" repeatCount="indefinite"/></circle><circle cx="520" cy="70" r="1.3"><animate attributeName="opacity" values="0.7;0.25;0.7" dur="4.5s" begin="-1.8s" repeatCount="indefinite"/></circle></g><circle cx="290" cy="20" r="10" fill="rgba(249,115,22,0.1)"/><circle cx="290" cy="20" r="6" fill="rgba(249,115,22,0.3)"/><circle cx="290" cy="20" r="3.5" fill="rgba(249,115,22,0.9)"><animate attributeName="r" values="3;4.5;3" dur="2.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.75;1;0.75" dur="2.8s" repeatCount="indefinite"/></circle></svg>`,
    anchor: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><g stroke="rgba(244,114,182,0.3)" stroke-width="0.6" stroke-dasharray="1 3" fill="none"><line x1="110" y1="50" x2="278" y2="58"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.2s" repeatCount="indefinite"/></line><line x1="470" y1="50" x2="302" y2="58"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.6s" begin="-1.5s" repeatCount="indefinite"/></line><line x1="110" y1="150" x2="270" y2="90"><animate attributeName="opacity" values="0.3;0.65;0.3" dur="4.9s" begin="-0.8s" repeatCount="indefinite"/></line><line x1="470" y1="150" x2="310" y2="90"><animate attributeName="opacity" values="0.65;0.3;0.65" dur="4.1s" begin="-2.2s" repeatCount="indefinite"/></line></g><g fill="none" stroke="rgba(244,114,182,0.5)"><circle cx="110" cy="50" r="3" stroke-width="1"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.4s" repeatCount="indefinite"/></circle><circle cx="470" cy="50" r="3" stroke-width="1"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="3.9s" begin="-1.6s" repeatCount="indefinite"/></circle><circle cx="110" cy="150" r="3" stroke-width="1"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="4.3s" begin="-0.9s" repeatCount="indefinite"/></circle><circle cx="470" cy="150" r="3" stroke-width="1"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="3.7s" begin="-2.4s" repeatCount="indefinite"/></circle></g><g fill="rgba(244,114,182,0.5)"><circle cx="200" cy="30" r="1.2"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.8s" repeatCount="indefinite"/></circle><circle cx="390" cy="35" r="1.3"><animate attributeName="opacity" values="0.7;0.25;0.7" dur="4.2s" begin="-1.3s" repeatCount="indefinite"/></circle></g><g fill="none" stroke="rgba(244,114,182,0.45)" stroke-width="1.3"><path d="M290,150 C290,175 250,180 240,160"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="4.4s" begin="-1s" repeatCount="indefinite"/></path><path d="M290,150 C290,175 330,180 340,160"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.8s" begin="-2.3s" repeatCount="indefinite"/></path><line x1="290" y1="78" x2="290" y2="150"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="3.6s" repeatCount="indefinite"/></line><line x1="263" y1="100" x2="317" y2="100"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="3.2s" begin="-1.2s" repeatCount="indefinite"/></line></g><circle cx="290" cy="60" r="18" fill="none" stroke="rgba(244,114,182,0.4)" stroke-width="1.3"><animate attributeName="opacity" values="0.55;0.9;0.55" dur="3.8s" repeatCount="indefinite"/></circle><circle cx="290" cy="60" r="5" fill="rgba(244,114,182,0.7)"><animate attributeName="r" values="4.5;6;4.5" dur="3.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;1;0.6" dur="3.4s" repeatCount="indefinite"/></circle></svg>`,
    commander: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0a0800"/><path d="M290,20 C235,20 190,42 190,85 C190,145 240,182 290,203 C340,182 390,145 390,85 C390,42 345,20 290,20 Z" fill="none" stroke="rgba(251,191,36,0.09)" stroke-width="0.75"><animate attributeName="opacity" values="0.35;0.7;0.35" dur="6.2s" repeatCount="indefinite"/></path><g fill="rgba(251,191,36,0.4)"><circle cx="80" cy="45" r="1.3"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.7s" repeatCount="indefinite"/></circle><circle cx="500" cy="55" r="1.4"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.2s" begin="-1.3s" repeatCount="indefinite"/></circle><circle cx="70" cy="155" r="1.2"><animate attributeName="opacity" values="0.3;0.65;0.3" dur="4s" begin="-0.6s" repeatCount="indefinite"/></circle><circle cx="510" cy="150" r="1.5"><animate attributeName="opacity" values="0.65;0.3;0.65" dur="4.5s" begin="-2s" repeatCount="indefinite"/></circle></g><g fill="none" stroke="rgba(251,191,36,0.3)" stroke-width="1"><path d="M250,140 Q225,120 235,90 Q245,110 262,120"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.6s" repeatCount="indefinite"/></path><path d="M330,140 Q355,120 345,90 Q335,110 318,120"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="5s" begin="-2s" repeatCount="indefinite"/></path></g><path d="M284,132 L284,52 L290,36 L296,52 L296,132 Z" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.65)" stroke-width="1.3"><animate attributeName="opacity" values="0.7;1;0.7" dur="3.6s" repeatCount="indefinite"/></path><line x1="284" y1="92" x2="296" y2="92" stroke="rgba(251,191,36,0.4)" stroke-width="0.75"/><rect x="252" y="128" width="76" height="9" rx="2" fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.6)" stroke-width="1.2"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="4s" begin="-1s" repeatCount="indefinite"/></rect><rect x="281" y="137" width="18" height="32" rx="3" fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.5)" stroke-width="1"/><circle cx="290" cy="175" r="8" fill="rgba(251,191,36,0.15)" stroke="rgba(251,191,36,0.6)" stroke-width="1.2"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="3.4s" begin="-0.5s" repeatCount="indefinite"/></circle><circle cx="290" cy="36" r="4" fill="rgba(255,240,200,0.9)"><animate attributeName="r" values="3;5.5;3" dur="2.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;1;0.7" dur="2.8s" repeatCount="indefinite"/></circle><circle cx="290" cy="36" r="9" fill="none" stroke="rgba(251,191,36,0.3)" stroke-width="0.75"/></svg>`,
    caretaker: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#020e06"/><circle cx="290" cy="95" r="100" fill="none" stroke="rgba(52,211,153,0.08)" stroke-width="0.75" stroke-dasharray="2 5"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="6s" repeatCount="indefinite"/></circle><g stroke="rgba(52,211,153,0.3)" stroke-width="0.6" stroke-dasharray="1 3" fill="none"><line x1="110" y1="60" x2="185" y2="90"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.3s" repeatCount="indefinite"/></line><line x1="470" y1="60" x2="395" y2="90"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="4.7s" begin="-1.6s" repeatCount="indefinite"/></line></g><circle cx="110" cy="60" r="10" fill="none" stroke="rgba(52,211,153,0.35)" stroke-width="0.75"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="3.6s" repeatCount="indefinite"/></circle><circle cx="470" cy="60" r="10" fill="none" stroke="rgba(52,211,153,0.35)" stroke-width="0.75"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.1s" begin="-2s" repeatCount="indefinite"/></circle><g fill="rgba(52,211,153,0.5)"><circle cx="200" cy="30" r="1.2"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.9s" repeatCount="indefinite"/></circle><circle cx="380" cy="35" r="1.3"><animate attributeName="opacity" values="0.7;0.25;0.7" dur="4.4s" begin="-1.4s" repeatCount="indefinite"/></circle></g><path d="M160,132 Q290,182 420,132" fill="none" stroke="rgba(52,211,153,0.22)" stroke-width="1.2"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="4.8s" repeatCount="indefinite"/></path><g fill="rgba(52,211,153,0.55)"><circle cx="220" cy="158" r="1.4"><animate attributeName="opacity" values="0.2;0.85;0.2" dur="3.2s" repeatCount="indefinite"/></circle><circle cx="290" cy="178" r="1.5"><animate attributeName="opacity" values="0.85;0.25;0.85" dur="3.6s" begin="-1.1s" repeatCount="indefinite"/></circle><circle cx="360" cy="158" r="1.4"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.4s" begin="-0.6s" repeatCount="indefinite"/></circle></g><path d="M224.4,94.6 Q245,80 265.6,85.4" fill="none" stroke="rgba(52,211,153,0.35)" stroke-width="1"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="3.7s" repeatCount="indefinite"/></path><path d="M314.4,85.4 Q335,80 355.6,94.6" fill="none" stroke="rgba(52,211,153,0.35)" stroke-width="1"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.1s" begin="-1.8s" repeatCount="indefinite"/></path><g fill="none" stroke="rgba(52,211,153,0.2)" stroke-width="1"><circle cx="200" cy="100" r="25"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="3.8s" repeatCount="indefinite"/></circle><circle cx="290" cy="80" r="25"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="4.3s" begin="-1.5s" repeatCount="indefinite"/></circle><circle cx="380" cy="100" r="25"><animate attributeName="opacity" values="0.45;0.8;0.45" dur="3.5s" begin="-0.6s" repeatCount="indefinite"/></circle></g></svg>`,
    provocateur: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#040210"/><g fill="rgba(167,139,250,0.5)"><circle cx="60" cy="50" r="1.3"><animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.6s" repeatCount="indefinite"/></circle><circle cx="520" cy="45" r="1.4"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="4.1s" begin="-1.3s" repeatCount="indefinite"/></circle><circle cx="70" cy="165" r="1.2"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="4.4s" begin="-0.6s" repeatCount="indefinite"/></circle><circle cx="510" cy="160" r="1.5"><animate attributeName="opacity" values="0.75;0.3;0.75" dur="3.9s" begin="-2s" repeatCount="indefinite"/></circle></g><g stroke="rgba(167,139,250,0.25)" stroke-width="1.5" fill="none"><line x1="290" y1="100" x2="120" y2="60"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.3s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="460" y2="60"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="3.8s" begin="-1.2s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="150" y2="150"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="4.2s" begin="-0.5s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="430" y2="150"><animate attributeName="opacity" values="0.7;0.3;0.7" dur="3.6s" begin="-2.1s" repeatCount="indefinite"/></line></g><g stroke="rgba(167,139,250,0.4)" stroke-width="1" fill="none"><path d="M205,80 L225,65 L215,90 L235,78"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="2.9s" repeatCount="indefinite"/></path><path d="M375,80 L358,68 L370,90 L352,82"><animate attributeName="opacity" values="0.7;0.2;0.7" dur="3.1s" begin="-1s" repeatCount="indefinite"/></path></g><g fill="rgba(167,139,250,0.55)"><circle cx="120" cy="60" r="3"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="3.4s" repeatCount="indefinite"/></circle><circle cx="460" cy="60" r="3"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="3.9s" begin="-1.6s" repeatCount="indefinite"/></circle><circle cx="150" cy="150" r="3"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="4.1s" begin="-0.7s" repeatCount="indefinite"/></circle><circle cx="430" cy="150" r="3"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="3.6s" begin="-2.3s" repeatCount="indefinite"/></circle></g><circle cx="290" cy="100" r="8" fill="rgba(167,139,250,0.5)"><animate attributeName="r" values="7;9.5;7" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite"/></circle></svg>`,
    catalyst: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#08020e"/><circle cx="290" cy="100" r="80" fill="none" stroke="rgba(167,139,250,0.08)" stroke-width="1"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="5.5s" repeatCount="indefinite"/></circle><circle cx="290" cy="100" r="55" fill="none" stroke="rgba(244,114,182,0.1)" stroke-width="1"><animate attributeName="opacity" values="0.8;0.4;0.8" dur="4.8s" begin="-2s" repeatCount="indefinite"/></circle><g stroke="rgba(244,114,182,0.5)" stroke-width="1.2"><line x1="290" y1="100" x2="290" y2="45"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.6s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="330" y2="60"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="3.1s" begin="-0.8s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="352" y2="100"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.4s" begin="-1.4s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="330" y2="140"><animate attributeName="opacity" values="0.9;0.5;0.9" dur="3.4s" begin="-0.4s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="290" y2="155"><animate attributeName="opacity" values="0.4;0.85;0.4" dur="2.8s" begin="-1.9s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="250" y2="140"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="3.2s" begin="-1.1s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="228" y2="100"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="2.7s" begin="-0.6s" repeatCount="indefinite"/></line><line x1="290" y1="100" x2="250" y2="60"><animate attributeName="opacity" values="0.9;0.5;0.9" dur="3.5s" begin="-2.2s" repeatCount="indefinite"/></line></g><g fill="rgba(255,220,240,0.9)"><circle cx="290" cy="45" r="1.6"><animate attributeName="opacity" values="0.3;1;0.3" dur="2.6s" repeatCount="indefinite"/></circle><circle cx="352" cy="100" r="1.6"><animate attributeName="opacity" values="1;0.3;1" dur="2.4s" begin="-1.4s" repeatCount="indefinite"/></circle><circle cx="290" cy="155" r="1.6"><animate attributeName="opacity" values="0.3;1;0.3" dur="2.8s" begin="-1.9s" repeatCount="indefinite"/></circle><circle cx="228" cy="100" r="1.6"><animate attributeName="opacity" values="1;0.3;1" dur="2.7s" begin="-0.6s" repeatCount="indefinite"/></circle></g><circle cx="290" cy="100" r="7" fill="rgba(244,114,182,0.7)"><animate attributeName="r" values="6;9;6" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite"/></circle></svg>`,
    livewire: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0d0500"/><path d="M60,110 L140,70 L180,120 L240,60 L290,110 L340,80 L380,130 L430,70 L520,110" fill="none" stroke="rgba(249,115,22,0.15)" stroke-width="1.5"><animate attributeName="opacity" values="0.4;0.7;0.4" dur="4.6s" repeatCount="indefinite"/></path><g fill="rgba(249,115,22,0.45)"><circle cx="60" cy="60" r="1.2"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.9s" repeatCount="indefinite"/></circle><circle cx="520" cy="55" r="1.3"><animate attributeName="opacity" values="0.7;0.25;0.7" dur="4.3s" begin="-1.4s" repeatCount="indefinite"/></circle></g><path d="M80,100 L160,40 L200,100 L260,30 L290,100 L340,50 L380,120 L430,60 L500,100" fill="none" stroke="rgba(249,115,22,0.4)" stroke-width="2"><animate attributeName="opacity" values="0.6;1;0.6" dur="3.2s" repeatCount="indefinite"/></path><g fill="rgba(255,200,140,0.9)"><circle cx="160" cy="40" r="1.8"><animate attributeName="opacity" values="0.2;1;0.2" dur="2.2s" repeatCount="indefinite"/></circle><circle cx="260" cy="30" r="1.8"><animate attributeName="opacity" values="1;0.2;1" dur="2.5s" begin="-1s" repeatCount="indefinite"/></circle><circle cx="430" cy="60" r="1.8"><animate attributeName="opacity" values="0.2;1;0.2" dur="2.3s" begin="-0.6s" repeatCount="indefinite"/></circle></g><g stroke="rgba(255,220,180,0.6)" stroke-width="1"><line x1="260" y1="30" x2="250" y2="15"><animate attributeName="opacity" values="0.3;0.9;0.3" dur="2.1s" repeatCount="indefinite"/></line><line x1="260" y1="30" x2="272" y2="16"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="2.4s" begin="-0.5s" repeatCount="indefinite"/></line></g><circle cx="290" cy="100" r="5" fill="rgba(249,115,22,0.8)"><animate attributeName="r" values="4;6.5;4" dur="2.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;1;0.7" dur="2.6s" repeatCount="indefinite"/></circle></svg>`,
    storm: `<svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="580" height="200" fill="#0d0500"/><circle cx="290" cy="100" r="95" fill="none" stroke="rgba(249,115,22,0.06)" stroke-width="0.75" stroke-dasharray="2 5"><animate attributeName="opacity" values="0.35;0.7;0.35" dur="6s" repeatCount="indefinite"/></circle><g stroke="rgba(249,115,22,0.4)" stroke-width="1" stroke-linecap="round"><line x1="90" y1="50" x2="115" y2="42"><animate attributeName="opacity" values="0.2;0.7;0.2" dur="3.4s" repeatCount="indefinite"/></line><line x1="480" y1="55" x2="505" y2="48"><animate attributeName="opacity" values="0.7;0.2;0.7" dur="3.9s" begin="-1.2s" repeatCount="indefinite"/></line><line x1="70" y1="150" x2="98" y2="158"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="4.1s" begin="-0.6s" repeatCount="indefinite"/></line><line x1="490" y1="155" x2="518" y2="162"><animate attributeName="opacity" values="0.75;0.3;0.75" dur="3.7s" begin="-2s" repeatCount="indefinite"/></line></g><g fill="none" stroke="rgba(249,115,22,0.3)" stroke-width="1.2"><path d="M290,100 Q330,60 380,80 Q415,93 405,135"><animate attributeName="opacity" values="0.3;0.75;0.3" dur="4.2s" repeatCount="indefinite"/></path><path d="M290,100 Q330,60 380,80 Q415,93 405,135" transform="rotate(120 290 100)"><animate attributeName="opacity" values="0.75;0.3;0.75" dur="4.6s" begin="-1.6s" repeatCount="indefinite"/></path><path d="M290,100 Q330,60 380,80 Q415,93 405,135" transform="rotate(240 290 100)"><animate attributeName="opacity" values="0.3;0.7;0.3" dur="3.9s" begin="-2.4s" repeatCount="indefinite"/></path></g><circle cx="290" cy="100" r="20" fill="rgba(249,115,22,0.06)" stroke="rgba(249,115,22,0.2)" stroke-width="1"><animate attributeName="opacity" values="0.4;0.7;0.4" dur="4s" repeatCount="indefinite"/></circle><circle cx="290" cy="100" r="6" fill="rgba(249,115,22,0.75)"><animate attributeName="r" values="5;7.5;5" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite"/></circle></svg>`
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

    const FUNCTION_NAMES = {
        Ne: 'Extraverted Intuition', Ni: 'Introverted Intuition',
        Te: 'Extraverted Thinking', Ti: 'Introverted Thinking',
        Fe: 'Extraverted Feeling', Fi: 'Introverted Feeling',
        Se: 'Extraverted Sensing', Si: 'Introverted Sensing'
    };

    const ROLE_PRIORITY = { Dominant: 0, Auxiliary: 1, Tertiary: 2, Inferior: 3 };
    const ROLE_DOTS = { Dominant: 4, Auxiliary: 3, Tertiary: 2, Inferior: 1 };

    const COGNITIVE_STACKS = {
        INTJ: ['Ni', 'Te', 'Fi', 'Se'], INFJ: ['Ni', 'Fe', 'Ti', 'Se'],
        ISTJ: ['Si', 'Te', 'Fi', 'Ne'], ISFJ: ['Si', 'Fe', 'Ti', 'Ne'],
        INTP: ['Ti', 'Ne', 'Si', 'Fe'], INFP: ['Fi', 'Ne', 'Si', 'Te'],
        ISTP: ['Ti', 'Se', 'Ni', 'Fe'], ISFP: ['Fi', 'Se', 'Ni', 'Te'],
        ENTJ: ['Te', 'Ni', 'Se', 'Fi'], ENFJ: ['Fe', 'Ni', 'Se', 'Ti'],
        ESTJ: ['Te', 'Si', 'Ne', 'Fi'], ESFJ: ['Fe', 'Si', 'Ne', 'Ti'],
        ENTP: ['Ne', 'Ti', 'Fe', 'Si'], ENFP: ['Ne', 'Fi', 'Te', 'Si'],
        ESTP: ['Se', 'Ti', 'Fe', 'Ni'], ESFP: ['Se', 'Fi', 'Te', 'Ni']
    };

    // Tabbed wiki encyclopedia ("magnify" modal) content, keyed by MBTI code.
    // Data-driven replacement for the old per-archetype HTML panes: one
    // renderer (`renderWikiPanes`) builds the Overview / Mind / Pressure /
    // Growth / Fiction tabs from this JSON, so all 16 archetypes share one
    // code path. The identity header (badge, title, tagline, traits grid) and
    // the animated illustration come from ARCHETYPES + ILLUSTRATIONS, not this
    // map. A key with no entry still falls back to the simple scroll card.
    const WIKI_CONTENT = {
    "INTJ": {
        "bullets": [
            "You see patterns and long-range consequences before anyone else in the room does.",
            "You'd rather work out the answer yourself than accept it secondhand.",
            "You revise your opinion the moment better evidence shows up — but not a moment before.",
            "You measure people by competence first; charm doesn't move the needle much."
        ],
        "asset": "Strategic Vision",
        "risk": "Arrogance",
        "secondaryAsset": "Independent Judgment",
        "secondaryRisk": "Dismissiveness of Emotion",
        "mind": {
            "Ni": {
                "role": "Dominant",
                "desc": "Recognizes long-range patterns and converges on a single, confident interpretation of where things are headed.",
                "example": "You'll sense how a plan ends before the first step is even taken — and rarely bother explaining how you got there."
            },
            "Te": {
                "role": "Auxiliary",
                "desc": "Turns that inner vision into workable systems — efficient, provable, and built to get results.",
                "example": "You'll happily overhaul a process nobody asked you to touch, because the inefficiency was bothering you more than the awkwardness of pointing it out."
            },
            "Fi": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary sense of personal values — genuine, but not yet fully trusted or easy to voice.",
                "example": "You know exactly what you believe is right, even when you can't fully explain why it matters to you and don't especially want to try."
            },
            "Se": {
                "role": "Inferior",
                "desc": "Awareness of the immediate physical world and present-moment sensation — the function you lean on least.",
                "example": "You can walk past a room full of detail and notice none of it, because your attention is already three steps down the road."
            }
        },
        "pressure": {
            "trigger": "Dealing with a flood of unfamiliar details, or an unexpected disruption to a plan you'd already worked out in your head.",
            "looksLike": "Uncharacteristic impulsiveness — obsessing over minor details, overindulging in sensory pleasures, or making decisions with none of your usual deliberation.",
            "happening": "Your dominant Ni has run out of road and can't resolve what's happening, so instead of leaning on your trusted auxiliary Te, your psyche drops straight to inferior Se — pulling you into raw, present-moment sensation and impulsive action you'd normally never allow yourself.",
            "recover": "Naming it as your long-range vision running dry, not a personal failure — then deliberately giving yourself quiet, low-stimulation time instead of trying to out-plan your way through it."
        },
        "growth": {
            "blindspot": "Mistaking confidence in your own analysis for certainty — and treating disagreement as evidence the other person hasn't thought hard enough.",
            "leastMature": "\"Dismisses feelings — yours and everyone else's — as noise that gets in the way of the right answer.\"",
            "best": "\"Builds deliberate checkpoints into your own thinking, and actively invites the evidence that might prove you wrong.\"",
            "habit": "Before locking in a conclusion, ask: \"what evidence would change my mind — and have I actually gone looking for it?\""
        },
        "fiction": [
            {
                "name": "Hannibal Lecter",
                "blurb": "The Silence of the Lambs — the type's cold analytical brilliance stripped of any ethical anchor: total confidence in his own judgment, total indifference to anyone else's suffering.",
                "tone": "shadow"
            },
            {
                "name": "Matilda Wormwood",
                "blurb": "Matilda — a healthy expression of the type from an early age: patient, self-taught, and quietly certain of her own read on the world long before anyone else takes her seriously.",
                "tone": "mature"
            },
            {
                "name": "Severus Snape",
                "blurb": "Harry Potter — brilliant and self-possessed, but so consumed by old convictions and private grievance that his judgment curdles into a bitterness he never lets anyone see the reasoning behind.",
                "tone": "caution"
            }
        ]
    },
    "INFJ": {
        "bullets": [
            "You read what someone actually means before they've finished the sentence.",
            "You'll quietly absorb a room's tension for hours before anyone realizes you noticed it at all.",
            "You'd rather stay quiet than say something you don't fully believe, even if lying would be easier.",
            "You need what you're doing to matter — busywork drains you faster than almost anything else."
        ],
        "asset": "Insightfulness",
        "risk": "Burnout",
        "secondaryAsset": "Principled Idealism",
        "secondaryRisk": "Sensitivity to Criticism",
        "mind": {
            "Ni": {
                "role": "Dominant",
                "desc": "Converges on a single deep insight about people or situations, usually well before you can explain how you got there.",
                "example": "You'll say \"something's off with him\" weeks before anyone else notices — and you're usually right."
            },
            "Fe": {
                "role": "Auxiliary",
                "desc": "Tunes into the emotional undercurrent of a room and adjusts to keep the peace.",
                "example": "You can feel the exact moment a conversation shifts from fine to not-fine, often before either person involved has clocked it."
            },
            "Ti": {
                "role": "Tertiary",
                "desc": "A private, tertiary logic you use to quietly test whether your insights actually hold up.",
                "example": "You'll sit with a conclusion for days, picking it apart on your own before you ever say it out loud."
            },
            "Se": {
                "role": "Inferior",
                "desc": "Immediate physical sensation and present-moment action — the function you trust least.",
                "example": "You can walk through the same room every day for years and still not be able to describe what's in it."
            }
        },
        "pressure": {
            "trigger": "Chronic, unresolved stress — often relational — that outlasts your ability to think or feel your way through it.",
            "looksLike": "Suddenly out-of-character impulsiveness: reckless decisions, indulgent binges, or a complete loss of your usual long-range focus and empathy.",
            "happening": "Your Ni-Fe combination has run out of ways to make sense of the situation, so it collapses all the way down to inferior Se — flooding you with present-moment sensation and pulling you toward whatever offers the most immediate relief, consequences be damned.",
            "recover": "Physically grounding yourself in something simple and sensory on purpose — a walk, a meal, sleep — rather than trying to think your way back out, since thinking is exactly what's exhausted."
        },
        "growth": {
            "blindspot": "Assuming your read on someone's motives is correct simply because it feels certain — and treating that certainty as proof.",
            "leastMature": "\"Withdraws into a private moral high ground, convinced no one else really understands what's at stake.\"",
            "best": "\"Holds the same depth of conviction, but stays checkable — willing to say the insight out loud and let it be questioned.\"",
            "habit": "Before acting on a strong read of someone, ask out loud: \"what would change my mind about this?\""
        },
        "fiction": [
            {
                "name": "Loki",
                "blurb": "Marvel — the quintessential unhealthy INFJ: a private, long-held vision of how things should be, executed through manipulation of exactly the people closest to him.",
                "tone": "shadow"
            },
            {
                "name": "Atticus Finch",
                "blurb": "To Kill a Mockingbird — principled without being preachy, quietly certain of his own values, and unmoved by a crowd that violently disagrees with him.",
                "tone": "mature"
            },
            {
                "name": "Gellert Grindelwald",
                "blurb": "Harry Potter — conviction curdled into justification: he believes everything he does is for a greater good, which is exactly what lets him excuse the harm.",
                "tone": "caution"
            }
        ]
    },
    "ISTJ": {
        "bullets": [
            "You say exactly what you mean, even when a softer version would land easier.",
            "Once you've committed to something, you follow through — full stop, no matter how you feel about it that day.",
            "You're the calm one when everyone else is panicking, because panic has never once solved anything.",
            "You trust what's actually been tested over what merely sounds promising."
        ],
        "asset": "Reliability",
        "risk": "Inflexibility",
        "secondaryAsset": "Unwavering Honesty",
        "secondaryRisk": "Bluntness",
        "mind": {
            "Si": {
                "role": "Dominant",
                "desc": "Draws on a detailed internal library of past experience to judge what's reliable and what isn't.",
                "example": "You remember exactly how a similar plan failed three years ago, and you're not interested in repeating it to be polite."
            },
            "Te": {
                "role": "Auxiliary",
                "desc": "Turns that internal precedent into efficient, external action — organizing, executing, enforcing.",
                "example": "You'll rewrite a broken process on your first day at a new job, because watching it stay broken bothers you more than the awkwardness of speaking up."
            },
            "Fi": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary sense of personal values that surfaces as an unshakeable inner compass, even if you rarely explain it.",
                "example": "You'll break from procedure exactly once, when it crosses a line you privately won't move on — and won't necessarily say why."
            },
            "Ne": {
                "role": "Inferior",
                "desc": "Open-ended possibility and \"what if\" thinking — the function you trust least and lean on hardly at all.",
                "example": "Brainstorming ten wild options for a problem feels less like creativity and more like a waste of time you could've spent solving it."
            }
        },
        "pressure": {
            "trigger": "A crisis or sudden disruption that makes your usual reliance on precedent and routine feel useless.",
            "looksLike": "Uncharacteristic catastrophizing — spiraling through worst-case scenarios on topics you'd normally handle with total calm.",
            "happening": "Your trusted Si-Te approach has nothing solid left to draw on, so control passes to your least-developed function, inferior Ne, which floods you with worst-case possibilities faster than you can rule any of them out.",
            "recover": "Saying the catastrophic scenario out loud to someone who'll take it seriously without dismissing it as \"not like you\" — reality-testing it with another person breaks the spiral faster than trying to reason your way out alone."
        },
        "growth": {
            "blindspot": "Treating \"this is how it's always been done\" as equivalent to \"this is correct\" — and resisting good ideas simply because they're unfamiliar.",
            "leastMature": "\"Refuses to budge on a rule even after privately admitting it no longer serves its purpose.\"",
            "best": "\"Holds standards firmly, but revisits them the moment the facts genuinely change — because facts, not habit, were always the actual point.\"",
            "habit": "Before rejecting a new approach, ask: \"am I resisting this because it's actually wrong, or just because it's unfamiliar?\""
        },
        "fiction": [
            {
                "name": "Darth Vader",
                "blurb": "Star Wars — duty and order taken to their coldest extreme: unwavering commitment to a system, total loyalty to a chain of command, with no room left to question whether that command deserves it.",
                "tone": "shadow"
            },
            {
                "name": "Optimus Prime",
                "blurb": "Transformers — dependable to the core, unwavering in his sense of duty, and entirely defined by protecting the people under his care.",
                "tone": "mature"
            },
            {
                "name": "Inspector Lestrade",
                "blurb": "Sherlock Holmes — fundamentally decent, but so wedded to procedure that his by-the-book instincts routinely put him at odds with the very case he's trying to solve.",
                "tone": "caution"
            }
        ]
    },
    "ISFJ": {
        "bullets": [
            "You notice the small thing someone needs before they've said a word about it.",
            "You'll go well beyond what's asked of you, and rarely mention that you did.",
            "You'd rather absorb the discomfort yourself than start a conflict over it.",
            "You remember details about people's lives that they're surprised you even caught."
        ],
        "asset": "Loyal Support",
        "risk": "Self-Sacrifice",
        "secondaryAsset": "Practical Generosity",
        "secondaryRisk": "Conflict Avoidance",
        "mind": {
            "Si": {
                "role": "Dominant",
                "desc": "Builds a detailed internal library of lived experience and compares the present moment against it.",
                "example": "You remember exactly how someone takes their coffee, or what upset them last time, long after they've forgotten telling you."
            },
            "Fe": {
                "role": "Auxiliary",
                "desc": "Reads the emotional atmosphere of a room and moves to keep everyone comfortable and cared for.",
                "example": "You'll quietly rearrange your own plans the moment you sense someone nearby actually needs you."
            },
            "Ti": {
                "role": "Tertiary",
                "desc": "A private, tertiary logic that helps you make sense of people's behavior without taking it personally.",
                "example": "You'll work out a calm, reasoned explanation for why someone hurt you, mostly so you don't have to be angry at them."
            },
            "Ne": {
                "role": "Inferior",
                "desc": "Open-ended possibility and change — the function you trust least and find hardest to welcome.",
                "example": "A sudden change of plans doesn't feel exciting to you; it feels like the floor moving."
            }
        },
        "pressure": {
            "trigger": "Sudden, unfamiliar change that threatens the stability you've worked hard to build for the people around you.",
            "looksLike": "Uncharacteristic catastrophizing — imagining worst-case outcomes and losing your usual grounded, steady read on things.",
            "happening": "Your trusted Si-Fe approach has no precedent to draw on, so control drops to inferior Ne, flooding you with exactly the possibilities you normally never let yourself dwell on.",
            "recover": "Anchoring back in something small and concrete — a routine task, a familiar place — rather than trying to reason your way through every imagined outcome at once."
        },
        "growth": {
            "blindspot": "Equating your own needs with selfishness — so consistently that you stop noticing you have any.",
            "leastMature": "\"Avoids conflict at any cost, even when staying silent means quietly resenting the people you're protecting.\"",
            "best": "\"Sets a boundary as clearly and kindly as you'd want someone to set one with you.\"",
            "habit": "Once a week, name one thing you need out loud — to someone, not just to yourself."
        },
        "fiction": [
            {
                "name": "Norman Bates",
                "blurb": "Psycho — devotion and duty distorted into something inescapable: bound so tightly to responsibility and the past that it consumes him entirely.",
                "tone": "shadow"
            },
            {
                "name": "Samwise Gamgee",
                "blurb": "The Lord of the Rings — loyalty at its healthiest: steady, selfless, and never once needing recognition for carrying someone else the whole way.",
                "tone": "mature"
            },
            {
                "name": "Marge Simpson",
                "blurb": "The Simpsons — dependable to a fault: so committed to routine and keeping everyone comfortable that stepping outside her comfort zone, even briefly, feels like a small crisis.",
                "tone": "caution"
            }
        ]
    },
    "INTP": {
        "bullets": [
            "You'll spot the flaw in an argument nobody else noticed, then wonder why everyone's annoyed you mentioned it.",
            "You'd rather understand something completely than be the one who gets credit for it.",
            "You can get so lost in a train of thought that the conversation moves on without you.",
            "You'll change your entire opinion the moment better logic shows up — no ego involved."
        ],
        "asset": "Analytical Thinking",
        "risk": "Indecisiveness",
        "secondaryAsset": "Open-Mindedness",
        "secondaryRisk": "Emotional Insensitivity",
        "mind": {
            "Ti": {
                "role": "Dominant",
                "desc": "Builds precise internal logical frameworks and tests every idea against them before trusting it.",
                "example": "You'll take apart your own argument looking for the flaw before anyone else gets the chance."
            },
            "Ne": {
                "role": "Auxiliary",
                "desc": "Generates possibilities and connections other people don't see, following curiosity wherever it leads.",
                "example": "You'll go down a three-hour research rabbit hole on something that started as a passing thought."
            },
            "Si": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary awareness of past experience that occasionally roots your theorizing in what's actually worked before.",
                "example": "You'll surprise people by remembering a small procedural detail from years ago, purely because it once mattered to a system you cared about."
            },
            "Fe": {
                "role": "Inferior",
                "desc": "Awareness of others' emotions and social harmony — the function you trust and use least.",
                "example": "You can genuinely forget to ask how someone's doing, not from indifference, but because it just doesn't occur to you."
            }
        },
        "pressure": {
            "trigger": "Sustained criticism, emotional conflict, or a situation logic simply can't resolve.",
            "looksLike": "Uncharacteristic emotional flooding — becoming touchy, people-pleasing, or unexpectedly tearful over things you'd normally shrug off.",
            "happening": "Your trusted Ti-Ne approach can't out-think the problem, so control drops to inferior Fe, and you're suddenly overrun by exactly the feelings you usually keep at arm's length, with none of the skill to manage them.",
            "recover": "Retreating to solitary, low-stakes analytical work — even something trivial — to let your dominant Ti quietly reassert itself before engaging with people again."
        },
        "growth": {
            "blindspot": "Assuming that because you've thought about something carefully, you've also handled it emotionally.",
            "leastMature": "\"Dismisses feelings — including your own — as irrelevant data that only muddies a clean argument.\"",
            "best": "\"Stays just as rigorous, but treats other people's emotional reality as a fact worth taking seriously, not an inconvenience.\"",
            "habit": "Before ending a hard conversation, ask: \"have I actually addressed how this feels, or only whether it's logical?\""
        },
        "fiction": [
            {
                "name": "Victor Frankenstein",
                "blurb": "Frankenstein — brilliant curiosity pursued so single-mindedly that the human consequences of the creation never enter the equation until it's far too late.",
                "tone": "shadow"
            },
            {
                "name": "Hiccup",
                "blurb": "How to Train Your Dragon — curiosity paired with genuine courage and care: he questions everything he's been taught, and it's exactly what lets him do the right thing when it matters.",
                "tone": "mature"
            },
            {
                "name": "Elliot Alderson",
                "blurb": "Mr. Robot — brilliant and painfully isolated, so deep inside his own analysis that reaching out for real connection starts to feel impossible.",
                "tone": "caution"
            }
        ]
    },
    "INFP": {
        "bullets": [
            "You feel a decision is wrong before you can fully explain why — and you're usually right.",
            "You'd rather stay quiet about something than argue for it half-heartedly.",
            "You hold onto a private inner world that's more vivid to you than most people ever get to see.",
            "A single piece of harsh feedback can sit with you for days after everyone else has forgotten it."
        ],
        "asset": "Creativity",
        "risk": "Idealism",
        "secondaryAsset": "Emotional Depth",
        "secondaryRisk": "Difficulty Committing",
        "mind": {
            "Fi": {
                "role": "Dominant",
                "desc": "Judges everything against a deeply personal, quietly held set of values.",
                "example": "You'll go along with almost anything — right up until it crosses a line you didn't even realize mattered to you this much."
            },
            "Ne": {
                "role": "Auxiliary",
                "desc": "Generates possibilities and emotional connections, often tied to how a person or idea makes you feel.",
                "example": "You'll suddenly see a completely different side of a familiar story, just from noticing one small emotional detail everyone else skipped."
            },
            "Si": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary pull toward comforting memory and past experience.",
                "example": "You'll return to the same book or song for years, because it still holds the exact feeling it did the first time."
            },
            "Te": {
                "role": "Inferior",
                "desc": "External, efficient logic and organization — the function you trust and use the least.",
                "example": "You know exactly what needs to get done, but turning that into an actual step-by-step plan feels oddly exhausting."
            }
        },
        "pressure": {
            "trigger": "Sustained criticism or negativity aimed at something you care about deeply.",
            "looksLike": "Uncharacteristic harshness — hypercritical, exaggerated judgments of yourself or others, delivered with none of your usual gentleness.",
            "happening": "Your dominant Fi can't resolve the hurt on its own, so control drops to inferior Te, and you start handing down blunt, overstated verdicts — on yourself first, often, before turning them on everyone else.",
            "recover": "Naming it out loud as the grip talking, not the truth — then giving the criticism a day to cool before deciding whether any of it was actually fair."
        },
        "growth": {
            "blindspot": "Treating a strong personal feeling about something as proof that it's objectively true.",
            "leastMature": "\"Retreats into private judgment of everyone who doesn't meet your inner standard, without ever voicing what that standard is.\"",
            "best": "\"Holds the same depth of feeling, but says the values out loud where they can actually be discussed — not just felt.\"",
            "habit": "Before writing someone off internally, ask: \"have I actually told them what I need, or just decided they failed to guess it?\""
        },
        "fiction": [
            {
                "name": "Erik (The Phantom)",
                "blurb": "The Phantom of the Opera — idealism curdled into obsession: a private fantasy world built around one person, sustained through manipulation once reality refuses to cooperate.",
                "tone": "shadow"
            },
            {
                "name": "Frodo Baggins",
                "blurb": "The Lord of the Rings — quiet moral endurance: he carries an unbearable weight not out of ambition, but because his private sense of what's right leaves him no other choice.",
                "tone": "mature"
            },
            {
                "name": "Wilson Fisk",
                "blurb": "Daredevil — good intentions curdled into \"the ends justify the means\": he genuinely believes he's cleaning up the city, which is exactly what lets him excuse the violence it takes to do it.",
                "tone": "caution"
            }
        ]
    },
    "ISTP": {
        "bullets": [
            "You'd rather fix the problem with your hands than talk about how it made you feel.",
            "You need real breathing room, and you'll quietly pull back the moment someone starts scheduling your time for you.",
            "A crisis doesn't rattle you — it's the slow, boring stuff that actually tests your patience.",
            "You show people you care by showing up and doing something useful, not by saying it out loud."
        ],
        "asset": "Practical Action",
        "risk": "Impulsiveness",
        "secondaryAsset": "Composure Under Pressure",
        "secondaryRisk": "Emotional Detachment",
        "mind": {
            "Ti": {
                "role": "Dominant",
                "desc": "Builds a private, internally consistent logical framework and tests everything against it.",
                "example": "You'll quietly take a system apart in your head just to understand exactly why it works, with no plan to tell anyone what you found."
            },
            "Se": {
                "role": "Auxiliary",
                "desc": "Engages directly and skillfully with the physical present moment.",
                "example": "You'll instinctively know how to fix, drive, or handle something the first time you touch it, no manual required."
            },
            "Ni": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary sense that occasionally hands you a sudden, oddly specific read on how a situation will unfold.",
                "example": "You'll have a flash of certainty about how something's going to go, act on it, and only later think to explain why."
            },
            "Fe": {
                "role": "Inferior",
                "desc": "Awareness of others' emotions and social harmony — the function you trust and use the least.",
                "example": "You can care about someone enormously and still have no idea how to say so in a way that actually lands."
            }
        },
        "pressure": {
            "trigger": "Sustained emotional conflict, or a situation where your usual hands-on problem-solving simply doesn't apply.",
            "looksLike": "A sudden, disproportionate emotional reaction — often expressed as an abrupt, final-feeling action rather than words: walking out, quitting, ending something outright.",
            "happening": "Your trusted Ti-Se approach can't resolve what's bothering you, so control drops to inferior Fe, and everything you've been quietly not-processing arrives at once, with none of your usual composure.",
            "recover": "Physical distance and solitude first, then a concrete, low-stakes hands-on task to let your dominant Ti-Se pairing settle back in before revisiting the actual conversation."
        },
        "growth": {
            "blindspot": "Assuming that not talking about a feeling is the same as it not existing.",
            "leastMature": "\"Ends things — a conversation, a relationship, a commitment — abruptly, rather than sitting in the discomfort of working through it.\"",
            "best": "\"Still values independence and directness, but can name what's bothering you before it forces its way out sideways.\"",
            "habit": "Before walking away from a hard conversation, name one concrete thing that's actually bothering you — out loud, to the person."
        },
        "fiction": [
            {
                "name": "Boba Fett",
                "blurb": "Star Wars — independence and detachment with no attachment to any side: skilled, unreadable, and willing to work for whoever's paying, regardless of the cause.",
                "tone": "shadow"
            },
            {
                "name": "Indiana Jones",
                "blurb": "Indiana Jones — competence and independence in service of something that actually matters to him, not just the next thrill.",
                "tone": "mature"
            },
            {
                "name": "James Bond",
                "blurb": "James Bond — decisive and unshakeable under pressure, but so committed to self-sufficiency that real intimacy never gets the chance to take hold.",
                "tone": "caution"
            }
        ]
    },
    "ISFP": {
        "bullets": [
            "You won't fake a feeling you don't have, even when it would make things socially easier.",
            "You notice beauty in small, ordinary moments most people walk straight past.",
            "You'll quietly accommodate almost anyone — right up until they cross a line you privately won't move on.",
            "Rules for the sake of rules feel less like structure and more like a cage."
        ],
        "asset": "Authenticity",
        "risk": "Overwhelm",
        "secondaryAsset": "Present-Moment Awareness",
        "secondaryRisk": "Conflict Avoidance",
        "mind": {
            "Fi": {
                "role": "Dominant",
                "desc": "Judges everything against a deeply personal, quietly held set of values.",
                "example": "You'll go along with the group for a long time — until something crosses a line only you can see, and then you're immovable."
            },
            "Se": {
                "role": "Auxiliary",
                "desc": "Engages fully and vividly with the present physical moment.",
                "example": "You'll notice the exact quality of light in a room before you notice anything anyone in it just said."
            },
            "Ni": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary pull toward future implications that helps temper pure impulse.",
                "example": "Every so often you'll have an oddly specific hunch about how something's going to turn out — and it's usually right."
            },
            "Te": {
                "role": "Inferior",
                "desc": "External efficiency, structure, and organization — the function you trust and use the least.",
                "example": "You know exactly what you want to make — turning that into a schedule with deadlines is another matter entirely."
            }
        },
        "pressure": {
            "trigger": "A prolonged situation that violates your personal values, or being pushed for far more structure and control than feels natural.",
            "looksLike": "Uncharacteristic harsh criticism and a rigid drive to control your circumstances through logic and systems you don't normally rely on.",
            "happening": "Your dominant Fi-Se approach has been overwhelmed for too long, so your psyche pulls the emergency brake and drops you into inferior Te — suddenly cold, efficient, and fault-finding in a way that surprises everyone who knows you.",
            "recover": "Getting back into your body on purpose — a walk, making something with your hands, physical movement — rather than trying to logic your way out of a feeling that logic can't actually reach."
        },
        "growth": {
            "blindspot": "Avoiding conflict so consistently that your own needs quietly disappear from the conversation entirely.",
            "leastMature": "\"Shuts down and disengages rather than risk a confrontation, even when staying silent costs you something real.\"",
            "best": "\"Still moves at your own pace and by your own values, but says the hard thing directly instead of just withdrawing.\"",
            "habit": "Next time you want to avoid a conflict, say one true sentence about it out loud instead of changing the subject."
        },
        "fiction": [
            {
                "name": "Stain",
                "blurb": "My Hero Academia — conviction turned violent: a set of personal values so absolute that anyone who doesn't meet them stops counting as a person worth sparing.",
                "tone": "shadow"
            },
            {
                "name": "June Osborne (Offred)",
                "blurb": "The Handmaid's Tale — quiet defiance at its healthiest: an unshakeable inner compass that survives every attempt to strip it away, expressed through small acts of resistance rather than grand speeches.",
                "tone": "mature"
            },
            {
                "name": "Zuko",
                "blurb": "Avatar: The Last Airbender — values in genuine conflict with each other: chasing an inherited definition of honor so hard that it takes years, and real damage along the way, before he can hear what he actually believes.",
                "tone": "caution"
            }
        ]
    },
    "ENTJ": {
        "bullets": [
            "You spot the inefficiency in a plan within minutes of walking into the room.",
            "You make the call and move — waiting for consensus feels like watching momentum die.",
            "You assume everyone else operates at your pace, and get visibly impatient when they don't.",
            "You can read what someone's feeling just fine; you just don't always think it should change the decision."
        ],
        "asset": "Leadership",
        "risk": "Domination",
        "secondaryAsset": "Decisiveness",
        "secondaryRisk": "Poor Handling of Emotions",
        "mind": {
            "Te": {
                "role": "Dominant",
                "desc": "Runs on external, verifiable logic — organizing people and resources toward a clear goal.",
                "example": "You'll restructure a meeting's entire agenda in your head before it's even started, because the current plan is clearly wasting everyone's time."
            },
            "Ni": {
                "role": "Auxiliary",
                "desc": "Converges on a long-range strategic vision, often well before the people around you can see where you're headed.",
                "example": "You'll commit to a five-year plan with total confidence while everyone else is still debating next quarter."
            },
            "Se": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary pull toward decisive, in-the-moment action.",
                "example": "When the plan needs to change right now, you don't hesitate — you're already moving before you've finished explaining why."
            },
            "Fi": {
                "role": "Inferior",
                "desc": "A private, personal sense of right and wrong — the function you trust and use the least.",
                "example": "You rarely talk about what you personally believe in, but cross that line without knowing it and you'll find out immediately."
            }
        },
        "pressure": {
            "trigger": "Intense emotional confrontation, guilt over having been too harsh, or your own values going unacknowledged.",
            "looksLike": "Uncharacteristic emotional outbursts, withdrawal from people entirely, or sudden hypersensitivity — reading rejection into small, insignificant details.",
            "happening": "Your trusted Te-Ni approach can't out-strategize what you're feeling, so control drops to inferior Fi, and you're flooded with exactly the private emotional reactions you normally never let surface.",
            "recover": "Physical exertion first to burn off the intensity, then naming — even just to yourself — what value actually got stepped on, before making any decisions about people."
        },
        "growth": {
            "blindspot": "Treating your own read on \"what's effective\" as automatically also \"what's right\" — without checking the second one separately.",
            "leastMature": "\"Steamrolls other people's input as an obstacle to efficiency, then wonders why no one brings you bad news anymore.\"",
            "best": "\"Moves just as fast and decisively, but has built in a real pause to ask what this costs the people executing the plan.\"",
            "habit": "Before finalizing a decision, ask one person who disagrees with you to make their case — and actually let it change something."
        },
        "fiction": [
            {
                "name": "Frank Underwood",
                "blurb": "House of Cards — Te-Ni ambition with the last shred of Fi surgically removed: strategy and momentum in service of nothing but his own advancement.",
                "tone": "shadow"
            },
            {
                "name": "Princess Leia",
                "blurb": "Star Wars — command and conviction aligned: decisive, unshakeable under pressure, and never once willing to let strategy override what she actually believes in.",
                "tone": "mature"
            },
            {
                "name": "Miranda Priestly",
                "blurb": "The Devil Wears Prada — competence and standards taken so far past the point of diminishing returns that her own name for it, privately, might be loneliness.",
                "tone": "caution"
            }
        ]
    },
    "ENFJ": {
        "bullets": [
            "You can walk into a room and have everyone rallying around the same goal within minutes.",
            "You'll advocate loudly for someone who can't speak up for themselves, even when it costs you socially.",
            "Letting someone down feels almost physically uncomfortable, so you rarely do it.",
            "You assume most people share your sense of right and wrong — and get genuinely thrown when they don't."
        ],
        "asset": "Inspirational Charisma",
        "risk": "People-Pleasing",
        "secondaryAsset": "Reliability",
        "secondaryRisk": "Overcommitment",
        "mind": {
            "Fe": {
                "role": "Dominant",
                "desc": "Reads the emotional climate of a room instantly and moves to bring people together around it.",
                "example": "You'll notice a friend is struggling before they've said a word, and you're already thinking about how to help."
            },
            "Ni": {
                "role": "Auxiliary",
                "desc": "Builds a clear, long-range vision of how people and situations could be.",
                "example": "You'll see exactly who someone could become, sometimes before they can see it themselves."
            },
            "Se": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary pull toward decisive, in-the-moment action once the vision is clear.",
                "example": "Once you've decided what needs to happen, you'll move on it immediately — no more deliberating."
            },
            "Ti": {
                "role": "Inferior",
                "desc": "Detached, internally consistent logic — the function you trust and use the least.",
                "example": "You can feel completely certain a decision is right and still struggle to explain the actual reasoning behind it."
            }
        },
        "pressure": {
            "trigger": "Sustained conflict, or feeling that your values and effort are going completely unacknowledged.",
            "looksLike": "Uncharacteristic hypercriticism — suddenly picking apart the logic in everything, and withdrawing from people to think alone instead of connecting.",
            "happening": "Your trusted Fe-Ni approach can't restore the harmony it usually can, so control drops to inferior Ti, and you turn cold and unfiltered in a way that startles the people used to your warmth.",
            "recover": "Give yourself the solitude the grip is actually asking for — briefly — then return to people once the harsh, hyper-logical edge has worn off rather than while it's still running the show."
        },
        "growth": {
            "blindspot": "Assuming that because you can see someone's potential clearly, they're obligated to want it too.",
            "leastMature": "\"Pushes people toward the vision you have for them, then feels hurt or betrayed when they choose differently.\"",
            "best": "\"Holds the same vision for people, but lets them arrive at it — or not — in their own time, without making it personal.\"",
            "habit": "Before offering advice someone didn't ask for, ask yourself: \"is this actually for them, or is it for how I need this to go?\""
        },
        "fiction": [
            {
                "name": "Hans Westergaard",
                "blurb": "Frozen — Fe-driven charm with the warmth surgically removed: reading people perfectly, purely to find the fastest route to what he wants.",
                "tone": "shadow"
            },
            {
                "name": "Terry Jeffords",
                "blurb": "Brooklyn Nine-Nine — leadership that's genuinely about the people being led: warm, invested in everyone's growth, and just as much of a softie in private as he is a captain in public.",
                "tone": "mature"
            },
            {
                "name": "Lily Aldrin",
                "blurb": "How I Met Your Mother — good intentions with a controlling edge: she loves fixing people's lives so much that she sometimes forgets to ask whether they wanted the help.",
                "tone": "caution"
            }
        ]
    },
    "ESTJ": {
        "bullets": [
            "You build the structure before anyone asks for one.",
            "You say the uncomfortable thing everyone else is avoiding.",
            "You measure a plan by whether it actually works, not whether it feels good.",
            "You keep your word — reliability isn't a nice-to-have for you, it's non-negotiable."
        ],
        "asset": "Organization",
        "risk": "Rigidity",
        "secondaryAsset": "Reliability",
        "secondaryRisk": "Emotional Reticence",
        "mind": {
            "Te": {
                "role": "Dominant",
                "desc": "Runs on external, verifiable logic — what's efficient, what's provable, what gets results.",
                "example": "You reorganize a messy plan within minutes of walking into the room, whether anyone asked you to or not."
            },
            "Si": {
                "role": "Auxiliary",
                "desc": "Trusts what's been tested and proven before. Precedent matters.",
                "example": "\"We've always done it this way\" isn't laziness for you — it's a track record you don't want to throw away without a reason."
            },
            "Ne": {
                "role": "Tertiary",
                "desc": "A less-trusted stream of \"what if\" possibilities that shows up as blunt, half-formed contingency plans.",
                "example": "You'll suddenly propose a left-field backup plan, then just as quickly go back to the tested approach."
            },
            "Fi": {
                "role": "Inferior",
                "desc": "Personal values and private emotion — the function you're least fluent in.",
                "example": "You know what you believe is right, but explaining why it matters to you personally is the hardest sentence you'll say all week."
            }
        },
        "pressure": {
            "trigger": "Losing control of a situation, or being told the system you built doesn't work.",
            "looksLike": "Uncharacteristic rigidity hardening into control for control's sake.",
            "happening": "Your usual Te-Si approach — organize it, apply what's worked before — isn't landing. Under enough strain, your least-developed function, introverted feeling, takes over in its most raw form: you become uncharacteristically emotional, take things personally, and make decisions based on hurt feelings rather than the facts you'd normally trust.",
            "recover": "Naming the feeling out loud, even clumsily, before trying to fix anything. The fix can wait five minutes."
        },
        "growth": {
            "blindspot": "Treating \"efficient\" and \"right\" as the same thing — dismissing feelings as noise that slows down the plan.",
            "leastMature": "\"Enforces rules because they're rules. Confuses respect with obedience.\"",
            "best": "\"Enforces standards because they serve people — and can tell you exactly who they serve and why.\"",
            "habit": "Before enforcing a rule, ask out loud: \"does this still serve the actual goal, or just the old plan?\""
        },
        "fiction": [
            {
                "name": "Inspector Javert",
                "blurb": "Les Misérables — the type's shadow side taken to its extreme: a man who mistakes the law itself for justice, and cannot survive the moment those two things split apart.",
                "tone": "shadow"
            },
            {
                "name": "Princess Tiana",
                "blurb": "The Princess and the Frog — a healthy, grounded version of the type: dedicated, hard-working, and ambitious without losing sight of what's actually realistic.",
                "tone": "mature"
            },
            {
                "name": "Dolores Umbridge",
                "blurb": "Harry Potter — order weaponized: she takes real pleasure in enforcing rules, punishes anyone who breaks them without mercy, and turns hostile the moment her authority is questioned.",
                "tone": "caution"
            }
        ]
    },
    "ESFJ": {
        "bullets": [
            "You know what someone needs before they've thought to ask for it.",
            "You keep every promise you make, even the small ones nobody would notice if you skipped.",
            "You'd rather smooth over a disagreement than let it sit in the room.",
            "A little unnoticed effort stings more than you'd ever admit out loud."
        ],
        "asset": "Community",
        "risk": "Neglecting Self",
        "secondaryAsset": "Practical Reliability",
        "secondaryRisk": "Need for Appreciation",
        "mind": {
            "Fe": {
                "role": "Dominant",
                "desc": "Reads the emotional needs of the group and moves to keep everyone comfortable and connected.",
                "example": "You'll rearrange an entire gathering around one person's bad day without anyone quite noticing you did it."
            },
            "Si": {
                "role": "Auxiliary",
                "desc": "Draws on a detailed, well-organized memory of what's worked and what's expected before.",
                "example": "You remember exactly how last year's holiday went, right down to who sat where, and you're already planning around it."
            },
            "Ne": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary pull toward new possibilities that occasionally surprises the people who think they have you fully figured out.",
                "example": "Every so often you'll float a genuinely offbeat idea, then go right back to the tried-and-true plan five minutes later."
            },
            "Ti": {
                "role": "Inferior",
                "desc": "Detached, impersonal logic — the function you trust and use the least.",
                "example": "You'll feel completely sure a decision is right because it feels right, and find it oddly hard to defend that on pure logic alone."
            }
        },
        "pressure": {
            "trigger": "Sustained conflict, criticism of something you're proud of, or feeling like your effort has gone completely unnoticed.",
            "looksLike": "Uncharacteristic hypercriticism and withdrawal — suddenly nitpicking small inconsistencies and pulling back from the people you'd normally be taking care of.",
            "happening": "Your trusted Fe-Si approach has hit a wall it can't smooth over, so control drops to inferior Ti, and you turn colder and more clinical than anyone who knows you would expect.",
            "recover": "Naming out loud that you feel unappreciated, directly, instead of waiting for someone to notice — the grip tends to ease the moment the actual need gets said."
        },
        "growth": {
            "blindspot": "Equating \"keeping the peace\" with \"the problem is resolved,\" when really it's just gone quiet for now.",
            "leastMature": "\"Smooths over a real problem to preserve harmony, then quietly resents everyone involved for weeks afterward.\"",
            "best": "\"Still values harmony, but is willing to sit in a little discomfort now so the resentment doesn't build later.\"",
            "habit": "Next time you want to smooth something over, name the actual disagreement out loud first — then smooth it over."
        },
        "fiction": [
            {
                "name": "Mother Gothel",
                "blurb": "Tangled — caretaking curdled into possession: love expressed entirely as control, convinced that keeping someone dependent is the same thing as keeping them safe.",
                "tone": "shadow"
            },
            {
                "name": "Monica Geller",
                "blurb": "Friends — devotion channeled into hosting, organizing, and holding the group together: competitive and particular, but genuinely there for the people she loves.",
                "tone": "mature"
            },
            {
                "name": "Effie Trinket",
                "blurb": "The Hunger Games — propriety and appearances valued so highly that she initially can't see the horror in front of her, mistaking manners for what actually matters.",
                "tone": "caution"
            }
        ]
    },
    "ENTP": {
        "bullets": [
            "You'll argue a position you don't even hold, just to see if it survives contact.",
            "You generate ten workable ideas before lunch and finish approximately none of them.",
            "Routine feels less like stability and more like a slow leak of oxygen.",
            "You can pick up a completely unrelated skill fast enough to unsettle the people who've been doing it for years."
        ],
        "asset": "Innovation",
        "risk": "Argumentativeness",
        "secondaryAsset": "Intellectual Versatility",
        "secondaryRisk": "Inconsistency",
        "mind": {
            "Ne": {
                "role": "Dominant",
                "desc": "Sees the world as a web of interconnected possibilities and generates options effortlessly.",
                "example": "You'll connect two completely unrelated ideas mid-conversation and immediately want to test whether the connection actually holds."
            },
            "Ti": {
                "role": "Auxiliary",
                "desc": "Builds a private, internally consistent logical framework and tests every claim — including your own — against it.",
                "example": "You'll poke holes in your own argument out loud, mid-argument, just because you noticed the hole."
            },
            "Fe": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary read on the social climate that lets you charm a room when you bother to use it.",
                "example": "You can win people over effortlessly when it matters to you — you just don't always think it matters."
            },
            "Si": {
                "role": "Inferior",
                "desc": "Grounded, detail-oriented memory of past experience — the function you trust and use the least.",
                "example": "You'll forget the same practical detail three times in a row because your attention was somewhere far more interesting."
            }
        },
        "pressure": {
            "trigger": "Sustained criticism, or a situation demanding routine and precision with zero room for improvisation.",
            "looksLike": "Uncharacteristic pessimism, nitpicking, and a nostalgic, gloomy fixation on past mistakes — the opposite of your usual forward-looking energy.",
            "happening": "Your trusted Ne-Ti pairing has nowhere left to generate options, so control drops to inferior Si, and you get stuck replaying old failures instead of imagining new possibilities.",
            "recover": "Deliberately building in one small, boring routine — same meal, same walk — rather than trying to think your way out with more ideas, which is exactly what got you here."
        },
        "growth": {
            "blindspot": "Treating every conversation as a debate to win, even when the other person just wanted to be heard.",
            "leastMature": "\"Argues a point purely to prove you can, long after it's stopped being interesting to anyone else in the room.\"",
            "best": "\"Still loves a good argument, but can tell the difference between exploring an idea and just needing to be right.\"",
            "habit": "Before pushing back on someone's idea, ask yourself: \"am I actually curious, or do I just want to win this?\""
        },
        "fiction": [
            {
                "name": "The Joker",
                "blurb": "Batman — chaos as philosophy, argued with total conviction: cleverness and improvisation used purely to prove that nothing anyone believes actually matters.",
                "tone": "shadow"
            },
            {
                "name": "Chandler Bing",
                "blurb": "Friends — wit used to connect rather than deflect: still allergic to sincerity, but shows up completely when it counts.",
                "tone": "mature"
            },
            {
                "name": "Fleabag",
                "blurb": "Fleabag — provocation as a defense mechanism: funny, sharp, and so committed to deflecting through jokes that real intimacy keeps slipping through the cracks.",
                "tone": "caution"
            }
        ]
    },
    "ENFP": {
        "bullets": [
            "You'll connect two people, two ideas, or two entire fields that had no business being connected — and it works.",
            "You say yes to things because you're genuinely excited, then realize at 11pm what that yes actually costs.",
            "You care so specifically about certain things that people are sometimes surprised you have limits at all.",
            "Finishing the last 10% of a project is somehow harder than starting three new ones."
        ],
        "asset": "Enthusiasm",
        "risk": "Distraction",
        "secondaryAsset": "Empathetic Communication",
        "secondaryRisk": "Overcommitment",
        "mind": {
            "Ne": {
                "role": "Dominant",
                "desc": "Sees possibilities and emotional connections everywhere, especially in people.",
                "example": "You'll meet someone for five minutes and walk away with a full, vivid theory of who they are and what they need."
            },
            "Fi": {
                "role": "Auxiliary",
                "desc": "Judges everything against a deeply personal, quietly held set of values.",
                "example": "You'll seem endlessly easygoing right up until something touches a value you didn't realize was non-negotiable."
            },
            "Te": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary pull toward efficient execution once you're actually excited enough to use it.",
                "example": "When something matters enough, you'll suddenly organize it with a precision that surprises everyone who's only seen your messy desk."
            },
            "Si": {
                "role": "Inferior",
                "desc": "Grounded routine and detailed memory of the past — the function you trust and use the least.",
                "example": "You'll forget where you put something five minutes ago while vividly remembering exactly how a conversation from three years ago felt."
            }
        },
        "pressure": {
            "trigger": "Overcommitment catching up with you all at once, or criticism aimed at something you genuinely care about.",
            "looksLike": "Uncharacteristic rigidity and self-criticism — suddenly nitpicky, pessimistic, and fixated on past mistakes instead of your usual forward-looking optimism.",
            "happening": "Your Ne-Fi combination has generated more than your Te can actually execute, so control drops to inferior Si, and you get stuck rigidly replaying what went wrong instead of imagining what's next.",
            "recover": "One small, concrete routine — not a new idea, just something familiar and physical — to give your exhausted Ne a place to rest before you try to solve anything."
        },
        "growth": {
            "blindspot": "Saying yes from genuine excitement without checking whether future-you can actually deliver on it.",
            "leastMature": "\"Commits enthusiastically, then quietly disappears when the follow-through gets hard or boring.\"",
            "best": "\"Still says yes to what excites you, but says a clear no to everything else — before the moment you're excited turns into a promise.\"",
            "habit": "Before saying yes to something new, name one thing you'll have to say no to in order to actually do it."
        },
        "fiction": [
            {
                "name": "Megamind",
                "blurb": "Megamind — endless creativity with nowhere healthy to go: constant idea-generation and real emotional pain funneled into supervillainy simply because no one ever expected anything else from him.",
                "tone": "shadow"
            },
            {
                "name": "Veronica Mars",
                "blurb": "Veronica Mars — sharp, values-driven curiosity used in service of real justice: she follows every hunch to the end, even the ones that cost her socially.",
                "tone": "mature"
            },
            {
                "name": "Clementine Kruczynski",
                "blurb": "Eternal Sunshine of the Spotless Mind — enthusiasm and reinvention taken far enough that the people who love her can never quite tell which version of her they're getting next.",
                "tone": "caution"
            }
        ]
    },
    "ESTP": {
        "bullets": [
            "You'll jump into a problem with your hands before anyone's finished describing it.",
            "You read a room's energy in seconds and adjust before anyone else has even noticed the shift.",
            "You trust what you can see and test over what someone tells you should be true.",
            "You say the blunt thing fast, then occasionally have to walk it back."
        ],
        "asset": "Adaptability",
        "risk": "Recklessness",
        "secondaryAsset": "Quick Thinking",
        "secondaryRisk": "Impulsiveness",
        "mind": {
            "Se": {
                "role": "Dominant",
                "desc": "Engages fully and immediately with the physical present moment.",
                "example": "You'll notice the exact second an opportunity opens up in a room, and you're already moving on it before anyone else clocks it."
            },
            "Ti": {
                "role": "Auxiliary",
                "desc": "Forms independent, internally consistent conclusions rather than accepting conventional wisdom.",
                "example": "You'll take something apart — literally or logically — just to satisfy yourself that you actually understand how it works."
            },
            "Fe": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary read on the social atmosphere that grows stronger with experience.",
                "example": "You'll charm your way through a tense room without even fully realizing you did it."
            },
            "Ni": {
                "role": "Inferior",
                "desc": "Long-range pattern-thinking and future implications — the function you trust and use the least.",
                "example": "Planning three steps ahead feels a lot less natural to you than just handling step one really well and figuring out the rest as it comes."
            }
        },
        "pressure": {
            "trigger": "Micromanagement, loss of autonomy, or being forced into a passive situation with no room to act.",
            "looksLike": "Uncharacteristic catastrophic thinking — sudden paranoia about the future or other people's motives, and a fixation on worst-case scenarios.",
            "happening": "Your trusted Se-Ti approach has nothing left to act on, so control drops to inferior Ni, and you get pulled into exactly the kind of abstract, future-focused anxiety your instincts normally protect you from.",
            "recover": "Physical activity first to burn off the charge, then talking it through out loud with someone else — processing it externally works far better for you than sitting alone with it."
        },
        "growth": {
            "blindspot": "Assuming that because you can handle almost anything in the moment, you don't need to think past the moment at all.",
            "leastMature": "\"Acts first without pausing to consider who gets affected, then treats the fallout as someone else's problem to manage.\"",
            "best": "\"Still moves fast and trusts your instincts, but takes the extra few seconds to ask who this decision actually lands on.\"",
            "habit": "Before acting on impulse in something that affects other people, ask one question first: \"who does this actually impact?\""
        },
        "fiction": [
            {
                "name": "Ramsay Bolton",
                "blurb": "Game of Thrones — action and impulse with every trace of empathy removed: he doesn't calculate cruelty, he simply enjoys it in the moment, the same way he enjoys everything else.",
                "tone": "shadow"
            },
            {
                "name": "Aladdin",
                "blurb": "Aladdin — quick thinking and resourcefulness pointed toward something bigger than the next thrill: he's still improvising every step, just now in service of people he actually loves.",
                "tone": "mature"
            },
            {
                "name": "Eleanor Shellstrop",
                "blurb": "The Good Place — living entirely in the moment with zero regard for consequences, until she's finally forced to reckon with exactly who that made her.",
                "tone": "caution"
            }
        ]
    },
    "ESFP": {
        "bullets": [
            "You can walk into any room and read its entire emotional temperature within seconds.",
            "You feel things fully and fast — and you're not interested in performing a calmer version of that for anyone's comfort.",
            "People assume you're not thinking deeply about things, right up until you surprise them with exactly how much you actually noticed.",
            "Planning three months out feels abstract in a way that planning the next three hours never does."
        ],
        "asset": "Authentic Energy",
        "risk": "Overwhelm",
        "secondaryAsset": "Emotional Presence",
        "secondaryRisk": "Difficulty Planning Ahead",
        "mind": {
            "Se": {
                "role": "Dominant",
                "desc": "Reads the present moment with vivid, high-resolution immediacy.",
                "example": "You'll catch the exact shift in someone's tone before they've said anything that would explain it."
            },
            "Fi": {
                "role": "Auxiliary",
                "desc": "Quietly judges everything against a personal set of values, even when it doesn't show on the surface.",
                "example": "You seem endlessly go-with-the-flow, right up until something crosses a line only you can see — and then you're done negotiating."
            },
            "Te": {
                "role": "Tertiary",
                "desc": "A quiet, tertiary pull toward efficient, get-it-done execution, especially under pressure.",
                "example": "You'll suddenly organize an entire event flawlessly at the last minute, then go right back to your usual spontaneity once it's handled."
            },
            "Ni": {
                "role": "Inferior",
                "desc": "Long-range, symbolic meaning-making — the function you trust and use the least.",
                "example": "You'll sense that something means more than it appears to, without being able to explain exactly why — and mostly you just let that feeling pass."
            }
        },
        "pressure": {
            "trigger": "A long stretch of overextending yourself socially, followed by something small that wouldn't normally bother you.",
            "looksLike": "A sudden, out-of-character conviction that someone's betrayed you — reading dark, hidden meaning into completely ordinary things, and holding onto that conviction harder than you'd hold onto something you actually knew.",
            "happening": "Your dominant Se-Fi pairing has been overextended for too long with no real payoff, so control drops to inferior Ni, and it hands you one dark, unshakeable story about the future instead of your usual read on the present.",
            "recover": "Taking the pressure off completely — rest, quiet, less social load — rather than trying to argue yourself out of the story, since arguing with a grip rarely works; it needs to run out of fuel instead."
        },
        "growth": {
            "blindspot": "Assuming that because a feeling is intensely real to you right now, it must also be permanent.",
            "leastMature": "\"Avoids a real conversation by changing the subject, changing the plan, or simply changing the room.\"",
            "best": "\"Still feels everything fully and immediately, but can stay in an uncomfortable conversation long enough to actually finish it.\"",
            "habit": "Next time you want to walk away from a hard conversation, commit to staying for five more minutes before you decide to leave."
        },
        "fiction": [
            {
                "name": "Roxie Hart",
                "blurb": "Chicago — charisma and self-expression with nothing underneath but the need to be seen: willing to lie, manipulate, or worse, as long as it keeps her in the spotlight.",
                "tone": "shadow"
            },
            {
                "name": "Marty McFly",
                "blurb": "Back to the Future — quick-thinking and adaptability used with real courage: he improvises his way through crisis after crisis without ever losing sight of the people he's doing it for.",
                "tone": "mature"
            },
            {
                "name": "Serena van der Woodsen",
                "blurb": "Gossip Girl — warmth and spontaneity that consistently outruns the consequences: she means well in the moment, then runs from the fallout instead of facing it.",
                "tone": "caution"
            }
        ]
    }
};

    // The wiki JSON is the authoritative source for the primary asset/risk
    // (a few entries were refined there), so propagate back into ARCHETYPES:
    // the fallback card and Overview pane stay consistent.
    for (const key of Object.keys(WIKI_CONTENT)) {
        const w = WIKI_CONTENT[key];
        if (ARCHETYPES[key] && w) {
            ARCHETYPES[key].asset = w.asset;
            ARCHETYPES[key].risk = w.risk;
        }
    }

    // Text escaping for wiki pane content dropped into innerHTML.
    function escWikiText(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Builders for the five wiki tabs. Every pane uses the same class names as
    // the original ESTJ template, so the scoped full-arch CSS applies unchanged;
    // only the wording now comes from the WIKI_CONTENT JSON per archetype.
    function buildWikiOverview(w) {
        const bullets = w.bullets.map(b => `        <div class="bullet">${escWikiText(b)}</div>`).join('\n');
        return [
            '<div class="pane active" id="pane-overview">',
            '    <div class="section-label">How It Shows Up</div>',
            '    <div class="bullets">',
            bullets,
            '    </div>',
            '    <div class="divider"></div>',
            '    <div class="two-col">',
            '        <div class="col">',
            '            <div class="col-label asset">Greatest Asset</div>',
            `            <p>${escWikiText(w.asset)}</p>`,
            '        </div>',
            '        <div class="col">',
            '            <div class="col-label risk">Hidden Risk</div>',
            `            <p>${escWikiText(w.risk)}</p>`,
            '        </div>',
            '    </div>',
            '    <div class="divider"></div>',
            '    <div class="two-col">',
            '        <div class="col">',
            '            <div class="col-label asset">Secondary Asset</div>',
            `            <p>${escWikiText(w.secondaryAsset)}</p>`,
            '        </div>',
            '        <div class="col">',
            '            <div class="col-label risk">Secondary Risk</div>',
            `            <p>${escWikiText(w.secondaryRisk)}</p>`,
            '        </div>',
            '    </div>',
            '</div>',
        ].join('\n');
    }

    function buildWikiMind(w) {
        // Sort by explicit role, never by JSON key order (which is not a stack
        // guarantee). Dots mirror the role's maturity: Dominant 4 through Inferior 1.
        const rows = Object.keys(w.mind)
            .map(code => Object.assign({ code }, w.mind[code]))
            .sort((a, b) => ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role])
            .map(fn => {
                const lit = ROLE_DOTS[fn.role] || 0;
                let dots = '';
                for (let i = 0; i < 4; i++) dots += `<span class="fn-dot${i < lit ? ' lit' : ''}"></span>`;
                return [
                    '    <div class="fn-row">',
                    '        <div class="fn-badge-col">',
                    `            <div class="fn-code">${escWikiText(fn.code)}</div>`,
                    `            <div class="fn-role">${escWikiText(fn.role)}</div>`,
                    `            <div class="fn-dots">${dots}</div>`,
                    '        </div>',
                    '        <div class="fn-body">',
                    `            <div class="fn-name">${escWikiText(FUNCTION_NAMES[fn.code] || fn.code)}</div>`,
                    `            <div class="fn-desc">${escWikiText(fn.desc)}</div>`,
                    `            <div class="fn-example">${escWikiText(fn.example)}</div>`,
                    '        </div>',
                    '    </div>',
                ].join('\n');
            })
            .join('\n');
        return [
            '<div class="pane" id="pane-mind">',
            '    <div class="section-label">Cognitive Stack</div>',
            rows,
            '</div>',
        ].join('\n');
    }

    function buildWikiPressure(w) {
        return [
            '<div class="pane" id="pane-pressure">',
            '    <div class="section-label">Under Pressure</div>',
            '    <div class="two-col">',
            '        <div class="col">',
            '            <div class="col-label" style="color:#fbbf24">Trigger</div>',
            `            <p>${escWikiText(w.pressure.trigger)}</p>`,
            '        </div>',
            '        <div class="col">',
            '            <div class="col-label" style="color:#fbbf24">Looks Like</div>',
            `            <p>${escWikiText(w.pressure.looksLike)}</p>`,
            '        </div>',
            '    </div>',
            '    <div class="pressure-highlight">',
            '        <div class="col-label">What\'s Actually Happening</div>',
            `        <p>${escWikiText(w.pressure.happening)}</p>`,
            '    </div>',
            '    <div class="recover-note">',
            '        <div>',
            '            <div class="col-label">Recovering</div>',
            `            <p>${escWikiText(w.pressure.recover)}</p>`,
            '        </div>',
            '    </div>',
            '</div>',
        ].join('\n');
    }

    function buildWikiGrowth(w) {
        return [
            '<div class="pane" id="pane-growth">',
            '    <div class="section-label">Growth Path</div>',
            '    <div class="blindspot-callout">',
            '        <div class="col-label">Blind Spot</div>',
            `        <p>${escWikiText(w.growth.blindspot)}</p>`,
            '    </div>',
            '    <div class="growth-pair">',
            '        <div class="growth-item">',
            '            <div class="col-label">At Their Least Mature</div>',
            `            <p>${escWikiText(w.growth.leastMature)}</p>`,
            '        </div>',
            '        <div class="growth-item mature">',
            '            <div class="col-label">At Their Best</div>',
            `            <p>${escWikiText(w.growth.best)}</p>`,
            '        </div>',
            '    </div>',
            '    <div class="habit-note">',
            '        <div class="col-label">One Habit</div>',
            `        <p>${escWikiText(w.growth.habit)}</p>`,
            '    </div>',
            '</div>',
        ].join('\n');
    }

    function buildWikiFiction(w) {
        const toneClass = { shadow: 'tone-shadow', mature: 'tone-mature', caution: 'tone-caution' };
        const cards = w.fiction
            .map(f => [
                `    <div class="fiction-card ${toneClass[f.tone] || 'tone-shadow'}">`,
                `        <div class="fiction-name">${escWikiText(f.name)}</div>`,
                `        <div class="fiction-blurb">${escWikiText(f.blurb)}</div>`,
                '    </div>',
            ].join('\n'))
            .join('\n');
        return [
            '<div class="pane" id="pane-fiction">',
            '    <div class="section-label">In Fiction</div>',
            cards,
            '</div>',
        ].join('\n');
    }

    // Single entry point: returns all five tab panes for an MBTI key's wiki
    // entry, or '' when there is no entry (caller keeps the simple fallback).
    function renderWikiPanes(key) {
        const w = WIKI_CONTENT[key];
        if (!w) return '';
        return [
            buildWikiOverview(w),
            buildWikiMind(w),
            buildWikiPressure(w),
            buildWikiGrowth(w),
            buildWikiFiction(w),
        ].join('\n');
    }

    // Default wording for the configurable prompt fields (Prompts settings).
    const DEFAULT_ANALYSIS_NAME = 'Latest Analysis';
    const DEFAULT_ANALYSIS_PROMPT = 'Brief 1-2 sentence explanation';
    const DEFAULT_COMMENT_NAME = 'Psy Professor';
    const DEFAULT_COMMENT_PROMPT = 'A sarcastic one-liner analyzing this moment like a psychology professor at a whiteboard. Be witty and punchy, keep it short.';

    // Collapse newlines/whitespace so free-form prompt text can be embedded
    // safely inside the JSON schema shown to the model.
    function sanitizePromptText(text) {
        return String(text || '').trim().replace(/\s+/g, ' ');
    }

    function getPromptsSettings() {
        return extension_settings?.mbti_widget?.prompts || {};
    }

    // Fixed rating schema + tag pairs. The reasoning ("Latest Analysis") and
    // the commenter ("professor") description lines come from the Prompts
    // settings; the tags/pairs themselves stay locked.
    function buildRatingSystemPrompt() {
        const p = getPromptsSettings();
        const analysis = sanitizePromptText(p.analysis) || DEFAULT_ANALYSIS_PROMPT;
        const comment = sanitizePromptText(p.commenter?.prompt) || DEFAULT_COMMENT_PROMPT;
        return `Analyze the user's last message. For each of the 4 pairs below, choose exactly ONE tag — the one that better describes this specific action. If the action is genuinely neutral on an axis, omit both tags from that pair.

Pair 1 - Social energy: shadow (withdrew, avoided, observed from distance) vs flame (engaged, confronted, inserted themselves)
Pair 2 - Decision method: reason (used logic, evidence, analysis) vs heart (used emotion, empathy, gut feeling)
Pair 3 - Information focus: clue (focused on concrete physical details) vs pattern (made a connection, inference, or intuitive leap)
Pair 4 - Approach to uncertainty: anchor (committed to a position or plan) vs drift (kept options open, adapted, stayed flexible)

Respond strictly ONLY with valid JSON:
{
 "tags": ["tag1", "tag2"],  // Minimum 1 tag, maximum 4 (one per pair).
 "reasoning": "${analysis}",
 "professor": "${comment}"
}`;
    }

    // Re-scan prompt: same locked tag schema; reasoning line follows the
    // configured "Latest Analysis" prompt. No commenter line is requested
    // (re-scan stores no comments).
    function buildRescanPrompt() {
        const p = getPromptsSettings();
        const analysis = sanitizePromptText(p.analysis) || DEFAULT_ANALYSIS_PROMPT;
        return `Analyze the following chat history. For EACH user message (marked with [user]), determine which MBTI tags apply based on the user's behavior in that specific message.

Message numbering rules (CRITICAL):
- Every line in the history is numbered with its exact index in the chat file, shown in square brackets before the role marker, e.g. \`[12] [user] Name: text\` and \`[13] [ai] Name: text\`.
- Indices are consecutive and 0-based; they depend ONLY on position in the chat file, not on the role. Consecutive assistant messages still get consecutive indices, and there is no skipping.
- For each user message, copy that line's bracket number VERBATIM into the returned "messageIndex". Never renumber, shift, count, or guess the index.
- Return EXACTLY ONE analysis object per [user] line, in chronological order.

Respond strictly ONLY with valid JSON:
{
  "analyses": [
    {
      "messageIndex": 0,
      "tags": ["tag1", "tag2"],
      "reasoning": "${analysis}"
    }
  ]
}

Tags (choose 1-4 per message):
Pair 1 - Social energy: shadow (withdrew, avoided, observed from distance) vs flame (engaged, confronted, inserted themselves)
Pair 2 - Decision method: reason (used logic, evidence, analysis) vs heart (used emotion, empathy, gut feeling)
Pair 3 - Information focus: clue (focused on concrete physical details) vs pattern (made a connection, inference, or intuitive leap)
Pair 4 - Approach to uncertainty: anchor (committed to a position or plan) vs drift (kept options open, adapted, stayed flexible)

If a message is genuinely neutral on an axis, omit both tags from that pair.`;
    }

    // --- Regex script cleaning (mirrors ST's main-chat / ST-Copilot behavior) ---
    //
    // SillyTavern strips "Regex Scripts" content (CYOA option markers, tracker
    // dumps, ...) from messages before they reach the model. ST-Copilot applies
    // the same engine via a dynamic import of /scripts/extensions/regex/engine.js.
    // Our extension sends message text directly (custom backend, re-scan, auto
    // analysis), so we must run the same engine: the model sees the clean story,
    // and the token estimate matches the actual payload. Every failure path
    // returns the original text so regex issues can never break the extension.

    let _regexEngineModule = false;

    async function loadRegexEngine() {
        if (_regexEngineModule !== false) return _regexEngineModule;
        try {
            const mod = await import('/scripts/extensions/regex/engine.js');
            _regexEngineModule =
                mod && typeof mod.getRegexedString === 'function' ? mod : null;
        } catch (e) {
            _regexEngineModule = null;
        }
        return _regexEngineModule;
    }

    // Apply the active regex scripts for a message's role placement, mirroring
    // ST-Copilot's applyRegexIfEnabled exactly (placements USER_INPUT for user
    // messages, AI_OUTPUT otherwise; depth = messages from the newest entry).
    async function applyRegexScripts(text, isUser, depth) {
        if (typeof text !== 'string' || !text) return text;
        try {
            const mod = await loadRegexEngine();
            if (!mod) return text;
            const placement = isUser
                ? (mod.regex_placement?.USER_INPUT ?? 2)
                : (mod.regex_placement?.AI_OUTPUT ?? 1);
            const params = { isPrompt: true, depth: depth || 0 };
            const result = mod.getRegexedString(text, placement, params);
            const resolved = (result instanceof Promise) ? await result : result;
            return (typeof resolved === 'string') ? resolved : text;
        } catch (e) {
            return text;
        }
    }

    // Clean a chat message through the regex engine once, cached by message
    // object identity (invalidated when m.mes changes, e.g. after an edit).
    // Keyed on the raw text so the greedy re-scan loop never re-runs regexes.
    const _cleanCache = new Map();

    async function cleanMessageText(m) {
        if (!m || typeof m.mes !== 'string') return m ? m.mes : '';
        const cached = _cleanCache.get(m);
        if (cached && cached.src === m.mes) return cached.cleaned;
        const context = SillyTavern.getContext();
        const chat = context?.chat || [];
        const idx = chat.indexOf(m);
        const depth = idx >= 0 ? chat.length - 1 - idx : 0;
        const cleaned = await applyRegexScripts(m.mes, !!m.is_user, depth);
        if (_cleanCache.size > 4000) _cleanCache.clear();
        _cleanCache.set(m, { src: m.mes, cleaned });
        return cleaned;
    }

    async function getMessageContext(count) {
        const context = SillyTavern.getContext();
        if (!context.chat) return '';
        const chat = context.chat;  // chat IS the array (not chat.messages)
        const recent = chat.slice(-count).filter(m => !m.is_system);
        const lines = [];
        for (const m of recent) {
            const text = await cleanMessageText(m);
            lines.push(`${m.is_user ? '[user]' : '[ai]'} ${m.name}: ${text}`);
        }
        return lines.join('\n');
    }

function getLastUserMessage() {
        const context = SillyTavern.getContext();
        if (!context.chat) return { userMessage: null, aiResponse: null, userIdx: -1, userMsgObj: null };
        const chat = context.chat;
        const len = chat.length;
        if (len === 0) return { userMessage: null, aiResponse: null, userIdx: -1, userMsgObj: null };
        
        // Find last user message and last AI response (most recent messages at end).
        // Also return the chat index of the user message so auto-trigger records
        // are keyed to the user's message number (matching the chat file and the
        // re-scan entries), never the AI reply's index.
        let userMessage = null;
        let userMsgObj = null;
        let userIdx = -1;
        let aiResponse = null;
        let aiMsgObj = null;
        
        for (let i = len - 1; i >= 0; i--) {
            if (!userMessage && chat[i].is_user && !chat[i].is_system) {
                userMessage = chat[i].mes;
                userMsgObj = chat[i];
                userIdx = i;
            } else if (!aiResponse && !chat[i].is_user && !chat[i].is_system) {
                aiResponse = chat[i].mes;
                aiMsgObj = chat[i];
            }
            if (userMessage && aiResponse) break;
        }
        
        return { userMessage, aiResponse, userIdx, userMsgObj, aiMsgObj };
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
            // User-managed context window (in tokens). Defaults to 64,000; a
            // provider-reported real limit (learnedContextLength) is informational
            // only and never overrides this value.
            contextLength: cfg.contextLength ?? 64000,
            learnedContextLength: cfg.learnedContextLength || 0,
            apiKey: apiKey,
        };
    }

    // Learn the provider's real context limit from error messages that report
    // it (e.g. NanoGPT's "Max context tokens: 64000"). Informational only: the
    // user's configured "Context size (tokens)" always wins for budgeting. Never
    // throws — this runs on already-failing requests.
    function learnContextLimitFromError(errorText, baseUrl) {
        try {
            const customApi = extension_settings?.mbti_widget?.customApi;
            if (!customApi || typeof errorText !== 'string') return;
            const patterns = [
                /max\s+context\s+tokens[:=]?\s*(\d[\d,]*)/i,
                /maximum\s+context\s+(?:length|size|tokens?)[^0-9]{0,12}(\d[\d,]*)/i,
                /context\s+length\s+(?:of|is|exceeds?)[^0-9]{0,12}(\d[\d,]*)/i,
                /context_length[^0-9]{0,12}(\d[\d,]*)/i,
            ];
            let limit = 0;
            for (const re of patterns) {
                const match = errorText.match(re);
                if (match) {
                    limit = parseInt(match[1].replace(/[^\d]/g, ''), 10);
                    if (limit > 0) break;
                }
            }
            if (limit <= 0) return;
            const prev = customApi.learnedContextLength || 0;
            if (prev !== limit) {
                customApi.learnedContextLength = limit;
                saveSettingsDebounced();
            }
            console.warn(`[MBTI] API reports a real context limit of ${limit} tokens (${baseUrl}). If "Context size (tokens)" differs, adjust it in the extension settings to match.`);
        } catch (e) {
            // never break the error path
        }
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

        const trySend = async (requestedMaxTokens) => {
            return await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: model.trim(),
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                    max_tokens: requestedMaxTokens,
                    temperature: temperature ?? 0.7,
                }),
            });
        };

        try {
            const requestedMaxTokens = maxTokensOverride || maxTokens || 2048;
            let response = await trySend(requestedMaxTokens);

            // Some providers reject max_tokens values above the model's output
            // ceiling. Retry once with the configured value when that happens.
            if (!response.ok) {
                const firstText = await response.clone().text();
                const tooLarge = /max_tokens|maximum\s+(output|response)|too\s+large|is\s+less\s+than/i.test(firstText);
                if (tooLarge && requestedMaxTokens > (maxTokens || 2048)) {
                    response = await trySend(maxTokens || 2048);
                }
            }

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
                learnContextLimitFromError(errorText, normalizedBaseUrl);
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
        
        console.log('[MBTI] queryRating - backend:', (extension_settings?.mbti_widget?.backend || 'st'));
        try {
            const response = await generateMBTI({
                prompt: JSON.stringify(promptData, null, 2),
                systemPrompt: buildRatingSystemPrompt(),
            });
            return parseRatingResponse(response);
        } catch (error) {
            console.error('MBTI Widget: Rating query failed', error);
            if (isCustomBackend()) {
                showTestResult(`Analysis failed: ${error.message}`, 'err');
            }
            return { tags: [], reasoning: '', professor: '', error: true };
        }
    }

    // Analyze the most recent turn (last user message) end-to-end and record it.
    // Shared by the auto-trigger (MESSAGE_RECEIVED) and the manual "re-analyze"
    // button. Returns true if a new analysis was recorded, false otherwise.
    async function reAnalyzeLastTurn(opts = {}) {
        if (isProcessing) return false;
        const settings = extension_settings?.mbti_widget;
        if (!settings?.enabled) return false;

        const { userMessage, aiResponse, userIdx, userMsgObj, aiMsgObj } = getLastUserMessage();
        if (!userMessage || userIdx < 0) return false;

        // Auto-trigger path (MESSAGE_RECEIVED): analyze only when a genuinely NEW
        // user message arrived — i.e. the latest is_user line is newer than the
        // last recorded analysis. ST's "Continue" / regenerate / swipe append an
        // AI message with NO new user input, so they must not fire. The manual
        // Re-analyze button and the error popup's Re-send pass force:true to
        // analyze the current turn regardless.
        if (!opts.force) {
            const lastRecordIdx = trail.length > 0 ? trail[trail.length - 1].messageIndex : -1;
            if (userIdx <= lastRecordIdx) {
                console.log('[MBTI] Skip: no new user message (idx ' + userIdx + ' <= last analyzed ' + lastRecordIdx + ')');
                return false;
            }
        }

        const chatHistory = await getMessageContext(settings?.contextMessages || 5);
        if (!chatHistory) return false;

        // Regex-clean both message texts before sending (same engine as the
        // re-scan path) so grading markers / CYOA syntax trimming / whitespace
        // don't inflate the payload. cleanMessageText never throws, so a regex
        // engine import failure falls back to the raw text.
        const cleanUser = await cleanMessageText(userMsgObj);
        const cleanAi = aiMsgObj ? await cleanMessageText(aiMsgObj) : (aiResponse || '');

        isProcessing = true;
        setStatus('busy', 'Analyzing the last turn...');
        try {
            const result = await queryRating(cleanUser, cleanAi, chatHistory);

            if (result.error) {
                setStatus('error', 'Response format error');
                errorResendHandler = () => reAnalyzeLastTurn({ force: true });
                showErrorPopup('The analysis returned an invalid response format. Re-send to try again.');
                return false;
            }

            // Key the record to the USER message's chat index so it matches the
            // chat-file numbering and the re-scan entries (which analyze user
            // messages). Never the AI reply's index (the old chat.length - 1).
            const msgIndex = userIdx >= 0 ? userIdx : trail.length;
            const professorName = getPromptsSettings().commenter?.name || DEFAULT_COMMENT_NAME;
            const analysisName = getPromptsSettings().analysisName || DEFAULT_ANALYSIS_NAME;

            upsertTrailEntry(msgIndex, {
                tags: result.tags || [],
                reasoning: result.reasoning || '',
                professor: result.professor || '',
                professorName: professorName,
                analysisName: analysisName,
            });

            await saveToChatMetadata();
            updatePanel();
            setStatus('done', 'Analysis complete');
            return true;
        } catch (error) {
            console.error('MBTI Widget: Analysis error', error);
            setStatus('error', 'Analysis failed');
            errorResendHandler = () => reAnalyzeLastTurn({ force: true });
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

    // Apply MBTI tags by mutating the given scores object (no global side effects).
    function applyTagsTo(scoresObj, tags) {
        (tags || []).forEach(tag => {
            switch (tag) {
                case 'shadow': scoresObj.ie = Math.max(-MAX_SCORE, scoresObj.ie - 1); break;
                case 'flame': scoresObj.ie = Math.min(MAX_SCORE, scoresObj.ie + 1); break;
                case 'reason': scoresObj.tf = Math.max(-MAX_SCORE, scoresObj.tf - 1); break;
                case 'heart': scoresObj.tf = Math.min(MAX_SCORE, scoresObj.tf + 1); break;
                case 'clue': scoresObj.sn = Math.max(-MAX_SCORE, scoresObj.sn - 1); break;
                case 'pattern': scoresObj.sn = Math.min(MAX_SCORE, scoresObj.sn + 1); break;
                case 'anchor': scoresObj.jp = Math.max(-MAX_SCORE, scoresObj.jp - 1); break;
                case 'drift': scoresObj.jp = Math.min(MAX_SCORE, scoresObj.jp + 1); break;
            }
        });
    }

    // Handles both current entries ({ scores: {...} }) and legacy bare-score
    // entries stored before the wrapper existed.
    function getEntryScores(entry) {
        return entry.scores || entry;
    }

    // Recompute the cumulative chain from idx (inclusive) onward, keeping each
    // entry's own contribution (scores - previousScores) intact. Keeps the
    // stored snapshots consistent after a record is replaced/inserted/removed.
    function rebaseTrailAfter(idx) {
        for (let j = idx; j < trail.length; j++) {
            const entry = trail[j];
            const oldPrev = entry.previousScores;
            const oldScores = getEntryScores(entry);
            const prev = j === 0
                ? { ie: 0, tf: 0, sn: 0, jp: 0 }
                : JSON.parse(JSON.stringify(getEntryScores(trail[j - 1])));
            const delta = ['ie', 'tf', 'sn', 'jp'].map(a =>
                oldPrev && oldScores ? ((oldScores[a] || 0) - (oldPrev[a] || 0)) : 0
            );
            entry.previousScores = prev;
            entry.scores = JSON.parse(JSON.stringify(prev));
            ['ie', 'tf', 'sn', 'jp'].forEach((a, k) => {
                entry.scores[a] = (entry.scores[a] || 0) + delta[k];
            });
        }
    }

    function syncScoresFromTrail() {
        if (trail.length > 0) {
            scores = JSON.parse(JSON.stringify(getEntryScores(trail[trail.length - 1])));
        } else {
            scores = { ie: 0, tf: 0, sn: 0, jp: 0 };
        }
    }

    // Single writer for the trail: one record per analyzed reply. Replaces (or
    // inserts, chronologically) the entry for messageIndex then rebases every
    // following entry so the cumulative chain stays consistent. With an empty
    // tags array, any existing record for messageIndex is removed instead.
    function upsertTrailEntry(messageIndex, entryData) {
        let existingIdx = -1;
        let insertIdx = 0;
        for (let i = 0; i < trail.length; i++) {
            if (trail[i].messageIndex === messageIndex) existingIdx = i;
            if (trail[i].messageIndex < messageIndex) insertIdx = i + 1;
        }

        const tags = entryData.tags || [];
        if (tags.length === 0) {
            if (existingIdx === -1) return;
            trail.splice(existingIdx, 1);
            rebaseTrailAfter(existingIdx);
            syncScoresFromTrail();
            return;
        }

        const base = insertIdx > 0
            ? JSON.parse(JSON.stringify(getEntryScores(trail[insertIdx - 1])))
            : { ie: 0, tf: 0, sn: 0, jp: 0 };
        const after = JSON.parse(JSON.stringify(base));
        applyTagsTo(after, tags);

        const record = {
            messageIndex: messageIndex,
            scores: after,
            reasoning: entryData.reasoning || '',
            professor: entryData.professor || '',
            previousScores: JSON.parse(JSON.stringify(base)),
        };
        if (entryData.professorName) record.professorName = entryData.professorName;
        if (entryData.analysisName) record.analysisName = entryData.analysisName;

        if (existingIdx >= 0) {
            trail[existingIdx] = record;
        } else {
            trail.splice(insertIdx, 0, record);
        }
        rebaseTrailAfter(existingIdx >= 0 ? existingIdx : insertIdx);
        syncScoresFromTrail();
    }

    // Re-scan is authoritative: clear the whole trail and rebuild it fresh from
    // the resolved analyses so stale/duplicate records disappear. Entries are
    // written in chronological order with a fresh cumulative previousScores
    // chain (applyTagsTo clamps at MAX_SCORE), then scores reflects the tail.
    function rebuildTrailFromAnalyses(analyses) {
        trail = [];
        let base = { ie: 0, tf: 0, sn: 0, jp: 0 };
        analyses.forEach(analysis => {
            const prev = JSON.parse(JSON.stringify(base));
            const next = JSON.parse(JSON.stringify(prev));
            applyTagsTo(next, analysis.tags);
            trail.push({
                messageIndex: analysis.messageIndex,
                scores: next,
                previousScores: prev,
                reasoning: analysis.reasoning || '',
                professor: '',
                analysisName: getPromptsSettings().analysisName || DEFAULT_ANALYSIS_NAME,
            });
            base = next;
        });
        syncScoresFromTrail();
    }

    async function saveToChatMetadata() {
        const context = SillyTavern.getContext();
        const metadata = context.chatMetadata;
        if (!metadata) return;
        metadata.mbti_scores = scores;
        metadata.mbti_trail = trail;
        await context.saveMetadata();
    }

    // When a chat is branched from an earlier point (ST copies the metadata but
    // truncates the chat file), trail records referencing messages that no
    // longer exist would keep the auto-trigger guard from firing (last record
    // index > chat length). Prune the trail to the current chat: keep only
    // records whose messageIndex maps to a real is_user message, dedupe
    // last-wins, then rebuild the cumulative chain from each record's own tag
    // contribution. Returns true when anything changed (caller persists).
    function pruneStaleTrailEntries() {
        const context = SillyTavern.getContext();
        const chat = context?.chat;
        if (!chat || trail.length === 0) return false;

        let changed = false;
        const valid = new Map();
        for (const entry of trail) {
            const idx = entry.messageIndex;
            const m = idx >= 0 ? chat[idx] : undefined;
            if (m && m.is_user) {
                valid.set(idx, entry);
            } else {
                changed = true;
            }
        }
        if (valid.size !== trail.length) changed = true;

        if (!changed) return false;

        const kept = [...valid.values()].sort((a, b) => a.messageIndex - b.messageIndex);
        trail = [];
        let base = { ie: 0, tf: 0, sn: 0, jp: 0 };
        for (const entry of kept) {
            const prev = JSON.parse(JSON.stringify(base));
            const next = JSON.parse(JSON.stringify(prev));
            const oldPrev = entry.previousScores;
            const oldScores = getEntryScores(entry);
            ['ie', 'tf', 'sn', 'jp'].forEach(a => {
                const contribution = oldPrev && oldScores ? (oldScores[a] || 0) - (oldPrev[a] || 0) : 0;
                next[a] += contribution;
            });
            trail.push({ ...entry, previousScores: prev, scores: next });
            base = next;
        }
        syncScoresFromTrail();

        console.warn(`[MBTI] Pruned stale trail record(s): chat has ${chat.length} message(s) but stored metadata referenced a longer history (branch/shortened chat). ${trail.length} valid record(s) kept.`);
        return true;
    }

    async function loadFromChatMetadata() {
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
        // Branched/shortened chats must not retain stale tail records — prune
        // and persist so the auto-trigger guard and history stay consistent.
        if (pruneStaleTrailEntries()) {
            await saveToChatMetadata();
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

        setBarIcon('icon-ie', scores.ie, AXIS_BY_NAME.ie);
        setBarIcon('icon-tf', scores.tf, AXIS_BY_NAME.tf);
        setBarIcon('icon-sn', scores.sn, AXIS_BY_NAME.sn);
        setBarIcon('icon-jp', scores.jp, AXIS_BY_NAME.jp);

        updateDeltas();

        const reasoningEl = document.getElementById('reasoning-text');
        const reasoningLabel = document.getElementById('reasoning-label');
        if (reasoningLabel) {
            reasoningLabel.textContent = getPromptsSettings().analysisName || DEFAULT_ANALYSIS_NAME;
            reasoningLabel.classList.toggle('is-expanded', reasoningExpanded);
        }
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
            reasoningEl.classList.toggle('expanded', reasoningExpanded);
        }

        const professorEl = document.getElementById('professor-text');
        const professorSection = document.getElementById('professor-section');
        const professorLabel = document.getElementById('professor-label');
        const lastEntry = trail[trail.length - 1];
        const professor = lastEntry && lastEntry.professor ? lastEntry.professor : '';
        if (professorLabel) {
            professorLabel.textContent = getPromptsSettings().commenter?.name || DEFAULT_COMMENT_NAME;
            professorLabel.classList.toggle('is-expanded', professorExpanded);
        }
        if (professorEl) {
            professorEl.textContent = professor;
            professorEl.style.color = 'rgba(212, 197, 169, 0.8)';
            professorEl.classList.toggle('expanded', professorExpanded);
        }
        if (professorSection) {
            professorSection.style.display = professor ? 'block' : 'none';
        }

        scheduleDeltaFade();
    }

    // Swap the mbti-tag-* color class on an element to the given tag while
    // preserving any other classes (e.g. the delta 'fade').
    function applyTagClass(el, tag) {
        if (!el) return;
        [...el.classList].forEach((name) => {
            if (name.startsWith('mbti-tag-')) el.classList.remove(name);
        });
        el.classList.add('mbti-tag-' + tag);
    }

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
        axes.forEach(a => {
            const el = document.getElementById(`delta-${a}`);
            if (!el) return;
            const delta = (after[a] || 0) - (before[a] || 0);
            if (delta !== 0) {
                const meta = AXIS_BY_NAME[a];
                el.textContent = delta > 0 ? `+${delta}` : `${delta}`;
                applyTagClass(el, delta > 0 ? meta.posTag : meta.negTag);
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

        totalChars += buildRescanPrompt().length;
        return Math.round(totalChars / 4);
    }

    // Build the text representation of messages for the re-scan payload/sizing.
    // Message content runs through the regex engine (cleanMessageText) so the
    // model sees the clean story and the estimate matches the sent payload.
    async function buildRescanChatText(messages) {
        // Number messages with their global chat index so the LLM's returned
        // messageIndex matches the auto-analysis records (which use the chat
        // array position), keeping one record per reply across both paths.
        const context = SillyTavern.getContext();
        const chat = context ? context.chat : null;
        const parts = [];
        for (const m of messages) {
            const idx = chat ? chat.indexOf(m) : -1;
            const text = await cleanMessageText(m);
            parts.push(`[${idx}] ${m.is_user ? '[user]' : '[ai]'} ${m.name}: ${text}`);
        }
        return parts.join('\n');
    }

    // Count tokens of the full re-scan prompt (rescan prompt + clean chat text)
    // using SillyTavern's tokenizer. Falls back to a chars/4 heuristic if
    // unavailable. Always counts the same cleaned text the payload will carry.
    async function countRescanTokens(messages) {
        const rescanPrompt = buildRescanPrompt();
        try {
            const context = SillyTavern.getContext();
            if (context && typeof context.getTokenCountAsync === 'function') {
                const text = await buildRescanChatText(messages);
                const promptTokens = await context.getTokenCountAsync(rescanPrompt + '\n' + text);
                return promptTokens || 0;
            }
        } catch (e) {
            console.warn('MBTI Widget: getTokenCountAsync failed, using heuristic', e);
        }
        const text = await buildRescanChatText(messages);
        const totalChars = rescanPrompt.length + text.length + messages.length * 12;
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
            const saved = extension_settings?.mbti_widget?.rescanMessages;
            if (slider) {
                // 0 / unset = scan the full chat (new-install default), which
                // includes message 0, matching ST-Copilot's full window.
                const chatLen = SillyTavern.getContext()?.chat?.length;
                slider.value = (saved === undefined || saved === 0) && chatLen
                    ? chatLen
                    : (saved || 5);
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
        const budgetEl = document.getElementById('rescan-budget');
        const warnEl = document.getElementById('rescan-warning');

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
        const budget = await getContextBudget();

        if (budget > 0) {
            const outputBudget = getRescanOutputBudget(userCount, tokens, budget);
            const over = tokens + outputBudget > budget;
            tokensEl.textContent = `~${tokens.toLocaleString()} in · ~${outputBudget.toLocaleString()} out`;
            tokensEl.classList.toggle('is-over', over);
            const learned = extension_settings?.mbti_widget?.customApi?.learnedContextLength || 0;
            const learnedNote = learned > 0 && learned !== budget
                ? ` (API reports real limit ${learned.toLocaleString()})`
                : '';
            if (budgetEl) {
                budgetEl.textContent = `context ${budget.toLocaleString()}${learnedNote}`;
            }
            if (warnEl) {
                if (over) {
                    const fit = await countFittingMessages(chat, messageCount, budget);
                    warnEl.style.display = 'block';
                    warnEl.textContent = `Exceeds the context window (~${budget.toLocaleString()} tokens incl. output room) — the scan will analyze the newest ${fit} message(s).`;
                } else {
                    warnEl.style.display = 'none';
                }
            }
        } else {
            tokensEl.textContent = `~${tokens.toLocaleString()} tokens`;
            tokensEl.classList.remove('is-over');
            if (budgetEl) budgetEl.textContent = 'context unknown';
            if (warnEl) warnEl.style.display = 'none';
        }
    }

    // How many newest non-system messages fit (input + output) inside the budget.
    // Mirrors the truncation logic in reScanHistory so the popup preview and the
    // actual scan agree.
    async function countFittingMessages(chat, wantedCount, budget) {
        if (!chat || typeof wantedCount !== 'number') return 0;
        const messages = chat.slice(-wantedCount).filter(m => !m.is_system);
        let included = [];
        for (const m of [...messages].reverse()) {
            const candidate = [m, ...included];
            const est = await countRescanTokens(candidate);
            const userCount = candidate.filter(mm => mm.is_user).length;
            if (budget > 0 && est + getRescanOutputBudget(userCount, est, budget) > budget) {
                break;
            }
            included = candidate;
        }
        return included.length;
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

    // Compute output token budget for re-scan so the analysis isn't truncated.
    // Always request the largest output the remaining context allows (floored at
    // MIN, capped at MAX_SCAN_OUTPUT) so reasoning-model thinking is never cut
    // short. When the context window is unknown, fall back to the configured or
    // scaled estimate. generateWithCustomOpenAI retries once at the configured
    // max_tokens if the provider rejects a too-large request.
    function getRescanOutputBudget(userMessageCount, inputEstimate, contextBudget) {
        const configured = getCustomApiSettings().maxTokens || 8192;
        const estimated = Math.max(configured, userMessageCount * 160);
        const MIN_SCAN_OUTPUT = 1024;
        const MAX_SCAN_OUTPUT = 32768;
        if (!(contextBudget > 0)) {
            // Unknown context window: rely on the configured/scaled output only.
            return Math.min(estimated, MAX_SCAN_OUTPUT);
        }
        const remaining = Math.max(MIN_SCAN_OUTPUT, contextBudget - inputEstimate);
        return Math.min(MAX_SCAN_OUTPUT, remaining);
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

        isProcessing = true;
        showRescanProgress(true);
        setStatus('busy', `Re-scanning last ${messageCount} messages...`);

        const budget = await getContextBudget();
        let overflowing = false;

        try {
            // Greedily include messages newest-first until input plus the output
            // we'd request for them would overflow the context budget.
            let includedMsgs = [];
            for (const m of [...messages].reverse()) {
                const candidateAll = [m, ...includedMsgs];
                const est = await countRescanTokens(candidateAll);
                const userCount = candidateAll.filter(mm => mm.is_user).length;
                if (budget > 0 && est + getRescanOutputBudget(userCount, est, budget) > budget) {
                    overflowing = true;
                    break;
                }
                includedMsgs = candidateAll;
            }
            // includedMsgs is newest-first; keep it chronological for the prompt.
            includedMsgs = includedMsgs.reverse();

            let chatText = await buildRescanChatText(includedMsgs);
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
                    warnEl.textContent = `Chat exceeds the model context (~${budget.toLocaleString()} tokens incl. output room) — analyzing the newest ${includedMsgs.length} messages. ${omittedTotal} earlier message(s) omitted.`;
                }
            }

            // Re-scan output grows with user messages (one analysis entry each).
            // Request the largest output the remaining context allows so the
            // analysis (incl. reasoning-model thinking) is never truncated.
            const includedUserCount = includedMsgs.filter(m => m.is_user).length;
            const outputBudget = getRescanOutputBudget(
                includedUserCount,
                await countRescanTokens(includedMsgs),
                budget,
            );

            const response = await generateMBTI({
                prompt: chatText,
                systemPrompt: buildRescanPrompt(),
                maxTokensOverride: outputBudget,
            });

            const parsed = parseRescanResponse(response);
            console.log('[MBTI] Parsed analyses:', parsed.analyses.length);

            if (parsed.error) {
                setStatus('error', 'Re-scan format error');
                errorResendHandler = () => reScanHistory(lastScanCount);
                showErrorPopup('The re-scan returned an invalid response format. Re-send to try again.');
                return;
            }

            // Resolve each returned messageIndex against the actual user messages
            // in the scanned window: accept exact hits, snap ±1 for off-by-one /
            // shifted mis-numbering, drop anything unresolvable (last-wins dedupe).
            const userIndexSet = new Set();
            for (const m of includedMsgs) {
                if (m.is_user) userIndexSet.add(chat.indexOf(m));
            }
            let corrected = 0;
            let dropped = 0;
            const resolved = {};
            for (const a of parsed.analyses) {
                let idx = a.messageIndex;
                if (userIndexSet.has(idx)) {
                    // exact match
                } else if (userIndexSet.has(idx - 1)) {
                    idx = idx - 1;
                    corrected++;
                } else if (userIndexSet.has(idx + 1)) {
                    idx = idx + 1;
                    corrected++;
                } else {
                    dropped++;
                    continue;
                }
                resolved[idx] = a;
            }
            const resolvedList = Object.keys(resolved)
                .map(Number)
                .sort((x, y) => x - y)
                .map(idx => ({ ...resolved[idx], messageIndex: idx }));

            if (parsed.analyses.length === 0 && response.trim()) {
                console.warn('[MBTI] Re-scan: response parsed but contained no valid analyses.');
            }
            if (parsed.analyses.length > 0 && resolvedList.length === 0) {
                // Every analysis was unresolvable — don't wipe the existing
                // trail on a bad result; surface it so it can be re-sent.
                console.error('[MBTI] Re-scan: no analyzed message index maps to a user message in this chat.');
                setStatus('error', 'Re-scan message indices unmapped');
                errorResendHandler = () => reScanHistory(lastScanCount);
                showErrorPopup('The re-scan returned message numbers that do not match any user message in this chat. Re-send to try again.');
                return;
            }
            if (corrected > 0 || dropped > 0) {
                console.warn(`[MBTI] Re-scan index fix: corrected ${corrected}, dropped ${dropped} of ${parsed.analyses.length} analyses.`);
            }

            // Re-scan is authoritative: wipe the trail and rebuild it fresh
            // from the resolved analyses (chronological, one record per reply),
            // eliminating stale/duplicate records from older scans.
            rebuildTrailFromAnalyses(resolvedList);

            await saveToChatMetadata();
            updatePanel();
            setStatus('done', corrected > 0 || dropped > 0
                ? `Re-scan complete (${corrected} corrected${dropped > 0 ? `, ${dropped} dropped` : ''})`
                : 'Re-scan complete');

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
        const goBtn = document.getElementById('rescan-go-btn');

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

    function setBarIcon(id, val, meta) {
        const el = document.getElementById(id);
        if (!el) return;
        if (val < 0) applyTagClass(el, meta.negTag);
        else if (val > 0) applyTagClass(el, meta.posTag);
        else applyTagClass(el, 'neutral');
    }

    // Compact title-casing for the wiki modal header. ARCHETYPES names are
    // stored all-caps ("THE COMMANDER"); the prototype shows "The Commander".
    function toTitleCase(str) {
        return String(str || '').toLowerCase().split(/\s+/)
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    function openFullArchModal() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];
        const hasWiki = Boolean(WIKI_CONTENT[key]);

        const illKey = arch.illustration || 'unknown';
        const illustrationEl = document.getElementById('mbti-full-arch-illustration');
        if (illustrationEl) {
            illustrationEl.innerHTML = (ILLUSTRATIONS[illKey] || ILLUSTRATIONS['unknown']) +
                '<div class="full-arch-illustration-overlay"></div>' +
                '<button class="full-arch-close" id="mbti-full-arch-close-btn">×</button>';
        }

        // Identity header: badge / title / tagline left, 2x2 traits grid right.
        const identityEl = document.getElementById('mbti-full-arch-identity');
        if (identityEl) {
            const traitHTML = arch.traits.map(t =>
                `<span class="trait" style="color:${t.color};border-color:${t.color}40;background:${t.color}10">${t.label}</span>`
            ).join('');

            identityEl.innerHTML =
                '<div class="identity-row"><div>' +
                `<div class="mbti-badge">${arch.mbti}</div>` +
                `<div class="title" style="color:${arch.color}">${toTitleCase(arch.name)}</div>` +
                `<div class="tagline">${arch.tagline}</div>` +
                '</div>' + (traitHTML ? `<div class="traits-grid">${traitHTML}</div>` : '') + '</div>';
        }

        const contentEl = document.getElementById('mbti-full-arch-body');
        const tabsWrapEl = document.getElementById('mbti-full-arch-tabs-wrap');
        const tabsEl = document.getElementById('mbti-full-arch-tabs');
        const underlineEl = document.getElementById('mbti-full-arch-tab-underline');

        if (hasWiki && tabsEl && contentEl) {
            if (tabsWrapEl) tabsWrapEl.style.display = '';

            tabsEl.innerHTML = ['Overview', 'Mind', 'Pressure', 'Growth', 'Fiction']
                .map((label, i) => `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${label.toLowerCase()}">${label}</button>`)
                .join('');
            contentEl.innerHTML = renderWikiPanes(key);

            const panes = contentEl.querySelectorAll('.pane');
            const buttons = tabsEl.querySelectorAll('.tab-btn');

            function positionWikiUnderline() {
                if (!underlineEl) return;
                const active = tabsEl.querySelector('.tab-btn.active');
                if (!active) return;
                underlineEl.style.left = active.offsetLeft + 'px';
                underlineEl.style.width = active.offsetWidth + 'px';
            }

            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => b.classList.remove('active'));
                    panes.forEach(p => p.classList.remove('active'));
                    btn.classList.add('active');
                    const target = contentEl.querySelector('#pane-' + btn.dataset.tab);
                    if (target) target.classList.add('active');
                    contentEl.scrollTop = 0;
                    positionWikiUnderline();
                });
            });

            requestAnimationFrame(positionWikiUnderline);
        } else if (contentEl) {
            if (tabsWrapEl) tabsWrapEl.style.display = 'none';

            const bulletsHTML = arch.bullets.map(b => `<div class="full-arch-bullet">${b}</div>`).join('');
            const famousHTML = arch.famous.map(f => `<span class="full-arch-famous-name">${f}</span>`).join('');
            const twoCol = arch.asset ? `<div class="full-arch-two-col"><div class="full-arch-col"><div class="full-arch-col-label is-asset">Greatest Asset</div><p>${arch.asset}</p></div><div class="full-arch-col"><div class="full-arch-col-label is-risk">Hidden Risk</div><p>${arch.risk}</p></div></div>` : '';
            const famousSection = arch.famous.length ? `<div class="full-arch-section-label">Known Examples</div><div class="full-arch-famous">${famousHTML}</div>` : '';
            const investigationSection = arch.bullets.length ? `<div class="full-arch-section-label">In This Investigation</div><div class="full-arch-bullets">${bulletsHTML}</div><div class="full-arch-divider"></div>${twoCol}${famousSection}` : '';

            contentEl.innerHTML = investigationSection;
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
                    const professorName = entry.professorName;
                    const professorHTML = entry.professor
                        ? (professorName
                            ? `<div class="history-row-professor"><span class="history-row-professor-name">${professorName}:</span> ${entry.professor}</div>`
                            : `<div class="history-row-professor">${entry.professor}</div>`)
                        : '';

                    const analysisName = entry.analysisName;
                    const reasoningHTML = entry.reasoning
                        ? (analysisName
                            ? `<span class="history-row-analysis-name">${analysisName}:</span> ${entry.reasoning}`
                            : entry.reasoning)
                        : 'No reasoning recorded';

                    return `
                        <div class="history-row">
                            <div class="history-row-num">${rowNum}</div>
                            <div class="history-row-body">
                                <div class="history-row-tags">${chipsHTML}</div>
                                <div class="history-row-reasoning">${reasoningHTML}</div>
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

    // Mask-styled icon like the main panel bars. Its color comes from the
    // parent's mbti-tag-* class.
    function ratingIconHTML(meta) {
        return '<div class="mbti-rating-icon" style="-webkit-mask-image:url(\'' + meta.icon + '\');mask-image:url(\'' + meta.icon + '\');"></div>';
    }

    // One chip: icon + signed delta for a non-zero axis.
    function ratingChipHTML(meta, delta) {
        const tag = delta > 0 ? meta.posTag : meta.negTag;
        const text = (delta > 0 ? '+' : '') + delta;
        return '<span class="mbti-rating-chip mbti-tag-' + tag + '">' + ratingIconHTML(meta) + '<span class="mbti-rating-chip-num">' + text + '</span></span>';
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
            const tag = val > 0 ? m.posTag : (val < 0 ? m.negTag : 'neutral');
            const text = (val > 0 ? '+' : '') + val;
            return '<span class="mbti-rating-chip is-summary mbti-tag-' + tag + '">' + ratingIconHTML(m) + '<span class="mbti-rating-chip-num">' + text + '</span></span>';
        }).join('');
    }

    // Legend footer: each icon with its positive/negative tag names.
    function renderHistoryLegend() {
        const el = document.getElementById('history-legend');
        if (!el) return;
        el.innerHTML = AXIS_META.map(m =>
            '<div class="legend-item mbti-tag-' + m.posTag + '">' +
                ratingIconHTML(m) +
                '<span class="legend-text"><span class="legend-pos mbti-tag-' + m.posTag + '">' + m.posTag + '</span> <span class="legend-arrow">/</span> <span class="legend-neg mbti-tag-' + m.negTag + '">' + m.negTag + '</span></span>' +
            '</div>'
        ).join('');
    }

    function closeHistoryModal() {
        const overlay = document.getElementById('history-overlay');
        if (overlay) overlay.classList.remove('is-open');
    }

    // Ray colors for the expanded radar dots, in scoresToOctagonPoints order:
    // reason, pattern, flame, clue, heart, drift, shadow, anchor.
    const RADAR_DOT_COLORS = ['#60a5fa', '#a78bfa', '#f97316', '#34d399', '#f472b6', '#94a3b8', '#94a3b8', '#fbbf24'];

    // Maps each axis's sign to the MBTI letter it pushes toward, with the
// full trait name so modal readers understand the single-letter codes.
    const AXIS_LETTERS = {
        ie: { pos: { letter: 'E', name: 'Extraverted' }, neg: { letter: 'I', name: 'Introverted' } },
        tf: { pos: { letter: 'F', name: 'Feeling' }, neg: { letter: 'T', name: 'Thinking' } },
        sn: { pos: { letter: 'N', name: 'Intuitive' }, neg: { letter: 'S', name: 'Sensing' } },
        jp: { pos: { letter: 'P', name: 'Perceiving' }, neg: { letter: 'J', name: 'Judging' } },
    };

    // Axis tag label for every octagon vertex, placed just outside the
    // maximum ring, colored by its tag.
    function radarLabelHTML() {
        const R = 104;
        const names = ['reason', 'pattern', 'flame', 'clue', 'heart', 'drift', 'shadow', 'anchor'];
        return names.map((n, i) => {
            const v = VERTICES[i];
            const dx = v.x - CENTER.x;
            const dy = v.y - CENTER.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const px = (CENTER.x + dx * R / dist).toFixed(1);
            const py = (CENTER.y + dy * R / dist).toFixed(1);
            return `<text x="${px}" y="${py}" class="radar-axis-label mbti-tag-${n}" text-anchor="middle" dominant-baseline="middle">${n}</text>`;
        }).join('');
    }

    // Same coordinate space as the panel radar (0-220), displayed larger via
    // CSS. Layers: grid rings + spokes, trail snapshots, current state, dots.
    function buildRadarSVGHTML() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];

        const pts = scoresToOctagonPoints(scores);
        const hasTrail = trail.length > 0;
        const alpha = hasTrail ? 0.65 : 0;
        const fillAlpha = hasTrail ? 0.12 : 0;

        const trailHTML = trail.map((entry, i) => {
            const s = getEntryScores(entry);
            const tPts = scoresToOctagonPoints(s);
            const a = 0.1 + (i + 1) / trail.length * 0.35;
            return `<polygon points="${pointsToStr(tPts)}" fill="none" stroke="${hexToRgba(arch.color, a)}" stroke-width="0.5"/>`;
        }).join('');

        const dotsHTML = pts.map((p, i) =>
            `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${RADAR_DOT_COLORS[i]}" opacity="0.9"/>`
        ).join('');

        return `<svg id="rm-svg" viewBox="0 0 220 220" class="radar-svg">
            <defs><filter id="rm-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g stroke="rgba(212,197,169,0.10)" stroke-width="0.5" fill="none">
                <polygon points="110,18 167,36 202,90 202,130 167,184 110,202 53,184 18,130 18,90 53,36"/>
                <polygon points="110,38 154,52 181,97 181,123 154,168 110,182 66,168 39,123 39,97 66,52"/>
                <polygon points="110,58 141,68 160,103 160,117 141,152 110,162 79,152 60,117 60,103 79,68"/>
                <polygon points="110,78 128,84 139,110 139,110 128,136 110,142 92,136 81,110 81,110 92,84"/>
            </g>
            <g stroke="rgba(212,197,169,0.10)" stroke-width="0.5">
                <line x1="110" y1="110" x2="110" y2="18"/><line x1="110" y1="110" x2="167" y2="36"/><line x1="110" y1="110" x2="202" y2="110"/>
                <line x1="110" y1="110" x2="167" y2="184"/><line x1="110" y1="110" x2="110" y2="202"/><line x1="110" y1="110" x2="53" y2="184"/>
                <line x1="110" y1="110" x2="18" y2="110"/><line x1="110" y1="110" x2="53" y2="36"/>
            </g>
            <g id="rm-trail">${trailHTML}</g>
            <polygon points="${pointsToStr(pts)}" fill="${hexToRgba(arch.color, fillAlpha)}" stroke="${arch.color}" stroke-opacity="${alpha}" stroke-width="0.9" filter="url(#rm-glow)"/>
            <g id="rm-dots" filter="url(#rm-glow)" opacity="${hasTrail ? '0.9' : '0'}">${dotsHTML}</g>
            <g id="rm-labels">${radarLabelHTML()}</g>
        </svg>`;
    }

    function radarStatCard(title, bodyHTML) {
        return '<div class="radar-stat"><div class="radar-stat-title">' + title + '</div>' + bodyHTML + '</div>';
    }

    // Strongest axis by absolute value (nil when everything is neutral).
    function radarSignatureValue() {
        let maxAbs = 0;
        let best = null;
        AXIS_META.forEach(m => {
            const v = scores[m.axis] || 0;
            if (Math.abs(v) > maxAbs) { maxAbs = Math.abs(v); best = m; }
        });
        if (!best || maxAbs === 0) return null;
        const raw = scores[best.axis] || 0;
        const tag = raw >= 0 ? best.posTag : best.negTag;
        const dir = AXIS_LETTERS[best.axis][raw >= 0 ? 'pos' : 'neg'];
        return { meta: best, raw: raw, tag: tag, letter: dir.letter, traitName: dir.name };
    }

    // Average decisiveness across the four axes, 0-100%.
    function radarConvictionValue() {
        const sum = ['ie', 'tf', 'sn', 'jp'].reduce((acc, a) => acc + Math.abs(scores[a] || 0), 0);
        const pct = Math.min(100, Math.round(sum / (4 * MAX_SCORE) * 100));
        let label = 'Building';
        if (pct >= 75) label = 'Set';
        else if (pct >= 50) label = 'Firm';
        else if (pct >= 25) label = 'Emerging';
        return { pct: pct, label: label };
    }

    // Largest single-turn change across the trail.
    function radarBiggestPivotValue() {
        if (trail.length < 2) return null;
        let best = null;
        for (let i = 1; i < trail.length; i++) {
            const d = entryDelta(trail[i], i);
            AXIS_META.forEach(m => {
                const dv = d[m.axis];
                if (dv !== 0 && (!best || Math.abs(dv) > Math.abs(best.delta))) {
                    best = { meta: m, delta: dv, rowId: trail[i].messageIndex !== undefined ? trail[i].messageIndex : i + 1 };
                }
            });
        }
        if (!best) return null;
        best.tag = best.delta > 0 ? best.meta.posTag : best.meta.negTag;
        return best;
    }

    // Polarity sign flips per axis across consecutive snapshots.
    function radarVolatilityValue() {
        if (trail.length < 2) return null;
        const flips = { ie: 0, tf: 0, sn: 0, jp: 0 };
        for (let i = 1; i < trail.length; i++) {
            const prev = getEntryScores(trail[i - 1]);
            const cur = getEntryScores(trail[i]);
            ['ie', 'tf', 'sn', 'jp'].forEach(a => {
                const p = prev[a] || 0;
                const c = cur[a] || 0;
                if ((p > 0 && c <= 0) || (p < 0 && c >= 0) || (p === 0 && c !== 0)) flips[a] += 1;
            });
        }
        let most = null;
        let least = null;
        AXIS_META.forEach(m => {
            if (!most || flips[m.axis] > flips[most.axis]) most = m;
            if (!least || flips[m.axis] < flips[least.axis]) least = m;
        });
        return { flips: flips, most: most, least: least };
    }

    function iconHTML(meta, colorTag) {
        return '<span class="mbti-tag-' + (colorTag || meta.posTag) + '">' + ratingIconHTML(meta) + '</span>';
    }

    function buildRadarStats() {
        const sig = radarSignatureValue();
        const conv = radarConvictionValue();
        const pivot = radarBiggestPivotValue();
        const vol = radarVolatilityValue();

        let html = '';

        if (sig) {
            html += radarStatCard('Signature Axis',
                '<div class="radar-stat-value">' + iconHTML(sig.meta, sig.tag) + '<span class="radar-stat-num">' + (sig.raw > 0 ? '+' : '') + sig.raw + '</span><span class="radar-stat-tag">' + sig.tag + '</span></div>' +
                '<div class="radar-stat-caption">Pulls the profile toward <b>' + sig.letter + '</b> · <span class="radar-stat-trait">' + sig.traitName + '</span></div>');
        } else {
            html += radarStatCard('Signature Axis',
                '<div class="radar-stat-value radar-stat-muted">—</div><div class="radar-stat-caption">No dominant signal yet</div>');
        }

        html += radarStatCard('Conviction',
            '<div class="radar-stat-value"><span class="radar-stat-num">' + conv.pct + '%</span><span class="radar-stat-tag">' + conv.label + '</span></div>' +
            '<div class="radar-conviction-track"><div class="radar-conviction-fill" style="width:' + conv.pct + '%"></div></div>');

        if (pivot) {
            html += radarStatCard('Biggest Turnaround',
                '<div class="radar-stat-value">' + iconHTML(pivot.meta, pivot.tag) + '<span class="radar-stat-num">' + (pivot.delta > 0 ? '+' : '') + pivot.delta + '</span><span class="radar-stat-tag">' + pivot.tag + '</span></div>' +
                '<div class="radar-stat-caption">Single biggest shift · turn <b>' + pivot.rowId + '</b></div>');
        } else {
            html += radarStatCard('Biggest Turnaround',
                '<div class="radar-stat-value radar-stat-muted">—</div><div class="radar-stat-caption">Not enough history yet</div>');
        }

        if (vol) {
            const total = vol.flips.ie + vol.flips.tf + vol.flips.sn + vol.flips.jp;
            const mostLabel = vol.most ? vol.most.posTag : '—';
            const leastLabel = vol.least ? vol.least.posTag : '—';
            html += radarStatCard('Volatility',
                '<div class="radar-stat-value"><span class="radar-stat-num">' + total + '</span><span class="radar-stat-tag">flips</span></div>' +
                '<div class="radar-stat-caption">Most shifting: <b class="mbti-tag-' + mostLabel + '">' + mostLabel + '</b> · Anchored: <b class="mbti-tag-' + leastLabel + '">' + leastLabel + '</b></div>');
        } else {
            html += radarStatCard('Volatility',
                '<div class="radar-stat-value radar-stat-muted">—</div><div class="radar-stat-caption">Not enough history yet</div>');
        }

        return html;
    }

    // Tag name → hex, for the micro-trend sparkline dots.
    const TAG_COLORS = {
        flame: '#f97316', shadow: '#94a3b8', heart: '#f472b6', reason: '#60a5fa',
        pattern: '#a78bfa', clue: '#34d399', drift: '#94a3b8', anchor: '#fbbf24',
    };

    // E · Journey depth: how many observations and which chat turns they span.
    function radarJourneyHTML() {
        const first = trail[0];
        const last = trail[trail.length - 1];
        const firstIdx = first && first.messageIndex !== undefined ? first.messageIndex : 'the first turn';
        const lastIdx = last && last.messageIndex !== undefined ? 'turn ' + last.messageIndex : 'turn ' + trail.length;
        return '<div class="radar-journey">' + trail.length + ' observed turns · spans ' + firstIdx + ' → ' + lastIdx + '</div>';
    }

    // F · Axis Journey (stats modal): mini start → mid → current sparkline per
    // axis with the net change from the first observation to now. Moved out of
    // the radar modal so that window only keeps the radar + stat cards.
    function buildStatsJourneyHTML() {
        if (trail.length === 0) return '';
        const mid = trail[Math.floor((trail.length - 1) / 2)];
        const first = getEntryScores(trail[0]);
        const midS = getEntryScores(mid);
        const lastS = getEntryScores(trail[trail.length - 1]);
        const pct = v => Math.max(2, Math.min(98, (v + MAX_SCORE) / (2 * MAX_SCORE) * 100));

        const rows = AXIS_META.map(m => {
            const f = first[m.axis] || 0;
            const md = midS[m.axis] || 0;
            const now = lastS[m.axis] || 0;
            const net = now - f;
            const lastTag = now >= 0 ? m.posTag : m.negTag;
            const dots = [
                { v: f, tag: f >= 0 ? m.posTag : m.negTag, cls: 'is-first' },
                { v: md, tag: md >= 0 ? m.posTag : m.negTag, cls: 'is-mid' },
                { v: now, tag: lastTag, cls: 'is-last is-now' },
            ].map(d =>
                '<span class="radar-micro-dot ' + d.cls + '" style="left:' + pct(d.v) + '%;background-color:' + TAG_COLORS[d.tag] + '"></span>'
            ).join('');

            const chip = net === 0
                ? '<span class="radar-micro-net is-flat">±0</span>'
                : '<span class="radar-micro-net">' + ratingChipHTML(m, net) + '</span>';

            return '<div class="radar-micro-row">' +
                '<span class="radar-micro-axis"><span class="mbti-tag-' + lastTag + '">' + ratingIconHTML(m) + '</span><span class="radar-micro-axis-name mbti-tag-' + lastTag + '">' + m.axis.toUpperCase() + '</span></span>' +
                '<span class="radar-micro-track">' + dots + '</span>' +
                '<span class="radar-micro-vals">' + (f > 0 ? '+' : '') + f + ' → ' + (now > 0 ? '+' : '') + now + '</span>' +
                chip +
            '</div>';
        }).join('');

        return '<div class="radar-footer-title">Axis Journey</div>' + '<div class="radar-micro">' + rows + '</div>';
    }

    function buildRadarFooter() {
        return radarJourneyHTML();
    }

    // G · Score Trajectory: per-axis line chart of cumulative scores across the
    // observed turns (x = turn, y = score). Fixed ±MAX_SCORE domain so the zero
    // line always sits at true center. Flip ticks mark zero-crossings; a gold
    // ring marks the single biggest single-turn delta.
    function buildTrajectoryHTML() {
        if (trail.length === 0) return '';
        const W = 600, H = 240, L = 34, R = 18, T = 12, B = 26;
        const pw = W - L - R, ph = H - T - B;
        const m = MAX_SCORE;
        const n = trail.length;
        const x = i => (n === 1 ? L + pw / 2 : L + pw * (i / (n - 1)));
        const y = v => T + ph * (0.5 - v / (2 * m));
        const turnOf = i => {
            const idx = trail[i] && trail[i].messageIndex !== undefined ? trail[i].messageIndex : i + 1;
            return idx;
        };
        const val = (i, axis) => getEntryScores(trail[i])[axis] || 0;

        let grid = '';
        grid += '<line x1="' + L + '" y1="' + y(0).toFixed(1) + '" x2="' + (W - R) + '" y2="' + y(0).toFixed(1) + '" stroke="rgba(212,175,55,0.35)" stroke-width="1"/>';
        grid += '<line x1="' + L + '" y1="' + y(m / 2).toFixed(1) + '" x2="' + (W - R) + '" y2="' + y(m / 2).toFixed(1) + '" stroke="rgba(212,197,169,0.10)" stroke-width="0.5"/>';
        grid += '<line x1="' + L + '" y1="' + y(-m / 2).toFixed(1) + '" x2="' + (W - R) + '" y2="' + y(-m / 2).toFixed(1) + '" stroke="rgba(212,197,169,0.10)" stroke-width="0.5"/>';
        const ticks = Math.min(n, 8);
        for (let k = 0; k < ticks; k++) {
            const i = Math.round((n - 1) * k / (ticks - 1));
            grid += '<line x1="' + x(i).toFixed(1) + '" y1="' + T + '" x2="' + x(i).toFixed(1) + '" y2="' + (H - B) + '" stroke="rgba(212,197,169,0.06)" stroke-width="0.5"/>';
        }
        [m, 0, -m].forEach(v => {
            grid += '<text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end" font-family="Raleway,sans-serif" font-size="8" fill="rgba(212,197,169,0.4)">' + v + '</text>';
        });
        grid += '<text x="' + L + '" y="' + (H - 10) + '" font-family="Raleway,sans-serif" font-size="8" fill="rgba(212,197,169,0.4)">turn ' + turnOf(0) + '</text>';
        grid += '<text x="' + (W - R) + '" y="' + (H - 10) + '" text-anchor="end" font-family="Raleway,sans-serif" font-size="8" fill="rgba(212,197,169,0.4)">turn ' + turnOf(n - 1) + '</text>';

        let lines = '';
        let dots = '';
        let endLabels = '';
        AXIS_META.forEach(meta => {
            const pts = (() => {
                const p = trail.map((e, i) => x(i).toFixed(1) + ',' + y(val(i, meta.axis)).toFixed(1)).join(' ');
                return n === 1 ? p + ' ' + p : p;
            })();
            lines += '<polyline points="' + pts + '" fill="none" stroke="' + meta.pos + '" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>';
            if (n <= 40) {
                trail.forEach((e, i) => {
                    const v = val(i, meta.axis);
                    dots += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.4" fill="' + meta.pos + '" opacity="0.85"><title>Turn ' + turnOf(i) + ' · ' + meta.axis.toUpperCase() + ' ' + (v > 0 ? '+' : '') + v + '</title></circle>';
                });
            }
            const lv = val(n - 1, meta.axis);
            endLabels += '<text x="' + (x(n - 1) + 5) + '" y="' + (y(lv) + 3) + '" font-family="Cinzel,serif" font-size="8" font-weight="700" fill="' + meta.pos + '">' + (lv > 0 ? '+' : '') + lv + '</text>';
        });

        // Flip ticks: mark where an axis crossed zero between consecutive turns.
        let flips = '';
        for (let i = 1; i < n; i++) {
            AXIS_META.forEach(meta => {
                const p = val(i - 1, meta.axis);
                const c = val(i, meta.axis);
                if ((p > 0 && c <= 0) || (p < 0 && c >= 0) || (p === 0 && c !== 0)) {
                    flips += '<line x1="' + x(i).toFixed(1) + '" y1="' + (y(0) - 3) + '" x2="' + x(i).toFixed(1) + '" y2="' + (y(0) + 3) + '" stroke="' + meta.pos + '" stroke-width="1.5" opacity="0.95"><title>' + meta.axis.toUpperCase() + ' crossed zero · turn ' + turnOf(i) + '</title></line>';
                }
            });
        }

        // Gold ring around the single biggest single-turn delta.
        let pivot = '';
        if (n >= 2) {
            let best = null;
            for (let i = 1; i < n; i++) {
                const d = entryDelta(trail[i], i);
                AXIS_META.forEach(meta => {
                    const dv = d[meta.axis];
                    if (dv !== 0 && (!best || Math.abs(dv) > Math.abs(best.delta))) {
                        best = { meta: meta, delta: dv, idx: i };
                    }
                });
            }
            if (best) {
                const bv = val(best.idx, best.meta.axis);
                pivot = '<circle cx="' + x(best.idx).toFixed(1) + '" cy="' + y(bv).toFixed(1) + '" r="5.5" fill="none" stroke="rgba(212,175,55,0.95)" stroke-width="1.5"><title>Biggest turnaround · turn ' + turnOf(best.idx) + ' · ' + best.meta.axis.toUpperCase() + ' ' + (best.delta > 0 ? '+' : '') + best.delta + '</title></circle>';
            }
        }

        const legend = AXIS_META.map(meta =>
            '<span class="stats-legend-item"><span class="stats-legend-line" style="background:' + meta.pos + '"></span>' + meta.axis.toUpperCase() + '</span>'
        ).join('');

        return '<div class="stats-section-title">Score Trajectory</div>' +
            '<svg viewBox="0 0 600 240" class="stats-chart-svg">' +
                grid + lines + (n > 40 ? '' : dots) + flips + pivot + endLabels +
            '</svg>' +
            '<div class="stats-legend">' + legend + '</div>';
    }

    // H · Axis Key: always-visible reference explaining the four axis initials
    // (which letter each pole maps to and what the axis measures). Static copy.
    function buildAxisKeyHTML() {
        const rows = [
            { axis: 'ie', letters: 'IE', poles: 'I/E', words: 'Introverted / Extraverted', desc: 'Where you draw energy: the inner world (I) or people and the world around you (E).' },
            { axis: 'tf', letters: 'TF', poles: 'T/F', words: 'Thinking / Feeling', desc: 'How you decide: by logic and consistency (T) or by values and empathy (F).' },
            { axis: 'sn', letters: 'SN', poles: 'S/N', words: 'Sensing / Intuitive', desc: 'How you take in information: concrete facts (S) or patterns and possibilities (N).' },
            { axis: 'jp', letters: 'JP', poles: 'J/P', words: 'Judging / Perceiving', desc: 'How you live: planned and structured (J) or flexible and open (P).' },
        ];
        const html = AXIS_META.map(meta => {
            const r = rows.find(x => x.axis === meta.axis);
            return '<div class="stats-axis-key-row">' +
                '<div class="stats-axis-key-line"><span class="stats-axis-letters" style="color:' + meta.pos + '">' + r.letters + '</span>' +
                '<span class="stats-axis-poles">' + r.poles + '</span>' +
                '<span class="stats-axis-words">' + r.words + '</span></div>' +
                '<div class="stats-axis-key-desc">' + r.desc + '</div>' +
            '</div>';
        }).join('');
        return '<div class="stats-section-title">Axis Key</div>' + '<div class="radar-micro">' + html + '</div>';
    }

    function openStatsModal() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];

        const codeEl = document.getElementById('stats-mbti-code');
        if (codeEl) {
            codeEl.textContent = arch.mbti;
            codeEl.style.color = arch.color;
        }

        const nameEl = document.getElementById('stats-archetype-name');
        if (nameEl) {
            nameEl.textContent = arch.name;
            nameEl.style.color = arch.color;
        }

        const emptyEl = document.getElementById('stats-empty');
        const journeyEl = document.getElementById('stats-journey');
        const chartEl = document.getElementById('stats-chart');
        const keyEl = document.getElementById('stats-key');
        if (keyEl) keyEl.innerHTML = buildAxisKeyHTML();
        if (trail.length === 0) {
            if (journeyEl) journeyEl.innerHTML = '';
            if (chartEl) chartEl.innerHTML = '';
            if (emptyEl) {
                emptyEl.textContent = 'No analysis data yet. Start chatting or re-scan to build your profile.';
                emptyEl.style.display = 'block';
            }
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            if (journeyEl) journeyEl.innerHTML = buildStatsJourneyHTML();
            if (chartEl) chartEl.innerHTML = buildTrajectoryHTML();
        }

        const overlay = document.getElementById('stats-overlay');
        if (overlay) overlay.classList.add('is-open');
    }

    function closeStatsModal() {
        const overlay = document.getElementById('stats-overlay');
        if (overlay) overlay.classList.remove('is-open');
    }

    function openRadarModal() {
        const key = getMBTIKey(scores);
        const arch = ARCHETYPES[key] || ARCHETYPES['unknown'];

        const codeEl = document.getElementById('radar-mbti-code');
        if (codeEl) {
            codeEl.textContent = arch.mbti;
            codeEl.style.color = arch.color;
        }

        const nameEl = document.getElementById('radar-archetype-name');
        if (nameEl) {
            nameEl.textContent = arch.name;
            nameEl.style.color = arch.color;
        }

        const emptyEl = document.getElementById('radar-empty');
        const statsEl = document.getElementById('radar-stats');
        const footerEl = document.getElementById('radar-footer');
        const canvasEl = document.getElementById('radar-canvas');
        if (canvasEl) canvasEl.innerHTML = buildRadarSVGHTML();

        if (trail.length === 0) {
            if (statsEl) statsEl.innerHTML = '';
            if (footerEl) footerEl.innerHTML = '';
            if (emptyEl) {
                emptyEl.textContent = 'No analysis data yet. Start chatting or re-scan to build your profile.';
                emptyEl.style.display = 'block';
            }
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            if (statsEl) statsEl.innerHTML = buildRadarStats();
            if (footerEl) footerEl.innerHTML = buildRadarFooter();
        }

        const overlay = document.getElementById('radar-overlay');
        if (overlay) overlay.classList.add('is-open');
    }

    function closeRadarModal() {
        const overlay = document.getElementById('radar-overlay');
        if (overlay) overlay.classList.remove('is-open');
    }

    window.MBTI_Widget = {
        closeFullArchModal: function() {
            const overlay = document.getElementById('mbti-full-arch-overlay');
            if (overlay) overlay.classList.remove('is-open');
        },
        closeHistoryModal: function() {
            closeHistoryModal();
        },
        closeRadarModal: function() {
            closeRadarModal();
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
                    <div class="header-actions" id="header-actions">
                        <button class="header-action-btn magnify-btn" id="magnify-btn" title="MBTI Type Encyclopedia">
                            <div class="magnify-icon"></div>
                        </button>
                        <button class="history-btn" id="history-btn" title="View analysis history">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                        </button>
                        <button class="header-action-btn radar-zoom-btn" id="radar-zoom-btn" title="Expand radar chart">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="7"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </button>
                        <button class="header-action-btn stats-btn" id="stats-btn" title="Stats">
                            <div class="stats-icon"></div>
                        </button>
                    </div>
                </div>
                <div class="profile-eyebrow">Your Nature</div>
                <div class="archetype-name" id="archetype-name" style="color: var(--theme-gold)">THE UNKNOWN</div>
                <div class="mbti-code" id="mbti-code">????</div>
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
                    <div class="axis-bar-item"><div class="axis-track" id="bar-ie"><div class="axis-center-mark"></div><div class="axis-fill-left bar-fill-ie-neg" id="bar-ie-left" style="width:0%"></div><div class="axis-fill-right bar-fill-ie-pos" id="bar-ie-right" style="width:0%"></div><div id="icon-ie" class="axis-track-icon" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/fire-element.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/fire-element.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-ie"></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-tf"><div class="axis-center-mark"></div><div class="axis-fill-left bar-fill-tf-neg" id="bar-tf-left" style="width:0%"></div><div class="axis-fill-right bar-fill-tf-pos" id="bar-tf-right" style="width:0%"></div><div id="icon-tf" class="axis-track-icon" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/like--v1.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/like--v1.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-tf"></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-sn"><div class="axis-center-mark"></div><div class="axis-fill-left bar-fill-sn-neg" id="bar-sn-left" style="width:0%"></div><div class="axis-fill-right bar-fill-sn-pos" id="bar-sn-right" style="width:0%"></div><div id="icon-sn" class="axis-track-icon" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/idea.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/idea.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-sn"></div></div>
                    <div class="axis-bar-item"><div class="axis-track" id="bar-jp"><div class="axis-center-mark"></div><div class="axis-fill-left bar-fill-jp-neg" id="bar-jp-left" style="width:0%"></div><div class="axis-fill-right bar-fill-jp-pos" id="bar-jp-right" style="width:0%"></div><div id="icon-jp" class="axis-track-icon" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;width:12px;height:12px;-webkit-mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/wind.png');mask-image:url('https://img.icons8.com/ios-filled/50/ffffff/wind.png');-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;transition:background-color 0.5s ease;"></div></div><div class="axis-delta" id="delta-jp"></div></div>
                </div>
                <div class="reasoning-display" id="reasoning-display">
                    <div class="reasoning-header">
                        <div class="reasoning-label" id="reasoning-label">Latest Analysis</div>
                    </div>
                    <div class="reasoning-text" id="reasoning-text">Start chatting to see analysis...</div>
                    <div class="professor-section" id="professor-section">
                        <div class="professor-label" id="professor-label">Psy Professor</div>
                        <div class="professor-text" id="professor-text"></div>
                    </div>
                </div>
                <div class="mbti-actions" id="mbti-actions">
                    <button class="action-btn" id="rescan-btn" title="Re-scan chat history — analyze past messages and rebuild the rating trail">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 4v6h6M23 20v-6h-6"/>
                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                        <span>Re-scan All</span>
                    </button>
                    <button class="action-btn" id="reanalyze-btn" title="Re-analyze the most recent turn">
                        <div class="reanalyze-icon"></div>
                        <span>Re-scan Last</span>
                    </button>
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
            <div class="rescan-budget" id="rescan-budget"></div>
            <div class="rescan-warning" id="rescan-warning" style="display:none;"></div>
            <button class="rescan-go-btn" id="rescan-go-btn">Re-scan</button>
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
                <div class="full-arch-identity" id="mbti-full-arch-identity"></div>
                <div class="full-arch-tabs-wrap" id="mbti-full-arch-tabs-wrap">
                    <div class="full-arch-tabs" id="mbti-full-arch-tabs"></div>
                    <div class="full-arch-tab-underline" id="mbti-full-arch-tab-underline"></div>
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

        const radarOverlay = document.createElement('div');
        radarOverlay.id = 'radar-overlay';
        radarOverlay.className = 'radar-overlay';
        radarOverlay.innerHTML = `
            <div class="radar-modal" id="radar-modal">
                <div class="radar-header">
                    <button class="radar-close" id="radar-close">×</button>
                    <div class="radar-mbti-code" id="radar-mbti-code">????</div>
                    <div class="radar-archetype-name" id="radar-archetype-name">THE UNKNOWN</div>
                </div>
                <div class="radar-divider"></div>
                <div class="radar-canvas" id="radar-canvas"></div>
                <div class="radar-stats" id="radar-stats"></div>
                <div class="radar-footer" id="radar-footer"></div>
                <div class="radar-empty" id="radar-empty"></div>
            </div>
        `;
        document.body.appendChild(radarOverlay);

        document.getElementById('radar-zoom-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            openRadarModal();
        });

        document.getElementById('radar-close').addEventListener('click', function() {
            closeRadarModal();
        });

        document.getElementById('radar-overlay').addEventListener('click', function(e) {
            if (e.target === this) closeRadarModal();
        });

        const statsOverlay = document.createElement('div');
        statsOverlay.id = 'stats-overlay';
        statsOverlay.className = 'stats-overlay';
        statsOverlay.innerHTML = `
            <div class="stats-modal" id="stats-modal">
                <div class="stats-header">
                    <button class="stats-close" id="stats-close">×</button>
                    <div class="stats-mbti-code" id="stats-mbti-code">????</div>
                    <div class="stats-archetype-name" id="stats-archetype-name">THE UNKNOWN</div>
                </div>
                <div class="stats-divider"></div>
                <div class="stats-body" id="stats-body">
                    <div class="stats-journey" id="stats-journey"></div>
                    <div class="stats-chart" id="stats-chart"></div>
                    <div class="stats-empty" id="stats-empty"></div>
                    <div class="stats-key" id="stats-key"></div>
                </div>
            </div>
        `;
        document.body.appendChild(statsOverlay);

        document.getElementById('stats-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            openStatsModal();
        });
        document.getElementById('stats-close').addEventListener('click', function() {
            closeStatsModal();
        });
        document.getElementById('stats-overlay').addEventListener('click', function(e) {
            if (e.target === this) closeStatsModal();
        });

        fullArchOverlay.addEventListener('click', function(e) {
            if (e.target === this) window.MBTI_Widget.closeFullArchModal();
        });
        // Delegated so the close button keeps working even after
        // openFullArchModal() re-injects it inside the illustration.
        document.addEventListener('click', function(e) {
            if (e.target && e.target.closest && e.target.closest('#mbti-full-arch-close, #mbti-full-arch-close-btn')) {
                window.MBTI_Widget.closeFullArchModal();
            }
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
            reAnalyzeLastTurn({ force: true });
        });

        document.getElementById('reasoning-label').addEventListener('click', function() {
            reasoningExpanded = !reasoningExpanded;
            if (reasoningExpanded) professorExpanded = false;
            updatePanel();
        });

        document.getElementById('professor-label').addEventListener('click', function() {
            professorExpanded = !professorExpanded;
            if (professorExpanded) reasoningExpanded = false;
            updatePanel();
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

        // Make panel draggable via shell (except interactive elements)
        const shell = panel.querySelector('.profile-shell');
        let isDraggingPanel = false;
        let panelStartX, panelStartY, panelInitialX, panelInitialY;

        shell.addEventListener('mousedown', (e) => {
            if (e.target.closest('button, input, a')) return;
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

        shell.style.cursor = 'grab';

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
        
        context.eventSource.on(context.event_types.CHAT_LOADED, async () => {
            console.log('[MBTI] CHAT_LOADED event fired');
            await loadFromChatMetadata();
            if (panelCreated) updatePanel();
        });

        context.eventSource.on(context.event_types.MESSAGE_RECEIVED, async (data) => {
            console.log('[MBTI] MESSAGE_RECEIVED event fired, data:', data);
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
                contextLength: 64000,
                learnedContextLength: 0,
            };
        }
        // Migrate existing settings that predate contextLength or used the old
        // 0 ("fall back to SillyTavern") default: 0 now means "use the 64k
        // default and auto-learn from API errors" — see getContextBudget.
        if (extension_settings.mbti_widget.customApi.contextLength === undefined ||
            extension_settings.mbti_widget.customApi.contextLength === 0) {
            extension_settings.mbti_widget.customApi.contextLength = 64000;
        }
        if (extension_settings.mbti_widget.customApi.learnedContextLength === undefined) {
            extension_settings.mbti_widget.customApi.learnedContextLength = 0;
        }
        // Persisted re-scan depth. 0 = full chat (new-install default) so the
        // whole history including message 0 is scanned; existing saved depths
        // are preserved.
        if (extension_settings.mbti_widget.rescanMessages === undefined) {
            extension_settings.mbti_widget.rescanMessages = 0;
        }

        // Prompt customization (Latest Analysis + Commenter). Keep defaults
        // backwards-compatible with the classic fixed wording.
        if (!extension_settings.mbti_widget.prompts) {
            extension_settings.mbti_widget.prompts = {
                analysisName: DEFAULT_ANALYSIS_NAME,
                analysis: DEFAULT_ANALYSIS_PROMPT,
                commenter: {
                    name: DEFAULT_COMMENT_NAME,
                    prompt: DEFAULT_COMMENT_PROMPT,
                },
            };
        } else {
            const prompts = extension_settings.mbti_widget.prompts;
            if (!prompts.analysisName) prompts.analysisName = DEFAULT_ANALYSIS_NAME;
            if (!prompts.analysis) prompts.analysis = DEFAULT_ANALYSIS_PROMPT;
            if (!prompts.commenter) prompts.commenter = {};
            if (!prompts.commenter.name) prompts.commenter.name = DEFAULT_COMMENT_NAME;
            if (!prompts.commenter.prompt) prompts.commenter.prompt = DEFAULT_COMMENT_PROMPT;
        }


        createFab();
        createPanel();

        // Initialize toggle states from settings
        jQuery('#mbti_enabled').prop('checked', extension_settings.mbti_widget.enabled);
        jQuery('#mbti_context_messages').val(extension_settings.mbti_widget.contextMessages);
        jQuery('#mbti_context_messages_value').text(extension_settings.mbti_widget.contextMessages);

        initializeBackendSettings();

        initializePromptsSettings();

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

        console.log('MBTI Widget v3.5.6 loaded');
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
        if (contextLenEl) contextLenEl.value = customApi.contextLength ?? 64000;

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

    function initializePromptsSettings() {
        const prompts = extension_settings.mbti_widget.prompts || {};

        const analysisNameEl = document.getElementById('mbti_analysis_name');
        const analysisEl = document.getElementById('mbti_prompt_analysis');
        const commenterNameEl = document.getElementById('mbti_commenter_name');
        const commenterPromptEl = document.getElementById('mbti_commenter_prompt');

        if (analysisNameEl) analysisNameEl.value = prompts.analysisName || DEFAULT_ANALYSIS_NAME;
        if (analysisEl) analysisEl.value = prompts.analysis || DEFAULT_ANALYSIS_PROMPT;
        if (commenterNameEl) commenterNameEl.value = prompts.commenter?.name || DEFAULT_COMMENT_NAME;
        if (commenterPromptEl) commenterPromptEl.value = prompts.commenter?.prompt || DEFAULT_COMMENT_PROMPT;

        jQuery('#mbti_analysis_name').on('input', function() {
            extension_settings.mbti_widget.prompts.analysisName = String(jQuery(this).val());
            saveSettingsDebounced();
            updatePanel();
        });

        jQuery('#mbti_prompt_analysis').on('input', function() {
            extension_settings.mbti_widget.prompts.analysis = String(jQuery(this).val());
            saveSettingsDebounced();
            updatePanel();
        });

        jQuery('#mbti_commenter_name').on('input', function() {
            extension_settings.mbti_widget.prompts.commenter.name = String(jQuery(this).val());
            saveSettingsDebounced();
            updatePanel();
        });

        jQuery('#mbti_commenter_prompt').on('input', function() {
            extension_settings.mbti_widget.prompts.commenter.prompt = String(jQuery(this).val());
            saveSettingsDebounced();
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