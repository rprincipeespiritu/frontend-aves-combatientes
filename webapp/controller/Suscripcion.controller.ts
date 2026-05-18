import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import { AuthService } from "../services/AuthService";
import Popover from "sap/m/Popover";
import ActionSheet from "sap/m/ActionSheet";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";

export default class Suscripcion extends Controller {
    private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
    private authService: AuthService;
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;

    public onInit(): void {
        this.authService = AuthService.getInstance();

        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteSuscripcion")?.attachPatternMatched(this.onRouteMatched, this);

        this.getView()?.setModel(new JSONModel({
            busy: false,
            plan: "",
            estado: "",
            fechaInicio: "",
            fechaFin: "",
            diasRestantes: 0,
            maxAves: 0,
            maxPollitos: 0,
            maxIncubaciones: 0,
            totalAves: 0,
            totalPollitos: 0,
            totalIncubaciones: 0,
            porcentajeUsoAves: 0,
            mensaje: "",
        }), "suscripcion");
    }

    private onRouteMatched = (): void => {
        if (!this.authService.isAuthenticated()) {
            (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
            return;
        }       

        const userData = localStorage.getItem("auth_user");
        if (userData) {
            this.getView()?.setModel(new JSONModel(JSON.parse(userData)), "user");
        }

        void this.cargarSuscripcion();
    };

    private getHeaders(): HeadersInit {
        return {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            "Content-Type": "application/json",
        };
    }

    private async cargarSuscripcion(): Promise<void> {
        const oModel = this.getView()?.getModel("suscripcion") as JSONModel;
        oModel.setProperty("/busy", true);

        try {
            const response = await fetch(`${this.baseUrl}/obtenerSuscripcionActual`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({}),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error?.message || data?.message || "No se pudo cargar la suscripcion");
            }

            oModel.setData({
                ...data,
                fechaInicioFmt: this.formatearFecha(data.fechaInicio),
                fechaFinFmt: this.formatearFecha(data.fechaFin),
                estadoState: data.estado === "ACTIVA" ? "Success" : data.estado === "CANCELADA" ? "Warning" : "Error",
            });
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo cargar la suscripcion");
        } finally {
            oModel.setProperty("/busy", false);
        }
    }

    public onActivarBasico(): void {
        this.confirmarActivacion("BASICO");
    }

    public onActivarPro(): void {
        this.confirmarActivacion("PRO");
    }

    public onActivarPremium(): void {
        this.confirmarActivacion("PREMIUM");
    }

    private confirmarActivacion(plan: string): void {
        MessageBox.confirm(`Deseas activar el plan ${plan} por 1 mes?`, {
            title: "Activar suscripcion",
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: (action: string) => {
                if (action === MessageBox.Action.OK) {
                    void this.activarSuscripcion(plan);
                }
            },
        });
    }

    private async activarSuscripcion(plan: string): Promise<void> {
        const oModel = this.getView()?.getModel("suscripcion") as JSONModel;
        oModel.setProperty("/busy", true);

        try {
            const response = await fetch(`${this.baseUrl}/activarSuscripcion`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ plan, meses: 1 }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error?.message || data?.message || "No se pudo activar la suscripcion");
            }

            MessageToast.show(data.message || "Suscripcion activada");
            await this.cargarSuscripcion();
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo activar la suscripcion");
        } finally {
            oModel.setProperty("/busy", false);
        }
    }

    public onCancelarSuscripcion(): void {
        MessageBox.confirm("Deseas cancelar la suscripcion actual?", {
            title: "Cancelar suscripcion",
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.CANCEL,
            onClose: (action: string) => {
                if (action === MessageBox.Action.OK) {
                    void this.cancelarSuscripcion();
                }
            },
        });
    }

    private async cancelarSuscripcion(): Promise<void> {
        const oModel = this.getView()?.getModel("suscripcion") as JSONModel;
        oModel.setProperty("/busy", true);

        try {
            const response = await fetch(`${this.baseUrl}/cancelarSuscripcion`, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({}),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error?.message || data?.message || "No se pudo cancelar la suscripcion");
            }

            MessageToast.show(data.message || "Suscripcion cancelada");
            await this.cargarSuscripcion();
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo cancelar la suscripcion");
        } finally {
            oModel.setProperty("/busy", false);
        }
    }

    private formatearFecha(fecha?: string): string {
        if (!fecha) return "";
        const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[3]}/${match[2]}/${match[1]}`;
        return fecha;
    }

    public onRefrescar(): void {
        void this.cargarSuscripcion();
    }

    public onNavBack(): void {
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
    }

    public onNavWelcome(): void {
        this.onNavBack();
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

    public async onLogout(): Promise<void> {
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
