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

export const fdc3Event = (type:string, detail:FDC3EventDetail) : CustomEvent => {
    return new CustomEvent(`FDC3:${type}`, {detail:detail});
}

/**
 * Event Detail structure
 */
export interface FDC3EventDetail {
    /**
     * 
     */
    ts? : number;
    listenerId ? : string;
    id?: string; //resolve with listenerId
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
 * 
 */
export enum FDC3EventEnum  {
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



