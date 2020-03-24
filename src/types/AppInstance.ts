export interface AppInstance {
    details : AppDetails;
    type: string;
}

export interface AppDetails {
    directoryData : any;
    port : chrome.runtime.Port;
}

export enum InstanceTypeEnum {
    Window = "window",
    Directory = "directory"
};


