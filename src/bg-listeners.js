import utils from "./utils";

//wait 2 minutes for pending intents to connect
const pendingIntentTimeout = 2 * 60 * 1000;
let pending_intents = [];
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
            intentListeners[key]= intentListeners[key].filter(item => {return item !== port.sender.id + port.sender.tab.id; });
        }
    });
};

const getTabChannel = (id) => {
    return tabChannels[(id + "")];
};

const open = (msg, port) => {
    return new Promise((resolve, reject) => {
        fetch(`${utils.directoryUrl}/apps/${msg.data.name}`).then(result => {
            result.json().then(r => {
                //todo: get the manifest...
               /* fetch(result.manifest).then(mR => {
                    mR.json().then(mD => {
                        let win = window.open(mD.start_url,msg.data.name);
                        win.focus();
                        
                    });
                });*/
                window.open(r.start_url,"_blank");
                //todo: handle context, templates, etc
                //todo: return app handle object with tab...
                //todo: handle no appd and other error conditions
                resolve(true);
            });
               
            
        });
    });
};

const addContextListener = (msg, port) => {
    return new Promise((resolve, reject) => {
        let c = utils.getConnected(port.sender.id + port.sender.tab.id);
        let channel = c.channel ? c.channel : "default";
        contextListeners[channel].push((port.sender.id + port.sender.tab.id));
        resolve(true);
    });
   
};


//keep array of pending, id by url,  store intent & context, timestamp
//when a new window connects, throw out anything more than 2 minutes old, then match on url
//when a match is found, remove match from the list, send intent w/context, and bring to front

const setPendingIntent =function(url, intent, context){
  pending_intents.push({ts:Date.now(), url:url, intent:intent, context:context});
};

const addIntentListener = (msg, port) => {
    return new Promise((resolve, reject) =>{
        let name = msg.data.intent;
       setIntentListener(name, port.sender.id + port.sender.tab.id)
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
                    port.postMessage({"name":"intent", "data":{"intent":pIntent.intent, "context": pIntent.context}});    
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
        let c = utils.getConnected((port.sender.id + port.sender.tab.id));
        let channel = c.channel ? c.channel : "default";
        //is the app on a channel?
       
        contexts[channel].unshift(msg.data.context);
        //broadcast to listeners
        contextListeners[channel].forEach(l => {
            utils.getConnected(l).port.postMessage({name:"context", data:msg.data});
        });
        resolve(true);
    });
};

const raiseIntent = (msg, port) => {
    return new Promise((resolve, reject) => {
        let r = [];
        //pull intent handlers from the directory
        let ctx = "";
        if (msg.data.context){
            ctx = msg.data.context.type;
        }
        fetch(`${utils.directoryUrl}/apps/search?intent=${msg.data.intent}&context=${ctx}`).then(_r =>{
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
                            utils.bringToFront(r[0].details.port);
                            resolve(true);
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
                                            let sub = "${" + key + "}";
                                            let val = params[key];
                                            while (template.indexOf(sub) > -1){
                                                template = template.replace(sub,val);
                                            }
                                        });
                                    
                                        start_url = template;
                                    }
                                    let win = window.open(start_url,"_blank");
                                    console.log("new window",win);
                                    //send the context - if the default start_url was used...
                                    //get the window/tab...
                                    win.focus();
                                    resolve(true);
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
                        console.log("after sort ", r);
            
                        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                            var activeTab = tabs[0];
                            chrome.tabs.sendMessage(activeTab.id, {
                                "message": "intent_resolver", 
                                "data":r, 
                                "intent":msg.data.intent,
                                "context":msg.data.context});
                            
                        });
                        resolve(true);
                    }
                    
                }
                else {
                    //show message indicating no handler for the intent...
                    reject("no apps found for intent");
                }

            });
        });
    });
};

const resolveIntent = (msg, port) => {
    return new Promise((resolve, reject) => {
//find the app to route to
if (msg.selected.type === "window"){
    let winList = getIntentListeners(msg.intent);
    let win = winList.find(item => {
        return item === msg.selected.details.port.sender.id + msg.selected.details.port.sender.tab.id;
    });
    if (win){
        utils.getConnected(win).port.postMessage({name:"intent", data:{intent:msg.intent, context: msg.context}});    
        utils.bringToFront(win); 
        resolve(true);
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
                    let sub = "${" + key + "}";
                    let val = params[key];
                    while (template.indexOf(sub) > -1){
                        template = template.replace(sub,val);
                    }
              
                });
            
                start_url = template;
            }
            let win = window.open(start_url,"_blank");
            
            //set pending intent for the url...
            setPendingIntent(start_url, msg.intent, msg.context);
            //keep array of pending, id by url,  store intent & context, timestamp
            //when a new window connects, throw out anything more than 2 minutes old, then match on url
            //when a match is found, remove match from the list, send intent w/context, and bring to front
            resolve(true);
        });
    });
}
    });
};

const joinChannel = (msg, port) => {
    return new Promise((resolve, reject) => {
        console.log(port); 
        let chan = msg.data.channel;
        let _id = (port.sender.id + port.sender.tab.id);
        let c = utils.getConnected(_id);
        //remove from previous channel...
         let prevChan = c.channel ? c.channel : "default";
         contextListeners[prevChan] = contextListeners[prevChan].filter(id => {return id !== _id;} );
        //add to new
        if (!contextListeners[chan]){
         contextListeners[chan] = [];
        }
        contextListeners[chan].push(_id);
        c.channel = chan;
        tabChannels[(port.sender.tab.id + "")] = chan;
        //set the badge state
        chrome.browserAction.setBadgeText({text:"+",tabId:port.sender.tab.id});
        let channels = utils.getSystemChannels();
        let selectedChannel = channels.find(_chan => {return _chan.id === chan;});
        chrome.browserAction.setBadgeBackgroundColor({color:selectedChannel.visualIdentity.color,
            tabId:port.sender.tab.id});
         //push current channel context 
        port.postMessage({name:"context", data:{context:contexts[chan][0]}});
        resolve(true);
    });
};


const findIntent = (msg, port) => {
    return new Promise((resolve, reject) => {
        let intent = msg.intent;
        let context = msg.context;
        if (intent){
            let url = `${utils.directoryUrl}/apps/search?intent=${intent}`;
            if (context){
                //only use type
                if (typeof context === "object"){
                    context = context.type;
                }
                url+= `&context=${context}`;
            }
        
            fetch(url).then(_r =>{
                _r.json().then(j => {resolve(j);});
            });
        }
        else {
            reject("no intent");
        }
    });
};

const findIntentsByContext = (msg, port) => {
    return new Promise((resolve, reject) => {
        let context = msg.context;    
        if (context){
            let url = `${utils.directoryUrl}/apps/search?context=${context}`;   
            fetch(url).then(_r =>{
                _r.json().then(j => {resolve(j);});
            });
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
            port.postMessage({name:"tabTitle",
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