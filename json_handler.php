<?php
	# json_handler.php
	# Casey Williams-Smith
	# Desc: Handles requests for saving/loading cytoscape json files fromthe server
	# 	Can be passed a POST request with a query 'json' containing the json string
	#    into a file. Will return an error if the json is too large
	#	 Otherwise response text is 'saved' on success, or 'file already exists' if so.

	# Can be passed a 'download' query in a GET request, and will return the cytoscape json
	#  if it's on the server, or the response text 'no file' if so. 

	$FILE_NAME = 'cytoscapeJson.json';

	if (isset($_POST['json'])) {
		if (strlen($_POST['json']) > 1000000) {  // 1 MB max
			header('HTTP/1.1 413 Payload Too Large', true, 413);
			exit;
		} else {
			if (!file_exists($FILE_NAME)) {
				$str_json = stripslashes($_POST['json']);
				file_put_contents($FILE_NAME, substr($str_json, 1, strlen($str_json) - 2));
				print('saved');
				exit;
			} else {
				print('file already exists');
				exit;
			}
		}
	} else if (isset($_GET['download'])) {
		if (file_exists($FILE_NAME)) {
			header('HTTP/1.1 200 Success', true, 200);
			header('Content-type: application/json');
			print(file_get_contents($FILE_NAME));
			exit;
		} else {
			header('HTTP/1.1 200 Success', true, 200);
			print("no file");
			exit;
		}
	} else {
		header('HTTP/1.1 404 Success', true, 404);
		exit;
	}
?>