<?php
/*  classes.php
 *  Name: Casey Williams-Smith
 *  Desc: Uses a CSE courselist html file to parse a
 *   JSON object containing an array of class objects containing information
 *   about each course. First checks that an already created JSON file is
 *   not on the server.
 *
 *  The JSON will be of the following format...
*/
/* Course Objects = 
    {
        . . .,
        "CSE 446" : {
            "title" : "Machine Learning",
            "number" : "CSE 446",
            "link" : "courses.cs.washington.edu/courses/cse446",
            "desc" : "Methods for designing systems that learn from data and improve...",
            "prereqs" : [
                "CSE 332",               #X is a prereq
                ["STAT 390", "STAT 391", ...],  #Either X or Y or Z...
                ...
            ],
            "concurrent" : "",
            . . .
        },
        "CSE 002b" : {
            . . . . . . . .
        },
        .
        .
        .
    }
    The ordering any objects/arrays is undefined
*/
// Check if we already have the JSON
$JSON_FILENAME = 'courselist.json';
$json_already = file_exists($JSON_FILENAME);
if ($json_already) {  // JSON file already exists
    header('Content-type: application/json');
    $json = file_get_contents($JSON_FILENAME);
    print($json);
}

// No previous JSON, so make one
// Check if we already have the HTML file
$FILE_NAME = "courselisthtml.txt";
$coursehtml_exists = file_exists($FILE_NAME);
if (!$coursehtml_exists) {  // If we do not have the html, generate it
    include("webscrapeCS.php");
}

if (filesize($FILE_NAME) < 1000) {  // Unsuccessful creation of html text file
    exit;
}
$coursehtml = file_get_contents($FILE_NAME);
// Parse coursehtml into JSON, and print
// Pattern necessary to create a list of each course's html, with links/name/desc/etc.
    // Takes a div of class "course-listing", and swallows up everything up to the second
    //  closing div tag, but not including this second closing div tag
$COURSE_LISTING_PATTERN = "#<div class=\"course-listing\">([\\s\\S]*?)" . "(<\\/div>)([\\s]*?)"
                            . "(?=<\\/div>)#";
// Pull out these divs
preg_match_all($COURSE_LISTING_PATTERN, $coursehtml, $matches);
$classes = $matches[0];
// $classes is now an array of strings, where each is the html of a course-listing div
$course_objects = array();  // A list of course objects to be returned as JSON
// Parse each course HTML into the correct format
foreach($classes as $classhtml) {
    $head = get_course_head($classhtml);  // Get course number/title
    $number = get_course_number($head);  // Number
    $title = get_course_title($head);  // Title
    $link = get_course_link($classhtml);  // Link
    $desc = get_course_desc($classhtml);  // Description
    $prereqs = get_course_prereqs($desc);  // Prereqs array
    $course_objects[$number]['number'] = $number;
    $course_objects[$number]['title'] = $title;
    $course_objects[$number]['link'] = $link;
    $course_objects[$number]['desc'] = $desc;  
    $course_objects[$number]['prereqs'] = $prereqs;
}
// Save a file, and print the json
file_put_contents($JSON_FILENAME, json_encode($course_objects));
header("Content-type: application/json");
print_r(json_encode($course_objects));
exit;

# Given a course div, as a string, returns a title of the form
#   "Course Number: Course Title"
# Used to get the Course Number and Title, which are then separated
function get_course_head($course_div) {
    # (?<=>)(?!<).*(?=</a>)  // The pattern
    $COURSE_HEAD_PATTERN = "#(?<=>)(?!<).*(?=<\/a>)#";
    preg_match($COURSE_HEAD_PATTERN, $course_div, $match);
    return $match[0];
}

#Given a course head of the format "Course Number: Course Title",
# returns the course number of the form "ABC 012a"
function get_course_number($course_head) {
    # Pattern will match a valid Department Symbol, followed by 3 numbers,
    #  And and section characters that follow
    #  For example, E E 271, CSE 499sec, etc...
    $COURSE_NUM_PATTERN = "#[A-Z][A-Z\\s]{1,3}[A-Z] \\d\\d\\d[a-z]{0,3}#";
    preg_match($COURSE_NUM_PATTERN, $course_head, $match);
    return $match[0];
}

# Given a course head of the format "Course Number: Course Title",
#  returns a string containing "Course Title"
function get_course_title($course_head) {
    $COURSE_TITLE_PATTERN = "#(?<=: ).*#";
    preg_match($COURSE_TITLE_PATTERN, $course_head, $match);
    return $match[0];
}

# Given a course-lisitng div, returns in a string the link it contains
#  to the CSE course webpage for this class.
#  Of the format "http(s)://courses.cs.washington.edu/courses/cse123/"
#   where "cse123" is the course number for this passed course listing
function get_course_link($course_div) {
    // Pattern simply gets a href attribute from the <a> tag
    $URL_PATTERN = "#(?<=href=\").*?(?=\")#";
    preg_match($URL_PATTERN, $course_div, $match);
    return $match[0];
}

#Given a course div, returns the description. Will include the ending notes like
# prereqs, when the course is offered and recomended information for the class
function get_course_desc($course_div) {
    # Desc follows a closing span tag, and some spaces. So start the match (with \K)
    #  after those spaces, at the first non space character. Then take everything up
    #  to the first closing div tag.
    $COURSE_DESC_PATTERN = '#</span>\s*?\K\S[\s\S]*?(?=</div>)#';
    preg_match_all($COURSE_DESC_PATTERN, $course_div, $match);
    return $match[0][0];
}

#Given a course's description paragraph, returns a prereqs array of the format;
#   prereqs_array = [
#       "CSE 311",
#       "MATH 126",
#       ["E E 215", "E E 205"],
#       . . .
#   ]
function get_course_prereqs($course_desc) {
    $prereqs = array();
    # Get everything after the word "Prerequisite: "
    $PREREQ_PATTERN = "#(?<=Prerequisite: ).*#";
    preg_match_all($PREREQ_PATTERN, $course_desc, $match);
    $prereq_line = $match[0][0];
    // Next take out the "either...or..."s.
    $EITHEROR_PATTERN = "#either.*?or.*?[\.;]#";
    preg_match_all($EITHEROR_PATTERN, $course_desc, $matches);
    $prereq_line = preg_replace($EITHEROR_PATTERN, "", $prereq_line);
    $COURSE_NUM_PATTERN = "#[A-Z][A-Z\\s]{1,3}[A-Z] \\d\\d\\d[a-z]{0,3}#";
    foreach($matches[0] as $multireq) {
        // Here we have a single string of the format "either...or..."
        //  Where there are course numbers
        preg_match_all($COURSE_NUM_PATTERN, $multireq, $reqs);
        $prereqs[] = $reqs[0];  // Add the list as an array to the prereqs list
    }
    $JUNK_PATTERN = "#offered:.*|recommended:.*#i";
    // Leaving only valid prereqs
    $prereq_line = preg_replace($JUNK_PATTERN, "", $prereq_line);
    preg_match_all($COURSE_NUM_PATTERN, $prereq_line, $requiredClasses);
    foreach($requiredClasses[0] as $reqCourse) {
        $prereqs[] = $reqCourse;
    }
    // Here, there are no longer and either or clauses in the prerequisite line.
    return $prereqs;
}
?>