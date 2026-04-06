import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import { AuthService } from "../services/AuthService";
import Fragment from "sap/ui/core/Fragment";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";

export default class AveDetail extends Controller {
    private authService: AuthService;
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private aveId: string = "";
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteAveDetail")?.attachPatternMatched(this.onRouteMatched, this);
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

        this.aveId = oEvent.getParameter("arguments").aveId;

        this.getView()?.setModel(new JSONModel({
            editMode: false,
            placa: "", nombre: "", apodo: "", sexo: "",
            estado: "", ubicacion: "", razaNombre: "", colorNombre: "",
            fechaNacimiento: "", procedencia: "", criador: "",
            valorCompra: 0, valorActual: 0, observaciones: "",
            totalPeleas: 0, peleasGanadas: 0, porcentajeVictorias: "0%",
            pesoActual: 0, edad: 0, pesajes: [], peleas: [],
            padreNombre: "", madreNombre: "", padre_ID: "", madre_ID: "",
            raza_ID: "", color_ID: "", fotoPrincipal: ""
        }), "detail");

        this.cargarAve();
        //this.cargarCatalogos();
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

    private async cargarAve(): Promise<void> {
        const token = this.authService.getToken();
        try {
            const response = await fetch(
                `${this.baseUrl}/Aves('${this.aveId}')?$expand=pesajes,peleas,padre,madre`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );

            if (!response.ok) {
                MessageBox.error("Ave no encontrada");
                this.onNavBack();
                return;
            }

            const ave = await response.json();
            const oModel = this.getView()?.getModel("detail") as JSONModel;

            oModel.setData({
                ...oModel.getData(),
                ...ave,
                razaNombre: ave.raza?.nombre || "",
                colorNombre: ave.color?.nombre || "",
                padreNombre: ave.padre ? `${ave.padre.placa} - ${ave.padre.nombre || ""}` : "Sin registro",
                madreNombre: ave.madre ? `${ave.madre.placa} - ${ave.madre.nombre || ""}` : "Sin registro",
                fotoPrincipal: ave.fotos?.find((f: any) => f.esPrincipal)?.thumbnailUrl || "",
                pesajes: ave.pesajes || [],
                peleas: ave.peleas || [],
                editMode: false
            });

        } catch (error) {
            MessageBox.error("Error cargando el ave");
        }
    }

    /*
    private async cargarCatalogos(): Promise<void> {
        const token = this.authService.getToken();
        const headers = { "Authorization": `Bearer ${token}` };
        try {
            const [razas, colores] = await Promise.all([
                fetch(`${this.baseUrl}/Razas`, { headers }).then(r => r.json()),
                fetch(`${this.baseUrl}/Colores`, { headers }).then(r => r.json()),
            ]);
            this.getView()?.setModel(new JSONModel(razas.value || []), "razas");
            this.getView()?.setModel(new JSONModel(colores.value || []), "colores");
        } catch (error) {
            console.error("Error cargando catálogos:", error);
        }
    }
    */

    public onEditar(oEvent: Event): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const oAve = oModel.getData();
        if (oAve?.ID) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteAveUpdate", { aveId: oAve.ID });
        }
    }

    public onCancelarEdicion(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        oModel.setProperty("/editMode", false);
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList");
    }

    // public async onGuardar(): Promise<void> {
    //     const oModel = this.getView()?.getModel("detail") as JSONModel;
    //     const data = oModel.getData();

    //     const payload = {
    //         placa: data.placa,
    //         nombre: data.nombre,
    //         apodo: data.apodo,
    //         sexo: data.sexo,
    //         estado: data.estado,
    //         ubicacion: data.ubicacion,
    //         procedencia: data.procedencia,
    //         criador: data.criador,
    //         observaciones: data.observaciones,
    //         fechaNacimiento: data.fechaNacimiento || null,
    //         valorCompra: data.valorCompra || null,
    //         valorActual: data.valorActual || null,
    //         raza_ID: data.raza_ID || null,
    //         color_ID: data.color_ID || null,
    //     };

    //     try {
    //         const response = await fetch(`${this.baseUrl}/Aves('${this.aveId}')`, {
    //             method: "PATCH",
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 "Authorization": `Bearer ${this.authService.getToken()}`
    //             },
    //             body: JSON.stringify(payload)
    //         });

    //         if (response.ok) {
    //             MessageToast.show("Ave actualizada exitosamente");
    //             oModel.setProperty("/editMode", false);
    //             this.cargarAve();
    //         } else {
    //             const error = await response.json();
    //             MessageBox.error(error.error?.message || "Error al actualizar");
    //         }
    //     } catch (error) {
    //         MessageBox.error("Error de conexión");
    //     }
    // }

    public onEliminar(): void {
        MessageBox.confirm("¿Deseas eliminar este ave permanentemente?", {
            title: "Confirmar eliminación",
            onClose: async (action: string) => {
                if (action === MessageBox.Action.OK) {
                    try {
                        const response = await fetch(`${this.baseUrl}/Aves('${this.aveId}')`, {
                            method: "DELETE",
                            headers: { "Authorization": `Bearer ${this.authService.getToken()}` }
                        });
                        if (response.ok) {
                            MessageToast.show("Ave eliminada");
                            this.onNavBack();
                        }
                    } catch (error) {
                        MessageBox.error("Error eliminando el ave");
                    }
                }
            }
        });
    }

    public onVerPadre(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const padreId = oModel.getProperty("/padre_ID");
        if (padreId) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
            oRouter?.navTo("RouteAveDetail", { aveId: padreId });
        }
    }

    public onVerMadre(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        const madreId = oModel.getProperty("/madre_ID");
        if (madreId) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
            oRouter?.navTo("RouteAveDetail", { aveId: madreId });
        }
    }

    public onAgregarPesaje(): void {
        MessageToast.show("Próximamente: agregar pesaje");
    }

    public onNavBack(): void {
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