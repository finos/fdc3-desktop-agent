import channels from "./system-channels";
//todo - move system channels to the db

//connected end points / apps
let connected = {};
//intent listeners (dictionary keyed by intent name)
let intentListeners = {};

const getSystemChannels = () => {
    return channels;
};

const setConnected = (id, item) => {
    connected[id] = item;
    //todo - check item shape
    return true;
};

//if id is passed, return that item, if no or false args, return all connected items
const getConnected = (id) => {
    if (id){
        return connected[id];
    }
    else {
        return connected;
    }
};

const dropConnected = (id)=> {
    connected[id] = null;
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


const bringToFront = (id) => {
    return new Promise((resolve, reject) => {
        let _tab = null;
        if (id.windowId && id.id){
            _tab = id;
        }
        else {
            let c = getConnected(id);
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
};

const directoryUrl = "http://www.kolbito.com";

/*export default{
    directoryUrl:,
    getSystemChannels
    setConnected:setConnected,
    getConnected:getConnected,
    dropConnected:dropConnected,
    setIntentListener:setIntentListener,
    getIntentListeners:getIntentListeners,
    dropIntentListeners:dropIntentListeners,
    bringToFront:bringToFront
};*/

export default{
    directoryUrl,
    getSystemChannels,
    setConnected,
    getConnected,
    dropConnected,
    setIntentListener,
    getIntentListeners,
    dropIntentListeners,
    bringToFront
};