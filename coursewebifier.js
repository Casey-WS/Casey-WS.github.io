// coursewebifier.js
// Casey Williams-Smith
//  Using cytoscape.js, Returns an object with a graph(fn) function, which will create
//   a graph on the element with id 'web', and then once finished, run fn.
//   Object also has var 'graphObj' which can access the cytoscape graph.
//   { "CSE 999" : {
//          'number': 'CSE 999', 'title': 'some title',
//            'desc': 'some description', 'link': 'some url',
//            'prereqs': ["CSE 998",
//                          ["CSE 899", "CSE 911"],
//                          ["CSE 400", ["CSE 100", "CSE 300"]]
//             ]
// #Meaning the prereqs are CSE 998, AND EITHER 899 OR 911, AND
//                              EITHER 400 OR 100 + 300
//      }
//   }
"use strict";

var MODULE = (function() {

// The name of the php file that will return the course JSON
var QUERY_URL = "";
var CYTO;  // Cytoscape object that enabling graph making
// Color wheel used by graph. (hint, make adjacent colors dissimilar)
//  and make them bright, because darker versions are used
var colors = ['#898CFF', '#FF89B5', '#FFDC89', '#90D4F7', '#71E096', '#F5A26F',
              '#ED6D79', '#CFF381', '#FF96E3', '#BB96FF'];
var GRAPH_LOCKED = false;  // Is the graph blocked from manipulation?
var prereqGroupId = 1;  // Local variable to initialize prereq colors with
var graphObject = {};  // Object to be returned;


// Display an error message centered on the object pane
//  Page shouod go no futher at this point.
function displayErrorPane(el) {
    var pane = document.createElement("div");
    pane.innerHTML = "This content failed to load!</br> Try reloading the page";  // Message to display
    pane.classList.add("error");  // Give style
    pane.style.zIndex = 9999;  // Make sure it's infront of other page elements
    el.appendChild(pane); // append
    return;
}

// Shows the loading icon on the object pane
function loading() {
    document.getElementById('loading').style.display = 'inline-block';
    return;
}

// Hides the loading icon on the object pane
function done() {
    document.getElementById('loading').style.display = 'none';
    return;
}

// Opens the saved graph JSON on the server, then calls fn
function openSavedGraph(fn) {
    var file_handler = 'json_handler.php?download=true';  // We want the serverside file
    var ajax = new XMLHttpRequest();
    ajax.onload = fn;
    ajax.open("GET", file_handler, true);
    ajax.send();
    return;
}

// Creates cytoscape graph on element#web, using the JSON from courselistJsonQuery,
//  will save the finished graph into JSON.
function createGraph(courselistJsonQuery) {
    CYTO = cytoscape( cytoscapeInit() );  // Initialize CYTO with options
    processJSON(courselistJsonQuery, function() {  // Get the course JSON and onload, run function
        if (this.responseText.length == "") {
            // This shouldn't happen
            displayErrorPane(document.querySelector("body"));
            return;
        }

        var courseData = JSON.parse(this.responseText);
        populateWeb(courseData, CYTO);  // Decode JSON, draw cytoscape nodes/edges
        var singleNodes = getZeroDegreeNodes();
        var connectedNodes = CYTO.elements().diff(singleNodes).left;
        var layout = cytoscapeGetLayout();  // Prepare the layout
        var gridLayout = getGridLayout();
        // Need to organize each graph (connected/singletons) and then save
        // After the first graph has its layout applied, apply the other
        layout.stop = function() {
            singleNodes.layout(gridLayout);
            return;
        };
        // After the second layout, hide singletons, adjust view, and save
        gridLayout.stop = function() {
            singleNodes.addClass('hidden');
            CYTO.fit(connectedNodes, 10);
            saveGraph(CYTO);
            augmentGraph();
            done();
            fn();
            return;
        }
        connectedNodes.layout( layout );  // Run layout
        bindEvents(courseData);  // Assign interactivity with course data
        return;
    });
    return;
}

// Gets course JSON from address (local or otherwise) JSONquery.
//  Then calls fn when it loads and runs fn on responseText
function processJSON(JSONquery, fn) {
    var ajax = new XMLHttpRequest();
    // Set the function to be run, which will have access to this.responseText
    ajax.onload = fn;
    // It is a get request, to address, and async is true. 
    ajax.open("GET", JSONquery, true);
    ajax.send();
    return;
}


// Takes course JSON and graphs it onto graph using cytoscape
function populateWeb(classesObj) {
    // Make a node for each key
    for (var course in classesObj) {  // Each key 'course' is a string that has course number
        CYTO.add({
            group: "nodes",
            data: {
                id: classesObj[course]["number"],
            },
        });
    }
    // Go back over courselist and add prereqs nodes with appropriate edges
    for (var course in classesObj) { 
        // For each course, look at the prereqs.
        var reqs = classesObj[course]['prereqs'];
        // Departmental courses store the colors that their prereqs use for thier edges.
        classesObj[course].prereqColors = {};
        for(var i = 0; i < reqs.length; i++) {
            // For each requirement, check if we need to make new nodes,
            //  do so if necessary, then create edges.
            if (!Array.isArray(reqs[i])) {
                addPrereq(reqs[i], course, '', 'nondeptPrereq');
            } else { // In this case we have and EITHER ... OR ... prereq group
                var currColor = colors.pop();
                colors.unshift(currColor);
                shadeColor(currColor, -20);
                for (var j = 0; j < reqs[i].length; j++) {
                    // Go through each prereq, if it's a class, add a dashed prereq line
                    //  if it's an array, go through and add more dotted lines
                    if (!Array.isArray(reqs[i][j])) {
                        classesObj[course].prereqColors[reqs[i][j]] = currColor;  // Save color for this edge in JSON
                        addPrereq(reqs[i][j], course, currColor, 'nondeptPrereq', 'prereqoption', true);
                        currColor = shadeColor(currColor, -20);
                    } else {  // Could be a list. This is another set of EITHER OR prereqs
                        for (var k = 0; k < reqs[i][j].length; k++) {
                            classesObj[course].prereqColors[reqs[i][j][k]] = currColor;   // Save color for this edge in JSON
                            addPrereq(reqs[i][j][k], course, currColor, 'nondeptPrereq', 'prereqoption', true);
                        }
                        currColor = shadeColor(currColor, -20);
                    }
                }
                prereqGroupId++;
            }
        }
    }
    return;
}

// Adds an edge between prereq and course on the graph with edgeClasses. If prereq is not graphed,
//  it will be graphed, with the passed nodeClasses.
function addPrereq(prereq, course, edgeColor, nodeClasses, edgeClasses, hasPrereqGroup) {
    if (CYTO.getElementById(prereq).size() != 0) {
    // This element already exists, no need to make a node
    } else {
        // Make the node because it doesn't exist
        CYTO.add({
            group: 'nodes',
            data: {
                id: prereq,
            },
            classes: nodeClasses
        });
    }
    if (hasPrereqGroup) {
        // Now add the edge
        CYTO.add({
            group: 'edges',
            data: {
                id: prereq + '-' + course,  // e.g. MATH 124-MATH 125
                source: prereq,
                target: course,
                prereqGroup: prereqGroupId,  // Data so edges react in groups
                edgeColor : edgeColor  /// Save for serialization
            },
            style: { 'line-color': edgeColor },
            classes: edgeClasses
        });
    } else {
        CYTO.add({
            group: 'edges',
            data: {
                id: prereq + '-' + course,  // e.g. MATH 124-MATH 125
                source: prereq,
                target: course,
                edgeColor : edgeColor  /// Save for serialization
            },
            style: { 'line-color': edgeColor },
            classes: edgeClasses
        });
    }
    return;
}

// Returns a string of HTML with prereqs inside spans with colors.
//  The colors are chosen from the global array, and are saved into each course object in
//  the classesObj passed, so it can be accessed later by the matching edges.
function getPrereqHTML(prereq, course, classesObj) {
    if (!Array.isArray(prereq)) {
        var responseHTML = '<span style="background-color:#BBBBBB">' + prereq + '</span> '; 
    } else {  // Otherwise we have a list corresponding to an EITHER...OR... choice
        var responseHTML = '';
        for (var i = 0; i < prereq.length; i++) {
            if (!Array.isArray(prereq[i])) {
                //var currColor = classesObj[course].prereqColors[prereq[i]];
                var currColor = CYTO.$('[id="' + prereq[i] + '-' + course + '"]').data().edgeColor;
                responseHTML += '<span style="background-color:' + currColor + '">' + prereq[i] + '</span> ';
            } else {
                var multipleClassReq = '';
                for(var j = 0; j < prereq[i].length; j++) {
                    //var currColor = classesObj[course].prereqColors[prereq[i][j]];
                    var currColor = CYTO.$('[id="' + prereq[i][j]+ '-' + course + '"]').data().edgeColor;
                    multipleClassReq += '<span style="background-color:' + currColor + '">' + prereq[i][j] + '</span> ';
                }
                multipleClassReq = multipleClassReq.replace(/>\s</g, "> and <");
                responseHTML += multipleClassReq;
            }
        }
        responseHTML = responseHTML.replace(/>\s</g, "> or <");
    }
    return responseHTML;
}

// Remove all nodes in the graph that have no edges.
//  This allows for easier drawing of the connected graph
//  Cytoscape keeps track of these nodes, so they can be drawn later
// Returns: A collection of the removed nodes
function getZeroDegreeNodes() {
    var nodes = CYTO.nodes();  // Create a collection of ALL nodes
    var connectedNodes = CYTO.edges().connectedNodes();  // All CONNECTED nodes
    // Use diff, and get all nodes in LEFT collection but not in RIGHT
    var disjointVertices = nodes.diff(connectedNodes).left;
    return disjointVertices;
}

// Bind interactive events to graph with course data 'courseJSON'
// Must be run after graph is populated to ensure graph json is accessible
// Will only operate on nodes that are present on the cytoscape graph at the moment of calling
function bindEvents(classesObj) {
    for (var course in classesObj) {  // Set events to access course data on courses
        // Open course link on click
        CYTO.getElementById(classesObj[course]["number"]).on("click", function(link) {
            return function() {
                window.open(link);
            }
        }(classesObj[course]['link']));  // Make a function
        // Add the tooltip on hover
            // Here we use an Immediately-Invoked Function Expression
            // http://stackoverflow.com/questions/10000083/javascript-event-handler-with-parameters
            // We invoke a function which *returns* our event handler, instead of just
            //  passing it a function expression
            // The function we return is passed variables from this context in the loop, like
            //  course, title, etc. These variables are then used in the construction of the
            //  function returned and bound to the event. These variables are store in the fn
            //  on the heap so to speak, so they are persistent
        CYTO.getElementById(classesObj[course]["number"]).on("mouseover mousemove",
                                 function(desc, number, title, prereqs, course, classesObj) {
            var prereqHTML = '';
            for(var i = 0; i < prereqs.length; i++) {
                prereqHTML += getPrereqHTML(prereqs[i], course, classesObj);
            }  // Create the prereqHTML
            // Instead of looking elements up everytime, do it once and pass them to the fn
            var tooltip = document.getElementById("tooltip");
            var titleEle = tooltip.querySelector(".title");
            var descEle = tooltip.querySelector(".desc");
            var prereqEle = tooltip.querySelector(".prereqsFooter");
            var web = document.getElementById('web');
            // Function we return will save evaluated versions of all variables
            //  that can be called quickly (no need to run that for-loop every time once
            //  we already have the prereqHTML). When the event is triggered, the saved fn
            //  is called, with the values we set here. And a separate fn is made for every
            //  iteration
            return function(e) {
                titleEle.innerHTML = number + ': ' + title;
                descEle.innerHTML = desc;
                tooltip.classList.remove("hidden");
                prereqEle.innerHTML = prereqHTML;
                // Function will also be passed an event object, from which we get the mouse pos
                tooltip.style.left = e.originalEvent.offsetX + 1 + 'px';
                tooltip.style.top = e.originalEvent.offsetY + 1 + 'px';
            }
        }( classesObj[course]['desc'],
           classesObj[course]['number'],
           classesObj[course]['title'],
           classesObj[course]['prereqs'], course, classesObj ));
        // Bind the tooltip close
        CYTO.getElementById(classesObj[course]["number"]).on("mouseout", function () {
            document.getElementById("tooltip").classList.add("hidden");
        });
    }
    // Edges react on hover
    CYTO.elements('edge[!prereqGroup]').on('mouseover', function() {  // Set class on hover
        return function() {
            this.addClass('activeEdge');
        }
    }());
    CYTO.elements('edge[!prereqGroup]').on('mouseout', function() {  // Remove on mouse out
        return function() {
            this.removeClass('activeEdge');
        }
    }());
    // Groups of prereqs react in unison
    var groupedPrereqEdges = CYTO.elements('edge[prereqGroup]'); // edges that need events handled
    for (var i = 0; i < groupedPrereqEdges.length; i++) {  // Put an event on each one
        var myGroupNum = groupedPrereqEdges[i].data().prereqGroup;
        var targetGroup = CYTO.elements('[prereqGroup=' + myGroupNum + ']');
        // Bind the mouseover fn
        groupedPrereqEdges[i].on('mouseover', function(targetGroup) {
            return function() {
                targetGroup.addClass('activeEdge')
            };
        }(targetGroup));

        // Bind the mouseover fn
        groupedPrereqEdges[i].on('mouseout', function(targetGroup) {
            var targetGroup = CYTO.elements('[prereqGroup=' + myGroupNum + ']');
            return function() {
                targetGroup.removeClass('activeEdge');
            };
        }(targetGroup));
    }
    document.getElementById('refresh').onclick = function() {
        CYTO.fit(30);
    }
    bindMenu();
    return;
}

// Set up the menu in the cytoscape window.
function bindMenu() {
    // Menu open/close
    document.getElementById('sideNavButton').addEventListener('click', function() {
        //document.querySelector('.sideNav').style.width = (window.getComputedStyle(
                            //document.querySelector('.sideNav')).width == '0px' ?  '20%' : '0' );
        document.querySelector('.sideNav').classList.toggle('sideNavOpen');
    });
    // Viewing single nodes
    createButton('View Single Nodes', function() {
        var singleNodes = getZeroDegreeNodes();
        var connectedNodes = CYTO.elements().diff(singleNodes).left;
        var singleMode = true;
        return function() {
            if (singleMode) {  // Show single nodes
                singleMode = !singleMode;
                this.innerHTML = 'View Connected Nodes';
                connectedNodes.addClass('hidden');
                singleNodes.removeClass('hidden');
                CYTO.fit(singleNodes, 300);
            } else {  // Restore graph
                singleMode = !singleMode;
                this.innerHTML = 'View Single Nodes';
                connectedNodes.removeClass('hidden');
                singleNodes.addClass('hidden');
                CYTO.fit(connectedNodes, 10);
            }
        }
    }());
    createButton('Color Nodes by crucialness', function() {
        var nodes = CYTO.nodes();
        var isOn = false;
        var heatMap = ['#0403BC', '#0010FC', '#0062FF', '#019EFE', '#01EFFC', '#42FDB9', '#8FFF6F', '#D1FF2A', '#FFDE02', '#FF8B01', '#FE7000', '#FF1E00', '#CD0007'];
        var regNode = getCytoscapeStyle()[0].style;
        regNode.width = 30;
        regNode.height = 30;
        var singleNodes = getZeroDegreeNodes();
        var connectedNodes = CYTO.elements().diff(singleNodes).left;
        return function() {
            if (isOn) {  // default stlye
                isOn = !isOn;
                nodes.style(regNode);
            } else {  // new style, reorganize
                loading();
                isOn = !isOn;
                for(var i = 0; i < nodes.length; i++) {
                    var mag = nodes[i].outgoers().length;
                    if (mag > 12) {
                        mag = 12;
                    }
                    nodes[i].style({
                        'height': 30 + (nodes[i].outgoers().length - 1) * 5,
                        'width': 30 + (nodes[i].outgoers().length - 1) * 5,
                        'background-color': heatMap[mag]
                    });
                }
                var lo = cytoscapeGetLayout();
                lo.stop = done;
                connectedNodes.layout( lo );
            }
        }
    }());
    return;
}

// Creates an option in the menu with 'text', and runs 'fn' when it is clicked
function createButton(text, fn) {
    var button = document.createElement('span');
    button.innerHTML = text;
    button.addEventListener('click', fn);
    document.querySelector('.sideNav').appendChild(button);
    return;
}

// Save this cytoscape object 'graph' into a JSON file on the server
function saveGraph() {
    var file_handler = 'json_handler.php?json=true';  // We are making a request for json
    var ajax = new XMLHttpRequest();
    // Set the function to be run, which will have access to this.responseText
    // It is a get request, to address, and async is true. 
    ajax.open("POST", file_handler, true);
    // We pass a string of the json, so we need this request header
    ajax.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    var jsonString = JSON.stringify(CYTO.json());
    ajax.send('json=' + JSON.stringify(jsonString));
    return
}

// take span#citation inside graph's div and turn it into a watermark
function addCitation() {
    var span = document.getElementById('citation');
    span.addEventListener('mouseover', function() {
        this.innerHTML = 'Made with Cytoscape js';
    });
    span.addEventListener('mouseout', function() {
        this.innerHTML = '?';
    });
    return;
}

// Returns an object literal describing the initial settings for cytoscape,
//  to be passed to cytoscape() in the main loop
// View all core options at http://js.cytoscape.org/#core
function cytoscapeInit() {
    var container = document.getElementById('web');
    var cytoscapeInitObject = {
            container: container,
            elements: [],
            // Use the modularized style for this thing
            style: getCytoscapeStyle(),
            // Comments in javascript can be place in object literals, cool!
            // Layout is an important setting which determines how to nodes are placed
            // See more at http://js.cytoscape.org/#layout
            layout: {},

            // viewport state
            zoom: 1,
            pan: { x : 0, y : 0 },

            // interaction options:
            minZoom: 0.1,  // ZOOM MIN/MAX
            maxZoom: 2,
            zoomingEnabled: true,
            userZoomingEnabled: true,
            panningEnabled: true,
            userPanningEnabled: true,
            boxSelectionEnabled: false,
            selectionType: 'single',
            touchTapThreshold: 8,
            desktopTapThreshold: 4,
            // Settings on whether or not one can move around and grab nodes
            autolock: GRAPH_LOCKED,
            autoungrabify: GRAPH_LOCKED,
            autounselectify: GRAPH_LOCKED,

            // rendering options:
            headless: false,
            styleEnabled: true,
            hideEdgesOnViewport: false,
            hideLabelsOnViewport: false,
            textureOnViewport: false,
            motionBlur: false,
            motionBlurOpacity: 0.2,
            wheelSensitivity: 0.1,
            pixelRatio: 'auto'
        };
    return cytoscapeInitObject;
}

function cytoscapeGetLayout() {
    var options = {
        name: 'cose-bilkent',
        // Called on `layoutready`
        ready: function () {
        },
        // Called on `layoutstop`
        stop: function () {
        },
        // Whether to fit the network view after when done (true)
        fit: true,
        // Padding on fit (10)
        padding: 10,
        // Whether to enable incremental mode (true)
        randomize: true,
        // Node repulsion (non overlapping) multiplier (4500)
        nodeRepulsion: 200000,
        // Ideal edge (non nested) length (10)
        idealEdgeLength: 100,
        // Divisor to compute edge forces (0.25)
        edgeElasticity: 0.25,
        // Nesting factor (multiplier) to compute ideal edge length for nested edges (0.1)
        nestingFactor: 0.1,
        // Gravity force (constant) (0.25)
        gravity: 0,
        // Maximum number of iterations to perform (2500)
        numIter: 100000,
        // For enabling tiling (true)
        tile: false,
        // Type of layout animation. The option set is {'during', 'end', false} ('end')
        animate: 'end',
        // Represents the amount of the vertical space to put between the zero degree members during the tiling operation(can also be a function) (10)
        tilingPaddingVertical: 10,
        // Represents the amount of the horizontal space to put between the zero degree members during the tiling operation(can also be a function) (10)
        tilingPaddingHorizontal: 10,
        // Gravity range (constant) for compounds (1.5)
        gravityRangeCompound: 1.5,
        // Gravity force (constant) for compounds (1.0)
        gravityCompound: 1.0,
        // Gravity range (constant) ()
        gravityRange: 3.8
    };
    return options;
}

// style for elements on the cytoscape graph
function getCytoscapeStyle() {
    var styleObj = [
        {
            selector: 'node',
            style: {
                'label': 'data(id)',
                'font-weight': 'bold',
                'background-color': '#272923'
            }
        },
        {
            selector: "edge",
            style: {
                'curve-style': 'bezier',
                'target-arrow-shape': 'triangle',
                'target-arrow-fill': 'filled',
                'target-arrow-color': '#BBBBBB',
                'width': 5,
                'line-color': '#BBBBBB'
            }
        },
        {
            selector: '.activeEdge',
            style: {
                'width': 9
            }
        },
        {
            selector: '.nondeptPrereq',
            style: {
                'background-color': '#DDDDDD',
                'border-width': 2,
                'border-color': '#D0D0D0'
            }
        },
        {
            selector: '.prereqoption',
            style: {
                'line-style': 'dashed'
            }
        },
        {
            selector: '.hidden',
            style: {
                'visibility': 'hidden'
            }
        }
    ];
    return styleObj;
}

function getGridLayout() {
    return {
        name: 'grid',

        fit: true, // whether to fit the viewport to the graph
        padding: 30, // padding used on fit
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
        avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
        condense: false, // uses all available space on false, uses minimal space on true
        rows: undefined, // force num of rows in the grid
        cols: undefined, // force num of columns in the grid
        position: function( node ){}, // returns { row, col } for element
        sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
        animate: false, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        animationEasing: undefined, // easing of animation if enabled
        ready: undefined, // callback on layoutready
    };
}

// Set the style of the graph without affecting layout.
//  Meant to be used at the end of a layout, to make the nodes more readable
function augmentGraph() {
    CYTO.nodes().style({
        'font-size': 20,
        'width': 40,
        'height': 40
    });
    return;
}

// A function from StackOverflow http://stackoverflow.com/a/13532993
// Pass it a variable with a Hex color, and a percentage (positive or negative)
// and it will return a hex color lightened or darkened by that amount
function shadeColor(color, percent) {

    var R = parseInt(color.substring(1,3),16);
    var G = parseInt(color.substring(3,5),16);
    var B = parseInt(color.substring(5,7),16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  

    var RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    var GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    var BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

    return "#"+RR+GG+BB;
}

// Graphs the course data, and then runs fn.
graphObject.graph = function (fn, query) {
    QUERY_URL = query;
    var graphContainer = document.getElementById("web");
    if (!graphContainer) {  // Could not find container, display message
        console.log("Could not find pane in which to place cytoscape");
        displayErrorPane(document.querySelector("body"));
        done();
        return;
    }
    loading();
    // Open a saved graph, if there isn't one, make one,
    //  otherwise load the old one
    openSavedGraph(function() {
        var json = this.responseText;  // Is there saved JSON?
        if (json == 'no file') {
            // If not, create the graph.
            createGraph(QUERY_URL, fn);  // Create a JSON graph, and save it for the future
            return;
        } else {  // We did get a saved graph, so draw it
            var obj = JSON.parse(this.responseText), i = 0;
            CYTO = cytoscape( cytoscapeInit() );  // Initialize
            CYTO.json( obj );  // Apply saved settings (positions, ids, data...)
            var coloredEdges = CYTO.$('.prereqoption');
            var max = coloredEdges.length;
            for (; i < max; i++) {  // Used the saved color data in the graph JSON to reapply color
                coloredEdges[i].style({ 'line-color': coloredEdges[i].data().edgeColor});
            }
            CYTO.fit(CYTO.edges().connectedNodes(), 10);
            augmentGraph();
            processJSON(QUERY_URL, function() {  // Now get the JSON and restore interactivity
                var courseData = JSON.parse(this.responseText);
                bindEvents(courseData); 
                done();
                fn();
                return;
            });
            return;
        }
    });
    addCitation();
    return;
};

graphObject.element = function() {
    return CYTO;
};

graphObject.addButton = createButton;

return graphObject;

}());
