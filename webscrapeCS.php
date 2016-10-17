<?php 
// webscrapeCS.php
// Name: Casey Williams-Smith
// Desc: Prints a truncated version of the CSE course list's HTML
//
// Will save it into a file, so the file need only be scrapped once
// Will produce an empty, or small (< 1000 bytes) file on failure

$FILE_NAME = "courselisthtml.txt";  // Name of save file
$found_file = file_exists($FILE_NAME);
if ($found_file) {  // File already exists
    if(filesize($FILE_NAME) < 1000) {  // Failure to create file
    } else {  // Already have file, do nothing
        exit;
    }
}
$COURSE_WEBPAGE = "https://www.cs.washington.edu/education/courses";
$pagehtml = file_get_contents($COURSE_WEBPAGE);  // Get CS webpage
if ($pagehtml === false) {  // Something went wrong
    file_put_contents($FILE_NAME, "");  // Make file empty and exit
    exit;
}
// Truncate the HTML
$UGRAD_BEGIN = "Undergraduate Courses</h3>";  // Beginning of course listing
$UGRAD_END = "<h3>";  // End of course listing
$PATTERN = "#" . $UGRAD_BEGIN . "[\s\S]*?" . $UGRAD_END . "#";
$match_success = preg_match($PATTERN, $pagehtml, $match);
if (!$match_success) {  // Make sure we get a match
    file_put_contents($FILE_NAME, $PATTERN . " FAILED");
    exit;  // On regex failure, return pattern and exit.
}
$pagehtml = $match[0];
$bytes_written = file_put_contents($FILE_NAME, $pagehtml);
if ($bytes_written < 1000) {
    file_put_contents($FILE_NAME, "COULD NOT WRITE TRUNCATED HTML TO FILE");
}
?>