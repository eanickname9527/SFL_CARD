// Global state
let cardsData = [];
let allAttributes = new Set();
let equippedCards = [];
const MAX_SLOTS = 5;

// DOM Elements
const dexCardsContainer = document.getElementById('cards-container');
const attrFilter = document.getElementById('attr-filter');
const sortAttr = document.getElementById('sort-attr');
const sortOrder = document.getElementById('sort-order');
const simAttrFilter = document.getElementById('sim-attr-filter');
const simSortAttr = document.getElementById('sim-sort-attr');
const simSortOrder = document.getElementById('sim-sort-order');
const simCardsContainer = document.getElementById('sim-cards-container');
const slotsContainer = document.getElementById('slots-container');
const totalStatsContainer = document.getElementById('total-stats');
const tabBtns = document.querySelectorAll('.tab-btn');
const viewSections = document.querySelectorAll('.view-section');
const backToTopBtn = document.getElementById('back-to-top');

// Initialization
async function init() {
    try {
        const response = await fetch('card_info.txt');
        if (!response.ok) throw new Error('Failed to load card_info.txt');
        const text = await response.text();
        parseCardData(text);
        populateFilters();
        renderDexCards();
        renderSimCards();
        renderSlots();
        updateTotalStats();
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        dexCardsContainer.innerHTML = `<div class="loading" style="color: #ef4444;">載入資料失敗。請確保 card_info.txt 存在於同一目錄下。</div>`;
    }
}

// Data Parsing
function parseCardData(text) {
    const lines = text.split('\n');
    let currentCard = null;
    let currentChapter = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('[')) {
            // Check for chapter start like [第一章]-start-
            const startMatch = line.match(/^\[(.*?)\]-start-$/);
            if (startMatch) {
                currentChapter = startMatch[1];
                continue;
            }
            // Check for chapter end like [第一章]-end-
            const endMatch = line.match(/^\[(.*?)\]-end-$/);
            if (endMatch) {
                currentChapter = null;
                continue;
            }

            // e.g. [世界王卡片][罕見]	創世權能	運氣值, 護盾穿透
            let match = line.match(/\[(.*?)\]\[(.*?)\]\s+(.*?)(?:\t.*)?$/);
            if (!match) match = line.match(/\[(.*?)\]\[(.*?)\]\s+(.*)/);
            if (match) {
                currentCard = {
                    id: 'card_' + cardsData.length,
                    type: match[1],
                    rarity: match[2],
                    name: match[3].trim().split('\t')[0].trim(), // To handle possible extra tabs
                    attributes: [],
                    levels: [],
                    chapter: currentChapter
                };
                cardsData.push(currentCard);
            }
        } else if (line.startsWith('等級')) {
            if (currentCard) {
                let parts = line.split('\t').map(s => s.trim()).filter(s => s);
                parts.shift(); // remove "等級"
                if (parts.length > 1) {
                    let lastPart = parts[parts.length - 1];
                    // Clean up trailing concatenated list if it matches the first property
                    if (lastPart.includes(parts[0])) {
                        parts.pop();
                    }
                }
                currentCard.attributes = parts;
                parts.forEach(attr => allAttributes.add(attr));
            }
        } else if (line.startsWith('Lv.')) {
            if (currentCard) {
                let parts = line.split('\t').map(s => s.trim()).filter(s => s);
                let level = parts.shift();
                
                // Extra safety: if the last element is the comma separated list
                if (parts.length > currentCard.attributes.length) {
                    parts.pop();
                }

                let levelData = {};
                currentCard.attributes.forEach((attr, index) => {
                    levelData[attr] = parts[index] || "0";
                });
                currentCard.levels.push({ level: level, data: levelData });
            }
        }
    }
}

// UI Rendering
function populateFilters() {
    const attrs = Array.from(allAttributes).sort();
    attrs.forEach(attr => {
        const option1 = document.createElement('option');
        option1.value = attr;
        option1.textContent = attr;
        attrFilter.appendChild(option1);

        const optionSort = document.createElement('option');
        optionSort.value = attr;
        optionSort.textContent = attr;
        sortAttr.appendChild(optionSort);

        const optionSimSort = document.createElement('option');
        optionSimSort.value = attr;
        optionSimSort.textContent = attr;
        simSortAttr.appendChild(optionSimSort);

        const option2 = document.createElement('option');
        option2.value = attr;
        option2.textContent = attr;
        simAttrFilter.appendChild(option2);
    });
}

// Helper to get card color
function getTitleColor(card) {
    if (card.type === '世界王卡片') return '#00EC00';
    if (card.type === '活動卡片') return '#F00078';
    if (card.chapter === '第一章') return '#F9F900';
    if (card.chapter === '第二章') return '#FF0000';
    if (card.chapter === '第三章') return '#D200D2';
    return 'inherit';
}

function createCardHTML(card, isSimMode = false, filterAttr = 'all', sortAttr = 'original') {
    const defaultLevel = card.levels.length - 1; // Default to max level (usually Lv.5)
    const currentLvlData = card.levels[defaultLevel].data;
    const isEquipped = equippedCards.some(ec => ec.card.id === card.id);
    const isFull = equippedCards.length >= MAX_SLOTS;
    const isDisabled = isEquipped || isFull;
    const btnText = isEquipped ? '已裝備' : (isFull ? '欄位已滿' : '裝備此卡片');
    
    let attrsHtml = '';
    for (const [attr, val] of Object.entries(currentLvlData)) {
        let colorStyle = '';
        if (attr === filterAttr) {
            colorStyle = 'style="color: #FFD306; font-weight: bold;"';
        } else if (attr === sortAttr) {
            colorStyle = 'style="color: #00BB00; font-weight: bold;"';
        }

        attrsHtml += `
            <div class="attr-row">
                <span class="attr-name" ${colorStyle}>${attr}</span>
                <span class="attr-val">${val}</span>
            </div>
        `;
    }

    let levelOptions = '';
    card.levels.forEach((lvl, idx) => {
        levelOptions += `<option value="${idx}" ${idx === defaultLevel ? 'selected' : ''}>${lvl.level}</option>`;
    });

    const titleStyle = `style="color: ${getTitleColor(card)};"`;

    return `
        <div class="card ${isSimMode ? 'sim-card' : ''} ${isEquipped && isSimMode ? 'equipped' : ''}" data-id="${card.id}" data-rarity="${card.rarity}">
            <div class="card-header">
                <div class="card-title" ${titleStyle}>${card.name}</div>
                <div class="card-tags">
                    <span class="tag">${card.type}</span>
                    <span class="tag">${card.rarity}</span>
                </div>
            </div>
            <div class="card-body">
                <div class="attrs-container">
                    ${attrsHtml}
                </div>
                ${isSimMode ? `
                    <select class="level-selector" onchange="updateCardDisplay(this, '${card.id}')" onclick="event.stopPropagation()" ${isEquipped ? 'disabled' : ''}>
                        ${levelOptions}
                    </select>
                    <button class="equip-btn" onclick="equipCard('${card.id}', event)" ${isDisabled ? 'disabled' : ''}>
                        ${btnText}
                    </button>
                ` : `
                    <select class="level-selector" onchange="updateCardDisplay(this, '${card.id}')">
                        ${levelOptions}
                    </select>
                `}
            </div>
        </div>
    `;
}

function renderDexCards() {
    const filterAttr = attrFilter.value;
    const sortBy = sortAttr.value;
    const order = sortOrder.value;

    dexCardsContainer.innerHTML = '';
    let filteredCards = cardsData.filter(card => 
        filterAttr === 'all' || card.attributes.includes(filterAttr)
    );

    // Sorting
    if (sortBy !== 'original') {
        filteredCards.sort((a, b) => {
            // Get value from max level (usually Lv.5)
            const getVal = (card) => {
                const data = card.levels[card.levels.length - 1].data;
                const valStr = data[sortBy] || "0";
                return parseFloat(valStr.replace('%', '')) || 0;
            };
            
            const valA = getVal(a);
            const valB = getVal(b);
            
            return order === 'asc' ? valA - valB : valB - valA;
        });
    }

    filteredCards.forEach(card => {
        dexCardsContainer.insertAdjacentHTML('beforeend', createCardHTML(card, false, filterAttr, sortBy));
    });

    if (filteredCards.length === 0) {
        dexCardsContainer.innerHTML = '<div class="empty-state">沒有找到符合條件的卡片</div>';
    }
}

function renderSimCards() {
    const filterAttr = simAttrFilter.value;
    const sortBy = simSortAttr.value;
    const order = simSortOrder.value;

    simCardsContainer.innerHTML = '';
    
    let filteredCards = cardsData.filter(card => 
        filterAttr === 'all' || card.attributes.includes(filterAttr)
    );

    // Sorting
    if (sortBy !== 'original') {
        filteredCards.sort((a, b) => {
            const getVal = (card) => {
                const data = card.levels[card.levels.length - 1].data;
                const valStr = data[sortBy] || "0";
                return parseFloat(valStr.replace('%', '')) || 0;
            };
            const valA = getVal(a);
            const valB = getVal(b);
            return order === 'asc' ? valA - valB : valB - valA;
        });
    }

    filteredCards.forEach(card => {
        simCardsContainer.insertAdjacentHTML('beforeend', createCardHTML(card, true, filterAttr, sortBy));
    });
}

window.updateCardDisplay = function(selectElem, cardId) {
    const card = cardsData.find(c => c.id === cardId);
    if (!card) return;
    
    const lvlIdx = parseInt(selectElem.value);
    const lvlData = card.levels[lvlIdx].data;
    
    const isSimView = selectElem.closest('#sim-view') !== null;
    const filter = isSimView ? simAttrFilter.value : attrFilter.value;
    const sort = isSimView ? simSortAttr.value : sortAttr.value;

    const attrsContainer = selectElem.parentElement.querySelector('.attrs-container');
    let attrsHtml = '';
    for (const [attr, val] of Object.entries(lvlData)) {
        let colorStyle = '';
        if (attr === filter) {
            colorStyle = 'style="color: #FFD306; font-weight: bold;"';
        } else if (attr === sort) {
            colorStyle = 'style="color: #00BB00; font-weight: bold;"';
        }

        attrsHtml += `
            <div class="attr-row">
                <span class="attr-name" ${colorStyle}>${attr}</span>
                <span class="attr-val">${val}</span>
            </div>
        `;
    }
    attrsContainer.innerHTML = attrsHtml;
}

// Simulator Logic
window.equipCard = function(cardId, event) {
    event.stopPropagation();
    
    if (equippedCards.length >= MAX_SLOTS) {
        alert('最多只能裝備 5 張卡片！');
        return;
    }

    // 檢查是否已經裝備過同名卡片
    if (equippedCards.some(equipped => equipped.card.id === cardId)) {
        alert('不能裝備重複的卡片！');
        return;
    }

    const cardElem = event.target.closest('.card');
    const lvlSelect = cardElem.querySelector('.level-selector');
    const lvlIdx = parseInt(lvlSelect.value);
    
    const card = cardsData.find(c => c.id === cardId);
    if (card) {
        equippedCards.push({
            instanceId: Date.now() + Math.random().toString(),
            card: card,
            levelIdx: lvlIdx,
            levelName: card.levels[lvlIdx].level,
            data: card.levels[lvlIdx].data
        });
        renderSlots();
        updateTotalStats();
        renderSimCards(); // Re-render to update button states if needed
    }
}

window.removeCard = function(instanceId) {
    equippedCards = equippedCards.filter(c => c.instanceId !== instanceId);
    renderSlots();
    updateTotalStats();
    renderSimCards(); // Re-render to enable buttons again
}

function renderSlots() {
    slotsContainer.innerHTML = '';
    
    for (let i = 0; i < MAX_SLOTS; i++) {
        if (i < equippedCards.length) {
            const equipped = equippedCards[i];
            const titleColor = getTitleColor(equipped.card);

            slotsContainer.insertAdjacentHTML('beforeend', `
                <div class="slot filled">
                    <div class="slot-info">
                        <span class="slot-name" style="color: ${titleColor};">${equipped.card.name}</span>
                        <span class="slot-level">${equipped.levelName}</span>
                    </div>
                    <button class="remove-btn" onclick="removeCard('${equipped.instanceId}')">移除</button>
                </div>
            `);
        } else {
            slotsContainer.insertAdjacentHTML('beforeend', `
                <div class="slot">
                    <span class="slot-empty-text">空欄位</span>
                </div>
            `);
        }
    }
}

function updateTotalStats() {
    if (equippedCards.length === 0) {
        totalStatsContainer.innerHTML = '<div class="empty-state">尚未裝備任何卡片</div>';
        return;
    }

    const totals = {};
    
    equippedCards.forEach(equipped => {
        for (const [attr, valStr] of Object.entries(equipped.data)) {
            // Handle percentages and regular numbers
            let isPercentage = valStr.includes('%');
            let numVal = parseFloat(valStr.replace('%', ''));
            
            if (!isNaN(numVal)) {
                if (!totals[attr]) {
                    totals[attr] = { val: 0, isPercentage: isPercentage };
                }
                totals[attr].val += numVal;
                // If any value is percentage, treat total as percentage
                if (isPercentage) totals[attr].isPercentage = true;
            }
        }
    });

    totalStatsContainer.innerHTML = '';
    
    // Sort attributes by name or let object keys order naturally
    for (const [attr, data] of Object.entries(totals)) {
        let displayVal = data.isPercentage ? data.val.toFixed(1) + '%' : Math.round(data.val * 100) / 100;
        
        totalStatsContainer.insertAdjacentHTML('beforeend', `
            <div class="stat-item">
                <span class="attr-name">${attr}</span>
                <span class="stat-val">${displayVal}</span>
            </div>
        `);
    }
}

// Event Listeners
function setupEventListeners() {
    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            viewSections.forEach(v => v.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Filters
    attrFilter.addEventListener('change', () => renderDexCards());
    sortAttr.addEventListener('change', () => renderDexCards());
    sortOrder.addEventListener('change', () => renderDexCards());

    simAttrFilter.addEventListener('change', () => renderSimCards());
    simSortAttr.addEventListener('change', () => renderSimCards());
    simSortOrder.addEventListener('change', () => renderSimCards());
    
    // Back to Top Scroll Logic
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
