import {FDC3App} from './FDC3Data';
import {IntentMetadata} from './fdc3/IntentMetadata';

/**
 * represents an FDC3 intent with a collection of related App Instances 
 **/
export interface IntentInstance {
    intent: IntentMetadata;
    apps: Array<FDC3App>;
}