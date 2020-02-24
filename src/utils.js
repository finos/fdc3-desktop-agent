/**
 * shared functions and constants
 */

import channels from "./system-channels";


const getDirectoryUrl = async()=> {
    return new Promise (async (resolve, reject) => {
    chrome.storage.sync.get(["appd_url"], (items) => {
        const r = (items.appd_url) ? items.appd_url : "https://appd.kolbito.com";
            console.log(r);
            resolve(r);
    });
});
};

//const directoryUrl = "http://brokenfdc3.com";
//const directoryUrl = "https://appd.kolbito.com";
//const directoryUrl = "http://localhost:3000";

/***
 * Error Objects
 */
const OpenError  = {
    AppNotFound:"AppNotFound",
    ErrorOnLaunch:"ErrorOnLaunch",
    AppTimeout:"AppTimeout",
    ResolverUnavailable:"ResolverUnavailable"
  };

const ResolveError = {
    NoAppsFound:"NoAppsFound",
    ResolverUnavailable:"ResolverUnavailable",
    ResolverTimeout:"ResolverTimeout"
  };


//connected end points / apps
let connected = {};


const getSystemChannels = () => {
    return channels;
};

/**
 * add a new tab to the collection of tracked tabs
 */
const setConnected = (id, item) => {
    console.log(`set connected id=${id} item=${item}`,connected);
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


/**
 * brings a tab (and window) into focus
 * 
 */
const bringToFront = (id) => {
    return new Promise((resolve, reject) => {
        let _tab = null;
        console.log("bringToFront",id);
        if (id.windowId && id.id){
            _tab = id;
        }
        else {
        if (id.sender){
           id = (id.sender.id + id.sender.tab.id);
        }
       
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

/**
 * generate an id from a port object
 * this is the identifier used for connection and channel tracking
 */
const id = (port, tab) => {
    if (port.sender){
        const t = tab ? tab : port.sender.tab;
        return `${port.sender.id}${t.id}`;
    }
    else {
        return false;
    }
};

export default{
    getDirectoryUrl,
    getSystemChannels,
    setConnected,
    getConnected,
    dropConnected,
    bringToFront,
    OpenError,
    ResolveError,
    id
};