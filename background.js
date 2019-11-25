

let directory = null;
//memoize dictionary of manifests
let manifests = {};
//the standard system channels
const systemChannels = {};
//running contexts 
let contexts = {default:[]};

//context listeners
let listeners = [];

fetch("http://localhost:5556/directory.json").then(_r =>{
                let r = _r.clone();
                r.json().then(data => {
                    directory = data;
                });
});


chrome.runtime.onConnect.addListener(function(port) {
    console.assert(port.name == "fdc3");
    port.onMessage.addListener(function(msg) {
        if (msg.method === "open"){
            let result = directory.filter(item => item.name === msg.data.name);
            if (result.length > 0){
                //get the manifest...
                fetch(result[0].manifest).then(mR => {
                    mR.json().then(mD => {
                        let win = window.open(mD.startup_app.url,msg.data.name);
                        win.focus();
                        
                    });
                });
                return true;
            }
        }
        else if (msg.method === "addContextListener"){
            listeners.push(port);
        }
        else if (msg.method === "broadcast"){
            contexts.default.unshift(msg.data.context);
            //broadcast to listeners
            listeners.forEach(l => {
                l.postMessage({name:"context", data:msg.data});
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

