import {Context} from './fdc3/Context';
import { TargetApp } from './fdc3/Types';

/**
 * Custom DOM event used by the FDC3 API
 */

export class  FDC3Event extends Event {
    detail : FDC3EventDetail;
    ts : number;

   constructor(type:string, init? : CustomEventInit){
        super(type, init);
    }


}


/**
 * Event Detail structure
 */
export interface FDC3EventDetail {
    /**
     * 
     */
    id ?: string; //resolve with listenerId
    ts? : number;
    listenerId ? : string;
    eventId?: string; //resolve with listenerId & eventId
    intent? : string;
    channel?:string;
    channelId?:string; //resolve w/channel
    instanceId? : string; //identifier for the app instance
    contextType?:string;
    data ? : any;
    name? : string;
    context? : Context;
    source? : string;
    target? : TargetApp;
}



/**
 * EventEnum
 * enum of all fdc3 event topics that can originate from the API layer 
 */
export enum FDC3EventEnum  {
    Broadcast = "broadcast",
    Open = "open",
    RaiseIntent = "raiseIntent",
    AddContextListener = "addContextListener",
    AddIntentListener = "addIntentListener",
    FindIntent = "findIntent",
    FindIntentsByContext = "findIntentsByContext",
    GetCurrentContext = "getCurrentContext",
    GetSystemChannels = "getSystemChannels",
    GetOrCreateChannel = "getOrCreateChannel",
    GetCurrentChannel = "getCurrentChannel",
    JoinChannel = "joinChannel",
    DropContextListener = "dropContextListener",
    DropIntentListener = "dropIntentListener",
    IntentComplete = "intentComplete"
 };

/*export {
   FDC3Event,
   FDC3EventDetail,
   FDC3EventEnum
};*/



