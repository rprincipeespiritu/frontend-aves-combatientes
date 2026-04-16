import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Fragment from "sap/ui/core/Fragment";
import { AuthService } from "../services/AuthService";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import NavigationListItem from "sap/tnt/NavigationListItem";
import Control from "sap/ui/mdc/Control";
import Popover from "sap/m/Popover";

export default class Welcome extends Controller {
    private authService: AuthService;
    private _carouselInterval: any;
    private _bPhone: boolean;
    private _oMobileMenu?: ActionSheet;
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;

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

        const oSideNavigation = this.byId("sideNavigation") as any;

        if (oSideNavigation) {
            oSideNavigation.setExpanded(!Device.system.phone);
        }

        const sUserData = localStorage.getItem("auth_user");

        if (sUserData) {
            const oUser = JSON.parse(sUserData);
            const oUserModel = new JSONModel(oUser);
            this.getView()?.setModel(oUserModel, "user");
        }

    }

    public async onToggleSideContent(oEvent: Event): Promise<void> {
        if (Device.system.phone) {
            if (!this._oMobileMenu) {
                const oFragment = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.MobileMenu",
                    controller: this
                });

                this._oMobileMenu = oFragment as ActionSheet;
                this.getView()?.addDependent(this._oMobileMenu);
            }

            const oSource = oEvent.getSource() as Control;
            this._oMobileMenu.openBy(oSource);
            return;
        }

        const oSideNavigation = this.byId("sideNavigation") as any;
        if (oSideNavigation) {
            oSideNavigation.setExpanded(!oSideNavigation.getExpanded());
        }
    }

    public onMenuSelect(oEvent: Event): void {
        const oItem = oEvent.getParameter("item") as NavigationListItem;
        const sKey = oItem.getKey();

        this._navigateByKey(sKey);

        if (Device.system.phone && this._oMobileMenu) {
            this._oMobileMenu.close();
        }
    }

    private _navigateByKey(sKey: string): void {

        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();

        switch (sKey) {
            case "aves":
                oRouter?.navTo("RouteList");
                break;

            case "incubaciones":
                oRouter?.navTo("RouteIncubacionList");
                break;

            case "peleas":
                oRouter?.navTo("RoutePeleas");
                break;

            case "vacunacion":
                oRouter?.navTo("RouteVacunacion");
                break;

            default:
                break;
        }
    }

    public onMobileMenuPress(oEvent: Event): void {
        const oSource = oEvent.getSource() as Control;
        const sKey = oSource.data("key") as string;

        this._navigateByKey(sKey);

        if (this._oMobileMenu) {
            this._oMobileMenu.close();
        }
    }

    public onCambiarCuenta(): void {
        // aquí puedes redirigir al login o mostrar selector de cuentas
        const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();
        oRouter.navTo("RouteLogin");
    }

    public async onUserMenuPress(oEvent: Event): Promise<void> {
        const oSource = oEvent.getSource() as Control;

        if (Device.system.phone) {
            if (!this._oUserMenuSheet) {
                const oFragment = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.UserMenuMobile",
                    controller: this
                });

                this._oUserMenuSheet = oFragment as ActionSheet;
                this.getView()?.addDependent(this._oUserMenuSheet);
            }

            // TOGGLE
            if (this._oUserMenuSheet.isOpen()) {
                this._oUserMenuSheet.close();
            } else {
                this._oUserMenuSheet.openBy(oSource);
            }

            return;
        }

        if (!this._oUserMenuPopover) {
            const oFragment = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.UserMenu",
                controller: this
            });

            this._oUserMenuPopover = oFragment as Popover;
            this.getView()?.addDependent(this._oUserMenuPopover);
        }

        // TOGGLE
        if (this._oUserMenuPopover.isOpen()) {
        this._oUserMenuPopover.close();
        } else {
        this._oUserMenuPopover.openBy(oSource);
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