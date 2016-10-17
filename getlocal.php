<?php
# getlocal.php
# Casey Williams-Smith
# A test program for building a course map make
# Takes a single parameter "name", which must be the name
# of a file in this program's directory, and of JSON format.
# Prints the JSON

# User did not give file, return nothing.
if (!isset($_GET['name'])) {
    print('');
    exit;
}

// Incorrect file
$file_name = $_GET['name'] . '.json';
if (!file_exists($file_name)) {
    print('');
    exit;
}

$response_text = file_get_contents($file_name);
$response_json = json_decode($response_text);
// JSON is invalid, print a message that will be 
//  marginally more helpful and exit out
if ($response_json === NULL) {
    print('');
    exit;
}

// It's all good, return the JSON.
header("Content-type: application/json");
print($response_text);
?>