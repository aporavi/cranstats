$(document).ready(function () {
	"use strict";
    
	$('#rawData').dataTable( {
		"sDom": "<'row'<'span4'i><'rightSearch'f>>t<'row'<'span3'l><'span5 rightPage2'p>>",
		"sPaginationType": "bootstrap",
		"oLanguage": {
			"sLengthMenu": "_MENU_ records per page"
		}
	} );
});