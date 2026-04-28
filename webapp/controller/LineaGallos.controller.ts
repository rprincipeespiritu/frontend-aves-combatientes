import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import {AuthService} from "com/rprincipees/registroavescombate/services/AuthService";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import formatter from "../model/formatter";
import {EstadoLinea} from "com/rprincipees/registroavescombate/types/Models";
import {IIncubacion} from "com/rprincipees/registroavescombate/services/IncubacionService";
import MessageToast from "sap/m/MessageToast";
import {Linea} from "com/rprincipees/registroavescombate/services/LineaService";

export default class LineaGallos extends Controller {

    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private authService: AuthService;
    private _oUserMenuSheet: any;
    private _oUserMenuPopover: any;
    public formatter = formatter;

    public onInit(): void {

        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteLineaGallos")?.attachPatternMatched(this.onRouteMatched, this);

    }

    private onRouteMatched = (oEvent: any): void => {

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

        this.getView()?.setModel(new JSONModel({ data: [] }), "lineas");
        this.cargarLineas();

    }

    private async cargarLineas(): Promise<void> {
        const oModel = this.getView()?.getModel("lineas") as JSONModel;
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${this.baseUrl}/LineasAvesActivas`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();
            oModel.setProperty("/data", data.value || []);

        } catch (error) {
            MessageBox.error("No se pudieron cargar las líneas.");
        }
    }

    public onNuevaLinea(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter.navTo("RouteLineaGalloCreate");
    }

    public onEdit(oEvent: any): void {
        const oContext = oEvent.getSource().getBindingContext("lineas");
        const oItem = oContext.getObject();
        this.getOwnerComponent()?.getRouter().navTo("RouteLineaGalloEdit", {
            id: oItem.ID,
        });
    }

    public onVerDetalleLinea(oEvent: any): void {
        const context = oEvent.getSource().getBindingContext("lineas");
        const linea = context.getObject();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter.navTo("RouteLineaGalloDetail", {
            id: linea.ID
        });
    }

    public onDetail(oEvent: Event): void {
        const oItem = oEvent.getSource();
        const oContext = (oItem as any)?.getBindingContext("lineas");
        const linea = oContext?.getObject() as any;
        if (linea?.ID) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLineaGalloDetail", { id: linea.ID });
        }
    }

    public onNavBack(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
    }

    public onNavWelcome(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
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

    public onDelete(oEvent: any): void {
        const oContext = oEvent.getSource().getBindingContext("lineas");
        const oItem = oContext.getObject() as Linea;

        if(oItem.estado !== 'INACTIVA'){
            MessageBox.error("Solo se puede eliminar el registro en estado 'Cancelada'" );
            return
        }

        MessageBox.confirm(`¿Eliminar la incubación ${oItem.ID}?`, {
            onClose: async (sAction: string) => {
                if (sAction !== MessageBox.Action.OK) {
                    return;
                }

                try {

                    const response = await fetch(`${this.baseUrl}/eliminarLineaAve`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${this.authService.getToken()}`
                        },
                        body: JSON.stringify({
                            lineaAveId: oItem.ID
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const oResult = await response.json();

                    if (oResult?.success) {
                        MessageToast.show("Línea eliminada exitosamente");
                        /*const oTable = this.byId("avesTable") as any;
                        oTable?.removeSelections?.(true);
                        const oTableModel = this.getView()?.getModel("table") as JSONModel;
                        oTableModel?.setProperty("/selectedIndex", -1);
                        oTableModel?.setProperty("/selected", false);
                        oTableModel?.setProperty("/selectedItem", null);
                         */
                        this.cargarLineas();
                    } else {
                        MessageToast.show(oResult?.message || "No se pudo eliminar");
                    }


                } catch (error) {
                    console.error("Error eliminando línea:", error);
                    MessageBox.error("Error al eliminar el línea");
                }
            },
        });
    }

    public async onRefresh(): Promise<void> {
        //localStorage.setItem('filterIncProceso', "");
        await this.cargarLineas();
        MessageToast.show("Datos actualizados");
    }

    public formatearEstado(estado: EstadoLinea): string {
        const estados = {
            [EstadoLinea.Activa]: "Activa",
            [EstadoLinea.Inactiva]: "Inactiva"
        };

        return estados[estado] || estado;
    }
}