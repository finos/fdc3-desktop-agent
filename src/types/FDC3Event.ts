import {Context} from './fdc3/Context';

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
    contextType?:string;
    data ? : any;
    name? : string;
    context? : Context;
    target? : string;
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
    DropIntentListener = "dropIntentListener"
 };

/*export {
   FDC3Event,
   FDC3EventDetail,
   FDC3EventEnum
};*/



