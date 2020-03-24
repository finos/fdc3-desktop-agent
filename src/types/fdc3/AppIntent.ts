import {IntentMetadata} from './IntentMetadata';
import {AppMetadata} from './AppMetadata';
/**
* An interface that relates an intent to apps
*/
export interface AppIntent {
    intent: IntentMetadata;
    apps: Array<AppMetadata>;
}