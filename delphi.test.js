describe('[Delphi]', function () {
	/*
	This test is to test the basic functionality of window injection provided by Login Layout
	it is not to test the actual initializations of the modules which should have their own full fledged tests
	see: login.signinpanel.test.js etc
	*/
	var sinon = require('sinon');
	var expect = require("chai").expect;

    var getMetricService;
    var Delphi;

    beforeEach(function() {
	    Delphi = require('./delphi.js');
		Delphi.Configs.HARD_ITEM_LIMIT = 4;
		Delphi.Configs.HISTORY_MIN_BUFFER = 2;
	    getMetricService = function() {
		    return new Delphi(mockWindow);
	    };
    });

    var mockWindow = new FakeWindow();

    //test variables
    function FakeWindow() {
    	this.location = { href: "www.yumashish.com" };
	    //mock LocalStorage API
	    this.localStorage = new (function() {
	    	var stuff = {};
	    	this.getItem = function(id){
	    		return stuff[id];
	    	};
	    	this.setItem = function(id, data) {
	    		stuff[id] = data;
	    	};
	    })();
	}

	it('Delphi should initialize properly', function() {
		var service = new Delphi(mockWindow, "mock");
		expect(service.flushCallback).to.be.equal("mock");
		expect(service.registeredCallbacks).to.not.be.equal(undefined);
		expect(service.injector().location.href).to.be.equal("www.yumashish.com");
	});

	it('Delphi should log properly', function() {
		var service = getMetricService();
		var ids = ['1','2','3','1'];
		for (var i = 0; i < ids.length; i++) {
			service.LogAction(ids[i]);
		}
		var logs = service.GetLogs();
		expect(logs.length).to.be.equal(ids.length);
		for (var j = 0; j < logs.length; j++) {
		 	expect(logs[j].id).to.be.equal(ids[j]);
		 	if(j >= 1)
		 		expect(logs[j - 1].timestamp <= logs[j].timestamp).to.be.equal(true);
		} 
	});

	it('Delphi LogAction should execute callback properly', function() {
		var service = getMetricService();
		var called = 0;
		service.OnLog(3, 'test', function() {
			called = called + 1;
		});
		service.OnLog(1, 'test', function() {
			called = called + 1;
		});
		var ids = ['1','2','3','1'];
		for (var i = 0; i < ids.length; i++) {
			service.LogAction(ids[i]);
		}
		expect(called).to.be.equal(3);
	});

	it('Delphi FindSubsetInOrder works properly', function() {
		var service = getMetricService();
		var logs = [
			{ timestamp:1, id:"Delphi.Actions.LOGIN_OPEN", optional:{ "action" : "signin" } },
			{ timestamp:4, id:"Delphi.Actions.FB_CLICK", optional:{} },
			{ timestamp:22, id:"Delphi.Actions.LOGIN_SWITCH", optional:{ "action" : "signup" } },
			{ timestamp:34, id:"Delphi.Actions.FB_CLICK_SIGNUP", optional:{} },
			{ timestamp:34, id:"Delphi.Actions.SIGNUP_SUBMIT", optional:{} },
			{ timestamp:36, id:"Delphi.Actions.VALIDATE_EMAIL_ERROR_EMPTY", optional:{} },
			{ timestamp:36, id:"Delphi.Actions.VALIDATE_PASSWORD_EMPTY", optional:{} },
			{ timestamp:37, id:"Delphi.Actions.VALIDATE_FIRST_NAME_EMPTY", optional:{} },
			{ timestamp:37, id:"Delphi.Actions.VALIDATE_LAST_NAME_EMPTY", optional:{} },
			{ timestamp:45, id:"Delphi.Actions.SIGNUP_SUBMIT", optional:{} },
			{ timestamp:60, id:"Delphi.Actions.SIGNUP_CALLBACK", optional:{} }
		];
		var search = {
			"signup_success": [ "Delphi.Actions.LOGIN_OPEN", "Delphi.Actions.SIGNUP_CALLBACK" ],
			"signup_resend_success": [ "Delphi.Actions.VALIDATE_PASSWORD_EMPTY", "Delphi.Actions.SIGNUP_CALLBACK" ],
			"fb_click": [ "Delphi.Actions.FB_CLICK" ],
			"signin": [ "Delphi.Actions.LOGIN_OPEN", "Delphi.Actions.SIGNIN_SUBMIT", "Delphi.Actions.SIGNIN_CALLBACK" ]
		};
		var result = service.FindSubsetInOrder(search, logs);
		expect(result["signup_success"][0].id).to.be.equal("Delphi.Actions.LOGIN_OPEN");
		expect(result["signup_success"][1].id).to.be.equal("Delphi.Actions.SIGNUP_CALLBACK");
		expect(result["signup_resend_success"][0].id).to.be.equal("Delphi.Actions.VALIDATE_PASSWORD_EMPTY");
		expect(result["signup_resend_success"][1].id).to.be.equal("Delphi.Actions.SIGNUP_CALLBACK");
		expect(result["fb_click"][0].id).to.be.equal("Delphi.Actions.FB_CLICK");
		expect(result["signin"]).to.be.equal(undefined);
	});

	it('Delphi EventsSinceLastOccuranceOf works properly', function() {
		var service = getMetricService();
		var logs = [
			{ timestamp:1, id:"Delphi.Actions.LOGIN_OPEN", optional:{ "action" : "signin" } },
			{ timestamp:4, id:"Delphi.Actions.FB_CLICK", optional:{} },
			{ timestamp:22, id:"Delphi.Actions.LOGIN_SWITCH", optional:{ "action" : "signup" } },
			{ timestamp:34, id:"Delphi.Actions.SIGNUP_SUBMIT", optional:{} },
			{ timestamp:36, id:"Delphi.Actions.VALIDATE_EMAIL_ERROR_EMPTY", optional:{} },
			{ timestamp:36, id:"Delphi.Actions.VALIDATE_PASSWORD_EMPTY", optional:{} },
			{ timestamp:37, id:"Delphi.Actions.VALIDATE_FIRST_NAME_EMPTY", optional:{} },
			{ timestamp:37, id:"Delphi.Actions.VALIDATE_LAST_NAME_EMPTY", optional:{} },
			{ timestamp:45, id:"Delphi.Actions.SIGNUP_SUBMIT", optional:{} },
			{ timestamp:60, id:"Delphi.Actions.SIGNUP_CALLBACK", optional:{} }
		];
		var result = service.EventsSinceLastOccuranceOf("Delphi.Actions.VALIDATE_LAST_NAME_EMPTY", logs);
		expect(result.length).to.be.equal(3);
		var result1 = service.EventsSinceLastOccuranceOf("Delphi.Actions.FB_CLICK_SIGNUP", logs);
		expect(result1.length).to.be.equal(0);
	});

	it('Delphi Hard Item Limit works properly', function() {
		var service = getMetricService();

		service.LogAction("a");
		service.LogAction("b");
		service.LogAction("c");
		service.LogAction("d");
		service.LogAction("e");
		service.LogAction("f");

		var logs = service.GetLogs();
		var ids = [];
		for(var k in logs) {
			ids.push(logs[k].id);
		}
		expect(ids[0]).to.be.equal("c");
		expect(ids[1]).to.be.equal("d");
		expect(ids[2]).to.be.equal("e");
		expect(ids[3]).to.be.equal("f");
	});

	it('Delphi History logging works properly', function() {
		var flushed;
		var service = new Delphi(mockWindow, function(flogs) {
			flushed = flogs;
		});

		service.LogAction("a");
		service.LogAction("b");
		service.LogAction("c");
		service.LogAction("d");
		service.LogHistoryAndMark();
		var logs = service.GetLogs();
		logs.forEach(function(l) {
			expect(l.x).to.not.be.equal(undefined);
		});
        expect(flushed.length).to.be.equal(logs.length);
        expect(flushed[0].id).to.be.equal("a");
        expect(flushed[3].id).to.be.equal("d");

        flushed = undefined;
		service.LogAction("e");
		service.LogHistoryAndMark();
		logs = service.GetLogs();
		expect(flushed).to.be.equal(undefined);
		expect(logs[3].x).to.be.equal(undefined);

	});
});