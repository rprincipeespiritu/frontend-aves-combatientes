import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import { AuthService } from "../services/AuthService";

export default class Welcome extends Controller {
    private authService: AuthService;
    
    public onInit(): void {
        console.log("Welcome controller initialized");
        this.authService = AuthService.getInstance();
    }

    public onNavToRegistro(): void {
        console.log("Navegando a registro...");
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteApp");
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
            
            // Actualizar modelo de usuario en el componente
            (this.getOwnerComponent() as any).updateUserModel();
            
        } catch (error) {
            console.error("Error en logout:", error);
            MessageToast.show("Error cerrando sesión");
        }
    }    
}