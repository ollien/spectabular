var shiftDown = false; //Tracks if shift is held down
var unmovedPins = []; //Stores pinned tabs that haven't been within the popup
var pinnedTabs = []; //Stores pinned tabs that have been moved within the popup
var darkMode = true;
//Gets windows from storage
function getStorage(callback){
	chrome.storage.local.get("windows",callback);
}

function getOptions(callback){
	chrome.storage.local.get("options",function(items){
		if (items.options.sync){
			chrome.storage.sync.get("options",callback);
		}
		else{
			callback(items);
		}
	});
}

function changeWindowName(windowId,newName,callback){
	getStorage(function(data){
		var windows = data.windows;
		var changedWindow = windows.filter(function(currentWindow){
			return currentWindow.id===windowId;
		});
		if (changedWindow.length===1){
			changedWindow[0].name = newName;
			chrome.storage.local.set({"windows":windows},callback);
			chrome.runtime.sendMessage({'nameChange':{'windowId':windowId,'name':newName}});
		}
		else{
			throw "More than one window has the id "+windowId+". This should never happen."
		}
	});
}

function getWindows(windowList,callback){
	getStorage(function(data){
		if (data!=null){
			setupWindows(windowList,data.windows,callback);
		}
		else{
			throw "Windows is null, this hsould never happen.";
		}
	});
}

function setupWindows(windowList,windows,callback){
	if (windows.length===0){
		callback();
	}
	else{	
		windows.forEach(function(currentWindow){
			setupWindowElement(currentWindow, function(windowLi){
				setupTabs(currentWindow.tabs, function(tabElements){
					var tabsUl = windowLi.querySelector('ul.tabs');
					tabElements.forEach(function(currentTab){
						tabsUl.appendChild(currentTab);
					});
					stripeTabs(tabsUl);
					windowList.appendChild(windowLi);
					callback();
				});
			});			
		});
	}
}

//Sets up all tabs to be in their window elements
function setupWindowElement(currentWindow,callback){
	var li = document.createElement("li");
	var ul = document.createElement("ul");
	var textContent = document.createElement("span");
	var overflowContainer = document.createElement("span");
	var windowName = document.createElement("span");
	var tabInfo = document.createElement("span");
	var tabCount = document.createElement("span");
	var tabWord = document.createElement("span");
	var closeButton = document.createElement("i");
	var clickCount = 0;
	li.classList.add("window");
	li.classList.add("noselect");
	ul.classList.add("tabs");
	li.setAttribute("windowId", currentWindow.id);
	textContent.classList.add("textContent");
	if (!darkMode){
		textContent.classList.add("light");
	}
	overflowContainer.classList.add("overflowContainer");
	tabInfo.classList.add("tabInfo");
	windowName.classList.add("windowName");
	windowName.textContent = currentWindow.name;
	tabCount.classList.add("tabCount");
	tabCount.textContent = currentWindow.tabs.length.toString();
	tabWord.classList.add("tabWord");
	tabWord.textContent = (currentWindow.tabs.length>1 ? " tabs":" tab");
	closeButton.classList.add("fa");
	closeButton.classList.add("fa-remove");
	closeButton.classList.add("windowClose");
	closeButton.classList.add("noselect");
	closeButton.classList.add("pointer");
	closeButton.setAttribute("title", "Close window");
	textContent.addEventListener('click',function(event){
		if (event.clientX>windowName.getBoundingClientRect().left && event.clientX<windowName.getBoundingClientRect().right){
			windowName.click();
		}
		else if (event.clientX>closeButton.getBoundingClientRect().left && event.clientX<closeButton.getBoundingClientRect().right){
			closeButton.click();
		}
		else{
			chrome.windows.update(currentWindow.id, {'focused':true});
		}
	});
	textContent.addEventListener('dblclick',function(event){
		if (event.clientX>windowName.getBoundingClientRect().left && event.clientX<windowName.getBoundingClientRect().right){
			windowName.dispatchEvent(new MouseEvent('dblclick',{
				'view':window,
				'bubbles':true,
				'cancellable':true
			}));
		}
	});
	windowName.addEventListener('click', function(event){
		event.stopPropagation();
		clickCount+=1;
		setTimeout(function(){
			if (clickCount===1){
				textContent.click();
			}
			clickCount = 0;
		}, 300);
	});
	windowName.addEventListener('dblclick', function(event){
		var input = document.createElement('input');
		input.setAttribute('value',windowName.textContent);
		input.addEventListener('keydown', function(event){
			event.stopPropagation();
			if(event.keyCode===13 && input.value.length>0){
				event.preventDefault();
				windowName.textContent = input.value;
				input.parentNode.replaceChild(windowName,input);
				changeWindowName(currentWindow.id, input.value);
			}
		});
		windowName.parentNode.replaceChild(input,windowName);
		input.focus();
		input.select();
	});
	closeButton.addEventListener("click", function(event){
		event.preventDefault();
		event.stopPropagation();
		//When shift is held, close all windows but this one
		if (shiftDown){
			var windowList = Array.prototype.slice.call(li.parentNode.childNodes);	
			windowList.forEach(function(windowItem){
				var windowId = parseInt(windowItem.getAttribute("windowId"));
				if (windowId!==currentWindow.id){
					chrome.windows.remove(windowId,function(){
						console.log(windowItem);
						conosle.log(windowName.parentNode);
						windowItem.parentNode.removeChild(windowItem);
						setHeights();
					});
				}
			});
		}
		else{
			chrome.windows.remove(currentWindow.id,function(){
				li.parentNode.removeChild(li);
				setHeights();
			});
		}
	});
	
	var mouseListenerFunction = function(event){
		//If the mouse is within the bounds of the closeButton, highlight it as if it's being hovered.
		if (event.clientX>=closeButton.getBoundingClientRect().left && event.clientX<=closeButton.getBoundingClientRect().right){
			closeButton.classList.add('fakeHover');
		}
		else{
			closeButton.classList.remove('fakeHover');
		}	
	}
	
	textContent.addEventListener('mousein', mouseListenerFunction);
	textContent.addEventListener('mousemove', mouseListenerFunction);
	textContent.addEventListener('mouseout', function(event){
		closeButton.classList.remove('fakeHover');
	});
	
	tabInfo.appendChild(tabCount);
	tabInfo.appendChild(tabWord);
	overflowContainer.appendChild(windowName);
	overflowContainer.appendChild(tabInfo);
	textContent.appendChild(overflowContainer);
	textContent.appendChild(closeButton);
	li.appendChild(textContent);
	li.appendChild(ul);
	callback(li);
}

function setupTabs(tabs,callback){
	var tabElements = [];
	tabs.forEach(function(currentTab){
		//Workaround for null elements. not final.
		if (currentTab===null){
			console.log("[DEBUG] NULL ELEMENT WAS FOUND. SKIPPING OVER.");
			return;
		}
		var li = document.createElement("li");
		var textSpan = document.createElement("span");
		var closeButton = document.createElement("i");
		var pinButton = document.createElement("i");
		var detachButton = document.createElement("i");
		li.setAttribute('tabId', currentTab.id);
		closeButton.classList.add("fa");
		closeButton.classList.add("fa-remove");
		closeButton.classList.add("close");
		closeButton.classList.add("noselect");
		closeButton.classList.add("pointer");
		closeButton.setAttribute("title", "Close tab");
		pinButton.classList.add("fa");
		pinButton.classList.add("fa-thumb-tack");
		pinButton.classList.add("pin");
		pinButton.classList.add("noselect");
		pinButton.classList.add("pointer");
		pinButton.setAttribute("title", "Pin tab");
		detachButton.classList.add("fa");
		detachButton.classList.add("fa-external-link-square");
		detachButton.classList.add("detach");
		detachButton.classList.add("noselect");
		detachButton.classList.add("pointer");
		detachButton.setAttribute("title", "Detach tab into window");
		
		if (currentTab.pinned){
			pinButton.classList.add("pinned");
			pinnedTabs.push(li);
		}
		li.classList.add("tab");
		li.classList.add("noselect");
		li.classList.add("pointer");
		if (!darkMode){
			li.classList.add("light");
		}
		//Setup favicon
		if (currentTab.favIconUrl!==undefined && currentTab.favIconUrl!==null && currentTab.favIconUrl.indexOf("chrome://")===-1){
			li.style.backgroundImage = "url(\'"+currentTab.favIconUrl+"\')";
		}
		else{
			li.style.backgroundImage = "url(\'img/default-favicon.png\')";
		}
		li.setAttribute("tabUrl", currentTab.url);
		textSpan.classList.add("tabName");
		textSpan.textContent=currentTab.title;
		if (textSpan.textContent==""){
			textSpan.textContent="Untitled";	
		}

		closeButton.addEventListener('click',function(event){
			event.preventDefault();
			event.stopPropagation();
			if (shiftDown){
				var tabList = Array.prototype.slice.call(li.parentNode.childNodes);
				tabList.forEach(function(windowTab){
					var tabId = parseInt(windowTab.getAttribute("tabId"));
					if (tabId!==currentTab.id){
						chrome.tabs.remove(tabId,function(){
							windowTab.parentNode.removeChild(windowTab);
						});
					}
				});
				setTabCount(li.parentNode, 1);
			}
			else{
				chrome.tabs.remove(currentTab.id);
				decrementTabCount(li.parentNode);
				if (li.parentNode.childNodes.length===1){ //If it's one this means we're removing the window.
					li.parentNode.parentNode.parentNode.removeChild(li.parentNode.parentNode);
				}
				else{
					li.parentNode.removeChild(li);
				}
			}
			setHeights();
		});
		
		pinButton.addEventListener('click',function(event){
			event.preventDefault();
			event.stopPropagation();
			if (pinButton.classList.contains('pinned')){
				pinButton.classList.remove("pinned");
				chrome.tabs.update(currentTab.id, {'pinned':false});
			}
			else{
				pinButton.classList.add("pinned");
				chrome.tabs.update(currentTab.id, {'pinned':true});
				unmovedPins.push(li);
			}
		});
		
		detachButton.addEventListener('click', function(event) {
			chrome.windows.create({"tabId":currentTab.id});
		});
		
		//Switches to the tab clicked
		li.addEventListener('click',function(event){
			event.stopPropagation();
			//If the mouse is clicked within the bounds of the closeButton, simulate a click event and return.
			if (event.pageX>=closeButton.getBoundingClientRect().left && event.pageX<=closeButton.getBoundingClientRect().right){
				closeButton.click();
				return;
			}
			//If the mouse is clicked within the bounds of the pinButton, simulate a click event and return.
			if (event.pageX>=pinButton.getBoundingClientRect().left && event.pageX<=pinButton.getBoundingClientRect().right){
				pinButton.click();
				return;
			}
			//If the mouse is clicked iwthin the bounds of the detachButton, simulate a click event and return.
			if (event.pageX>=detachButton.getBoundingClientRect().left && event.pageX<=detachButton.getBoundingClientRect().right){
				detachButton.click();
				return;
			}
			chrome.windows.getCurrent(function(resultWindow){
				if (currentTab.id!=resultWindow.id){
					chrome.windows.update(currentTab.windowId,{'focused':true});
				}
				chrome.tabs.update(currentTab.id,{'highlighted':true,'active':true});
			});
		});
		
		var mouseListenerFunction = function(event){
			//If the mouse is within the bounds of the closeButton, highlight it as if it's being hovered.
			if (event.clientX>=closeButton.getBoundingClientRect().left && event.clientX<=closeButton.getBoundingClientRect().right){
				closeButton.classList.add('fakeHover');
			}
			else{
				closeButton.classList.remove('fakeHover');
			}
			//If the mouse is within the bounds of the pinButton, highlight it as if it's being hovered.
			if (event.clientX>=pinButton.getBoundingClientRect().left && event.clientX<=pinButton.getBoundingClientRect().right){
				pinButton.classList.add('fakeHover');
			}
			else{
				pinButton.classList.remove('fakeHover');
			}
			//If the mouse is within the bounds of the detachButton, highlight it as if it's being hovered.
			if (event.clientX>=detachButton.getBoundingClientRect().left && event.clientX<=detachButton.getBoundingClientRect().right){
				detachButton.classList.add('fakeHover');
			}
			else{
				detachButton.classList.remove('fakeHover');
			}

		}
		
		li.addEventListener('mousein', mouseListenerFunction);
		li.addEventListener('mousemove', mouseListenerFunction);
		li.addEventListener('mouseout', function(event){
			closeButton.classList.remove('fakeHover');
			pinButton.classList.remove('fakeHover');
			detachButton.classList.remove('fakeHover');
		});
		li.appendChild(textSpan);
		textSpan.appendChild(pinButton);
		textSpan.appendChild(detachButton);
		textSpan.appendChild(closeButton);
		tabElements.push(li);
	});
	callback(tabElements);
}

function decrementTabCount(tabsUl){
	var li = tabsUl.parentNode;
	if (li.tagName.toLowerCase()!='li' || !li.classList.contains("window")){
		throw "Not a tabs ul";
	}	
	var tabCount = li.querySelector('span.tabInfo>span.tabCount');
	var num = parseInt(tabCount.textContent)-1;
	tabCount.textContent=num.toString();
	var windows = li.parentNode;
	if (windows.tagName.toLowerCase()!='ul' || windows.id!="windows"){
		throw "Not a tabs ul";
	}
	if (num===1){
		li.querySelector('span.tabInfo>span.tabWord').textContent = " tab"
	}
	setHeights();
}

function setTabCount(tabsUl,num){
	var li = tabsUl.parentNode;
	if (li.tagName.toLowerCase()!='li' || !li.classList.contains("window")){
		throw "Not a tabs ul";
	}	
	var tabCount = li.querySelector('span.tabInfo>span.tabCount');
	tabCount.textContent=num.toString();
	var windows = li.parentNode;
	if (windows.tagName.toLowerCase()!='ul' || windows.id!="windows"){
		throw "Not a tabs ul";
	}
	if (num===1){
		li.querySelector('span.tabInfo>span.tabWord').textContent = " tab"
	}
	setHeights();
}

function stripeTabs(tabsUl){
	var children = Array.prototype.slice.call(tabsUl.childNodes);
	var odd = true;
	children.forEach(function(child){
		if (!child.classList.contains("filtered")){
			if (odd){
				child.classList.add("odd");
				odd = false;
			}	
			else{
				child.classList.remove("odd");
				odd = true;
			}
		}
		else{
			child.classList.remove("odd");
		}
	});
}

function removeChildren(element){
	Array.prototype.slice.call(element.childNodes).forEach(function(child){
		element.removeChild(child);
	});
}
function search(query,mainList,callback){
	var noResults = document.getElementById("noResults");
	var itemFound = false; //If no items are found, this will be trie and noResults will be displayed
	
	Array.prototype.slice.call(mainList.childNodes).forEach(function(currentWindow,i){
		var tabList = createTabList(mainList, i, true);
		//This should never happen, but it's a just in case.
		if (tabList.length===0){
			return false;
		}
		var tabUl = tabList[0].parentNode;
		var tabCount = 0;
		tabList.forEach(function(currentTab){
			if (currentTab.textContent.toLowerCase().indexOf(query.toLowerCase())>-1 || new URL(currentTab.getAttribute("tabUrl")).hostname.indexOf(query)>-1){
				currentTab.classList.remove('filtered');
				tabCount+=1;
			}
			else{
				currentTab.classList.add('filtered');
			}
		});
		if (tabCount===0){
			currentWindow.classList.add('filtered');
		}
		else{
			currentWindow.classList.remove('filtered');
			itemFound = true;
		}
		stripeTabs(tabUl); //This will
		setTabCount(tabUl, tabCount);
	});
	if(!itemFound){
		noResults.style.display = "block";
	}
	else{
		noResults.style.display = "none";
	}
	callback();
}

function createWindowList(mainList,includeFiltered){
	var windowList = Array.prototype.slice.call(mainList.querySelectorAll('li.window'));
	if (includeFiltered){
		return windowList;
	}
	else{
		return windowList.filter(function(currentWindow){
			return !currentWindow.classList.contains("filtered");
		});
	}
}

function createTabList(mainList,windowKeyIndex,includeFiltered,windowList){
	if (windowList===undefined){
		var windowList = createWindowList(mainList, includeFiltered);
	}
	var tabList = Array.prototype.slice.call(windowList[windowKeyIndex].querySelector('ul.tabs').childNodes);
	if (includeFiltered){
		return tabList;
	}
	else{
		return tabList.filter(function(currentTab){
			return !currentTab.classList.contains("filtered");
		});
	}
	
}
function setHeights(){
	var windows = document.getElementById("windows");
	var body = document.querySelector("body");
	var html = document.querySelector("html");
	var filterInput = document.getElementById("search");
	var noResults = document.getElementById("noResults");
	var height = windows.offsetHeight+filterInput.offsetHeight;
	var style = getComputedStyle(windows);
	if (noResults.style.display!=="none" && getComputedStyle(noResults).display!=="none"){
		html.style.height = filterInput.getBoundingClientRect().bottom+"px";
		body.style.height = filterInput.getBoundingClientRect().bottom+"px";
	}
	else{
		if (style.marginTop.length>0){
			height+=parseInt(style.marginTop);
		}
		if (style.marginBottom.length>0){
			height+=parseInt(style.marginBottom);
		}
		if (height>=600){
			height = 600;
		}
		height+="px";
		html.style.height = height;
		body.style.height = height;
	}
}
document.addEventListener('DOMContentLoaded', function() {
	var mainList = document.getElementById("windows");
	var filterInput = document.getElementById("search");
	var windowKeyIndex = -1; //-1 indicdatesnothing is selected. ANything above that indicates that a window is selected
	var tabKeyIndex = -2; //-2 indicates nothing is selected. -1 indicates the window is selected. Anything above that indicates that a tab is selected.
	getOptions(function(data){
		darkMode = data.options.darkMode;
		getWindows(mainList,setHeights);
	});
	filterInput.addEventListener('input', function(event){
		if (filterInput.value.length>0){
			mainList.classList.add("searching");
		}
		else{
			mainList.classList.remove("searching");
		}
		search(filterInput.value,mainList,setHeights);
	});
	//Workaround to prevent letters from triggering events.
	filterInput.addEventListener('keydown', function(event){
		if (event.keyCode!==40 && event.keyCode!==38 && event.keyCode!==13 && event.keyCode!==33 && event.keyCode!==34){
			event.stopPropagation();
		}
		if (event.keyCode===16){
			shiftDown = true;
		}
	});

	chrome.tabs.onMoved.addListener(function(tabId,object){
		if (!mainList.classList.contains('searching')){
			var startPos = object.fromIndex;
			var endPos = object.toIndex;
				var pinnedTab = unmovedPins.filter(function(tab){
				return parseInt(tab.getAttribute('tabId'))===tabId;
			});

			if (pinnedTab.length===0){
				pinnedTab = pinnedTabs.filter(function(tab){
					return parseInt(tab.getAttribute('tabId'))===tabId;
				});
			}

			if (pinnedTab.length===1){
				pinnedTab = pinnedTab[0];
				var ul = pinnedTab.parentNode; 
				var children = Array.prototype.slice.call(ul.childNodes);
				var pinnedPos = unmovedPins.indexOf(pinnedTab);
				if (pinnedPos==-1){
					pinnedPos = pinnedTabs.indexOf(pinnedTab);
				}
				var temp = children[startPos];
				children.splice(startPos,1);
				children.splice(endPos, 0,temp);
				removeChildren(ul);
				children.forEach(function(child){
					ul.appendChild(child);
				});
				pinnedTabs.push(pinnedTab);
				unmovedPins.splice(pinnedPos,1);
				if (pinnedTab.classList.contains("keyHover")){
					tabKeyIndex = endPos;
				}
			}
			else{
				debugger;
				console.log(pinnedTab);
			}
		}
	});

	window.addEventListener('keydown', function(event){
		var windowList = createWindowList(mainList);
		var tabList = windowKeyIndex>=0 ? createTabList(mainList,windowKeyIndex) : null;
		//Track if shift is pressed
		if (event.keyCode===16){
			shiftDown = true;
		}

		//If down is pressed, traverse through tabs. If page down is pressed, traverse through windows.
		else if (event.keyCode===40 || event.keyCode===34){
			event.preventDefault();
			event.stopPropagation();
			if (document.activeElement===filterInput){
				filterInput.blur();
			}
			//If shift and down are pressed, or page down is pressed, traverse through windows
			if (shiftDown || event.keyCode===34){
				if (windowKeyIndex<windowList.length-1){
					if (windowKeyIndex>=0)
						windowList[windowKeyIndex].classList.remove('keyHover');
					if (tabKeyIndex>=0)
						tabList[tabKeyIndex].classList.remove('keyHover');
					tabKeyIndex=-1;
					windowKeyIndex+=1;
					windowList[windowKeyIndex].classList.add('keyHover');
					if (windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().bottom>document.querySelector('body').clientHeight){
						var scrollAmount = windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().bottom - document.querySelector('body').clientHeight/2;
						scrollBy(0,scrollAmount>windowList[windowKeyIndex].querySelector('span.textContent').clientHeight ? scrollAmount : windowList[windowKeyIndex].querySelector('span.textContent').clientHeight);
					}
				}
			}
			//If nothing is selected, select the the window itself.
			else if (tabKeyIndex===-2){
				if (windowKeyIndex>=0)
					windowList[windowKeyIndex].classList.remove('keyHover');
				windowKeyIndex+=1;
				windowList[windowKeyIndex].classList.add('keyHover');
				tabKeyIndex+=1;
				if (windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().bottom<=0){
					scrollTo(0, windowList[windowKeyIndex].getBoundingClientRect().top);
				}
			}
			//If we're at the last element, switch windows.
			else if (tabKeyIndex===tabList.length-1){
				if (windowKeyIndex<windowList.length-1){
					tabList[tabKeyIndex].classList.remove('keyHover');
					windowKeyIndex+=1;
					tabKeyIndex = -1;
					windowList[windowKeyIndex].classList.add('keyHover');
					if (windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().bottom>=document.querySelector('body').clientHeight){
						var scrollAmount = windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().bottom - document.querySelector('body').clientHeight;
						scrollBy(0,scrollAmount>windowList[windowKeyIndex].querySelector('span.textContent').clientHeight ? scrollAmount : windowList[windowKeyIndex].querySelector('span.textContent').clientHeight);
					}
					else if (windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().bottom<=0){
						scrollTo(0, windowList[windowKeyIndex].getBoundingClientRect().bottom);
					}
				}
			}
			//Otherwise, just traverse the tab list.
			else if (tabKeyIndex<tabList.length-1){
				windowList[windowKeyIndex].classList.remove('keyHover');
				if (tabKeyIndex>=0){
					tabList[tabKeyIndex].classList.remove('keyHover');
				}
				tabKeyIndex+=1;
				tabList[tabKeyIndex].classList.add('keyHover');
			}
			//Scroll if the index passes the bottom border
			if (tabKeyIndex>=0 && tabList[tabKeyIndex].getBoundingClientRect().bottom>document.querySelector('body').clientHeight){
				//Get the amount less than the height that the element is
				var scrollAmount = tabList[tabKeyIndex].getBoundingClientRect().bottom - document.querySelector('body').clientHeight;
				//Scroll by either the height or scrollAmount, whichever is greater.
				scrollBy(0,scrollAmount>tabList[tabKeyIndex].clientHeight ? scrollAmount : tabList[tabKeyIndex].clientHeight);
			}
			//If the user has scrolled off screen, but down is pressed, scroll to it.
			else if (tabKeyIndex>=0 && tabList[tabKeyIndex].getBoundingClientRect().bottom<=0){
				scrollTo(0, tabList[tabKeyIndex].getBoundingClientRect().bottom);
			}
		}
		//If up is pressed, traverse through tabs
		else if (event.keyCode===38 || event.keyCode===33 ){
			event.preventDefault();
			event.stopPropagation();
			//If shift is down, or page up is pressed, traverse windows
			if (shiftDown || event.keyCode===33){
				if (windowKeyIndex>0){
					windowList[windowKeyIndex].classList.remove('keyHover');
					if (tabKeyIndex>=0)
						tabList[tabKeyIndex].classList.remove('keyHover');
					tabKeyIndex=-1;
					windowKeyIndex-=1;
					windowList[windowKeyIndex].classList.add('keyHover');
					if (windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().top<=0){
						var scrollAmount = document.querySelector('body').clientHeight/2 -windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().bottom;
						scrollBy(0,scrollAmount>windowList[windowKeyIndex].querySelector('span.textContent').clientHeight ? scrollAmount*-1 : windowList[windowKeyIndex].querySelector('span.textContent').clientHeight*-1);
					}
				}
			}
			//If a window is selected, switch to the next one.
			else if (tabKeyIndex===-1){
				windowList[windowKeyIndex].classList.remove('keyHover');
				if (windowKeyIndex>0){
					windowKeyIndex-=1;
					tabList = createTabList(mainList, windowKeyIndex);
					tabKeyIndex = tabList.length-1;
					tabList[tabKeyIndex].classList.add('keyHover');
				}
				//If it's the first window, highlight the search bar
				else{
					windowKeyIndex = -1;
					tabKeyIndex = -2;
					filterInput.focus();
				}
			}
			//If we're at the top of a tab list, highlight the window itself.
			else if (tabKeyIndex===0){
				tabList[tabKeyIndex].classList.remove('keyHover');
				windowList[windowKeyIndex].classList.add('keyHover');
				tabKeyIndex-=1;
			}
			//In all other instances, just move up one.
			else if (tabKeyIndex>0){
				windowList[windowKeyIndex].classList.remove('keyHover');
				tabList[tabKeyIndex].classList.remove('keyHover');
				tabKeyIndex-=1;
				tabList[tabKeyIndex].classList.add('keyHover');
			}
			//Scroll if the tab index passes the top border.
			if (tabKeyIndex>=0 && tabList[tabKeyIndex].getBoundingClientRect().top<=0){
				scrollBy(0, tabList[tabKeyIndex].getBoundingClientRect().top);
			}
			//If the user has scrolled off screen, but up is pressed, scroll to it.
			else if (tabKeyIndex>=0 && tabList[tabKeyIndex].getBoundingClientRect().bottom>=document.querySelector('body').clientHeight){
				//Get the amount less than the height that the element is
				var scrollAmount = tabList[tabKeyIndex].getBoundingClientRect().bottom - document.querySelector('body').clientHeight;
				//Scroll by either the height or scrollAmount, whichever is greater.
				scrollBy(0,scrollAmount>tabList[tabKeyIndex].clientHeight ? scrollAmount : tabList[tabKeyIndex].clientHeight);
			}
			//If switching windows, scroll by the amount that the window is off the screen.
			else if (tabKeyIndex===-1 && windowList[windowKeyIndex].getBoundingClientRect().top<=0){
				scrollBy(0, windowList[windowKeyIndex].querySelector('span.textContent').getBoundingClientRect().top);
			}
		}
		//If enter is pressed, switch to the tab.
		else if (event.keyCode===13){
			if (tabKeyIndex>=0){
				tabList[tabKeyIndex].click();
			}
			else if (tabKeyIndex==-1){
				windowList[windowKeyIndex].querySelector('span.textContent').click();
			}
			else if (tabKeyIndex===-2 && mainList.classList.contains('searching')){
				createTabList(mainList, 0)[0].click();
			}
		}
		//Close when c is pressed
		else if (event.keyCode===67){
			if (tabKeyIndex>=0){
				tabList[tabKeyIndex].querySelector('i.close').click();
				tabList.splice(tabKeyIndex, 1);
				//Move the selection after pressing c.
				//Check to make sure we're not leaving the bounds of the list
				if (shiftDown){
					tabKeyIndex = 0;
				}
				else if (tabKeyIndex-1>0){
					tabKeyIndex-=1;
				}
				//If we're closing a window with only one tab left, move to the previous list.
				if (tabList.length===0){
					//Remove the list from the popup
					//If we're at the front of the list, we move to the window below it.
					if (windowKeyIndex===0){
						tabList = createTabList(mainList, windowKeyIndex);
						tabKeyIndex=0;
					}
					//Otherwise, we move up one.
					else{
						windowKeyIndex-=1;
						tabList = createTabList(mainList, windowKeyIndex);
						tabKeyIndex=tabList.length-1;
					}	
				}
				tabList[tabKeyIndex].classList.add('keyHover');
			}
			else if (tabKeyIndex==-1){
				console.log(windowList);
				windowList[windowKeyIndex].querySelector('i.windowClose').click();
				windowList.splice(windowKeyIndex, 1);
				windowList[windowKeyIndex].classList.add('keyHover');
			}
		}
		//Pin when p is pressed
		else if(event.keyCode===80){
			if (tabKeyIndex>=0){
				tabList[tabKeyIndex].querySelector('i.pin').click();
			}
		}
		//Go to search box when s is pressed.
		else if (event.keyCode===83){
			event.preventDefault();
			scrollTo(0, 0);
			filterInput.focus();
		}
		//Rename a window when R is pressed
		else if (event.keyCode===82){
			event.preventDefault();
			if (tabKeyIndex===-1){
				var windowList = createWindowList(mainList);
				windowList[windowKeyIndex].querySelector('span.windowName').dispatchEvent(new MouseEvent('dblclick',{
					'view':window,
					'bubbles':true,
					'cancellable':true
				}));
			}
		}
		//Detach a tab into a window when D is pressed.
		else if (event.keyCode===68){
			event.preventDefault();
			if (tabKeyIndex>=0){
				tabList[tabKeyIndex].querySelector('i.detach').click();
			}
		}
				
	});
	
	
	window.addEventListener('keyup', function(event){
		//Track if shift is released
		if (event.keyCode===16){
			shiftDown = false;
		}
	});
	
	filterInput.addEventListener('focus', function(event){
		var windowList = createWindowList(mainList);
		windowList.forEach(function(currentWindow,i){
			currentWindow.classList.remove('keyHover');
			var tabList = createTabList(mainList, i);
			tabList.forEach(function(currentTab){
				currentTab.classList.remove('keyHover');
			});
			
		});
		windowKeyIndex = -1;
		tabKeyIndex = -2;
	});
});	