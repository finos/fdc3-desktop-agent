import channels  from "./system-channels";

const dirUrl = "http://www.kolbito.com";
//const dirUrl = "http://localhost:3000";
//wait 2 minutes for pending intents to connect
const pendingIntentTimeout = 2 * 60 * 1000;
let directory = null;
//connected end points / apps
let connected = {};
//memoize dictionary of manifests
let manifests = {};

//running contexts 
let contexts = {default:[]};
//track tab channel membership (apps can disconnect and reconnect, but tabs and channel membership persist)
let tabChannels = {};

//context listeners
let contextListeners = {default:[]};

//intent listeners (dictionary keyed by intent name)
let intentListeners = {};


//initialize the active channels
//need to map channel membership to tabs, listeners to apps, and contexts to channels
console.log(channels);
channels.forEach(chan => {
    contextListeners[chan.id] = [];
    contexts[chan.id] = [];});

fetch(`${dirUrl}/apps`).then(_r =>{
                let r = _r.clone();
                r.json().then(data => {
                    directory = data;
                });
});

//to do: handle disconnects, remove listeners (identify listeners)
chrome.runtime.onConnect.addListener(function(port) {
    console.log("connected",port );
    let app_url = new URL(port.sender.url);
    let app_id = (port.sender.id + port.sender.tab.id);
    //look up in directory...
    //to do: disambiguate apps with matching origins...
    // todo: actually search against the appD service
    let entry = directory.find(ent => {
        if (ent.start_url){
            let ent_url = new URL(ent.start_url);
            return app_url.origin === ent_url.origin;
        }
        return false;
    });
    //fetch and bundle environmnet data for the app: app manifest, etc
    let data = {};
    data.currentChannel = tabChannels[(port.sender.tab.id + "")];
    data.tabId = port.sender.tab.id;
    
    if (entry){
        if (entry.manifest){
            fetch(entry.manifest).then(mR => {

                mR.json().then(mD => {
                    entry.manifestContent = mD;
                    //port.directoryData = entry;
                    data.directory = entry;
                    port.postMessage({name:"environmentData", 
                    data:data});
                });
            });
        }
        else {
           // port.directoryData = entry;
            data.directory = entry;
            port.postMessage({name:"environmentData", data:data});
        }
    }
    connected[app_id] = {port:port, directoryData:entry};
    
    port.onDisconnect.addListener(function(){
        console.log("disconnect",port);
        let id = (port.sender.id + port.sender.tab.id);
        connected[id] = null;
        //remove context listeners
        Object.keys(contextListeners).forEach(channel =>{
            contextListeners[channel] = contextListeners[channel].filter(item => {return item !== id; });
        }); 
        
        //iterate through the intents and cleanup the listeners...
        Object.keys(intentListeners).forEach(key => {
            if (intentListeners[key].length > 0){
                intentListeners[key]= intentListeners[key].filter(item => {return item !== port.sender.id + port.sender.tab.id; });
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
            let channel = connected[(port.sender.id + port.sender.tab.id)].channel ? connected[(port.sender.id + port.sender.tab.id)].channel : "default";
            contextListeners[channel].push((port.sender.id + port.sender.tab.id));
        }
        else if (msg.method === "addIntentListener"){
            let name = msg.data.intent;
            if (!intentListeners[name]){
                intentListeners[name] = []; 
            }
            intentListeners[name].push(port.sender.id + port.sender.tab.id);
            //check for pending intents
            if (pending_intents.length > 0){
                //first cleanup anything old
                let n = Date.now();
                pending_intents = pending_intents.filter(i => {
                    return n - i.ts < pendingIntentTimeout;
                });
                //next, match on url and intent
                let intent = pending_intents.forEach((pIntent, index) => {
                    //removing trainling slashes from the sender.url...
                    let pUrl = port.sender.url;
                    if (pUrl.charAt(pUrl.length -1) === "/"){
                        pUrl = pUrl.substr(0,port.sender.url.length -1);
                    }
                    if (pIntent.url === pUrl && pIntent.intent === name){
                        console.log("applying pending intent", pIntent);    
                        //refactor with other instances of this logic
                        port.postMessage({name:"intent", data:{intent:name, context: pIntent.context}});    
                        bringToFront(port.tab); 
                        //remove the applied intent
                        pending_intents.splice(index,1);
                    }
                });

                
            }
        }
        else if (msg.method === "broadcast"){
            let channel = connected[(port.sender.id + port.sender.tab.id)].channel ? connected[(port.sender.id + port.sender.tab.id)].channel : "default";
            //is the app on a channel?
           
            contexts[channel].unshift(msg.data.context);
            //broadcast to listeners
            contextListeners[channel].forEach(l => {
                connected[l].port.postMessage({name:"context", data:msg.data});
            });
        }
        else if (msg.method === "raiseIntent"){
            let r = [];
            //pull intent handlers from the directory
            let ctx = "";
            if (msg.data.context){
                ctx = msg.data.context.type;
            }
            fetch(`${dirUrl}/apps/search?intent=${msg.data.intent}&context=${ctx}`).then(_r =>{
                //add dynamic listeners...
                if (intentListeners[msg.data.intent]) {
                    intentListeners[msg.data.intent].forEach(win => {
                        //look up the details of the window and directory metadata in the "connected" store
                        let connect = connected[win];
                        //de-dupe               
                        if (!r.find(item => {
                            return item.details.port.sender.tab.id === connect.port.sender.tab.id;})){
                            r.push({type:"window",details:connect});
                        }
                    });
                }

                _r.json().then(data => {
                    data.forEach(entry => {
                        r.push({type:"directory", details:{directoryData:entry}});
    
                    });
                   
                    
                     if (r.length > 0){
                        if (r.length === 1){
                            //if there is only one result, use that
                         //if it is a window, post a message directly to it
                         //if it is a directory entry resolve the destination for the intent and launch it
                         //dedupe window and directory items
                         if (r[0].type === "window"){
                                r[0].details.port.postMessage({name:"intent", data:msg.data});
                                bringToFront(r[0].details.port);
                            } else if (r[0].type === "directory"){
                                console.log("directory ", r[0].details);
                                let start_url = r[0].details.directoryData.start_url;
                                fetch(r[0].details.directoryData.manifest).then(mR => {
                                    mR.json().then(mD => {
                                       //if there is metadata inthe manifest that routes to a different URL for the intent, use that
                                        if (mD.intents){
                                            //find the matching intent entry
                                            let intentData = mD.intents.find(i => {
                                                return i.type === msg.data.context.type && i.intent === msg.data.intent;
                                            });
                                            //set paramters
                                            let ctx = msg.data.context;
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
                                            //eval the url
                                            let template = mD.templates[intentData.template];
                                            Object.keys(params).forEach(key => {
                                                template = template.replace("${" + key +"}",params[key]);
            
                                            });
                                        
                                            start_url = template;
                                        }
                                        let win = window.open(start_url,msg.data.name);
                                        console.log("new window",win);
                                        //send the context - if the default start_url was used...
                                        //get the window/tab...
                                        win.focus();
                                        
                                    });
                                });
                            }
                        }
                        else {
                            //show resolver UI
                            // Send a message to the active tab
                            //sort results alphabetically, with directory entries first (before window entries)
                            console.log("before sort ", r);
                            r.sort((a,b)=>{
                                let aTitle = a.details.directoryData.title;
                                let bTitle = b.details.directoryData.title;
                                if (aTitle < bTitle){
                                    return -1;
                                }
                                if (aTitle > bTitle){
                                    return 1;
                                }
                                else {
                                    return 0;
                                }
                            });
                            console.log("after sort ", r);
                
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
                });
            });
          
           
        }
        else if (msg.method === "resolveIntent"){
            //find the app to route to
            if (msg.selected.type === "window"){
                let winList = intentListeners[msg.intent] ? intentListeners[msg.intent] : [];
                let win = winList.find(item => {
                    return item === msg.selected.details.port.sender.id + msg.selected.details.port.sender.tab.id;
                });
                if (win){
                    connected[win].port.postMessage({name:"intent", data:{intent:msg.intent, context: msg.context}});    
                    bringToFront(win); 
                }
                
            }
            else if (msg.selected.type === "directory"){
                fetch(msg.selected.details.directoryData.manifest).then(mR => {
                    mR.json().then(mD => {
                        let start_url = mD.start_url;
                        if (mD.intents){
                            //find the matching intent entry
                            let intentData = mD.intents.find(i => {
                                if (i.type){
                                   return i.type === msg.context.type && i.intent === msg.intent;
                                }
                                else {
                                   return i.intent === msg.intent;
                                }
                            });
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
                        
                            start_url = template;
                        }
                        let win = window.open(start_url,msg.selected.details.directoryData.name);
                        
                        //set pending intent for the url...
                        setPending(start_url, msg.intent, msg.context);
                        //keep array of pending, id by url,  store intent & context, timestamp
                        //when a new window connects, throw out anything more than 2 minutes old, then match on url
                        //when a match is found, remove match from the list, send intent w/context, and bring to front
                        
                    });
                });
            }
        }
        else if (msg.method === "joinChannel"){
           console.log(port); 
           let chan = msg.data.channel;
           let _id = (port.sender.id + port.sender.tab.id);
           //remove from previous channel...
            let prevChan = connected[_id].channel ? connected[_id].channel : "default";
            contextListeners[prevChan] = contextListeners[prevChan].filter(id => {return id !== _id;} );
           //add to new
           if (!contextListeners[chan]){
            contextListeners[chan] = [];
           }
           contextListeners[chan].push(_id);
           connected[_id].channel = chan;
           tabChannels[(port.sender.tab.id + "")] = chan;
           //set the badge state
           chrome.browserAction.setBadgeText({text:"+",tabId:port.sender.tab.id});
           let selectedChannel = channels.find(_chan => {return _chan.id === chan;});
           chrome.browserAction.setBadgeBackgroundColor({color:selectedChannel.visualIdentity.color,
               tabId:port.sender.tab.id});
            //push current channel context 
           port.postMessage({name:"context", data:{context:contexts[chan][0]}});
           
        }
        else if (msg.method === "getTabTitle"){
            let id = msg.tabId;
            chrome.tabs.sendMessage(id, {"message": "get-tab-title"}, function(r){
                port.postMessage({name:"tabTitle",
                                    tabId:id,
                                data:{title:r}});
            });
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


  let pending_intents = [];
  //keep array of pending, id by url,  store intent & context, timestamp
  //when a new window connects, throw out anything more than 2 minutes old, then match on url
  //when a match is found, remove match from the list, send intent w/context, and bring to front
 
  const setPending =function(url, intent, context){
    pending_intents.push({ts:Date.now(), url:url, intent:intent, context:context});
  };

  //util functions (move to module)
  const bringToFront = function(id){
    return new Promise((resolve, reject) => {
        let _tab = null;
        if (id.windowId && id.id){
            _tab = id;
        }
        else {
            let c = connected[id];
            if (c && c.port && c.port.sender){
                _tab = c.port.sender.tab;
            }
        }
        if (_tab){
            
            chrome.tabs.update(_tab.id,{"active":true,"highlighted":true},function (tab){
                console.log("Completed updating tab .." + JSON.stringify(tab));
                });
            chrome.windows.update(_tab.windowId, {"focused":true});
            resolve(_tab);
        }
        else  {
            let message = `bringToFront: no connected tab found for id '${id}'`;
            console.warn(message);
            reject({"message":message});
        }
    });
}