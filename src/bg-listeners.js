/**
 *  Main handler functions for API logic executed by the background script 
 */

import utils from "./utils";

//wait 2 minutes for pending intents to connect
const pendingIntentTimeout = 2 * 60 * 1000;
//collection of queued intents to apply to tabs when they connect
let pending_intents = [];
//collection of queud contexts to apply to tabs when they connect
let pending_contexts = [];
//running contexts 
let contexts = {default:[]};
//context listeners
let contextListeners = {default:[]};
//intent listeners (dictionary keyed by intent name)
let intentListeners = {};

//track tab channel membership (apps can disconnect and reconnect, but tabs and channel membership persist)
let tabChannels = {};

const initContextChannels = (channels) => {
    //initialize the active channels
    //need to map channel membership to tabs, listeners to apps, and contexts to channels
    console.log(channels);
    channels.forEach(chan => {
        contextListeners[chan.id] = [];
        contexts[chan.id] = [];});
};

const dropContextListeners = (id) => {
    Object.keys(contextListeners).forEach(channel =>{
        contextListeners[channel] = contextListeners[channel].filter(item => {return item !== id; });
    }); 
};

const setIntentListener = (intent, id) => {
    if (!intentListeners[intent]){
        intentListeners[intent] = []; 
    }
    intentListeners[intent].push(id); 
};

const getIntentListeners = (intent) => {
    if (!intent) {
        return intentListeners;
    }
    else {
        return intentListeners[intent] ? intentListeners[intent] : [];
    }
};

//removes all intent listeners for an endpoiont
const dropIntentListeners = (port) => {
    //iterate through the intents and cleanup the listeners...
    Object.keys(intentListeners).forEach(key => {
        if (intentListeners[key].length > 0){
            intentListeners[key]= intentListeners[key].filter(item => {return item !== utils.id(port); });
        }
    });
};

const getTabChannel = (id) => {
    return tabChannels[(id + "")];
};

const open = async (msg, port) => {
    return new Promise(async (resolve, reject) => {
        const result = await fetch(`${utils.directoryUrl}/apps/${msg.data.name}`);
        if (result) {
            try {
                const r = await result.json();
                //todo: get the manifest...
                if (r && r.start_url){
                   
                    chrome.tabs.create({url:r.start_url},tab =>{
                        if (msg.data.context){
                            setPendingContext(tab.id, msg.data.context);
                        }
                        resolve({result:true, tab:tab.id});
                    });
                    
                }
                else {
                    reject(utils.OpenError.AppNotFound);
                }
        
            }
            catch (err){
                reject(utils.OpenError.AppNotFound);
            }
        }
        else {
            reject(utils.OpenError.AppNotFound);
        }
    });
};

const addContextListener = (msg, port) => {
    return new Promise((resolve, reject) => {
        let c = utils.getConnected(utils.id(port));
        let channel = (c && c.channel) ? c.channel : "default";
        contextListeners[channel].push((utils.id(port)));
        
        if (pending_contexts.length > 0){
            //first cleanup anything old
            let n = Date.now();
            pending_contexts = pending_contexts.filter(i => {
                return n - i.ts < pendingIntentTimeout;
            });
            //next, match on url and intent
            console.log("pending contexts", pending_contexts);
            pending_contexts.forEach((pContext, index) => {
                //removing trainling slashes from the sender.url...
                let portTabId = port.sender.tab.id;
                if (pContext.tabId === portTabId){
                    console.log("applying pending context", pContext);    
                    //refactor with other instances of this logic
                    port.postMessage({"topic":"context", "data":{"context": pContext.context}});    
                    utils.bringToFront(port.sender.tab); 
                    //remove the applied context
                    pending_intents.splice(index,1);
                }
            });
    
            
        }
        resolve(true);
    });
   
};


//keep array of pending, id of the tab,  store intent & context, timestamp
//when a new window connects, throw out anything more than 2 minutes old, then match on url
//when a match is found, remove match from the list, send intent w/context, and bring to front

const setPendingIntent =function(tabId, intent, context){
console.log("setPendingIntent",tabId, intent, context);
  pending_intents.push({ts:Date.now(), tabId:tabId, intent:intent, context:context});
};

const setPendingContext =function(tabId, context){
    pending_contexts.push({ts:Date.now(), tabId:tabId, context:context});
  };

const addIntentListener = (msg, port) => {
    return new Promise((resolve, reject) =>{
        let name = msg.data.intent;
        setIntentListener(name, utils.id(port));
        //check for pending intents

        if (pending_intents.length > 0){
            
            //first cleanup anything old
            let n = Date.now();
            
            pending_intents = pending_intents.filter(i => {
                return (n - i.ts) < pendingIntentTimeout;
            });
            //next, match on tab and intent
            pending_intents.forEach((pIntent, index) => {
                //removing trainling slashes from the sender.url...
                let portTabId = port.sender.tab.id;
                
                if (pIntent.tabId === portTabId && pIntent.intent === name){
                    console.log("applying pending intent", pIntent);    
                    //refactor with other instances of this logic
                    port.postMessage({"topic":"intent", "data":{"intent":pIntent.intent, "context": pIntent.context}});    
                    utils.bringToFront(port.sender.tab); 
                    //remove the applied intent
                    pending_intents.splice(index,1);
                }
            });
    
            
        }
        resolve(true);
    });

};

const broadcast = (msg, port) => {
    return new Promise((resolve, reject) => {
        let c = utils.getConnected((utils.id(port)));
        let channel = c.channel ? c.channel : "default";
        //is the app on a channel?
       
        contexts[channel].unshift(msg.data.context);
        //broadcast to listeners
        console.log("broadcast connected and contextListeners", utils.getConnected(), contextListeners);
        contextListeners[channel].forEach(l => {
            console.log(`broadcast ${channel} to`,l);
            utils.getConnected(l).port.postMessage({topic:"context", data:msg.data});
        });
        resolve(true);
    });
};

const raiseIntent = async (msg, port) => {
    return new Promise(async (resolve, reject) => {
        let r = [];

        //handle the resolver UI closing
        port.onMessage.addListener(async msg => {
            if (msg.topic === "resolver-close"){
                resolve({result:true});
            }
        });

        //add dynamic listeners...
        let intentListeners = getIntentListeners(msg.data.intent);
        if (intentListeners) {
            intentListeners.forEach(id => {
                //look up the details of the window and directory metadata in the "connected" store
                let connect = utils.getConnected(id);
                //de-dupe               
                if (!r.find(item => {
                    return item.details.port.sender.tab.id === connect.port.sender.tab.id;})){
                    r.push({type:"window",details:connect});
                }
            });
        }
        //pull intent handlers from the directory
        let ctx = "";
        if (msg.data.context){
            ctx = msg.data.context.type;
        }

        const _r = await fetch(`${utils.directoryUrl}/apps/search?intent=${msg.data.intent}&context=${ctx}`);
        if (_r){ 
            let data = null;
            try {
                data = await _r.json();
            }
            catch (err){
                console.log("error parsing json", err);
            }

            if (data){
                data.forEach(entry => {
                    r.push({type:"directory", details:{directoryData:entry}});

                });
            }
        }    

        if (r.length > 0){
            if (r.length === 1){
                //if there is only one result, use that
                //if it is a window, post a message directly to it
                //if it is a directory entry resolve the destination for the intent and launch it
                //dedupe window and directory items
                if (r[0].type === "window"){
                    r[0].details.port.postMessage({topic:"intent", data:msg.data});
                    utils.bringToFront(r[0].details.port);
                    let id = utils.id(r[0].details.port);
                    resolve({result:true, source:id, version:"1.0"});
                } else if (r[0].type === "directory"){
                    console.log("directory ", r[0].details);
                    let start_url = r[0].details.directoryData.start_url;
                    let mR = await fetch(r[0].details.directoryData.manifest);
                    if (mR){
                        try {
                            let mD = await mR.json();
                                //if there is metadata in the manifest that routes to a different URL for the intent, use that
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
                                        let sub = "${" + key + "}";
                                        let val = params[key];
                                        while (template.indexOf(sub) > -1){
                                            template = template.replace(sub,val);
                                        }
                                    });
                                
                                    start_url = template;
                                }
                                //let win = window.open(start_url,"_blank");
                                chrome.tabs.create({url:start_url},tab =>{
                                    let id = utils.id(port, tab);
                                    resolve({result:true, source:id, version:"1.0", tab:tab.id});
                                });
                                //send the context - if the default start_url was used...
                                //get the window/tab...
                               // resolve({result:true});
                        }

                        catch (err){
                            console.log("error parsing json", err);
                        }
                    }
                            
                    
                }
            }
            else {
                //show resolver UI
                // Send a message to the active tab
                //sort results alphabetically, with directory entries first (before window entries)
                r.sort((a,b)=>{
                    let aTitle = a.details.directoryData ? a.details.directoryData.title : a.details.port.sender.url;
                    let bTitle = b.details.directoryData ? b.details.directoryData.title : b.details.port.sender.url;
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

                let eventId = `resolveIntent-${Date.now()}`;

                //set a handler for resolving the intent (when end user selects a destination)
                port.onMessage.addListener(async msg => {
                    if (msg.topic === eventId){
                        
                        let r = await resolveIntent(msg, port);
                        resolve(r);
                    }
                });
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    var activeTab = tabs[0];
                   
                    chrome.tabs.sendMessage(activeTab.id, {
                        "message": "intent_resolver", 
                        "eventId": eventId,
                        "data":r, 
                        "intent":msg.data.intent,
                        "context":msg.data.context});
                    
                });
                
            }
                    
        }
        else {
            //show message indicating no handler for the intent...
            reject("no apps found for intent");
        }

            
        });
    
};


const resolveIntent = async (msg, port) => {
    return new Promise(async (resolve, reject) => {
        //find the app to route to
        const sType = msg.selected.type;
        const sPort = msg.selected.details.port;
        if (sType === "window"){
            let winList = getIntentListeners(msg.intent);
            let win = winList.find(item => {
                return item === utils.id(sPort);
            });
            if (win){
                utils.getConnected(win).port.postMessage({topic:"intent", data:{intent:msg.intent, context: msg.context}});    
                utils.bringToFront(win); 
                let id = utils.id(sPort);
                resolve({result:true, source:id, version:"1.0", tab:sPort.sender.tab.id});
            }
            
        }
        else if (sType === "directory"){
            let mR = await fetch(msg.selected.details.directoryData.manifest);
            let mD = await mR.json();
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
                            let sub = "${" + key + "}";
                            let val = params[key];
                            while (template.indexOf(sub) > -1){
                                template = template.replace(sub,val);
                            }
                      
                        });
                    
                        start_url = template;
                    }

                    chrome.tabs.create({url:start_url},tab =>{
                        //set pending intent for the tab...
                        setPendingIntent(tab.id, msg.intent, msg.context);
                        let id = utils.id(port,tab);
                        resolve({result:true, tab:tab.id, source:id, version:"1.0"});
                    });
                    //keep array of pending, id by url,  store intent & context, timestamp
                    //when a new window connects, throw out anything more than 2 minutes old, then match on url
                    //when a match is found, remove match from the list, send intent w/context, and bring to front
                    //resolve(true);
        
                }
            });
};

const joinChannel = (msg, port) => {
    return new Promise((resolve, reject) => {
        console.log("join channel", msg, port); 
        let chan = msg.data.channel;
        let _id = utils.id(port);
        let c = utils.getConnected(_id);
        //get the previous channel
         let prevChan = c.channel ? c.channel : "default";
         //are the new channel and previous the same?  then no-op...
         if (prevChan !== chan){
            //remove from previous channel...
            contextListeners[prevChan] = contextListeners[prevChan].filter(id => {return id !== _id;} );
            //add to new
            if (!contextListeners[chan]){
            contextListeners[chan] = [];
            }
            contextListeners[chan].push(_id);
            c.channel = chan;
            tabChannels[(port.sender.tab.id + "")] = chan;
            //set the badge state
            let bText = chan === "default" ? "" : "+";
            chrome.browserAction.setBadgeText({text:bText,tabId:port.sender.tab.id});
            
            let channels = utils.getSystemChannels();
            let selectedChannel = channels.find(_chan => {return _chan.id === chan;});
            let color = selectedChannel.visualIdentity ? selectedChannel.visualIdentity.color : "";
            chrome.browserAction.setBadgeBackgroundColor({color:color,
                tabId:port.sender.tab.id});
            //push current channel context 
            port.postMessage({topic:"context", data:{context:contexts[chan][0]}});
        }
        resolve(true);
    });
};

// returns a single AppIntent:
// {
//     intent: { name: "StartChat", displayName: "Chat" },
//     apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
// }
const findIntent = async (msg, port) => {
    return new Promise(async (resolve, reject) => {
        let intent = msg.data.intent;
        let context = msg.data.context;
        if (intent){
            let url = `${utils.directoryUrl}/apps/search?intent=${intent}`;
            if (context){
                //only use type
                if (typeof context === "object"){
                    context = context.type;
                }
                url+= `&context=${context}`;
            }
            try {
            let _r = await fetch(url);
            let j = await _r.json();
            let r = {intent:{}, apps:[]};
            r.apps = j;
            let intnt = r.apps[0].intents.filter(i => {return i.name === intent;});
            if (intnt.length > 0){
                r.intent.name = intnt[0].name;
                r.intent.displayName = intnt[0].display_name;
            }
            resolve(r);
            
            }
            catch (ex){
                //no results found for the app-directory, there may still be intents from live apps
                resolve({result:true,apps:[]});
            }
        }
        else {
            reject("no intent");
        }
    });
};


// returns, for example:
// [{
//     intent: { name: "StartCall", displayName: "Call" },
//     apps: [{ name: "Skype" }]
// },
// {
//     intent: { name: "StartChat", displayName: "Chat" },
//     apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
// }];
const findIntentsByContext = async (msg, port) => {
    return new Promise(async (resolve, reject) => {
        let context = msg.data.context;
        if (context.type){
            context = context.type;
        }    
        if (context){
            let url = `${utils.directoryUrl}/apps/search?context=${context}`;   
            let _r = await fetch(url);
            let d = await _r.json();
            let r = [];
            if (d){
                let found = {};
                let intents = [];
                d.forEach(item => {
                    item.intents.forEach(intent => {
                        if (!found[intent.name]){
                            intents.push({name:intent.name,displayName:intent.display_name});
                            found[intent.name] = [item];
                        }
                        else {
                            found[intent.name].push(item);
                        }
                    });
                });

                intents.forEach(intent =>{
                    let entry = {intent:intent,apps:found[intent.name]};

                    r.push(entry);
                });
            }
            resolve(r);
        }
        else {
            reject("no context");
        }
    });
};

const getTabTitle = (msg, port) => {
    return new Promise((resolve, reject) => {
        let id = msg.tabId;
        chrome.tabs.sendMessage(id, {"message": "get-tab-title"}, function(r){
            port.postMessage({topic:"tabTitle",
                                tabId:id,
                            data:{title:r}});
            resolve(true);
        });
    });
};
export default{ 
    open,
    addContextListener,
    addIntentListener,
    initContextChannels,
    dropContextListeners,
    dropIntentListeners,
    broadcast,
    raiseIntent,
    resolveIntent,
    joinChannel,
    getTabTitle,
    getTabChannel,
    findIntent,
    findIntentsByContext
};