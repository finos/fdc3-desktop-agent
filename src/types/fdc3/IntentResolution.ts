/**
 * IntentResolution provides a standard format for data returned upon resolving an intent.
 * ```javascript
 * //resolve a "Chain" type intent
 * var intentR = await agent.raiseIntent("intentName", context);
 * //resolve a "Client-Service" type intent with data response
 * var intentR = await agent.raiseIntent("intentName", context);
 * var dataR = intentR.data;
 * ```
 */
export interface IntentResolution {
    source: string;
    data?: object;
    version: string;
}