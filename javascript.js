/* javascript.js
 * Name: Casey Williams-Smith
 * Desc: Behavior for the course web main page, excluding that
 *  of the course web itself.
*/ 

var QUERY_URL = "getlocal.php?name=courselist";

window.onload = function() {
	// HTML element is also commented out, for brevity
	// document.getElementById('closeButton').onclick = function () {
	// 	document.querySelector('.obscuringBackground').classList.add('hidden');
	// }

	MODULE.graph(function() {
		var CYTO = MODULE.element();
		var refresh = document.createElement('span');
	}, QUERY_URL);
};