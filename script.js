// --- 1. ピアノ鍵盤の生成 ---
const pianoBody = document.getElementById('piano-body');
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
for(let oct=3; oct<=5; oct++){
    notes.forEach((note, idx) => {
        const isBlack = note.includes('#');
        const el = document.createElement('div');
        el.className = isBlack ? 'black-key' : 'white-key';
        el.dataset.note = note + oct;
        if(isBlack){
            const prevWhitePos = (pianoBody.querySelectorAll('.white-key').length) * 40;
            el.style.left = prevWhitePos + 'px';
        }
        pianoBody.appendChild(el);
    });
}

// --- 2. 音源設定 (Tone.js) ---
// 少しピアノ寄りの柔らかい音
const polySynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 }
}).toDestination();

// --- 3. フリックロジック ---
const CHORD_INTERVALS = { "Major": [0,4,7], "m": [0,3,7], "7": [0,4,7,10], "m7": [0,3,7,10] };
const NOTE_MAP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

let startX, startY;
const keys = document.querySelectorAll('.ime-key');

keys.forEach(key => {
    key.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        key.classList.add('active-root');
        Tone.start();
    });

    key.addEventListener('touchend', e => {
        key.classList.remove('active-root');
        const diffX = e.changedTouches[0].clientX - startX;
        const diffY = e.changedTouches[0].clientY - startY;
        
        let quality = "Major";
        const threshold = 40;
        if (diffY < -threshold) quality = "m";
        else if (diffX > threshold) quality = "7";
        else if (diffY > threshold) quality = "m7";

        playChord(key.dataset.root, quality);
    });
});

function playChord(root, quality) {
    polySynth.releaseAll();
    document.querySelectorAll('.white-key, .black-key').forEach(k => k.classList.remove('key-active'));

    const rootName = root.slice(0, -1);
    const octave = parseInt(root.slice(-1));
    const rootIdx = NOTE_MAP.indexOf(rootName);

    const chordNotes = CHORD_INTERVALS[quality].map(interval => {
        const idx = (rootIdx + interval) % 12;
        const octShift = Math.floor((rootIdx + interval) / 12);
        return NOTE_MAP[idx] + (octave + octShift);
    });

    polySynth.triggerAttackRelease(chordNotes, "2n");
    document.getElementById('chord-name').innerText = rootName + (quality === "Major" ? "" : quality);
    
    chordNotes.forEach(n => {
        const el = document.querySelector(`[data-note="${n}"]`);
        if(el) el.classList.add('key-active');
    });
}