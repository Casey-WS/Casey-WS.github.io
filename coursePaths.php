<?php
	$pageHTML = file_get_contents('https://www.cs.washington.edu/students/ugrad/pathways#embedded');
	preg_match('#<h3>Databases<\/h3>[\s\S]*INFO 343, 344<\/li>\s<\/ul>[\s\S]*?<\/p>#', $pageHTML, $path_html);
	

	preg_match_all('#<h3>[\s\S]*?back to list#', $path_html[0], $paths);
	$paths_object = array();
	foreach($paths[0] as $path) {
		preg_match('#(?<=>)[a-zA-Z].*(?=<\/h3>)#', $path, $name);
		$paths_object[$name[0]] = array();
		$paths_object[$name[0]]['name'] = $name[0];
		preg_match('#(?<=<\/h3>)[\s\S]*?(<ul>\s<li>B[\s\S]*courses:<\/p>|(?=<ul>))#', $path, $desc_html);
		$paths_object[$name[0]]['desc_html'] = $path;
	}
	header("Content-type: application/json");
	print_r(json_encode($paths_object));
?>