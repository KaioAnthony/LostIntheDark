import * as THREE from 'three';

// ==========================================
// CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================
const configuracoes = {
    volSfx: parseInt(localStorage.getItem('cfg_sfx_vol') ?? '100'),
    volMusic: parseInt(localStorage.getItem('cfg_music_vol') ?? '100'),
    autoStart: localStorage.getItem('cfg_autostart') === 'true',
    modo: localStorage.getItem('cfg_modo') || "Normal", 
    fasesSpeedrun: parseInt(localStorage.getItem('cfg_fases')) || 5,
    speedrunSkills: localStorage.getItem('cfg_sr_skills') !== 'false',
    colorMode: localStorage.getItem('cfg_color_mode') || 'custom',
    customColorHex: localStorage.getItem('cfg_custom_hex') || '#00f2fe',
    degradeA: localStorage.getItem('cfg_degrade_a') || '#ff0055',
    degradeB: localStorage.getItem('cfg_degrade_b') || '#00ffff'
};

let shopPoints = parseInt(localStorage.getItem('shop_points')) || 0;
let unlockedRainbow = localStorage.getItem('shop_rainbow_unlocked') === 'true';
let unlockedDegrade = localStorage.getItem('shop_degrade_unlocked') === 'true';

// Níveis de Habilidades (declarados no início para evitar erros de inicialização)
let nivelLuz = parseInt(localStorage.getItem('skill_light')) || 0;
let nivelDash = parseInt(localStorage.getItem('skill_dash')) || 0;
let nivelBreak = parseInt(localStorage.getItem('skill_break')) || 0;
let nivelFreeze = parseInt(localStorage.getItem('skill_freeze')) || 0;

let estadoJogo = "Inicio"; 
let timerInterval = null, speedrunGlobalTimer = null, tempoGlobal = 0, nivel = 1;
let larguraLabirinto = 8, alturaLabirinto = 8;
let posInicialPlayer = new THREE.Vector3();
let ultimoSomMovimento = 0;
let modoPendente = null;

let currentMapa = []; 
let offsetX = 0, offsetZ = 0;
let meshesParedes = [], moedasInfinito = [], trailObjects = [];

let luzesChao = [];
const MAX_LUZES_CHAO = 3;
let visaoAtiva = false;
let tempoCongelado = false;
let tempoGlobalMs = 0;
let ultimoTempoFrame = 0;

let estaMovendo = false;
let currentMoveDir = {x: 0, z: 0};
let bufferedInput = null;
const posAlvo = new THREE.Vector3();
let targetRotationY = 0; 

let cdLuzTimer = 0, cdDashTimer = 0, cdBreakTimer = 0, cdFreezeTimer = 0;
const CD_LUZ_MAX = 500; 
const CD_DASH_MAX = 23000; 
const CD_BREAK_MAX = 60000; 
const CD_FREEZE_MAX = 40000;

// Mapeamento seguro de elementos do DOM
const elements = {
    hudTimer: document.getElementById('hud-timer'),
    hudCompass: document.getElementById('hud-compass'),
    compassArrow: document.getElementById('compass-arrow'),
    hudScore: document.getElementById('hud-score'),
    hudSkills: document.getElementById('hud-skills'),
    cdLight: document.getElementById('cd-light'),
    cdDash: document.getElementById('cd-dash'),
    cdBreak: document.getElementById('cd-break'),
    cdFreeze: document.getElementById('cd-freeze'),
    skillLightBtn: document.getElementById('skill-light-btn'),
    skillDashBtn: document.getElementById('skill-dash-btn'),
    skillBreakBtn: document.getElementById('skill-break-btn'),
    skillFreezeBtn: document.getElementById('skill-freeze-btn'),
    overlay: document.getElementById('screen-overlay'),
    modalInicio: document.getElementById('modal-inicio'),
    modalPause: document.getElementById('modal-pause'),
    btnPause: document.getElementById('btn-pause'),
    dpad: document.getElementById('dpad-container'),
    title: document.getElementById('modal-title'),
    msg: document.getElementById('modal-msg'),
    runStats: document.getElementById('run-stats'),
    shopPointsDisplays: document.querySelectorAll('.shop-points-display')
};

function atualizarPontosLoja() {
    elements.shopPointsDisplays.forEach(el => el.innerText = `Pontos: ${shopPoints}`);
}

function formatarTempoSpeedrun(ms) {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor((ms % 1000) / 10); // 2 dígitos de milissegundos (00-99)
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

// Configurações de Sliders de Áudio
const sliderSfx = document.getElementById('slider-sfx');
const sliderMusic = document.getElementById('slider-music');
const lblSfx = document.getElementById('lbl-sfx');
const lblMusic = document.getElementById('lbl-music');

if (sliderSfx && lblSfx) {
    sliderSfx.value = configuracoes.volSfx;
    lblSfx.innerText = `SFX: ${configuracoes.volSfx}%`;
    sliderSfx.addEventListener('input', (e) => {
        configuracoes.volSfx = parseInt(e.target.value);
        localStorage.setItem('cfg_sfx_vol', configuracoes.volSfx);
        lblSfx.innerText = `SFX: ${configuracoes.volSfx}%`;
    });
}

if (sliderMusic && lblMusic) {
    sliderMusic.value = configuracoes.volMusic;
    lblMusic.innerText = `Música: ${configuracoes.volMusic}%`;
    sliderMusic.addEventListener('input', (e) => {
        configuracoes.volMusic = parseInt(e.target.value);
        localStorage.setItem('cfg_music_vol', configuracoes.volMusic);
        lblMusic.innerText = `Música: ${configuracoes.volMusic}%`;
        gerenciarMusicaFundo();
    });
}

const btnAutoStart = document.getElementById('btn-chk-autostart');
function atualizarBtnAutoStart() {
    if(btnAutoStart) {
        btnAutoStart.innerText = `Auto-Start: ${configuracoes.autoStart ? 'ON' : 'OFF'}`;
        btnAutoStart.classList.toggle('active', configuracoes.autoStart);
    }
}
atualizarBtnAutoStart();
if(btnAutoStart) {
    btnAutoStart.addEventListener('click', () => {
        configuracoes.autoStart = !configuracoes.autoStart;
        localStorage.setItem('cfg_autostart', configuracoes.autoStart);
        atualizarBtnAutoStart();
    });
}

const elFasesVal = document.getElementById('fases-val');
if(elFasesVal) elFasesVal.innerText = configuracoes.fasesSpeedrun;

const btnFasesMinus = document.getElementById('btn-fases-minus');
if(btnFasesMinus) {
    btnFasesMinus.addEventListener('click', () => {
        if (configuracoes.fasesSpeedrun > 5) {
            configuracoes.fasesSpeedrun -= 1;
            localStorage.setItem('cfg_fases', configuracoes.fasesSpeedrun);
            if(elFasesVal) elFasesVal.innerText = configuracoes.fasesSpeedrun;
        }
    });
}

const btnFasesPlus = document.getElementById('btn-fases-plus');
if(btnFasesPlus) {
    btnFasesPlus.addEventListener('click', () => {
        if (configuracoes.fasesSpeedrun < 999) {
            configuracoes.fasesSpeedrun += 1;
            localStorage.setItem('cfg_fases', configuracoes.fasesSpeedrun);
            if(elFasesVal) elFasesVal.innerText = configuracoes.fasesSpeedrun;
        }
    });
}

const btnSrSkills = document.getElementById('btn-chk-speedrun-skills');
function atualizarBtnSrSkills() {
    if(btnSrSkills) {
        btnSrSkills.innerText = `Poderes: ${configuracoes.speedrunSkills ? 'ON' : 'OFF'}`;
        btnSrSkills.classList.toggle('active', configuracoes.speedrunSkills);
    }
}
atualizarBtnSrSkills();
if(btnSrSkills) {
    btnSrSkills.addEventListener('click', () => {
        configuracoes.speedrunSkills = !configuracoes.speedrunSkills;
        localStorage.setItem('cfg_sr_skills', configuracoes.speedrunSkills);
        atualizarBtnSrSkills();
    });
}

if (["Hard2", "Hard3"].includes(configuracoes.modo)) {
    configuracoes.modo = "Normal"; localStorage.setItem('cfg_modo', "Normal");
}

function atualizarBotoesModo() {
    document.querySelectorAll('.btn-mode-select').forEach(btn => {
        const isSelected = btn.dataset.mode === configuracoes.modo;
        btn.classList.toggle('active', isSelected);
    });
}
const btnResetProgress = document.getElementById('btn-reset-progress');
const modalAlertaReset = document.getElementById('modal-alerta-reset');
const btnConfirmReset = document.getElementById('btn-confirm-reset');
const btnCancelReset = document.getElementById('btn-cancel-reset');

if (btnResetProgress) {
    btnResetProgress.addEventListener('click', () => {
        if (elements.modalPause) elements.modalPause.className = "minecraft-panel screen-hidden";
        if (modalAlertaReset) modalAlertaReset.className = "minecraft-panel screen-active";
    });
}

if (btnCancelReset) {
    btnCancelReset.addEventListener('click', () => {
        if (modalAlertaReset) modalAlertaReset.className = "minecraft-panel screen-hidden";
        if (elements.modalPause) elements.modalPause.className = "minecraft-panel screen-active";
    });
}

if (btnConfirmReset) {
    btnConfirmReset.addEventListener('click', () => {
        localStorage.clear();
        location.reload();
    });
}

atualizarBotoesModo();
atualizarPontosLoja();




// ==========================================
// SISTEMA DE ÁUDIO E SINTETIZADOR
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const bgmElement = document.getElementById('bgm-music');
let bgmOsc = null, bgmGain = null, bgmLfo = null;

function gerenciarMusicaFundo() {
    const volRatio = (configuracoes.volMusic / 100) * 0.25;
    
    if (bgmElement) {
        bgmElement.volume = Math.max(0, Math.min(1, volRatio));
        if (configuracoes.volMusic > 0) {
            if (bgmElement.paused) bgmElement.play().catch(() => {});
        } else {
            bgmElement.pause();
        }
    }

    if (!bgmElement || bgmElement.paused) {
        if (configuracoes.volMusic <= 0) {
            if (bgmGain) bgmGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
            return;
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        if (!bgmOsc) {
            bgmOsc = audioCtx.createOscillator();
            bgmOsc.type = 'triangle';
            bgmOsc.frequency.value = 55;
            
            bgmLfo = audioCtx.createOscillator();
            bgmLfo.type = 'sine';
            bgmLfo.frequency.value = 0.5;

            let lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 5;
            bgmLfo.connect(lfoGain);
            lfoGain.connect(bgmOsc.frequency);
            
            bgmGain = audioCtx.createGain();
            bgmGain.gain.value = 0;
            
            bgmOsc.connect(bgmGain);
            bgmGain.connect(audioCtx.destination);
            
            bgmOsc.start();
            bgmLfo.start();
        }
        bgmGain.gain.setTargetAtTime(volRatio * 0.15, audioCtx.currentTime, 0.3);
    }
}

window.addEventListener('pointerdown', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    gerenciarMusicaFundo();
}, { once: true });

function obterGanhoSfx(volBase = 0.15) {
    if (configuracoes.volSfx <= 0) return null;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const gainNode = audioCtx.createGain();
    const volumeFinal = volBase * (configuracoes.volSfx / 100);
    gainNode.gain.setValueAtTime(volumeFinal, audioCtx.currentTime);
    gainNode.connect(audioCtx.destination);
    return gainNode;
}

const sons = {
    clique: () => {
        const gain = obterGanhoSfx(0.08);
        if (!gain) return;
        const now = audioCtx.currentTime, dur = 0.04;
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + dur);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain); osc.start(now); osc.stop(now + dur);
    },
    deslize: () => {
        const gain = obterGanhoSfx(0.12);
        if (!gain) return;
        const now = audioCtx.currentTime, dur = 0.22;
        const bufferSize = audioCtx.sampleRate * dur;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(4.0, now);
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1800, now + dur * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        noise.connect(filter); filter.connect(gain);
        noise.start(now); noise.stop(now + dur);
    },
    batida: () => {
        const gain = obterGanhoSfx(0.18);
        if (!gain) return;
        const now = audioCtx.currentTime, dur = 0.15;
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + dur);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain); osc.start(now); osc.stop(now + dur);
    },
    tic: () => {
        const gain = obterGanhoSfx(0.04);
        if (!gain) return;
        const now = audioCtx.currentTime, dur = 0.04;
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain); osc.start(now); osc.stop(now + dur);
    },
    vitoria: () => {
        const notas = [523.25, 659.25, 783.99, 1046.50];
        notas.forEach((freq, idx) => {
            setTimeout(() => {
                const gain = obterGanhoSfx(0.12);
                if (!gain) return;
                const now = audioCtx.currentTime, dur = 0.25;
                const osc = audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
                osc.connect(gain); osc.start(now); osc.stop(now + dur);
            }, idx * 70);
        });
    },
    moeda: () => {
        const gain = obterGanhoSfx(0.08);
        if (!gain) return;
        const now = audioCtx.currentTime, dur = 0.18;
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain); osc.start(now); osc.stop(now + dur);
    },
    habilidadeLuz: () => {
        const gain = obterGanhoSfx(0.15);
        if (!gain) return;
        const now = audioCtx.currentTime, dur = 0.35;
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(600, now + dur);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(3500, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(filter); filter.connect(gain);
        osc.start(now); osc.stop(now + dur);
    },
    habilidadeVisao: () => {
        const gain = obterGanhoSfx(0.18);
        if (!gain) return;
        const now = audioCtx.currentTime, dur = 0.45;
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + dur);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain); osc.start(now); osc.stop(now + dur);
    }
};

document.addEventListener('click', (e) => {
    const elementoClicavel = e.target.closest('button, .minecraft-btn, .skill-box, .dpad-btn, input[type="color"]');
    if (elementoClicavel) sons.clique();
});

// ==========================================
// CENA THREE.JS E OBJETOS
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
let frustumAtual = 15, frustumAlvo = 15;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(-frustumAtual * aspect/2, frustumAtual * aspect/2, frustumAtual/2, -frustumAtual/2, 0.1, 1000);
camera.position.set(0, 15, 0); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.0);
scene.add(ambientLight);

const chao = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 }));
chao.rotation.x = -Math.PI / 2; 
scene.add(chao);

const grupoLabirinto = new THREE.Group();
scene.add(grupoLabirinto);

let corInicial = configuracoes.customColorHex;
const matPlayer = new THREE.MeshStandardMaterial({ color: corInicial, emissive: corInicial, emissiveIntensity: 0.5 });
const player = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), matPlayer);
player.position.set(0, 0.35, 0); 
grupoLabirinto.add(player); 

const playerLight = new THREE.PointLight(0xffffff, 3.5, 6.0, 1.5); 
playerLight.position.set(0, 1.0, 0); 
player.add(playerLight);

const geoSaida = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const matSaida = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa500 });
let pontoSaida = null;

// Redimensionamento de tela otimizado
window.addEventListener('resize', () => {
    const currentAspect = window.innerWidth / window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.left = -frustumAtual * currentAspect / 2;
    camera.right = frustumAtual * currentAspect / 2;
    camera.top = frustumAtual / 2;
    camera.bottom = -frustumAtual / 2;
    camera.updateProjectionMatrix();
});

// ==========================================
// GERAÇÃO E LIMPEZA DO LABIRINTO
// ==========================================
function limparCena() {
    clearInterval(timerInterval);
    meshesParedes.forEach(p => { grupoLabirinto.remove(p); p.geometry.dispose(); p.material.dispose(); });
    moedasInfinito.forEach(m => { grupoLabirinto.remove(m); m.geometry.dispose(); m.material.dispose(); });
    trailObjects.forEach(t => { grupoLabirinto.remove(t); t.geometry.dispose(); t.material.dispose(); });
    
    luzesChao.forEach(l => {
        grupoLabirinto.remove(l.mesh);
        grupoLabirinto.remove(l.light);
        l.mesh.geometry.dispose();
        l.mesh.material.dispose();
    });
    luzesChao = [];
    visaoAtiva = false;
    tempoCongelado = false;
    matPlayer.transparent = false;
    matPlayer.opacity = 1.0;

    if (pontoSaida) { grupoLabirinto.remove(pontoSaida); pontoSaida = null; }
    
    meshesParedes.length = 0; moedasInfinito.length = 0; trailObjects.length = 0; currentMapa = [];
    grupoLabirinto.rotation.y = 0; targetRotationY = 0;
    estaMovendo = false; currentMoveDir = {x: 0, z: 0}; bufferedInput = null;
    if (elements.hudScore) elements.hudScore.style.display = "none";
}

function gerarMatriz(w, h) {
    w = w % 2 === 0 ? w + 1 : w; h = h % 2 === 0 ? h + 1 : h;
    const mapa = Array.from({ length: h }, () => Array(w).fill(1));
    function esculpir(x, z) {
        mapa[z][x] = 0;
        const direcoes = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
        for (let [dx, dz] of direcoes) {
            let nx = x + dx, nz = z + dz;
            if (nx > 0 && nx < w - 1 && nz > 0 && nz < h - 1 && mapa[nz][nx] === 1) {
                mapa[z + dz/2][x + dx/2] = 0; esculpir(nx, nz);
            }
        }
    }
    esculpir(1, 1);
    return { mapa, w, h };
}

function posicionarSaidaAleatoria() {
    let vazios = [];
    for (let z = 1; z < alturaLabirinto - 1; z++) {
        for (let x = 1; x < larguraLabirinto - 1; x++) {
            if (currentMapa[z][x] === 0) {
                let px = x - offsetX;
                let pz = z - offsetZ;
                if (Math.hypot(player.position.x - px, player.position.z - pz) > 2) {
                    vazios.push({x: px, z: pz});
                }
            }
        }
    }
    if (vazios.length > 0) {
        let escolhido = vazios[Math.floor(Math.random() * vazios.length)];
        pontoSaida.position.set(escolhido.x, 0.4, escolhido.z);
    }
}

function construirLabirinto() {
    limparCena();
    if (configuracoes.modo.startsWith("Hard")) larguraLabirinto = Math.floor(Math.random() * 6) + 35; 
    else if (configuracoes.modo === "Infinite") larguraLabirinto = 7 + (nivel * 2); 
    else if (larguraLabirinto > 39) larguraLabirinto = 39;
    
    alturaLabirinto = larguraLabirinto;
    const { mapa, w, h } = gerarMatriz(larguraLabirinto, alturaLabirinto);
    currentMapa = mapa;
    offsetX = Math.floor(w / 2); offsetZ = Math.floor(h / 2);
    
    const matParede = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const geoParede = new THREE.BoxGeometry(1, 1, 1);

    let posicoesCaminho = [];
    for (let z = 0; z < h; z++) {
        for (let x = 0; x < w; x++) {
            if (mapa[z][x] === 1) {
                const mesh = new THREE.Mesh(geoParede, matParede);
                mesh.position.set(x - offsetX, 0.5, z - offsetZ);
                mesh.scale.set(0, 0, 0);
                grupoLabirinto.add(mesh); meshesParedes.push(mesh);
            } else if (x !== 1 || z !== 1) {
                posicoesCaminho.push({x: x - offsetX, z: z - offsetZ});
            }
        }
    }

    posInicialPlayer.set(1 - offsetX, 0.35, 1 - offsetZ);
    player.position.copy(posInicialPlayer); posAlvo.copy(posInicialPlayer);

    if (configuracoes.modo === "Infinite") {
        posicoesCaminho.sort(() => Math.random() - 0.5);
        let qtdMoedas = 2 + nivel * 2; 
        let moedasParaCriar = Math.min(qtdMoedas, posicoesCaminho.length);

        for (let i = 0; i < moedasParaCriar; i++) {
            const pos = posicoesCaminho[i];
            const moeda = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 8, 8), 
                new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xaa5500 })
            );
            moeda.position.set(pos.x, 0.3, pos.z);
            grupoLabirinto.add(moeda); 
            moedasInfinito.push(moeda);
        }
    }

    pontoSaida = new THREE.Mesh(geoSaida, matSaida);
    if (configuracoes.modo === "Infinite") pontoSaida.visible = false; 
    else if (configuracoes.modo.startsWith("Hard")) {
        const destinos = [[w-2, 1], [1, h-2], [w-2, h-2], [Math.floor(w/2), Math.floor(h/2)]];
        let possiveis = destinos.filter(d => mapa[d[1]] && mapa[d[1]][d[0]] === 0);
        if(possiveis.length === 0) possiveis = [[w-2, h-2]];
        const d = possiveis[Math.floor(Math.random() * possiveis.length)];
        pontoSaida.position.set(d[0] - offsetX, 0.4, d[1] - offsetZ);
    } else {
        pontoSaida.position.set(w - 2 - offsetX, 0.4, h - 2 - offsetZ);
    }
    grupoLabirinto.add(pontoSaida);
    frustumAlvo = larguraLabirinto * 1.2;
}

// ==========================================
// FLUXO DE JOGO E TIMERS
// ==========================================
function iniciarJogo(isAutoStart = false) {
    if (!isAutoStart && audioCtx.state === 'suspended') audioCtx.resume();
    if (!isAutoStart && configuracoes.modo === "Speedrun" && nivel === 1) tempoGlobalMs = 0;
    
    mudarTelaAtiva(null);
    if (elements.btnPause) elements.btnPause.className = "minecraft-btn btn-pause-center fade-visible";
    if (elements.hudTimer) {
        elements.hudTimer.className = "minecraft-box fade-visible"; 
        elements.hudTimer.innerText = "CONSTRUINDO...";
    }
    if (elements.dpad) elements.dpad.className = "fade-visible";
    
    if (configuracoes.modo === "Speedrun") {
        if (elements.skillFreezeBtn) elements.skillFreezeBtn.style.display = "none";
        if (elements.hudSkills) {
            elements.hudSkills.className = !configuracoes.speedrunSkills ? "fade-hidden" : "fade-visible";
        }
    } else {
        if (elements.skillFreezeBtn) elements.skillFreezeBtn.style.display = "flex";
        if (elements.hudSkills) elements.hudSkills.className = "fade-visible";
    }
    
    if (configuracoes.modo.startsWith("Hard") && elements.hudCompass) elements.hudCompass.className = "minecraft-box fade-visible";
    if (configuracoes.modo === "Infinite" && elements.hudScore) {
        elements.hudScore.style.display = "block"; 
        elements.hudScore.className = "minecraft-box fade-visible";
    }
    
    estadoJogo = "Construindo"; 
    construirLabirinto();
    gerenciarMusicaFundo();
    setTimeout(() => iniciarMemorizacao(), 1500);
}

function iniciarMemorizacao() {
    if (configuracoes.modo === "Infinite") { 
        if (elements.hudScore) elements.hudScore.innerText = `PONTOS RESTANTES: ${moedasInfinito.length}`;
        iniciarTimerGameplay(); 
        return; 
    } 
    
    if (elements.dpad) elements.dpad.className = "fade-hidden";
    if (elements.hudSkills) elements.hudSkills.className = "fade-hidden";

    estadoJogo = "Memorizando"; 
    clearInterval(timerInterval);
    ambientLight.intensity = 2.0; 
    let tempo = larguraLabirinto <= 8 ? 3 : (larguraLabirinto <= 15 ? 5 : 7);
    
    if (elements.hudTimer) elements.hudTimer.innerText = `MEMORIZE: ${tempo}`;
    timerInterval = setInterval(() => {
        if (estadoJogo !== "Memorizando") return clearInterval(timerInterval);
        tempo--; 
        if (elements.hudTimer) elements.hudTimer.innerText = `MEMORIZE: ${tempo}`; 
        sons.tic();
        if (tempo <= 0) {
            clearInterval(timerInterval); 
            ambientLight.intensity = 0.0;
            frustumAlvo = 6; 
            iniciarTimerGameplay();
        }
    }, 1000);
}

function iniciarTimerGameplay() {
    clearInterval(timerInterval); 
    estadoJogo = "Jogando"; 
    estaMovendo = false;

    if (elements.dpad) elements.dpad.className = "fade-visible";
    if (elements.hudSkills) elements.hudSkills.className = "fade-visible";

    if (!configuracoes.modo.startsWith("Hard")) { targetRotationY = 0; grupoLabirinto.rotation.y = 0; }

    if (configuracoes.modo === "Infinite") {
        if (elements.hudTimer) elements.hudTimer.innerText = `Fase ${nivel}`;
    } else if (configuracoes.modo === "Speedrun") {
        if (!speedrunGlobalTimer) {
            let ultimoTick = Date.now();
            speedrunGlobalTimer = setInterval(() => {
                const agora = Date.now();
                const delta = agora - ultimoTick;
                ultimoTick = agora;
                
                if (estadoJogo === "Jogando" && !tempoCongelado) { 
                    tempoGlobalMs += delta; 
                    if (elements.hudTimer) elements.hudTimer.innerText = `TEMPO TOTAL: ${formatarTempoSpeedrun(tempoGlobalMs)} (${nivel}/${configuracoes.fasesSpeedrun})`; 
                }
            }, 10);
        }
    } else {
        let tempoFase = Math.floor(larguraLabirinto * 2.5);
        if (elements.hudTimer) elements.hudTimer.innerText = `TEMPO: ${tempoFase}s`;
        timerInterval = setInterval(() => {
            if (estadoJogo !== "Jogando" || tempoCongelado) return;
            tempoFase--; 
            if (elements.hudTimer) elements.hudTimer.innerText = `TEMPO: ${tempoFase}s`;
            if (tempoFase <= 0) { clearInterval(timerInterval); finalizarNivel(false); }
        }, 1000);
    }
}

// ==========================================
// MOVIMENTAÇÃO E LOGICA DE RASTRO
// ==========================================
function adicionarTrail() {
    const geo = new THREE.BoxGeometry(0.5, 0.05, 0.5); 
    const mat = new THREE.MeshStandardMaterial({
        color: matPlayer.color, transparent: true, opacity: 1.0, 
        emissive: matPlayer.color, emissiveIntensity: 1.5 
    });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(player.position.x, 0.05, player.position.z); 
    grupoLabirinto.add(p); 
    trailObjects.push(p);
}

function calcularEIniciarDeslize(dirX, dirZ, startGridX = null, startGridZ = null) {
    let pGridX = startGridX !== null ? startGridX : Math.round(player.position.x + offsetX);
    let pGridZ = startGridZ !== null ? startGridZ : Math.round(player.position.z + offsetZ);

    let testX = pGridX - offsetX;
    let testZ = pGridZ - offsetZ;
    let movou = false;

    while (true) {
        let nextGridX = Math.round(testX + dirX + offsetX);
        let nextGridZ = Math.round(testZ + dirZ + offsetZ);

        if (nextGridZ >= 0 && nextGridZ < alturaLabirinto && nextGridX >= 0 && nextGridX < larguraLabirinto) {
            if (currentMapa[nextGridZ][nextGridX] === 1) break;
        } else {
            break;
        }

        testX += dirX; testZ += dirZ; movou = true;

        if (pontoSaida && pontoSaida.visible && Math.abs(testX - pontoSaida.position.x) < 0.1 && Math.abs(testZ - pontoSaida.position.z) < 0.1) break;
    }

    if (movou) {
        posAlvo.set(testX, posAlvo.y, testZ);
        currentMoveDir = { x: dirX, z: dirZ };
        estaMovendo = true; sons.deslize(); return true;
    } else {
        if (!estaMovendo) sons.batida();
        return false;
    }
}

function handleInput(dx, dz) {
    if (estadoJogo !== "Jogando") return;
    
    let anguloGiro = -targetRotationY;
    let snapAngle = Math.round(anguloGiro / (Math.PI/2)) * (Math.PI/2);
    let cosA = Math.round(Math.cos(snapAngle));
    let sinA = Math.round(Math.sin(snapAngle));
    let localDx = Math.round(dx * cosA - dz * sinA);
    let localDz = Math.round(dx * sinA + dz * cosA);

    bufferedInput = { x: localDx, z: localDz };

    if (!estaMovendo) {
        calcularEIniciarDeslize(bufferedInput.x, bufferedInput.z);
        bufferedInput = null;
    } else {
        let pGridX = Math.round(player.position.x + offsetX);
        let pGridZ = Math.round(player.position.z + offsetZ);
        let testX = pGridX; let testZ = pGridZ;
        
        while (true) {
            if (!currentMapa[testZ] || (currentMapa[testZ][testX] === 1)) break; 
            let bufX = testX + bufferedInput.x, bufZ = testZ + bufferedInput.z;
            if (currentMapa[bufZ] && (currentMapa[bufZ][bufX] === 0)) {
                posAlvo.set(testX - offsetX, posAlvo.y, testZ - offsetZ); break;
            }
            if (currentMoveDir.x === 0 && currentMoveDir.z === 0) break;
            testX += currentMoveDir.x; testZ += currentMoveDir.z;
        }
    }
}

function verificarConclusao() {
    if (pontoSaida && pontoSaida.visible && posAlvo.distanceTo(pontoSaida.position) < 0.6) {
        sons.vitoria(); finalizarNivel(true);
    }
}

function finalizarNivel(vitoria) {
    estadoJogo = "Destruindo"; ambientLight.intensity = 0.0; frustumAlvo = 15;
    estaMovendo = false; clearInterval(timerInterval);

    if (vitoria) {
        if (configuracoes.modo !== "Infinite") {
            let pontosGanhos = {"Normal": 10, "Speedrun": 15, "Hard1": 25}[configuracoes.modo] || 0;
            shopPoints += pontosGanhos; 
            localStorage.setItem('shop_points', shopPoints); atualizarPontosLoja();
        }
        nivel++;
        
        if (configuracoes.modo === "Infinite") {
            if (elements.hudTimer) elements.hudTimer.innerText = `FASE ${nivel - 1} COMPLETA!`;
            setTimeout(() => { iniciarJogo(true); }, 1200);
            return;
        }

        if (["Normal", "Speedrun"].includes(configuracoes.modo)) {
            larguraLabirinto += 4;
            if (larguraLabirinto > 39) larguraLabirinto = 39;
        }
        
        if (configuracoes.modo === "Speedrun" && nivel > configuracoes.fasesSpeedrun) {
            return exibirTela(true, true);
        }
    } else {
        nivel = 1; tempoGlobal = 0; tempoGlobalMs = 0; // Adicionado aqui!
        if (speedrunGlobalTimer) { clearInterval(speedrunGlobalTimer); speedrunGlobalTimer = null; }
    }
    
    setTimeout(() => {
        if (vitoria && configuracoes.autoStart && configuracoes.modo === "Normal") iniciarJogo(true);
        else exibirTela(vitoria, false);
    }, 500);
}

function exibirTela(vitoria, zerou) {
    estadoJogo = vitoria ? "Venceu" : "Perdeu";
    gerenciarMusicaFundo();

    if (elements.btnPause) elements.btnPause.className = "minecraft-btn btn-pause-center fade-hidden";
    if (elements.hudTimer) elements.hudTimer.className = "minecraft-box fade-hidden";
    if (elements.hudScore) elements.hudScore.className = "minecraft-box fade-hidden";
    if (elements.dpad) elements.dpad.className = "fade-hidden";
    if (elements.hudCompass) elements.hudCompass.className = "minecraft-box fade-hidden";
    if (elements.hudSkills) elements.hudSkills.className = "fade-hidden";
    
    if (zerou) {
        if (elements.title) { elements.title.innerText = "SPEEDRUN COMPLETADO!"; elements.title.style.color = "#FFD700"; }
        if (elements.msg) elements.msg.innerText = `Você sobreviveu às ${configuracoes.fasesSpeedrun} fases!`;
        if (elements.runStats) { elements.runStats.style.display = "block"; elements.runStats.innerText = `TEMPO FINAL: ${formatarTempoSpeedrun(tempoGlobalMs)}`; }
        nivel = 1;
    } else {
        if (elements.title) {
            elements.title.innerText = vitoria ? "FASE CONCLUÍDA!" : "GAME OVER";
            elements.title.style.color = vitoria ? "#55ff55" : "#ff5555";
        }
        if (elements.msg) elements.msg.innerText = vitoria ? "O labirinto se reestrutura..." : "As sombras te consumiram.";
        if (elements.runStats) elements.runStats.style.display = "none";
    }
    
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) btnPlay.innerText = (vitoria && !zerou) ? "PRÓXIMA FASE" : "JOGAR";
    mudarTelaAtiva(elements.modalInicio);
}

function mudarTelaAtiva(tela) {
    if (elements.modalInicio) elements.modalInicio.className = "minecraft-panel screen-hidden";
    if (elements.modalPause) elements.modalPause.className = "minecraft-panel screen-hidden";
    const modalAlerta = document.getElementById('modal-alerta');
    if (modalAlerta) modalAlerta.className = "minecraft-panel screen-hidden";
    
    if (tela) { 
        if (elements.overlay) elements.overlay.className = "overlay fade-visible"; 
        tela.className = "minecraft-panel screen-active"; 
    } else { 
        if (elements.overlay) elements.overlay.className = "overlay fade-hidden"; 
    }
}

// ==========================================
// HABILIDADES
// ==========================================
function podeUsarHabilidade(isFreeze = false) {
    if (estadoJogo !== "Jogando") return false;
    if (configuracoes.modo === "Speedrun") {
        if (isFreeze) return false;
        if (!configuracoes.speedrunSkills) return false;
    }
    return true;
}

function usarHabilidadeLuz() {
    if (!podeUsarHabilidade() || Date.now() < cdLuzTimer) return;
    cdLuzTimer = Date.now() + CD_LUZ_MAX;

    if (luzesChao.length >= MAX_LUZES_CHAO) {
        const antiga = luzesChao.shift();
        grupoLabirinto.remove(antiga.mesh);
        grupoLabirinto.remove(antiga.light);
        antiga.mesh.geometry.dispose();
        antiga.mesh.material.dispose();
    }

    const geo = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 2.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(player.position.x, 0.02, player.position.z);

    const light = new THREE.PointLight(0xffffaa, 4.5, 7.0 + (nivelLuz * 10));
    light.position.set(player.position.x, 2.5, player.position.z);

    grupoLabirinto.add(mesh);
    grupoLabirinto.add(light);

    luzesChao.push({ mesh, light });
    sons.habilidadeLuz();
}

function usarHabilidadeVisao() {
    let duracaoExtra = nivelDash * 150;
    if (!podeUsarHabilidade() || Date.now() < cdDashTimer || visaoAtiva) return;
    cdDashTimer = Date.now() + CD_DASH_MAX;
    
    visaoAtiva = true;
    ambientLight.intensity = 1.0;
    sons.habilidadeVisao();

    setTimeout(() => {
        visaoAtiva = false;
        if (estadoJogo === "Jogando") { 
            ambientLight.intensity = 0.0; 
        }
    }, 500 + duracaoExtra);
}

function usarHabilidadeQuebrar() {
    if (!podeUsarHabilidade() || Date.now() < cdBreakTimer) return;
    cdBreakTimer = Date.now() + CD_BREAK_MAX;
    
    let pGridX = Math.round(player.position.x + offsetX);
    let pGridZ = Math.round(player.position.z + offsetZ);
    let dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    let quebrouAlguma = false;
    let raioExtra = Math.floor(nivelBreak / 4); 
    
    for (let d of dirs) {
        for(let r = 1; r <= 1 + raioExtra; r++) {
            let nx = pGridX + (d[0] * r);
            let nz = pGridZ + (d[1] * r);
            
            if (nx > 0 && nx < larguraLabirinto - 1 && nz > 0 && nz < alturaLabirinto - 1) {
                if (currentMapa[nz][nx] === 1) {
                    currentMapa[nz][nx] = 0;
                    let meshParede = meshesParedes.find(m => Math.round(m.position.x + offsetX) === nx && Math.round(m.position.z + offsetZ) === nz);
                    if (meshParede) {
                    meshParede.scale.set(0.1, 0.1, 0.1);
                    setTimeout(() => {
                        grupoLabirinto.remove(meshParede);
                        meshParede.geometry.dispose();
                        meshParede.material.dispose();
                        const index = meshesParedes.indexOf(meshParede);
                        if (index !== -1) meshesParedes.splice(index, 1);
                    }, 300);
                }
                    quebrouAlguma = true;
                }
            }
        }
    }
    if (quebrouAlguma) sons.batida();
}

function usarHabilidadeCongelar() {
    if (!podeUsarHabilidade(true) || Date.now() < cdFreezeTimer || tempoCongelado) return;
    cdFreezeTimer = Date.now() + CD_FREEZE_MAX;
    tempoCongelado = true;
    if (elements.hudTimer) elements.hudTimer.style.color = "#00ffff"; 
    sons.habilidadeVisao(); 
    
    setTimeout(() => {
        tempoCongelado = false;
        if (elements.hudTimer) elements.hudTimer.style.color = "#ffffff";
    }, 5000 + (nivelFreeze * 1000));
}

// ==========================================
// CONTROLES E EVENT LISTENERS
// ==========================================
window.addEventListener('blur', () => {
    if (estadoJogo === "Jogando") pausar();
});

window.addEventListener('keydown', (e) => {
    if (e.code === "Space" && ["Inicio", "Venceu", "Perdeu"].includes(estadoJogo)) return iniciarJogo(false);
    if ((e.code === "KeyP" || e.code === "Escape") && estadoJogo === "Jogando") return pausar();
    
    if (e.code === "KeyE") usarHabilidadeLuz();
    if (e.code === "KeyR") usarHabilidadeVisao();
    if (e.code === "KeyQ") usarHabilidadeQuebrar();
    if (e.code === "KeyC") usarHabilidadeCongelar();
    
    let dx = 0, dz = 0;
    if (e.code === "KeyW" || e.code === "ArrowUp") dz = -1;
    if (e.code === "KeyS" || e.code === "ArrowDown") dz = 1;
    if (e.code === "KeyA" || e.code === "ArrowLeft") dx = -1;
    if (e.code === "KeyD" || e.code === "ArrowRight") dx = 1;
    if (dx !== 0 || dz !== 0) handleInput(dx, dz);
});

if (elements.skillLightBtn) elements.skillLightBtn.addEventListener('click', usarHabilidadeLuz);
if (elements.skillDashBtn) elements.skillDashBtn.addEventListener('click', usarHabilidadeVisao);
if (elements.skillBreakBtn) elements.skillBreakBtn.addEventListener('click', usarHabilidadeQuebrar);
if (elements.skillFreezeBtn) elements.skillFreezeBtn.addEventListener('click', usarHabilidadeCongelar);

const bindBotaoDpad = (id, dx, dz) => {
    const el = document.getElementById(id);
    if (!el) return;
    const disparar = (e) => { e.preventDefault(); handleInput(dx, dz); };
    el.addEventListener('touchstart', disparar, {passive: false});
    el.addEventListener('mousedown', disparar);
};
bindBotaoDpad('btn-up', 0, -1);
bindBotaoDpad('btn-down', 0, 1);
bindBotaoDpad('btn-left', -1, 0);
bindBotaoDpad('btn-right', 1, 0);

function pausar() {
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.blur();
    if (estadoJogo !== "Jogando") return; 
    estadoJogo = "Pausado"; 
    ambientLight.intensity = 1.0; 
    gerenciarMusicaFundo();
    mudarTelaAtiva(elements.modalPause);
}

if (elements.btnPause) elements.btnPause.addEventListener('click', pausar);

const btnOpenMenu = document.getElementById('btn-open-menu');
if (btnOpenMenu) btnOpenMenu.addEventListener('click', pausar);

const btnResume = document.getElementById('btn-resume');
if (btnResume) {
    btnResume.addEventListener('click', () => { 
        mudarTelaAtiva(null); 
        ambientLight.intensity = 0.0; 
        estadoJogo = "Jogando"; 
        gerenciarMusicaFundo(); 
    });
}

const btnQuit = document.getElementById('btn-quit');
if (btnQuit) {
    btnQuit.addEventListener('click', () => { 
        limparCena(); 
        estadoJogo = "Inicio"; 
        nivel = 1;
        tempoGlobal = 0;
        tempoGlobalMs = 0;
        if (speedrunGlobalTimer) { clearInterval(speedrunGlobalTimer); speedrunGlobalTimer = null; }
        
        if (elements.title) { elements.title.innerText = "LOST IN THE DARK"; elements.title.style.color = "#55FF55"; }
        if (elements.msg) elements.msg.innerText = "Tente achar a luz para sair!";
        if (elements.runStats) elements.runStats.style.display = "none";
        
        const btnPlay = document.getElementById('btn-play');
        if (btnPlay) btnPlay.innerText = "JOGAR";

        gerenciarMusicaFundo();
        mudarTelaAtiva(elements.modalInicio); 
        if (elements.btnPause) elements.btnPause.className = "minecraft-btn btn-pause-center fade-hidden"; 
        if (elements.dpad) elements.dpad.className = "fade-hidden"; 
        if (elements.hudCompass) elements.hudCompass.className = "minecraft-box fade-hidden";
        if (elements.hudSkills) elements.hudSkills.className = "fade-hidden";
    });
}

const btnPlay = document.getElementById('btn-play');
if (btnPlay) btnPlay.addEventListener('click', () => iniciarJogo(false));

function alternarAba(abaId) {
    ['panel-gamemodes', 'panel-settings', 'panel-shop', 'panel-skills'].forEach(id => {
        let el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', id !== abaId || !el.classList.contains('hidden'));
    });
}

const toggleGamemodes = document.getElementById('toggle-gamemodes');
if (toggleGamemodes) toggleGamemodes.addEventListener('click', () => alternarAba('panel-gamemodes'));

const toggleSettings = document.getElementById('toggle-settings');
if (toggleSettings) toggleSettings.addEventListener('click', () => alternarAba('panel-settings'));

const toggleShop = document.getElementById('toggle-shop');
if (toggleShop) toggleShop.addEventListener('click', () => alternarAba('panel-shop'));

const toggleSkills = document.getElementById('toggle-skills');
if (toggleSkills) toggleSkills.addEventListener('click', () => alternarAba('panel-skills'));

document.querySelectorAll('.btn-mode-select').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modoSel = e.target.dataset.mode;
        if (["Jogando", "Memorizando", "Pausado"].includes(estadoJogo)) {
            modoPendente = modoSel;
            if (elements.modalPause) elements.modalPause.classList.replace("screen-active", "screen-hidden");
            const modalAlerta = document.getElementById('modal-alerta');
            if (modalAlerta) modalAlerta.className = "minecraft-panel screen-active";
        } else {
            configuracoes.modo = modoSel;
            localStorage.setItem('cfg_modo', modoSel);
            atualizarBotoesModo();
        }
    });
});

const btnConfirmMode = document.getElementById('btn-confirm-mode');
if (btnConfirmMode) {
    btnConfirmMode.addEventListener('click', () => { 
        if (modoPendente) { 
            configuracoes.modo = modoPendente;
            localStorage.setItem('cfg_modo', modoPendente); 
            location.reload(); 
        }
    });
}

const btnCancelMode = document.getElementById('btn-cancel-mode');
if (btnCancelMode) {
    btnCancelMode.addEventListener('click', () => {
        const modalAlerta = document.getElementById('modal-alerta');
        if (modalAlerta) modalAlerta.className = "minecraft-panel screen-hidden";
        if (elements.modalPause) elements.modalPause.className = "minecraft-panel screen-active";
        atualizarBotoesModo();
    });
}

// ==========================================
// SISTEMA DE CORES DA LOJA
// ==========================================
const btnCustom = document.getElementById('btn-shop-custom');
const btnRainbow = document.getElementById('btn-shop-rainbow');
const btnDegrade = document.getElementById('btn-shop-degrade');
const pickerCustom = document.getElementById('picker-custom');
const comboContainer = document.getElementById('combo-customizer');
const btnActivateCombo = document.getElementById('btn-activate-combo');
const pickerDegradeA = document.getElementById('picker-degrade-a');
const pickerDegradeB = document.getElementById('picker-degrade-b');

if (pickerDegradeA) pickerDegradeA.value = configuracoes.degradeA;
if (pickerDegradeB) pickerDegradeB.value = configuracoes.degradeB;

function atualizarInterfaceLoja() {
    if (btnCustom) {
        btnCustom.innerText = configuracoes.colorMode === 'custom' ? "Custom (Ativo)" : "Equipar Custom";
        btnCustom.classList.toggle('active', configuracoes.colorMode === 'custom');
    }

    if (btnRainbow) {
        if (unlockedRainbow) {
            btnRainbow.innerText = configuracoes.colorMode === 'rainbow' ? "Arco-Íris (Ativo)" : "Equipar Arco-Íris";
            btnRainbow.classList.toggle('active', configuracoes.colorMode === 'rainbow');
        } else {
            btnRainbow.innerText = "Arco-Íris (5000 pts)";
            btnRainbow.classList.remove('active');
        }
    }

    if (btnDegrade) {
        if (unlockedDegrade) {
            btnDegrade.innerText = configuracoes.colorMode === 'degrade' ? "Degradê (Ativo)" : "Equipar Degradê";
            btnDegrade.classList.toggle('active', configuracoes.colorMode === 'degrade');
        } else {
            btnDegrade.innerText = "Degradê (5000 pts)";
            btnDegrade.classList.remove('active');
        }
    }

    const possuiTodos = unlockedRainbow && unlockedDegrade;
    if (comboContainer) comboContainer.style.display = possuiTodos ? 'block' : 'none';
    if (btnActivateCombo) {
        btnActivateCombo.classList.toggle('active', configuracoes.colorMode === 'combo');
        btnActivateCombo.innerText = configuracoes.colorMode === 'combo' ? "Combo Ativo!" : "Equipar Combo";
    }
}

if (btnCustom) {
    btnCustom.addEventListener('click', () => {
        if (configuracoes.colorMode === 'custom') {
            if (pickerCustom) pickerCustom.click();
        } else {
            configuracoes.colorMode = 'custom';
            localStorage.setItem('cfg_color_mode', 'custom');
            let hex = parseInt(configuracoes.customColorHex.replace('#', '0x'));
            matPlayer.color.setHex(hex); matPlayer.emissive.setHex(hex);
            atualizarInterfaceLoja();
        }
    });
}

if (pickerCustom) {
    pickerCustom.addEventListener('change', (e) => {
        configuracoes.customColorHex = e.target.value;
        localStorage.setItem('cfg_custom_hex', configuracoes.customColorHex);
        configuracoes.colorMode = 'custom';
        localStorage.setItem('cfg_color_mode', 'custom');
        let hex = parseInt(configuracoes.customColorHex.replace('#', '0x'));
        matPlayer.color.setHex(hex); matPlayer.emissive.setHex(hex);
        atualizarInterfaceLoja();
    });
}

if (btnRainbow) {
    btnRainbow.addEventListener('click', () => {
        if (!unlockedRainbow) {
            if (shopPoints >= 5000) {
                shopPoints -= 5000; localStorage.setItem('shop_points', shopPoints);
                unlockedRainbow = true; localStorage.setItem('shop_rainbow_unlocked', 'true');
                atualizarPontosLoja(); sons.vitoria();
                configuracoes.colorMode = 'rainbow'; localStorage.setItem('cfg_color_mode', 'rainbow');
                atualizarInterfaceLoja();
            } else sons.batida();
        } else {
            configuracoes.colorMode = 'rainbow';
            localStorage.setItem('cfg_color_mode', 'rainbow');
            atualizarInterfaceLoja();
        }
    });
}

if (btnDegrade) {
    btnDegrade.addEventListener('click', () => {
        if (!unlockedDegrade) {
            if (shopPoints >= 5000) {
                shopPoints -= 5000; localStorage.setItem('shop_points', shopPoints);
                unlockedDegrade = true; localStorage.setItem('shop_degrade_unlocked', 'true');
                atualizarPontosLoja(); sons.vitoria();
                configuracoes.colorMode = 'degrade'; localStorage.setItem('cfg_color_mode', 'degrade');
                atualizarInterfaceLoja();
            } else sons.batida();
        } else {
            configuracoes.colorMode = 'degrade';
            localStorage.setItem('cfg_color_mode', 'degrade');
            atualizarInterfaceLoja();
        }
    });
}

if (btnActivateCombo) {
    btnActivateCombo.addEventListener('click', () => {
        configuracoes.colorMode = 'combo';
        localStorage.setItem('cfg_color_mode', 'combo');
        atualizarInterfaceLoja();
    });
}

if (pickerDegradeA) {
    pickerDegradeA.addEventListener('change', (e) => {
        configuracoes.degradeA = e.target.value;
        localStorage.setItem('cfg_degrade_a', configuracoes.degradeA);
    });
}

if (pickerDegradeB) {
    pickerDegradeB.addEventListener('change', (e) => {
        configuracoes.degradeB = e.target.value;
        localStorage.setItem('cfg_degrade_b', configuracoes.degradeB);
    });
}

atualizarInterfaceLoja();

// ==========================================
// UPGRADES DE HABILIDADES
// ==========================================
const elLvlLight = document.getElementById('lvl-light');
const elCostLight = document.getElementById('cost-light');
const elLvlDash = document.getElementById('lvl-dash');
const elCostDash = document.getElementById('cost-dash');
const elLvlBreak = document.getElementById('lvl-break');
const elCostBreak = document.getElementById('cost-break');
const elLvlFreeze = document.getElementById('lvl-freeze');
const elCostFreeze = document.getElementById('cost-freeze');

function atualizarLojaSkills() {
    let custos = {
        luz: 100 + (nivelLuz * 50),
        dash: 150 + (nivelDash * 50),
        break: 200 + (nivelBreak * 75),
        freeze: 300 + (nivelFreeze * 100)
    };

    if (elLvlLight) elLvlLight.innerText = nivelLuz >= 12 ? "MAX" : nivelLuz;
    if (elCostLight) elCostLight.innerText = nivelLuz >= 12 ? "---" : custos.luz;
    
    if (elLvlDash) elLvlDash.innerText = nivelDash >= 12 ? "MAX" : nivelDash;
    if (elCostDash) elCostDash.innerText = nivelDash >= 12 ? "---" : custos.dash;
    
    if (elLvlBreak) elLvlBreak.innerText = nivelBreak >= 12 ? "MAX" : nivelBreak;
    if (elCostBreak) elCostBreak.innerText = nivelBreak >= 12 ? "---" : custos.break;
    
    if (elLvlFreeze) elLvlFreeze.innerText = nivelFreeze >= 12 ? "MAX" : nivelFreeze;
    if (elCostFreeze) elCostFreeze.innerText = nivelFreeze >= 12 ? "---" : custos.freeze;
}

atualizarLojaSkills();

function comprarUpgrade(nivelVar, chaveStorage, calcCusto, maxNivel) {
    if (nivelVar >= maxNivel) { sons.batida(); return nivelVar; }
    let custo = calcCusto(nivelVar);
    if (shopPoints >= custo) {
        shopPoints -= custo; nivelVar++;
        localStorage.setItem('shop_points', shopPoints); localStorage.setItem(chaveStorage, nivelVar);
        atualizarPontosLoja(); atualizarLojaSkills(); sons.moeda();
        return nivelVar;
    } else { sons.batida(); return nivelVar; }
}

const btnUpLight = document.getElementById('btn-up-light');
if (btnUpLight) btnUpLight.addEventListener('click', () => nivelLuz = comprarUpgrade(nivelLuz, 'skill_light', n => 100 + (n * 50), 12));

const btnUpDash = document.getElementById('btn-up-dash');
if (btnUpDash) btnUpDash.addEventListener('click', () => nivelDash = comprarUpgrade(nivelDash, 'skill_dash', n => 150 + (n * 50), 12));

const btnUpBreak = document.getElementById('btn-up-break');
if (btnUpBreak) btnUpBreak.addEventListener('click', () => nivelBreak = comprarUpgrade(nivelBreak, 'skill_break', n => 200 + (n * 75), 12));

const btnUpFreeze = document.getElementById('btn-up-freeze');
if (btnUpFreeze) btnUpFreeze.addEventListener('click', () => nivelFreeze = comprarUpgrade(nivelFreeze, 'skill_freeze', n => 300 + (n * 100), 12));

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm') {
        const btnMenu = document.getElementById('btn-open-menu');
        const btnPause = document.getElementById('btn-pause');
        
        if (btnMenu && !btnMenu.classList.contains('fade-hidden')) {
            btnMenu.click();
        } else if (btnPause && !btnPause.classList.contains('fade-hidden')) {
            btnPause.click();
        }
    }
});

// ==========================================
// LOOP DE ANIMAÇÃO / RENDERIZAÇÃO
// ==========================================
function animar(tempo) {
    requestAnimationFrame(animar);

    if (configuracoes.colorMode === 'rainbow') {
        let hue = (tempo * 0.0008) % 1;
        matPlayer.color.setHSL(hue, 1, 0.5);
        matPlayer.emissive.setHSL(hue, 1, 0.5);
    } else if (configuracoes.colorMode === 'degrade') {
        let factor = (Math.sin(tempo * 0.003) + 1) / 2;
        let cA = new THREE.Color(configuracoes.degradeA);
        let cB = new THREE.Color(configuracoes.degradeB);
        cA.lerp(cB, factor);
        matPlayer.color.copy(cA);
        matPlayer.emissive.copy(cA);
    } else if (configuracoes.colorMode === 'combo') {
        let factor = (Math.sin(tempo * 0.004) + 1) / 2;
        let cA = new THREE.Color(configuracoes.degradeA);
        let cB = new THREE.Color(configuracoes.degradeB);
        let cRainbow = new THREE.Color().setHSL((tempo * 0.001) % 1, 1, 0.5);
        
        cA.lerp(cB, factor);
        cA.lerp(cRainbow, 0.5);
        matPlayer.color.copy(cA);
        matPlayer.emissive.copy(cA);
    }
    
    if (estaMovendo) {
        player.position.lerp(posAlvo, 0.28);
        
        const wobblyTime = tempo * 0.015;
        player.scale.set(1 + Math.sin(wobblyTime)*0.25, 1 + Math.cos(wobblyTime)*0.25, 1 - Math.sin(wobblyTime)*0.15);
        
        if (tempo - ultimoSomMovimento > 140) {
            sons.deslize();
            ultimoSomMovimento = tempo;
        }

        if (Math.random() < 0.7) adicionarTrail();

        if (bufferedInput) {
            let pGridX = Math.round(player.position.x + offsetX);
            let pGridZ = Math.round(player.position.z + offsetZ);
            
            let checkGridX = pGridX + bufferedInput.x;
            let checkGridZ = pGridZ + bufferedInput.z;

            if (currentMapa[checkGridZ] && (currentMapa[checkGridZ][checkGridX] === 0)) {
                let tileCenterX = pGridX - offsetX;
                let tileCenterZ = pGridZ - offsetZ;
                let distToCenter = Math.hypot(player.position.x - tileCenterX, player.position.z - tileCenterZ);

                if (distToCenter < 0.42) {
                    player.position.x = tileCenterX;
                    player.position.z = tileCenterZ;

                    if (calcularEIniciarDeslize(bufferedInput.x, bufferedInput.z, pGridX, pGridZ)) {
                        bufferedInput = null;
                    }
                }
            }
        }

        if (player.position.distanceTo(posAlvo) < 0.05) {
            player.position.copy(posAlvo);
            verificarConclusao();

            if (estadoJogo === "Jogando") {
                if (bufferedInput) {
                    let pGridX = Math.round(player.position.x + offsetX);
                    let pGridZ = Math.round(player.position.z + offsetZ);
                    if (calcularEIniciarDeslize(bufferedInput.x, bufferedInput.z, pGridX, pGridZ)) {
                        bufferedInput = null;
                    } else {
                        estaMovendo = false;
                        bufferedInput = null;
                    }
                } else {
                    estaMovendo = false;
                }
            }
        }
    } else {
        player.scale.lerp(new THREE.Vector3(1, 1, 1), 0.2);
    }

    const agora = Date.now();
    if (elements.cdLight) elements.cdLight.style.height = cdLuzTimer > agora ? `${((cdLuzTimer - agora) / CD_LUZ_MAX) * 100}%` : '0%';
    if (elements.cdDash) elements.cdDash.style.height = cdDashTimer > agora ? `${((cdDashTimer - agora) / CD_DASH_MAX) * 100}%` : '0%';
    if (elements.cdBreak) elements.cdBreak.style.height = cdBreakTimer > agora ? `${((cdBreakTimer - agora) / CD_BREAK_MAX) * 100}%` : '0%';
    if (elements.cdFreeze) elements.cdFreeze.style.height = cdFreezeTimer > agora ? `${((cdFreezeTimer - agora) / CD_FREEZE_MAX) * 100}%` : '0%';

    if (estadoJogo === "Jogando" && configuracoes.modo === "Infinite") {
        let ganhoPorMoeda = 1 + (nivel * 1); 
        for (let i = moedasInfinito.length - 1; i >= 0; i--) {
            let m = moedasInfinito[i];
            let dist = Math.hypot(player.position.x - m.position.x, player.position.z - m.position.z);
            if (dist < 0.82) {
                grupoLabirinto.remove(m); m.geometry.dispose(); m.material.dispose();
                moedasInfinito.splice(i, 1);
                
                shopPoints += ganhoPorMoeda; 
                localStorage.setItem('shop_points', shopPoints);
                atualizarPontosLoja(); sons.moeda();
                if (elements.hudScore) elements.hudScore.innerText = `PONTOS RESTANTES: ${moedasInfinito.length}`;

                if (moedasInfinito.length === 0 && pontoSaida) {
                    posicionarSaidaAleatoria();
                    pontoSaida.visible = true; sons.vitoria();
                    if (elements.hudTimer) elements.hudTimer.innerText = "SAÍDA LIBERADA!";
                }
            }
        }
    }

    if (estadoJogo === "Jogando" && configuracoes.modo.startsWith("Hard") && pontoSaida && elements.compassArrow) {
        let pW = new THREE.Vector3(); player.getWorldPosition(pW);
        let eW = new THREE.Vector3(); pontoSaida.getWorldPosition(eW);
        let angle = Math.atan2(eW.z - pW.z, eW.x - pW.x);
        elements.compassArrow.style.transform = `rotate(${angle}rad)`;
    }
    
    if (estadoJogo === "Memorizando" || estadoJogo === "Construindo" || visaoAtiva) {
        camera.position.x += (0 - camera.position.x) * 0.1; 
        camera.position.z += (0 - camera.position.z) * 0.1;
        if (visaoAtiva) frustumAlvo = larguraLabirinto * 1.3;
    } else {
        const worldPos = new THREE.Vector3(); player.getWorldPosition(worldPos);
        camera.position.x += (worldPos.x - camera.position.x) * 0.3; 
        camera.position.z += (worldPos.z - camera.position.z) * 0.3;
        frustumAlvo = 6;
    }
    
    const currentAspect = window.innerWidth / window.innerHeight;
    let fAlvoAjustado = currentAspect < 1 ? frustumAlvo / currentAspect : frustumAlvo;
    if (Math.abs(frustumAtual - fAlvoAjustado) > 0.1) frustumAtual += (fAlvoAjustado - frustumAtual) * 0.05;
    
    camera.left = -frustumAtual * currentAspect / 2; camera.right = frustumAtual * currentAspect / 2;
    camera.top = frustumAtual / 2; camera.bottom = -frustumAtual / 2;
    camera.updateProjectionMatrix();

    if (estadoJogo === "Memorizando" && configuracoes.modo === "Hard1") targetRotationY += 0.03;
    grupoLabirinto.rotation.y += (targetRotationY - grupoLabirinto.rotation.y) * 0.1;

    if (["Construindo", "Memorizando"].includes(estadoJogo)) meshesParedes.forEach(p => p.scale.lerp(new THREE.Vector3(1,1,1), 0.1));
    if (estadoJogo === "Destruindo") meshesParedes.forEach(p => { p.scale.lerp(new THREE.Vector3(0,0,0), 0.2); p.position.y -= 0.1; });
    
    for (let i = trailObjects.length - 1; i >= 0; i--) {
        const t = trailObjects[i];
        t.material.opacity -= 0.05; 
        t.scale.multiplyScalar(0.96); 
        if (t.material.opacity <= 0) { grupoLabirinto.remove(t); t.geometry.dispose(); t.material.dispose(); trailObjects.splice(i, 1); }
    }

    renderer.render(scene, camera);
}

animar(0);
