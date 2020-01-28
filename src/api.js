function _doFdc3(){

const wireMethod = (method, detail) => {
    return new Promise((resolve, reject) => {
        const ts = Date.now();
        const eventId = `${method}_${ts}`;

        document.addEventListener(`FDC3:return_${eventId}`,(evt)=>{
            console.log(`API: return for ${eventId}`,evt);
            if (evt.detail.result){
                resolve(evt.detail);
            }
            else {
                reject(evt.detail);
            }           
        },{once:true});
        detail.eventId = eventId;
        detail.ts = ts;
        console.log(`API: dispatch for ${method}`, detail);
        document.dispatchEvent(new CustomEvent(`FDC3:${method}`,{detail:detail}));

    });
};

window.fdc3 = {
    _contextListeners:[],
    _intentListeners:{},
    open:function(name, context){
        return wireMethod("open", {name:name, context:context});
    },
    broadcast:function(context){
        return wireMethod("broadcast", {context:context});
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
        return new Promise((resolve, reject) => {
            document.addEventListener("FDC3:returnFindIntent",evt =>{
                resolve(evt.detail.data);
            }, {once : true});
            //massage context to just get type...
            if (typeof context === "object" && context.type){
                context = context.type;
            }
            document.dispatchEvent(new CustomEvent('FDC3:findIntent', {
                detail:{
                    intent:intent,
                    context:context
                }
            }));
        });
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
        return new Promise((resolve, reject) => {
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
        });
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
if (onFDC3){
    onFDC3.call();
}

};

_doFdc3();

