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
        const irAlLanding = (mensaje?: string): void => {
            if (mensaje) {
                MessageToast.show(mensaje);
            }
            const oComponent = this.getOwnerComponent() as UIComponent & { updateUserModel?: () => void };
            oComponent?.updateUserModel?.();
            oComponent?.getRouter()?.navTo("RouteLanding", {}, true);
        };

        authService.setOnSessionEnded(() => {
            irAlLanding("Sesion finalizada. Vuelve a iniciar sesion.");
        });

        authService.iniciarTimeoutInactividad(() => {
            irAlLanding("Sesion cerrada por inactividad.");
        });
    }
}
