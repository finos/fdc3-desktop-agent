//system channels (color linking) - make this a module
const systemChannels = [
    {"id":"red","type":"system","visualIdentity":{"color":"#FF0000","glyph":"https://openfin.co/favicon.ico","name":"Red"}},
    {"id":"orange","type":"system","visualIdentity":{"color":"#FF8000","glyph":"https://openfin.co/favicon.ico","name":"Orange"}},
    {"id":"yellow","type":"system","visualIdentity":{"color":"#FFFF00","glyph":"https://openfin.co/favicon.ico","name":"Yellow"}},
    {"id":"green","type":"system","visualIdentity":{"color":"#00FF00","glyph":"https://openfin.co/favicon.ico","name":"Green"}},
    {"id":"blue","type":"system","visualIdentity":{"color":"#0000FF","glyph":"https://openfin.co/favicon.ico","name":"Blue"}},
    {"id":"purple","type":"system","visualIdentity":{"color":"#FF00FF","glyph":"https://openfin.co/favicon.ico","name":"Purple"}}
];

function joinChannel(channel){
    //get the current active tab and message
    chrome.tabs.query({active:true, currentWindow:true},tab => {
        chrome.tabs.sendMessage(tab[0].id, {
            message:"popup-join-channel",
            channel:channel
        });
    });

}


function getSelectedChannel(){
    return new Promise((resolve, reject) => {

        chrome.tabs.query({active:true, currentWindow:true},tab => {
            chrome.tabs.sendMessage(tab[0].id, {
                message:"popup-get-current-channel"
            },response =>{
                resolve(response);
            });
        });
    });
 
}

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

          const target = wrapper;
        let defChan = [{id:"default"}];
       let channels = defChan.concat(systemChannels ? systemChannels : []);

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
         
          getSelectedChannel().then(chan => {
            console.log("selected channel : " + chan);
            this.selectItem({target:{id:chan}});
            //this.handle.style.backgroundColor = this.colors[chan].color;

            if (!this.closed){
                this.toggle();
            }
          });

          chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
              if (request.message === "set-badge"){
                  console.log("set-badge " + request.channel + " tab " + sender.tab.id);
                chrome.browserAction.setBadgeText({text:"+",
                                    tabId:sender.tab.id});
                chrome.browserAction.setBadgeBackgroundColor({color:this.colors[request.channel].color,
                                tabId:sender.tab.id});
                }

         });

    }

    selectItem(ev) {
        let selection = ev.target.id;
        if (selection === "default"){
            joinChannel(selection);
            this.toggle();
            this.handle.style.backgroundColor = "#ccc";
            chrome.tabs.query({active:true, currentWindow:true},tab => {
                chrome.browserAction.setBadgeText({text:"",
                    tabId:tab[0].id});
            });
        } else {
            joinChannel(selection);
                this.toggle();
                this.handle.style.backgroundColor = this.colors[selection].color;
             /*   chrome.tabs.query({active:true, currentWindow:true},tab => {
                    chrome.browserAction.setBadgeText({text:"+",
                        tabId:tab[0].id});
                chrome.browserAction.setBadgeBackgroundColor({color:this.colors[selection].color,
                    tabId:tab[0].id});
                });*/
            
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

