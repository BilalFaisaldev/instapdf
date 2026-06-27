// Initialize jsPDF
const { jsPDF } = window.jspdf;

// App State
let filesList = [];
let theme = 'dark';
let draggedItemIndex = null;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const thumbnailGrid = document.getElementById('thumbnailGrid');
const emptyState = document.getElementById('emptyState');
const pageCount = document.getElementById('pageCount');
const btnGenerate = document.getElementById('btnGenerate');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const loaderOverlay = document.getElementById('loaderOverlay');
const loaderText = document.getElementById('loaderText');
const progressBar = document.getElementById('progressBar');

// Options Elements
const pdfNameInput = document.getElementById('pdfName');
const pageSizeSelect = document.getElementById('pageSize');
const pageMarginsInput = document.getElementById('pageMargins');
const pdfQualitySelect = document.getElementById('pdfQuality');
const orientationControl = document.getElementById('orientationControl');
const radioCards = document.querySelectorAll('.radio-card');

// Load theme on startup
if (localStorage.getItem('theme')) {
  theme = localStorage.getItem('theme');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon();
}

// ----------------------------------------------------
// Theme Toggle Events
// ----------------------------------------------------
themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeIcon();
});

function updateThemeIcon() {
  if (theme === 'dark') {
    themeIcon.className = 'fa-solid fa-sun';
  } else {
    themeIcon.className = 'fa-solid fa-moon';
  }
}

// ----------------------------------------------------
// Radio Button UI Logic (Orientation)
// ----------------------------------------------------
radioCards.forEach(card => {
  card.addEventListener('click', () => {
    radioCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const radioInput = card.querySelector('input');
    radioInput.checked = true;
  });
});

pageSizeSelect.addEventListener('change', () => {
  if (pageSizeSelect.value === 'auto') {
    orientationControl.style.display = 'none';
  } else {
    orientationControl.style.display = 'block';
  }
});

// ----------------------------------------------------
// Drag & Drop / Upload File Events
// ----------------------------------------------------
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    handleFiles(e.dataTransfer.files);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFiles(e.target.files);
  }
});

// Process files
async function handleFiles(files) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  // Show loader while loading files
  showLoader("Importing Images...", 0);
  
  const filesArray = Array.from(files).filter(file => allowedTypes.includes(file.type));
  
  if (filesArray.length === 0) {
    hideLoader();
    alert("Please upload valid images (JPG, PNG, WebP) only.");
    return;
  }

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    try {
      const base64Data = await readFileAsBase64(file);
      const dimensions = await getImageDimensions(base64Data);
      
      filesList.push({
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        base64: base64Data,
        rotation: 0, // In degrees (0, 90, 180, 270)
        width: dimensions.width,
        height: dimensions.height
      });
      
      // Update progress bar
      const progress = Math.round(((i + 1) / filesArray.length) * 100);
      showLoader("Importing Images...", progress);
    } catch (err) {
      console.error("Error loading file: ", file.name, err);
    }
  }

  // Clear file input so same files can be re-uploaded
  fileInput.value = '';
  
  hideLoader();
  updateUI();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = base64;
  });
}

// ----------------------------------------------------
// UI Render Methods
// ----------------------------------------------------
function updateUI() {
  if (filesList.length === 0) {
    emptyState.style.display = 'flex';
    thumbnailGrid.style.display = 'none';
    btnGenerate.disabled = true;
    pageCount.textContent = '0 Pages Added';
  } else {
    emptyState.style.display = 'none';
    thumbnailGrid.style.display = 'grid';
    btnGenerate.disabled = false;
    pageCount.textContent = `${filesList.length} Page${filesList.length > 1 ? 's' : ''} Added`;
    renderThumbnails();
  }
}

function renderThumbnails() {
  thumbnailGrid.innerHTML = '';
  
  filesList.forEach((item, index) => {
    const card = document.createElement('li');
    card.className = 'thumbnail-card';
    card.draggable = true;
    card.dataset.index = index;

    // Build internal content
    card.innerHTML = `
      <div class="image-preview-wrapper">
        <img src="${item.base64}" class="image-preview" id="preview-${item.id}" style="transform: rotate(${item.rotation}deg)">
        <div class="card-actions">
          <button class="action-btn" title="Rotate Clockwise" onclick="rotateCard(${index})">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
          <button class="action-btn btn-delete" title="Delete Page" onclick="deleteCard(${index})">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
      <div class="card-footer">
        <span class="card-number">Page ${index + 1}</span>
        <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
      </div>
    `;

    // ----------------------------------------------------
    // HTML5 Drag and Drop Reordering Handlers
    // ----------------------------------------------------
    card.addEventListener('dragstart', (e) => {
      draggedItemIndex = index;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.thumbnail-card').forEach(c => {
        c.style.border = '';
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (index !== draggedItemIndex) {
        card.style.border = '2px dashed var(--accent-primary)';
      }
    });

    card.addEventListener('dragleave', () => {
      card.style.border = '';
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.style.border = '';
      if (draggedItemIndex !== null && draggedItemIndex !== index) {
        // Move element in array
        const draggedItem = filesList.splice(draggedItemIndex, 1)[0];
        filesList.splice(index, 0, draggedItem);
        draggedItemIndex = null;
        updateUI();
      }
    });

    thumbnailGrid.appendChild(card);
  });
}

// ----------------------------------------------------
// Card Manipulation Actions
// ----------------------------------------------------
window.rotateCard = function(index) {
  // Rotate 90 deg clockwise
  filesList[index].rotation = (filesList[index].rotation + 90) % 360;
  
  // Update rotation in DOM immediately with animation
  const previewImg = document.getElementById(`preview-${filesList[index].id}`);
  if (previewImg) {
    previewImg.style.transform = `rotate(${filesList[index].rotation}deg)`;
  }
};

window.deleteCard = function(index) {
  filesList.splice(index, 1);
  updateUI();
};

// ----------------------------------------------------
// Loader Overlay Helpers
// ----------------------------------------------------
function showLoader(text, percentage = 0) {
  loaderOverlay.classList.add('active');
  loaderText.textContent = text;
  progressBar.style.width = `${percentage}%`;
}

function hideLoader() {
  loaderOverlay.classList.remove('active');
}

// ----------------------------------------------------
// Canvas-based Rotated Image Prep (Avoids native jsPDF bugs)
// ----------------------------------------------------
function getProcessedImage(item, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rotation = item.rotation;

      // Swap dimensions if rotated 90 or 270 deg
      const is90or270 = rotation === 90 || rotation === 270;
      canvas.width = is90or270 ? img.naturalHeight : img.naturalWidth;
      canvas.height = is90or270 ? img.naturalWidth : img.naturalHeight;

      // Draw rotated image onto canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      // Return processed canvas image
      resolve({
        base64: canvas.toDataURL('image/jpeg', quality),
        width: canvas.width,
        height: canvas.height
      });
    };
    img.src = item.base64;
  });
}

// ----------------------------------------------------
// PDF Compile Engine
// ----------------------------------------------------
btnGenerate.addEventListener('click', async () => {
  if (filesList.length === 0) return;

  const pdfName = pdfNameInput.value.trim() || 'InstaPDF_Document';
  const pageSize = pageSizeSelect.value;
  const margin = parseFloat(pageMarginsInput.value) || 0;
  const quality = parseFloat(pdfQualitySelect.value) || 0.8;
  const orientation = document.querySelector('input[name="orientation"]:checked').value;

  showLoader("Generating PDF...", 10);

  try {
    let pdf = null;
    
    // Page dimensions constants in Points (pt)
    // 1 mm = 2.83465 pt
    const ptPerMm = 2.83465;
    const marginPt = margin * ptPerMm;

    for (let i = 0; i < filesList.length; i++) {
      const item = filesList[i];
      
      // Update progress
      const progress = Math.round(10 + ((i / filesList.length) * 80));
      showLoader(`Processing Page ${i + 1} of ${filesList.length}...`, progress);

      // Rotate and compress image via canvas
      const processedImage = await getProcessedImage(item, quality);

      let finalPageWidth, finalPageHeight;
      let imgDrawWidth, imgDrawHeight;
      let finalOrientation = orientation;

      // Calculate sizes
      if (pageSize === 'auto') {
        // Auto-sizing: Fit page exactly to processed image size + margins
        finalPageWidth = processedImage.width + (marginPt * 2);
        finalPageHeight = processedImage.height + (marginPt * 2);
        imgDrawWidth = processedImage.width;
        imgDrawHeight = processedImage.height;
        finalOrientation = processedImage.width > processedImage.height ? 'landscape' : 'portrait';
      } else {
        // Preset Page Size: A4 or Letter
        // A4: 595.28 x 841.89 pt
        // Letter: 612 x 792 pt
        let baseWidth = pageSize === 'a4' ? 595.28 : 612;
        let baseHeight = pageSize === 'a4' ? 841.89 : 792;

        if (orientation === 'landscape') {
          // Swap width & height for landscape
          const temp = baseWidth;
          baseWidth = baseHeight;
          baseHeight = temp;
        }

        finalPageWidth = baseWidth;
        finalPageHeight = baseHeight;

        // Calculate maximum width and height we can draw inside margins
        const maxDrawWidth = finalPageWidth - (marginPt * 2);
        const maxDrawHeight = finalPageHeight - (marginPt * 2);

        // Aspect ratio calculations to scale image proportionally (fit inside margin)
        const imageRatio = processedImage.width / processedImage.height;
        const pageRatio = maxDrawWidth / maxDrawHeight;

        if (imageRatio > pageRatio) {
          // Image is wider than page ratio
          imgDrawWidth = maxDrawWidth;
          imgDrawHeight = maxDrawWidth / imageRatio;
        } else {
          // Image is taller than page ratio
          imgDrawHeight = maxDrawHeight;
          imgDrawWidth = maxDrawHeight * imageRatio;
        }
      }

      // Initialize the PDF document on the first page
      if (i === 0) {
        pdf = new jsPDF({
          orientation: finalOrientation,
          unit: 'pt',
          format: pageSize === 'auto' ? [finalPageWidth, finalPageHeight] : pageSize
        });
      } else {
        // Add new page to existing PDF
        pdf.addPage(
          pageSize === 'auto' ? [finalPageWidth, finalPageHeight] : pageSize,
          finalOrientation
        );
      }

      // Center the image within the page (inside margins)
      const xOffset = marginPt + (finalPageWidth - (marginPt * 2) - imgDrawWidth) / 2;
      const yOffset = marginPt + (finalPageHeight - (marginPt * 2) - imgDrawHeight) / 2;

      // Add image to PDF page
      // jsPDF accepts 'JPEG' for any base64 image data URL exported as JPEG
      pdf.addImage(
        processedImage.base64, 
        'JPEG', 
        xOffset, 
        yOffset, 
        imgDrawWidth, 
        imgDrawHeight,
        undefined,
        'FAST'
      );
    }

    // Save/Download PDF
    showLoader("Saving PDF...", 95);
    pdf.save(`${pdfName}.pdf`);
    
    // Success feedback
    setTimeout(() => {
      showLoader("Download Started!", 100);
      setTimeout(hideLoader, 1500);
    }, 500);

  } catch (err) {
    console.error("PDF Compilation Failed:", err);
    hideLoader();
    alert("Failed to generate PDF. Check console logs for details.");
  }
});
