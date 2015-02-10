function getWindows(windowList,callback){
	chrome.windows.getAll(function(windows){
		//loop through every window and append it ot the list
		windows.forEach(function(currentWindow,i){
			getTabs(currentWindow.id,function(tabs){
				var li = document.createElement("li");
				var ul = document.createElement("ul");
				li.classList.add("window");
				li.textContent="Window "+(i+1)+" - "+tabs.length+ (tabs.length>1 ? " tabs":" tab");
				tabs.forEach(function(currentTab){
					ul.appendChild(currentTab);
				});
				li.appendChild(ul);
				windowList.appendChild(li);
				callback(li);
			});
		});
	});

}

function getTabs(windowId,callback){
	var windowTabs = []
	chrome.tabs.query({'windowId':windowId},function(tabs){
		tabs.forEach(function(currentTab){
			var li = document.createElement("li");
			var closeButton = document.createElement("i");
			closeButton.classList.add("fa");
			closeButton.classList.add("fa-remove");
			closeButton.classList.add("close");
			closeButton.classList.add("noselect");
			closeButton.onclick = function(event){
				event.preventDefault();
				event.stopPropagation();
				chrome.tabs.remove(currentTab.id);
				ul.removeChild(li);
			}
			li.classList.add("tab");
			li.textContent=currentTab.title;
			li.appendChild(closeButton);
			windowTabs.push(li);
		});
		callback(windowTabs);
	});
}

document.addEventListener('DOMContentLoaded', function() {
	var mainList = document.getElementById("windows");
	var body = document.getElementsByTagName("body")[0];
	var html = document.getElementsByTagName("html")[0];
	var totalHeight = 0;
	getWindows(mainList,function(tabs){
		totalHeight+=tabs.clientHeight;
		var height = 600+"px";
		if (totalHeight<600){
			height = totalHeight+"px";
		}
		html.style.height = height;
		body.style.height = height;
	});
	
	
});