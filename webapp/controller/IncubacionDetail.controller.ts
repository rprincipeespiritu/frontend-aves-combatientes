import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import IncubacionService from "../services/IncubacionService";
import formatter from "../model/formatter";
import { EstadoIncubacion } from "../types/Models";
import Input from "sap/m/Input";
import BusyIndicator from "sap/ui/core/BusyIndicator";
import Button from "sap/m/Button";
import Label from "sap/m/Label";
import VBox from "sap/m/VBox";
import Dialog from "sap/m/Dialog";
import MessageToast from "sap/m/MessageToast";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/m/routing/Router";
import { AuthService } from "../services/AuthService";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";

export default class IncubacionDetail extends Controller {
    private _oUserMenuSheet: any;
    private _oUserMenuPopover: any;
    private _oFinalizarDialog: Dialog | null = null;
    private authService: AuthService;
    public formatter = formatter;
    private service = new IncubacionService();
    private incubacionId: string = "";
    private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oModel = new JSONModel({
            busy: false,
            incubacion: {},
            finalizar: {
                observacion: "",
                detalles: [],
            },
            finalizarObservacion: "",
            finalizarDetalles: [],
        });

        this.getView()?.setModel(oModel, "view");

        this.getOwnerComponent()
            ?.getRouter()
            .getRoute("RouteIncubacionDetail")
            ?.attachPatternMatched(this._onRouteMatched, this);
    }

    private _onRouteMatched = async (
        oEvent: sap.ui.base.Event,
    ): Promise<void> => {

        if (!this.authService.isAuthenticated()) {
            const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
            oRouter?.navTo("RouteLogin");
            return;
        }

    this.bindUserModel();


        const args = oEvent.getParameter("arguments") as { id?: string };
        this.incubacionId = args.id || "";

        if (!this.incubacionId) {
            MessageBox.error("No se recibió el ID de la incubación");
            return;
        }

        await this._loadIncubacion();
    };

    public async onUserMenuPress(oEvent: Event): Promise<void> {
        const oSource = (oEvent as any)?.getSource() as Control;
    this.bindUserModel();

        if (Device.system.phone) {
            if (!this._oUserMenuSheet) {
                const oFragment = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.UserMenuMobile",
                    controller: this,
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
                controller: this,
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
            localStorage.removeItem("auth_token");
            const oRouter = (
                this.getOwnerComponent() as UIComponent
            )?.getRouter() as Router;
            oRouter?.navTo("RouteLogin");
        } catch (error) {
            MessageBox.error("Error al cerrar sesión.");
        }
    }

    private async _loadIncubacion(): Promise<void> {
        const oModel = this.getView()?.getModel("view") as JSONModel;
        oModel.setProperty("/busy", true);

        try {
            const incubacion = await this.service.getById(this.incubacionId);

            let detalles = incubacion.detalles;
            for (let index = 0; index < detalles.length; index++) {
                const element = detalles[index];
                element.placaPadre = element.padre?.placa || element.placaPadre || "";
                element.nombrePadre = element.padre?.nombre || element.padre?.apodo || element.nombrePadre || "";
                element.placaMadre = element.madre?.placa || element.placaMadre || "";
                element.nombreMadre = element.madre?.nombre || element.madre?.apodo || element.nombreMadre || "";
                element.padreResumen = this.formatAveResumen(element.placaPadre, element.nombrePadre);
                element.madreResumen = this.formatAveResumen(element.placaMadre, element.nombreMadre);
                element.planCruceCodigo = element.planCruce?.codigo || element.planCruceCodigo || "";
            }

            oModel.setProperty("/incubacion", {
                ID: incubacion.ID,
                codigo: incubacion.codigo || "",
                fechaIncubacion: new Date(incubacion.fechaIncubacion) || "",
                fechaPreNacimiento: new Date(incubacion.fechaPreNacimiento) || "",
                fechaEclosion: new Date(incubacion.fechaEclosion) || "",
                fechaFinIncubacion: new Date(incubacion.fechaFinIncubacion) || "",
                estado: incubacion.estado || "PROGRAMADA",
                observaciones: incubacion.observaciones || "",
                motivoCancelacion: incubacion.motivoCancelacion || "",
                detalles: incubacion.detalles,
            });
        } catch (error) {
            MessageBox.error(
                error instanceof Error
                    ? error.message
                    : "No se pudo cargar la incubación",
            );
        } finally {
            oModel.setProperty("/busy", false);
        }
    }

    public onNavBack = (): void => {
        this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
    };

    public onNavWelcome = (): void => {
        this.getOwnerComponent()?.getRouter().navTo("RouteWelcome");
    };

    public onEdit = (): void => {
        this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionEdit", {
            id: this.incubacionId,
        });
    };

    public formatearEstado(estado: EstadoIncubacion): string {
        const estados = {
            [EstadoIncubacion.Proceso]: "En proceso",
            [EstadoIncubacion.Programada]: "Programada",
            [EstadoIncubacion.Completada]: "Completada",
            [EstadoIncubacion.Cancelada]: "Cancelada",
        };

        return estados[estado] || estado;
    }

    public formatAveResumen(placa?: string, nombre?: string): string {
        const sPlaca = String(placa || "").trim();
        const sNombre = String(nombre || "").trim();

        if (sPlaca && sNombre) {
            return `${sPlaca} - ${sNombre}`;
        }

        return sPlaca || sNombre || "Sin registro";
    }

    public onConfirmarIniciar(oEvent: any): void {
        const oThat = this;
        const oData = oThat.getView()?.getModel("view").getProperty("/incubacion");

        if (!oData?.ID) {
            MessageBox.error("No se encontró el ID de la incubación");
            return;
        }

        if (oData.estado !== "PROGRAMADA") {
            MessageBox.error(
                "Solo se puede iniciar una incubación en estado PROGRAMADA",
            );
            return;
        }

        if (!oData.fechaIncubacion) {
            MessageBox.error("La incubación no tiene fecha de incubación");
            return;
        }

        const oFechaIncubacion = new Date(oData.fechaIncubacion);
        const oFechaActual = new Date();

        if (isNaN(oFechaIncubacion.getTime())) {
            MessageBox.error("La fecha de incubación no es válida");
            return;
        }

        if (oFechaIncubacion > oFechaActual) {
            MessageBox.error(
                "La fecha de incubación no debe ser mayor a la fecha actual",
            );
            return;
        }

        MessageBox.confirm("¿Desea iniciar esta incubación?", {
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            onClose: async (sAction: string) => {
                if (sAction === MessageBox.Action.YES) {
                    await oThat.onIniciarIncubacion(oEvent);
                }
            },
        });
    }

    private async onIniciarIncubacion(oEvent: any): Promise<void> {
        BusyIndicator.show(0);

        try {
            const oThat = this;
            const oData = oThat
                .getView()
                ?.getModel("view")
                .getProperty("/incubacion");

            const sId = oData.ID;

            const sUrl = `${this.baseUrl}/Incubaciones(${sId})/iniciar`;

            const response = await fetch(sUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                },
                body: JSON.stringify({}),
            });

            BusyIndicator.hide();
            if (!response.ok) {
                let result = await response.json();
                MessageBox.error(result?.error?.message);
                return;
            }

            MessageBox.success("¡Incubación iniciada correctamente!", {
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction: string) {
                    oThat.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
                },
                dependentOn: oThat.getView(),
            });
        } catch (error: any) {
            BusyIndicator.hide();
            MessageBox.error(error.message || "No se pudo iniciar la incubación");
            console.error("Error al iniciar incubación:", error);
        }
    }

    public onConfirmarFinalizar(): void {
        const oThat = this;
        const oViewModel = oThat.getView()?.getModel("view") as JSONModel;
        const oData = oViewModel.getProperty("/incubacion");

        const oFechaEclosion = new Date(oData.fechaEclosion || 0);
        const oFechaActual = new Date();

        if (oFechaEclosion > oFechaActual) {
            MessageBox.error("Aún no se alcanza la fecha de eclosión estimada");
            return;
        }

        const detallesFinalizacion = (oData?.detalles || []).map((detalle: any) => {
            const huevosFertiles = Number(detalle.huevosFertiles || 0);
            const huevosEclosionados = Number(detalle.huevosEclosionados || 0);
            return {
                ID: detalle.ID,
                placaPadre: detalle.placaPadre || "",
                nombrePadre: detalle.nombrePadre || "",
                placaMadre: detalle.placaMadre || "",
                nombreMadre: detalle.nombreMadre || "",
                huevosFertiles,
                huevosEclosionados,
                huevosNoEclosionados: this.calcularNoEclosionados(
                    huevosFertiles,
                    huevosEclosionados,
                ),
            };
        });

        oViewModel.setProperty("/finalizarObservacion", "");
        oViewModel.setProperty("/finalizarDetalles", detallesFinalizacion);
        // Backward-compatible model path in case an older cached fragment is rendered
        oViewModel.setProperty("/finalizar/observacion", "");
        oViewModel.setProperty("/finalizar/detalles", detallesFinalizacion);

        void this.abrirDialogoFinalizacion();
    }

    private async abrirDialogoFinalizacion(): Promise<void> {
        if (!this._oFinalizarDialog) {
            this._oFinalizarDialog = (await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.FinalizarIncubacionDialog",
                controller: this,
            })) as Dialog;

            this.getView()?.addDependent(this._oFinalizarDialog);
        }

        this._oFinalizarDialog.open();
    }

    public onCerrarDialogoFinalizar(): void {
        this._oFinalizarDialog?.close();
    }

    public onDetalleNacimientoChange(oEvent: Event): void {
        const oSource = oEvent.getSource() as Input;
        const oContext = oSource.getBindingContext("view");

        if (!oContext) {
            return;
        }

        const sDetallePath = oContext.getPath();
        const oViewModel = this.getView()?.getModel("view") as JSONModel;
        const huevosFertiles = Number(
            oViewModel.getProperty(`${sDetallePath}/huevosFertiles`) || 0,
        );
        const huevosEclosionados = Number(
            oViewModel.getProperty(`${sDetallePath}/huevosEclosionados`) || 0,
        );

        oViewModel.setProperty(
            `${sDetallePath}/huevosNoEclosionados`,
            this.calcularNoEclosionados(huevosFertiles, huevosEclosionados),
        );
    }

    public async onConfirmarFinalizarDialog(): Promise<void> {
        const oViewModel = this.getView()?.getModel("view") as JSONModel;
        const detalles = oViewModel.getProperty("/finalizarDetalles") || [];

        for (let i = 0; i < detalles.length; i++) {
            const detalle = detalles[i];
            const fertiles = Number(detalle.huevosFertiles || 0);
            const eclosionados = Number(detalle.huevosEclosionados || 0);

            if (eclosionados < 0) {
                MessageBox.error(
                    `Nacidos no puede ser negativo en el detalle ${i + 1}`,
                );
                return;
            }

            if (eclosionados > fertiles) {
                MessageBox.error(
                    `Nacidos no puede ser mayor a Fértiles en el detalle ${i + 1}`,
                );
                return;
            }

            detalle.huevosNoEclosionados = this.calcularNoEclosionados(
                fertiles,
                eclosionados,
            );
        }

        oViewModel.setProperty("/finalizarDetalles", detalles);
        oViewModel.setProperty("/finalizar/detalles", detalles);
        this._oFinalizarDialog?.close();

        await this._finalizarIncubacion(
            String(
                oViewModel.getProperty("/finalizarObservacion") ||
                oViewModel.getProperty("/finalizar/observacion") ||
                "",
            ).trim(),
            detalles,
        );
    }

    private calcularNoEclosionados(
        huevosFertiles: number | string,
        huevosEclosionados: number | string,
    ): number {
        const fertiles = Number(huevosFertiles || 0);
        const eclosionados = Number(huevosEclosionados || 0);
        return Math.max(fertiles - eclosionados, 0);
    }

    private async _finalizarIncubacion(
        observacion: string,
        detallesFinalizacion: any[],
    ): Promise<void> {
        try {
            const oThat = this;
            const oData = oThat
                .getView()
                ?.getModel("view")
                .getProperty("/incubacion");
            const sId = oData?.ID;

            if (!sId) {
                MessageBox.error("No se encontró el ID de la incubación");
                return;
            }

            if (oData.estado !== "EN_PROCESO") {
                MessageBox.error(
                    'Solo se puede finalizar una incubación en estado "En proceso"',
                );
                return;
            }

            BusyIndicator.show(0);

            await this._actualizarDetallesAntesDeFinalizar(sId, detallesFinalizacion);

            const response = await fetch(
                `${oThat.baseUrl}/Incubaciones('${sId}')/finalizar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                    },
                    body: JSON.stringify({
                        observacion,
                    }),
                },
            );

            BusyIndicator.hide();

            if (!response.ok) {
                const result = await response.json();
                throw new Error(
                    result?.error?.message || "No se pudo finalizar la incubación",
                );
            }

            MessageBox.success("¡Incubación finalizada correctamente!", {
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction: string) {
                    oThat.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
                },
                dependentOn: oThat.getView(),
            });

            //this._recargarDetalleIncubacion();
        } catch (error: any) {
            BusyIndicator.hide();
            MessageBox.error(error.message || "Error al finalizar la incubación");
        }
    }

    private async _actualizarDetallesAntesDeFinalizar(
        sId: string,
        detallesFinalizacion: any[],
    ): Promise<void> {
        const oViewModel = this.getView()?.getModel("view") as JSONModel;
        const detallesActuales = oViewModel.getProperty("/incubacion/detalles") || [];

        const detallesActualizados = (detallesActuales || []).map((detalleActual: any) => {
            const detalleConfirmado = (detallesFinalizacion || []).find(
                (item: any) => item.ID && item.ID === detalleActual.ID,
            ) || {};

            const huevosFertiles = Number(
                detalleConfirmado.huevosFertiles ?? detalleActual.huevosFertiles ?? 0,
            );
            const huevosEclosionados = Number(
                detalleConfirmado.huevosEclosionados ?? detalleActual.huevosEclosionados ?? 0,
            );

            return {
                ...detalleActual,
                huevosFertiles,
                huevosEclosionados,
                huevosNoEclosionados: this.calcularNoEclosionados(
                    huevosFertiles,
                    huevosEclosionados,
                ),
            };
        });

        const payload = {
            detalles: detallesActualizados.map((detalle: any) => ({
                ID: detalle.ID || null,
                padre_ID: detalle.padre_ID || detalle.padre?.ID || null,
                madre_ID: detalle.madre_ID || detalle.madre?.ID || null,
                planCruce_ID: detalle.planCruce_ID || detalle.planCruce?.ID || null,
                tipoParentesco: detalle.tipoParentesco || null,
                nivelRiesgo: detalle.nivelRiesgo || null,
                porcentaje:
                    detalle.porcentaje === undefined || detalle.porcentaje === null
                        ? null
                        : Number(detalle.porcentaje),
                totalHuevos: Number(detalle.totalHuevos || 0),
                huevosFertiles: Number(detalle.huevosFertiles || 0),
                huevosEclosionados: Number(detalle.huevosEclosionados || 0),
                huevosNoEclosionados: Number(detalle.huevosNoEclosionados || 0),
                usuario_ID: detalle.usuario_ID || null,
            })),
        };

        const response = await fetch(`${this.baseUrl}/Incubaciones(ID='${sId}')`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(
                result?.error?.message ||
                result?.message ||
                "No se pudieron actualizar los nacimientos antes de finalizar",
            );
        }

        oViewModel.setProperty("/incubacion/detalles", detallesActualizados);
    }

    public onConfirmarCancelar(oEvent: Event): void {
        const oThat = this;

        const oInput = new Input({
            width: "100%",
            placeholder: "Ingrese el motivo de cancelación",
        });

        const oDialog = new Dialog({
            title: "Cancelar incubación",
            type: "Message",
            contentWidth: "25rem",
            content: [
                new VBox({
                    items: [
                        new Label({
                            text: "Motivo de cancelación",
                            labelFor: oInput,
                        }),
                        oInput,
                    ],
                }).addStyleClass("sapUiSmallMargin"),
            ],
            beginButton: new Button({
                text: "Aceptar",
                type: "Emphasized",
                press: async function () {
                    const sMotivo = oInput.getValue().trim();

                    if (!sMotivo) {
                        MessageBox.error("Debe ingresar un motivo de cancelación");
                        return;
                    }

                    oDialog.close();
                    await oThat._cancelarIncubacion(oEvent, sMotivo);
                },
            }),
            endButton: new Button({
                text: "Cerrar",
                press: function () {
                    oDialog.close();
                },
            }),
            afterClose: function () {
                oDialog.destroy();
            },
        });

        oDialog.open();
    }

    public onConfirmarReprogramar(): void {
        const oData = this
            .getView()
            ?.getModel("view")
            .getProperty("/incubacion");

        if (!oData?.ID) {
            MessageBox.error("No se encontró el ID de la incubación");
            return;
        }

        if (oData.estado !== "CANCELADA") {
            MessageBox.error(
                "Solo se puede reprogramar una incubación cancelada",
            );
            return;
        }

        this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionReprogramar", {
            id: this.incubacionId,
        });
    }

    private async _cancelarIncubacion(
        oEvent: any,
        sMotivo: string,
    ): Promise<void> {
        try {
            const oThat = this;
            const oData = oThat
                .getView()
                ?.getModel("view")
                .getProperty("/incubacion");

            const sId = oData.ID;

            const response = await fetch(
                `${oThat.baseUrl}/Incubaciones('${sId}')/cancelar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                    },
                    body: JSON.stringify({
                        observacion: sMotivo,
                    }),
                },
            );

            if (!response.ok) {
                const result = await response.json();
                throw new Error(
                    result?.error?.message || "No se pudo cancelar la incubación",
                );
            }

            MessageBox.success("¡Incubación cancelada correctamente!", {
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction: string) {
                    oThat.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
                },
                dependentOn: oThat.getView(),
            });
        } catch (error: any) {
            MessageBox.error(error.message || "Error al cancelar la incubación");
        }
    }
}
