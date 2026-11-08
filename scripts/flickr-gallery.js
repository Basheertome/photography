/* Flickr's returned URLs carry the correct per-size secrets; do not invent large-image URLs. */
(function () {
  function attr(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.clickFlickrPhotoMarkup = function (photo, index) {
    var sizes = ['z', 'c', 'l', 'h', 'k', '3k', '4k', '5k', '6k', 'o'].map(function (key) {
      return {
        key: key,
        url: photo['url_' + key],
        width: Number(photo['width_' + key] || (key === 'o' && photo.o_width)),
        height: Number(photo['height_' + key] || (key === 'o' && photo.o_height))
      };
    }).filter(function (size) { return size.url && size.width > 0 && size.height > 0; });
    var processed = sizes.filter(function (size) { return size.key !== 'o'; });
    var reference = processed[processed.length - 1] || sizes[sizes.length - 1];
    if (!reference) return '';

    // Originals may be unrotated. Never mix differently oriented files into one srcset.
    var ratio = reference.width / reference.height;
    sizes = sizes.filter(function (size) { return Math.abs(size.width / size.height / ratio - 1) < 0.01; });
    sizes.sort(function (a, b) { return a.width - b.width; });
    var unique = [];
    sizes.forEach(function (size) {
      if (!unique.length || unique[unique.length - 1].width !== size.width) unique.push(size);
    });
    var largest = unique[unique.length - 1];
    var fitWidth = Math.max.apply(null, sizes.filter(function (size) { return size.key !== 'o'; }).map(function (size) { return size.width; }).concat([0])) || largest.width;
    var thumbnail = sizes.find(function (size) { return size.key === 'c'; }) || sizes[0];
    var srcset = unique.map(function (size) { return size.url + ' ' + size.width + 'w'; }).join(', ');
    var flickr = 'https://www.flickr.com/photos/basheertome/' + encodeURIComponent(photo.id);
    var vertical = ratio > 1.8 || ratio < 1.3;
    return '<td title="' + attr(photo.title) + '"' + (vertical ? ' class="vertical"' : '') + '>' +
      '<a href="' + attr(photo.url_o || largest.url) + '" data-pswp-src="' + attr(largest.url) +
      '" data-pswp-srcset="' + attr(srcset) + '" data-pswp-width="' + largest.width +
      '" data-pswp-height="' + largest.height + '" data-pswp-fit-width="' + fitWidth + '" data-photo-id="' + attr(photo.id) +
      '" data-flickr-page="' + attr(flickr) + '" data-title="' + attr(photo.title) + '">' +
      '<img src="' + attr(thumbnail.url) + '" width="' + thumbnail.width + '" height="' + thumbnail.height +
      '" loading="' + (index < 6 ? 'eager' : 'lazy') + '" decoding="async" alt="' + attr(photo.title) +
      '" id="' + attr(photo.id) + '" /></a></td>';
  };
})();
