
function resolver() {};

resolver.prototype.root = function(){
        // Create root element
        var root = document.createElement('div');
        var wrapper = document.createElement('div');
        wrapper.id = "fdc3-intent-resolver";

         // Create a shadow root
         var shadow = root.attachShadow({mode: 'open'});

        // Create some CSS to apply to the shadow dom
        const style = document.createElement('style');

        style.textContent = `
        #fdc3-intent-resolver {
            width:400px;
            height:400px;
            margin-left:-200px;
            margin-top:-200px;
            left:50%;
            top:50%;
            background-color:#222;
            position:absolute;
            z-index:9999;
            display:none;
        }
            
        #resolve-list {
            display:flex;
            flex-flow:row wrap;
        }`;

        let list = document.createElement('div');
        list.id = "resolve-list";
        wrapper.appendChild(list);
        resolver.prototype.list = list;

        // Attach the created elements to the shadow dom
        shadow.appendChild(style);
        shadow.appendChild(wrapper);
        

        resolver.prototype.hide = function(){
            wrapper.style.display = "none";
        };

        resolver.prototype.show = function(){
            wrapper.style.display = "block";
        }
        return root;
    };

    resolver.prototype.context = function(ctx){
        if (ctx){
            this.context = ctx;
        }
        return this.context;
    };

    resolver.prototype.intent = function(i){
        if (i){
            this.intent = i;
        }
        return this.intent;
    }

    resolver.prototype.resolve = function(rData){
        let clickHandler = function(evt){
            //send resolution message to extension to route
            port.postMessage({
                method:"resolveIntent",
                intent:this.intent,
                selected:selected,
                context:this.context
            }); 
            this.list.innerHTML = "";
            this.hide(); //style.display = "none";
        }.bind(this);
        rData.forEach((item) => {
            let selected = item;
            let data = item.details.directoryData ? item.details.directoryData : item.details;
            let rItem = document.createElement("div");
            console.log(data);
            rItem.style.color = "white";
            rItem.style.flexFlow = "row";
            rItem.style.height = "20px";
            rItem.innerText = data.title;
            ;

            rItem.addEventListener("click",clickHandler);
            this.list.appendChild(rItem);
        });
    };

    module.exports = resolver;
