$(document).ready(function(){	
	$('#photos').scroll(function(event) { 
      $("#scroll").fadeOut();
    });
    $('#photos').on('click', '#scroll', function() {
    	$('#photos').animate({scrollLeft: "+=200"});
    	$('#scroll').fadeOut();
    })

    $('#photos').on('click', 'td a', function(event){
		if ($(window).width() > 640) {
		      event.preventDefault();
		      b_url = $(this).children().attr('src').slice(0,-5) + 'b.jpg';
		      p_title = $(this).children().attr('alt');
		      $('.preview .info #title').html(p_title).attr('href', 'http://www.flickr.com/photos/basheeriphone/' + $(this).children().attr('id'));
		      $('.preview span > a img').attr({'src' : b_url, 'id' : $(this).children().attr('id'), 'style' : 'max-height: ' + $(window).height()*.75 + 'px'});
		      $('.preview span > a').attr('href', $('.preview .info #title').attr('href'));
		      $('.preview').css('display', 'table');
		      $('.preview').animate({opacity: 1}, 150);
		}
	});	
	
	$('#fullscreen').click(function(event) {
		clearTimeout(i);
		fullScreen();
	});
	$(document).bind('keydown', 'f', function(event) {
		fullScreen();
	});
	var i = null;
	$('.preview').mousemove(function(event) {
	    clearTimeout(i);
	    $('.preview .toolbar, .preview .previous, .preview .next').fadeIn(350);
		if ($('#fullscreen img').attr('alt') == 'small') {
	    	i = setTimeout('$(\'.preview .toolbar, .preview .previous, .preview .next\').fadeOut(350);', 1000);
		}
	}).mouseleave(function(event) {
		clearTimeout(i);
		if ($('#fullscreen img').attr('alt') == 'small') {
	    	$('.preview .toolbar, .preview .previous, .preview .next').fadeOut(350);
		}
	});

	$('#close, .close').click(function(event) {
		closePreview();
	});
	$(document).bind('keydown', 'esc', function(event){
		closePreview();
	});
	
	$('.preview .next a').click(function(event) {
		clearTimeout(i);
		event.preventDefault();
		nextImage();
	});
	$(document).bind('keydown', 'right', function(event){
		event.preventDefault();
		nextImage();
	});
	
	$('.preview .previous a').click(function(event) {
		clearTimeout(i);
		event.preventDefault();
		previousImage();
	});
	$(document).bind('keydown', 'left', function(event){
		event.preventDefault();
		previousImage();
	});
});

function nextImage() {
	n_photo = $('#photos td[title="' + $(".preview .info #title").text() + '"]').next().children().children();
	nn_photo = $('#photos td[title="' + $(".preview .info #title").text() + '"]').next().next().children().children();
	if ($('#fullscreen img').attr('alt') == 'small') {
		if (nn_photo.attr('src')) {
			$('.preview').css('background-image', 'url("' + n_photo.attr('src').slice(0,-5) + 'b.jpg")\, ' + $('.preview').css('background-image').split(', ',1) + '\, url("' + nn_photo.attr('src').slice(0,-5) + 'b.jpg")');
		} else {
			$('.preview').css('background-image', 'url("' + n_photo.attr('src').slice(0,-5) + 'b.jpg")\, ' + $('.preview').css('background-image').split(', ',1));
		}
	}
	if ($(window).width() > 640) {
	      b_url = n_photo.attr('src').slice(0,-5) + 'b.jpg';
	      p_title = n_photo.attr('alt');
	      $('.preview .info #title').html(p_title).attr('href', 'http://www.flickr.com/photos/basheeriphone/' + n_photo.attr('id'));
	      $('.preview span > a img').attr({'src' : b_url, 'style' : 'max-height: ' + $(window).height()*.75 + 'px'});
	      $('.preview span > a').attr('href', $('.preview .info #title').attr('href'));
	      $('.preview').css('display', 'table');
	      $('.preview').animate({opacity: 1}, 150);
	}
}

function previousImage() {
	p_photo = $('#photos td[title="' + $(".preview .info #title").text() + '"]').prev().children().children();
	pp_photo = $('#photos td[title="' + $(".preview .info #title").text() + '"]').prev().prev().children().children();
	if ($('#fullscreen img').attr('alt') == 'small') {
		if (pp_photo.attr('src')) {
			$('.preview').css('background-image', 'url("' + p_photo.attr('src').slice(0,-5) + 'b.jpg")\, ' + $('.preview').css('background-image').split(', ',1) + '\, url("' + pp_photo.attr('src').slice(0,-5) + 'b.jpg")');
		} else {
			$('.preview').css('background-image', 'url("' + p_photo.attr('src').slice(0,-5) + 'b.jpg")\, ' + $('.preview').css('background-image').split(', ',1));
		}
	}
	if ($(window).width() > 640) {
	      b_url = p_photo.attr('src').slice(0,-5) + 'b.jpg';
	      p_title = p_photo.attr('alt');
	      $('.preview .info #title').html(p_title).attr('href', 'http://www.flickr.com/photos/basheeriphone/' + p_photo.attr('id'));
	      $('.preview span > a img').attr({'src' : b_url, 'style' : 'max-height: ' + $(window).height()*.75 + 'px'});
	      $('.preview span > a').attr('href', $('.preview .info #title').attr('href'));
	      $('.preview').css('display', 'table');
	      $('.preview').animate({opacity: 1}, 150);
	}
}

function closePreview() {
	$('body').css('overflow', 'auto');
	$('.preview').css({'display' : 'none', 'opacity' : '0'});
	$('.preview span span, .preview .close').fadeIn(0);
	$('#fullscreen img').attr({'src' : '../images/fullscreen.png', 'alt' : 'full'});
	$('.preview').css('background-image', '');
}

function fullScreen() {
	$('body').css('overflow', 'hidden');
	if ($('#fullscreen img').attr('alt') == 'full') {
		$('.preview').css('background-image', 'url("' + $('.preview span span img').attr('src') + '")');
		$('#fullscreen img').attr({'src' : '../images/smallscreen.png', 'alt' : 'small'});
		$('.preview span span, .preview .close').fadeOut(150);
		var docElm = document.documentElement;
		if (docElm.requestFullscreen) {
		    docElm.requestFullscreen();
		}
		else if (docElm.mozRequestFullScreen) {
		    docElm.mozRequestFullScreen();
		}
		else if (docElm.webkitRequestFullScreen) {
		    docElm.webkitRequestFullScreen();
		}
	}
	else {
		$('.preview span span, .preview .close').fadeIn(150);
		$('#fullscreen img').attr({'src' : '../images/fullscreen.png', 'alt' : 'full'});
		$('.preview').css('background-image', '');
		if (document.exitFullscreen) {
		    document.exitFullscreen();
		}
		else if (document.mozCancelFullScreen) {
		    document.mozCancelFullScreen();
		}
		else if (document.webkitCancelFullScreen) {
		    document.webkitCancelFullScreen();
		}
	}
}

(function(a, b, c) {
	if (c in b && b[c]) {
		var d, e = a.location,
			f = /^(a|html)$/i;
		a.addEventListener("click", function(a) {
			d = a.target;
			while (!f.test(d.nodeName)) d = d.parentNode;
			"href" in d && (d.href.indexOf("http") || ~d.href.indexOf(e.host)) && (a.preventDefault(), e.href = d.href)
		}, !1)
	}
})(document, window.navigator, "standalone")