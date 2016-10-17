# README #

This is a website that helps navigate the UW CSE Course List (https://www.cs.washington.edu/education/courses) so you can plan what courses to take in your time in the department! Lays out the courses in a directed graph, and has options to view paths through the department.

### Where to use ###

* You can download the files yourself, and put it on a webserver, OR
* You can use it on students.washington.edu/caseyws where it's currently held

### Dependencies ###

This website uses two 3rd party packages.

* Cytoscape.js, an extremely well made graph module which is used to make the interactive graphs
* cytoscape-cose-bilkent.js, another 3rd party module which provides a resource-intensive, yet highly accurate algorithm for placing a graph so there is minimal crossing edges.

### Left to do ###

* Add an option to select course paths, and then change the graph to view those paths.
* * Add the expandable menu item
* * Add the menu on left
* * Make the Course Paths JSON
* * Make the paths viewable on graph
* Finalize the viewing of single nodes and connected nodes so they are easy to interact with, in a portable way (take in to account size of window, menu)
* Add a side bar, intro message and content below to aid in using the course web
* Review and revise documentation on coursewebifier.js
* Possibly refactor PHP files?