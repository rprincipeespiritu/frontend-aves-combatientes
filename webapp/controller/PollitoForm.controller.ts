import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";
import List from "sap/m/List";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Event from "sap/ui/base/Event";
import { AuthService } from "../services/AuthService";
import { IAve } from "../types/Models";
import Popover from "sap/m/Popover";
import ActionSheet from "sap/m/ActionSheet";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import ConfirmationService from "../services/ConfirmationService";

export default class PollitoForm extends Controller {
    private authService: AuthService;
    private baseUrl = "http://localhost:4004/api/avecombatiente";
    private pollitoId = "";
    private _oPadresDialog: Dialog;
    private helpSelected = "";
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RoutePollitoCreate")?.attachPatternMatched(this.onRouteMatched, this);
        oRouter?.getRoute("RoutePollitoEdit")?.attachPatternMatched(this.onRouteMatched, this);
    }

    private onRouteMatched = (oEvent: any): void => {
        if (!this.authService.isAuthenticated()) {
            (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
            return;
        }

        const userData = localStorage.getItem("auth_user");
        if (userData) {
            this.getView()?.setModel(new JSONModel(JSON.parse(userData)), "user");
        }

        const pollitoId = oEvent.getParameter("arguments")?.pollitoId || "";
        this.pollitoId = pollitoId;
        this.getView()?.setModel(new JSONModel({
            title: pollitoId ? "Editar Ave Jóven" : "Registrar Ave Jóven",
            editMode: !!pollitoId,
            cintillo: "",
            colorCintillo: "",
            temporada: new Date().getFullYear(),
            nombre: "",
            sexo: "",
            fechaNacimiento: "",
            color: "",
            ubicacion: "",
            observaciones: "",
            padre_ID: "",
            madre_ID: "",
            placaPadre: "",
            nombrePadre: "",
            placaMadre: "",
            nombreMadre: "",
            cintilloState: "None",
            colorCintilloState: "None",
            temporadaState: "None",
            fecNacState: "None"
        }), "pollito");

        if (pollitoId) {
            this.cargarPollito();
        }

        this.cargarCatalogos();
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

    private async cargarPollito(): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/Crias('${this.pollitoId}')?$expand=padre,madre,aveGenerada`, {
                headers: { "Authorization": `Bearer ${this.authService.getToken()}` }
            });

            if (!response.ok) {
                MessageBox.error("Pollito no encontrado");
                this.onNavBack();
                return;
            }

            const ave = await response.json();
            const oModel = this.getView()?.getModel("pollito") as JSONModel;
            oModel.setData({
                ...oModel.getData(),
                ...ave,
                placaPadre: ave.padre?.placa || "",
                nombrePadre: ave.padre?.nombre || "",
                placaMadre: ave.madre?.placa || "",
                nombreMadre: ave.madre?.nombre || "",
                estadoTexto: this.formatearEstado(ave.estado)
            });
        } catch (error) {
            MessageBox.error("Error cargando el pollito");
        }
    }

    public onValueHelpPadre(): void {
        this.helpSelected = "valueHelpPadre";
        this.onAbrirPopupPadres("Seleccionar Padre");
    }

    public onValueHelpMadre(): void {
        this.helpSelected = "valueHelpMadre";
        this.onAbrirPopupPadres("Seleccionar Madre");
    }

    private async onAbrirPopupPadres(titulo: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/AvesActivas`, {
                headers: {
                    "Authorization": `Bearer ${this.authService.getToken()}`,
                    "Content-Type": "application/json"
                }
            });
            const data = await response.json();
            const aves = data.value || [];
            const padres = this.helpSelected === "valueHelpPadre"
                ? aves.filter((a: any) => a.sexo === "M" && a.padrote === true)
                : aves.filter((a: any) => a.sexo === "H" && a.padrote === true);

            this.getView()?.setModel(new JSONModel(padres), "avesPadres");

            if (!this._oPadresDialog) {
                this._oPadresDialog = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.PadresDialog",
                    controller: this
                }) as Dialog;
                this.getView()?.addDependent(this._oPadresDialog);
            }

            this._oPadresDialog.setTitle(titulo);
            this._oPadresDialog.open();
        } catch (error) {
            MessageToast.show("No se pudo cargar la lista de reproductores");
        }
    }

    public onSeleccionarPadre(oEvent: Event): void {
        const item = oEvent.getParameter("listItem");
        const ave = item?.getBindingContext("avesPadres")?.getObject();
        const oModel = this.getView()?.getModel("pollito") as JSONModel;

        if (ave && this.helpSelected === "valueHelpPadre") {
            oModel.setProperty("/padre_ID", ave.ID);
            oModel.setProperty("/placaPadre", ave.placa);
            oModel.setProperty("/nombrePadre", ave.nombre);
            this.onChangePlacaPadre();
        }

        if (ave && this.helpSelected === "valueHelpMadre") {
            oModel.setProperty("/madre_ID", ave.ID);
            oModel.setProperty("/placaMadre", ave.placa);
            oModel.setProperty("/nombreMadre", ave.nombre);
            this.onChangePlacaMadre();
        }

        this._oPadresDialog?.close();
    }

    public onCerrarPopupPadres(): void {
        this._oPadresDialog?.close();
    }

    public onSearchPadres(oEvent: Event): void {
        const value = oEvent.getParameter("newValue") || "";
        const list = this.byId("listaPadres") as List;
        const binding = list.getBinding("items");

        if (!binding) return;
        if (!value) {
            binding.filter([]);
            return;
        }

        binding.filter([new Filter({
            filters: [
                new Filter("nombre", FilterOperator.Contains, value),
                new Filter("placa", FilterOperator.Contains, value)
            ],
            and: false
        })]);
    }
    
    public onChangeCintillo(oEvent: Event): void {
        
        const oThat = this;
        const oModel = this.getView()?.getModel("pollito") as JSONModel;
        const data = oModel.getData();
        if (!data.cintillo) {
            oModel.setProperty("/cintilloState", "Error");
            MessageToast.show("El cintillo es requerido");
            return;
        }
        oModel.setProperty("/cintilloState", "None");

    }

    public onChangeColorCintillo(oEvent: Event): void {
        
        const oThat = this;
        const oModel = this.getView()?.getModel("pollito") as JSONModel;
        const data = oModel.getData();
        if (!data.cintillo) {
            oModel.setProperty("/colorCintilloState", "Error");
            MessageToast.show("El color cintillo es requerido");
            return;
        }
        oModel.setProperty("/colorCintilloState", "None");

    }

    public onChangeTemporada(oEvent: Event): void {
        
        const oThat = this;
        const oModel = this.getView()?.getModel("pollito") as JSONModel;
        const data = oModel.getData();
        if (!data.cintillo) {
            oModel.setProperty("/temporadaState", "Error");
            MessageToast.show("La temporada es requerida");
            return;
        }
        oModel.setProperty("/temporadaState", "None");

    }

    public onChangeFecNac(oEvent: Event): void {
        
        const oThat = this;
        const oModel = this.getView()?.getModel("pollito") as JSONModel;
        const data = oModel.getData();
        if (!data.cintillo) {
            oModel.setProperty("/fecNacState", "Error");
            MessageToast.show("La fecha de nacimiento es requerida");
            return;
        }
        oModel.setProperty("/fecNacState", "None");

    }

    public onChangePlacaPadre(): void {
        
        const oThat = this;
        const oModel = this.getView()?.getModel("pollito") as JSONModel;
        const data = oModel.getData();
        if (!data.cintillo) {
            oModel.setProperty("/placaPadreState", "Error");
            MessageToast.show("El padre es requerido");
            return;
        }
        oModel.setProperty("/placaPadreState", "None");

    }

    public onChangePlacaMadre(): void {
        
        const oThat = this;
        const oModel = this.getView()?.getModel("pollito") as JSONModel;
        const data = oModel.getData();
        if (!data.cintillo) {
            oModel.setProperty("/placaMadreState", "Error");
            MessageToast.show("La madre es requerida");
            return;
        }
        oModel.setProperty("/placaMadreState", "None");

    }

    public async onGuardar(): Promise<void> {
        const oThat = this;
        const oModel = this.getView()?.getModel("pollito") as JSONModel;
        const data = oModel.getData();

        if (!this.validar(data, oModel)) return;

        const authUser = localStorage.getItem("auth_user");
        if (!authUser) {
            MessageToast.show("No se encontro la sesion del usuario");
            return;
        }

        // Validar cintillo
        if (!data.cintillo) {
            oModel.setProperty("/cintilloState", "Error");
            MessageToast.show("El cintillo es requerido");
            return;
        }
        oModel.setProperty("/cintilloState", "None");

        // Validar color cintillo
        if (!data.colorCintillo) {
            oModel.setProperty("/colorCintilloState", "Error");
            MessageToast.show("El color cintillo es requerido");
            return;
        }
        oModel.setProperty("/colorCintilloState", "None");

        // Validar temporada
        if (!data.temporada) {
            oModel.setProperty("/temporadaState", "Error");
            MessageToast.show("La temporada es requerida");
            return;
        }
        oModel.setProperty("/temporadaState", "None");

        // Validar fecha de nacimiento
        if (!data.fechaNacimiento) {
            oModel.setProperty("/fecNacState", "Error");
            MessageToast.show("La fecha de nacimiento es requerida");
            return;
        }
        oModel.setProperty("/fecNacState", "None");

        // Validar placa padre
        /*if (!data.placaPadre) {
            oModel.setProperty("/placaPadreState", "Error");
            MessageToast.show("El padre es requerido");
            return;
        }
        oModel.setProperty("/placaPadreState", "None");

        // Validar placa madre
        if (!data.placaMadre) {
            oModel.setProperty("/placaMadreState", "Error");
            MessageToast.show("La Madre es requerida");
            return;
        }
        oModel.setProperty("/placaMadreState", "None");

         */

        const usuario = JSON.parse(authUser);
        const payload: any = {
            cintillo: String(data.cintillo).trim(),
            colorCintillo: String(data.colorCintillo).trim(),
            temporada: Number(data.temporada),
            nombre: data.nombre || null,
            sexo: data.sexo,
            fechaNacimiento: data.fechaNacimiento,
            color: data.color || null,
            ubicacion: data.ubicacion || null,
            observaciones: data.observaciones || null,
            estado: data.estado || "ACTIVA"
        };

        if (!this.pollitoId) {
            payload.usuario_ID = usuario._id;
        }

        //const oInputPadre = oThat.byId("inputPadre") as Input;
        const placaPadre = data.placaPadre;
        const oMachosModel = oThat.getView()?.getModel("avesMachos") as JSONModel;
        const aMachos = oMachosModel.getData() as any[];
        let oPadre: IAve[];
        if (aMachos.length > 0 && placaPadre) {
            oPadre = aMachos.filter((a: any) => a.placa === placaPadre);
            data.padre_ID = oPadre[0].ID;
        }

        //const oInputMadre = oThat.byId("inputMadre") as Input;
        const placaMadre = data.placaMadre;
        const oHembrasModel = oThat.getView()?.getModel("avesHembras") as JSONModel;
        const aHembras = oHembrasModel.getData() as any[];
        let oMadre: IAve[];
        if (aHembras.length > 0 && placaMadre) {
            oMadre = aHembras.filter((a: any) => a.placa === placaMadre);
            data.madre_ID = oMadre[0].ID;
        }

        if (data.padre_ID) payload.padre_ID = data.padre_ID;
        if (data.madre_ID) payload.madre_ID = data.madre_ID;

        const detalleConfirmacion = [
            `Cintillo: ${payload.cintillo}`,
            payload.nombre ? `Nombre: ${payload.nombre}` : "",
            `Temporada: ${payload.temporada}`
        ].filter(Boolean).join("\n");
        const confirmado = this.pollitoId
            ? await ConfirmationService.confirmUpdate("el ave joven", detalleConfirmacion)
            : await ConfirmationService.confirmCreate("el ave joven", detalleConfirmacion);
        if (!confirmado) return;
        
        try {
            const url = this.pollitoId ? `${this.baseUrl}/Crias('${this.pollitoId}')` : `${this.baseUrl}/Crias`;
            const response = await fetch(url, {
                method: this.pollitoId ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                MessageBox.error(error.error?.message || "Error guardando la ave");
                return;
            }

            MessageBox.success(this.pollitoId ? "Ave actualizado exitosamente !!!" : "Ave registrado exitosamente !!!", {
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: () => this.onNavBack(),
                dependentOn: this.getView()
            });
        } catch (error) {
            MessageBox.error("No se pudo guardar la ave");
        }
    }

    private validar(data: any, oModel: JSONModel): boolean {
        const requerido = [
            ["cintillo", "cintilloState", "El cintillo es requerido"],
            ["colorCintillo", "colorCintilloState", "El color de cintillo es requerido"],
            ["temporada", "temporadaState", "La temporada es requerida"],
            ["fechaNacimiento", "fecNacState", "La fecha de nacimiento es requerida"]
        ];

        for (const [campo, estado, mensaje] of requerido) {
            if (!data[campo]) {
                oModel.setProperty(`/${estado}`, "Error");
                MessageToast.show(String(mensaje));
                return false;
            }
            oModel.setProperty(`/${estado}`, "None");
        }

        const temporada = Number(data.temporada);
        if (temporada < 2000 || temporada > 2100) {
            oModel.setProperty("/temporadaState", "Error");
            MessageToast.show("La temporada debe ser un anio valido");
            return false;
        }

        return true;
    }

    public onNavBack(): void {
        const router = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        router?.navTo("RoutePollitos");
    }

    public onNavWelcome(): void {
        const router = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
        router?.navTo("RouteWelcome");
    }

    public formatearEstado(estado: string): string {
        return estado === "REGISTRADA_ADULTA" ? "Registrada como Ave Adulta" : "Activa";
    }
}
