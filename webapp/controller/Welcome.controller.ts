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
import {IAve} from "com/rprincipees/registroavescombate/types/Models";

export default class Welcome extends Controller {
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private authService: AuthService;
    private _carouselInterval: any;
    private _bPhone: boolean;
    private _oMobileMenu?: ActionSheet;
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;

    public onAfterRendering(): void {
        /*const oCarousel = this.byId("imageCarousel") as any;

        if (oCarousel) {
            this._carouselInterval = setInterval(() => {
                oCarousel.next();
            }, 5000); // cada 3 segundos
        }*/
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

        const oDashboardModel = new JSONModel({
            totalAves: 0,
            totalIncubaciones: 0,
            incubacionesActivas: 0,
            incubacionesProgramadas: 0,
            totalAvesActivas: 0,
            totalNacidos: 0,
            alertaIncubaciones: "",
            alertaEclosion: "",
            incubacionesRecientes: []
        });

        this.getView()?.setModel(oDashboardModel, "dashboard");
        this._cargarDashboard();

    }

    private async _cargarDashboard(): Promise<void> {
        try {

            const oResponse = await fetch(`${this.baseUrl}/obtenerDashboard`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({})
            });

            const oData = await oResponse.json();

            if (!oResponse.ok) {
                throw new Error(oData?.error?.message || "No se pudo cargar el dashboard");
            }

            const oModel = this.getView()?.getModel("dashboard") as JSONModel;

            const aIncubacionesRecientes = (oData.incubacionesRecientes || []).map((item: any) => {
                return {
                    ...item,
                    estadoTexto: this._mapEstadoTexto(item.estado),
                    estadoState: this._mapEstadoState(item.estado),
                    fechaIncubacionFmt: this._formatearFecha(item.fechaIncubacion)
                };
            });

            oModel.setData({
                totalAves: oData.totalAves || 0,
                totalIncubaciones: oData.totalIncubaciones || 0,
                incubacionesActivas: oData.incubacionesActivas || 0,
                incubacionesProgramadas: oData.incubacionesProgramadas || 0,
                totalAvesActivas: oData.totalAvesActivas || 0,
                totalNacidos: oData.totalNacidos || 0,
                alertaIncubaciones: oData.alertaIncubaciones || "",
                alertaEclosion: oData.alertaEclosion || "",
                incubacionesRecientes: aIncubacionesRecientes
            });
        } catch (error: any) {
            MessageToast.show(error.message || "Error al cargar dashboard");
        }
    }

    private _mapEstadoTexto(sEstado: string): string {
        switch (sEstado) {
            case "PROGRAMADA":
                return "Programada";
            case "EN_PROCESO":
                return "En proceso";
            case "COMPLETADA":
                return "Completada";
            case "CANCELADA":
                return "Cancelada";
            default:
                return sEstado || "";
        }
    }

    private _mapEstadoState(sEstado: string): string {
        switch (sEstado) {
            case "PROGRAMADA":
                return "Information";
            case "EN_PROCESO":
                return "Success";
            case "COMPLETADA":
                return "Success";
            case "CANCELADA":
                return "Error";
            default:
                return "None";
        }
    }

    private _formatearFecha(sFecha: string): string {
        if (!sFecha) {
            return "";
        }

        const oDate = new Date(sFecha);

        if (isNaN(oDate.getTime())) {
            return sFecha;
        }

        const dd = String(oDate.getDate()).padStart(2, "0");
        const mm = String(oDate.getMonth() + 1).padStart(2, "0");
        const yyyy = oDate.getFullYear();

        return `${dd}/${mm}/${yyyy}`;
    }

    public onNuevaAve(): void {
        this.getOwnerComponent().getRouter().navTo("aveCreate");
    }

    public onNuevaIncubacion(): void {
        this.getOwnerComponent().getRouter().navTo("incubacionCreate");
    }

    public onVerIncubaciones(): void {
        this.getOwnerComponent().getRouter().navTo("incubacionList");
    }

    public onIrAves(): void {
        this.getOwnerComponent().getRouter().navTo("list");
    }

    public onAbrirIncubacionDetalle(oEvent: any): void {
        const oItem = oEvent.getSource();
        const oCtx = oItem.getBindingContext("dashboard");
        const oObj = oCtx?.getObject();

        if (oObj?.ID) {
            this.getOwnerComponent().getRouter().navTo("incubacionDetail", {
                id: oObj.ID
            });
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

    public onNavNewBird(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.navTo("RouteAveCreate");
    }

    public onNavNewIncubation(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.navTo("RouteIncubacionCreate");
    }

    public onNavIncubationList(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.navTo("RouteIncubacionList");
    }

    public onNavBirdList(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.navTo("RouteList");
    }

}