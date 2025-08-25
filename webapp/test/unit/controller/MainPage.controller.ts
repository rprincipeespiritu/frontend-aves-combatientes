/*global QUnit*/
import Controller from "com/rprincipees/registroavescombate/controller/List.controller";

QUnit.module("Main Controller");

QUnit.test("I should test the Main controller", function (assert: Assert) {
	const oAppController = new Controller("List");
	oAppController.onInit();
	assert.ok(oAppController);
});