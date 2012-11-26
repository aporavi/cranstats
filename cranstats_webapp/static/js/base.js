var cmi,
	down,
	osys,
	arch,
	rscv,
	pkgv,
	nrow,
	package_name,
	error,
	dt_init,
	html,
	total=0,
	previousPoint;

Date.prototype.addDays2 = function(days) {
	var dat = new Date(this.valueOf())
	dat.setDate(dat.getDate() + days);
	return dat;
}

function getDates(startDate, stopDate) {
	var dateArray = new Array();
	var currentDate = startDate;
	while (currentDate <= stopDate) {
		dateArray.push( new Date (currentDate) )
		currentDate = currentDate.addDays2(1);
	}
	return dateArray;
}


function sortArray(a, b) {
	"use strict";
	return a[0] > b[0] ? 1 : -1;
}

function frequency(data) {
	"use strict";
	var freq = {};

	$.each(data, function (key, val) {
		var s;
		for (s in val) {
			if (!freq.hasOwnProperty(s)) { freq[s] = {}; }
			if (!freq[s].hasOwnProperty(data[key][s])) { freq[s][data[key][s]] = 0; }
			freq[s][data[key][s]] = freq[s][data[key][s]] + 1;
		}
	});

	return freq;
}

function showTooltip(x, y, contents) {
	$('<div id="tooltip">' + contents + '</div>').css( {
		position: 'absolute',
		display: 'none',
		top: y - 35,
		left: x + 5,
		border: '1px solid #fdd',
		padding: '2px',
		'background-color': '#fee',
		opacity: 0.80
	}).appendTo("body").fadeIn(200);
}

function plot(prep, type, elem) {
	"use strict";
	var mainplot,
		overview;
	if (type === "time") {
		mainplot = $.plot($(elem), prep, {"selection": {"mode": "x"}, "xaxis": {"mode": "time", "timeformat": "%b %d, %y"}, "yaxis": {"autoscaleMargin": 1, "min": 0}, series: { lines: { show: true }, points: { show: false } }, grid: { hoverable: true, clickable: false }});
        overview = $.plot($("#overview"), prep, {"series": {"lines": {"lineWidth": 0.5, "fill": true, "show": true}, "shadowSize": 0}, "selection": {"mode": "x"}, "xaxis": {"ticks": [], "mode": "time"}, "yaxis": {"ticks": [], "autoscaleMargin": 0.1, "min": 0}});

		$("#time-series").bind("plotselected", function (event, ranges) {
			mainplot = $.plot($(elem), prep,
				$.extend(true, {}, {"selection": {"mode": "x"}, "xaxis": {"mode": "time",  "timeformat": "%b %d"}, "yaxis": {"autoscaleMargin": 1, "min": 0}, series: { lines: { show: true }, points: { show: false } }, grid: { hoverable: true, clickable: false }}, {
					xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to }
				}));

			overview.setSelection(ranges, true);
		});

		$("#overview").bind("plotselected", function (event, ranges) {
			mainplot.setSelection(ranges);
		});
		
		$("#time-series").bind("plothover", function (event, pos, item) {
			$("#x").text(pos.x.toFixed(2));
			$("#y").text(pos.y.toFixed(2));
		
				if (item) {
					if (previousPoint != item.datapoint[0]) {
						previousPoint = item.datapoint[0];
						$("#tooltip").remove();
						var x = item.datapoint[0].toFixed(2), y = item.datapoint[1].toFixed(2);
						showTooltip(item.pageX, item.pageY, y);
					}
				}
				else {
					$("#tooltip").remove();
					previousPoint = null;            
				}
		
		});

		return null;
	}

    $.plot($(elem), prep, {"legend": {"position": "nw", "noColumns": 3}, "xaxis": {"show": false}, grid: { hoverable: true, clickable: false }});
		$(elem).bind("plothover", function (event, pos, item) {
			$("#x").text(pos.x.toFixed(2));
			$("#y").text(pos.y.toFixed(2));
		
				if (item) {
					if (previousPoint != item.datapoint[0]) {
						previousPoint = item.datapoint[0];
						$("#tooltip").remove();
						var x = item.datapoint[0].toFixed(2), y = item.datapoint[1].toFixed(2);
						showTooltip(item.pageX, item.pageY, y);
					}
				}
				else {
					$("#tooltip").remove();
					previousPoint = null;            
				}
		
		});
    return null;
}

function prepare(pretty, type) {
	"use strict";
	if (type === "time") {
		return [{"data": pretty}];
	}

	var bars = [];
	$.each(pretty, function (index, value) {
		bars.push({"bars": {"barWidth": 1.0, "show": true}, "data": [[index, value[0]]], "label": value[1] + " (" + value[0] + ")"});
	});

	return bars;
}

function prettify(freq) {
	"use strict";
	var prep = {},
		date_min,
		date_max,
		date_array,
		prep_array,
		filter_array,
		dates;
	
	dates = $("#rangeA").val().split(" - ");
	date_min = Date.parse(dates[0], "MM/dd/yyyy");
	date_max = Date.parse(dates[1], "MM/dd/yyyy");
	
	prep_array = [];
	filter_array = []
	
	$.each(freq, function (category, container) {
		prep[category] = [];
		$.each(container, function (key, frequency) {
			if (category === 0) {
				prep_array.push(Date.parse(key, "MM/dd/yyyy").getTime());
				prep[category].push([Date.parse(key, "MM/dd/yyyy"), frequency]);
				total = total + frequency;
			} else {
				prep[category].push([frequency, key]);
			}
		});

		if (category === 0) {
			date_array = getDates(new Date(Math.min.apply(Math,prep_array)),new Date(Math.max.apply(Math,prep_array)));
			$.each(date_array, function (index, date) {
				if ($.inArray(date.getTime(), prep_array) < 0) {
					prep[category].push([date.getTime(), 0]);
				} else {
					filter_array.push(date.getTime());
				}
			});
		}
		
		prep[category].sort(sortArray);
	});

	return prep;
}

$().ready(function () {
	"use strict";
    $("#rangeA").daterangepicker({buttonForDatePicker: $("#calendar"), onClose:request});
    $("#rangeA").val(jQuery.datepicker.formatDate('m/d/yy',Date.parse('today-30'))+" - "+jQuery.datepicker.formatDate('m/d/yy',Date.parse('today')))
	cmi = $("#nav1");
	$(cmi).toggleClass("active");
	package_name = $("#package").val();
	dt_init = 0;

	request();
});

$(".analyticsNav").click(function () {
	"use strict";
	$(cmi).toggleClass("active");
	$(this).toggleClass("active");

	cmi = this;
});

$("#calendar").click(function () {
	"use strict";
	$(".ui-daterangepicker").show();
});

function display(elem) {
	"use strict";
	if (error == 0) {
		$(".graphs").hide();
		$(elem).fadeIn();
	
		switch (elem) {
		case "#ts_container":
			plot(down, "time", "#time-series");
			break;
	
		case "#rversion_container":
			plot(rscv, "bar", "#r-version");
			break;
	
		case "#version_container":
			plot(pkgv, "bar", "#package-version");
			break;
	
		case "#arch_container":
			plot(arch, "bar", "#architecture");
			break;
	
		case "#os_container":
			plot(osys, "bar", "#operating-system");
			break;
	
		default:
			if (dt_init == 0) {
				dt_init = 1;
				$("tbody").html(html);
				$('#rawData').dataTable( {
					"sDom": "<'row'<'span'T><'span6 rightSearch'f>>t<'row'<'span4'i><'span rightPage'p>><'row'<'span'l>>",
					"sPaginationType": "bootstrap",
					"oTableTools": {
						"sSwfPath": "/static/swf/copy_csv_xls_pdf.swf"
					}
				} );
			}
			break;
		}
	} else {
		$("#error_container").fadeOut().fadeIn();
	}
}