/**
 * shared functions and constants
 */

import channels from "./system-channels";
import {ConnectedApp, Channel} from "./types/FDC3Data";
import {FDC3EventDetail} from "./types/FDC3Event";

const guid = () : string => {
    const gen = (n?:number):string => {
        const rando = () : string => {
            return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        };
        let r = "";
        let i = 0;
        n = n ? n : 1;
        while (i < n){
            r += rando();
            i++;
        }
        return r;
    }
    
    return `${gen(2)}-${gen()}-${gen()}-${gen()}-${gen(3)}`;
    };

const getDirectoryUrl = async() : Promise<string> => {
    return new Promise (async (resolve, reject) => {
    chrome.storage.sync.get(["appd_url"], (items) => {
        const r = (items.appd_url) ? items.appd_url : "https://appd.kolbito.com";
            console.log(r);
            resolve(r);
    });
});
};

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

const ChannelError = {
    NoChannelFound:"NoChannelFound",
    AccessDenied:"AccessDenied",
    CreationFailed:"CreationFailed"
  };

//connected end points / apps
const connected : Map<string, ConnectedApp> = new Map();


const getSystemChannels = () : Array<Channel> => {
    return channels;
};

/**
 * add a new tab to the collection of tracked tabs
 */
const setConnected = (item : ConnectedApp) : boolean => {
    console.log(`set connected id=${item.id} item=${item}`,connected);
    connected.set(item.id, item);
    return true;
};

//if id is passed, return that item, to do:  change signature to array and  return all connected items if no id is passed in
const getConnected = (id : string) : ConnectedApp => {
    return connected.get(id);  
};

const getAllConnected = () : Array<ConnectedApp> => {
    const result : Array<ConnectedApp> = [];
    connected.forEach((item : ConnectedApp, id : string) => {
        result.push(item);
    });
    return result;
};

const dropConnected = (id :string)=> {
    connected.delete(id);
};

/**
 * generates a CustomEvent for FDC3 eventing in the DOM
 * @param type  
 * @param detail  
 */
const fdc3Event = (type:string, detail:FDC3EventDetail) : CustomEvent => {
    return new CustomEvent(`FDC3:${type}`, {detail:detail});
}

/**
 * brings a tab (and window) into focus
 * 
 */
const bringToFront = (id : any) : Promise<chrome.tabs.Tab> => {
    return new Promise((resolve, reject) => {
        let _tab : chrome.tabs.Tab = null;
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
 * 
 * Temporary function to shim not having this metadata in the appD 
 * if the intent is a data intent, then we won't bring it's tab to front when the intent  is resovled
 * @param intentName - name of the intent to check
 */
const isDataIntent = (intentName: string): boolean => {
    //list of known data intents (right now, this is just the genesis demo one)
    const dataIntents: Array<string> = ["genesis.FindFXPrice"]
    return dataIntents.includes(intentName);
};

/**
 * generate an id from a port object
 * this is the identifier used for connection and channel tracking
 */
const id = (port: chrome.runtime.Port, tab? : chrome.tabs.Tab) : string  => {
    
    if (port.sender){
        const t = tab ? tab : port.sender.tab;
        return `${port.sender.id}${t.id}`;
    }
    else {
        return null;
    }
};

export default{
    getDirectoryUrl,
    getSystemChannels,
    setConnected,
    getConnected,
    dropConnected,
    getAllConnected,
    bringToFront,
    OpenError,
    ResolveError,
    ChannelError,
    id,
    guid,
    fdc3Event,
    isDataIntent
};