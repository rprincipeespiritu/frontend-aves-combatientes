import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Event from "sap/ui/base/Event";
import Fragment from "sap/ui/core/Fragment";
import Popover from "sap/m/Popover";
import ActionSheet from "sap/m/ActionSheet";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Label from "sap/m/Label";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import Button from "sap/m/Button";
import Device from "sap/ui/Device";
import Control from "sap/ui/core/Control";
import { AuthService } from "../services/AuthService";
import ConfirmationService from "../services/ConfirmationService";
import { resolverPlanesCruceTexto } from "../services/PlanCruceLookupService";
import Select from "sap/m/Select";
import Item from "sap/ui/core/Item";

export default class PollitoDetail extends Controller {
    private baseUrl = "http://localhost:4004/api/avecombatiente";
    private authService: AuthService;
    private pollitoId = "";
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private _oRegistrarAdultoDialog?: Dialog;
    private _oPlacaAdultoInput?: Input;

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const router = (this.getOwnerComponent() as UIComponent)?.getRouter();
        router?.getRoute("RoutePollitoDetail")?.attachPatternMatched(this.onRouteMatched, this);
    }

    private onRouteMatched = (event: any): void => {
        if (!this.authService.isAuthenticated()) {
            (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
            return;
        }

        this.bindUserModel();

        this.pollitoId = event.getParameter("arguments")?.pollitoId || "";
        this.getView()?.setModel(new JSONModel({ busy: true }), "detail");
        this.cargarDetalle();
    };

    private async cargarDetalle(): Promise<void> {
        const model = this.getView()?.getModel("detail") as JSONModel;
        model.setProperty("/busy", true);

        try {
            const response = await fetch(`${this.baseUrl}/Crias('${this.pollitoId}')?$expand=padre,madre,aveGenerada`, {
                headers: {
                    "Authorization": `Bearer ${this.authService.getToken()}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                MessageBox.error("Pollito no encontrado");
                this.onNavBack();
                return;
            }

            const data = await response.json();
            const planesCruceTexto = await resolverPlanesCruceTexto({
                baseUrl: this.baseUrl,
                token: this.authService.getToken(),
                padreId: data.padre_ID || data.padre?.ID,
                madreId: data.madre_ID || data.madre?.ID,
            });

            model.setData({
                ...data,
                busy: false,
                identificador: this.formatearIdentificador(data),
                estadoTexto: this.formatearEstado(data.estado),
                planesCruceTexto: planesCruceTexto || "-",
            });
        } catch (error) {
            MessageBox.error("No se pudo cargar el detalle del pollito");
            this.onNavBack();
        } finally {
            model.setProperty("/busy", false);
        }
    }

    public onEditar(): void {
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RoutePollitoEdit", { pollitoId: this.pollitoId });
    }

    public async onEliminar(): Promise<void> {
        const data = (this.getView()?.getModel("detail") as JSONModel).getData();
        const identificador = this.formatearIdentificador(data);
        const confirmado = await ConfirmationService.confirmDelete(
            "el pollito",
            identificador ? `Identificador: ${identificador}` : undefined
        );
        if (!confirmado) return;

        try {
            const response = await fetch(`${this.baseUrl}/eliminarCria`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify({ criaId: this.pollitoId })
            });

            const result = await response.json();
            if (!response.ok || result?.success === false) {
                throw new Error(result?.error?.message || result?.message || "No se pudo eliminar el pollito");
            }

            MessageBox.success("Pollito eliminado correctamente", {
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: () => this.onNavBack(),
                dependentOn: this.getView()
            });
        } catch (error: any) {
            MessageBox.error(error.message || "Error eliminando el pollito");
        }
    }

    public onRegistrarComoAveAdulta(): void {
        const data = (this.getView()?.getModel("detail") as JSONModel).getData();
        if (["FALLECIDO", "VENDIDO", "OBSEQUIADO"].includes(data?.estado)) {
            MessageBox.warning("No se puede registrar como ave adulta porque el ave joven no está en estado Activa.");
            return;
        }
        this.abrirDialogoRegistroAdulto(data);
    }

    private abrirDialogoRegistroAdulto(data: any): void {
        if (!this._oPlacaAdultoInput) {
            this._oPlacaAdultoInput = new Input({
                placeholder: "Ingrese la placa del ave",
                valueLiveUpdate: true,
                maxLength: 20
            });
        }

        this._oPlacaAdultoInput.setValue("");
        this._oPlacaAdultoInput.setValueState("None");

        if (!this._oGeneroInput) {
            this._oGeneroInput = new Select({
                width: "100%",        
                selectedKey: "",        
                items: [
                    new Item({
                        key: "M",
                        text: "Macho"
                    }),        
                    new Item({
                        key: "H",
                        text: "Hembra"
                    })
                ]       
            });
        }

        this._oGeneroInput.setSelectedKey("");
        this._oGeneroInput.setValueState("None");

        if (!this._oRegistrarAdultoDialog) {
            this._oRegistrarAdultoDialog = new Dialog({
                title: "Registrar como ave adulta",
                contentWidth: "auto",
                content: [
                    new VBox({                        
                        items: [
                            new Text({
                                text: `Confirmar registro de ${this.formatearIdentificador(data)} como ave adulta.`
                            }),
                            new Label({
                                text: "Placa del ave",
                                required: true                               
                            }).addStyleClass("sapUiSmallMarginTop"),
                            this._oPlacaAdultoInput,
                            new Label({
                                text: "Género",
                                required: true                               
                            }).addStyleClass("sapUiSmallMarginTop"),
                            this._oGeneroInput
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new Button({
                    text: "Registrar",
                    type: "Emphasized",
                    press: () => {
                        const placa = this._oPlacaAdultoInput?.getValue().trim().toUpperCase() || "";
                        if (!placa) {
                            this._oPlacaAdultoInput?.setValueState("Error");
                            this._oPlacaAdultoInput?.setValueStateText("La placa es obligatoria");
                            MessageToast.show("Ingrese la placa del ave");
                            return;
                        }

                        const genero = this._oGeneroInput?.getSelectedKey().trim().toUpperCase() || "";
                        if (!genero) {
                            this._oGeneroInput?.setValueState("Error");
                            this._oGeneroInput?.setValueStateText("El género es obligatorio");
                            MessageToast.show("Ingrese el género del ave");
                            return;
                        }

                        this._oRegistrarAdultoDialog?.close();
                        this.registrarComoAveAdulta(placa, genero);
                    }
                }),
                endButton: new Button({
                    text: "Cancelar",
                    press: () => this._oRegistrarAdultoDialog?.close()
                })
            });
            this.getView()?.addDependent(this._oRegistrarAdultoDialog);
        }

        this._oRegistrarAdultoDialog.open();
    }

    private async registrarComoAveAdulta(placa: string, genero: string): Promise<void> {
        const data = (this.getView()?.getModel("detail") as JSONModel).getData();
        if (["FALLECIDO", "VENDIDO", "OBSEQUIADO"].includes(data?.estado)) {
            MessageBox.warning("No se puede registrar como ave adulta porque el ave joven no está en estado Activa.");
            return;
        }

        const confirmado = await ConfirmationService.confirmCreate("el ave adulta", `Placa: ${placa}`);
        if (!confirmado) return;

        try {
            const response = await fetch(`${this.baseUrl}/registrarCriaComoAve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify({ criaId: this.pollitoId, placa, genero})
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error?.message || "No se pudo registrar como ave adulta");
            }

            MessageBox.success(`Ave adulta creada con placa ${result?.placa || ""}`, {
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: () => this.cargarDetalle(),
                dependentOn: this.getView()
            });
        } catch (error: any) {
            MessageBox.error(error.message || "Error registrando como ave adulta");
        }
    }

    public formatearIdentificador(pollito: any): string {
        if (!pollito) return "";
        return [pollito.temporada, pollito.colorCintillo, pollito.cintillo].filter(Boolean).join(" - ");
    }

    public formatearFecha(fecha: string | Date): string {
        if (!fecha) {
          return "";
        }
    
        if (typeof fecha === "string") {
          const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
          }
        }
    
        const date = fecha instanceof Date ? fecha : new Date(fecha);
        if (isNaN(date.getTime())) {
          return "";
        }
    
        return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    }

    public formatearSexo(sexo: string): string {
        return sexo === "M" ? "Macho" : sexo === "H" ? "Hembra" : "";
    }

    public formatearEstado(estado: string): string {
        if (estado === "REGISTRADA_ADULTA") return "Registrada como Ave Adulta";
        if (estado === "FALLECIDO") return "Fallecido";
        if (estado === "VENDIDO") return "Vendido";
        if (estado === "OBSEQUIADO") return "Obsequiado";
        return "Activa";
    }

    public onNavBack(): void {
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RoutePollitos");
    }

    public onNavWelcome(): void {
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
    }

    public async onUserMenuPress(oEvent: Event): Promise<void> {
        const source = oEvent.getSource() as Control;
    this.bindUserModel();

        if (Device.system.phone) {
            if (!this._oUserMenuSheet) {
                this._oUserMenuSheet = await Fragment.load({
                    id: this.getView()?.getId(),
                    name: "com.rprincipees.registroavescombate.view.fragments.UserMenuMobile",
                    controller: this
                }) as ActionSheet;
                this.getView()?.addDependent(this._oUserMenuSheet);
            }
            this._oUserMenuSheet.isOpen() ? this._oUserMenuSheet.close() : this._oUserMenuSheet.openBy(source);
            return;
        }

        if (!this._oUserMenuPopover) {
            this._oUserMenuPopover = await Fragment.load({
                id: this.getView()?.getId(),
                name: "com.rprincipees.registroavescombate.view.fragments.UserMenu",
                controller: this
            }) as Popover;
            this.getView()?.addDependent(this._oUserMenuPopover);
        }
        this._oUserMenuPopover.isOpen() ? this._oUserMenuPopover.close() : this._oUserMenuPopover.openBy(source);
    }

    public async onLogout(): Promise<void> {
        await this.authService.logout();
        MessageToast.show("Sesion cerrada exitosamente");
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLanding");
    }

    public onVerAve(): void {
        const oModel = this.getView()?.getModel("detail") as JSONModel;
        
        MessageBox.confirm(
            `¿Estás seguro que deseas navegar a los detalles de la Ave Adulta?`,
            {
                title: "Navegar detalle Ave",
                onClose: (oAction: string) => {
                    if (oAction === MessageBox.Action.OK) {
                        const idAve: any = oModel.getProperty("/aveGenerada/ID");

                        if (idAve) {
                            const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();

                            const sHash = oRouter.getURL("RouteAveDetail", {
                                aveId: idAve
                            });

                            window.open("#" + sHash, "_blank"); //abre en nueva pestaña
                        }
                    }
                },
            }
        );

    }

}
