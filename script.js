// App State
let quizMode = 'mixed'; // 'mixed' or 'organ'
let selectedOrgan = '';
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let answersHistory = []; // { specimen, selectedLabel, isCorrect }
let currentOptions = []; // Array of 4 strings (labels)
let activeComparisonLabel = '';

// DOM Elements
const views = {
    home: document.getElementById('view-home'),
    quiz: document.getElementById('view-quiz'),
    summary: document.getElementById('view-summary'),
    review: document.getElementById('view-review')
};

const navBtns = {
    home: document.getElementById('nav-home'),
    review: document.getElementById('nav-review')
};

// Unique Label Helper
// Returns "Organ, Disease"
function getSpecimenLabel(s) {
    return `${s.organ}, ${s.disease}`;
}

// Image path helper - replaces spaces with %20 for URL compatibility and loads from the 'no_label' folder
function getImagePath(filename) {
    return 'no_label/' + filename.replace(/ /g, '%20');
}

// Initialize App
function init() {
    setupNavigation();
    populateOrganSelectors();
    setupQuizEvents();
    setupReviewPage();
    setupLightbox();
    setupImageErrorDiagnostics();
}

// Navigation & Screen switching
function setupNavigation() {
    // Logo Click -> Go Home
    document.getElementById('btn-header-home').addEventListener('click', () => {
        showView('home');
    });

    navBtns.home.addEventListener('click', () => {
        showView('home');
    });

    navBtns.review.addEventListener('click', () => {
        showView('review');
    });
}

function showView(viewName) {
    // Reset active nav buttons
    Object.values(navBtns).forEach(btn => btn.classList.remove('active'));
    if (viewName === 'home') navBtns.home.classList.add('active');
    if (viewName === 'review') navBtns.review.classList.add('active');

    // Show View
    Object.keys(views).forEach(key => {
        if (key === viewName) {
            views[key].classList.add('active');
        } else {
            views[key].classList.remove('active');
        }
    });

    // If leaving quiz, clean up
    if (viewName !== 'quiz') {
        document.getElementById('quiz-work-area').classList.remove('show-preview');
        document.getElementById('quiz-preview-panel').classList.add('hidden');
    }
}

// Home Page: Populate Organs List
function populateOrganSelectors() {
    const organCounts = {};
    SPECIMENS.forEach(s => {
        organCounts[s.organ] = (organCounts[s.organ] || 0) + 1;
    });

    const organListContainer = document.getElementById('home-organ-list');
    organListContainer.innerHTML = '';

    // Sort organs alphabetically
    const sortedOrgans = Object.keys(organCounts).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

    sortedOrgans.forEach(organ => {
        const count = organCounts[organ];
        const item = document.createElement('div');
        item.className = 'organ-item';
        item.innerHTML = `
            <span class="organ-name">${organ}</span>
            <span class="organ-count">${count} 題</span>
        `;
        item.addEventListener('click', () => {
            startQuiz('organ', organ);
        });
        organListContainer.appendChild(item);
    });
}

// Shuffler
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Start Quiz
function startQuiz(mode, organ = '') {
    quizMode = mode;
    selectedOrgan = organ;
    currentIndex = 0;
    score = 0;
    answersHistory = [];

    // Filter questions
    if (mode === 'mixed') {
        currentQuestions = shuffleArray(SPECIMENS);
        document.getElementById('quiz-title-badge').innerText = '隨機混合大對決 (120題)';
    } else {
        const filtered = SPECIMENS.filter(s => s.organ === organ);
        currentQuestions = shuffleArray(filtered);
        document.getElementById('quiz-title-badge').innerText = `${organ} 專題挑戰 (${filtered.length}題)`;
    }

    showView('quiz');
    loadQuestion();
}

// Load Question
function loadQuestion() {
    if (currentIndex >= currentQuestions.length) {
        showSummary();
        return;
    }

    const currentSpecimen = currentQuestions[currentIndex];
    
    // Reset layout (hide side comparison preview panel)
    document.getElementById('quiz-work-area').classList.remove('show-preview');
    document.getElementById('quiz-preview-panel').classList.add('hidden');

    // Update Progress
    document.getElementById('quiz-progress-text').innerText = `第 ${currentIndex + 1} / ${currentQuestions.length} 題`;
    const percent = ((currentIndex) / currentQuestions.length) * 100;
    document.getElementById('quiz-progress-bar').style.width = `${percent}%`;

    // Load Image (censored image from "無標籤/" folder)
    const imgElement = document.getElementById('quiz-question-image');
    imgElement.src = getImagePath(currentSpecimen.filename);
    
    // Generate Options
    currentOptions = generateOptions(currentSpecimen);

    // Setup Selection State
    document.getElementById('state-selection').classList.remove('hidden');
    document.getElementById('state-comparison').classList.add('hidden');

    const optionsContainer = document.getElementById('quiz-options-container');
    optionsContainer.innerHTML = '';

    currentOptions.forEach((optionLabel, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C, D
        const card = document.createElement('div');
        card.className = 'option-card';
        card.innerHTML = `
            <div class="option-badge">${letter}</div>
            <div class="option-text">${optionLabel}</div>
        `;
        card.addEventListener('click', () => {
            selectAnswer(optionLabel);
        });
        optionsContainer.appendChild(card);
    });
}

// Generate 4 Options (A, B, C, D)
// Prioritizes same-organ diseases
function generateOptions(target) {
    const correctLabel = getSpecimenLabel(target);
    
    // Get unique labels from database
    const allUniqueLabels = Array.from(new Set(SPECIMENS.map(getSpecimenLabel)));

    // Get same-organ unique labels
    const sameOrganLabels = allUniqueLabels.filter(label => {
        return label.startsWith(target.organ + ", ") && label !== correctLabel;
    });

    let distractors = [];
    if (sameOrganLabels.length >= 3) {
        // We have enough distractors from the same organ
        distractors = shuffleArray(sameOrganLabels).slice(0, 3);
    } else {
        // Take whatever we have from the same organ
        distractors = [...sameOrganLabels];
        // Backfill with other organs
        const otherOrganLabels = allUniqueLabels.filter(label => {
            return !label.startsWith(target.organ + ", ");
        });
        const needed = 3 - distractors.length;
        const shuffledOthers = shuffleArray(otherOrganLabels);
        for (let i = 0; i < needed && i < shuffledOthers.length; i++) {
            distractors.push(shuffledOthers[i]);
        }
    }

    // Combine correct answer with distractors and shuffle
    const options = [correctLabel, ...distractors];
    return shuffleArray(options);
}

// Select Answer
function selectAnswer(selectedLabel) {
    const currentSpecimen = currentQuestions[currentIndex];
    const correctLabel = getSpecimenLabel(currentSpecimen);
    const isCorrect = (selectedLabel === correctLabel);

    if (isCorrect) score++;

    answersHistory.push({
        specimen: currentSpecimen,
        selectedLabel: selectedLabel,
        isCorrect: isCorrect
    });

    // Show Feedback View
    document.getElementById('state-selection').classList.add('hidden');
    document.getElementById('state-comparison').classList.remove('hidden');
    
    // Setup Feedback Banner
    const banner = document.getElementById('quiz-feedback-banner');
    const title = document.getElementById('quiz-feedback-title');
    const desc = document.getElementById('quiz-feedback-desc');
    const icon = document.getElementById('quiz-feedback-icon');

    if (isCorrect) {
        banner.className = 'feedback-banner correct';
        title.innerText = '回答正確！';
        icon.innerText = '✓';
    } else {
        banner.className = 'feedback-banner incorrect';
        title.innerText = '回答錯誤！';
        icon.innerText = '✗';
    }
    desc.innerText = `正確診斷為：${correctLabel}`;

    // Populate Comparison Buttons
    const compContainer = document.getElementById('comparison-options-container');
    compContainer.innerHTML = '';

    currentOptions.forEach((optionLabel) => {
        const btn = document.createElement('div');
        btn.className = 'comp-btn';
        
        let indicatorHTML = '';
        if (optionLabel === correctLabel) {
            indicatorHTML = `<span class="comp-indicator correct-answer">正確答案</span>`;
        } else if (optionLabel === selectedLabel) {
            indicatorHTML = `<span class="comp-indicator selected-wrong">您的選擇</span>`;
        }

        btn.innerHTML = `
            <span>${optionLabel}</span>
            ${indicatorHTML}
        `;
        
        btn.addEventListener('click', () => {
            setComparisonActive(optionLabel, btn);
        });
        compContainer.appendChild(btn);
    });

    // Enable Split View & load Correct Option image as preview by default
    document.getElementById('quiz-work-area').classList.add('show-preview');
    document.getElementById('quiz-preview-panel').classList.remove('hidden');
    
    // Find correct button and click it to initialize preview
    const defaultBtn = Array.from(compContainer.children).find(b => b.innerText.includes(correctLabel));
    if (defaultBtn) {
        setComparisonActive(correctLabel, defaultBtn);
    }
}

// Activate Comparison Option Preview
function setComparisonActive(label, btnElement) {
    activeComparisonLabel = label;
    
    // Remove active style from all comparison buttons
    const buttons = document.querySelectorAll('.comp-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Highlight current button
    btnElement.classList.add('active');

    // Find a matching specimen to load censored image from the '無標籤' folder
    const matchingSpecimen = SPECIMENS.find(s => getSpecimenLabel(s) === label);
    const previewImg = document.getElementById('quiz-preview-image');
    
    if (matchingSpecimen) {
        // Load censored image from '無標籤' folder
        previewImg.src = getImagePath(matchingSpecimen.filename);
        document.getElementById('quiz-preview-overlay-text').innerText = `選項對照圖：${label}`;
    } else {
        previewImg.src = '';
        document.getElementById('quiz-preview-overlay-text').innerText = '無對應圖片';
    }
}

// Setup Quiz Buttons (Exit, Next)
function setupQuizEvents() {
    document.getElementById('btn-quiz-exit').addEventListener('click', () => {
        if (confirm('確定要中途退出測驗嗎？您的答題進度將不會被儲存。')) {
            showView('home');
        }
    });

    document.getElementById('btn-quiz-next').addEventListener('click', () => {
        currentIndex++;
        loadQuestion();
    });

    // Card Mixed challenges on Home
    document.querySelector('#card-mode-mixed button').addEventListener('click', () => {
        startQuiz('mixed');
    });

    // Summary screen buttons
    document.getElementById('btn-summary-restart').addEventListener('click', () => {
        startQuiz(quizMode, selectedOrgan);
    });

    document.getElementById('btn-summary-home').addEventListener('click', () => {
        showView('home');
    });
}

// Show Summary Screen
function showSummary() {
    showView('summary');
    
    // Update Score
    const correct = score;
    const total = currentQuestions.length;
    const rate = Math.round((correct / total) * 100);

    document.getElementById('summary-score').innerText = correct;
    document.getElementById('summary-total').innerText = `/ ${total} 題`;
    document.getElementById('stat-correct').innerText = correct;
    document.getElementById('stat-incorrect').innerText = total - correct;
    document.getElementById('stat-rate').innerText = `${rate}%`;

    // Personalized Message
    const msg = document.getElementById('summary-message');
    if (rate >= 90) {
        msg.innerText = '太厲害了！您的病理大體識圖能力簡直完美，絕對能輕鬆通過期末考！';
    } else if (rate >= 75) {
        msg.innerText = '表現優異！大部分的病理檢體都難不倒您，針對錯題加強即可！';
    } else if (rate >= 60) {
        msg.innerText = '及格通過！建議可以使用「全面複習區」多看原圖標籤加深印象，再挑戰一次！';
    } else {
        msg.innerText = '仍需努力！別氣餒，先去「全面複習區」背誦標籤與檢體外觀，然後重啟測驗吧！';
    }
}

// VIEW: Review Page Setup
function setupReviewPage() {
    const searchInput = document.getElementById('search-input');
    const organTabsContainer = document.getElementById('review-organ-tabs');
    const galleryContainer = document.getElementById('review-gallery-container');

    let currentFilterOrgan = 'all';
    let currentSearchQuery = '';

    // Render Tabs
    const uniqueOrgans = Array.from(new Set(SPECIMENS.map(s => s.organ))).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    
    organTabsContainer.innerHTML = '<button class="tab-btn active" data-organ="all">全部器官</button>';
    uniqueOrgans.forEach(organ => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.setAttribute('data-organ', organ);
        btn.innerText = organ;
        organTabsContainer.appendChild(btn);
    });

    // Render Cards
    function renderGallery() {
        galleryContainer.innerHTML = '';
        
        const filtered = SPECIMENS.filter(s => {
            const matchesOrgan = (currentFilterOrgan === 'all' || s.organ === currentFilterOrgan);
            const label = getSpecimenLabel(s).toLowerCase();
            const matchesSearch = label.includes(currentSearchQuery.toLowerCase());
            return matchesOrgan && matchesSearch;
        });

        if (filtered.length === 0) {
            galleryContainer.innerHTML = '<div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-weight: 600;">沒有找到符合搜尋條件的檢體。</div>';
            return;
        }

        filtered.forEach(s => {
            const card = document.createElement('div');
            card.className = 'gallery-card';
            
            // Image wrapper inside card
            // Loads censored image from '無標籤' folder
            card.innerHTML = `
                <div class="gallery-card-img-wrapper">
                    <img src="${getImagePath(s.filename)}" alt="${getSpecimenLabel(s)}" loading="lazy">
                </div>
                <div class="gallery-card-info">
                    <span class="gallery-card-organ">${s.organ}</span>
                    <h4 class="gallery-card-disease">${s.disease}</h4>
                </div>
            `;
            
            // Lightbox on image click
            card.querySelector('img').addEventListener('click', () => {
                openLightbox(getImagePath(s.filename), getSpecimenLabel(s));
            });

            galleryContainer.appendChild(card);
        });
    }

    // Tab Filter Click
    organTabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            const tabs = organTabsContainer.querySelectorAll('.tab-btn');
            tabs.forEach(t => t.classList.remove('active'));
            
            e.target.classList.add('active');
            currentFilterOrgan = e.target.getAttribute('data-organ');
            renderGallery();
        }
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.trim();
        renderGallery();
    });

    // Initial Render
    renderGallery();
}

// Lightbox Modal setup
function setupLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    const closeBtn = document.getElementById('lightbox-close-btn');

    closeBtn.addEventListener('click', closeLightbox);
    
    // Close on click outside image
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.style.display === 'flex') {
            closeLightbox();
        }
    });

    // Add zoom capability to quiz images
    document.getElementById('quiz-question-image').addEventListener('click', function() {
        if (this.src) {
            openLightbox(this.src, '題目檢體照片');
        }
    });

    document.getElementById('quiz-preview-image').addEventListener('click', function() {
        if (this.src) {
            openLightbox(this.src, `選項對照原圖：${activeComparisonLabel}`);
        }
    });
}

function openLightbox(src, caption) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-image-src');
    const lightboxCaption = document.getElementById('lightbox-caption-text');

    lightboxImg.src = src;
    lightboxCaption.innerText = caption;
    lightbox.style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('image-lightbox').style.display = 'none';
}

// Setup diagnostic listeners for quiz image loading errors
function setupImageErrorDiagnostics() {
    const questionImg = document.getElementById('quiz-question-image');
    const errorDiv = document.getElementById('quiz-image-error');

    if (!questionImg || !errorDiv) return;

    questionImg.addEventListener('error', () => {
        // Decode URI for human readability
        const decodedSrc = decodeURIComponent(questionImg.src);
        errorDiv.innerHTML = `⚠️ 圖片載入失敗！<br>瀏覽器嘗試載入的完整路徑為：<br><code style="word-break: break-all; background-color: var(--bg-accent); padding: 4px; border-radius: 4px; display: inline-block; margin-top: 6px;">${decodedSrc}</code>`;
        errorDiv.classList.remove('hidden');
        questionImg.style.display = 'none';
    });

    questionImg.addEventListener('load', () => {
        errorDiv.classList.add('hidden');
        questionImg.style.display = 'block';
    });
}

// Run On Load
window.addEventListener('DOMContentLoaded', init);
