

let directory = null;
//connected end points / apps
let connected = {};
//memoize dictionary of manifests
let manifests = {};
//the standard system channels
const systemChannels = {};
//running contexts 
let contexts = {default:[]};

//context listeners
let contextListeners = [];

//intent listeners (dictionary keyed by intent name)
let intentListeners = {};

/*var generateTemplateFunction = (function(){
    var cache = {};

    function generateTemplate(template){
        var fn = cache[template];

        if (!fn){
            // Replace ${expressions} (etc) with ${map.expressions}.

            var sanitized = template
                .replace(/\$\{([\s]*[^;\s\{]+[\s]*)\}/g, function(_, match){
                    return `\$\{map.${match.trim()}\}`;
                    })
                // Afterwards, replace anything that's not ${map.expressions}' (etc) with a blank string.
                .replace(/(\$\{(?!map\.)[^}]+\})/g, '');

            fn = Function('map', `return \`${sanitized}\``);
        }

        return fn;
    }

    return generateTemplate;
})();*/

fetch("http://localhost:3000/directory.json").then(_r =>{
                let r = _r.clone();
                r.json().then(data => {
                    directory = data;
                });
});

//to do: handle disconnects, remove listeners (identify listeners)
chrome.runtime.onConnect.addListener(function(port) {
    connected[port.sender.url] = port;
    let app_url = new URL(port.sender.url);
    //look up in directory...
    //to do: disambiguate apps with matching hosts
    let entry = directory.find(ent => {
        if (ent.start_url){
            let ent_url = new URL(ent.start_url);
            return app_url.host === ent_url.host;
        }
        return false;
    });
    //fetch and bundle the manifest data
    if (entry){
        if (entry.manifest){
            fetch(entry.manifest).then(mR => {
                mR.json().then(mD => {
                    entry.manifestContent = mD;
                    port.directoryData = entry;
                    port.postMessage({name:"directoryData", data:port.directoryData});
                });
            });
        }
        else {
            port.directoryData = entry;
            port.postMessage({name:"directoryData", data:port.directoryData});
        }
    }
    port.onDisconnect.addListener(function(){
        console.log("disconnect",port);
        let id = port.sender.url;
        connected[id] = null;
        //remove context listeners
        contextListeners = contextListeners.filter(item => {return item.sender.url !== id; });
        //iterate through the intents and cleanup the listeners...
        Object.keys(intentListeners).forEach(key => {
            if (intentListeners[key].length > 0){
                intentListeners[key]= intentListeners[key].filter(item => {return item.sender.url !== id; });
            }
        });
    });
    port.onMessage.addListener(function(msg) {
       
        if (msg.method === "open"){
            let result = directory.filter(item => item.name === msg.data.name);
            if (result.length > 0){
                //get the manifest...
                fetch(result[0].manifest).then(mR => {
                    mR.json().then(mD => {
                        let win = window.open(mD.start_url,msg.data.name);
                        win.focus();
                        
                    });
                });
                return true;
            }
        }
        else if (msg.method === "addContextListener"){
            contextListeners.push(port);
        }
        else if (msg.method === "addIntentListener"){
            let name = msg.data.intent;
            if (!intentListeners[name]){
                intentListeners[name] = []; 
            }
            intentListeners[name].push(port);
        }
        else if (msg.method === "broadcast"){
            contexts.default.unshift(msg.data.context);
            //broadcast to listeners
            contextListeners.forEach(l => {
                l.postMessage({name:"context", data:msg.data});
            });
        }
        else if (msg.method === "raiseIntent"){
            let r = [];
             //add dynamic listeners...
             if (intentListeners[msg.data.intent]) {
                intentListeners[msg.data.intent].forEach(win => {
                    r.push({type:"window",details:win});
                });
             }
            //pull intent handlers from the directory
            //to do: process directory when loaded (and refreshed...)
            directory.forEach(entry => {
                if (entry.intents){
                    
                    if (entry.intents.filter(int => {return int.name === msg.data.intent}).length > 0){
                        //ignore entries already dynamically registered
                        let list = intentListeners[msg.data.intent];
                        if (!list || !(list.find(app => {return app.directoryData.name === entry.name;}))){
                            r.push({type:"directory", details:entry});
                        }
                    }
                }
            });
           
            
             if (r.length > 0){
                if (r.length === 1){
                    //if there is only one result, use that
                 //if it is a window, post a message directly to it
                 //if it is a directory entry resolve the destination for the intent and launch it
                 //dedupe window and directory items
                 if (r[0].type === "window"){
                        r[0].details.postMessage({name:"intent", data:msg.data});
                    } else if (r[0].type === "directory"){
                        console.log("directory" + r[0].details);
                        fetch(r[0].details.manifest).then(mR => {
                            mR.json().then(mD => {
                                //find the matching intent entry
                                let intentData = mD.intents.find(i => {return i.intent === msg.data.intent;});
                                //set paramters
                                let ctx = msg.data.context;
                                let params = {};
                                Object.keys(contentManifest.params).forEach(key =>{ 
                                    let param = contentManifest.params[key];
                                    if (ctx.type === param.type){
                                        if (param.key){
                                            params[key] = ctx[param.key];
                                        }
                                        else if (param.id){
                                            params[key]  = ctx.id[param.id]; 
                                        }
                                    }
                                });
                                //eval the url
                                let template = mD.templates[intentData.template];
                                Object.keys(params).forEach(key => {
                                    template = template.replace("${" + key +"}",params[key]);

                                });
                               
                                let start_url = template;
                                let win = window.open(start_url,msg.data.name);
                                win.focus();
                                
                            });
                        });
                    }
                }
                else {
                    //show resolver UI
                    // Send a message to the active tab
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        var activeTab = tabs[0];
                        chrome.tabs.sendMessage(activeTab.id, {
                            "message": "intent_resolver", 
                            "data":r, 
                            "intent":msg.data.intent,
                            "context":msg.data.context});
                    });
                }
                
            }
            else {
                //show message indicating no handler for the intent...
            }
           
        }
        else if (msg.method === "resolveIntent"){
            //find the app to route to
            if (msg.selected.type === "window"){
                let winList = intentListeners[msg.intent] ? intentListeners[msg.intent] : [];
                let win = winList.find(item => {
                    return item.sender && item.sender.id === msg.selected.details.sender.id;
                });
                if (win){
                    win.postMessage({name:"intent", data:{intent:msg.intent, context: msg.context}});    
                    win.focus();
                }
                
            }
            else if (msg.selected.type === "directory"){
                fetch(msg.selected.details.manifest).then(mR => {
                    mR.json().then(mD => {
                  
                        //find the matching intent entry
                        let intentData = mD.intents.find(i => {return i.intent === msg.intent;});
                        //set paramters
                        let ctx = msg.context;
                        let params = {};
                        Object.keys(mD.params).forEach(key =>{ 
                            let param = mD.params[key];
                            if (ctx.type === param.type){
                                if (param.key){
                                    params[key] = ctx[param.key];
                                }
                                else if (param.id){
                                    params[key]  = ctx.id[param.id]; 
                                }
                            }
                        });
                        //generate the url
                        let template = mD.templates[intentData.template];
                        Object.keys(params).forEach(key => {
                            template = template.replace("${" + key +"}",params[key]);

                        });
                       
                        let start_url = template;
                        let win = window.open(start_url,msg.selected.details.name);
                        win.focus();
                    });
                });
            }
        }
    });
});

// Called when the user clicks on the browser action.
chrome.browserAction.onClicked.addListener(function(tab) {
    // Send a message to the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      var activeTab = tabs[0];
      chrome.tabs.sendMessage(activeTab.id, {"message": "clicked_browser_action"});
    });
  });

/*  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log(sender.tab ?
        "from a content script:" + sender.tab.url :
        "from the extension");

        let result = directory.filter(item => item.name === request.detail.name);
        if (result.length > 0){
            //get the manifest...
            fetch(result[0].manifest).then(mR => {
                mR.json().then(mD => {
                    let win = window.open(mD.startup_app.url,request.name);
                    win.focus();
                    sendResponse(true);
                });
            });
            return true;
        }
        else {
            sendResponse(false);
        }
              
        return true;
      }
  );*/

