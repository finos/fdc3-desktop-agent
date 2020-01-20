
window.fdc3 = {
    _contextListeners:[],
    _intentListeners:{},
    open:function(name, context){
        return new Promise((resolve, reject) => {
            const ts = Date.now();
            const eventId = `open_${ts}`;
    
            document.addEventListener(`FDC3:return_${eventId}`,(evt)=>{
                if (evt.detail){
                    resolve(evt.detail);
                }
                else {
                    reject(false);
                }
             
            },{once:true});
        
            document.dispatchEvent(new CustomEvent('FDC3:open', {
                detail:{
                    name:name,
                    context:context,
                    eventId:eventId,
                    ts:ts
                } 
                
            }));

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


//components


class FDC3ChannelPicker extends HTMLElement {
    constructor() {
        super();

        this.closed = "true";

        // Create a shadow root
      var shadow = this.attachShadow({mode: 'open'});

      // Create wrapper element
      var wrapper = document.createElement('div');
      wrapper.id = "channel-picker"

      // Create some CSS to apply to the shadow dom
      const style = document.createElement('style');
  
      style.textContent = `
      #channel-picker {
          display: inline-flex;
          border:solid 1px #999;
          width: 20px;
          z-index:9999;
      }
      .picker-item {
          margin:0px;
          top:0px;
          left:0px;
          height:20px;
          width:20px;
          z-index:9999;
       
          display:none;
      }

      #handle {
          display:block;
          background:url('http://localhost:5556/icons/link.png');
          background-size:18px;
          background-position:center;
          backgrount-color:#ccc;
      }
      `;

      const colors = {
        "default":{
            color:"#fff",
            hover:"#ececec"
        },
        "red":{
            color:"#da2d2d",
            hover:"#9d0b0b" 
        },
        "orange":{
            color:"#eb8242",
            hover:"#e25822"
        },
        "yellow":{
            color:"#f6da63",
            hover:"#e3c878"
        },
        "green":{
            color:"#42b883",
            hover:"#347474"
        },
        "blue":{
            color:"#1089ff",
            hover:"#505BDA"
        },
        "purple":{
            color:"#C355F5",
            hover:"#AA26DA"
        }
      };

      this.colors = colors;

      let handle = document.createElement("div");
          handle.id = "handle";
          handle.className = "picker-item";
      this.handle = handle;
      let toggle = this.toggle.bind(this);
          handle.addEventListener("click",toggle);
          wrapper.appendChild(handle);
       // Attach the created elements to the shadow dom
      shadow.appendChild(style);
      shadow.appendChild(wrapper);

      fdc3.getSystemChannels().then(channels => {
          const target = wrapper;
        let defChan = [{id:"default"}];
        channels = defChan.concat(channels ? channels : []);

          channels.forEach(channel => {
              let ch = document.createElement("div");
              let select = this.selectItem.bind(this);
              let hover = this.hoverItem.bind(this);
              let revert = this.revertItem.bind(this);
              ch.id = channel.id;
              ch.className = "picker-item";
              
                ch.style.backgroundColor = colors[channel.id].color;
              
              target.appendChild(ch);
              ch.addEventListener("click",select);
              ch.addEventListener("mouseover",hover);
              ch.addEventListener("mouseout",revert);
          });

  });
    }

    selectItem(ev) {
        let selection = ev.target.id;
        if (selection === "default"){
            //fdc3.defaultChannel.join();
            fdc3.joinChannel(selection);
            this.toggle();
            this.handle.style.backgroundColor = "#ccc";
        } else {
            fdc3.joinChannel(selection);
                this.toggle();
                this.handle.style.backgroundColor = this.colors[selection].color;
                
            
        }
    }

    hoverItem(ev){
        let selection = ev.target.id;
        ev.target.style.backgroundColor = this.colors[selection].hover;
    }

    revertItem(ev){
        let selection = ev.target.id;
        ev.target.style.backgroundColor = this.colors[selection].color;
    }
    toggle() {
      let root = this.shadowRoot;
      let items = root.querySelectorAll(".picker-item");
      let picker = root.getElementById("channel-picker");
        if (!this.closed){              
            items.forEach(item => {
                item.style.display = "none";
            });
            root.getElementById("handle").style.display = "inline-flex";
            picker.style.width = "20px";
            picker.style.borderTop = "1px";
                picker.style.borderLeft = "1px";
               picker.style.borderColor="#999"
            this.closed = true;
        }
        else {
          items.forEach(item => {
                item.style.display = "inline-flex";
                picker.style.width = "160px";
                picker.style.borderTop = "0px";
                picker.style.borderLeft = "0px";
               picker.style.borderColor="#666"
              this.closed = false;
            });
        }
    }

   
}
 // Define the new element
 customElements.define("fdc3-channel-picker", FDC3ChannelPicker);