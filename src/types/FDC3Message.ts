import {FDC3App} from './FDC3Data';
import {Context} from './fdc3/Context';
import { TargetApp } from './fdc3/Types';

export interface FDC3Message {
    topic  : string;
    app? : TargetApp;
    name? : string;
    intent? : string;
    data? : any;
    tabId? : number;
    selected ? : FDC3App;
    context ? : Context;
    source? : string;
}