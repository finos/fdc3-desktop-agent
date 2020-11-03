
import utils from './utils';
import {DesktopAgent as fdc3DesktopAgent} from './types/fdc3/DesktopAgent';
import {Listener as fdc3Listener} from './types/fdc3/Listener';
import {Channel as fdc3Channel} from './types/fdc3/Channel';
import {AppInstance as fdc3AppInstance} from './types/fdc3/AppInstance';
import {Context} from './types/fdc3/Context';
import {DisplayMetadata} from './types/fdc3/DisplayMetadata';
import {ContextHandler} from './types/fdc3/ContextHandler';
import { IntentResolution } from './types/fdc3/IntentResolution';
import {AppIntent} from './types/fdc3/AppIntent';
import {FDC3Event, FDC3EventDetail, FDC3EventEnum} from './types/FDC3Event';


/**
 * This file is injected into each Chrome tab by the Content script to make the FDC3 API available as a global
 */

function _doFdc3(){


/**
*  the Listener class 
*/
class Listener implements fdc3Listener{

    private id: string;

    type: string;

    intent: string;

    constructor(type: string, listenerId: string, intent?: string){
        this.id = listenerId;
        this.type = type;
        if (type === "intent"){
            this.intent = intent;
        }
    }

    unsubscribe(){
        if (this.type === "context"){
            _contextListeners.delete(this.id);
            //notify the background script
            document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.DropContextListener,{id:this.id}));
        }
        else if (this.type === "intent"){
            _intentListeners.get(this.intent).delete(this.id);
            //notify the background script
            document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.DropIntentListener,{id:this.id, intent:this.intent}));
        }

    }
}

class ListenerItem {

    id : string;
    handler : ContextHandler;
    contextType : string;

    constructor(id:string, handler:ContextHandler, contextType?: string){
        this.id = id;
        this.handler = handler;
        this.contextType = contextType;
    }
}

/**
 * the Channel class 
 */
class Channel implements fdc3Channel {
    id : string;
    type: string;
    displayMetadata : DisplayMetadata;

    constructor(id : string, type : string, displayMetadata : DisplayMetadata){
        this.id = id;
        this.type = type;
        this.displayMetadata = displayMetadata;
    }

    broadcast(context : Context){
        wireMethod("broadcast", {context:context,channel:this.id}, true);
    }

    getCurrentContext(contextType? : string){
        return wireMethod("getCurrentContext",{channel:this.id, contextType:contextType});
    }
   
    addContextListener(handler: ContextHandler ): Listener;
    addContextListener(contextType: string, handler: ContextHandler): Listener;
    addContextListener(contextType : any, handler? : any){
        const thisListener : ContextHandler = arguments.length === 2 ? handler : arguments[0];
        const thisContextType : string = arguments.length === 2 ? contextType : null;
        const listenerId : string = utils.guid();
        _contextListeners.set(listenerId, new ListenerItem(listenerId, thisListener,thisContextType));
        document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.AddContextListener, {
                id:listenerId, 
                channel:this.id,
                contextType:thisContextType
        }));
        return new Listener("context", listenerId);
    }
    
}

/**
 * the AppInstance class
 */
class AppInstance implements fdc3AppInstance {
    instanceId : string;
    status : 'ready' | 'loading' | 'unregistered';

    constructor(instanceId : string, status : 'ready' | 'loading' | 'unregistered'){
        this.instanceId = instanceId;
        this.status = status;
    }

    addContextListener(handler: ContextHandler ): Listener;
    addContextListener(contextType: string, handler: ContextHandler): Listener;
    addContextListener(contextType : any, handler? : any){
        const thisListener : ContextHandler = arguments.length === 2 ? handler : arguments[0];
        const thisContextType : string = arguments.length === 2 ? contextType : null;
        const listenerId : string = utils.guid();
        _contextListeners.set(listenerId, new ListenerItem(listenerId, thisListener,thisContextType));
        document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.AddContextListener, {
                id:listenerId, 
                instanceId:this.instanceId,
                contextType:thisContextType
        }));
        return new Listener("context", listenerId);
    }


    broadcast(context : Context){
        wireMethod("broadcast", {context:context,instanceId:this.instanceId}, true);
    }

    onStatusChanged(handler : (newVal : string, oldVal :string) => {}){

    }

}


const wireMethod = (method :string, detail : FDC3EventDetail, config? : any) : Promise <any | null> => {
    const ts : number = Date.now();
    const _guid : string = utils.guid();
    const eventId : string = `${method}_${_guid}`;
    detail.eventId = eventId;
    detail.ts = ts;
    if (config && config.void){      
        document.dispatchEvent(utils.fdc3Event(method,detail));
    }
    else {
        return new Promise((resolve, reject) => {
           
            document.addEventListener(`FDC3:return_${eventId}`,(event : FDC3Event)=>{
                    let r = event.detail;
                    if (r !== null && config && config.resultHandler){
                        r = config.resultHandler.call(this,r);
                    }
                    resolve(r);
                  
            },{once:true});
            
            
            document.dispatchEvent(utils.fdc3Event(method,detail));

        });
    }
};



class DesktopAgent implements fdc3DesktopAgent {

    constructor() {

    }

    open(name : string, context? : Context)  {
        return wireMethod("open", {name:name, context:context});
    }

    broadcast(context : Context) {
        //void
        wireMethod("broadcast", {context:context}, {void:true});
    }

    raiseIntent(intent : string, context : Context, target : string)  {
       return wireMethod("raiseIntent",{intent:intent, context:context, target: target});
    }

    addContextListener(handler: ContextHandler ): Listener;
    addContextListener(contextType: string, handler: ContextHandler): Listener;
    addContextListener(contextType:any, handler? : any) {
        const thisListener : ContextHandler = arguments.length === 2 ? arguments[1] : arguments[0];
        const thisContextType : string = arguments.length === 2 ? arguments[0] : null;
        const listenerId : string = utils.guid();
        _contextListeners.set(listenerId, new ListenerItem(listenerId, thisListener, thisContextType));
        document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.AddContextListener, {
                id:listenerId,
                contextType:thisContextType
        }));
        return new Listener("context",listenerId);
    }

    addIntentListener(intent:string, listener:ContextHandler) {
        const listenerId : string = utils.guid();
        if (!_intentListeners.has(intent)){
            _intentListeners.set(intent, new Map());
        }
        _intentListeners.get(intent).set(listenerId, new ListenerItem(listenerId,listener));
        document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.AddIntentListener, {
                id:listenerId,
                intent:intent
        }));
        return new Listener("intent", listenerId, intent)
    }

    findIntent(intent : string, context : Context) {
        return wireMethod("findIntent",{intent:intent, context:context});
    }


    findIntentsByContext(context : Context) {
        return wireMethod("findIntentsByContext",{context:context});
    }

    getSystemChannels() {
        return wireMethod("getSystemChannels",{},{resultHandler:(r : any)=>{
            const channels = r.map((c : any )=> {
                return new Channel(c.id,"system",c.displayMetadata);
            });
            return channels;
        }});
    }

    getOrCreateChannel(channelId : string){
        return wireMethod("getOrCreateChannel",{channelId:channelId},{resultHandler:(r : any) =>{
            return new Channel(r.id,r.type,r.displayMetadata);
        }});
    }


    joinChannel(channel : string) {
        return new Promise <void>((resolve, reject) => {
            document.addEventListener("FDC3:confirmJoin",(event : FDC3Event) =>{
                resolve();
            }, {once : true});
            document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.JoinChannel, {channel:channel }));
        });
    }

    leaveCurrentChannel(){
        return wireMethod("leaveCurrentChannel", {});
    }

    getCurrentChannel() {
        return wireMethod("getCurrentChannel",{},{resultHandler:(r : any) =>{
            return new Channel(r.id,r.type,r.displayMetadata);
        }});
    }

    getAppInstance(instanceId : string) : Promise<AppInstance> {
        return wireMethod("getAppInstance",{instanceId:instanceId},{resultHandler:(r : any) =>{
            return new AppInstance(r.instanceId,r.status);
        }});
    };
   
 }

 document.addEventListener("FDC3:context",(event : FDC3Event) => {
     const listeners = _contextListeners;
     if (event.detail.data.listenerId && listeners.has(event.detail.data.listenerId)){
        listeners.get(event.detail.data.listenerId).handler.call(this,event.detail.data.context, event.detail.source);
     }

 });

 document.addEventListener("FDC3:intent",(event : FDC3Event) => {
    const listeners = _intentListeners.get(event.detail.data.intent);
    let result = null;
     if (listeners){
        listeners.forEach(l => {
            l.handler.call(this,event.detail.data.context, event.detail.source);
        });
     }
     //emit return event
     document.dispatchEvent(utils.fdc3Event(FDC3EventEnum.IntentComplete, {data:result }));
});

//map of context listeners by id
const _contextListeners : Map<string, ListenerItem> = new Map();

//map of intents holding map of listeners for each intent
const _intentListeners: Map<string, Map<string, ListenerItem>> = new Map();

(window as any)["fdc3"] = new DesktopAgent();

};

_doFdc3();

