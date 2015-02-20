var windows = [];
var detached = [];
function createWindowStorage(callback){
	chrome.storage.local.set({'windows':[]},callback);
}

function populateWindowStorage(callback){
	chrome.windows.getAll({'populate':true},function(result){
		result.forEach(function(currentWindow,i){
			if (currentWindow.type=="normal")
				addWindow(currentWindow,i,function(j){
					if (j==result.length-1){
						saveWindows();
					}
				});
		});
	});
}

function clearStorage(callback){
	chrome.storage.local.clear(callback);
}

function saveWindows(callback){
	chrome.storage.local.set({'windows':windows},callback);
}

function getWindows(callback){
	chrome.storage.local.get("windows",callback);
}

function addWindow(currentWindow,i,callback){
	if (typeof i=='function'){
		callback = i;
	}
	var tabs = currentWindow.tabs!==undefined ? currentWindow.tabs : [];
	windows.push({'id':currentWindow.id,'name':'Window', 'tabs':tabs});
	if (callback!==undefined){
		callback(i);
	}
}

function findWindowById(windowId){
	var w = windows.filter(function(currentWindow){
		return currentWindow.id===windowId;
	});
	if (w.length===1){
		return {'window':w[0],'index':windows.indexOf(w[0])};
	}
	else if (w.length===0){ 
		throw "Could not find window with id "+windowId;
	}
	else{
		throw "Found more than one window with id "+windowId;
	}
}

function findTabById(queryWindow,tabId){
	if (typeof queryWindow=="number"){
		var result = findWindowById(queryWindow);
		var windowIndex = result.index;
		queryWindow = result.window;
	}
	var t = queryWindow.tabs.filter(function(currentTab){
		return currentTab.id==tabId;
	});
	if (t.length===1){
		return {'tab':t[0],'index':queryWindow.tabs.indexOf(t[0]),'window':queryWindow,'windowIndex':windowIndex};
	}
	else if (t.length===0){
		throw "Could not find tab with id "+tabId+" in window with id "+queryWindow.id;
	}
	else{
		throw "Found more than one tab with id "+tabId+" in window with id "+queryWindow.id;
	}
}

function findTabInWindow(tabId){
	for (var i=0; i<windows.length; i++){
		var resultTab = windows[i].tabs.filter(function(currentTab){
			return currentTab.id===tabId;
		});
		if (resultTab.length===1){
			return {'tab':resultTab[0],'index':windows[i].tabs.indexOf(resultTab[0]),'window':windows[i],'windowIndex':i};
		}
	}	
	throw "A tab wasn't found with the id "+tabId;
}

chrome.windows.onCreated.addListener(function(currentWindow){
	addWindow(currentWindow,saveWindows);
});

chrome.windows.onRemoved.addListener(function(windowId){
	var result = findWindowById(windowId);
	windows.splice(result.index,1);
	saveWindows();
});

chrome.tabs.onCreated.addListener(function(currentTab){
	var containingWindow = findWindowById(currentTab.windowId);
	if (containingWindow.window.tabs.indexOf(currentTab)==-1){
		containingWindow.window.tabs.push(currentTab);
		saveWindows();
	}
	
});

chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,currentTab){
	var tab = findTabById(currentTab.windowId, tabId);
	tab.window.tabs[tab.index] = currentTab;
	saveWindows();
});

chrome.tabs.onMoved.addListener(function(tabId,objects){
	var windowId = objects.windowId;
	var startPos = objects.fromIndex;
	var endPos = objects.toIndex;
	var tab = findTabById(windowId, tabId);
	tabs.window.tabs.splice(startPos,1);
	tabs.window.tabs.splice(endPos,0,tab.tab);
	saveWindows();
});

chrome.tabs.onRemoved.addListener(function(tabId,objects){
    var windowId = objects.windowId;
    var windowClosing = objects.isWindowClosing;
    //We don't need to worry about this if the window is closing. If the window is closing, it will be handled by the window remove event.
    if (!windowClosing){
    		var tab = findTabById(windowId, tabId);
		tab.window.tabs.splice(tab.index,1);
    		saveWindows();
    }
});

chrome.tabs.onReplaced.addListener(function(newId,oldId){
	var tab = findTabInWindow(oldId);
	tab.window.tabs[tab.index].id=newId;
	saveWindows();
})

chrome.tabs.onDetached.addListener(function(tabId, objects){
	var windowId = objects.oldWindowId;
	var startPos = objects.oldPosition;
	var tab = findTabById(windowId, tabId);
	//Add it to the list of detached tabs, which can be used in onAttached.
	detached.push(tab.tab);
	tab.window.tabs.splice(tab.index,1);
	saveWindows();
});

chrome.tabs.onAttached.addListener(function(tabId,objects){
	var windowId = objects.newWindowId;
	var endPos = objects.newPosition;
	var containingWindow = findWindowById(windowId);
	var detachedTab = detached.filter(function(currentTab){
		return currentTab.id===tabId;
	});
	if (detachedTab.length===1){
		detachedTab = detachedTab[0];
		containingWindow.window.tabs.splice(endPos,0,detachedTab);
		var tabIndex = detached.indexOf(detachedTab);
		//Remove it from the detached list
		detached.splice(tabIndex, 1);
		saveWindows();	
	}
});

//init
chrome.storage.local.get('windows',function(result){
	console.log(result);
});


clearStorage(function(){
	createWindowStorage(function(){
		populateWindowStorage();
	});
});