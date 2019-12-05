 //establish comms with the background script 
 let port = chrome.runtime.connect({name: "fdc3"});

 //automated handlers based on manifest metadata - other handlers are set and dispatched by the API layer
 //these just need to be markers - since the handling itself is just automgenerated from the metadata held in the manifest 
 let _intentHandlers = [];
 let _contextHandlers = [];
 let contentManifest = null;
 let systemChannels = null;

 const colors = {
    "default":{
        color:"#fff",
        hover:"#ececec"
    },
    "red":{
        color:"#da2d2d",
        hover:"#9d0b0b" 
    },
    "orange":{
        color:"#eb8242",
        hover:"#e25822"
    },
    "yellow":{
        color:"#f6da63",
        hover:"#e3c878"
    },
    "green":{
        color:"#42b883",
        hover:"#347474"
    },
    "blue":{
        color:"#1089ff",
        hover:"#505BDA"
    },
    "purple":{
        color:"#C355F5",
        hover:"#AA26DA"
    }
  };


 //inject the FDC3 API
 let s = document.createElement('script');
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

document.addEventListener('FDC3:raiseIntent',e => {
    port.postMessage({method:"raiseIntent", "data": e.detail}); 
});

document.addEventListener('FDC3:addContextListener',e => {
    port.postMessage({method:"addContextListener", "data": e.detail}); 
});

document.addEventListener('FDC3:addIntentListener',e => {
    port.postMessage({method:"addIntentListener", "data": e.detail}); 
});

document.addEventListener('FDC3:joinChannel',e => {
    port.postMessage({method:"joinChannel", "data": e.detail}); 
});

document.addEventListener('FDC3:getSystemChannels',e => {
    document.dispatchEvent(new CustomEvent("FDC3:systemChannels", {detail:{data: systemChannels}})); 
});

port.onMessage.addListener(msg => {
    if (msg.name === "environmentData"){
        console.log(msg.data);
        //if there is manifest content, wire up listeners if intents and context metadata are there
        let mani = msg.data.manifestContent;
        //set globals
        contentManifest = mani;
        systemChannels = msg.data.systemChannels;
        if (mani && mani.intents){
            //iterate through the intents, and set listeners
            mani.intents.forEach(intent => {
                port.postMessage({method:"addIntentListener", "data": {intent:intent.intent }}); 
                _intentHandlers.push(intent.intent);
            });
          
        }
    }
   else  if (msg.name === "context"){
        document.dispatchEvent(new CustomEvent("FDC3:context",{
            detail:{data:msg.data}
        }));
    }
    else if (msg.name === "intent") {
        //check for handlers at the content script layer (automatic handlers) - if not, dispatch to the API layer...
        if (_intentHandlers.indexOf(msg.data.intent) > -1 && contentManifest){
            let intentData = contentManifest.intents.find(i => {
                return i.type === msg.data.context.type && i.intent === msg.data.intent;
            });
            //set paramters
            let ctx = msg.data.context;
            let params = {};
           
                Object.keys(contentManifest.params).forEach(key =>{ 
                    let param = contentManifest.params[key];
                    if (ctx.type === param.type){
                        if (param.key && ctx[param.key]){
                            params[key] = ctx[param.key];
                        }
                        else if (param.id && ctx.id[param.id]){
                            params[key]  = ctx.id[param.id]; 
                        }
                    }
                });
            
            //eval the url
            let template = contentManifest.templates[intentData.template];
            Object.keys(params).forEach(key => {
                template = template.replace("${" + key +"}",params[key]);

            });
            window.location.href = template; 
            window.focus();
        }
        document.dispatchEvent(new CustomEvent("FDC3:intent",{
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

 let overlay = null; 
 document.addEventListener('keydown', k => {
     if (k.code === "Escape" ){
        if (overlay){
         overlay.style.display = "none";
        }
        if (resolverOverlay){
            resolverOverlay.style.display = "none";
        }
    }
});

 let resolverOverlay = null;

 
 //handle click on extension button
 //raise directory search overlay
 chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if( request.message === "clicked_browser_action" ) {
        //show color linking, search, other functions?...  
          if (! overlay){
            overlay = document.createElement("div");
            overlay.style.display = "none";
            let root = document.createElement("div");
            root.id = "fdc3-overlay";
            let shadow = overlay.attachShadow({mode: 'open'});
            let style = document.createElement('style');
            style.textContent = `
                #fdc3-overlay {
                    width:500px;
                    height:200px;
                    margin-left:-250px;
                    margin-top:-100px;
                    left:50%;
                    top:50%;
                    background-color:#eee;
                    position:absolute;
                }
            `;
        
            shadow.appendChild(style);
            shadow.appendChild(root);
            document.body.appendChild(overlay);
            root.innerHTML = `
                <fdc3-channel-picker></fdc3-channel-picker>
            `;
          }
        overlay.style.display = "block";
          
   
      }
      else if (request.message === "intent_resolver"){
        if (! resolverOverlay){
            resolverOverlay = document.createElement("div");
            resolverOverlay.style.width = "400px";
            resolverOverlay.style.height = "400px";
            resolverOverlay.style.marginLeft = "-200px";
            resolverOverlay.style.marginTop = "-200px";
            resolverOverlay.style.left = "50%";
           
            resolverOverlay.style.top = "50%";
            resolverOverlay.style.backgroundColor = "black";
            resolverOverlay.style.position = "absolute";
            resolverOverlay.style.display = "none;"
            resolverOverlay.style.flexFlow = "row wrap";
     document.body.appendChild(resolverOverlay);
          }
          resolverOverlay.style.display = "block";

        let contents = `<div>Resolve Intent</div>
        <div  id="fdc3-resolver-list" syle="height:300;overflow:scroll;">
        </div>`;
        resolverOverlay.innerHTML = contents;
        //contents
        request.data.forEach((item) => {
            let selected = item;
            let data = item.details.directoryData ? item.details.directoryData : item.details;
            let rItem = document.createElement("div");
            console.log(data);
            rItem.style.color = "white";
            rItem.style.flexFlow = "row";
            rItem.style.height = "20px";
            rItem.innerText = data.title
            rItem.addEventListener("click",evt => {
                //send resolution message to extension to route
                port.postMessage({
                    method:"resolveIntent",
                    intent:request.intent,
                    selected:selected,
                    context:request.context
                }); 
                resolverOverlay.innerHTML = "";
                resolverOverlay.style.display = "none";
            });
            resolverOverlay.appendChild(rItem);
        });
      }
    }
  );