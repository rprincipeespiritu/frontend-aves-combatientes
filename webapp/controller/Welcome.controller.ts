import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Fragment from "sap/ui/core/Fragment";
import { AuthService } from "../services/AuthService";

export default class Welcome extends Controller {
    private authService: AuthService;
    private _carouselInterval: any;

    public onAfterRendering(): void {
        const oCarousel = this.byId("imageCarousel") as any;

        if (oCarousel) {
            this._carouselInterval = setInterval(() => {
                oCarousel.next();
            }, 5000); // cada 3 segundos
        }
    }

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

        const sUserData = localStorage.getItem("auth_user");

        if (sUserData) {
            const oUser = JSON.parse(sUserData);
            const oUserModel = new JSONModel(oUser);
            this.getView()?.setModel(oUserModel, "user");
        }

    }

    public onCambiarCuenta(): void {
        // aquí puedes redirigir al login o mostrar selector de cuentas
        const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();
        oRouter.navTo("RouteLogin");
    }

    public async onUserMenuPress(oEvent: Event): Promise<void> {
        const oSource = oEvent.getSource();

        // Si ya existe el popover
        if (this._oUserMenuPopover) {

            // 🔥 TOGGLE: si está abierto → cerrar
            if (this._oUserMenuPopover.isOpen()) {
                this._oUserMenuPopover.close();
                return;
            }

            // Si está cerrado → abrir
            this._oUserMenuPopover.openBy(oSource as any);
            return;
        }

        // Si no existe → crear
        this._oUserMenuPopover = await Fragment.load({
            id: this.getView().getId(),
            name: "com.rprincipees.registroavescombate.view.fragments.UserMenu",
            controller: this
        }) as any;

        this.getView()?.addDependent(this._oUserMenuPopover);

        this._oUserMenuPopover.openBy(oSource as any);
    }

    public onMenuSelect(oEvent: Event): void {
        const oItem = oEvent.getParameter("item") as NavigationListItem;
        const sKey = oItem.getKey();

        const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();

        switch (sKey) {
            case "aves":
                oRouter.navTo("RouteList");
                break;

            case "incubaciones":
                oRouter.navTo("RouteIncubaciones");
                break;

            case "peleas":
                oRouter.navTo("RoutePeleas");
                break;

            case "vacunacion":
                oRouter.navTo("RouteVacunacion");
                break;

            default:
                console.warn("Ruta no definida para:", sKey);
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