import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import {AuthService} from "com/rprincipees/registroavescombate/services/AuthService";
import UIComponent from "sap/ui/core/UIComponent";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import Router from "sap/ui/core/routing/Router";
import LineaService from "com/rprincipees/registroavescombate/services/LineaService";
import {IAve} from "com/rprincipees/registroavescombate/types/Models";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import List from "sap/m/List";

export default class LineaGalloForm extends Controller {
    private service = new LineaService();
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private authService: AuthService;
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private lineaId: null;
    private _oPadresDialog: Dialog;
    private helpSelected: any;

    public onInit(): void {

        this.authService = AuthService.getInstance();

        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();;
        oRouter
            ?.getRoute("RouteLineaGalloCreate")
            ?.attachPatternMatched(this._onCreateMatched, this);
        oRouter
            ?.getRoute("RouteLineaGalloEdit")
            ?.attachPatternMatched(this._onEditMatched, this);

    }

    private async _onCreateMatched(): Promise<void> {

        try {
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

            const oViewModel = new JSONModel();

            oViewModel.setData({
                nombre: "",
                descripcion: "",
                objetivo: "",
                estado: "ACTIVA"});

            this.getView()?.setModel(oViewModel, "linea");            

            oViewModel.setProperty("/busy", true);
            oViewModel.setProperty("/editMode", false);
            this.lineaId = null;
            this.cargarCatalogos();

        } catch (error) {
            MessageBox.error(
                error instanceof Error ? error.message : "No se pudo cargar líneas",
            );
        }
    }

    private async _onEditMatched(oEvent: any): Promise<void> {
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

        const oViewModel = new JSONModel();
        oViewModel.setData({
            nombre: "",
            descripcion: "",
            objetivo: "",
            estado: "ACTIVA",
            aveFundador_ID: "",
            aveFundadora_ID: ""
        });

        this.getView()?.setModel(oViewModel, "linea");


        this.lineaId = oEvent.getParameter("arguments").id;
        oViewModel.setProperty("/busy", true);
        oViewModel.setProperty("/editMode", true);

        try {

            const response = await fetch(`${this.baseUrl}/LineasAves(ID='${this.lineaId}')?$expand=aveFundador,aveFundadora`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json"
                }
            });

            const linea = await response.json();

            oViewModel.setData({
                ...oViewModel.getData(),
                ...linea,
                aveFundadorPlaca: linea.aveFundador ? `${linea.aveFundador.placa}` : "",
                aveFundadorNombre: linea.aveFundador ? `${linea.aveFundador.nombre}` : "",
                aveFundadoraPlaca: linea.aveFundadora ? `${linea.aveFundadora.placa}` : "",
                aveFundadoraNombre: linea.aveFundadora ? `${linea.aveFundadora.nombre}` : ""
            });

            this.cargarCatalogos();

        } catch (error) {
            MessageBox.error(
                error instanceof Error
                    ? error.message
                    : "No se pudo cargar la incubación",
            );
        } finally {
            oViewModel.setProperty("/busy", false);
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

    public async onGuardar(): Promise<void> {

        const oThat = this;
        const oModel = this.getView()?.getModel("linea") as JSONModel;
        const data = oModel.getData();
        const token = localStorage.getItem("token");

        if (!data.nombre) {
            MessageBox.warning("Ingresa el nombre de la línea.");
            return;
        }

        const authUser = localStorage.getItem("auth_user");
        if (!authUser) {
            MessageToast.show("No se encontró la sesión del usuario");
            return;
        }
        const usuario = JSON.parse(authUser);
        const userId = usuario._id;

        // Construir payload
        const payload: any = {
            nombre: data.nombre || null,
            descripcion: data.descripcion || null,
            objetivo: data.objetivo || null,
            estado: data.estado,
            usuario_ID: userId,
            aveFundador_ID: null,
            aveFundadora_ID: null
        };

        const placaPadre = data.aveFundadorPlaca;
        const oMachosModel = oThat.getView()?.getModel("avesMachos") as JSONModel;
        const aMachos = oMachosModel.getData() as any[];
        let oPadre: IAve[];
        if (aMachos.length > 0 && placaPadre) {
            oPadre = aMachos.filter((a: any) => a.placa === placaPadre);
            data.aveFundador_ID = oPadre[0].ID;
        }

        //const oInputMadre = oThat.byId("idMadre") as Input;
        const placaMadre = data.aveFundadoraPlaca;
        const oHembrasModel = oThat.getView()?.getModel("avesHembras") as JSONModel;
        const aHembras = oHembrasModel.getData() as any[];
        let oMadre: IAve[];
        if (aHembras.length > 0 && placaMadre) {
            oMadre = aHembras.filter((a: any) => a.placa === placaMadre);
            data.aveFundadora_ID = oMadre[0].ID;
        }

        if (data.aveFundador_ID) payload.aveFundador_ID = data.aveFundador_ID;
        if (data.aveFundadora_ID) payload.aveFundadora_ID = data.aveFundadora_ID;

        let response = null;
        if(this.lineaId){
            //update
            MessageBox.information("¿Está seguro que desea actualizar el registro?", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: async function (sAction: string) {
                    if (sAction === "OK") {

                        const response = await fetch(`${oThat.baseUrl}/LineasAves('${oThat.lineaId}')`, {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${oThat.authService.getToken()}`
                            },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                            throw new Error(
                                response?.error?.message ||
                                response?.message ||
                                "No se pudo actualizar el registro",
                            );
                        }

                        MessageBox.success("¡Línea actualizada exitosamente!", {
                            actions: [MessageBox.Action.OK],
                            emphasizedAction: MessageBox.Action.OK,
                            onClose: function (sAction: string) {
                                oThat.getOwnerComponent()?.getRouter().navTo("RouteLineaGallos");
                            },
                            dependentOn: oThat.getView()
                        });
                    }
                },
                dependentOn: this.getView()
            });
        } else {
            //create
            MessageBox.information("¿Está seguro que desea crear el registro?", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: async function (sAction: string) {
                    if (sAction === "OK") {

                        const response = await fetch(`${oThat.baseUrl}/LineasAves`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${oThat.authService.getToken()}`
                            },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                            throw new Error(
                                response?.error?.message ||
                                response?.message ||
                                "No se pudo crear el registro",
                            );
                        }

                        MessageBox.success("¡Línea creada exitosamente!", {
                            actions: [MessageBox.Action.OK],
                            emphasizedAction: MessageBox.Action.OK,
                            onClose: function (sAction: string) {
                                oThat.getOwnerComponent()?.getRouter().navTo("RouteLineaGallos");
                            },
                            dependentOn: oThat.getView()
                        });
                    }
                },
                dependentOn: this.getView()
            });
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
                oInput = this.getView()?.byId("inputPadreLinea") as Input;
            } else if(oThat.helpSelected === "valueHelpMadre"){
                oInput = this.getView()?.byId("inputMadreLinea") as Input;
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

    public onNavBack(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteLineaGallos");
    }

    public onNavWelcome(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
    }

}