import utils from "./utils";
import listeners from "./bg-listeners";


listeners.initContextChannels(utils.getSystemChannels());


/*
    When an app (new window/tab) connects to the FDC3 service:
        - determine if it has a corresponding entry in the app directory
            - if it is in appD, fetch it's appD entry plus manifest
        - add the window reference plus any appD data to the "connected" dictionary
        - add event listeners for the app
        - send environment data to the app (directory data, channels, etc)

*/
chrome.runtime.onConnect.addListener(function(port) {
    
    let app_url = new URL(port.sender.url);
    let app_id = (port.sender.id + port.sender.tab.id);
    //envData is the known info we're going to pass back to the app post-connect
    let envD = {};
    envD.currentChannel = listeners.getTabChannel(port.sender.tab.id);
    envD.tabId = port.sender.tab.id;
    //let dMatch = [];
    //look origin up in directory...
    try {
        fetch(`${utils.directoryUrl}/apps/search?origin=${app_url.origin}`).then(_r =>{ 
            _r.json().then(data => {
                //see if there was an exact match on origin
                //if not (either nothing or ambiguous), then let's treat this as dynamic - i.e. no directory match
                let entry = null;
                if (data.length === 1){
                    entry = data[0];
            
                    console.log("entry",entry);
                    //if there is an exact match - we're going to try fetch the manifest 
                    
                    if (entry.manifest){
                        //fetch and bundle environmnet data for the app: app manifest, etc
                        fetch(entry.manifest).then(mR => {

                            mR.json().then(mD => {
                                entry.manifestContent = mD;
                                //port.directoryData = entry;
                                envD.directory = entry;
                                port.postMessage({topic:"environmentData", 
                                data:envD});
                            });
                        });
                    }
                    else {
                    // port.directoryData = entry;
                        envD.directory = entry;
                        port.postMessage({topic:"environmentData", data:envD});
                    }
                    
                    
                    utils.setConnected(app_id,{port:port, directoryData:entry});
                }
                else {
                    if (data.length === 0){
                        console.log("No match appd entries found");
                    } else {
                        console.log(`Ambiguous match - ${data.length} items found.`);
                    }
                    port.postMessage({topic:"environmentData", 
                                data:envD});
                    
                    utils.setConnected(app_id,{port:port, directoryData:null});

                }
            }, e => {
                console.log(`app data could not be parsed for origin ${app_url.origin}`);
                port.postMessage({topic:"environmentData", 
                                data:envD});
                    
                    utils.setConnected(app_id,{port:port, directoryData:null});
            });
        }, _r => {
            console.log(`app data not found for origin ${app_url.origin}`);
            port.postMessage({topic:"environmentData", 
                                data:envD});
                    
                    utils.setConnected(app_id,{port:port, directoryData:null});
        });
    }
    catch (e){
        console.log(`app data not found for origin ${app_url.origin}`);
        port.postMessage({topic:"environmentData", 
                                data:envD});
                    
                    utils.setConnected(app_id,{port:port, directoryData:null});
    }

    
    port.onDisconnect.addListener(function(){
        console.log("disconnect",port);
        let id = (port.sender.id + port.sender.tab.id);
        utils.dropConnected(id);
        //remove context listeners
        listeners.dropContextListeners(id);
        
        //cleanup the listeners...
        listeners.dropIntentListeners(port);
    });
    port.onMessage.addListener(async function(msg) {
       
        switch (msg.topic){
            case "open":
                let r = null;
                try {
                    r = await listeners.open(msg, port);
                }
                catch (err){
                    console.log("error", err);
                    r = false;
                }
                port.postMessage({
                        topic:msg.data.eventId,
                        data:r
                });
                 
                break;
            case "addContextListener":
                return listeners.addContextListener(msg, port).then(r => {return true;});
                break;
            case "addIntentListener":
                return listeners.addIntentListener(msg, port).then(r => {return true;});
                break;
             case "broadcast":
                return listeners.broadcast(msg, port).then(r => {return true;});
                break;
             case "raiseIntent":
                return listeners.raiseIntent(msg, port).then(r => {return true;}); 
                break;
             case "resolveIntent":
                return listeners.resolveIntent(msg, port).then(r => {return true;});
                break;
             case "joinChannel":
                return listeners.joinChannel(msg, port).then(r => {return true;});
                break;  
            case "getTabTitle":
                return listeners.getTabTitle(msg, port).then(r => {return true;});
                break;
            case "findIntent":
                return listeners.findIntent(msg, port).then(r => {
                    port.postMessage({topic:"returnFindIntent",data:r, intent:msg.intent, context:msg.context});    
                });
                break;
            case "findIntentsByContext":
                    return listeners.findIntentsByContext(msg, port).then(r => {
                        port.postMessage({topic:"returnFindIntentsByContext",data:r, context:msg.context});    
                    });
                    break;
            default:
                console.error("no handler found for method", msg.topic);
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


