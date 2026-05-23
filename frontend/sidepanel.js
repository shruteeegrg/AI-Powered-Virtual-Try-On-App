// sidepanel.js

// --- DOM Elements ---
const userImageInput = document.getElementById('userImageInput');
const uploadSection = document.getElementById('upload-section');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const changeImageBtn = document.getElementById('change-image-btn');
const resultSection = document.getElementById('result-section');
const historyScroll = document.getElementById('history-scroll'); // <-- CORRECTED ID
const historyPlaceholder = document.getElementById('history-placeholder');
const mainView = document.getElementById('main-view');

const MAX_HISTORY_ITEMS = 10;

// --- User Image Handling ---
userImageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        chrome.storage.local.set({ userImageBase64: e.target.result }, () => {
            setView('preview', e.target.result);
        });
    };
    reader.readAsDataURL(file);
});

changeImageBtn.addEventListener('click', () => {
    userImageInput.click();
});

// --- UI State Management ---
function setView(view, data) {
    uploadSection.style.display = 'none';
    imagePreviewContainer.style.display = 'none';
    resultSection.style.display = 'none';

    // Clear any existing loaders from the preview
    const existingLoader = imagePreviewContainer.querySelector('.loader');
    if (existingLoader) {
        existingLoader.remove();
    }

    switch(view) {
        case 'upload':
            uploadSection.style.display = 'block';
            break;
        case 'preview':
            imagePreview.src = data;
            imagePreviewContainer.style.display = 'block';
            break;
        case 'loading':
            imagePreview.src = data;
            imagePreviewContainer.style.display = 'block';
            const loader = document.createElement('div');
            loader.className = 'loader';
            loader.style.position = 'absolute';
            loader.style.top = '50%';
            loader.style.left = '50%';
            loader.style.transform = 'translate(-50%, -50%)';
            loader.style.backgroundColor = 'rgba(255,255,255,0.7)';
            loader.style.padding = '10px';
            loader.style.borderRadius = '50%';
            imagePreviewContainer.appendChild(loader);
            break;
        case 'result':
            resultSection.innerHTML = `<h4>Your Fitting Room Result</h4><img src="${data}" alt="Try-On Result">`;
            resultSection.style.display = 'block';
            break;
        case 'error':
            resultSection.innerHTML = `<p style="color: red; padding: 20px;">Error: ${data}</p>`;
            resultSection.style.display = 'block';
            break;
    }
}

// --- Communication with Content Script ---
chrome.runtime.onMessage.addListener(async (message) => {
    
    if (!document.hidden) {
        if (message.type === 'VTON_START') {
            const { userImageBase64 } = await chrome.storage.local.get('userImageBase64');
            setView('loading', userImageBase64 || '');
        } else if (message.type === 'VTON_RESULT') {
            if (message.success) {
                await saveToHistory(message.resultImageBase64);
                setView('result', message.resultImageBase64);
            } else {
                setView('error', message.error);
            }
        }
    }
});

// --- History Management ---
async function saveToHistory(newImageBase64) {
    const { vtonHistory = [] } = await chrome.storage.local.get('vtonHistory');
    vtonHistory.unshift(newImageBase64);
    const trimmedHistory = vtonHistory.slice(0, MAX_HISTORY_ITEMS);
    await chrome.storage.local.set({ vtonHistory: trimmedHistory });
    renderHistory(trimmedHistory);
}

async function loadAndRenderHistory() {
    const { vtonHistory = [] } = await chrome.storage.local.get('vtonHistory');
    renderHistory(vtonHistory);
}

function renderHistory(history) {
    if (!historyScroll) return; // Defensive check
    historyScroll.innerHTML = ''; 
    if (history.length === 0) {
        historyScroll.appendChild(historyPlaceholder);
    } else {
        history.forEach((imageBase64, index) => {
            const itemContainer = document.createElement('div');
            itemContainer.className = 'history-item';

            const img = document.createElement('img');
            img.src = imageBase64;
            img.onclick = () => setView('result', imageBase64);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-history-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.onclick = (event) => {
                event.stopPropagation();
                deleteFromHistory(index);
            };

            itemContainer.appendChild(img);
            itemContainer.appendChild(deleteBtn);
            historyScroll.appendChild(itemContainer);
        });
    }
}

async function deleteFromHistory(indexToDelete) {
    const { vtonHistory = [] } = await chrome.storage.local.get('vtonHistory');
    vtonHistory.splice(indexToDelete, 1);
    await chrome.storage.local.set({ vtonHistory });
    renderHistory(vtonHistory);
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    const { userImageBase64 } = await chrome.storage.local.get('userImageBase64');
    if (userImageBase64) {
        setView('preview', userImageBase64);
    } else {
        setView('upload');
    }
    loadAndRenderHistory();
});