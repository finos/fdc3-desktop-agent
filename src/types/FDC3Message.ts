import {FDC3App} from './FDC3Data';
import {Context} from './fdc3/Context';

export interface FDC3Message {
    topic  : string;
    name? : string;
    intent? : string;
    data? : any;
    tabId? : number;
    selected ? : FDC3App;
    context ? : Context;
}