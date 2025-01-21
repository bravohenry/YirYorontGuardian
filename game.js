// 游戏常量
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BASE_PLAYER_SPEED = 5;
const BASE_ITEM_SPEED = 2;
const BASE_SPAWN_INTERVAL = 2000;
const PLAYER_WIDTH = 60;
const PLAYER_HEIGHT = 100;
const ITEM_WIDTH = 40;
const ITEM_HEIGHT = 40;
const FLOAT_TEXT_SPEED = 1;
const FLOAT_TEXT_LIFETIME = 100;
const NOTIFICATION_LIFETIME = 150;
const MODERNIZATION_START_SCORE = 300;  // 开始现代化的分数
const MODERNIZATION_DURATION = 200;     // 完成现代化需要的分数跨度
const BACKGROUND_ALPHA = 0.5;           // 背景透明度

// 难度系统常量
const DIFFICULTY_THRESHOLDS = [
    { score: 100, speedMultiplier: 1.2, spawnInterval: 1800, probabilityShift: 0.1 },
    { score: 200, speedMultiplier: 1.4, spawnInterval: 1600, probabilityShift: 0.15 },
    { score: 300, speedMultiplier: 1.6, spawnInterval: 1400, probabilityShift: 0.2 },
    { score: 400, speedMultiplier: 1.8, spawnInterval: 1200, probabilityShift: 0.25 },
    { score: 500, speedMultiplier: 2.0, spawnInterval: 1000, probabilityShift: 0.3 }
];

// 游戏状态
let gameStarted = false;
let gamePaused = false;
let score = 0;
let culturalBalance = 50;
let floatingTexts = [];  // 初始化浮动文字数组
let notifications = [];  // 初始化通知数组
let currentSpawnInterval = BASE_SPAWN_INTERVAL;
let spawnIntervalId = null;
let player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - PLAYER_HEIGHT - 10,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: BASE_PLAYER_SPEED,
    moving: {
        left: false,
        right: false
    }
};

// 掉落物品数组
let items = [];
const itemTypes = {
    STONE_AXE: { score: 10, balance: 10, image: 'traditional.png', probability: 0.4 },
    STEEL_AXE: { score: 5, balance: -10, image: 'modern.png', probability: 0.3 },
    TOTEM: { score: 0, balance: 20, image: 'Totem.png', probability: 0.2 },
    BIBLE: { score: 0, balance: -15, image: 'bible.png', probability: 0.1 }
};

// 加载图片资源
const images = {};
let loadedImages = 0;
const requiredImages = [
    'traditional.png', 'modern.png', 'Totem.png', 
    'bible.png', 'player.png', 'game-bg.png', 'game-bg2.png'
];

function loadImages() {
    requiredImages.forEach(imageName => {
        const img = new Image();
        img.src = `Asset/${imageName}`;
        img.onload = () => {
            loadedImages++;
            if (loadedImages === requiredImages.length) {
                initGame();
            }
        };
        img.onerror = () => {
            console.error(`Failed to load image: ${imageName}`);
        };
        images[imageName] = img;
    });
}

// 获取Canvas上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 初始化游戏
function initGame() {
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('pauseButton').addEventListener('click', togglePause);
    document.getElementById('restartButton').addEventListener('click', restartGame);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    drawStartScreen();
}

// 获取当前难度设置
function getCurrentDifficulty() {
    let difficulty = {
        speedMultiplier: 1,
        spawnInterval: BASE_SPAWN_INTERVAL,
        probabilityShift: 0
    };
    
    for (const threshold of DIFFICULTY_THRESHOLDS) {
        if (score >= threshold.score) {
            difficulty = threshold;
        } else {
            break;
        }
    }
    
    return difficulty;
}

// 更新物品概率
function getAdjustedItemTypes() {
    const difficulty = getCurrentDifficulty();
    const shift = difficulty.probabilityShift;
    
    return {
        STONE_AXE: { 
            ...itemTypes.STONE_AXE,
            probability: Math.max(0.2, itemTypes.STONE_AXE.probability - shift)
        },
        STEEL_AXE: { 
            ...itemTypes.STEEL_AXE,
            probability: itemTypes.STEEL_AXE.probability + (shift * 0.5)
        },
        TOTEM: { 
            ...itemTypes.TOTEM,
            probability: Math.max(0.1, itemTypes.TOTEM.probability - shift * 0.3)
        },
        BIBLE: { 
            ...itemTypes.BIBLE,
            probability: itemTypes.BIBLE.probability + (shift * 0.8)
        }
    };
}

// 开始游戏
function startGame() {
    gameStarted = true;
    gamePaused = false;
    score = 0;
    culturalBalance = 50;
    items = [];
    floatingTexts = [];  // 重置浮动文字
    notifications = [];  // 重置通知
    player.x = CANVAS_WIDTH / 2;  // 重置玩家位置
    
    // 清除之前的生成间隔
    if (spawnIntervalId) {
        clearInterval(spawnIntervalId);
    }
    
    document.getElementById('startScreen').style.display = 'none';
    gameLoop();
    
    // 设置初始生成间隔
    spawnIntervalId = setInterval(spawnItem, BASE_SPAWN_INTERVAL);
}

// 重启游戏
function restartGame() {
    if (gameStarted) {
        startGame();
    }
}

// 切换暂停状态
function togglePause() {
    if (gameStarted) {
        gamePaused = !gamePaused;
        if (!gamePaused) {
            gameLoop();
        }
        document.getElementById('pauseButton').textContent = gamePaused ? 'Resume' : 'Pause';
    }
}

// 游戏主循环
function gameLoop() {
    if (!gameStarted || gamePaused) return;
    
    update();
    draw();
    updateUI();
    
    if (culturalBalance <= 0) {
        gameOver();
        return;
    }
    
    requestAnimationFrame(gameLoop);
}

// 更新游戏状态
function update() {
    const difficulty = getCurrentDifficulty();
    const currentItemSpeed = BASE_ITEM_SPEED * difficulty.speedMultiplier;
    
    // 更新玩家位置
    if (player.moving.left && player.x > 0) {
        player.x -= player.speed;
    }
    if (player.moving.right && player.x < CANVAS_WIDTH - player.width) {
        player.x += player.speed;
    }
    
    // 更新物品位置和碰撞检测
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += currentItemSpeed;
        
        // 检测碰撞
        if (checkCollision(player, item)) {
            handleCollision(item);
            items.splice(i, 1);
        }
        // 移除超出屏幕的物品
        else if (item.y > CANVAS_HEIGHT) {
            items.splice(i, 1);
            // 未接住物品惩罚（随难度增加）
            const balancePenalty = 5 * difficulty.speedMultiplier;
            culturalBalance = Math.max(0, culturalBalance - balancePenalty);
        }
    }
    
    // 更新生成间隔
    if (currentSpawnInterval !== difficulty.spawnInterval) {
        currentSpawnInterval = difficulty.spawnInterval;
        if (spawnIntervalId) {
            clearInterval(spawnIntervalId);
            spawnIntervalId = setInterval(spawnItem, currentSpawnInterval);
        }
    }

    // 更新浮动文字和通知
    updateFloatingTexts();
    updateNotifications();
}

// 绘制游戏画面
function draw() {
    // 清空画布
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 计算背景混合比例
    let modernizationProgress = 0;
    if (score >= MODERNIZATION_START_SCORE) {
        modernizationProgress = Math.min((score - MODERNIZATION_START_SCORE) / MODERNIZATION_DURATION, 1);
        
        // 当刚开始现代化时显示提示
        if (Math.abs(score - MODERNIZATION_START_SCORE) < 10 && !gamePaused) {
            addNotification('Modernization Begins...');
        }
        // 当完全现代化时显示提示
        if (Math.abs(score - (MODERNIZATION_START_SCORE + MODERNIZATION_DURATION)) < 10 && !gamePaused) {
            addNotification('Full Modernization Achieved!');
        }
    }
    
    // 绘制传统背景（透明度随现代化程度降低）
    ctx.globalAlpha = BACKGROUND_ALPHA * (1 - modernizationProgress * 0.5);
    ctx.drawImage(images['game-bg.png'], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 绘制现代背景（透明度随现代化程度提高）
    if (score >= MODERNIZATION_START_SCORE && images['game-bg2.png']) {
        ctx.globalAlpha = BACKGROUND_ALPHA * modernizationProgress;
        ctx.drawImage(images['game-bg2.png'], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // 重置透明度
    ctx.globalAlpha = 1.0;
    
    // 绘制玩家
    if (images['player.png']) {  // 确保图片已加载
        const playerImage = images['player.png'];
        const scale = Math.min(PLAYER_WIDTH / playerImage.width, PLAYER_HEIGHT / playerImage.height);
        const newWidth = playerImage.width * scale;
        const newHeight = playerImage.height * scale;
        const xOffset = (PLAYER_WIDTH - newWidth) / 2;
        ctx.drawImage(
            playerImage, 
            player.x + xOffset, 
            player.y + (PLAYER_HEIGHT - newHeight), 
            newWidth, 
            newHeight
        );
    }
    
    // 绘制物品
    items.forEach(item => {
        if (images[item.type.image]) {  // 确保图片已加载
            ctx.drawImage(images[item.type.image], item.x, item.y, ITEM_WIDTH, ITEM_HEIGHT);
        }
    });

    // 绘制浮动文字
    floatingTexts.forEach(text => {
        ctx.save();
        ctx.globalAlpha = text.alpha;
        ctx.fillStyle = text.color;
        ctx.font = '16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
    });

    // 绘制通知
    if (notifications.length > 0) {
        ctx.save();
        ctx.globalAlpha = notifications[0].alpha;
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.strokeText(notifications[0].text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4);
        ctx.fillText(notifications[0].text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4);
        ctx.restore();
    }

    // 如果游戏暂停，显示暂停文字
    if (gamePaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'white';
        ctx.font = '32px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
}

// 更新UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('balance').textContent = culturalBalance;
}

// 生成新物品
function spawnItem() {
    if (!gameStarted || gamePaused) return;
    
    const adjustedItemTypes = getAdjustedItemTypes();
    const rand = Math.random();
    let cumProb = 0;
    let selectedType;
    
    for (const type in adjustedItemTypes) {
        cumProb += adjustedItemTypes[type].probability;
        if (rand <= cumProb) {
            selectedType = adjustedItemTypes[type];
            break;
        }
    }
    
    items.push({
        x: Math.random() * (CANVAS_WIDTH - ITEM_WIDTH),
        y: -ITEM_HEIGHT,
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        type: selectedType
    });
}

// 碰撞检测
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// 处理碰撞
function handleCollision(item) {
    const oldScore = score;
    score += item.type.score;
    culturalBalance = Math.max(0, Math.min(100, culturalBalance + item.type.balance));
    
    // 添加分数动画
    let scoreText = (item.type.score > 0 ? '+' : '') + item.type.score;
    let scoreColor = item.type.score > 0 ? '#27ae60' : '#e74c3c';
    
    if (item.type.score !== 0) {
        addFloatingText(scoreText, item.x + ITEM_WIDTH / 2, item.y, scoreColor);
    }
    
    // 添加特殊物品提示
    switch(item.type.image) {
        case 'bible.png':
            addNotification('Religious Influence Increased!');
            break;
        case 'Totem.png':
            addNotification('Cultural Power Restored!');
            break;
    }
    
    // 检查是否跨越难度阈值
    const oldDifficulty = DIFFICULTY_THRESHOLDS.findIndex(t => oldScore >= t.score);
    const newDifficulty = DIFFICULTY_THRESHOLDS.findIndex(t => score >= t.score);
    
    if (newDifficulty > oldDifficulty && newDifficulty !== -1) {
        addNotification('Difficulty Increased!');
    }
    
    // 检查是否跨越现代化阈值
    const wasModern = oldScore >= MODERNIZATION_START_SCORE;
    const isModern = score >= MODERNIZATION_START_SCORE;
    if (!wasModern && isModern) {
        addNotification('The World is Changing...');
    }
}

// 游戏结束
function gameOver() {
    gameStarted = false;
    const startScreen = document.getElementById('startScreen');
    startScreen.style.display = 'flex';
    startScreen.innerHTML = `
        <h1>Game Over</h1>
        <p>Final Score:<br>${score}</p>
        <button id="startButton">Play Again</button>
    `;
    document.getElementById('startButton').addEventListener('click', startGame);
}

// 键盘事件处理
function handleKeyDown(e) {
    if (e.key === 'ArrowLeft') {
        player.moving.left = true;
    } else if (e.key === 'ArrowRight') {
        player.moving.right = true;
    } else if (e.key === 'p' || e.key === 'P') {
        togglePause();
    }
}

function handleKeyUp(e) {
    if (e.key === 'ArrowLeft') {
        player.moving.left = false;
    } else if (e.key === 'ArrowRight') {
        player.moving.right = false;
    }
}

// 绘制开始界面
function drawStartScreen() {
    ctx.fillStyle = '#f5f5dc';  // 米白色背景
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(images['game-bg.png'], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.globalAlpha = 1.0;
}

// 添加浮动文字
function addFloatingText(text, x, y, color) {
    floatingTexts.push({
        text,
        x,
        y,
        color,
        alpha: 1,
        lifetime: FLOAT_TEXT_LIFETIME
    });
}

// 添加通知
function addNotification(text) {
    notifications.push({
        text,
        alpha: 1,
        lifetime: NOTIFICATION_LIFETIME
    });
}

// 分离浮动文字更新逻辑
function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const text = floatingTexts[i];
        text.y -= FLOAT_TEXT_SPEED;
        text.lifetime--;
        text.alpha = text.lifetime / FLOAT_TEXT_LIFETIME;
        
        if (text.lifetime <= 0) {
            floatingTexts.splice(i, 1);
        }
    }
}

// 分离通知更新逻辑
function updateNotifications() {
    for (let i = notifications.length - 1; i >= 0; i--) {
        const notification = notifications[i];
        notification.lifetime--;
        notification.alpha = notification.lifetime / NOTIFICATION_LIFETIME;
        
        if (notification.lifetime <= 0) {
            notifications.splice(i, 1);
        }
    }
}

// 加载游戏
loadImages(); 