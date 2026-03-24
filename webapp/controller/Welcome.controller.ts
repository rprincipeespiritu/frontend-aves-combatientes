import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import { AuthService } from "../services/AuthService";

export default class Welcome extends Controller {
    private authService: AuthService;

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        const oTarget = oRouter?.getTarget("TargetWelcome") as any;
        oTarget?.attachDisplay(this.onTargetDisplay, this);
    }

    private onTargetDisplay = (): void => {
        if (!this.authService.isAuthenticated()) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLogin");
            return;
        }
    }

    public onNavToRegistro(): void {
        console.log("Navegando a registro...");
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.navTo("RouteAveCreate");
    }

    public onNavToLista(): void {
        console.log("Navegando a lista...");
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList");
    }

    public onLogout = async (): Promise<void> => {
        try {
            await this.authService.logout();
            MessageToast.show("Sesión cerrada exitosamente");

            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
            oRouter?.navTo("RouteLogin");

            // Verificar que el método existe antes de llamarlo
            const oOwner = this.getOwnerComponent() as any;
            if (oOwner && typeof oOwner.updateUserModel === 'function') {
                oOwner.updateUserModel();
            }

        } catch (error) {
            console.error("Error en logout:", error);
            MessageToast.show("Error cerrando sesión");
        }
    }
}