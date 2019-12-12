import channels from "./system-channels";

//establish comms with the background script 
 let port = chrome.runtime.connect({name: "fdc3"});

 //automated handlers based on manifest metadata - other handlers are set and dispatched by the API layer
 //these just need to be markers - since the handling itself is just automgenerated from the metadata held in the manifest 
 let _intentHandlers = [];
 let _contextHandlers = [];
 let contentManifest = null;

 let currentChannel = null;

 //retrieve the document title for a tab
function getTabTitle(tabId){
    let id = tabId;
    return new Promise((resolve, reject) => {
        port.onMessage.addListener(msg => {
            if (msg.name === "tabTitle" && id === msg.tabId){
                resolve(msg.data.title);
            }
        });
        port.postMessage({method:"getTabTitle", "tabId":tabId});
    });  
}

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
    currentChannel = e.detail.data.channel;
    port.postMessage({method:"joinChannel", "data": e.detail}); 
});

document.addEventListener('FDC3:getSystemChannels',e => {
    document.dispatchEvent(new CustomEvent("FDC3:systemChannels", {detail:{data: systemChannels}})); 
});

port.onMessage.addListener(msg => {
    if (msg.name === "environmentData"){
        console.log(msg.data);
        //if there is manifest content, wire up listeners if intents and context metadata are there
        let mani = msg.data.directory.manifestContent;
        //set globals
        contentManifest = mani;
        if (mani){
            if (mani.intents){
                //iterate through the intents, and set listeners
                mani.intents.forEach(intent => {
                    port.postMessage({method:"addIntentListener", "data": {intent:intent.intent }}); 
                    _intentHandlers.push(intent.intent);
                });
            }
            if (mani.contexts){
                //iterate through context metadata and set listeners
                mani.contexts.forEach(context => {
                    port.postMessage({method:"addContextListener", "data": {context:context.type}}); 
                    _contextHandlers.push(context.type);
                });
            
            }
        }
        if (msg.data.currentChannel){
            currentChannel = msg.data.currentChannel;
            port.postMessage({method:"joinChannel", "data": {channel:currentChannel}}); 
            
            
        }
    }
   else  if (msg.name === "context"){
       //check for handlers at the content script layer (automatic handlers) - if not, dispatch to the API layer...
       if (_contextHandlers.indexOf(msg.data.context.type) > -1 && contentManifest){
        let contextMeta = contentManifest.contexts.find(i => {
            return i.type === msg.data.context.type;
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
        let template = contentManifest.templates[contextMeta.template];
        Object.keys(params).forEach(key => {
            template = template.replace("${" + key +"}",params[key]);

        });
        //don't reload if they are the same...
        if (window.location.href !== template){
            window.location.href = template; 
        }
        //focus the actual tab
        window.focus();
    }

        document.dispatchEvent(new CustomEvent("FDC3:context",{
            detail:{data:msg.data}
        }));
    }
    else if (msg.name === "intent") {
        //check for handlers at the content script layer (automatic handlers) - if not, dispatch to the API layer...
        if (_intentHandlers.indexOf(msg.data.intent) > -1 && contentManifest){
            let intentData = contentManifest.intents.find(i => {
              //  return (i.type && i.type === msg.data.context.type) && i.intent === msg.data.intent;
              return i.intent === msg.data.intent;
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
            //don't reload if they are the same...
            if (window.location.href !== template){
                window.location.href = template; 
            }
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
     
        if (resolver){
            resolver.style.display = "none";
        }
    }
});

 let resolver = null;

 
 //handle click on extension button
 //raise directory search overlay
 chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.message === "get-tab-title"){
            sendResponse(document.title);
        }
        else if (request.message === "popup-get-current-channel"){
            sendResponse(currentChannel);
        }
        else if (request.message === "popup-join-channel"){
            currentChannel = request.channel;
            port.postMessage({method:"joinChannel", "data": {channel:request.channel}}); 
        }
  
      else if (request.message === "intent_resolver"){
        if (! resolver){
         resolver = createResolverRoot();
   
     document.body.appendChild(resolver);
            
          }
          resolver.style.display = "block";
          let list = resolver.shadowRoot.querySelectorAll("#resolve-list")[0];
          list.innerHTML = "";

        //contents
        request.data.forEach((item) => {
            let selected = item;
            let data = item.details.directoryData ? item.details.directoryData : item.details;
            let rItem = document.createElement("div");

            rItem.className = "item";
            let title = data.title;
            let titleNode = null;
            //title should reflect if this is creating a new window, or loading to an existing one
            if (item.type === "window"){
                let tab = item.details.sender.tab;
                let icon = document.createElement("img");
                icon.className = "icon"; 
                if (tab.favIconUrl){
                    icon.src = tab.favIconUrl;
                }
                rItem.appendChild(icon);
                titleNode = document.createElement("span");
                titleNode.id = "title-" + tab.id;
                titleNode.innerText = title;
                let query = "#title-" + tab.id;
                rItem.appendChild(titleNode);
                //async get the window title
                getTabTitle(tab.id).then(t => { 
                    let titles =  list.querySelectorAll(query)[0];
                    if (titles.length > 0){
                        titles.innerText += ` (${t})`;
                    }
                });
                //get the window.title value
                //title value is wrong - will need to message to the content script
                let winTitle = chrome
                title = `${title} (${tab.title})`;
            }
            if (titleNode){
                titleNode.innerText = title;
                titleNode.addEventListener("click",evt => {
                    //send resolution message to extension to route
                    console.log(`intent resolved (window).  selected = ${JSON.stringify(selected)} intent = ${JSON.stringify(request.intent)} contect = ${JSON.stringify(request.context)}`)
                    port.postMessage({
                        method:"resolveIntent",
                        intent:request.intent,
                        selected:selected,
                        context:request.context
                    }); 
                    list.innerHTML = "";
                    resolver.style.display = "none";
                });
            }
            else {
                rItem.innerText = title;
            
            rItem.addEventListener("click",evt => {
                //send resolution message to extension to route
                console.log(`intent resolved (directory).  selected = ${JSON.stringify(selected)} intent = ${JSON.stringify(request.intent)} contect = ${JSON.stringify(request.context)}`)
                    
                port.postMessage({
                    method:"resolveIntent",
                    intent:request.intent,
                    selected:selected,
                    context:request.context
                }); 
                list.innerHTML = "";
                resolver.style.display = "none";
            });
        }
            list.appendChild(rItem);
        });
      }

    }
    
  );

  function createResolverRoot(){
 
        // Create root element
        let root = document.createElement('div');
        let wrapper = document.createElement('div');
        wrapper.id = "fdc3-intent-resolver";

         // Create a shadow root
         var shadow = root.attachShadow({mode: 'open'});

        // Create some CSS to apply to the shadow dom
        const style = document.createElement('style');

        style.textContent = `
        #fdc3-intent-resolver {
            width:400px;
            height:400px;
            margin-left:-200px;
            margin-top:-200px;
            left:50%;
            top:50%;
            background-color:#222;
            position:absolute;
            z-index:9999;
   
        }
            
        #resolve-list {
            height:300px;
            overflow:scroll;
        }
        
        #resolve-list .item {
            color:#fff;
            flexFlow:row;
            height:20px;
            padding:3px;
        }


        #resolve-list .item .icon {
           height:20px;
        }
        
        #resolve-list .item:hover {
            background-color:#999;
            color:#ccc;
        }
        `;

        let list = document.createElement('div');
        list.id = "resolve-list";
        wrapper.appendChild(list);
        
        // Attach the created elements to the shadow dom
        shadow.appendChild(style);
        shadow.appendChild(wrapper);
        

      
        return root;
    }
  