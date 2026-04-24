let keyboardEffectTimer = null;
// 直前の和音の平均ピッチを保持する変数（初期値は真ん中のC付近）
let lastAveragePitch = 60;

// --- 鍵盤生成関数（initKeyboard）の修正 ---
function initKeyboard() {
    const visualPiano = document.getElementById('visual-piano');
    if (!visualPiano) return;

    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let whiteKeyCount = 0;
    const whiteKeyWidth = 40;

    visualPiano.innerHTML = ''; 

    // オクターブ2から5まで生成
    for (let oct = 2; oct <= 5; oct++) {
        notes.forEach((note) => {
            // C6より上の音はいらないのでストップ
            if (oct === 5 && note !== "C") return;

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
    visualPiano.style.width = (whiteKeyCount * whiteKeyWidth) + "px";
}

// ページ読み込み完了時に実行
document.addEventListener('DOMContentLoaded', initKeyboard);

// --- 1. 音源設定 ---
const reverb = new Tone.Reverb(1.5).toDestination();
let effectTimer = null; // タイマー管理用変数
// 【本物のピアノ】
const piano = new Tone.Sampler({
    urls: { "A1": "A1.mp3", "A2": "A2.mp3", "A3": "A3.mp3", "A4": "A4.mp3" },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: () => console.log("Piano Ready")
}).connect(reverb);

// 【本物のギター】
const guitar = new Tone.Sampler({
    urls: {
        "A2": "A2.mp3",
        "E2": "E2.mp3",
        "G3": "G3.mp3"
    },
    baseUrl: "https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-acoustic/",
    onload: () => console.log("Guitar Ready")
}).connect(reverb);

// --- synth（第2音源）をサンプラーに変更 ---
const synth = new Tone.Sampler({
    urls: {
        "A0": "A0.mp3",
        "C1": "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        "A1": "A1.mp3"
    },
    // ファイル名が確実に一致する別のリポジトリ
    baseUrl: "https://tonejs.github.io/audio/salamander/", 
    onload: () => console.log("Second Sampler Ready")
}).connect(reverb);

// 最初はピアノをセット
let currentInstrument = piano;

// 楽器切り替え関数（ここが重要です！）
function setInstrument(type) {
    // 全ての音を一度止める
    piano.releaseAll();
    guitar.releaseAll();
    synth.releaseAll();

    if (type === 'piano') {
        currentInstrument = piano;
    } else if (type === 'guitar') {
        currentInstrument = guitar;
    } else {
        currentInstrument = synth;
    }
    console.log("Switched to:", type);
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

// --- 2. データ定義の拡張 ---
const CHORD_INTERVALS = { 
    "Major": [0, 4, 7], 
    "m": [0, 3, 7], 
    "7": [0, 4, 7, 10], 
    "m7": [0, 3, 7, 10],
    "M7": [0, 4, 7, 11],  // メジャーセブンを追加
    "sus4": [0, 5, 7]     // サスフォーを追加
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
        const threshold = 30; 

        // 斜め判定を含む8方向認識
        if (diffY < -threshold && diffX < -threshold) {
            quality = "M7";   // 左上：M7
        } else if (diffY < -threshold && diffX > threshold) {
            quality = "sus4"; // 右上：sus4
        } else if (diffY < -threshold) {
            quality = "m";    // 上：m
        } else if (diffX > threshold) {
            quality = "7";    // 右：7
        } else if (diffY > threshold) {
            quality = "m7";   // 下：m7
        }

        let root = key.dataset.root;
        if (!/\d/.test(root)) root += "4";
        playChord(root, quality);
    };

    key.addEventListener('touchstart', startAction, {passive: false});
    key.addEventListener('touchend', endAction, {passive: false});
    
    // PCブラウザでのテスト用
    key.addEventListener('mousedown', startAction);
    key.addEventListener('mouseup', endAction);
});

// --- 3. 発音ロジックの改良（ボイスリーディング対応版） ---
function playChord(root, quality) {
    if (keyboardEffectTimer) clearTimeout(keyboardEffectTimer);

    const octaveSelect = document.getElementById('octave-select');
    // UIで選んだオクターブ (3, 4, 5)
    const selectedOctave = octaveSelect ? parseInt(octaveSelect.value) : 4;

    // 表示系エフェクトのリセット
    const displayBox = document.querySelector('.display-main');
    if (displayBox) displayBox.classList.remove('effect-off');
    document.querySelectorAll('.white-key, .black-key').forEach(k => {
        k.classList.remove('key-active', 'key-active-off');
    });

    const rootName = root.replace(/[0-9]/g, ''); 
    const rootIdx = NOTE_MAP.indexOf(rootName);
    if (rootIdx === -1) return;

    // 1. 和音の構成音（音名）を計算
    const chordNotesNames = CHORD_INTERVALS[quality].map(interval => {
        return NOTE_MAP[(rootIdx + interval) % 12];
    });

    // 2. 最適なボイシング（MIDI番号）を計算
    // selectedOctaveが3なら、MIDI番号48(C3)付近を基準に和音を作る
    const bestMidiNotes = getBestInversion(chordNotesNames, selectedOctave);
    
    // 3. ベース音の準備（音は鳴らすが、光らせないリスト）
    // 選択オクターブの1オクターブ下をベースとする
    const bassMidi = (NOTE_MAP.indexOf(rootName) + (selectedOctave + 1) * 12);
    const playNotes = [bassMidi, ...bestMidiNotes].map(n => Tone.Frequency(n, "midi").toNote());

    // 4. 発音処理
    currentInstrument.releaseAll();
    if (currentInstrument === guitar) {
        currentInstrument.triggerAttackRelease(playNotes[0], "2n", Tone.now());
        bestMidiNotes.forEach((midi, i) => {
            const note = Tone.Frequency(midi, "midi").toNote();
            currentInstrument.triggerAttackRelease(note, "2n", Tone.now() + 0.05 + (i * 0.05));
        });
    } else {
        currentInstrument.triggerAttackRelease(playNotes, "2n");
    }

    // --- 表示処理 ---
    const display = document.getElementById('current-chord');
    if (display) display.innerText = rootName + (quality === "Major" ? "" : quality);

    // 【重要】和音の構成音（bestMidiNotes）だけを光らせる
    bestMidiNotes.forEach(midi => {
        // MIDI番号から音名+オクターブを取得 (例: 48 -> "C3")
        const noteWithOct = Tone.Frequency(midi, "midi").toNote();
        
        // 画面上の鍵盤（C2〜D4）にマッピングするための調整
        // MIDI番号48はC3ですが、画面の構成に合わせてオクターブ値を-1して検索します
        const name = noteWithOct.replace(/[0-9]/g, '');
        const oct = parseInt(noteWithOct.replace(/[^0-9]/g, ''));
        const displayNote = name + (oct - 1); // 画面のデータ属性(data-note)に合わせる

        const el = document.querySelector(`[data-note="${displayNote}"]`);
        if (el) el.classList.add('key-active');
    });

    keyboardEffectTimer = setTimeout(() => {
        document.querySelectorAll('.key-active').forEach(k => k.classList.add('key-active-off'));
    }, 5000);

    // 7. スクロール（新しく光った鍵盤へ自動フォーカス）
    // 少し遅らせて実行することで、描画タイミングとのズレを防ぎます
    setTimeout(() => {
        const activeKeys = document.querySelectorAll('.key-active');
        if (activeKeys.length > 0) {
            // 最初（一番左側）の活動鍵盤を中央付近に表示
            activeKeys[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest', 
                inline: 'center' 
            });
        }
    }, 50);
}

/**
 * ターゲットオクターブを考慮した最短距離計算
 */
function getBestInversion(chordNotes, targetOctave) {
    // MIDI番号のオフセットを調整（画面上のLow=3のとき、MIDIの48付近から始まるように）
    const octaveOffset = (targetOctave + 1) * 12; 
    const targetCenter = octaveOffset + 6; 
    
    let patterns = [];
    for (let i = 0; i < chordNotes.length; i++) {
        let pattern = [];
        for (let j = 0; j < chordNotes.length; j++) {
            let noteIdx = (i + j) % chordNotes.length;
            let midi = NOTE_MAP.indexOf(chordNotes[noteIdx]) + octaveOffset;
            if (j > 0 && midi <= pattern[j-1]) midi += 12;
            pattern.push(midi);
        }
        patterns.push(pattern);
    }

    let bestPattern = patterns[0];
    let minScore = Infinity;

    patterns.forEach(pattern => {
        const avg = pattern.reduce((a, b) => a + b) / pattern.length;
        const distFromLast = Math.abs(avg - lastAveragePitch);
        const distFromTarget = Math.abs(avg - targetCenter);
        
        // 直前の音を優先しつつ、ユーザーが選んだオクターブの範囲内に収まるようにスコアリング
        const score = (distFromLast * 0.7) + (distFromTarget * 0.3);

        if (score < minScore) {
            minScore = score;
            bestPattern = pattern;
        }
    });

    lastAveragePitch = bestPattern.reduce((a, b) => a + b) / bestPattern.length;
    return bestPattern;
}   