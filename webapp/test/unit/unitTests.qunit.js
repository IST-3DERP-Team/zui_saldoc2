/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"zui_saldoc2/zui_saldoc2/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
