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

// --- 1. 高品質サンプラーの定義（安定パス版） ---
const reverb = new Tone.Reverb(1.5).toDestination();

// エレキギター
const electricGuitar = new Tone.Sampler({
    urls: {
        "A2": "A2.mp3",
        "C3": "C3.mp3",
        "D3": "D3.mp3",
        "G3": "G3.mp3"
    },
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/",
    onload: () => console.log("Electric Guitar Ready")
}).connect(reverb);


// ウッドベース（コントラバス）：低音のA1, G1などを指定
const uprightBass = new Tone.Sampler({
    urls: { "A1": "A1.mp3", "E2": "E2.mp3", "G1": "G1.mp3" },
    baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/contrabass/",
    onload: () => console.log("Upright Bass Ready")
}).connect(reverb);

// ピアノ（最高峰のフリーサンプル Salamander Piano）
const piano = new Tone.Sampler({
    urls: { "A1": "A1.mp3", "A2": "A2.mp3", "A3": "A3.mp3", "A4": "A4.mp3" },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: () => console.log("Piano Loaded")
}).connect(reverb);

let currentInstrument = piano;

// 楽器切り替え
function setInstrument(type) {
    [piano, electricGuitar, uprightBass].forEach(i => i.releaseAll());
    if (type === 'electricGuitar') currentInstrument = electricGuitar;
    else if (type === 'uprightBass') currentInstrument = uprightBass;
    else currentInstrument = piano;
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
// --- ▼▼ ジャズ用コードを追加・変更 ▼▼ ---
    "7(b9)": [0, 4, 10, 13],  // sus4を削除し、こちらに差し替え（5度省きボイシング）
    "m7(b5)": [0, 3, 6, 10], // ルート, ♭3, ♭5, ♭7
    "dim7": [0, 3, 6, 9],     // ルート, ♭3, ♭5, 6(減7)
    "6": [0, 4, 7, 9]         // ルート, 3, 5, 6
    // --- ▲▲ ここまで ▲▲ ---
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

        // ▼▼ 誤判定のない、綺麗な8方向フリック判定ロジック ▼▼
        if (diffY < -threshold) {
            // 【上方向グループ】
            if (diffX < -threshold) quality = "M7";         // 左上
            else if (diffX > threshold) quality = "7(b9)";  // 右上
            else quality = "m";                             // 上
        } else if (diffY > threshold) {
            // 【下方向グループ】
            if (diffX < -threshold) quality = "dim7";       // 左下
            else if (diffX > threshold) quality = "6";      // 右下
            else quality = "m7";                            // 下
        } else {
            // 【水平方向グループ】
            if (diffX > threshold) quality = "7";           // 右
            else if (diffX < -threshold) quality = "m7(b5)";// 左
        }
        // ▲▲ ここまで ▲▲

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
    if (keyboardEffectTimer) clearTimeout(keyboardEffectTimer);

    const octaveSelect = document.getElementById('octave-select');
    const selectedOctave = octaveSelect ? parseInt(octaveSelect.value) : 4;

    document.querySelectorAll('.white-key, .black-key').forEach(k => {
        k.classList.remove('key-active', 'key-active-off');
    });

    let rootName = root.replace(/[0-9]/g, ''); 
    let rootIdx = NOTE_MAP.indexOf(rootName);
    if (rootIdx === -1) return;

    // --- ▼▼ ジャズモード（E♭移調）のロジックを追加 ▼▼ ---
    const jazzModeSelect = document.getElementById('jazz-mode-select');
    const isJazzMode = jazzModeSelect && jazzModeSelect.value === 'on';
    
    // 画面に「押したキー（表記音）」と「鳴っている音（実音）」の両方を表示するための変数
    let originalRootName = rootName; 

    if (isJazzMode) {
        // アルトサックス（E♭管）の表記音から実音へ：短3度（3半音）上げる
        rootIdx = (rootIdx + 3) % 12;
        rootName = NOTE_MAP[rootIdx];
    }
    // --- ▲▲ ここまで追加 ▲▲ ---

    const chordNotesNames = CHORD_INTERVALS[quality].map(interval => NOTE_MAP[(rootIdx + interval) % 12]);
    const bestMidiNotes = getBestInversion(chordNotesNames, selectedOctave);
    
    // --- ベース音の計算修正 ---
    let bassMidi = (NOTE_MAP.indexOf(rootName) + (selectedOctave + 1) * 12);
    
    if (currentInstrument === uprightBass) {
        bassMidi -= 12; 
    }

    const bassNote = Tone.Frequency(bassMidi, "midi").toNote();
    const chordNotes = bestMidiNotes.map(n => Tone.Frequency(n, "midi").toNote());

    currentInstrument.releaseAll();

    if (currentInstrument === uprightBass) {
        currentInstrument.triggerAttackRelease(bassNote, "8n");
    } else if (currentInstrument === electricGuitar) {
        currentInstrument.triggerAttackRelease(bassNote, "2n", Tone.now());
        chordNotes.forEach((note, i) => {
            currentInstrument.triggerAttackRelease(note, "2n", Tone.now() + 0.05 + (i * 0.04));
        });
    } else {
        currentInstrument.triggerAttackRelease([bassNote, ...chordNotes], "2n");
    }

    // --- ▼▼ コード名表示の修正 ▼▼ ---
    const display = document.getElementById('current-chord');
    if (display) {
        const chordQualityText = (quality === "Major" ? "" : quality);
        if (isJazzMode) {
            // ジャズモード時は「表記音(実音)」の形式で表示（例：C(Eb)m7）
            display.innerText = `${originalRootName}(${rootName})${chordQualityText}`;
        } else {
            display.innerText = rootName + chordQualityText;
        }
    }
    // --- ▲▲ ここまで修正 ▲▲ ---

    bestMidiNotes.forEach(midi => {
        const noteWithOct = Tone.Frequency(midi, "midi").toNote();
        const name = noteWithOct.replace(/[0-9]/g, '');
        const oct = parseInt(noteWithOct.replace(/[^0-9]/g, ''));
        const displayNote = name + (oct - 1); 
        const el = document.querySelector(`[data-note="${displayNote}"]`);
        if (el) el.classList.add('key-active');
    });

    setTimeout(() => {
        const activeKeys = document.querySelectorAll('.key-active');
        if (activeKeys.length > 0) {
            activeKeys[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, 50);

    keyboardEffectTimer = setTimeout(() => {
        document.querySelectorAll('.key-active').forEach(k => k.classList.add('key-active-off'));
    }, 5000);
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

const startAction = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    
    // ▼▼ ここに1行追加（手動演奏が始まったらデモを止める） ▼▼
    stopDemo();
    
    if (Tone.context.state !== 'running') {
        Tone.context.resume();
    }
};

// --- ▼▼ デモ演奏（4曲対応版）のロジック ▼▼ ---
let demoTimeoutId = null; // setIntervalからsetTimeout制御に切り替えるため変更
let currentDemoSong = null;
let demoIndex = 0;
let currentBpm = 96;     // 初期テンポ（BPM=96）

// 曲のタイトル定義（ボタンの文字切り替え用）
const DEMO_TITLES = {
    autumnLeaves: "枯葉",
    flyMe: "Fly Me",
    justTwo: "Just Two",
    youDBeSoNice: "You'd Be",
    virtualInsanity: "V. Insanity"
};

// 【進化版】時間をms固定ではなく、BPMと連動する「拍数（beats）」で管理します
const DEMO_SONGS = {
    autumnLeaves: [
        { root: 'D', quality: 'm7', beats: 4 }, { root: 'G', quality: '7', beats: 4 },
        { root: 'C', quality: 'M7', beats: 4 }, { root: 'F', quality: 'M7', beats: 4 },
        { root: 'B', quality: 'm7(b5)', beats: 4 }, { root: 'E', quality: '7(b9)', beats: 4 },
        { root: 'A', quality: 'm7', beats: 4 },
        // ★曲の終わりに「2拍分」のブレイク（無音）と専用表示を挿入！
        { rest: true, beats: 2, displayText: "🔄 LOOP" }
    ],
    flyMe: [
        { root: 'A', quality: 'm7', beats: 4 }, { root: 'D', quality: 'm7', beats: 4 },
        { root: 'G', quality: '7', beats: 4 }, { root: 'C', quality: 'M7', beats: 4 },
        { root: 'F', quality: 'M7', beats: 4 }, { root: 'B', quality: 'm7(b5)', beats: 4 },
        { root: 'E', quality: '7(b9)', beats: 4 },
        // ★曲の終わりに「2拍分」のブレイクを挿入
        { rest: true, beats: 2, displayText: "🔄 LOOP" }
    ],
    youDBeSoNice: [
        { root: 'A', quality: 'm7', beats: 4 }, { root: 'B', quality: '7(b9)', beats: 4 }, { root: 'E', quality: 'm7', beats: 4 }, { root: 'E', quality: 'm7', beats: 4 },
        { root: 'A', quality: 'm7', beats: 4 }, { root: 'D', quality: '7', beats: 4 },    { root: 'G', quality: 'M7', beats: 4 }, { root: 'G', quality: 'M7', beats: 4 },
        // ★曲の終わりに「2拍分」のブレイクを挿入
        { rest: true, beats: 2, displayText: "🔄 LOOP" }
    ],
    virtualInsanity: [
        { root: 'E', quality: 'm7', beats: 4 }, { root: 'A', quality: '7', beats: 4 }, { root: 'D', quality: '7', beats: 4 }, { root: 'G', quality: 'M7', beats: 4 },
        { root: 'C', quality: 'M7', beats: 4 }, { root: 'F#', quality: 'm7(b5)', beats: 4 }, { root: 'B', quality: '7(b9)', beats: 4 }, { root: 'E', quality: 'm', beats: 4 },
        // ★曲の終わりに「2拍分」のブレイクを挿入
        { rest: true, beats: 2, displayText: "🔄 LOOP" }
    ],

// ★★★ Just the Two of Us：画像2枚分の全展開を完全再現 ★★★
    justTwo: [
        // ====== 【セクション1：メインの王道ループ (画像1枚目)】 ======
        // 1〜2回目リピート（キレのある0.5拍のブレイク休符を完全に再現！）
        { root: 'C', quality: 'M7', beats: 1.5, displayText: "🎵 MAIN A" }, // Cmaj7 (1.5拍: タッ)
        { root: 'B', quality: '7(b9)', beats: 2.5 },                     // B7(b9) (2.5拍: タッ)
        { root: 'E', quality: 'm7', beats: 3.5 },                        // Em7    (3.5拍: ダーーーン)
        { rest: true, beats: 0.5, displayText: "⏳ (ッ)" },               // 4拍目裏でスパッとキレよく無音化！

        // 3〜4回目（おなじみのサビ終わりパッセージ。流れるようにDm7→G7へ）
        { root: 'C', quality: 'M7', beats: 1.5 },
        { root: 'B', quality: '7(b9)', beats: 2.5 },
        { root: 'E', quality: 'm7', beats: 2.0 },                        // Em7 を2拍キープしてから...
        { root: 'D', quality: 'm7', beats: 1.0 },                        // Dm7 (1拍で素早くチェンジ！: タ)
        { root: 'G', quality: '7', beats: 1.0 },                         // G7  (1拍で転がるように次へ: タ)

        // もうワンループ挟んで、スムーズに画像2枚目のブリッジへ繋ぎます
        { root: 'C', quality: 'M7', beats: 1.5, displayText: "🎵 MAIN B" },
        { root: 'B', quality: '7(b9)', beats: 2.5 },
        { root: 'E', quality: 'm7', beats: 3.5 },
        { rest: true, beats: 0.5, displayText: "⏳ (ッ)" },

        { root: 'C', quality: 'M7', beats: 1.5 },
        { root: 'B', quality: '7(b9)', beats: 2.5 },
        { root: 'E', quality: 'm7', beats: 4.0 },                        // ここはブレイクせず、たっぷり4拍伸ばす！

        // ====== 【セクション2：お洒落すぎる下降ブリッジ (画像2枚目の前半)】 ======
        // Cmaj7 -> B7 -> A#maj7 -> A7 （ここもメインのハネるリズムを踏襲させて激エモに！）
        { root: 'C', quality: 'M7', beats: 1.5, displayText: "🎷 BRIDGE 1" },
        { root: 'B', quality: '7(b9)', beats: 2.5 },
        { root: 'A#', quality: 'M7', beats: 1.5 },                       // 黒鍵ルートのA#もアプリ内部マップで完全対応！
        { root: 'A', quality: '7', beats: 2.5 },
        
        // G#maj7 -> G7 -> Cmaj7 -> F6 
        { root: 'G#', quality: 'M7', beats: 1.5 },
        { root: 'G', quality: '7', beats: 2.5 },
        { root: 'C', quality: 'M7', beats: 2.0 },
        { root: 'F', quality: '6', beats: 2.0 },                          // F6 の哀愁ある響きで着地

        // ブリッジのリピート（画像2枚目の3〜4行目）
        { root: 'C', quality: 'M7', beats: 1.5, displayText: "🎷 BRIDGE 2" },
        { root: 'B', quality: '7(b9)', beats: 2.5 },
        { root: 'A#', quality: 'M7', beats: 1.5 },
        { root: 'A', quality: '7', beats: 2.5 },
        
        { root: 'G#', quality: 'M7', beats: 1.5 },
        { root: 'G', quality: '7', beats: 2.5 },
        { root: 'C', quality: 'M7', beats: 2.0 },
        { root: 'F', quality: '6', beats: 2.0 },

        // ====== 【セクション3：ラストの締めから次のループへの架け橋 (画像2枚目の後半)】 ======
        { root: 'C', quality: 'M7', beats: 1.5, displayText: "🎵 OUTRO" },
        { root: 'B', quality: '7(b9)', beats: 2.5 },
        { root: 'E', quality: 'm7', beats: 3.5 },
        { rest: true, beats: 0.5, displayText: "⏳ (ッ)" },

        { root: 'C', quality: 'M7', beats: 1.5 },
        { root: 'B', quality: '7(b9)', beats: 2.5 },
        { root: 'E', quality: 'm7', beats: 4.0 },
        
        // ★ 1周終わったことがハッキリ分かるよう、丸々1小節（4拍分）の特大ブレイク＆ループ表示を挿入！
        { rest: true, beats: 4.0, displayText: "🔄 NEXT LOOP" }
    ]
};
// ==========================================
// 6. デモ演奏（オートプレイ）ロジック（テンポ可変版）
// ==========================================

// BPMから1コード（4拍分）のミリ秒を計算する関数
function getChordInterval() {
    return (240000 / currentBpm); 
}

// スライダーを動かしたときにリアルタイムで数値を書き換える関数
function updateTempo(val) {
    currentBpm = parseInt(val);
    const tempoVal = document.getElementById('tempo-val');
    if (tempoVal) tempoVal.innerText = val;
}

function toggleDemo(songKey) {
    if (demoTimeoutId && currentDemoSong === songKey) {
        stopDemo();
        return;
    }
    if (demoTimeoutId) {
        stopDemo();
    }

    if (Tone.context.state !== 'running') {
        Tone.context.resume();
    }

    const song = DEMO_SONGS[songKey];
    if (!song) return;

    currentDemoSong = songKey;
    demoIndex = 0;

    // DEMO_TITLES を使って対象ボタンの表記を Stop に変更
    const btn = document.getElementById(`btn-${songKey}`);
    if (btn) {
        btn.classList.add('playing');
        btn.innerText = `■ ${DEMO_TITLES[songKey]} (Stop)`;
    }

    const playNext = () => {
        const chord = song[demoIndex];
        
        // --- ★拍数（beats）とBPMから、次のコードまでのミリ秒を動的に計算する高精度ロジック ★ ---
        const oneBeatMs = 60000 / currentBpm;  // 1拍あたりのミリ秒
        const beats = chord.beats || 4;        // 設定がないデータはデフォルト4拍
        const delay = oneBeatMs * beats;       // このステップの長さ（ms）
        
        if (chord.rest) {
            // 休符データの場合は音を止めてインジケータを待機状態に
            currentInstrument.releaseAll();
            const display = document.getElementById('current-chord');
            
            // データ内に記述した displayText（🔄 LOOP など）があればそれを、無ければBREAKを表示
            if (display) display.innerText = chord.displayText || "⏳ (BREAK)";
            
            document.querySelectorAll('.white-key, .black-key').forEach(k => {
                k.classList.remove('key-active', 'key-active-off');
            });
        } else {
            // 通常通りのコード再生
            playChord(chord.root, chord.quality);
        }

        demoIndex = (demoIndex + 1) % song.length;
        
        // 動的に割り出したdelay（待機時間）を使って次のタイマーを回す
        demoTimeoutId = setTimeout(playNext, delay);
    };
    playNext();
}

function stopDemo() {
    if (!demoTimeoutId) return;

    clearTimeout(demoTimeoutId);
    demoTimeoutId = null;
    currentDemoSong = null;

// 全てのボタンを DEMO_TITLES を使って元の表記にリセット
    Object.keys(DEMO_TITLES).forEach(key => {
        const btn = document.getElementById(`btn-${key}`);
        if (btn) {
            btn.classList.remove('playing');
            btn.innerText = `▶ ${DEMO_TITLES[key]} (Demo)`;
        }
    });
}