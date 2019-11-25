window.fdc3 = {
    _contextListeners:[],
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
    addContextListener:function(listener){
        window.fdc3._contextListeners.push(listener);
        document.dispatchEvent(new CustomEvent('FDC3:addContextListener', {
            detail:{
            }
        }));
    },

    addIntentListener:function(listener, context){

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