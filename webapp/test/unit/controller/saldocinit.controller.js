/*global QUnit*/

sap.ui.define([
	"zui_saldoc2/zui_saldoc2/controller/saldocinit.controller"
], function (Controller) {
	"use strict";

	QUnit.module("saldocinit Controller");

	QUnit.test("I should test the saldocinit controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
