import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";

/**
 * @namespace com.rprincipees.registroavescombate.controller
 */
export default class Welcome extends Controller {

    /*eslint-disable @typescript-eslint/no-empty-function*/
    public onInit(): void {

    }

    public onNavToLista(): void {
        console.log("Navegando a lista...");
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList"); // Ruta hacia la vista Main (lista de aves)
        console.log("ok");
    }
}