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
import formatter from "../model/formatter";

export default class CruceCreate extends Controller {

    private lineaId: string = "";
    private planId: string = "";
    private baseUrl: string = "http://localhost:4004/api/avecombatiente";
    private authService: AuthService;
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private _oPadresDialog: Dialog;
    private helpSelected: any;
    public formatter = formatter;

    public onInit(): void {

        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RoutelineaGallosCruceCreate")?.attachPatternMatched(this.onRouteMatched, this);
        oRouter?.getRoute("RouteLineaGallosCruceEdit")?.attachPatternMatched(this.onRouteMatched, this);

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
            titulo: "Nuevo Plan de Cruce",
            guardarTexto: "Guardar Plan de Cruce",
            editMode: false,
            cruceAbierto: false,
            macho_ID: "",
            hembra_ID: "",
            tipoCruce: "",
            tipoParentesco: "",
            parentescoTexto: "",
            objetivoCruce: "",
            resultadoVisible: false,
            analisisEnCurso: false,
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
        this.planId = oEvent.getParameter("arguments").planId || "";
        await this.cargarContextoLinea();
        if (this.planId) {
            await this.cargarPlanCruce();
        }
        //await this.cargarAves();
    }

    private async cargarContextoLinea(): Promise<void> {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;

        try {
            const response = await fetch(`${this.baseUrl}/LineasAves('${this.lineaId}')`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) return;

            const linea = await response.json();
            const cruceAbierto = linea?.nombre === "Cruce abierto";
            const editMode = !!this.planId;
            oModel.setProperty("/cruceAbierto", cruceAbierto);
            oModel.setProperty(
                "/titulo",
                editMode
                    ? (cruceAbierto ? "Editar Cruce Abierto" : "Editar Plan de Cruce")
                    : (cruceAbierto ? "Nuevo Cruce Abierto" : "Nuevo Plan de Cruce")
            );
            oModel.setProperty("/guardarTexto", editMode ? "Actualizar Plan de Cruce" : "Guardar Plan de Cruce");
            oModel.setProperty("/editMode", editMode);
        } catch (error) {
            oModel.setProperty("/cruceAbierto", false);
            oModel.setProperty("/titulo", "Nuevo Plan de Cruce");
        }
    }

    private async cargarPlanCruce(): Promise<void> {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;

        try {
            const response = await fetch(`${this.baseUrl}/PlanesCruces('${this.planId}')?$expand=macho,hembra,linea`, {
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("Plan de cruce no encontrado.");
            }

            const plan = await response.json();
            const parentescoTexto = this.obtenerTextoParentesco(plan.tipoParentesco);
            oModel.setProperty("/macho_ID", plan.macho_ID || plan.macho?.ID || "");
            oModel.setProperty("/hembra_ID", plan.hembra_ID || plan.hembra?.ID || "");
            oModel.setProperty("/padrePlaca", plan.macho?.placa || "");
            oModel.setProperty("/padreNombre", plan.macho?.nombre || plan.macho?.apodo || "");
            oModel.setProperty("/madrePlaca", plan.hembra?.placa || "");
            oModel.setProperty("/madreNombre", plan.hembra?.nombre || plan.hembra?.apodo || "");
            oModel.setProperty("/tipoParentesco", plan.tipoParentesco || "");
            oModel.setProperty("/tipoCruce", plan.tipoCruce || "");
            oModel.setProperty("/parentescoTexto", parentescoTexto);
            oModel.setProperty("/objetivoCruce", plan.objetivoCruce || "");
            oModel.setProperty("/resultadoVisible", true);
            oModel.setProperty("/resultado", {
                tipoCruce: plan.tipoCruce,
                nivelRiesgo: plan.nivelRiesgo,
                porcentaje: plan.porcentaje,
                ancestrosComunes: plan.ancestrosComunes,
                decision: plan.decision,
                recomendacion: plan.recomendacion,
                descripcion: parentescoTexto,
                messageType: plan.nivelRiesgo === "ALTO" ? "Error" : plan.nivelRiesgo === "MODERADO" ? "Warning" : "Success",
            });
        } catch (error: any) {
            MessageBox.error(error.message || "No se pudo cargar el plan de cruce.");
            this.onNavBack();
        }
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
        void this.analizarParentescoAutomatico(false);
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

    private obtenerTextoParentesco(tipoParentesco: string): string {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;
        const tiposParentesco = oModel.getProperty("/tiposParentesco") || [];
        const item = tiposParentesco.find((tipoItem: any) => tipoItem.key === tipoParentesco);
        return item?.text || tipoParentesco || "";
    }

    private limpiarAnalisis(): void {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;
        oModel.setProperty("/tipoParentesco", "");
        oModel.setProperty("/tipoCruce", "");
        oModel.setProperty("/parentescoTexto", "");
        oModel.setProperty("/resultado", {});
        oModel.setProperty("/resultadoVisible", false);
    }

    private async analizarParentescoAutomatico(mostrarMensajes: boolean): Promise<boolean> {
        const oModel = this.getView()?.getModel("cruce") as JSONModel;
        const data = oModel.getData();

        if (!data.macho_ID || !data.hembra_ID) {
            this.limpiarAnalisis();
            return false;
        }

        oModel.setProperty("/analisisEnCurso", true);

        try {
            const response = await fetch(`${this.baseUrl}/analizarCruceAutomatico`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    macho_ID: data.macho_ID,
                    hembra_ID: data.hembra_ID,
                    generaciones: 5,
                    linea_ID: this.lineaId || null
                })
            });

            if (!response.ok) {
                throw new Error("No se pudo analizar el parentesco.");
            }

            const resultado = await response.json();
            const parentescoTexto = this.obtenerTextoParentesco(resultado.tipoParentesco);

            oModel.setProperty("/tipoCruce", resultado.tipoCruce);
            oModel.setProperty("/tipoParentesco", resultado.tipoParentesco);
            oModel.setProperty("/parentescoTexto", parentescoTexto);
            oModel.setProperty("/resultado", resultado);
            oModel.setProperty("/resultadoVisible", true);
            return true;

        } catch (error) {
            this.limpiarAnalisis();
            if (mostrarMensajes) {
                MessageBox.error("No se pudo analizar el parentesco entre los reproductores.");
            }
            return false;

        } finally {
            oModel.setProperty("/analisisEnCurso", false);
        }
    }

    public async onAnalizarCruce(): Promise<void> {

        const oModel = this.getView()?.getModel("cruce") as JSONModel;
        const data = oModel.getData();

        if (!data.padrePlaca) {
            MessageBox.warning("Selecciona macho.");
            return;
        }

        if (!data.madrePlaca) {
            MessageBox.warning("Selecciona hembra.");
            return;
        }

        if (!data.macho_ID || !data.hembra_ID) {
            MessageBox.warning("No se pudo identificar los reproductores seleccionados.");
            return;
        }

        const analizado = await this.analizarParentescoAutomatico(true);
        if (analizado) {
            MessageToast.show("Parentesco calculado correctamente.");
        }
    }

    public async onGuardarPlanCruce(): Promise<void> {
        const authUser = localStorage.getItem("auth_user");
        if (!authUser) {
            MessageToast.show("No se encontró la sesión del usuario");
            return;
        }
        const usuario = JSON.parse(authUser);

        const oModel = this.getView()?.getModel("cruce") as JSONModel;        
        const resultado = oModel.getProperty("/resultado");

        if (!resultado || !resultado.nivelRiesgo) {
            MessageBox.warning("Primero analiza el cruce.");
            return;
        }

        const body = {
            linea_ID: this.lineaId,
            macho_ID: oModel.getProperty("/macho_ID"),
            hembra_ID: oModel.getProperty("/hembra_ID"),
            tipoCruce: resultado.tipoCruce || oModel.getProperty("/tipoCruce"),
            tipoParentesco: oModel.getProperty("/tipoParentesco"),
            objetivoCruce: oModel.getProperty("/objetivoCruce"),
            nivelRiesgo: resultado.nivelRiesgo,
            porcentaje: resultado.porcentaje,
            ancestrosComunes: resultado.ancestrosComunes,
            generacionesAnalizadas: 5,
            decision: resultado.decision,
            recomendacion: resultado.recomendacion,
            estado: resultado.decision === "APROBADO" ? "APROBADO" : "PROPUESTO",
            fechaPropuesta: new Date().toISOString().split("T")[0],
            usuario_ID: usuario._id,
            codigo: `${oModel.getProperty("/cruceAbierto") ? "PCA" : "PC"}_${oModel.getProperty("/padrePlaca")}_${oModel.getProperty("/madrePlaca")}`            
        };

        let error: any;
        try {
            const editMode = oModel.getProperty("/editMode");
            const response = await fetch(editMode ? `${this.baseUrl}/PlanesCruces('${this.planId}')` : `${this.baseUrl}/PlanesCruces`, {
                method: editMode ? "PATCH" : "POST",
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                error = await response.json();                
                throw new Error( "No se pudo guardar el plan.");
            }

            MessageToast.show(editMode ? "Plan de cruce actualizado correctamente." : "Plan de cruce guardado correctamente.");
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
            if (oModel.getProperty("/cruceAbierto")) {
                oRouter?.navTo("RoutePlanesCruce");
                return;
            }

            oRouter?.navTo("RouteLineaGalloDetail", {
                id: this.lineaId
            });

        } catch (error2) {
            MessageBox.error(error?.error?.message || "No se pudo guardar el plan de cruce.");
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
        const oModel = this.getView()?.getModel("cruce") as JSONModel;
        if (oModel?.getProperty("/cruceAbierto")) {
            oRouter?.navTo("RoutePlanesCruce");
            return;
        }

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
            const oContext = oSelectedItem.getBindingContext("avesPadres");
            const oAve = oContext?.getObject();
            const oModel = this.getView()?.getModel("cruce") as JSONModel;
            let oInput: Input | undefined;
            if(oThat.helpSelected === "valueHelpPadre") {
                oInput = this.getView()?.byId("inputPadreLinea") as Input;
                oModel?.setProperty("/macho_ID", oAve?.ID || "");
                oModel?.setProperty("/padrePlaca", sPlaca);
                oModel?.setProperty("/padreNombre", sNombre);
            } else if(oThat.helpSelected === "valueHelpMadre"){
                oInput = this.getView()?.byId("inputMadreLinea") as Input;
                oModel?.setProperty("/hembra_ID", oAve?.ID || "");
                oModel?.setProperty("/madrePlaca", sPlaca);
                oModel?.setProperty("/madreNombre", sNombre);
            }
            if (oInput) {
                oInput.setValue(sPlaca);
                oInput.setDescription(sNombre);
            }
        }

        this._oPadresDialog?.close();
        //void this.analizarParentescoAutomatico(false);

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
