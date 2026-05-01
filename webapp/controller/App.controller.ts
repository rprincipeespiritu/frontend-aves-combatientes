import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import MessageToast from "sap/m/MessageToast";
import { AuthService } from "../services/AuthService";

/**
 * @namespace com.rprincipees.registroavescombate.controller
 */
export default class App extends Controller {

    /*eslint-disable @typescript-eslint/no-empty-function*/
    public onInit(): void {
        const authService = AuthService.getInstance();
        authService.iniciarTimeoutInactividad(() => {
            MessageToast.show("Sesion cerrada por inactividad.");
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLogin");
        });
    }
}
