import PhotoSwipeLightbox from './photoswipe/photoswipe-lightbox.esm.js';
import PhotoSwipeDynamicCaption from './photoswipe/photoswipe-dynamic-caption-plugin.esm.js';

const FLICKR_API_KEY = '9741a22f899708369501d59bfaa1b26a';

/**
 * Inset on every side → usable pan area is (1 - 2×INSET) of each axis (85% at 0.075).
 * PhotoSwipe fits the image inside that box at the correct aspect ratio (width/height below).
 */
const INSET = 0.075;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatExif(data) {
  if (!data || data.stat !== 'ok' || !data.photo) return '';
  const exif = data.photo.exif;
  if (!exif || !exif.length) return '';
  let p_lens;
  for (let i = 0; i < exif.length; i++) {
    const item = exif[i];
    if (item.tag === 'Lens' || item.tag === 'LensModel') {
      p_lens = item.raw._content;
    }
  }
  const cam = String(data.photo.camera || '').replace(' EOS', '');
  if (p_lens === undefined) return cam;
  return cam + ' + ' + p_lens;
}

function fetchExif(photoId) {
  const url =
    'https://api.flickr.com/services/rest/?format=json&method=flickr.photos.getExif' +
    '&api_key=' +
    FLICKR_API_KEY +
    '&format=json&nojsoncallback=1&photo_id=' +
    encodeURIComponent(photoId);
  return fetch(url).then((r) => r.json());
}

/** Formatted EXIF strings keyed by Flickr photo id (shared with viewer). */
const exifFormattedById = new Map();
const exifInflight = new Map();

/** Set when a gallery exists; used to mirror EXIF onto `<a data-photo-id>` for sync captions. */
let exifGalleryRoot = null;

function patchCurrSlideExifIfMatch(photoId, text) {
  const inst = typeof window !== 'undefined' ? window.pswp : null;
  const slide = inst?.currSlide;
  if (!slide) return;
  const anchor = slide.data?.element;
  if (!anchor || anchor.getAttribute('data-photo-id') !== String(photoId)) return;
  const span = slide.dynamicCaption?.element?.querySelector('.pswp-exif-text');
  if (span) span.textContent = text;
}

function syncExifToGalleryAnchor(photoId, text) {
  if (!exifGalleryRoot || !photoId) return;
  const a = exifGalleryRoot.querySelector(`a[data-photo-id="${photoId}"]`);
  if (a) a.setAttribute('data-exif-caption', text);
  patchCurrSlideExifIfMatch(photoId, text);
}

function ensureExifFormatted(photoId) {
  if (!photoId) return Promise.resolve('');
  if (exifFormattedById.has(photoId)) return Promise.resolve(exifFormattedById.get(photoId));
  let p = exifInflight.get(photoId);
  if (!p) {
    p = fetchExif(photoId)
      .then((data) => {
        const t = formatExif(data);
        exifFormattedById.set(photoId, t);
        syncExifToGalleryAnchor(photoId, t);
        return t;
      })
      .catch(() => {
        exifFormattedById.set(photoId, '');
        syncExifToGalleryAnchor(photoId, '');
        return '';
      })
      .finally(() => {
        exifInflight.delete(photoId);
      });
    exifInflight.set(photoId, p);
  }
  return p;
}

const galleryEl = document.getElementById('photos');
if (galleryEl) {
  exifGalleryRoot = galleryEl;
  // Fetch only the photo the visitor is approaching; camera metadata never blocks opening.
  const warmExif = (event) => {
    const anchor = event.target.closest('a[data-photo-id]');
    if (anchor && galleryEl.contains(anchor)) void ensureExifFormatted(anchor.dataset.photoId);
  };
  galleryEl.addEventListener('pointerover', warmExif);
  galleryEl.addEventListener('focusin', warmExif);

  const zoomedContent = new WeakSet();
  const lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl,
    children: 'td a',
    /** Use the visible <img> rect for zoom-from-thumb (do not set data-cropped unless thumbs are true object-fit: cover crops). */
    thumbSelector: 'img',
    pswpModule: () => import('./photoswipe/photoswipe.esm.js'),
    // https://photoswipe.com/opening-or-closing-transition/
    showHideAnimationType: 'zoom',
    // Default is 4000px — wider images disable the zoom transition entirely.
    maxWidthToAnimate: 16000,
    // https://photoswipe.com/options/ — default 2000ms delays the spinner unreasonably.
    preloaderDelay: 0,
    preload: [1, 1],
    paddingFn: (viewportSize) => {
      const x = viewportSize.x;
      const y = viewportSize.y;
      return {
        top: Math.round(y * INSET),
        bottom: Math.round(y * INSET),
        left: Math.round(x * INSET),
        right: Math.round(x * INSET),
      };
    },
  });

  // Fit view uses Flickr's display renditions; zooming unlocks the full original.
  // PhotoSwipe/browser still account for devicePixelRatio within this ceiling.
  lightbox.addFilter('srcsetSizesWidth', (width, content) => {
    if (zoomedContent.has(content)) return width;
    const fitWidth = Number(content.data.element?.dataset.pswpFitWidth);
    return fitWidth > 0 ? Math.min(width, Math.floor(fitWidth / (window.devicePixelRatio || 1))) : width;
  });

  // Dimensions describe the largest srcset candidate and remain stable when a smaller
  // rendition is selected. Replacing them with naturalWidth would break zoom and captions.
  // Positions caption below the image and sizes the pan area (official plugin).
  // https://github.com/dimsemenov/photoswipe-dynamic-caption-plugin
  new PhotoSwipeDynamicCaption(lightbox, {
    type: 'below',
    mobileLayoutBreakpoint: () => false,
    verticallyCenterImage: true,
    captionContent: (slide) => {
      const el = slide.data?.element;
      if (!el) return '';
      const title = el.getAttribute('data-title') || '';
      const flickr = el.getAttribute('data-flickr-page') || '#';
      const safe = escapeHtml(title);
      const photoId = el.getAttribute('data-photo-id') || '';
      let exifRaw = '';
      if (el.hasAttribute('data-exif-caption')) {
        exifRaw = el.getAttribute('data-exif-caption') ?? '';
      } else if (photoId && exifFormattedById.has(photoId)) {
        exifRaw = exifFormattedById.get(photoId);
      }
      const exifSafe = escapeHtml(exifRaw);
      return (
        '<div class="click-pswp-caption"><a href="' +
        flickr.replace(/"/g, '&quot;') +
        '" target="_blank" rel="noopener">' +
        safe +
        '</a><span class="pswp-exif"><span class="pswp-exif-text">' +
        exifSafe +
        '</span></span></div>'
      );
    },
  });

  lightbox.on('afterInit', () => {
    const pswp = lightbox.pswp;
    if (!pswp) return;
    let frame = 0;
    let needsRelayout = false;
    let isRelayout = false;
    let request = 0;
    const observers = new Map();
    const captionHeights = new WeakMap();

    function scheduleLayout(relayout = false) {
      needsRelayout ||= relayout;
      if (!frame) frame = requestAnimationFrame(updateLayout);
    }

    function updateLayout() {
      frame = 0;
      const slide = pswp.currSlide;
      const caption = slide?.dynamicCaption?.element;
      if (!slide || !caption || !pswp.opener.isOpen) return;
      if (needsRelayout && slide.currZoomLevel <= slide.zoomLevels.initial + 0.001) {
        needsRelayout = false;
        // Let the caption plugin reserve room again after fonts/EXIF change its height.
        isRelayout = true;
        slide.calculateSize();
        slide.zoomAndPanToInitial();
        slide.applyCurrentZoomPan();
        slide.updateContentSize(true);
        isRelayout = false;
      }
      const holder = slide.holderElement.getBoundingClientRect();
      const image = slide.content?.element;
      const rect = image?.tagName === 'IMG' && image.isConnected
        ? image.getBoundingClientRect()
        : null;
      const width = rect?.width || slide.width * slide.currZoomLevel;
      const height = rect?.height || slide.height * slide.currZoomLevel;
      const left = rect ? rect.left - holder.left : slide.pan.x;
      const top = rect ? rect.top - holder.top : slide.pan.y;
      // Use the displayed image, including its current pan, rather than stale initial bounds.
      caption.style.left = left + 'px';
      caption.style.top = (top + height) + 'px';
      caption.style.width = width + 'px';
      caption.style.transform = 'none';
      // Native hover tooltips are needed only when the visible text is clipped.
      caption.querySelectorAll('.click-pswp-caption > a, .pswp-exif-text').forEach((item) => {
        if (item.scrollWidth > item.clientWidth) item.title = item.textContent;
        else item.removeAttribute('title');
      });
      const imageTop = holder.top + top - pswp.element.getBoundingClientRect().top;
      const center = (Math.max(0, imageTop) + Math.min(pswp.viewportSize.y, imageTop + height)) / 2;
      pswp.element.style.setProperty('--click-image-center-y', center + 'px');
    }

    function watchCaption(slide) {
      const caption = slide?.dynamicCaption?.element;
      if (!caption || observers.has(slide)) return;
      const observer = new ResizeObserver(() => {
        const height = caption.getBoundingClientRect().height;
        const changed = Math.abs(height - (captionHeights.get(caption) || 0)) > 0.5;
        captionHeights.set(caption, height);
        if (slide === pswp.currSlide) scheduleLayout(changed);
      });
      observer.observe(caption);
      caption.querySelectorAll('.click-pswp-caption > a, .pswp-exif-text').forEach((item) => observer.observe(item));
      observers.set(slide, observer);
    }

    function applyExif() {
      const slide = pswp.currSlide;
      const anchor = slide?.data?.element;
      const exif = slide?.dynamicCaption?.element?.querySelector('.pswp-exif-text');
      const id = ++request;
      if (!anchor || !exif) return;
      ensureExifFormatted(anchor.dataset.photoId).then((text) => {
        if (id !== request || !exif.isConnected) return;
        exif.textContent = text;
        scheduleLayout(true);
      });
    }

    pswp.on('dynamicCaptionUpdateHTML', ({ slide }) => watchCaption(slide));
    pswp.mainScroll.itemHolders.forEach(({ slide }) => watchCaption(slide));
    pswp.on('change', () => {
      watchCaption(pswp.currSlide);
      applyExif();
      scheduleLayout(true);
    });
    pswp.on('openingAnimationEnd', () => scheduleLayout(true));
    pswp.on('resize', () => scheduleLayout(true));
    pswp.on('beforeZoomTo', ({ destZoomLevel }) => {
      const slide = pswp.currSlide;
      if (destZoomLevel > slide.zoomLevels.initial + 0.001) zoomedContent.add(slide.content);
    });
    pswp.on('zoomPanUpdate', ({ slide }) => {
      if (!isRelayout && pswp.opener.isOpen && slide.currZoomLevel > slide.zoomLevels.initial + 0.001) {
        zoomedContent.add(slide.content);
      }
      scheduleLayout();
    });
    pswp.on('imageSizeChange', () => scheduleLayout());
    pswp.on('loadComplete', () => scheduleLayout());
    pswp.on('slideDestroy', ({ slide }) => {
      observers.get(slide)?.disconnect();
      observers.delete(slide);
    });
    pswp.on('destroy', () => {
      cancelAnimationFrame(frame);
      request++;
      observers.forEach((observer) => observer.disconnect());
      observers.clear();
    });
    applyExif();
    scheduleLayout(true);
  });

  lightbox.init();
}
