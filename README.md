# FDC3 desktop-agent
This project is a Chrome Extension implementation of an FDC3 Desktop Agent.  Its purpose is to provide a quick and easy way to get started with FDC3 as an app provider and an open source reference implementation of a desktop agent.  Since the extension allows you to just use Chrome, you can plug in your own web apps and even use some common apps on the web as well as some that have been published to demo this project. 

__Please note:__ This project is not intended to be an entire financial desktop solution, it does not address windowing, native integration, or integration with other desktop agents.  There are great products such as [OpenFin](https://www.openfin.co) which handle these problems.

## features

This project aims to create a full featured FDC3 implementation.  These features include:

### API
The extension makes the FDC3 API available to all pages loaded in Chrome (except incongnito pages - where the extension does not run).  This API will be kept up to date with the developing FDC3 standards.

### app directory 
The extension uses an app directory hosted at [https://appd.kolbito.com](https://appd.kolbito.com) by default. This can be overridden in the code (see below).  The extension also works without a directory.  The directory is not currently open source, but it is public for reads.  If you want to get something added to the directoy, please file an issue to this project.

### Intent Resolution
When an intent is raised that has multiple possible providers, the extension will bring up a dialog in the Chrome tab raising the intent and present the apps available.  This list may include apps from the app directory as well as apps running that have registered intents with the extension (they don't need to be in the app directory). 

### Channel linking
The extension adds a button into the Chrome toolbar that gives you access to channel linking and other features.  You can add any tab in Chrome into a color channel.  The color channels control the routing of all FDC3 broadcasts.  

### Search
The FDC3 extension button also give you access to search functionality.  Currently, the search will go against the app directory and return apps that can be lauched as new tabs in Chrome.

## examples

Here are some examples of the extension in actions

### FDC3 browser action button
![image](/images/browser-action.png)

### color linking
![image](/images/color-link.png)
- clicking on the *link* icon opens the color picker
- *grey* indicates the default/no channel
- the selected channel is indicated as a badge on the browser action button

### search
![image](/images/search-news.png)

### intent resolution dialogue
![image](/images/intent-resolution.png)


## getting the extension
The extension is not published with Chrome. To use it, you will need to get the project and install it locally.

### clone and build the project locally

- git clone this repo
- npm i
- npm run build

### install the extension

- In Chrome, got to [chrome://extensions](chrome://extensions)
- Click the *Load unpacked* button in the top left of the screen (if this option is not available, select 'Developer mode' using the toggle switch in the top right)
- Select the *desktop-agent/dist* directory from your local desktop-agent setup

To try out changes, just rebuild with npm and refresh the extension from the extensions page.

## using the extension with apps
The extension will automatically inject the FDC3 API into every Chrome tab.  The API is documented # [https://fdc3.finos.org](https://fdc3.finos.org).  

### waiting for the api
The readiness of the api is non-determistic and depending on your app, the api may not be injected before your first script runs.  To prevent issues, the extension will try to call a global function named *onFDC3* when it first loads.  It is recommended that if you are setting up fdc3 context and intent handlers on load of your app, that you use this function.

For example:

```js
const onFDC3 = () => {
    fdc3.addContextListener(myListener);
};
```


## working with the extension code

The project consists of these layers:
* background - contains most of the business logic for the desktop agent and the connection to the appD backend
* content - this establishes the connection to the background script and the individual app windows, handles UI footprint like resolver dialogues, and injects the actual fdc3 api into each window
* api - this provides the fdc3 api. It is injected into the given chrome tab by the content script.
* popup - ui for color linking and directory search


### Going between layers
All API calls typically have to traverse from the api layer to through the content script to the background (where they are actually processed) and back.  

#### return messages
Most calls will have some return value.  These messages use the original message name prefixed with _return_.  The actual message structures will differ depending on what layer they are traversing.

#### api and content layers
Calls between the api and content layers are synthetic document events using `document.dispatchEvent` and `document.addEventListener`.  All of these events use a prefix of _FDC3:_ in their event name.  These events add custom data to the _detail_ property of the event object.  For example:

```javascript
document.dispatchEvent(new CustomEvent('FDC3:broadcast', {
    detail:{
        context:context
    } 
    
}));
```
#### content layer to background layer
Communication between the content and background scripts happens via postMessage on a connection created when a page first loads.  For example:

```javascript
port.postMessage({topic:"broadcast", "data": data}); 

port.postMessage({topic:"_environmentData",  "data": data});

```
__Message Payload Structure:__
* All messages have a _topic_ property.  This is the identifier for the message.  Naming scheme works as follows:
    * if the message is remoting an fdc3 api call - it will be exactly the name of the api
    * internal events between content and background scripts will be prefixed with an _underscore_
    * return events carry a unique topic that is generated in the api layer and carried on the original document event as the propoperty _event.detail.eventId_ and as the _eventId_ property on the message for the original event.
* All messages have a _data_ property - this is the actual payload for the message.

## Contributing
Like [FDC3](https://github.com/finos/fdc3), this is an Apache 2.0 licensed open source project that welcomes contributions!   





