import channels from "./system-channels";
//todo - move system channels to the db

//connected end points / apps
let connected = {};


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

const directoryUrl = "http://appd.kolbito.com";


export default{
    directoryUrl,
    getSystemChannels,
    setConnected,
    getConnected,
    dropConnected,
    bringToFront
};