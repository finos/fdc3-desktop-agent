/**
 * represents an app instance when resolving intents 
 * can either represent a directory item or a connected instance
 */
export interface AppInstance {
    details : AppDetails;
    type: string;
}

/**
 * the connection and metadata details of a app
 */
export interface AppDetails {
    directoryData : any;
    port : chrome.runtime.Port;
}

export enum InstanceTypeEnum {
    Window = "window",
    Directory = "directory"
};


