/**
 * Desktop Agent Background script
 * this is the singleton controller for most fdc3 business logic including:
 *  - interfacing with the app directory
 *  - managing channels and routing context data
 *  - resolving intents
 *  
 */
import utils from "./utils";
import listeners from "./bg-listeners";
import {EnvironmentData, DirectoryApp} from './types/FDC3Data';
import {FDC3Message} from './types/FDC3Message';


listeners.initContextChannels(utils.getSystemChannels());

//get list of all apps on start up - use this cache only for checking tabs
//refresh the list ~ 1/hr
//add option for manual refresh of the list
const getApps = async () : Promise<Array<DirectoryApp>> => {
    return new Promise( async (resolve, reject) =>{
        let apps : Array<DirectoryApp> = [];
        //check the cache
        chrome.storage.sync.get(["apps_list"], async (items) => {
            let doFetch : boolean = false;
            if (items.apps_list) {
                //get the timestamp
                if (items.apps_list.ts && (Date.now() - items.apps_list.ts > 3600000)){
                   doFetch = true;
                }
            }
            else {
                doFetch = true;        
            }
            if (doFetch){
                const directoryUrl = await utils.getDirectoryUrl();
                const result = await fetch(`${directoryUrl}/apps/`);
                if (result) {
                    apps  = await result.json();
                }
                chrome.storage.sync.set({"apps_list":{ts:Date.now(), data:apps}});
                resolve(apps);
            } else {
                resolve(items.apps_list.data); 
            }
        
        });
    });
};




/*
    When an app (i.e. a new tab) connects to the FDC3 service:
        - determine if it has a corresponding entry in the app directory
        - if it is in appD, fetch it's appD entry - since we are only dealing with webapps, we don't need another manifest to launch
        - add the tab reference plus any appD data to the "connected" dictionary
        - add event listeners for the app
        - send environment data to the app (directory data, channels, etc)
        - for the app, reciept of the environment data will signal that the background script is ready to recieve events from it

*/
chrome.runtime.onConnect.addListener( async (port : chrome.runtime.Port) => {
    const appsList =  await getApps();

    const app_url : URL = new URL(port.sender.url);
    const app_id = utils.id(port);
    const directoryUrl : string = await utils.getDirectoryUrl();
    //envData is the known info we're going to pass back to the app post-connect
    //const envD : EnvironmentData = new EnvironmentData(port.sender.tab.id, listeners.getTabChannel(port.sender.tab.id));

    //check origin against the stored apps list
    
    //see if there was an exact match on origin
    //if not (either nothing or ambiguous), then let's treat this as dynamic - i.e. no directory match
    const lookupData : Array<DirectoryApp> = appsList.filter(async (app: DirectoryApp)=> {
        const dir_url : URL = new URL(app.start_url);
        return app_url.origin === dir_url.origin;
    });
    let match : DirectoryApp = null;
        

    if (lookupData.length === 1){
        match = lookupData[0];       
    }
    else {
        if (lookupData.length === 0){
            console.log("No matching appd entries found");
        } else {
            console.log(`Ambiguous match - ${lookupData.length} items found.`);
            const pathMatch = lookupData.filter(async (d : DirectoryApp) => {
                    const matchUrl = new URL(d.start_url);
                    return app_url.pathname === matchUrl.pathname;
            });
            if (pathMatch.length === 1){
                match = pathMatch[0];
            }
            else if (pathMatch.length > 1) {
                //try matching on urls
                const urlMatch = pathMatch.filter(d => {
                    return  d.start_url === app_url.href;
                });
                if (urlMatch.length === 1){
                    match = urlMatch[0];
                }
                else {
                    console.log("No matching appd entries found");
                }
            }
        }
    }
        

    if (match !== null && match.hasActions){
            
        //if the app has actions defined in the appD, look those up (this is an extension of appD implemented by appd.kolbito.com) 
        //actions automate wiring context and intent handlers for apps with gettable end-points
            console.log("hasActions");
            let actionsR = await fetch(`${directoryUrl}/apps/${match.name}/actions`);

            let actions = await actionsR.json();
            if (actions){
                match.actions = actions;

            }
    }
        
    utils.setConnected({id: app_id, port:port, directoryData:match});
    await listeners.applyPendingChannel(port);
    
    const envD : EnvironmentData = new EnvironmentData(port.sender.tab.id, listeners.getTabChannel(port.sender.tab.id));
    if (match !== null){
        envD.directory = match;
    }
    
    
    port.postMessage({topic:"environmentData", data:envD});

    
    port.onDisconnect.addListener(function(){
        console.log("disconnect",port);
        let id = utils.id(port);
        utils.dropConnected(id);
        //remove context listeners
        listeners.dropContextListeners(id);
        
        //cleanup the listeners...
        listeners.dropIntentListeners(port);
    });

    const wrapListener = async (msg : FDC3Message, port : chrome.runtime.Port, decorator? : Function) => {
        let r = null;

        const topicIndex : number = Object.keys(listeners).indexOf(msg.topic);

        if (topicIndex > -1){
            const topicMethod : Function = Object.values(listeners)[topicIndex];
            try {
                
                const _r = await topicMethod.call(this, msg, port);
                if (decorator){
                    r = decorator.call(this, _r);
                }
                else {
                  r = _r;  
                }
                
            }
            catch (err){
                console.log("error", err);
                r = {error:err};
            }
            //post the return message back to the content script
            if (msg.data !== null && msg.data.eventId){
                port.postMessage({
                        topic:msg.data.eventId,
                        data:r
                })
            }
        }
        else {
            console.log(`no listener found for message topic '${msg.topic}'`);   
        }
    };

    port.onMessage.addListener(async function(msg) {
        wrapListener(msg, port);
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


