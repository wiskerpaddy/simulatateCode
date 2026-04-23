// --- 1. サンプラーの設定 ---
const reverb = new Tone.Reverb(1.5).toDestination();

// ピアノサンプラー（ファイル名を公式の最新版に合わせました）
const piano = new Tone.Sampler({
    urls: {
        "A1": "A1.mp3", "A2": "A2.mp3", "A3": "A3.mp3", "A4": "A4.mp3",
        "C2": "C2.mp3", "C3": "C3.mp3", "C4": "C4.mp3", "C5": "C5.mp3"
    },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: () => console.log("Piano loaded!")
}).connect(reverb);

// 予備のシンセ
const synth = new Tone.PolySynth(Tone.Synth).connect(reverb);

let currentInstrument = piano;

function setInstrument(type) {
    currentInstrument = (type === 'piano') ? piano : synth;
}

// --- 1. 音源設定 (Tone.js) ---
// 起動時にエラーが出ないよう、PolySynthを定義。
// 最初のタッチイベントで context を再開させます。
const polySynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 }
}).toDestination();

// --- 0. ピアノ鍵盤の自動生成 (C2〜D4に変更) ---
const visualPiano = document.getElementById('visual-piano');
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
let whiteKeyCount = 0;
const whiteKeyWidth = 40;

visualPiano.innerHTML = ''; // 既存の鍵盤をクリア

for (let oct = 2; oct <= 4; oct++) { // 2から4までに変更
    notes.forEach((note) => {
        // D4より上の音はいらないのでストップ
        if (oct === 4 && !["C", "C#", "D"].includes(note)) return;

        const isBlack = note.includes('#');
        const el = document.createElement('div');
        el.className = isBlack ? 'black-key' : 'white-key';
        el.dataset.note = note + oct;

        if (isBlack) {
            el.style.left = (whiteKeyCount * whiteKeyWidth - 13) + "px";
        } else {
            el.style.left = (whiteKeyCount * whiteKeyWidth) + "px";
            whiteKeyCount++;
        }
        visualPiano.appendChild(el);
    });
}
visualPiano.style.minWidth = (whiteKeyCount * whiteKeyWidth) + "px";

// --- 2. データ定義 ---
const CHORD_INTERVALS = { 
    "Major": [0, 4, 7], 
    "m": [0, 3, 7], 
    "7": [0, 4, 7, 10], 
    "m7": [0, 3, 7, 10] 
};
const NOTE_MAP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// --- 3. フリックロジック ---
let startX, startY;
const keys = document.querySelectorAll('.ime-key');

keys.forEach(key => {
    // マウス操作でも確認できるように 'mousedown' も追加（デバッグ用）
    const startAction = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        
        // ブラウザの音声再生制限を解除（重要）
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }
    };

    const endAction = (e) => {
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const diffX = touch.clientX - startX;
        const diffY = touch.clientY - startY;
        
        let quality = "Major";
        const threshold = 30; // フリック判定の距離
        
        // 方向判定
        if (diffY < -threshold) quality = "m";      // 上
        else if (diffX > threshold) quality = "7";  // 右
        else if (diffY > threshold) quality = "m7"; // 下

        let root = key.dataset.root;
        // 数字が含まれていない場合（C, Dなど）はオクターブ4を付与
        if (!/\d/.test(root)) {
            root += "4";
        }

        playChord(root, quality);
    };

    key.addEventListener('touchstart', startAction, {passive: false});
    key.addEventListener('touchend', endAction, {passive: false});
    
    // PCブラウザでのテスト用
    key.addEventListener('mousedown', startAction);
    key.addEventListener('mouseup', endAction);
});

// --- playChord関数内の修正 ---
function playChord(root, quality) {
    currentInstrument.releaseAll();
    document.querySelectorAll('.white-key, .black-key').forEach(k => k.classList.remove('key-active'));

    const rootName = root.replace(/[0-9]/g, ''); 
    const baseOctave = (parseInt(root.replace(/[^0-9]/g, '')) || 4); 
    const rootIdx = NOTE_MAP.indexOf(rootName);

    if (rootIdx === -1) return;

    // 構成音を先に定義（これでReferenceErrorを回避）
    const chordNotes = CHORD_INTERVALS[quality].map(interval => {
        const idx = (rootIdx + interval) % 12;
        const octShift = Math.floor((rootIdx + interval) / 12);
        return NOTE_MAP[idx] + (baseOctave + octShift);
    });

    // 発音
    currentInstrument.triggerAttackRelease(chordNotes, "2n");

    // ディスプレイ表示
    const display = document.getElementById('current-chord');
    if (display) {
        display.innerText = rootName + (quality === "Major" ? "" : quality);
    }
    
    // 表示上の鍵盤を光らせる（2オクターブ下を狙う）
    chordNotes.forEach(n => {
        const name = n.replace(/[0-9]/g, ''); 
        const oct = parseInt(n.replace(/[^0-9]/g, ''));
        const displayNote = name + (oct - 2); 
        const el = document.querySelector(`[data-note="${displayNote}"]`);
        if (el) el.classList.add('key-active');
    });

    const activeKeys = document.querySelectorAll('.key-active');
    if (activeKeys.length > 0) {
        activeKeys[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}