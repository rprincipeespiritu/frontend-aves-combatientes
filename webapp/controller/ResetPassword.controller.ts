import Controller from "sap/ui/core/mvc/Controller";
import MessageBox from "sap/m/MessageBox";
import Input from "sap/m/Input";
import {AuthService} from "com/rprincipees/registroavescombate/services/AuthService";
import UIComponent from "sap/ui/core/UIComponent";
import Event from "sap/ui/base/Event";

export default class ResetPassword extends Controller {
    private _token: string = "";
    private authService: AuthService;

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteResetPassword")?.attachPatternMatched(this._onRouteMatched, this);
    }

    private _onRouteMatched(oEvent: Event): void {
        const args = oEvent.getParameter("arguments") as { token?: string };
        this._token = args.token || "";
    }

    public onRestablecerPassword = async (): Promise<void> => {
        const newPassword = (this.byId("inputNewPassword") as Input).getValue();
        const confirmPassword = (this.byId("inputConfirmPassword") as Input).getValue();

        if (!newPassword || !confirmPassword) {
            MessageBox.warning("Completa ambos campos");
            return;
        }

        if (newPassword !== confirmPassword) {
            MessageBox.warning("Las contraseñas no coinciden");
            return;
        }

        if (newPassword.length < 6) {
            MessageBox.warning("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        try {

            const response = await this.authService.resetPassword(this._token, newPassword);
            if (!response.success) {
                MessageBox.error(response?.error?.message || response?.message || "No se pudo actualizar la contraseña");
                return;
            }

            MessageBox.success(response?.message || "Contraseña actualizada correctamente", {
                onClose: () => {
                    this.getOwnerComponent()?.getRouter().navTo("RouteLogin");
                }
            });
        } catch (error) {
            MessageBox.error("No se pudo conectar con el servidor");
        }
    };
}