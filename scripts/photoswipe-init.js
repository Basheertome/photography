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
  const span = slide.dynamicCaption?.element?.querySelector('.pswp-exif');
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

/** Warm EXIF while the thumb grid is visible so captions are ready when the lightbox opens. */
function prefetchExifForGallery(root) {
  const ids = [
    ...new Set(
      [...root.querySelectorAll('td a[data-photo-id]')]
        .map((a) => a.getAttribute('data-photo-id'))
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return;
  const concurrency = Math.min(12, ids.length);
  let next = 0;
  function worker() {
    return (async function drain() {
      while (next < ids.length) {
        const id = ids[next++];
        await ensureExifFormatted(id);
      }
    })();
  }
  void Promise.all(Array.from({ length: concurrency }, worker));
}

/**
 * PhotoSwipe sizes the <img> from slide width/height (Flickr o_dims). If that box ≠ intrinsic pixels, the bitmap
 * stretches. Cached slides skip load() / loadComplete on revisit, so we also reconcile on every `change` when the
 * image is already complete (fixes fast swiping and missed loadComplete).
 */
function syncSlideDimensionsFromLoadedImage(slide, content) {
  const el = content?.element;
  if (!el || el.tagName !== 'IMG' || !content.isImageContent() || content.isError() || content.isLoading()) {
    return;
  }

  const nw = el.naturalWidth;
  const nh = el.naturalHeight;
  if (!nw || !nh || !el.complete) {
    return;
  }

  const sw = Math.round(slide.width);
  const sh = Math.round(slide.height);
  if (sw !== nw || sh !== nh) {
    const data = slide.data;
    data.width = data.w = nw;
    data.height = data.h = nh;
    content.width = nw;
    content.height = nh;
    slide.width = nw;
    slide.height = nh;

    slide.calculateSize();
    slide.zoomAndPanToInitial();
    slide.applyCurrentZoomPan();
    slide.updateContentSize(true);
  }
}

function scheduleReconcileIntrinsicSize(pswp) {
  requestAnimationFrame(() => {
    const slide = pswp.currSlide;
    if (!slide?.content) return;
    syncSlideDimensionsFromLoadedImage(slide, slide.content);
  });
}

const galleryEl = document.getElementById('photos');
if (galleryEl) {
  exifGalleryRoot = galleryEl;
  prefetchExifForGallery(galleryEl);

  const lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl,
    children: 'td a',
    /** Use the visible <img> rect for zoom-from-thumb (do not set data-cropped unless thumbs are true object-fit: cover crops). */
    thumbSelector: 'img',
    pswpModule: () => import('./photoswipe/photoswipe.esm.js'),
    /**
     * Do not open until EXIF for every grid photo is on the anchors (`data-exif-caption`), so caption HTML is
     * complete when the dynamic-caption plugin first renders (no empty span then patch). Shares work with prefetch.
     */
    openPromise() {
      const anchors = [...galleryEl.querySelectorAll('td a[data-photo-id]')];
      const ids = [
        ...new Set(
          anchors
            .map((a) => a.getAttribute('data-photo-id'))
            .filter(Boolean),
        ),
      ];
      if (!ids.length) return Promise.resolve();
      return Promise.all(ids.map((id) => ensureExifFormatted(id)));
    },
    // https://photoswipe.com/opening-or-closing-transition/
    showHideAnimationType: 'zoom',
    // Default is 4000px — wider images disable the zoom transition entirely.
    maxWidthToAnimate: 16000,
    // https://photoswipe.com/options/ — default 2000ms delays the spinner unreasonably.
    preloaderDelay: 0,
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

  /**
   * PhotoSwipe needs numeric width/height for zoom/bounds/caption. Use data-pswp-* (Flickr o_dims).
   * Do not use the grid thumbnail's natural size: thumbs are often _c (800px), which caps the overlay at 800px
   * wide even when href loads the original. If dims are missing, use a neutral placeholder; loadComplete fixes
   * layout from the loaded file's intrinsic pixels.
   */
  lightbox.addFilter('domItemData', (itemData, element, linkEl) => {
    if (!linkEl) return itemData;

    let w =
      parseInt(linkEl.getAttribute('data-pswp-width') || '', 10) ||
      Number(itemData.width) ||
      Number(itemData.w) ||
      0;
    let h =
      parseInt(linkEl.getAttribute('data-pswp-height') || '', 10) ||
      Number(itemData.height) ||
      Number(itemData.h) ||
      0;

    if (!w || !h) {
      w = 3000;
      h = 2000;
    }

    itemData.width = itemData.w = w;
    itemData.height = itemData.h = h;
    return itemData;
  });

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
        '</a><span class="pswp-exif">' +
        exifSafe +
        '</span></div>'
      );
    },
  });

  lightbox.on('afterInit', () => {
    const { pswp } = lightbox;
    if (!pswp) return;

    let req = 0;

    const applyExif = () => {
      const slide = pswp.currSlide;
      const anchor = slide?.data?.element;
      const capEl = slide?.dynamicCaption?.element;
      const exifEl = capEl?.querySelector('.pswp-exif');
      if (!anchor || !exifEl) return;

      const photoId = anchor.getAttribute('data-photo-id');
      const id = ++req;
      if (!photoId) return;

      if (exifFormattedById.has(photoId)) {
        exifEl.textContent = exifFormattedById.get(photoId);
        return;
      }

      ensureExifFormatted(photoId).then((text) => {
        if (id !== req) return;
        exifEl.textContent = text;
      });
    };

    pswp.on('change', applyExif);
    pswp.on('openingAnimationEnd', applyExif);

    pswp.on('loadComplete', (e) => {
      const { slide, content } = e;
      if (!slide || !content || content.isError()) return;
      syncSlideDimensionsFromLoadedImage(slide, content);
    });

    pswp.on('change', () => scheduleReconcileIntrinsicSize(pswp));

    pswp.on('openingAnimationEnd', () => scheduleReconcileIntrinsicSize(pswp));
  });

  lightbox.init();
}
