import Controller from "sap/ui/core/mvc/Controller";
import MessageBox from "sap/m/MessageBox";
import Input from "sap/m/Input";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import {AuthService} from "com/rprincipees/registroavescombate/services/AuthService";
import Event from "sap/ui/base/Event";

export default class ForgotPassword extends Controller {
    private authService: AuthService;

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteResetPassword")?.attachPatternMatched(this._onRouteMatched, this);
    }

    private _onRouteMatched(oEvent: Event): void {

    }

    public onNavBack = (): void => {
        history.back();
    };

    public onEnviarRecuperacion = async (): Promise<void> => {
        const oInput = this.byId("inputEmail") as Input;
        const email = oInput.getValue().trim().toLowerCase();

        if (!email) {
            MessageBox.warning("Ingresa tu correo");
            return;
        }

        try {

            const response = await this.authService.forgotPassword(email);

            if (!response.success) {
                MessageBox.error(response?.error?.message || response?.message || "No se pudo procesar la solicitud");
                return;
            }

            MessageBox.success(
                response?.message || "Si el correo existe, se enviará un enlace para restablecer la contraseña.",
                {
                    onClose: () => {
                        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
                        oRouter?.navTo("RouteLogin");
                    }
                }
            );
        } catch (error) {
            MessageBox.error("No se pudo conectar con el servidor");
        }
    };
}