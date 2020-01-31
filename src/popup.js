/**
 * the popup is the content for the extension action (button placed in the location bar by the desktop agent extension)
 * the popup provides the following functionality:
 * -  a channel picker that allows the end user to set the color channel for the tab
 * - a search input that enables the end user to search and launch items from the app directory
 */

import "./components/channel-picker";
import utils from "./utils.js";
import autoComplete from "./components/autoComplete";

new autoComplete({
    data: {                              // Data src [Array, Function, Async] | (REQUIRED)
      src: async () => {
        // API key token
     //   const token = "this_is_the_API_token_number";
        // User search query
        const query = document.querySelector("#autoComplete").value;
        // Fetch External Data Source
        const source = await fetch(`${utils.directoryUrl}/apps/search?text=${query}`);
        // Format data into JSON
        const data = await source.json();
        // Return Fetched data
        return data;
      },
    //  key: ["name"],
      cache: false
    },
   
    placeHolder: "fdc3...",     // Place Holder text                 | (Optional)
    selector: "#autoComplete",           // Input field selector              | (Optional)
    threshold: 3,                        // Min. Chars length to start Engine | (Optional)
    debounce: 300,                       // Post duration for engine to start | (Optional)
    searchEngine: "loose",              // Search Engine type/mode           | (Optional)
    resultsList: {                       // Rendered results list object      | (Optional)
        render: true,
        container: source => {
            source.setAttribute("id", "result_list");
        },
        destination: document.querySelector("#autoComplete"),
        position: "afterend",
        element: "div"
    },
    maxResults: 5,                         // Max. number of rendered results | (Optional)
    highlight: true,                       // Highlight matching results      | (Optional)
    resultItem: {                          // Rendered result item            | (Optional)
        content: (data, source) => {
            console.log("result item", data);
            source.innerHTML = data.value.title;
        },
        element: "div"
    },
    noResults: () => {                     // Action script on noResults      | (Optional)
        const result = document.createElement("li");
        result.setAttribute("class", "no_result");
        result.setAttribute("tabindex", "1");
        result.innerHTML = "No Results";
        document.querySelector("#result_list").appendChild(result);
    },
    onSelection: feedback => {             // Action script onSelection event | (Optional)
        const selection = feedback.selection.value.name;
       // console.log(feedback.selection.value.title);
        // Render selected choice to selection div
		//document.querySelector(".selection").innerHTML = selection;
		// Clear Input
		document.querySelector("#autoComplete").value = "";
		// Change placeholder with the selected value
	/*	document
			.querySelector("#autoComplete")
            .setAttribute("placeholder", selection);*/
            chrome.tabs.query({active:true, currentWindow:true},tab => {
                chrome.tabs.sendMessage(tab[0].id, {
                    message:"popup-open",
                    name:selection
                });
            });
            
    }
});

// Toggle results list and other elements
const action = function(action) {
    const selection = document.querySelector(".selection");
    if (selection){
        if (action === "dim") {
    
        selection.style.opacity = 1;
    
        } else {

        selection.style.opacity = 0.1;
            
        }
    }
  };

["focus", "blur"].forEach(function(eventType) {
    const resultsList = document.querySelector("#result_list");
  
    document.querySelector("#autoComplete").addEventListener(eventType, function() {
      // Hide results list & show other elements
      if (eventType === "blur") {
        action("dim");
        resultsList.style.display = "none";
      } else if (eventType === "focus") {
        // Show results list & hide other elemennts
        action("light");
        resultsList.style.display = "block";
      }
    });
  });
  





