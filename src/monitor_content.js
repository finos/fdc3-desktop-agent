
/**
 * Content Script exposing monitoring APIs available only to priviledged apps
 * 
 * monitoring functions include:
 *  - get app directory url
 *  - get list of connected apps
 *  - get list of running apps registered to list for context (and by channel)
 *  - get list of running apps with registered intents
 *  
 */


 document.addEventListener("FDC3-monitor:getAppDUrl",(ev) => {
    chrome.runtime.sendMessage({topic:"getAppDUrl"},(r) => {
        document.dispatchEvent(new CustomEvent("FDC3-monitor:returnAppDUrl",{detail:r}));
    });
 });


 document.addEventListener("FDC3-monitor:getConnectedApps",(ev) => {
    chrome.runtime.sendMessage({topic:"getConnectedApps"},(r) => {
        document.dispatchEvent(new CustomEvent("FDC3-monitor:returnConnectedApps",{detail:r}));
    });
});

document.addEventListener("FDC3-monitor:getChannels",(ev) => {
    chrome.runtime.sendMessage({topic:"getChannels"},(r) => {
        document.dispatchEvent(new CustomEvent("FDC3-monitor:returnChannels",{detail:r}));
    });
});

document.addEventListener("FDC3-monitor:getContextListeners",(ev) => {
    chrome.runtime.sendMessage({topic:"getContextListeners"},(r) => {
        document.dispatchEvent(new CustomEvent("FDC3-monitor:returnContextListeners",{detail:r}));
    });
});

document.addEventListener("FDC3-monitor:getIntentListeners",(ev) => {
    chrome.runtime.sendMessage({topic:"getIntentListeners"},(r) => {
        document.dispatchEvent(new CustomEvent("FDC3-monitor:returnIntentListeners",{detail:r}));
    });
});