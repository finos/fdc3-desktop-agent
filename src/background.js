import utils from "./utils";
import listeners from "./bg-listeners";

//const dirUrl = "http://localhost:3000";

let directory = null;

listeners.initContextChannels(utils.getSystemChannels());

fetch(`${utils.directoryUrl}/apps`).then(_r =>{
                let r = _r.clone();
                r.json().then(data => {
                    directory = data;
                });
});

/*
    When an app (new window/tab) connects to the FDC3 service:
        - determine if it has a corresponding entry in the app directory
            - if it is in appD, fetch it's appD entry plus manifest
        - add the window reference plus any appD data to the "connected" dictionary
        - add event listeners for the app
        - send environment data to the app (directory data, channels, etc)

*/
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
    
    data.currentChannel = listeners.getTabChannel(port.sender.tab.id);

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
    utils.setConnected(app_id,{port:port, directoryData:entry});
    
    port.onDisconnect.addListener(function(){
        console.log("disconnect",port);
        let id = (port.sender.id + port.sender.tab.id);
        utils.dropConnected(id);
        //remove context listeners
        listeners.dropContextListeners(id);
        
        //cleanup the listeners...
        listeners.dropIntentListeners(port);
    });
    port.onMessage.addListener(function(msg) {
       
        switch (msg.method){
            case "open":
                return listeners.open(msg, port).then(r => {return true;});  
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
                    port.postMessage({name:"returnFindIntent",data:r, intent:msg.intent, context:msg.context});    
                });
                break;
            case "findIntentsByContext":
                    return listeners.findIntentsByContext(msg, port).then(r => {
                        port.postMessage({name:"returnFindIntentsByContext",data:r, context:msg.context});    
                    });
                    break;
            default:
                console.error("no handler found for method", msg.method);
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


