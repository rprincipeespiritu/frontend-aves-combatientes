import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import { AuthService } from "../services/AuthService";
import Input from "sap/m/Input";
import Event from "sap/ui/base/Event";
import { IAve } from "../types/Models";
import Fragment from "sap/ui/core/Fragment";
import Device from "sap/ui/Device";
import Dialog from "sap/m/Dialog";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ActionSheet from "sap/m/ActionSheet";
import Control from "sap/ui/mdc/Control";
import Popover from "sap/m/Popover";

export default class AveUpdate extends Controller {
    private authService: AuthService;
    private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
    private aveId: string = "";
    private _oUserMenuSheet: any;
    private _oUserMenuPopover: any;
    private _oPadresDialog: Dialog;
    private helpSelected: any;

    public onInit(): void {
        this.authService = AuthService.getInstance();

        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RouteAveUpdate")?.attachPatternMatched(this.onRouteMatched, this);
        // const oTarget = oRouter?.getTarget("TargetAveUpdate") as any;
        // oTarget?.attachDisplay(this.onTargetDisplay, this);
    }

    private onRouteMatched = (oEvent: any): void => {
        const oThat = this;
        if (!this.authService.isAuthenticated()) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLogin");
            return;
        } else {

            const sUserData = localStorage.getItem("auth_user");

            if (sUserData) {
                const oUser = JSON.parse(sUserData);
                const oUserModel = new JSONModel(oUser);
                this.getView()?.setModel(oUserModel, "user");
            }

            oThat.aveId = oEvent.getParameter("arguments").aveId;
            const oModel = new JSONModel({
                placa: "", nombre: "", apodo: "", sexo: "M",
                estado: "ACTIVO", ubicacion: "", raza: "",
                color: "", tipoAve: "", fechaNacimiento: "",
                fechaCompra: "", padre_ID: "", madre_ID: "",
                procedencia: "", criador: "", valorCompra: "",
                valorActual: "", observaciones: "", placaState: "None",
                categoria: "BUENO"
            });
            this.getView()?.setModel(oModel, "update");

            this.cargarAve();
            this.cargarCatalogos();
        }
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
                `${this.baseUrl}/AvesActivas('${this.aveId}')?$expand=padre,madre`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );

            if (!response.ok) {
                MessageBox.error("Ave no encontrada");
                this.onNavBack();
                return;
            }

            const ave = await response.json();
            const oModel = this.getView()?.getModel("update") as JSONModel;

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
                editMode: true
            });

        } catch (error) {
            MessageBox.error("Error cargando el ave");
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

    private async cargarCatalogos(): Promise<void> {
        try {

            const response = await fetch(`${this.baseUrl}/AvesActivas`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json",
                },
            });

            const aves: IAve[] = await response.json();
            const machos = (aves.value || []).filter((a: any) => a.sexo === "M" && a.padrote === true);
            const hembras = (aves.value || []).filter((a: any) => a.sexo === "H" && a.padrote === true);
            this.getView()?.setModel(new JSONModel(machos), "avesMachos");
            this.getView()?.setModel(new JSONModel(hembras), "avesHembras");
        } catch (error) {
            console.error("Error cargando catálogos:", error);
        }
    }

    private onValueHelpPadre = (): void => {

        const oThat = this;
        oThat.helpSelected = "valueHelpPadre";
        oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Padre");

    }

    private onValueHelpMadre = (): void => {
        const oThat = this;
        oThat.helpSelected = "valueHelpMadre";
        oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Madre");
    }

    public async onAbrirPopupPadres(helpSelected: string, sTitulo: string): Promise<void> {
        try {

            const response = await fetch(`${this.baseUrl}/AvesActivas`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json",
                },
            });

            const aves: IAve[] = await response.json();
            let padres: any[]= [];
            if (helpSelected === "valueHelpPadre"){
                padres = (aves.value || []).filter((a: any) => a.sexo === 'M' && a.padrote === true);
            } else if(helpSelected === "valueHelpMadre"){
                padres = (aves.value || []).filter((a: any) => a.sexo === 'H' && a.padrote === true);
            }
            this.getView()?.setModel(new JSONModel(padres), "avesPadres");

            if (!this._oPadresDialog) {
                this._oPadresDialog = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.PadresDialog",
                    controller: this
                }) as Dialog;

                this.getView()?.addDependent(this._oPadresDialog);
            }

            this._oPadresDialog.setTitle(sTitulo);
            this._oPadresDialog.open();

        } catch (error) {
            console.error("Error :", error);
        }

    }

    public onSeleccionarPadre(oEvent: Event): void {
        const oThat = this;
        const oSelectedItem = oEvent.getParameter("listItem");

        if (oSelectedItem) {
            const sNombre = oSelectedItem.getTitle();
            const sPlaca = oSelectedItem.getDescription();
            let oInput: Input | undefined;
            if(oThat.helpSelected === "valueHelpPadre") {
                oInput = this.byId("inputPadre") as Input;
            } else if(oThat.helpSelected === "valueHelpMadre"){
                oInput = this.byId("inputMadre") as Input;
            }
            if (oInput) {
                oInput.setValue(sPlaca);
                oInput.setDescription(sNombre);

            }
        }

        this._oPadresDialog?.close();

    }

    public onCerrarPopupPadres(): void {
        this._oPadresDialog?.close();
    }

    public onSearchPadres(oEvent: Event): void {
        const sValue = oEvent.getParameter("newValue") || "";
        const oList = this.byId("listaPadres") as List;
        const oBinding = oList.getBinding("items");

        if (!oBinding) return;

        if (sValue) {
            const oFilter = new Filter({
                filters: [
                    new Filter("nombre", FilterOperator.Contains, sValue),
                    new Filter("placa", FilterOperator.Contains, sValue)
                ],
                and: false // OR
            });

            oBinding.filter([oFilter]);
        } else {
            oBinding.filter([]); // limpia filtro
        }
    }

    public async onGuardar(): Promise<void> {
        try {
            const oThat = this;
            const oModel = this.getView()?.getModel("update") as JSONModel;
            const data = oModel.getData();

            // Validar placa
            if (!data.placa) {
                oModel.setProperty("/placaState", "Error");
                MessageToast.show("La placa es requerida");
                return;
            }
            oModel.setProperty("/placaState", "None");

            // Validar género
            if (!data.sexo) {
                oModel.setProperty("/generoState", "Error");
                MessageToast.show("El género es requerido");
                return;
            }
            oModel.setProperty("/generoState", "None");

             // Validar fecha de nacimiento
             if (!data.fechaNacimiento) {
                oModel.setProperty("/fecNacState", "Error");
                MessageToast.show("La fecha de nacimiento es requerida");
                return;
            }
            oModel.setProperty("/fecNacState", "None");

            const authUser = localStorage.getItem("auth_user");
            if (!authUser) {
                MessageToast.show("No se encontró la sesión del usuario");
                return;
            }
            const usuario = JSON.parse(authUser);
            const userId = usuario._id;
            // Construir payload
            const payload: any = {
                placa: data.placa,
                nombre: data.nombre || null,
                apodo: data.apodo || null,
                sexo: data.sexo,
                estado: data.estado,
                raza: data.raza || null,
                color: data.color || null,
                tipoAve: data.tipoAve || null,
                ubicacion: data.ubicacion || null,
                procedencia: data.procedencia || null,
                criador: data.criador || null,
                categoria: data.categoria || null,
                cria: data.cria || null,
                padrote: data.padrote || null,
                observaciones: data.observaciones || null,
                fechaNacimiento: data.fechaNacimiento || null,
                fechaCompra: data.fechaCompra || null,
                valorCompra: data.valorCompra ? parseFloat(data.valorCompra) : null,
                valorActual: data.valorActual ? parseFloat(data.valorActual) : null,
                usuario_ID: userId,
                padre_ID: null,
                madre_ID: null
            };

            //const oInputPadre = oThat.byId("idPadre") as Input;
            const placaPadre = data.padre ? data.padre.placa : null;
            const oMachosModel = oThat.getView()?.getModel("avesMachos") as JSONModel;
            const aMachos = oMachosModel.getData() as any[];
            let oPadre: IAve[];
            if (aMachos.length > 0 && placaPadre) {
                oPadre = aMachos.filter((a: any) => a.placa === placaPadre);
                data.padre_ID = oPadre[0].ID;
            }

           //const oInputMadre = oThat.byId("idMadre") as Input;
            const placaMadre = data.madre ? data.madre.placa : null
            const oHembrasModel = oThat.getView()?.getModel("avesHembras") as JSONModel;
            const aHembras = oHembrasModel.getData() as any[];
            let oMadre: IAve[];
            if (aHembras.length > 0 && placaMadre) {
                oMadre = aHembras.filter((a: any) => a.placa === placaMadre);
                data.madre_ID = oMadre[0].ID;
            }

            if (data.padre_ID) payload.padre_ID = data.padre_ID;
            if (data.madre_ID) payload.madre_ID = data.madre_ID;


            const response = await fetch(`${oThat.baseUrl}/Aves('${oThat.aveId}')`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${oThat.authService.getToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                MessageBox.success("¡Ave actualizada exitosamente!", {
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        oThat.onNavBack();
                    },
                    dependentOn: this.getView()
                });
            } else {
                const error = await response.json();
                MessageBox.error(error.error?.message || "Error al actualizar el ave");
            }
        } catch (error) {
            MessageBox.error(JSON.stringify(error));
        }
    }

    public onNavBack(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteList");
    }

    public onSuggestionItemSelectedPlacaPadre(oEvent: Event): void {
        const oModel = this.getView()?.getModel("update") as JSONModel
        let placa = oEvent.getSource().getSelectedKey();
        let descripcion = oEvent.getSource().getValue();
        // Validar placa
        if (!placa && descripcion) {
            oModel.setProperty("/placaPadreState", "Error");
            MessageToast.show("La placa del padre es incorrecto");
            return;
        }
        oModel.setProperty("/placaPadreState", "None");
        // alert("idPadre: " + placa);
        // this.byId("selectedKeyIndicator").setText(oText);

    }

    public onSuggestionItemSelectedPlacaMadre(oEvent: Event): void {
        const oModel = this.getView()?.getModel("update") as JSONModel
        let placa = oEvent.getSource().getSelectedKey();
        let descripcion = oEvent.getSource().getValue();
        // Validar placa
        if (!placa && descripcion) {
            oModel.setProperty("/placaMadreState", "Error");
            MessageToast.show("La placa del madre es incorrecto");
            return;
        }
        oModel.setProperty("/placaMadreState", "None");
        // alert("idPadre: " + placa);
        // this.byId("selectedKeyIndicator").setText(oText);

    }

    public onNavWelcome(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
    }

}