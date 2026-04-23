let keyboardEffectTimer = null;

// --- 鍵盤生成を関数化 ---
function initKeyboard() {
    const visualPiano = document.getElementById('visual-piano');
    if (!visualPiano) return;

    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let whiteKeyCount = 0;
    const whiteKeyWidth = 40; // ここを調整すると鍵盤の幅が変わります

    visualPiano.innerHTML = ''; // クリア

    for (let oct = 2; oct <= 4; oct++) {
        notes.forEach((note) => {
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
    // コンテナの幅を whiteKeyCount に合わせて固定
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

function playChord(root, quality) {
    // 1. 鍵盤用のタイマーをリセット
    if (keyboardEffectTimer) clearTimeout(keyboardEffectTimer);

    // 2. ディスプレイ（液晶）は常に点灯状態にする
    // 万が一 effect-off が付いていたら除去し、以後タイマーで付与もしない
    const displayBox = document.querySelector('.display-main');
    if (displayBox) {
        displayBox.classList.remove('effect-off');
    }

    // 3. 前に光っていた鍵盤を一旦リセット
    document.querySelectorAll('.white-key, .black-key').forEach(k => {
        k.classList.remove('key-active', 'key-active-off');
    });

    // 4. 構成音の計算（エラー回避のため、発音処理より先に実行）
    const rootName = root.replace(/[0-9]/g, ''); 
    const baseOctave = (parseInt(root.replace(/[^0-9]/g, '')) || 4); 
    const rootIdx = NOTE_MAP.indexOf(rootName);

    if (rootIdx === -1) return;

    const chordNotes = CHORD_INTERVALS[quality].map(interval => {
        const idx = (rootIdx + interval) % 12;
        const octShift = Math.floor((rootIdx + interval) / 12);
        return NOTE_MAP[idx] + (baseOctave + octShift);
    });

    // 5. 発音処理
    currentInstrument.releaseAll();
    if (currentInstrument === guitar) {
        chordNotes.forEach((note, i) => {
            currentInstrument.triggerAttackRelease(note, "2n", Tone.now() + (i * 0.05));
        });
    } else {
        currentInstrument.triggerAttackRelease(chordNotes, "2n");
    }

    // 6. ディスプレイ（コード名）の表示更新
    const display = document.getElementById('current-chord');
    if (display) {
        display.innerText = rootName + (quality === "Major" ? "" : quality);
    }
    
    // 7. 鍵盤を光らせる
    chordNotes.forEach(n => {
        const name = n.replace(/[0-9]/g, ''); 
        const oct = parseInt(n.replace(/[^0-9]/g, ''));
        const displayNote = name + (oct - 2); 
        const el = document.querySelector(`[data-note="${displayNote}"]`);
        if (el) el.classList.add('key-active');
    });

    // 8. 【鍵盤のみ】5秒後に消灯させるタイマーを設定
    // ディスプレイ（displayBox）への操作は行いません
    keyboardEffectTimer = setTimeout(() => {
        document.querySelectorAll('.key-active').forEach(k => {
            k.classList.add('key-active-off'); // CSSで強制的に色を戻す
        });
        console.log("5秒経過：鍵盤のみ消灯しました。");
    }, 5000);

    // 9. 弾いた鍵盤へ自動スクロール
    const activeKeys = document.querySelectorAll('.key-active');
    if (activeKeys.length > 0) {
        activeKeys[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}