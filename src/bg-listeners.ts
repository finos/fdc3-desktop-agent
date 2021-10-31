/**
 *  Main handler functions for API logic executed by the background script 
 */

import utils from './utils';
import {TargetApp} from './types/fdc3/Types';
import {AppIntent} from './types/fdc3/AppIntent';
import {AppMetadata} from './types/fdc3/AppMetadata';
import { Context } from "./types/fdc3/Context";
import { FDC3Message } from "./types/FDC3Message";
import {IntentInstance} from './types/IntentInstance';
import {DirectoryApp, DirectoryIntent, Channel, FDC3App, FDC3AppDetail, ConnectedApp} from './types/FDC3Data';
import { IntentMetadata } from './types/fdc3/IntentMetadata';
import { AppInstance } from './types/AppInstance';

/**
 * reperesents a pending event to be passed to an app once it is loaded
 */
class Pending {
    /**
     * timestamp
     */
    ts : number;

    /**
     * identifier for pending tab
     */
    tabId: number;
    
    /**
     * identifier for the instance the originated intent or context
     */
    source : string;

    /**
     * context object to apply
     */
    context? : Context;

    /**
     * name of intent to apply
     */
    intent? : string;

    /**
     * id of channel to join
     */
    channel? : string;



    /**
     * 
     * @param tabId 
     * @param init 
     */
    constructor(tabId: number, source : string, init : any){
        this.ts = Date.now();
        this.tabId = tabId;
        this.source = source;
        this.context = init.context ? init.context : null;
        this.intent = init.intent ? init.intent : null;
        this.channel = init.channel ? init.channel : null;
    }
}

/**
 * represents an event listener
 */
interface Listener {
    appId : string;
    contextType? : string;
    isChannel?:boolean;
    listenerId:string;
}


//wait 2 minutes for pending intents to connect
const pendingTimeout : number = 2 * 60 * 1000;
//collection of queued intents to apply to tabs when they connect
let pending_intents : Array<Pending> = [];
//collection of queud contexts to apply to tabs when they connect
let pending_contexts : Array<Pending> = [];
//collection of queued channels 
let pending_channels : Array<Pending> = [];

//map of pending contexts for specific app instances 
const pending_instance_context : Map<string, Map<string, any>> = new Map();

// map of all running contexts keyed by channel 
const contexts : Map<string,Array<Context>> = new Map([["default",[]]]);

//map of listeners for each context channel
const contextListeners : Map<string,Map<string,Listener>> = new Map([["default",new Map()]]);
//make a separate map of instance listeners, 
//this would just be for handling point-to-point context transfer
const instanceListeners : Map<string, Map<string,Listener>> = new Map();

//intent listeners (dictionary keyed by intent name)
const intentListeners : Map<string,Map<string,Listener>>  = new Map();

//collection of app channel ids
const app_channels : Array<Channel> = [];

//track tab channel membership (apps can disconnect and reconnect, but tabs and channel membership persist)
const tabChannels : Map<number, string> = new Map();

const initContextChannels = (channels : Array<Channel>) => {
    //initialize the active channels
    //need to map channel membership to tabs, listeners to apps, and contexts to channels
    channels.forEach(chan => {
        contextListeners.set(chan.id, new Map());
        contexts.set(chan.id, []);
    });
};

/**
 * 
 * drop all of the listeners for an app (when disconnecting)
 */
const dropContextListeners = (appId : string) => {
    //iterate through the listeners dictionary and delete any associated with the tab (appId)
    Object.keys(contextListeners).forEach(channel =>{
        const channelMap = contextListeners.get(channel);
        channelMap.forEach((listener, key) => {
            if (listener.appId === appId){
                channelMap.delete(key);
            }
        });
    }); 
};

const setIntentListener = (intent : string, listenerId : string, appId : string) => {
    if (!intentListeners.has(intent)){
        intentListeners.set(intent, new Map()); 
    }
    intentListeners.get(intent).set(listenerId, {appId:appId, listenerId:listenerId}); 
};

/**
 * 
 * @param context - context type
 * @param target  - app identifier
 * 
 * Returns a map of all active intent listeners for a specific context type
 */
const getIntentListenersByContext = (context : string, target? : string) : Map<string,Array<ConnectedApp>> => {
    const result : Map<string, Array<ConnectedApp>> =  new Map();
    
    //iterate through all registered apps
    //match on context for the intents for the entry
    utils.getAllConnected().forEach((item : ConnectedApp) => {
        const entry = item.directoryData;
        if (entry && entry.intents){
            //iterate through the inents
            entry.intents.forEach(entryIntent => {
                const intent = entryIntent.name;
                if (entryIntent.contexts.indexOf(context) > -1){
                    if (!result.has(intent)){
                        result.set(intent, []);
                    }
                    result.get(intent).push(item)
                }

            });
        }
    });
    /*
    intentListeners.forEach((listeners : Map<string, Listener>, value : string) => {
        const intent: string = value;
        const listenerArray : Array<Listener> = [];
        console.log("getIntentListenersByContext",context, target);
        listeners.forEach((listener, key) => {
            console.log("listener", listener);
            const entry = utils.getConnected(listener.appId).directoryData;
            console.log("entry", entry);
            //we need the entry to match on context

        } );
        result.set(intent, listenerArray);

        }); */   
    
    return result;

};

const getIntentListeners = (intent : string, target? : string) : Map<string,Listener> => {
    const result : Map<string, Listener> = intentListeners.get(intent);
 
    //if a target is provided, filter by the app name
    if (target && result) {
        result.forEach((listener, key) => {
            const entry = utils.getConnected(listener.appId).directoryData;
            if (entry && entry.name !== target){
                result.delete(key);
            }
        } );
    }
    return result;

};

//removes all intent listeners for an endpoiont
const dropIntentListeners = (port : chrome.runtime.Port) => {
    //iterate through the intents and cleanup the listeners...
    const pId : string = utils.id(port);
    intentListeners.forEach((listenerMap) =>{
        listenerMap.forEach((listener, key) => {
            if (listener.appId === pId){
                listenerMap.delete(key);
           }
        });
    });
   /* Object.keys(intentListeners).forEach(key => {
        let lKeys = Object.keys(intentListeners[key]);
        lKeys.forEach(k => {
            if (intentListeners[key][k].appId === pId){
                delete intentListeners[key][k];
            }
        });
           
        
    });*/
};

const getTabChannel = (id : number) : string => {
    return tabChannels.get(id);
};

const open = async (msg : FDC3Message, port : chrome.runtime.Port) => {
    return new Promise(async (resolve, reject) => {
        let start_url = msg.data ? msg.data.start_url : undefined;
        const target : TargetApp = msg.data.target;
        const name : String =  typeof(target) === "string" ? target : (target as AppMetadata).name; 
        const source = utils.id(port);
        /**
         * To DO: Determine any future handling for AppMetadata in looking up an app
         * 
         */
        if (! start_url){
            const directoryUrl = await utils.getDirectoryUrl();
            console.log("open app", `${directoryUrl}/apps/${name}`);
            const result = await fetch(`${directoryUrl}/apps/${name}`);
            
            if (result) {
                const r = await result.json();
                start_url = r.start_url;
            }
        }
        if (start_url) {
            try {
             //   const r = await result.json();
                //todo: get the manifest...
               // if (r && r.start_url){
                   
                    chrome.tabs.create({url:start_url},tab =>{
                        //autojoin the new app to the channel which the 'open' call is sourced from
                        if (msg.data.autojoin){
                            //get channel from current port context
                            let _id = utils.id(port);
                            let c = utils.getConnected(_id);
                            //get the previous channel
                            let channel = c.channel
                            //set the pending channel newly opened window
                            setPendingChannel(tab.id, source, channel);
                        }
                        if (msg.data.context){
                            setPendingContext(tab.id, source, msg.data.context);
                        }
                        resolve({result:true, tab:tab.id});
                    });
                    
              //  }
            //   
        
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

const getCurrentContext = (msg : FDC3Message, port : chrome.runtime.Port) : Promise<Context>  => {
    return new Promise((resolve, reject) => {
        const channel = msg.data.channel;
        const type = msg.data.contextType;
        let ctx : Context = null; 
        if (channel){
            if (type){
                ctx = contexts.get(channel).find(c => {
                    return c.type === type;
                });
            }
            else {
                ctx = contexts.get(channel)[0] ? contexts.get(channel)[0] : ctx;
            }
        }
        resolve(ctx);
    });
};

const addContextListener = (msg : FDC3Message, port : chrome.runtime.Port) => {
    return new Promise((resolve, reject) => {
        const source = utils.id(port); //this is the app instance calling addContextListener
        const c = utils.getConnected(source);
       
        //if there is an instanceId specified, this call is to listen to context from a specific app instance
        //this then goes to a separate map
        const instanceId = msg.data.instanceId;
        if (instanceId){
            console.log("addContextLister ",instanceId, instanceListeners, pending_instance_context);
            //is there already an entry for the instanceId?
            //if not, initialize one
            if (!instanceListeners.has(source)){
                instanceListeners.set(source, new Map());
            }
            console.log("set listener for message ", msg);
            instanceListeners.get(source).set(instanceId,{
                listenerId:msg.data.id,
                appId:utils.id(port), //should this be the context of the source (setting handler) or the target (app we're listening to context from?)
                contextType:msg.data.contextType, 
                isChannel:false});
            
            //check for pending contexts from the instance

            if (pending_instance_context.has(source) && pending_instance_context.get(source).has(instanceId)){
                //first cleanup anything old
              //  let n = Date.now();
              //  pending_contexts = pending_contexts.filter(i => {
               //     return n - i.ts < pendingTimeout;
              //  });
                //match on instanceId and source
               /* pending_contexts.forEach((pContext, index) => {
                   
                    let portTabId = port.sender.tab.id;
                    if (pContext.tabId === portTabId){ //&& (!msg.data.contextType || (msg.data.contextType && msg.data.contextType === pContext.context.type))){
                        console.log("applying pending context", pContext);   
                        //iterate through each of the registered context listeners, match on context type
                        //let listenerKeys = Object.keys(contextListeners[channel]);
                        instanceListeners.get(instanceId).forEach((l, k) => {
                            if (!l.contextType || (l.contextType && l.contextType === pContext.context.type)){
                                port.postMessage({"topic":"context", "data":{"context": pContext.context,"listenerId":k}, source:pContext.source});    
                                utils.bringToFront(port.sender.tab); 
                                //remove the applied context
                                pending_contexts.splice(index,1);
                            }
                        });
                        
                    }
                });*/
                port.postMessage( {"topic":"context", "data":pending_instance_context.get(source).get(instanceId), source:source});    
                //remove the pennding message
                pending_instance_context.get(source).delete(instanceId);
                if (pending_instance_context.get(source).size === 0){
                    pending_instance_context.delete(source);
                }
            }
            resolve(true);
        }

        //use channel from the event message first, or use the channel of the sending app, or use default
        const channel = msg.data !== null && msg.data.channel ? msg.data.channel : (c && c.channel) ? c.channel : "default";
       
        //distinguish "channel listeners" - set on the Channel directly and not movable with channel membership and not subject to default rules
        contextListeners.get(channel).set(msg.data.id,  {
            appId:utils.id(port),
            listenerId:msg.data.id,
            contextType:msg.data.contextType, 
            isChannel:(msg.data.channel != null)});

        if (pending_contexts.length > 0){
            //first cleanup anything old
            let n = Date.now();
            pending_contexts = pending_contexts.filter(i => {
                return n - i.ts < pendingTimeout;
            });
            //next, match on tabId and intent
            pending_contexts.forEach((pContext, index) => {
               
                let portTabId = port.sender.tab.id;
                if (pContext.tabId === portTabId){ //&& (!msg.data.contextType || (msg.data.contextType && msg.data.contextType === pContext.context.type))){
                    console.log("applying pending context", pContext);   
                    //iterate through each of the registered context listeners, match on context type
                    //let listenerKeys = Object.keys(contextListeners[channel]);
                    contextListeners.get(channel).forEach((l, k) => {
                        if (!l.contextType || (l.contextType && l.contextType === pContext.context.type)){
                            port.postMessage({"topic":"context", "data":{"context": pContext.context,"listenerId":l.listenerId}, source:pContext.source});    
                            utils.bringToFront(port.sender.tab); 
                            //remove the applied context
                            pending_contexts.splice(index,1);
                        }
                    });
                    
                }
            });
    
            
        }
        resolve(true);
    });
   
};

//drop an individual listener when it is unsubscribed
const dropContextListener = (msg : FDC3Message, port : chrome.runtime.Port) => {
        const id = msg.data.id;
        //find the listener in the dictionary and delete
        Object.keys(contextListeners).forEach(channel =>{
            const channelList = contextListeners.get(channel);
            if (channelList.has(id)){
                channelList.delete(id);
            }
          
            });
};

//drop an individual listener when it is unsubscribed
const dropIntentListener = (msg : FDC3Message, port : chrome.runtime.Port) => {
    const id = msg.data.id;
    //find the listener in the dictionary and delete
    intentListeners.forEach((intentList) => {
        if (intentList.has(id)){
            intentList.delete(id);
        }
    } );
   /* Object.keys(intentListeners).forEach(intent =>{
        let intentList = intentListeners[msg.data.intent];
        if (intentList[id]){
            delete intentList[id];
        }
      
        });*/
};

//keep array of pending, id of the tab,  store intent & context, timestamp
//when a new window connects, throw out anything more than 2 minutes old, then match on url
//when a match is found, remove match from the list, send intent w/context, and bring to front

const setPendingIntent =function(tabId : number, source : string, intent : string, context? : Context){
  pending_intents.push(new Pending(tabId, source, {intent:intent, context:context}));
};

const setPendingContext =function(tabId : number, source: string, context: Context){
    pending_contexts.push(new Pending(tabId, source, {context:context}));
  };

  const setPendingChannel =function(tabId: number, source: string, channel: string){
    pending_channels.push(new Pending(tabId, source, {channel:channel}));
  };

  const applyPendingChannel = async function(port : chrome.runtime.Port) : Promise<void>{
    return new Promise((resolve, reject) => {
    const thisPort : chrome.runtime.Port = port;

    if (pending_channels.length > 0){
        //first cleanup anything old
        const n = Date.now();
        pending_channels = pending_channels.filter(i => {
            return n - i.ts < pendingTimeout;
        });
        //next, match on tabId and intent
        pending_channels.forEach(async (pChannel, index) => {
           
            const portTabId = thisPort.sender.tab.id;
            if (pChannel.tabId === portTabId){
                console.log("applying pending channel", pChannel);  
                //send a message back to the content script - updating its channel...
                thisPort.postMessage({topic:"setCurrentChannel",data:{channel:pChannel.channel}});  
                await joinPortToChannel(pChannel.channel,thisPort);
                //utils.bringToFront(port.sender.tab); 
                //remove the applied context
                pending_channels.splice(index,1);
                resolve();
            }
        });

        
    }
    else {
        //is the 'global' channel set as default?
        chrome.storage.sync.get(["default_global"], async (items) => {
            if (items.default_global) {
                console.log("global channel is set to default");
                //send a message back to the content script - updating its channel...
                port.postMessage({topic:"setCurrentChannel",data:{channel:"global"}});  
                await joinPortToChannel("global",thisPort);
    
                
            }
            resolve();   
        });
    }
    });
};


const addIntentListener = (msg : FDC3Message, port : chrome.runtime.Port) : Promise<void> => {
    return new Promise((resolve, reject) =>{
        let name = msg.data.intent;
        let listenerId = msg.data.id;
        setIntentListener(name, listenerId, utils.id(port));
        //check for pending intents

        if (pending_intents.length > 0){
            
            //first cleanup anything old
            let n = Date.now();
            
            pending_intents = pending_intents.filter(i => {
                return (n - i.ts) < pendingTimeout;
            });
            //next, match on tab and intent
            pending_intents.forEach((pIntent, index) => {
                //removing trainling slashes from the sender.url...
                let portTabId = port.sender.tab.id;
                
                if (pIntent.tabId === portTabId && pIntent.intent === name){
                    console.log("applying pending intent", pIntent);    
                    //refactor with other instances of this logic
                    port.postMessage({"topic":"intent", "data":{"intent":pIntent.intent, "context": pIntent.context}, "source":pIntent.source});    
                    //bringing the tab to front conditional on the type of intent
                    if (! utils.isDataIntent(pIntent.intent)){
                        utils.bringToFront(port.sender.tab);
                    }
                    //remove the applied intent
                    pending_intents.splice(index,1);
                }
            });
    
            
        }
        resolve();
    });

};

const dispatchContext = (listener : Listener, listenerId : string, msg : FDC3Message) => {
  //filter for contextType - if defined
  if (!listener.contextType || (listener.contextType && listener.contextType === msg.data.context.type)){
                         
    //mixin the listenerId
    const data = {"listenerId":listenerId, "eventId":msg.data.eventId, "ts":msg.data.ts, "context":msg.data.context};
    if (utils.getConnected(listener.appId) && utils.getConnected(listener.appId).port){
        utils.getConnected(listener.appId).port.postMessage({topic:"context", listenerId:listenerId, data:data, source:msg.source});
    }

    }
}

const broadcast = (msg : FDC3Message, port : chrome.runtime.Port): Promise<void> => {
    return new Promise((resolve, reject) => {
        const sourceId : string = utils.id(port);
        //add the source to the message
        msg.source = sourceId;
        let c = utils.getConnected((sourceId));

        //if there is an instanceId provided on the message - this is the instance target of the broadcast
        //meaning this is a point-to-point com between two instances
        //if the target listener is registered for the source instance, then dispatch the context
        //else, add to the pending queue for instances
        const targetId :string = msg.data.instanceId;
        if (targetId){
            console.log(`broadcast message = '${JSON.stringify(msg)}' target = '${targetId}' source = '${sourceId}'`);
            let setPending : boolean = true;
            if (instanceListeners.has(targetId)){
                const listeners : Map<string, Listener> = instanceListeners.get(targetId);
                
                if (listeners.has(sourceId)){
                    const listener : Listener = listeners.get(sourceId);
                    dispatchContext(listener, listener.listenerId, msg);
                   
                    setPending = false;
                } /*else {
                    //otherwise, iterate through any listeners for the source instance and apply
                    listeners.forEach((l,k) => {
                        dispatchContext(l,k,msg);
                    });
                
                }*/
            }// else {
                //add to pending instance context
            //}
            if (setPending){
                //if there is no entry for the target yet, initialize
                if (!pending_instance_context.has(targetId)){
                    pending_instance_context.set(targetId, new Map());
                }
                pending_instance_context.get(targetId).set(sourceId,msg);
            }
            //if we have a target, we aren't going to go to other channnels - so resolve
            resolve();
        }

        //use channel on message first - if one is specified
        let channel = msg.data.channel ? msg.data.channel : c.channel ? c.channel : "default";
        if (channel !== "default"){
            //is the app on a channel?
            // update the channel state
            contexts.get(channel).unshift(msg.data.context);

            //broadcast to listeners
            //match specific listeners on contextType and push context messages for specific listeners
            //do not broadcast if the channel is "default" - this means "off"
            //match each app only once - there can be multiple listeners registered for an app - we only care if valid listeners > 0
            //if (channel !== "default"){
               // let keys = Object.keys(contextListeners[channel]);
                let matched = [];
              //  keys.forEach(k => {
                if (contextListeners.get(channel).size > 0){
                  contextListeners.get(channel).forEach((l,k) => {
                   // let l = contextListeners[channel][k];
                    if (!l.contextType || (l.contextType && l.contextType === msg.data.context.type)){
                        
                        if (channel !== "default" ){
                            //mixin the listenerId
                            const data = {"listenerId":l.listenerId, "eventId":msg.data.eventId, "ts":msg.data.ts, "context":msg.data.context};
                            if (utils.getConnected(l.appId) && utils.getConnected(l.appId).port){
                                utils.getConnected(l.appId).port.postMessage({topic:"context", listenerId:l.listenerId, data:data, source:msg.source});
                            }
                        }
                    }
                });
                }  
            }
        resolve();
    });
};

const raiseIntent = async (msg: FDC3Message, port : chrome.runtime.Port) : Promise<any> => {
    return new Promise(async (resolve, reject) => {
        const r : Array<FDC3App> = [];

        //handle the resolver UI closing
        port.onMessage.addListener(async (msg : FDC3Message) => {
            if (msg.topic === "resolver-close"){
                resolve(null);
            }
        });

        //decorate the message with source of the intent
        msg.source = utils.id(port);

        //add dynamic listeners from connected tabs
        let intentListeners = getIntentListeners(msg.data.intent, msg.data.target);
        console.log("intentListeners",intentListeners);
        if (intentListeners) {
           // let keys = Object.keys(intentListeners);
           intentListeners.forEach((id) => {
                //look up the details of the window and directory metadata in the "connected" store
                let connect = utils.getConnected(id.appId);
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
        /**
         * To Do: Support additional AppMetadata searching (other than name)
         */
        const target : TargetApp = msg.data.target;
        const name : String  =  target ? (typeof(target) === "string" ? target : (target as AppMetadata).name) : ""; 
        const directoryUrl = await utils.getDirectoryUrl();
        const _r = await fetch(`${directoryUrl}/apps/search?intent=${msg.data.intent}&context=${ctx}&name=${name}`);
        if (_r){ 
            let data = null;
            try {
                data = await _r.json();
            }
            catch (err){
                console.log("error parsing json", err);
            }

            if (data){
                data.forEach((entry : DirectoryApp) => {
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
                    
                    r[0].details.port.postMessage({topic:"intent", data:msg.data, source:msg.source});
                    //bringing the tab to front conditional on the type of intent
                    if (! utils.isDataIntent(msg.data.intent)){
                        utils.bringToFront(r[0].details.port);
                    }
                    
                    let id = utils.id(r[0].details.port);
                    resolve({result:true, source:id, version:"1.0"});
                } else if (r[0].type === "directory"){
                    let start_url = r[0].details.directoryData.start_url;
                    let pending = true;

                    
                        //let win = window.open(start_url,"_blank");
                        chrome.tabs.create({url:start_url},tab =>{
                            //set pending intent for the tab...
                            if (pending){
                                setPendingIntent(tab.id, msg.source, msg.data.intent, msg.data.context);
                            }
                            let id = utils.id(port, tab);
                            resolve({result:true, source:id, version:"1.0", tab:tab.id});
                        });
                        //send the context - if the default start_url was used...
                        //get the window/tab...
                        // resolve({result:true});
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


const raiseIntentForContext = async (msg: FDC3Message, port : chrome.runtime.Port) : Promise<any> => {
    console.log("raiseIntentForContext", msg);
    return new Promise(async (resolve, reject) => {
        const r : Array<FDC3App> = [];

        //handle the resolver UI closing
        port.onMessage.addListener(async (msg : FDC3Message) => {
            if (msg.topic === "resolver-close"){
                resolve(null);
            }
        });

        //decorate the message with source 
        msg.source = utils.id(port);

        //add dynamic listeners from connected tabs
        /**
         * rather than looking for intent listeners and mathing on intent
         * loop through active intent listeners and match on context
         * this returns a map of intents and apps (with matching context listeners)
         */
        const context = msg.data.context && msg.data.context.type ? msg.data.context.type : "";
       
        const intentListeners = getIntentListenersByContext(context, msg.data.target);
        console.log("intentListeners",intentListeners);
        if (intentListeners) {
           // let keys = Object.keys(intentListeners);
           intentListeners.forEach((listeners : Array<ConnectedApp>, intent : string) => {
                //look up the details of the window and directory metadata in the "connected" store
                listeners.forEach(listener => {
                   // const connect : FDC3AppDetail= utils.getConnected(listener.appId);
                    //connect.intent = intent;
                    //decorate with the intent
                  
                    //de-dupe               
                    if (!r.find(item => {
                        return item.details.port.sender.tab.id === listener.port.sender.tab.id;})){
                        r.push({type:"window",details:listener});
                    }
                });
            });
        }
        
        /**
         * To Do: Support additional AppMetadata searching (other than name)
         */
        const target : TargetApp = msg.data.target;
        const name : String  =  target ? (typeof(target) === "string" ? target : (target as AppMetadata).name) : ""; 
        const directoryUrl = await utils.getDirectoryUrl();
        
        const _r = await fetch(`${directoryUrl}/apps/search?context=${context}&name=${name}`);
        if (_r){ 
            let data = null;
            try {
                data = await _r.json();
            }
            catch (err){
                console.log("error parsing json", err);
            }

            if (data){
                data.forEach((entry : DirectoryApp) => {
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
                    
                    r[0].details.port.postMessage({topic:"intent", data:msg.data, source:msg.source});
                    //bringing the tab to front conditional on the type of intent
                    if (! utils.isDataIntent(msg.data.intent)){
                        utils.bringToFront(r[0].details.port);
                    }
                    
                    let id = utils.id(r[0].details.port);
                    resolve({result:true, source:id, version:"1.0"});
                } else if (r[0].type === "directory"){
                    let start_url = r[0].details.directoryData.start_url;
                    let pending = true;

                    
                        //let win = window.open(start_url,"_blank");
                        chrome.tabs.create({url:start_url},tab =>{
                            //set pending intent for the tab...
                            if (pending){
                                setPendingIntent(tab.id, msg.source, msg.data.intent, msg.data.context);
                            }
                            let id = utils.id(port, tab);
                            resolve({result:true, source:id, version:"1.0", tab:tab.id});
                        });
                        //send the context - if the default start_url was used...
                        //get the window/tab...
                        // resolve({result:true});
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

                const eventId = `resolveIntent-${Date.now()}`;

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
                        "message": "context_resolver", 
                        "eventId": eventId,
                        "data":buildIntentInstanceTree(r), 
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


const resolveIntent = async (msg : FDC3Message, port : chrome.runtime.Port) : Promise<any> => {
    return new Promise(async (resolve, reject) => {
        //find the app to route to
        const sType = msg.selected.type;
        const sPort = msg.selected.details.port;
        const source = utils.id(port);
        if (sType === "window"){
            let listeners = getIntentListeners(msg.intent);
            //let keys = Object.keys(listeners);
            let appId : string = null;
            const id = utils.id(sPort);
            listeners.forEach((listener)=> {
                if (listener.appId === id){
                    appId = listener.appId;
                }
            });
           
            if (appId){
                console.log("send intent from source", source);
                utils.getConnected(appId).port.postMessage({topic:"intent", data:{intent:msg.intent, context: msg.context}, source:source});    
                //bringing the tab to front conditional on the type of intent
                if (! utils.isDataIntent(msg.intent)){
                    utils.bringToFront(appId); 
                }
                let id = utils.id(sPort);
                resolve({source:id, version:"1.0", tab:sPort.sender.tab.id});
            }
            
        }
        else if (sType === "directory"){
            let start_url = msg.selected.details.directoryData.start_url;
            let appName = msg.selected.details.directoryData.name;
            let pending = true;

          
                chrome.tabs.create({url:start_url},tab =>{
                    //set pending intent for the tab...
                    if (pending){
                        setPendingIntent(tab.id, source, msg.intent, msg.context);
                    }
                    let id = utils.id(port,tab);
                    resolve({result:true, tab:tab.id, source:id, version:"1.0"});
                });
                //keep array of pending, id by url,  store intent & context, timestamp
                //when a new window connects, throw out anything more than 2 minutes old, then match on url
                //when a match is found, remove match from the list, send intent w/context, and bring to front
    
        
                }
            });
};


const joinPortToChannel = (channel : string, port : chrome.runtime.Port, restoreOnly? : boolean) : Promise<void> => {
    return new Promise((resolve, reject) => {
    let chan = channel;
    let source = utils.id(port);
    let c = utils.getConnected(source);
    //get the previous channel
    let prevChan = c.channel ? c.channel : "default";
    //are the new channel and previous the same?  then no-op...
    if (prevChan !== chan){
         //iterate through the listeners
       // let prevKeys = Object.keys(contextListeners[prevChan]);
      //  prevKeys.forEach(k => {
          contextListeners.get(prevChan).forEach((l, k) => {
            //remove listener from previous channel...
           // let l = contextListeners[prevChan][k];
            if (l.appId === source){
                //add listener to new channel
                //make sure there's a dictionary for the channel first...
                if (!contextListeners.has(chan)){
                    contextListeners.set(chan,new Map());
                }
                contextListeners.get(chan).set(k, {appId:source,listenerId:k});
                //and delete from old
                contextListeners.get(prevChan).delete(k);
            } 

            

        });
        
        c.channel = chan;
        tabChannels.set(port.sender.tab.id, chan);

        //update the UI for the color picker in the extension UI
        //if the joined channel is the special "default" identiefier or NOT a system channel, then skip this part
        const channels : Array<Channel> = utils.getSystemChannels();
        const selectedChannel = channels.find((_chan :Channel) => {return _chan.id === chan;});
        if (chan === "default" || typeof(selectedChannel) !== "undefined"){
            //set the badge state
            const bText = (chan === "default") ? "" : (chan === "global") ? "G" : "+";
            chrome.browserAction.setBadgeText({text:bText,tabId:port.sender.tab.id});    
        
            const color = selectedChannel && selectedChannel.displayMetadata && selectedChannel.displayMetadata.color ? selectedChannel.displayMetadata.color : null;
            if (color !== null){
            chrome.browserAction.setBadgeBackgroundColor({color:color,
                tabId:port.sender.tab.id});
            }
        }
        //push current channel context 
        //if there is a context...
        if (! contexts.has(chan)){
            contexts.set(chan,[]);
        }
        const ctx = contexts.get(chan)[0];
        let contextSent : boolean = false;
        if (ctx && !restoreOnly){
            // send to individual listenerIds
           // let listenerKeys = Object.keys(contextListeners[chan]);
            
            //if (listenerKeys.length > 0){
            //    listenerKeys.forEach(k => {
                contextListeners.get(chan).forEach((l,k) => {
                    //let l = contextListeners[chan][k];
                    if ((l.appId === source) && !l.contextType || (l.contextType && l.contextType === ctx.type)){
                        port.postMessage({"topic":"context", "data":{"context": ctx,"listenerId":k}, "source":source});  
                        contextSent = true;  
                    }
                });
           // }
            if (!contextSent){
                setPendingContext(port.sender.tab.id, source, contexts.get(chan)[0]);
            }
        }
        resolve();
        //port.postMessage({topic:"context", data:{context:contexts[chan][0]}});
    }
    });
};

const joinChannel = async (msg : FDC3Message, port : chrome.runtime.Port) => {
    console.log("joinChannel", msg);
    return new Promise(async (resolve, reject) => {
        await joinPortToChannel(msg.data.channel,port, msg.data.restoreOnly);
        resolve(true);
    });
};

const getSystemChannels = async (msg : FDC3Message, port : chrome.runtime.Port) => {
    return new Promise(async (resolve, reject) => {
        resolve(utils.getSystemChannels());
    });
};

//generate / get full channel object from an id - returns null if channel id is not a system channel or a registered app channel
const getChannelMeta = (id : string) : Channel => {
    let channel : Channel = null;
    //is it a system channel?
    const sChannels : Array<Channel> = utils.getSystemChannels();
    let sc = sChannels.find(c => {
        return c.id === id;
    });

    if (sc){
        channel = {id:id, type:"system", displayMetadata:sc.displayMetadata};
    }
    //is it already an app channel?
    if (! channel){
        let ac = app_channels.find(c => {
            return c.id === id;
        });
        if (ac) {
            channel = {id:id, type:"app"};
        }
    } 
    return channel;
};

const getOrCreateChannel = async (msg : FDC3Message, port : chrome.runtime.Port) : Promise<any> => {
    return new Promise(async (resolve, reject) => {
        const id = msg.data.channelId;
        //reject with error is reserved 'default' term
        if (id === "default"){
            reject(utils.ChannelError.CreationFailed);
        }
        else {
            let channel : Channel = getChannelMeta(id);
        
            //if not found... create as an app channel
            if (! channel){
                channel = {id:id, type:"app"};
                //add an entry for the context listeners
                contextListeners.set(id, new Map());
                contexts.set(id, []);
                app_channels.push(channel);
            }
            resolve(channel);
        }
    });
};

const getCurrentChannel = async (msg : FDC3Message, port : chrome.runtime.Port) : Promise<any>=> {
    return new Promise(async (resolve, reject) => {
        const c = utils.getConnected(utils.id(port));
        //get the  channel
        let chan = c.channel ? getChannelMeta(c.channel) : null;
        resolve(chan);
    });
};

const getAppInstance = async (msg : FDC3Message, port : chrome.runtime.Port) : Promise<any> => {
    return new Promise(async (resolve, reject) => {
        const id = msg.data.instanceId;
        //if the instance exists, status is 'ready' - if it does not, status is 'unregistered' if it exists, but can't respond, status is 'loading'
        const instance = utils.getConnected(id);
        // set up needed handlers for the instance
        // resolve with the instanceId && status
        resolve({instanceId:id,status:"ready"});
    });
}

const leaveCurrentChannel = async (msg : FDC3Message, port : chrome.runtime.Port) : Promise<void> => {
    return new Promise(async (resolve, reject) => {
        //'default' means we have left all channels
        joinPortToChannel("default", port);
        resolve();
    });
};

// returns a single AppIntent:
// {
//     intent: { name: "StartChat", displayName: "Chat" },
//     apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
// }
const findIntent = async (msg : FDC3Message, port : chrome.runtime.Port) : Promise<any> => {
    return new Promise(async (resolve, reject) => {
        let intent = msg.data.intent;
        let context = msg.data.context;
        if (intent){
            const directoryUrl = await utils.getDirectoryUrl();
            let url = `${directoryUrl}/apps/search?intent=${intent}`;
            if (context){
                //only use type
                if (typeof context === "object"){
                    context = context.type;
                }
                url+= `&context=${context}`;
            }
            try {
            const _r = await fetch(url);
            const j : Array<DirectoryApp> = await _r.json();
            const r : AppIntent = {intent:{name:"",displayName:""}, apps:[]};

           // r.apps = j;
           //find intent display name from app directory data
            const intnt = j[0].intents.filter(i => {return i.name === intent;});
            if (intnt.length > 0){
                r.intent.name = intnt[0].name;
                r.intent.displayName = intnt[0].display_name;
            }
            j.forEach((dirApp) => {
                r.apps.push({name:dirApp.name, 
                        title:dirApp.title,
                        description:dirApp.description,
                        icons:dirApp.icons.map((icon) => {return icon;})});
            });
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

/**
 * create a heirarchy of AppMetadata grouped by intents
 */
const buildIntentAppTree = (data : Array<FDC3App>) : Array<AppIntent> => {
    const r : Array<AppIntent> = [];
    console.log("buildIntentAppTree",data);
    if (data){
        const found : Map<string,Array<AppMetadata>> = new Map();
        let intents : Array<IntentMetadata>= [];
        data.forEach(item => {
            const appMeta : AppMetadata = {name:item.details.directoryData.name, 
                title:item.details.directoryData.title,
                description:item.details.directoryData.description,
                icons:item.details.directoryData.icons.map((icon) => {return icon;})};

            item.details.directoryData.intents.forEach(intent => {
                if (!found.has(intent.name)){
                    intents.push({name:intent.name,displayName:intent.display_name});
                    found.set(intent.name,[appMeta])
                    
                }
                else {
                    found.get(intent.name).push(appMeta);
                }
            });
        });

        intents.forEach(intent =>{
            const entry : AppIntent = {intent:intent,apps:found.get(intent.name)};
            r.push(entry);
        });
    }
    return r;
}


/**
 * create a heirarchy of App Instances grouped by intents
 */
const buildIntentInstanceTree = (data : Array<FDC3App>) : Array<IntentInstance> => {
    const r : Array<IntentInstance> = [];
    console.log("buildIntentInstanceTree",data);
    if (data){
        const found : Map<string,Array<FDC3App>> = new Map();
        let intents : Array<IntentMetadata>= [];
        data.forEach(item => {

            item.details.directoryData.intents.forEach(intent => {
                if (!found.has(intent.name)){
                    intents.push({name:intent.name,displayName:intent.display_name});
                    found.set(intent.name,[item])
                    
                }
                else {
                    found.get(intent.name).push(item);
                }
            });
        });

        intents.forEach(intent =>{
            const entry : IntentInstance = {intent:intent,apps:found.get(intent.name)};
            r.push(entry);
        });
    }
    return r;
}

// returns, for example:
// [{
//     intent: { name: "StartCall", displayName: "Call" },
//     apps: [{ name: "Skype" }]
// },
// {
//     intent: { name: "StartChat", displayName: "Chat" },
//     apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
// }];
const findIntentsByContext = async (msg : FDC3Message, port : chrome.runtime.Port) : Promise<Array<AppIntent>> => {
    return new Promise(async (resolve, reject) => {
        let context = msg.data.context;
        if (context.type){
            context = context.type;
        }    
        if (context){
            const directoryUrl = await utils.getDirectoryUrl();
            const url = `${directoryUrl}/apps/search?context=${context}`;   
            const _r = await fetch(url);
            const d : Array<DirectoryApp> = await _r.json();
            const apps : Array<FDC3App> = d.map(app => {
                return ({  type:"directory", 
                            details:{directoryData:app}
                        } as FDC3App);});
            resolve(buildIntentAppTree(apps));
        }
        else {
            reject("no context provided");
        }
    });
};

const getTabTitle = (msg : FDC3Message, port : chrome.runtime.Port) : Promise<void> => {
    return new Promise((resolve, reject) => {
        const id = msg.tabId;
        chrome.tabs.sendMessage(id, {"message": "get-tab-title"}, function(r){
            port.postMessage({topic:"tabTitle",
                                tabId:id,
                            data:{title:r}});
            resolve();
        });
    });
};


export default { 
    open,
    addContextListener,
    addIntentListener,
    initContextChannels,
    dropContextListeners,
    dropContextListener,
    dropIntentListeners,
    dropIntentListener,
    broadcast,
    raiseIntent,
    resolveIntent,
    joinChannel,
    getTabTitle,
    getTabChannel,
    findIntent,
    findIntentsByContext,
    getCurrentContext,
    getSystemChannels,
    getOrCreateChannel,
    applyPendingChannel,
    getCurrentChannel,
    leaveCurrentChannel,
    getAppInstance,
    raiseIntentForContext
};