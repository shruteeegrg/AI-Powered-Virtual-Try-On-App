// content.js

const CLOTH_DETECTION_API_URL = "http://localhost:8000/detect";
const VIRTUAL_TRY_ON_API_URL = "https://prerestoration-nonresonantly-norberto.ngrok-free.dev/try-on"; 

console.log("ON YOU Extension Active");

async function toBlob(src) {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Failed to fetch image: ${src}`);
    return await response.blob();
}

async function checkImageIsCloth(imageElement) {
    try {
        const imageBlob = await toBlob(imageElement.src);
        const formData = new FormData();
        formData.append('file', imageBlob, 'image.jpg');
        const response = await fetch(CLOTH_DETECTION_API_URL, { method: 'POST', body: formData });
        if (!response.ok) return false;
        const data = await response.json();
        return data.is_clothing;
    } catch (error) {
        return false;
    }
}

function addTryOnButton(imageElement) {
    const parent = imageElement.parentElement;
    if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }

    const button = document.createElement('button');
    button.innerText = 'Try ON YOU';
    button.className = 'onyou-tryon-button';
    parent.appendChild(button);

    button.addEventListener('click', async (event) => {
        event.stopPropagation();
        
        chrome.runtime.sendMessage({ type: 'VTON_START' });

        try {
            const data = await chrome.storage.local.get('userImageBase64');
            if (!data.userImageBase64) {
                throw new Error("Please upload your photo in the ON YOU side panel first!");
            }

            const userImageBlob = await toBlob(data.userImageBase64);
            const clothImageBlob = await toBlob(imageElement.src);
            
            const formData = new FormData();
            formData.append('person_image', userImageBlob, 'person.jpg');
            formData.append('cloth_image', clothImageBlob, 'cloth.jpg');

            const response = await fetch(VIRTUAL_TRY_ON_API_URL, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result.success && result.result_image_base64) {
                chrome.runtime.sendMessage({
                    type: 'VTON_RESULT',
                    success: true,
                    resultImageBase64: result.result_image_base64
                });
            } else {
                throw new Error(result.message || 'API returned an error.');
            }

        } catch (error) {
            console.error("ON YOU Error:", error);
            alert(error.message);
            chrome.runtime.sendMessage({
                type: 'VTON_RESULT',
                success: false,
                error: error.message
            });
        }
    });
}

// Main logic to scan the page for images
const observer = new MutationObserver((mutations) => {
    scanImages();
});

function scanImages() {
    const images = document.querySelectorAll('img:not([data-onyou-checked])');
    images.forEach(async (img) => {
        img.dataset.onyouChecked = 'true';
        if (img.width > 150 && img.height > 150) {
            if (await checkImageIsCloth(img)) {
                addTryOnButton(img);
            }
        }
    });
}

// Initial scan and then observe for new images that load later
window.addEventListener('load', () => {
    scanImages();
    observer.observe(document.body, { childList: true, subtree: true });
});