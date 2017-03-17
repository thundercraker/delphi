/*
This simple library will store action items to LocalStorage. An action item is an object that represents some action 
on a website. All Action Logs have the format:

	{ timestamp: Int, id: String, optional: object }

Helper methods are provided to make use of these logs to sift through them and find certain subsets which can then be
send to some sort of reporting service
*/

Delphi = function(window, flushCallback) {
	//Allow the window global object to be injected
	this.injector = function() { return window; };
	//A dictionary of tuples (callbackId, callback)
	this.registeredCallbacks = {};
	//Callback that is given the log items that are flushed during History Flush
	this.flushCallback = flushCallback;
};

Delphi.Configs = {
	//SetLogs will start deleting oldest items one this limit is reached
	HARD_ITEM_LIMIT: 200,
	//Minimum amount of items before logs get sent during History Flush
	HISTORY_MIN_BUFFER: 20
};

//Unique key to use for LocalStorage
Delphi.LogItemId = "DELPHI_ACTION_LOG";

//Methods to log actions
Delphi.prototype.LogAction = function(id, optional) {
	if(typeof(id) === "string") {
		this.WithLS(function(ref, log) {
			log = log || [];
			if(log.length + 1 > Delphi.Configs.HARD_ITEM_LIMIT) {
				log = log.splice(log.length + 1 - Delphi.Configs.HARD_ITEM_LIMIT);
			}
			log.push({timestamp: Date.now(), id: id, optional: optional || {}});
			//execute the callbacks
			if(ref.registeredCallbacks[id]) {
				for(var k in ref.registeredCallbacks[id]) {
					ref.registeredCallbacks[id][k](ref, ref.GetLogs());
				}
			}
			return log;
		});
	}
};

//Get all the logs
Delphi.prototype.GetLogs = function() {
	var logs = "";
	this.WithLS(function(ref, log) {
		logs = log;
	});
	return logs;
};

//Set logs
Delphi.prototype.SetLogs = function(logs) {
	this.injector().localStorage.setItem(Delphi.LogItemId, JSON.stringify(logs));
};

//Provide a given block with the current log item array
//If the block returns anything, that will replace the current logs
//No type security
Delphi.prototype.WithLS = function(block) {
	if(typeof(this.injector().localStorage) !== "undefined") {
		var actionlog = [], raw ="";
		try {
			raw = this.injector().localStorage.getItem(Delphi.LogItemId);
			actionlog = JSON.parse(raw);
			if(typeof(actionlog.push) !== 'function') throw 'corrupted';
		} catch(err) {
			this.injector().localStorage.setItem(Delphi.LogItemId, JSON.stringify([]));
		}
		if(typeof(actionlog) === "undefined") {
			actionlog = [];
			this.SetLogs([]);
		}
		if(typeof(block) === "function") {
			var logUpdate = block(this, actionlog);
			if (typeof(logUpdate) !== "undefined") {
				this.SetLogs(logUpdate);
			}
		}
	}
};

//Allows the addition of a callback to be made if an action is logged
//with LogAction
Delphi.prototype.OnLog = function(actionId, callbackId, callback) {
	if(typeof(this.registeredCallbacks[actionId]) === "undefined") {
		this.registeredCallbacks[actionId] = {};
	}
	this.registeredCallbacks[actionId][callbackId] = callback;
}

//Methods to generate matches from logs
//Needlestack - Dictionary of Arrays of event IDs and a name for the event sequence, each event ID arrray represents an order of events to look for
//Haystack - a series of events, by default the complete event log
//Returns - dict of event sequences found with the log items of sequence
Delphi.prototype.FindSubsetInOrder = function(needlestack, haystack) {
	var list = {};
	if(typeof(haystack) === "undefined")
		haystack = this.GetLogs();
	for(var hayKey in haystack) {
		for(var needlesKey in needlestack) {
			if(needlestack[needlesKey][0] === haystack[hayKey].id) {
				needlestack[needlesKey] = needlestack[needlesKey].splice(1);
				if(typeof(list[needlesKey]) === "undefined") {
					list[needlesKey] = [ haystack[hayKey] ];
				} else {
					list[needlesKey].push(haystack[hayKey]);
				}
			}
		}
	}
	for(var lk in list) {
		if(needlestack[lk].length > 0) {
			delete list[lk];
		}
	}
	return list;
};

//Returns all events since the latest occurance of an action
Delphi.prototype.EventsSinceLastOccuranceOf = function(actionId, haystack) {
	if(typeof(haystack) === "undefined")
		haystack = this.GetLogs();
	var i = haystack.length - 1;
	for (; i >= 0; i--) {
		if(haystack[i].id === actionId) {
			break;
		} else if(i === 0) {
			i = -1;
		}
	}
	return (i > -1) ? haystack.splice(i) : [];
};

//Find the latest occurance of an action
Delphi.prototype.FindLatestOccurance = function(actionId, haystack) {
	if(typeof(haystack) === "undefined")
		haystack = this.GetLogs();
	var i = haystack.length - 1;
	for (; i >= 0; i--) {
		if(actionId === (haystack[i].id || "")) {
			return haystack[i];
		}
	}
};

//Appends an action to a dictionary of arrays of logs
Delphi.prototype.AppendToResultSets = function(sets, item) {
	if(typeof(item) !== "undefined" || typeof(sets) !== "undefined") {
		for(var k in sets) {
			sets[k].unshift(item);
		}
		return sets;
	}
};

//Will send all logs that have not been marked to a callback service
//Logs that are sent to the callback are marked
Delphi.prototype.LogHistoryAndMark = function(force) {
	force = (typeof(force) !== "boolean") ? false : force;
	var history = [], copy = [];
	var current = this.GetLogs();
	for(var k in current) {
		var l = current[k]; 
		if(typeof(l.x) === "undefined") {
			history.push({ timestamp: l.timestamp, id: l.id, optional: l.optional, x: 1 });
			copy.push({ timestamp: l.timestamp, id: l.id, optional: l.optional, x: 1 });
		} else {
			copy.push({ timestamp: l.timestamp, id: l.id, optional: l.optional, x: l.x });
		}
	}
	if(history.length > Delphi.Configs.HISTORY_MIN_BUFFER || force) {
		this.SetLogs(copy);
		this.flushCallback(history);
	}
};

var module = module || {};
module.exports = Delphi;