const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d');

const totalFrames = 600;
const images = new Array(totalFrames).fill(null);

// Scroll tracking
let scrollFraction = 0;
let ticking = false;

// Compute frame path
function getFramePath(index) {
  return `./frame_${index.toString().padStart(5, '0')}.jpg`;
}

// Get currently active frame index based on scroll position
function getCurrentFrameIndex() {
  const idx = Math.floor(scrollFraction * (totalFrames - 1));
  return Math.min(Math.max(idx, 0), totalFrames - 1);
}

// Find closest loaded image to avoid rendering blank frames
function getClosestLoadedImage(index) {
  if (images[index]) return images[index];
  
  let step = 1;
  while (index - step >= 0 || index + step < totalFrames) {
    if (index - step >= 0 && images[index - step]) {
      return images[index - step];
    }
    if (index + step < totalFrames && images[index + step]) {
      return images[index + step];
    }
    step++;
  }
  return null;
}

// Draw frame onto the canvas matching CSS object-fit: cover
function render() {
  const logicalWidth = window.innerWidth;
  const logicalHeight = window.innerHeight;
  
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  
  const frameIndex = getCurrentFrameIndex();
  const img = getClosestLoadedImage(frameIndex);
  
  if (img) {
    const ratio = Math.max(logicalWidth / img.width, logicalHeight / img.height);
    const newWidth = img.width * ratio;
    const newHeight = img.height * ratio;
    const x = (logicalWidth - newWidth) / 2;
    const y = (logicalHeight - newHeight) / 2;
    
    ctx.drawImage(img, x, y, newWidth, newHeight);
  }
}

// Resize canvas respecting devicePixelRatio for super crisp rendering
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  
  // Set transform explicitly to prevent cumulative scaling bugs
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
  render();
}

// Update scroll tracking, canvas opacity and header transitions
function updateScroll() {
  const scrollTop = window.scrollY;
  const vh = window.innerHeight;
  
  // Define animation milestones
  const animationEnd = vh * 7.5; // 750vh
  const transitionEnd = vh * 8.5; // 850vh
  
  if (scrollTop <= animationEnd) {
    // 1. We are scrolling through the frame animation
    scrollFraction = scrollTop / animationEnd;
    canvas.style.opacity = '1';
    canvas.style.display = 'block';
  } else if (scrollTop > animationEnd && scrollTop < transitionEnd) {
    // 2. We are in the fade out transition region
    scrollFraction = 1.0; // Pin to final frame
    
    const progress = (scrollTop - animationEnd) / (transitionEnd - animationEnd);
    canvas.style.opacity = (1 - progress).toString();
    canvas.style.display = 'block';
  } else {
    // 3. Animation ended, canvas hidden
    scrollFraction = 1.0;
    canvas.style.opacity = '0';
    canvas.style.display = 'none';
  }
  
  // Toggle Header visibility when reaching website contents
  const header = document.querySelector('.main-header');
  if (header) {
    if (scrollTop > animationEnd) {
      header.classList.add('visible');
    } else {
      header.classList.remove('visible');
    }
  }
}

// Throttled scroll listener
window.addEventListener('scroll', () => {
  updateScroll();
  
  if (!ticking) {
    requestAnimationFrame(() => {
      render();
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

window.addEventListener('resize', resizeCanvas);

// Progressive Image Preloading Strategy
function startPreloading() {
  const firstImg = new Image();
  firstImg.src = getFramePath(0);
  firstImg.onload = () => {
    images[0] = firstImg;
    
    // Initialize scroll calculation immediately on load
    updateScroll();
    
    resizeCanvas(); // Initialize sizing and draw first frame
    
    // Start preloading remaining frames progressively
    queuePreloading();
  };
}

function queuePreloading() {
  const priorityIndices = [];
  const step = 15;
  
  for (let i = 0; i < totalFrames; i += step) {
    if (i !== 0) {
      priorityIndices.push(i);
    }
  }
  
  for (let i = 0; i < totalFrames; i++) {
    if (i % step !== 0) {
      priorityIndices.push(i);
    }
  }
  
  let queueIndex = 0;
  const concurrency = 12;
  
  function loadNext() {
    if (queueIndex >= priorityIndices.length) return;
    const frameIdx = priorityIndices[queueIndex++];
    
    const img = new Image();
    img.src = getFramePath(frameIdx);
    img.onload = () => {
      images[frameIdx] = img;
      
      if (frameIdx === getCurrentFrameIndex()) {
        if (!ticking) {
          requestAnimationFrame(() => {
            render();
            ticking = false;
          });
          ticking = true;
        }
      }
      loadNext();
    };
    img.onerror = () => {
      loadNext();
    };
  }
  
  for (let i = 0; i < concurrency; i++) {
    loadNext();
  }
}

// Scroll reveal micro-animations using IntersectionObserver
function setupScrollReveal() {
  const bottomMargin = window.innerWidth <= 480 ? '-40px' : '-100px';
  const observerOptions = {
    root: null,
    rootMargin: `0px 0px ${bottomMargin} 0px`,
    threshold: 0.1
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        // Unobserve once animated for performance
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  animatedElements.forEach(el => observer.observe(el));
}

// Start execution
startPreloading();
document.addEventListener('DOMContentLoaded', setupScrollReveal);
// Also setup scroll reveal if DOMContentLoaded already fired
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  setupScrollReveal();
}
