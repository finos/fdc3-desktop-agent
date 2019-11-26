window.fdc3 = {
    _contextListeners:[],
    _intentListeners:{},
    open:function(name, context){
        return new Promise((resolve, reject) => {
            document.dispatchEvent(new CustomEvent('FDC3:open', {
                detail:{
                    name:name,
                    context:context
                } 
                
            }));
            resolve(true);
        });
    },
    broadcast:function(context){
        return new Promise((resolve, reject) => {
            document.dispatchEvent(new CustomEvent('FDC3:broadcast', {
                detail:{
                    context:context
                } 
                
            }));
            resolve(true);

        });
    },

    raiseIntent:function(intent, context){
        return new Promise((resolve, reject) => {
            document.dispatchEvent(new CustomEvent('FDC3:raiseIntent', {
                detail:{
                    intent:intent,
                    context:context
                } 
                
            }));
            resolve(true);

        });
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

    getSystemChannels: function(){
        return new Promise((resolve, reject) => {
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