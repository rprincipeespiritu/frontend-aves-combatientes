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

export default class AveCreate extends Controller {
    private authService: AuthService;
    private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";

    public onInit(): void {
        this.authService = AuthService.getInstance();

        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        const oTarget = oRouter?.getTarget("TargetAveCreate") as any;
        oTarget?.attachDisplay(this.onTargetDisplay, this);
    }

    private onTargetDisplay = (): void => {
        if (!this.authService.isAuthenticated()) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLogin");
            return;
        } else {
            const oModel = new JSONModel({
                placa: "", nombre: "", apodo: "", sexo: "M",
                estado: "ACTIVO", ubicacion: "", raza: "",
                color: "", tipoAve: "", fechaNacimiento: "",
                fechaCompra: "", padre_ID: "", madre_ID: "",
                procedencia: "", criador: "", valorCompra: "",
                valorActual: "", observaciones: "", placaState: "None",
                categoria: "BUENO"
            });
            this.getView()?.setModel(oModel, "create");

            this.cargarCatalogos();
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

            const response = await fetch(`${this.baseUrl}/Aves`, {
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
        try {
            const oThat = this;
            const oModel = this.getView()?.getModel("create") as JSONModel;
            const data = oModel.getData();

            // Validar placa
            if (!data.placa) {
                oModel.setProperty("/placaState", "Error");
                MessageToast.show("La placa es requerida");
                return;
            }
            oModel.setProperty("/placaState", "None");

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

            const oInputPadre = oThat.byId("idPadre") as Input;
            const placaPadre = oInputPadre.getSelectedKey();
            const oMachosModel = oThat.getView()?.getModel("avesMachos") as JSONModel;
            const aMachos = oMachosModel.getData() as any[];
            let oPadre: IAve[];
            if (aMachos.length > 0) {
                oPadre = aMachos.filter((a: any) => a.placa === placaPadre);
                data.padre_ID = oPadre[0].id;
            }

            const oInputMadre = oThat.byId("idMadre") as Input;
            const placaMadre = oInputPadre.getSelectedKey();
            const oHembrasModel = oThat.getView()?.getModel("avesHembras") as JSONModel;
            const aHembras = oHembrasModel.getData() as any[];
            let oMadre: IAve[];
            if (aHembras.length > 0) {
                oMadre = aHembras.filter((a: any) => a.placa === placaMadre);
                data.madre_ID = oMadre[0].id;
            }

            if (data.padre_ID) payload.padre_ID = data.padre_ID;
            if (data.madre_ID) payload.madre_ID = data.madre_ID;


            const response = await fetch(`${this.baseUrl}/Aves`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                MessageBox.success("¡Ave creada exitosamente!", {
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        this.onNavBack();
                    },
                    dependentOn: this.getView()
                });
            } else {
                const error = await response.json();
                MessageBox.error(error.error?.message || "Error al crear el ave");
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
        const oModel = this.getView()?.getModel("create") as JSONModel
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
        const oModel = this.getView()?.getModel("create") as JSONModel
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
}