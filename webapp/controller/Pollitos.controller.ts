import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Table from "sap/m/Table";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Event from "sap/ui/base/Event";
import Spreadsheet from "sap/ui/export/Spreadsheet";
import { AuthService } from "../services/AuthService";
import Popover from "sap/m/Popover";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Device from "sap/ui/Device";
import Control from "sap/ui/core/Control";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Label from "sap/m/Label";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import Button from "sap/m/Button";
import List from "sap/m/List";
import StandardListItem from "sap/m/StandardListItem";
import SearchField from "sap/m/SearchField";
import Bar from "sap/m/Bar";
import ConfirmationService from "../services/ConfirmationService";

export default class Pollitos extends Controller {
    private baseUrl = "http://localhost:4004/api/avecombatiente";
    private authService: AuthService;
    private _oUserMenuPopover: any;
    private _oUserMenuSheet: any;
    private _oRegistrarAdultoDialog?: Dialog;
    private _oPlacaAdultoInput?: Input;
    private _criaIdRegistroAdulto = "";
    private _oFiltroPadresDialog?: Dialog;
    private _oFiltroPadresList?: List;
    private filtroPadresSeleccionado: "padre" | "madre" = "padre";

    public onInit(): void {
        this.authService = AuthService.getInstance();
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.getRoute("RoutePollitos")?.attachPatternMatched(this.onRouteMatched, this);
    }

    private onRouteMatched = (): void => {
        if (!this.authService.isAuthenticated()) {
            (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
            return;
        }

        const sUserData = localStorage.getItem("auth_user");
        if (sUserData) {
            this.getView()?.setModel(new JSONModel(JSON.parse(sUserData)), "user");
        }

        this.getView()?.setModel(new JSONModel({ selectedIndex: -1, busy: false }), "table");
        this.cargarPollitos();
    }

    private async cargarPollitos(): Promise<void> {
        const oTableModel = this.getView()?.getModel("table") as JSONModel;
        oTableModel?.setProperty("/busy", true);

        try {
            const response = await fetch(`${this.baseUrl}/Crias?$expand=padre,madre,aveGenerada&$orderby=fechaNacimiento desc`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${this.authService.getToken()}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("No se pudo cargar el modulo de pollitos");
            }

            const data = await response.json();
            const pollitos = (data.value || [])
                .filter((cria: any) => cria.estado !== "ELIMINADO")
                .sort((a: any, b: any) => this.obtenerTiempoFecha(b.fechaNacimiento) - this.obtenerTiempoFecha(a.fechaNacimiento));
            this.getView()?.setModel(new JSONModel({ value: pollitos, filteredCount: pollitos.length }), "pollitos");
        } catch (error: any) {
            MessageToast.show(error.message || "Error cargando pollitos");
        } finally {
            oTableModel?.setProperty("/busy", false);
        }
    }

    private obtenerTiempoFecha(fecha: string | Date): number {
        if (!fecha) return 0;
        const date = fecha instanceof Date ? fecha : new Date(fecha);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    }

    public onAgregarPollito(): void {
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RoutePollitoCreate");
    }

    public onEditarPollito(oEvent: Event): void {
        const oSource = oEvent.getSource() as any;
        const oContext = oSource.getBindingContext("pollitos");
        const pollito = oContext?.getObject();
        if (pollito?.ID) {
            (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RoutePollitoEdit", { pollitoId: pollito.ID });
        }
    }

    public onPollitoPress(oEvent: Event): void {
        const oSource = oEvent.getSource() as any;
        const oContext = oSource.getBindingContext("pollitos");
        const pollito = oContext?.getObject();
        if (pollito?.ID) {
            (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RoutePollitoDetail", { pollitoId: pollito.ID });
        }
    }

    public onEliminarPollito(oEvent: Event): void {
        const oSource = oEvent.getSource() as any;
        const oContext = oSource.getBindingContext("pollitos");
        const pollito = oContext?.getObject();

        if (!pollito?.ID) return;

        const identificador = this.formatearIdentificador(pollito);
        MessageBox.confirm(`Deseas eliminar el pollito ${identificador}?`, {
            title: "Eliminar pollito",
            onClose: (action: string) => {
                if (action === MessageBox.Action.OK) {
                    this.eliminarPollito(pollito.ID);
                }
            }
        });
    }

    private async eliminarPollito(criaId: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/eliminarCria`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify({ criaId })
            });

            const result = await response.json();
            if (!response.ok || result?.success === false) {
                throw new Error(result?.error?.message || result?.message || "No se pudo eliminar el pollito");
            }

            MessageToast.show("Pollito eliminado");
            this.cargarPollitos();
        } catch (error: any) {
            MessageBox.error(error.message || "Error eliminando pollito");
        }
    }

    public onRegistrarComoAveAdulta(oEvent: Event): void {
        const oSource = oEvent.getSource() as any;
        const oContext = oSource.getBindingContext("pollitos");
        const pollito = oContext?.getObject();
        if (!pollito?.ID) return;

        this.abrirDialogoRegistroAdulto(pollito);
    }

    private abrirDialogoRegistroAdulto(pollito: any): void {
        this._criaIdRegistroAdulto = pollito.ID;

        if (!this._oPlacaAdultoInput) {
            this._oPlacaAdultoInput = new Input({
                placeholder: "Ingrese la placa del ave",
                valueLiveUpdate: true,
                maxLength: 20
            });
        }

        this._oPlacaAdultoInput.setValue("");
        this._oPlacaAdultoInput.setValueState("None");

        if (!this._oRegistrarAdultoDialog) {
            this._oRegistrarAdultoDialog = new Dialog({
                title: "Registrar como ave adulta",
                contentWidth: "28rem",
                content: [
                    new VBox({                        
                        items: [
                            new Text({ text: "Confirme el registro como ave adulta e ingrese la placa." }),
                            new Label({ text: "Placa del ave", required: true, class: "sapUiSmallMarginTop" }),
                            this._oPlacaAdultoInput
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
                        this._oRegistrarAdultoDialog?.close();
                        this.registrarComoAveAdulta(this._criaIdRegistroAdulto, placa);
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

    private async registrarComoAveAdulta(criaId: string, placa: string): Promise<void> {
        const confirmado = await ConfirmationService.confirmCreate("el ave adulta", `Placa: ${placa}`);
        if (!confirmado) return;

        try {
            const response = await fetch(`${this.baseUrl}/registrarCriaComoAve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.authService.getToken()}`
                },
                body: JSON.stringify({ criaId, placa })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error?.message || "No se pudo registrar como ave adulta");
            }

            MessageBox.success(`Ave adulta creada con placa ${result?.placa || ""}`, {
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: () => this.cargarPollitos(),
                dependentOn: this.getView()
            });
        } catch (error: any) {
            MessageBox.error(error.message || "Error registrando como ave adulta");
        }
    }

    public onBuscar(): void {
        const oTable = this.byId("pollitosTable") as Table;
        const aBindings = [
            oTable?.getBinding("items"),
            (this.byId("pollitosMobileList") as any)?.getBinding("items")
        ];
        const search = (this.byId("searchField") as any).getValue();
        const temporada = (this.byId("temporadaFilter") as any).getValue();
        const color = (this.byId("colorFilter") as any).getValue();
        const padre = (this.byId("padreFilter") as any).getValue();
        const madre = (this.byId("madreFilter") as any).getValue();
        const filters: Filter[] = [];

        if (search) {
            filters.push(new Filter({
                filters: [
                    new Filter("cintillo", FilterOperator.Contains, search),
                    new Filter("nombre", FilterOperator.Contains, search)
                ],
                and: false
            }));
        }

        if (temporada) filters.push(new Filter("temporada", FilterOperator.EQ, Number(temporada)));
        if (color) filters.push(new Filter("colorCintillo", FilterOperator.Contains, color.toUpperCase()));
        if (padre) {
            filters.push(new Filter({
                filters: [
                    new Filter("padre/placa", FilterOperator.Contains, padre),
                    new Filter("padre/nombre", FilterOperator.Contains, padre)
                ],
                and: false
            }));
        }
        if (madre) {
            filters.push(new Filter({
                filters: [
                    new Filter("madre/placa", FilterOperator.Contains, madre),
                    new Filter("madre/nombre", FilterOperator.Contains, madre)
                ],
                and: false
            }));
        }

        aBindings.forEach((oBinding: any) => oBinding?.filter(filters));
        this.actualizarContadorFiltrado();
    }

    private actualizarContadorFiltrado(): void {
        const oTableBinding = (this.byId("pollitosTable") as Table)?.getBinding("items") as any;
        const oMobileBinding = (this.byId("pollitosMobileList") as any)?.getBinding("items") as any;
        const oBinding = oTableBinding || oMobileBinding;
        const oModel = this.getView()?.getModel("pollitos") as JSONModel;

        if (!oModel) return;

        const count = oBinding?.getLength?.() ?? (oModel.getProperty("/value") || []).length;
        oModel.setProperty("/filteredCount", count);
    }

    public onLimpiarFiltros(): void {
        (this.byId("searchField") as any).setValue("");
        (this.byId("temporadaFilter") as any).setValue("");
        (this.byId("colorFilter") as any).setValue("");
        (this.byId("padreFilter") as any).setValue("");
        (this.byId("madreFilter") as any).setValue("");
        this.onBuscar();
    }

    public onValueHelpFiltroPadre(): void {
        void this.abrirAyudaFiltroPadres("padre");
    }

    public onValueHelpFiltroMadre(): void {
        void this.abrirAyudaFiltroPadres("madre");
    }

    private async abrirAyudaFiltroPadres(tipo: "padre" | "madre"): Promise<void> {
        this.filtroPadresSeleccionado = tipo;

        try {
            const response = await fetch(`${this.baseUrl}/AvesActivas`, {
                headers: {
                    "Authorization": `Bearer ${this.authService.getToken()}`,
                    "Content-Type": "application/json"
                }
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error?.message || "No se pudo cargar la ayuda de busqueda");
            }

            const sexo = tipo === "padre" ? "M" : "H";
            const aves = (data.value || [])
                .filter((ave: any) => ave.sexo === sexo && ave.padrote === true)
                .sort((a: any, b: any) => String(a.placa || "").localeCompare(String(b.placa || "")));

            this.getView()?.setModel(new JSONModel({ value: aves }), "avesFiltroPadres");

            if (!this._oFiltroPadresDialog) {
                const search = new SearchField({
                    liveChange: (oEvent: any) => this.filtrarAyudaFiltroPadres(oEvent.getParameter("newValue")),
                    search: (oEvent: any) => this.filtrarAyudaFiltroPadres(oEvent.getParameter("query")),
                });

                this._oFiltroPadresList = new List({
                    mode: "SingleSelectMaster",
                    items: {
                        path: "avesFiltroPadres>/value",
                        template: new StandardListItem({
                            title: "{avesFiltroPadres>placa}",
                            description: "{avesFiltroPadres>nombre}",
                            type: "Active",
                        }),
                    },
                    itemPress: (oEvent: any) => this.seleccionarAyudaFiltroPadres(oEvent.getParameter("listItem")),
                });

                this._oFiltroPadresDialog = new Dialog({
                    contentWidth: "34rem",
                    contentHeight: "28rem",
                    subHeader: new Bar({
                        contentMiddle: [search],
                    }),
                    content: [this._oFiltroPadresList],
                    endButton: new Button({
                        text: "Cerrar",
                        press: () => this._oFiltroPadresDialog?.close(),
                    }),
                });
                this.getView()?.addDependent(this._oFiltroPadresDialog);
            }

            this._oFiltroPadresDialog.setTitle(tipo === "padre" ? "Buscar padre" : "Buscar madre");
            this.filtrarAyudaFiltroPadres("");
            this._oFiltroPadresDialog.open();
        } catch (error: any) {
            MessageToast.show(error.message || "No se pudo cargar la ayuda de busqueda");
        }
    }

    private filtrarAyudaFiltroPadres(query?: string): void {
        const binding = this._oFiltroPadresList?.getBinding("items");
        const value = String(query || "").trim();

        if (!binding) return;
        if (!value) {
            binding.filter([]);
            return;
        }

        binding.filter([
            new Filter({
                filters: [
                    new Filter("placa", FilterOperator.Contains, value),
                    new Filter("nombre", FilterOperator.Contains, value),
                ],
                and: false,
            }),
        ]);
    }

    private seleccionarAyudaFiltroPadres(item: StandardListItem): void {
        const ave = item.getBindingContext("avesFiltroPadres")?.getObject() as any;
        if (!ave) return;

        const inputId = this.filtroPadresSeleccionado === "padre" ? "padreFilter" : "madreFilter";
        const input = this.byId(inputId) as Input;
        input.setValue(ave.placa || ave.nombre || "");
        this.onBuscar();
        this._oFiltroPadresDialog?.close();
    }

    public async onRefrescar(): Promise<void> {
        await this.cargarPollitos();
        MessageToast.show("Pollitos actualizados");
    }

    public onExportarExcel(): void {
        const controlId = Device.system.phone ? "pollitosMobileList" : "pollitosTable";
        const binding = (this.byId(controlId) as any)?.getBinding("items");
        const length = binding?.getLength?.() || 0;
        const data = (binding?.getContexts(0, length) || []).map((context: any) => {
            const pollito = context.getObject();
            return {
                cintillo: pollito.cintillo || "",
                colorCintillo: pollito.colorCintillo || "",
                temporada: pollito.temporada || "",
                placa: pollito.placa || pollito.aveGenerada?.placa || "",
                nombre: pollito.nombre || "",
                sexo: pollito.sexo || "",
                fechaNacimiento: this.formatearFecha(pollito.fechaNacimiento),
                padre: pollito.padre
                    ? [pollito.padre.placa, pollito.padre.nombre].filter(Boolean).join(" ")
                    : "",
                madre: pollito.madre
                    ? [pollito.madre.placa, pollito.madre.nombre].filter(Boolean).join(" ")
                    : "",
                estado: pollito.estado || "",
                aveGenerada: pollito.aveGenerada?.placa || ""
            };
        });

        if (!data.length) {
            MessageToast.show("No hay aves jóvenes para exportar");
            return;
        }

        const columns = [
            { label: "Cintillo", property: "cintillo" },
            { label: "Color cintillo", property: "colorCintillo" },
            { label: "Temporada", property: "temporada" },
            { label: "Placa", property: "placa" },
            { label: "Nombre", property: "nombre" },
            { label: "Sexo", property: "sexo" },
            { label: "Fecha nacimiento", property: "fechaNacimiento" },
            { label: "Padre", property: "padre" },
            { label: "Madre", property: "madre" },
            { label: "Estado", property: "estado" },
            { label: "Ave generada", property: "aveGenerada" }
        ];

        const sheet = new Spreadsheet({
            workbook: { columns },
            dataSource: data,
            fileName: "pollitos.xlsx"
        });

        sheet
            .build()
            .catch(() => MessageBox.error("No se pudo generar el archivo Excel"))
            .finally(() => sheet.destroy());
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
        return estado === "REGISTRADA_ADULTA" ? "Registrada como Ave Adulta" : "Activa";
    }

    public onNavBack(): void {
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
    }

    public onNavWelcome(): void {
        (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
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
    
}
