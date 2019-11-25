 //establish comms with the background script 
 var port = chrome.runtime.connect({name: "fdc3"});

 //inject the FDC3 API
 var s = document.createElement('script');
 s.src = chrome.extension.getURL('api.js');
 s.onload = function() {
     this.parentNode.removeChild(this);
 };
 (document.head||document.documentElement).appendChild(s);

 
 //listen for FDC3 events
 document.addEventListener('FDC3:open',e => {
     port.postMessage({method:"open", "data": e.detail});   
 });

document.addEventListener('FDC3:broadcast',e => {
    port.postMessage({method:"broadcast", "data": e.detail}); 
});

document.addEventListener('FDC3:addContextListener',e => {
    port.postMessage({method:"addContextListener", "data": e.data}); 
});

port.onMessage.addListener(msg => {
    if (msg.name === "context"){
        document.dispatchEvent(new CustomEvent("FDC3:context",{
            detail:{data:msg.data}
        }));
    }

});
 //handle intents

 //handle context

 //listen for broadcast event from the content

 //listen for raise intent from the content

 //listen for URL changes

 //log relevant information about the page

 //log relevant user activity

 //look for actionable entities

 var overlay = null; 

 //handle click on extension button
 //raise directory search overlay
 chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if( request.message === "clicked_browser_action" ) {
          if (! overlay){
            overlay = document.createElement("div");
            overlay.style.width = "400";
            overlay.style.height = "400";
            overlay.style.left = "50%";
           
            overlay.style.top = "50%";
            overlay.style.backgroundColor = "red";
            overlay.style.position = "absolute";
            overlay.style.display = "none;"
     document.body.appendChild(overlay);
          }
        overlay.style.display = "block";
   
      }
    }
  );