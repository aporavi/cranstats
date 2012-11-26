function request() {
	"use strict";
	var dates,
		freq,
		clean,
		data;

	$(".graphs").hide();
	$("#results").hide();
	$("#loading_container").fadeIn();
	var opts = {
	  lines: 13, // The number of lines to draw
	  length: 10, // The length of each line
	  width: 20, // The line thickness
	  radius: 10, // The radius of the inner circle
	  rotate: 0, // The rotation offset
	  color: '#000', // #rgb or #rrggbb
	  speed: 1, // Rounds per second
	  trail: 10, // Afterglow percentage
	  shadow: false, // Whether to render a shadow
	  hwaccel: true, // Whether to use hardware acceleration
	  className: 'spinner', // The CSS class to assign to the spinner
	  zIndex: 2e9, // The z-index (defaults to 2000000000)
	  top: 'auto', // Top position relative to parent in px
	  left: 'auto' // Left position relative to parent in px
	};
	var target = document.getElementById('loader');
	var spinner = new Spinner(opts).spin(target);

	dates = $("#rangeA").val().split(" - ");
	$.getJSON("/geto", {ds: dates[0], de: dates[1]}, function (data) {
		if (data.length > 5) {

			error = 0;
						
			//freq = frequency(data);
			clean = prettify(data);
			
			down = prepare(clean[0], "time");
			rscv = prepare(clean[1], "bar");
			arch = prepare(clean[2], "bar");
			osys = prepare(clean[3], "bar");

			$(".graphs").hide();
			$("#ts_container").fadeIn();
			plot(down, "time", "#time-series");
			$(cmi).toggleClass("active");
			cmi = $("#nav1");
			$(cmi).toggleClass("active");
			$("#results").html(total+" Downloads Between "+$("#rangeA").val())
			$("#results").fadeIn();

		} else {
			error = 1;
			$(".graphs").hide();
			$(cmi).toggleClass("active");
			cmi = $("#nav1");
			$(cmi).toggleClass("active");
			$("#results").hide();
			$("#error_container").fadeIn();
		}
		
		$("#loading_container").fadeOut();
		spinner.stop();
	});
}