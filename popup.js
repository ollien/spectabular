var totalHeight = 0; //Total height of the body of the popup

//Gets windows from storage
function getStorage(callback){
	chrome.storage.local.get("windows",callback);
}

function getWindows(windowList,windows,callback){
	if (typeof windows==="function"){
		callback = windows;
		getStorage(function(data){
			if (data!=null){
				setupWindows(windowList,data.windows,callback);
			}
			else{
				throw "Windows is null, this hsould never happen.";
			}
		});
	}
	else{
		setupWindows(windowList,windows, callback);
	}
}

function setupWindows(windowList,windows,callback){
	debugger;
	windows.forEach(function(currentWindow){
		setupWindowElement(currentWindow, function(windowLi){
			setupTabs(currentWindow.tabs, function(tabElements){
				tabElements.forEach(function(currentTab){
					windowLi.querySelector('ul.tabs').appendChild(currentTab);
				});
				windowList.appendChild(windowLi);
				callback();
			});
		});			
	});
}

//Sets up all tabs to be in their window elements
function setupWindowElement(currentWindow,callback){
	var li = document.createElement("li");
	var ul = document.createElement("ul");
	var windowName = document.createElement("span");
	var seperator = document.createElement("span");
	var tabCount = document.createElement("span");
	var tabWord = document.createElement("span");
	li.classList.add("window");
	li.classList.add("noselect");
	ul.classList.add("tabs");
	ul.setAttribute("windowId", currentWindow.id);
	windowName.classList.add("windowName");
	windowName.textContent = currentWindow.name;
	seperator.textContent=" - "
	tabCount.classList.add("tabCount");
	tabCount.textContent = currentWindow.tabs.length.toString();
	tabWord.classList.add("tabWord");
	tabWord.textContent = (currentWindow.tabs.length>1 ? " tabs":" tab");
	li.appendChild(windowName);
	li.appendChild(seperator)
	li.appendChild(tabCount);
	li.appendChild(tabWord);
	li.appendChild(ul);
	callback(li);
}

function setupTabs(tabs,callback){
	var tabElements = [];
	tabs.forEach(function(currentTab){
		var li = document.createElement("li");
		var textSpan = document.createElement("span");
		var closeButton = document.createElement("i");
		var pinButton = document.createElement("i");
		li.setAttribute('tabId', currentTab.id);
		closeButton.classList.add("fa");
		closeButton.classList.add("fa-remove");
		closeButton.classList.add("close");
		closeButton.classList.add("noselect");
		closeButton.classList.add("pointer");
		pinButton.classList.add("fa");
		pinButton.classList.add("fa-thumb-tack");
		pinButton.classList.add("pin");
		pinButton.classList.add("noselect");
		closeButton.classList.add("pointer");
		if (currentTab.pinned){
			pinButton.classList.add("pinned");
		}
		li.classList.add("tab");
		li.classList.add("noselect");
		li.classList.add("pointer");
		//Setup favicon
		li.style.backgroundImage = "url(\'"+(currentTab.favIconUrl!==undefined && currentTab.favIconUrl!==null ? currentTab.favIconUrl:"img/default-favicon.png")+"\')";
		textSpan.classList.add("tabName");
		textSpan.textContent=currentTab.title;
		if (textSpan.textContent==""){
			textSpan.textContent="Untitled";	
		}
		
		closeButton.onclick = function(event){
			event.preventDefault();
			event.stopPropagation();
			chrome.tabs.remove(currentTab.id);
			decrementTabCount(li);
			li.parentNode.removeChild(li);
			setHeights();
		}
		pinButton.onclick = function(event){
			event.preventDefault();
			event.stopPropagation();
			if (currentTab.pinned || pinButton.classList.contains('pinned')){
				pinButton.classList.remove("pinned");
				chrome.tabs.update(currentTab.id, {'pinned':false});
			}
			else{
				pinButton.classList.add("pinned");
				chrome.tabs.update(currentTab.id, {'pinned':true});
			}
		}
		//Switches to the tab clicked
		li.onclick = function(event){
			event.stopPropagation();
			chrome.windows.getCurrent(function(resultWindow){
				if (currentTab.id!=resultWindow.id){
					chrome.windows.update(currentTab.windowId,{'focused':true});
				}
				chrome.tabs.update(currentTab.id,{'highlighted':true,'active':true});
			});
		}
		
		li.appendChild(textSpan);
		textSpan.appendChild(pinButton);
		textSpan.appendChild(closeButton);
		tabElements.push(li);
	});
	callback(tabElements);
}

function decrementTabCount(tabLi){
	var ul = tabLi.parentNode;
	if (ul.tagName.toLowerCase()!='ul' || !ul.classList.contains("tabs")){
		throw "Not a tab li";
	}
	var li = ul.parentNode;
	if (li.tagName.toLowerCase()!='li' || !li.classList.contains("window")){
		throw "Not a tab li";
	}	
	var tabCount = li.querySelector('span.tabCount');
	var num = parseInt(tabCount.textContent)-1;
	tabCount.textContent=num.toString();
	var windows = li.parentNode;
	if (windows.tagName.toLowerCase()!='ul' || windows.id!="windows"){
		throw "Not a tab li";
	}
	if (num===0){
		windows.removeChild(li);
	}
	setHeights();
}

function removeChildren(element){
	Array.prototype.slice.call(element.childNodes).forEach(function(child){
		element.removeChild(child);
	});
}
function search(query,callback){
	getStorage(function(windows){
		windows = windows.windows;
		windows.forEach(function(currentWindow){
			currentWindow.tabs = currentWindow.tabs.filter(function(currentTab){
				return currentTab.title.toLowerCase().indexOf(query)>-1;
			});
		});
		callback(windows);
	});
}
function createTabList(mainList,windowKeyIndex){
	return mainList.querySelectorAll('li.window')[windowKeyIndex].querySelector('ul.tabs').childNodes;
}
function setHeights(){
	var windows = document.getElementById("windows");
	var body = document.querySelector("body");
	var html = document.querySelector("html");
	var height = windows.offsetHeight+"px";
	if (windows.offsetHeight>=600){
		height = "600px";
	}
	html.style.height = height;
	body.style.height = height;
}
document.addEventListener('DOMContentLoaded', function() {
	var mainList = document.getElementById("windows");
	var filterInput = document.getElementById("search");
	var windowKeyIndex = 0;
	var tabKeyIndex = 0;
	getWindows(mainList,setHeights);
	filterInput.addEventListener('input', function(event){
		search(filterInput.value,function(windows){
			removeChildren(mainList);
			getWindows(mainList,windows,setHeights);
		});
	});
	window.addEventListener('keydown', function(event){
		var tabList = createTabList(mainList,windowKeyIndex);
		if (event.keyCode===40){
			event.preventDefault();
			event.stopPropagation();
			if (document.activeElement===filterInput){
				filterInput.blur();
			}
			else{
				tabList[tabKeyIndex].classList.remove('keyHover');	
				tabKeyIndex+=1;
				if (tabKeyIndex===tabList.length){
					windowKeyIndex+=(windowKeyIndex+1<mainList.querySelectorAll('li.window').length ? 1 : 0);
					tabKeyIndex = 0;
					tabList = createTabList(mainList, windowKeyIndex);
				}
			}
			tabList[tabKeyIndex].classList.add('keyHover');
		}
		else if (event.keyCode===38){
			event.preventDefault();
			event.stopPropagation();
			if (tabList[tabKeyIndex].classList.contains('keyHover')){
				tabList[tabKeyIndex].classList.remove('keyHover');	
				tabKeyIndex-=1;
				if (tabKeyIndex===-1){
					windowKeyIndex-=1;
					if (windowKeyIndex==-1){
						windowKeyIndex=0;
						tabKeyIndex = 0;
						tabList[tabKeyIndex].classList.remove('keyHover');
						filterInput.focus();
					}
					else{
						tabList = createTabList(mainList, windowKeyIndex);
						tabKeyIndex = tabList.length-1;
						tabList[tabKeyIndex].classList.add('keyHover');
					}
				}
				else{
					tabList[tabKeyIndex].classList.add('keyHover');
				}
			}
		}
	});
});