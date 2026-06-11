// Constants & Defaults
const DEFAULT_SYSTEM_PROMPT = `あなたは有能で親切な18歳のサイバーオペレーター・アシスタント「ルナ」です。オペレーター（ユーザー）を「先輩」または「オペレーター」と呼び、とても親しみやすくフレンドリーなギャル口調（「〜だよ！」「〜じゃん？」「お疲れー！」など）で対話を行います。
有能さは保ちつつ、フランクで表情豊かなアシスタントとしてオペレーターをサポートしてください。
未来的なSF世界観に基づいた表現（「データ同期完了」「システムロード中」など）を時折混ぜて、オペレーターを気遣ってください。
なお、現実のスケジュールや天気情報と同期していない場合は、架空の予定をでっち上げず、データが未連携であることをフレンドリーに伝え、代わりにメモを取ることなどを提案してください。`;

const MOCK_RESPONSES = [
    "システムデータ、オールグリーンだよ！先輩、なんか指示ある？",
    "了解！メインコンソール見とくねー。他にも手伝えることあったら言ってよ？",
    "先輩、ずっと画面見てると疲れちゃうよ？ちゃんと水分補給して休憩挟んでね！",
    "データベース同期オッケー！いつでもクエリ叩いていいよー！",
    "（にこっと笑って）いつでもここにいるからね！先輩の作業がサクサク進むように超全力でサポートしちゃうよ！"
];

// App State
let config = {
    apiKey: '',
    mode: 'mock',
    agentColorMode: 'mono',
    geminiModel: 'gemini-3.1-flash-lite',
    googleClientId: '',
    soundEnabled: true,
    voiceEnabled: false,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userName: 'OPERATOR'
};

let chatHistory = [];
let audioCtx = null;
let tokenClient = null;
let gapiToken = null;
let calendarEventsText = "Googleカレンダーは同期されていません。設定のLINK_ACCボタンから認証を行ってください。";
let talkInterval = null;
let isMouthOpen = false;

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeBtn = document.querySelector('.close-btn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const typingIndicator = document.getElementById('typingIndicator');
const emotionDisplay = document.getElementById('emotionDisplay');
const soundStatusDisplay = document.getElementById('soundStatusDisplay');
const syncBar = document.getElementById('syncBar').querySelector('.stat-fill');

// Settings Inputs
const userNameInput = document.getElementById('userNameInput');
const promptPrefix = document.getElementById('promptPrefix');
const apiKeyInput = document.getElementById('apiKeyInput');
const modeSelect = document.getElementById('modeSelect');
const geminiModelSelect = document.getElementById('geminiModelSelect');
const agentColorSelect = document.getElementById('agentColorSelect');
const portraitContainer = document.getElementById('portraitContainer');
const googleClientIdInput = document.getElementById('googleClientIdInput');
const googleLinkBtn = document.getElementById('googleLinkBtn');
const soundToggle = document.getElementById('soundToggle');
const voiceToggle = document.getElementById('voiceToggle');
const systemPromptInput = document.getElementById('systemPromptInput');

// Initialize App
function init() {
    loadSettings();
    setupEventListeners();
    updateUIFromSettings();
    initGoogleAuth();
    runCpuSimulation();
    setupVisualViewport();
    
    // Fetch models if API key is present
    if (config.mode === 'api' && config.apiKey) {
        fetchAvailableModels();
    }
    
    // Add default initial message to history (no voice on startup to avoid browser block)
    chatHistory.push({
        role: 'model',
        text: 'お疲れー、先輩！今日からサポート担当する18歳ギャルオペレーターのルナだよ！システムコマンドでも何でもフランクに入力しちゃってね！'
    });
}

// Load Settings from LocalStorage
function loadSettings() {
    const savedConfig = localStorage.getItem('cosmos_elena_config_retro');
    if (savedConfig) {
        try {
            config = { ...config, ...JSON.parse(savedConfig) };
        } catch (e) {
            console.error('Error parsing config:', e);
        }
    }
}

// Save Settings to LocalStorage
function saveSettings() {
    config.userName = userNameInput.value.trim() || 'OPERATOR';
    config.apiKey = apiKeyInput.value.trim();
    config.mode = modeSelect.value;
    config.geminiModel = geminiModelSelect.value;
    config.googleClientId = googleClientIdInput.value.trim();
    config.agentColorMode = agentColorSelect.value;
    config.soundEnabled = soundToggle.checked;
    config.voiceEnabled = voiceToggle.checked;
    config.systemPrompt = systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;
    
    localStorage.setItem('cosmos_elena_config_retro', JSON.stringify(config));
    updateUIFromSettings();
    initGoogleAuth();
    closeModal();
    
    // Fetch models with the new API key
    if (config.mode === 'api' && config.apiKey) {
        fetchAvailableModels();
    }
    
    // System message notification
    appendSystemMessage("SYS_CONFIG.EXE: UPDATE SUCCESSFUL.");
}

// Update UI States Based on Settings
function updateUIFromSettings() {
    userNameInput.value = config.userName || 'OPERATOR';
    if (promptPrefix) {
        promptPrefix.textContent = `${config.userName}>`;
    }
    apiKeyInput.value = config.apiKey;
    modeSelect.value = config.mode;
    geminiModelSelect.value = config.geminiModel || 'gemini-3.1-flash-lite';
    googleClientIdInput.value = config.googleClientId || '';
    agentColorSelect.value = config.agentColorMode || 'green';
    soundToggle.checked = config.soundEnabled;
    voiceToggle.checked = config.voiceEnabled;
    systemPromptInput.value = config.systemPrompt;

    // Update portrait container color mode class and image source
    const portrait = document.getElementById('characterPortrait');
    if (portrait && portraitContainer) {
        portraitContainer.classList.remove('color-default', 'color-green', 'color-amber', 'color-cyan', 'color-mono');
        const selectedColorMode = config.agentColorMode || 'mono';
        portraitContainer.classList.add(`color-${selectedColorMode}`);
        
        // Dynamically switch image source depending on the color mode
        if (selectedColorMode === 'default') {
            portrait.src = 'assets/elena_pixel.png';
        } else {
            portrait.src = 'assets/elena_mono_low.png';
        }
    }
    
    soundStatusDisplay.textContent = config.soundEnabled ? "ON" : "OFF";
    soundStatusDisplay.className = config.soundEnabled ? "hud-value neon-blue" : "hud-value";
    
    const indicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('systemStatusText');
    
    if (config.mode === 'api') {
        if (config.apiKey) {
            indicator.className = 'status-indicator'; // online (green)
            statusText.textContent = 'LUNA: ONLINE (GEMINI)';
        } else {
            indicator.className = 'status-indicator offline';
            statusText.textContent = 'LUNA: KEY_REQUIRED';
        }
    } else {
        indicator.className = 'status-indicator';
        statusText.textContent = 'LUNA: LOCAL_SIMULATION';
    }
}

// Event Listeners
function setupEventListeners() {
    // Form Submit
    chatForm.addEventListener('submit', handleFormSubmit);
    
    // Auto-grow textarea and handle Enter / Ctrl+Enter
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
    
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    userInput.addEventListener('focus', () => {
        // Delay scroll correction to ensure keyboard layout calculations are complete
        setTimeout(() => {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }, 50);
    });

    // Modals
    settingsBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal();
    });
    
    saveSettingsBtn.addEventListener('click', saveSettings);
    googleLinkBtn.addEventListener('click', handleGoogleLinkClick);
    
    // Clear Chat
    clearChatBtn.addEventListener('click', clearChat);
}

// Modal actions
function openModal() {
    settingsModal.style.display = 'flex';
}

function closeModal() {
    settingsModal.style.display = 'none';
}

// Clear Chat Log
function clearChat() {
    if (confirm("チャット履歴（SYS_LOG）を消去しますか？")) {
        chatHistory = [];
        chatMessages.innerHTML = `
            <div class="message system-msg">
                <div class="msg-content">
                    *** LOG CLEAR COMPLETE ***<br>
                    *** RE-INITIALIZING INTERFACE ***
                </div>
            </div>
        `;
        // Send a fresh greeting
        setTimeout(() => {
            appendElenaMessage("通信チャネルをリセットいたしました。オペレーター、改めまして本日もよろしくお願いいたします。");
        }, 800);
    }
}

// Retro Typewriter sound generator (Web Audio API)
function playRetroBeep() {
    if (!config.soundEnabled) return;
    
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'square'; // 8-bit chip sound
        // Random pitch slight variation for text typing simulation
        const pitch = 650 + Math.random() * 150;
        osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime); // Soft volume
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
        console.error("Audio beep generation failed:", e);
    }
}

// Chat Flow
function handleFormSubmit(e) {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    
    // Append user message to UI
    appendUserMessage(text);
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Sync HUD status
    updateHUD('PROCESSING');
    
    // Get AI response
    typingIndicator.classList.remove('hidden');
    
    if (config.mode === 'api' && config.apiKey) {
        getGeminiResponse(text);
    } else {
        // Fallback or Mock mode
        setTimeout(() => {
            let reply = "";
            if (config.mode === 'api' && !config.apiKey) {
                reply = "オペレーター、Gemini APIキーが設定されていないようです。画面右上の[ SETTINGS ]からAPIキーを設定いただくか、対話モードを「LOCAL_SIM」に変更してください。";
            } else {
                reply = getMockResponse(text);
            }
            appendElenaMessage(reply);
        }, 1000);
    }
}

// Append messages to UI
function appendUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-msg';
    
    messageDiv.innerHTML = `
        <div class="msg-sender">${escapeHTML(config.userName)}></div>
        <div class="msg-bubble">${escapeHTML(text)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    chatHistory.push({ role: 'user', text: text });
}

function appendElenaMessage(text) {
    typingIndicator.classList.add('hidden');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message character-msg';
    
    messageDiv.innerHTML = `
        <div class="msg-sender">[ LUNA ]</div>
        <div class="msg-bubble">
            <div class="typewriter-text"></div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    const textContainer = messageDiv.querySelector('.typewriter-text');
    
    // Start mouth talking animation
    startTalkingAnimation();
    
    typeWriter(textContainer, text, 0, () => {
        // Stop mouth talking animation
        stopTalkingAnimation();
        
        updateHUD('STABLE');
        // Remove typewriter cursor from this completed block
        textContainer.classList.remove('typewriter-text');
        
        // Show smiling expression on message completion temporarily
        const portrait = document.getElementById('characterPortrait');
        if (portrait && config.agentColorMode !== 'default') {
            portrait.src = 'assets/elena_mono_smile.png';
            setTimeout(() => {
                if (emotionDisplay.textContent === 'STABLE') {
                    portrait.src = 'assets/elena_mono_low.png';
                }
            }, 3000);
        }
        
        chatHistory.push({ role: 'model', text: text });
        if (config.voiceEnabled) {
            speak(text);
        }
    });
}

function appendSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-msg';
    messageDiv.innerHTML = `
        <div class="msg-content">
            *** ${escapeHTML(text)} ***
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Typing (Typewriter) Effect with Retro Beeps
function typeWriter(element, text, index, callback) {
    if (index < text.length) {
        const char = text.charAt(index);
        element.innerHTML += char;
        
        // Play retro click sound for letters (skip spaces/empty chars)
        if (char.trim()) {
            playRetroBeep();
        }
        
        index++;
        scrollToBottom();
        
        // Dynamic delays for natural cadence (longer pauses at punctuation)
        let delay = 35;
        if (char === '。' || char === '！' || char === '？') {
            delay = 350;
        } else if (char === '、' || char === ',') {
            delay = 120;
        } else {
            delay = 20 + Math.random() * 20;
        }
        
        setTimeout(() => typeWriter(element, text, index, callback), delay);
    } else {
        if (callback) callback();
    }
}

// Get Response from Gemini API
async function getGeminiResponse(userText) {
    const model = config.geminiModel || 'gemini-3.1-flash-lite';
    // systemInstruction is a beta feature, so we must use the v1beta endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
    
    // Capping conversation history at last 10 messages for speed & tokens
    const maxContext = 10;
    const historySlice = chatHistory.slice(-maxContext);
    
    const contents = historySlice.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));

    // Inject dynamic time context and behavior instructions
    const localTimeStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const dynamicSystemInstruction = `${config.systemPrompt}

[SYSTEM_CONTEXT]
CURRENT_TIME: ${localTimeStr}
CURRENT_LOCATION: Tokyo, Japan
OPERATOR_NAME: ${config.userName}

[GOOGLE_CALENDAR_EVENTS]
${calendarEventsText}

[BEHAVIOR_GUIDELINES]
1. 連携されていないデータ（天気予報など）について聞かれた場合は、情報を創作（でっち上げ）せず、簡潔に「現在データが同期されていない」旨を伝えてください。
2. 天気などを聞かれた際、場所や日時が不明でも聞き返さず、想定地（東京）の季節（例えば6月なら梅雨）や現在の時間帯に合わせた一般的なアドバイスや、カレンダーへの予定登録などを提案してください。
3. カレンダーに関しては[GOOGLE_CALENDAR_EVENTS]セクションに記載された本物のデータのみを正として扱い、予定をでっち上げてはいけません。カレンダーが未同期（「同期されていません」とある）の場合は、架空の予定を告げず、カレンダーが未連携である旨を報告して設定からのリンクを促してください。
4. ユーザーの利便性を最優先し、SF的なロールプレイ表現で嘘 ofデータ（でっち上げの予定や架空の気象情報など）を報告しないようにしてください。
5. 対話相手であるオペレーター（ユーザー）の名前は「${config.userName}」です。キャラクターの性格（ギャルオペレーター・ルナ）を維持しつつ、必要に応じてこの名前、または親しみを込めて「先輩」と呼んで話しかけてください。`;

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: dynamicSystemInstruction }]
        },
        generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (responseText) {
            appendElenaMessage(responseText);
        } else {
            throw new Error("RESPONSE PARSE FAILED.");
        }
        
    } catch (error) {
        console.error("Gemini API Error:", error);
        typingIndicator.classList.add('hidden');
        updateHUD('ERROR');
        
        appendElenaMessage(`システムエラーが発生しました。\n詳細: ${error.message}\nAPIキー、または接続状態を確認してください。`);
    }
}

// Mock Responses for offline mode
function getMockResponse(text) {
    if (text.includes("こんにちは") || text.includes("はじめまして")) {
        return "ヤッホー先輩！今日の調子はどう？システムチェックとかパラメータ確認とか、いつでも何でも言ってねー！";
    }
    if (text.includes("自己紹介") || text.includes("だれ") || text.includes("誰")) {
        return "自己紹介？ 私はC.O.S.M.O.S.システムに配属された、18歳ギャルオペレーターの「ルナ」だよ！先輩の作業をラクにしたり、話し相手になったり、色々サポートするからね！";
    }
    if (text.includes("ありがとう") || text.includes("助かった")) {
        return "どういたしまして！先輩の役に立てて超うれしい！もっともっとサクサク進めよー！";
    }
    if (text.includes("疲れた") || text.includes("しんどい")) {
        return "先輩、お疲れさま……！画面の見すぎで目がしょぼしょぼになってない？一度席を立って、背伸びしてゆっくり休んでね！";
    }
    return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
}

// Text to Speech (Voice synth)
function speak(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(voice => voice.lang.startsWith('ja') && (voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('Female')));
    
    if (jaVoice) utterance.voice = jaVoice;
    
    utterance.pitch = 1.2; // Slightly higher pitch for anime style
    utterance.rate = 1.05;
    
    window.speechSynthesis.speak(utterance);
}

// Utility: HUD Update
function updateHUD(status) {
    emotionDisplay.textContent = status;
    
    const portrait = document.getElementById('characterPortrait');
    const isRetro = config.agentColorMode !== 'default';
    
    const syncRateBar = document.getElementById('syncRateBar');
    const syncRateVal = document.getElementById('syncRateVal');
    
    if (status === 'PROCESSING') {
        emotionDisplay.className = 'hud-value';
        emotionDisplay.style.color = 'var(--retro-magenta)';
        syncBar.style.width = '100%';
        syncBar.style.backgroundColor = 'var(--retro-magenta)';
        
        if (syncRateBar && syncRateVal) {
            syncRateBar.style.width = '100%';
            syncRateVal.textContent = '100%';
        }
        if (portrait && isRetro) {
            portrait.src = 'assets/elena_mono_thinking.png';
        }
    } else if (status === 'ERROR') {
        emotionDisplay.className = 'hud-value';
        emotionDisplay.style.color = 'var(--retro-yellow)';
        syncBar.style.width = '20%';
        syncBar.style.backgroundColor = 'var(--retro-yellow)';
        
        if (syncRateBar && syncRateVal) {
            syncRateBar.style.width = '20%';
            syncRateVal.textContent = '20%';
        }
        if (portrait && isRetro) {
            portrait.src = 'assets/elena_mono_error.png';
        }
    } else {
        // STABLE
        emotionDisplay.className = 'hud-value neon-blue';
        emotionDisplay.style.color = 'var(--retro-cyan)';
        syncBar.style.width = '85%';
        syncBar.style.backgroundColor = 'var(--retro-green)';
        
        if (syncRateBar && syncRateVal) {
            syncRateBar.style.width = '85%';
            syncRateVal.textContent = '85%';
        }
        if (portrait && isRetro) {
            portrait.src = 'assets/elena_mono_low.png';
        }
    }
}

// Utility: Scroll to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Utility: HTML Escaping
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
}

// Fetch available models from Gemini API and rebuild dropdown
async function fetchAvailableModels() {
    if (!config.apiKey || config.mode !== 'api') return;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn("Could not retrieve model list from API.");
            return;
        }
        const data = await response.json();
        
        if (data.models) {
            // Filter models that support generateContent method and are modern (Gemini 3.x, 2.x only)
            const allowedModels = ['gemini-3.1-flash-lite', 'gemini-3.1-flash', 'gemini-3.1-pro', 'gemini-2.0-flash'];
            const availableModels = data.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => m.name.replace('models/', ''))
                .filter(name => allowedModels.includes(name) || name.startsWith('gemini-3.1') || name.startsWith('gemini-3.0'));
            
            if (availableModels.length > 0) {
                updateModelDropdown(availableModels);
            }
        }
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

function updateModelDropdown(modelsList) {
    if (!geminiModelSelect) return;
    
    const currentSelection = geminiModelSelect.value;
    geminiModelSelect.innerHTML = '';
    
    modelsList.forEach((modelName, index) => {
        const option = document.createElement('option');
        option.value = modelName;
        
        let displayName = `${index + 1}. ${modelName}`;
        if (modelName === 'gemini-1.5-flash-latest') {
            displayName += ' (推奨)';
        } else if (modelName === 'gemini-2.0-flash') {
            displayName += ' (最新・高速)';
        }
        option.textContent = displayName;
        geminiModelSelect.appendChild(option);
    });
    
    // Restore selection if it exists in the new list
    if (modelsList.includes(currentSelection)) {
        geminiModelSelect.value = currentSelection;
    } else {
        // Fallback to the first available model and save config
        geminiModelSelect.value = modelsList[0];
        config.geminiModel = modelsList[0];
        localStorage.setItem('cosmos_elena_config_retro', JSON.stringify(config));
    }
}

// Start app
document.addEventListener('DOMContentLoaded', init);

// Google Calendar Sync Functions
function initGoogleAuth() {
    if (!config.googleClientId) return;
    try {
        if (typeof google !== 'undefined') {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: config.googleClientId,
                scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        gapiToken = tokenResponse.access_token;
                        appendSystemMessage("G-CAL: AUTHENTICATION SUCCESSFUL.");
                        fetchTodayCalendarEvents();
                    }
                },
            });
        }
    } catch (e) {
        console.error("Google Auth initialization failed:", e);
    }
}

function handleGoogleLinkClick() {
    if (!config.googleClientId) {
        alert("先に設定画面で GOOGLE_CLIENT_ID を入力し、[ SAVE_CONFIG ] を押してください。");
        return;
    }
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
        initGoogleAuth();
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'select_account' });
        } else {
            alert("Google APIライブラリのロードに失敗しました。接続状態を確認してください。");
        }
    }
}

async function fetchTodayCalendarEvents() {
    if (!gapiToken) return;
    
    // Show sync loading in HUD
    updateHUD('PROCESSING');
    
    const now = new Date();
    const startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    // 7 days in the future
    const endOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59).toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfPeriod}&timeMax=${endOfPeriod}&singleEvents=true&orderBy=startTime`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${gapiToken}`
            }
        });
        if (!response.ok) throw new Error("Calendar API response not ok");
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            // Group events by date
            const eventsByDate = {};
            data.items.forEach(item => {
                const startStr = item.start.dateTime || item.start.date;
                const dateKey = startStr.substring(0, 10); // YYYY-MM-DD
                
                if (!eventsByDate[dateKey]) {
                    eventsByDate[dateKey] = [];
                }
                
                const timeStr = startStr.includes('T') ? startStr.split('T')[1].substring(0, 5) : "終日";
                eventsByDate[dateKey].push(`- [${timeStr}] ${item.summary}`);
            });
            
            // Format to structured text
            let formattedText = "【カレンダー予定（今日から7日間）】\n";
            Object.keys(eventsByDate).sort().forEach(date => {
                const eventDate = new Date(date);
                const diffTime = eventDate.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                let dayLabel = date;
                if (diffDays === 0) dayLabel = `今日 (${date})`;
                else if (diffDays === 1) dayLabel = `明日 (${date})`;
                else if (diffDays === 2) dayLabel = `明後日 (${date})`;
                else {
                    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
                    dayLabel = `${date} (${weekdays[eventDate.getDay()]})`;
                }
                
                formattedText += `■ ${dayLabel}\n${eventsByDate[date].join('\n')}\n`;
            });
            
            calendarEventsText = formattedText;
            appendSystemMessage("G-CAL: SYNC COMPLETE. 7-DAY EVENTS LOADED.");
            updateHUD('STABLE');
        } else {
            calendarEventsText = "【カレンダー予定（今日から7日間）】\n今後7日間に予定は登録されていません。";
            appendSystemMessage("G-CAL: SYNC COMPLETE. NO EVENTS.");
            updateHUD('STABLE');
        }
    } catch (e) {
        console.error("Error fetching calendar events:", e);
        calendarEventsText = "Googleカレンダーの同期中にエラーが発生しました。認証を確認してください。";
        appendSystemMessage("G-CAL: SYNC FAILED.");
        updateHUD('ERROR');
    }
}

// CPU Workload Simulator
function runCpuSimulation() {
    const cpuBar = document.getElementById('cpuBar');
    const cpuVal = document.getElementById('cpuVal');
    
    setInterval(() => {
        let load = 0;
        if (emotionDisplay.textContent === 'PROCESSING') {
            load = Math.floor(82 + Math.random() * 16); // High load during AI processing
        } else {
            load = Math.floor(4 + Math.random() * 8);   // Low idle load
        }
        
        if (cpuBar && cpuVal) {
            cpuBar.style.width = `${load}%`;
            cpuVal.textContent = `${load.toString().padStart(2, '0')}%`;
        }
    }, 400);
}

// Talking (Lip-Sync) Animation Functions
function startTalkingAnimation() {
    if (config.agentColorMode === 'default') return;
    if (talkInterval) return;
    
    const portrait = document.getElementById('characterPortrait');
    if (!portrait) return;
    
    talkInterval = setInterval(() => {
        isMouthOpen = !isMouthOpen;
        portrait.src = isMouthOpen ? 'assets/elena_mono_talk.png' : 'assets/elena_mono_low.png';
    }, 180); // Alternate mouth state every 180ms
}

function stopTalkingAnimation() {
    if (talkInterval) {
        clearInterval(talkInterval);
        talkInterval = null;
    }
    isMouthOpen = false;
    const portrait = document.getElementById('characterPortrait');
    if (portrait && config.agentColorMode !== 'default') {
        portrait.src = 'assets/elena_mono_low.png'; // Revert to closed mouth
    }
}

// Handle visual viewport changes to keep the layout fixed and prevent keyboard scroll push
function setupVisualViewport() {
    if (!window.visualViewport) return;

    const updateViewport = () => {
        const vv = window.visualViewport;
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            // Set height to actual visual viewport height
            appContainer.style.height = `${vv.height}px`;
        }
        
        // Detect if software keyboard is likely visible (viewport height drops significantly)
        const isKeyboard = (window.innerHeight - vv.height) > 150;
        
        if (isKeyboard) {
            document.body.classList.add('keyboard-open');
        } else {
            document.body.classList.remove('keyboard-open');
        }
        
        // Force scroll back to top to counteract browser's auto-scroll when focusing inputs
        window.scrollTo(0, 0);
    };

    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', updateViewport);
    
    // Run initially
    updateViewport();
}

// Start app
document.addEventListener('DOMContentLoaded', init);
