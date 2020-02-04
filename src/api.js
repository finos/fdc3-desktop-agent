/**
 * This file is injected into each Chrome tab by the Content script to make the FDC3 API available as a global
 */

function _doFdc3(){

const wireMethod = (method, detail, isVoid) => {
    const ts = Date.now();
    const eventId = `${method}_${ts}`;
    detail.eventId = eventId;
    detail.ts = ts;
    console.log(`API: dispatch for ${method}`, detail);
    if (isVoid){      
        document.dispatchEvent(new CustomEvent(`FDC3:${method}`,{detail:detail}));
    }
    else {
        return new Promise((resolve, reject) => {
           
            document.addEventListener(`FDC3:return_${eventId}`,(evt)=>{
                console.log(`API: return for ${eventId}`,evt);
                if (evt.detail){
                    resolve(evt.detail);
                }
                else {
                    reject(evt.detail);
                }           
            },{once:true});
            
            
            document.dispatchEvent(new CustomEvent(`FDC3:${method}`,{detail:detail}));

        });
    }
};

window.fdc3 = {
    _contextListeners:[],
    _intentListeners:{},
    open:function(name, context){
        return wireMethod("open", {name:name, context:context});
    },
    broadcast:function(context){
        //void
        wireMethod("broadcast", {context:context}, true);
    },

    raiseIntent:function(intent, context){
       return wireMethod("raiseIntent",{intent:intent, context:context});
    },

    addContextListener:function(listener){
        window.fdc3._contextListeners.push(listener);
        document.dispatchEvent(new CustomEvent('FDC3:addContextListener', {
            detail:{
            }
        }));
    },

    addIntentListener:function(intent, listener){
        if (!window.fdc3._intentListeners[intent]){
            window.fdc3._intentListeners[intent] = [];
        }
        window.fdc3._intentListeners[intent].push(listener);
        document.dispatchEvent(new CustomEvent('FDC3:addIntentListener', {
            detail:{
                intent:intent
            }
        }));
    },

    findIntent: function(intent, context){
        return wireMethod("findIntent",{intent:intent, context:context});
    },

// returns, for example:
// [{
//     intent: { name: "StartCall", displayName: "Call" },
//     apps: [{ name: "Skype" }]
// },
// {
//     intent: { name: "StartChat", displayName: "Chat" },
//     apps: [{ name: "Skype" }, { name: "Symphony" }, { name: "Slack" }]
// }];
    findIntentsByContext: function(context){
        return wireMethod("findIntentsByContext",{context:context});
       /* return new Promise((resolve, reject) => {
            document.addEventListener("FDC3:returnFindIntentsByContext",evt =>{
                resolve(evt.detail.data);
            }, {once : true});
            //massage context to just get type...
            if (typeof context === "object" && context.type){
                context = context.type;
            }
            document.dispatchEvent(new CustomEvent('FDC3:findIntentsByContext', {
                detail:{
                    context:context
                }
            }));
        });*/
    },

    getSystemChannels: function(){
        return new Promise((resolve, reject) => {
            document.addEventListener("FDC3:returnSystemChannels",evt =>{
                resolve(evt.detail.data);
            }, {once : true});
            document.dispatchEvent(new CustomEvent('FDC3:getSystemChannels', {
  
            }));
        });
    },

    joinChannel: function(channel){
        return new Promise((resolve, reject) => {
            document.addEventListener("FDC3:confirmJoin",evt =>{
                resolve(true);
            }, {once : true});
            document.dispatchEvent(new CustomEvent('FDC3:joinChannel', {
                detail:{
                    channel:channel
                }
            }));
                

        });
    }

   
 };

 document.addEventListener("FDC3:context",evt => {
     window.fdc3._contextListeners.forEach(l => {
         l.call(this,evt.detail.data.context);
     });
 });

 document.addEventListener("FDC3:intent",evt => {
     if (window.fdc3._intentListeners[evt.detail.data.intent]){
        window.fdc3._intentListeners[evt.detail.data.intent].forEach(l => {
            l.call(this,evt.detail.data.context);
        });
     }
});



//look for onFDC3 function set by the window...
try{
    if (onFDC3){
        onFDC3.call();
    }
} catch (e) {
    console.log("onFDC3 not set");
}
};

_doFdc3();

