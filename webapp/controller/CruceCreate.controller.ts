import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import {AuthService} from "com/rprincipees/registroavescombate/services/AuthService";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import {IAve} from "com/rprincipees/registroavescombate/types/Models";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import List from "sap/m/List";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

export default class CruceCreate extends Controller {

    private lineaId: string = "";
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private authService: AuthService;
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private _oPadresDialog: Dialog;
    private helpSelected: any;

    public onInit(): void {

        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RoutelineaGallosCruceCreate")?.attachPatternMatched(this.onRouteMatched, this);

    }

    private async onRouteMatched(oEvent: any): Promise<void> {

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

        this.getView()?.setModel(new JSONModel({
            macho_ID: "",
            hembra_ID: "",
            tipoParentesco: "",
            objetivoCruce: "",
            resultadoVisible: false,
            machos: [],
            hembras: [],
            tiposParentesco: [
                { key: "PADRE_HIJA", text: "Padre × hija" },
                { key: "MADRE_HIJO", text: "Madre × hijo" },
                { key: "ABUELO_NIETA", text: "Abuelo × nieta" },
                { key: "ABUELA_NIETO", text: "Abuela × nieto" },
                { key: "TIO_SOBRINA", text: "Tío × sobrina" },
                { key: "TIA_SOBRINO", text: "Tía × sobrino" },
                { key: "MEDIO_HERMANOS", text: "Medio hermanos" },
                { key: "PRIMOS", text: "Primos" },
                { key: "SIN_PARENTESCO", text: "Sin parentesco directo" }
            ],
            resultado: {}
        }), "cruce");

        this.lineaId = oEvent.getParameter("arguments").lineaId;
        //await this.cargarAves();
    }

    /*private async cargarAves(): Promise<void> {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;

        try {
            const response = await fetch(`${this.baseUrl}/AvesActivas`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();
            const aves = data.value || [];

            oModel.setProperty("/machos", aves.filter((ave: any) => ave.sexo === "MACHO"));
            oModel.setProperty("/hembras", aves.filter((ave: any) => ave.sexo === "HEMBRA"));

        } catch (error) {
            MessageBox.error("No se pudieron cargar las aves.");
        }
    }*/

    public onCambioAves(): void {
        this.calcularParentesco();
    }

    private calcularParentesco(): void {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;

        const macho_ID = oModel.getProperty("/macho_ID");
        const hembra_ID = oModel.getProperty("/hembra_ID");

        const machos = oModel.getProperty("/machos");
        const hembras = oModel.getProperty("/hembras");

        if (!macho_ID || !hembra_ID) return;

        const macho = machos.find((a: any) => a.ID === macho_ID);
        const hembra = hembras.find((a: any) => a.ID === hembra_ID);

        if (!macho || !hembra) return;

        let tipo = "SIN_PARENTESCO";

        // 🔴 Padre - hija
        if (macho.ID === hembra.padre_ID) {
            tipo = "PADRE_HIJA";
        }

        // 🔴 Madre - hijo
        else if (hembra.ID === macho.madre_ID) {
            tipo = "MADRE_HIJO";
        }

        // 🟠 Hermanos / medio hermanos
        else if (
            macho.padre_ID && hembra.padre_ID &&
            macho.padre_ID === hembra.padre_ID
        ) {
            tipo = "MEDIO_HERMANOS";
        }

        else if (
            macho.madre_ID && hembra.madre_ID &&
            macho.madre_ID === hembra.madre_ID
        ) {
            tipo = "MEDIO_HERMANOS";
        }

        // 🟡 Abuelo - nieta
        else if (
            macho.ID === hembra.padre_padre_ID ||
            macho.ID === hembra.madre_padre_ID
        ) {
            tipo = "ABUELO_NIETA";
        }

        // 🟢 Default
        else {
            tipo = "SIN_PARENTESCO";
        }

        oModel.setProperty("/tipoParentesco", tipo);
    }

    public async onAnalizarCruce(): Promise<void> {

        const oThat = this;
        const oModel = this.getView()?.getModel("cruce") as JSONModel;
        const data = oModel.getData();

        if (!data.tipoParentesco) {
            MessageBox.warning("Selecciona parentesco.");
            return;
        }

        if (!data.padrePlaca) {
            MessageBox.warning("Selecciona macho.");
            return;
        }

        if (!data.madrePlaca) {
            MessageBox.warning("Selecciona hembra.");
            return;
        }

        const body = {
            tipoParentesco: data.tipoParentesco
        };

        const placaPadre = data.padrePlaca;
        const oMachosModel = oThat.getView()?.getModel("avesMachos") as JSONModel;
        const aMachos = oMachosModel.getData() as any[];
        let oPadre: IAve[];
        if (aMachos.length > 0 && placaPadre) {
            oPadre = aMachos.filter((a: any) => a.placa === placaPadre);
            data.macho_ID = oPadre[0].ID;
        }

        //const oInputMadre = oThat.byId("idMadre") as Input;
        const placaMadre = data.madrePlaca;
        const oHembrasModel = oThat.getView()?.getModel("avesHembras") as JSONModel;
        const aHembras = oHembrasModel.getData() as any[];
        let oMadre: IAve[];
        if (aHembras.length > 0 && placaMadre) {
            oMadre = aHembras.filter((a: any) => a.placa === placaMadre);
            data.hembra_ID = oMadre[0].ID;
        }

        if (data.macho_ID) body.macho_ID = data.macho_ID;
        if (data.hembra_ID) body.hembra_ID = data.hembra_ID;





        try {
            const response = await fetch(`${this.baseUrl}/analizarCrucePorParentesco`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error("No se pudo analizar el cruce.");
            }

            const resultado = await response.json();

            oModel.setProperty("/resultado", resultado);
            oModel.setProperty("/resultadoVisible", true);

        } catch (error) {
            MessageBox.error("No se pudo analizar el cruce.");
        }
    }

    public async onGuardarPlanCruce(): Promise<void> {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;
        const token = localStorage.getItem("token");
        const resultado = oModel.getProperty("/resultado");

        if (!resultado || !resultado.nivelRiesgo) {
            MessageBox.warning("Primero analiza el cruce.");
            return;
        }

        const body = {
            linea_ID: this.lineaId,
            macho_ID: oModel.getProperty("/macho_ID"),
            hembra_ID: oModel.getProperty("/hembra_ID"),
            tipoParentesco: oModel.getProperty("/tipoParentesco"),
            objetivoCruce: oModel.getProperty("/objetivoCruce"),
            nivelRiesgo: resultado.nivelRiesgo,
            porcentaje: resultado.porcentaje,
            recomendacion: resultado.recomendacion,
            estado: "PROPUESTO",
            fechaPropuesta: new Date().toISOString().split("T")[0]
        };

        try {
            const response = await fetch(`${this.baseUrl}/PlanesCruces`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error("No se pudo guardar el plan.");
            }

            MessageToast.show("Plan de cruce guardado correctamente.");
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
            oRouter?.navTo("RouteLineaGalloDetail", {
                lineaId: this.lineaId
            });

        } catch (error) {
            MessageBox.error("No se pudo guardar el plan de cruce.");
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

    public onNavBack(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteLineaGalloDetail", {
            id: this.lineaId
        });
    }

    public onNavWelcome(): void {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        oRouter?.navTo("RouteWelcome");
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

}