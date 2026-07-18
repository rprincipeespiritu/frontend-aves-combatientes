import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import { AuthService } from "../services/AuthService";
import { IAve } from "../types/Models";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import List from "sap/m/List";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Popover from "sap/m/Popover";
import ActionSheet from "sap/m/ActionSheet";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import {
  AlcanceEstadisticas,
  GenealogiaEstadisticasService,
  IAveGenealogia,
} from "../services/GenealogiaEstadisticasService";

export default class EstadisticasPeleas extends Controller {
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
  private authService: AuthService;
  private genealogiaService = new GenealogiaEstadisticasService();
  private aveIdInicial = "";
  private alcanceInicial: AlcanceEstadisticas = "DESCENDIENTES";
  private _oPadresDialog: Dialog;
  private _oUserMenuPopover: Popover;
  private _oUserMenuSheet: ActionSheet;
  private readonly onResize = (): void => {
    this.actualizarVistaCompacta();
  };

  public onInit(): void {
    this.authService = AuthService.getInstance();

    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteEstadisticasPeleas")
      ?.attachPatternMatched(this.onRouteMatched, this);

    this.getView()?.setModel(
      new JSONModel({
        busy: false,
        aveSeleccionadaId: "",
        aveSeleccionada: null,
        alcance: "DESCENDIENTES",
        maxGeneraciones: "5",
        filas: [],
        tituloPanel: "Estadisticas de peleas",
        noDataText: "Seleccione una ave para ver sus estadisticas.",
        resumen: {
          total: 0,
          machos: 0,
          hembras: 0,
          conPeleas: 0,
          totalVictorias: 0,
          totalDerrotas: 0,
          promedioVictorias: "0%",
        },
        graph: {
          nodes: [],
          lines: [],
        },
        vistaCompacta: false,
      }),
      "estadisticas",
    );

    this.actualizarVistaCompacta();
    Device.resize.attachHandler(this.onResize, this);
  }

  public onExit(): void {
    Device.resize.detachHandler(this.onResize, this);
  }

  private actualizarVistaCompacta(): void {
    const oModel = this.getView()?.getModel("estadisticas") as JSONModel;
    const compacta = Device.system.phone || window.innerWidth <= 767;
    oModel?.setProperty("/vistaCompacta", compacta);
  }

  private onRouteMatched = (oEvent: any): void => {
    if (!this.authService.isAuthenticated()) {
      (this.getOwnerComponent() as UIComponent)
        ?.getRouter()
        ?.navTo("RouteLogin");
      return;
    }

    this.bindUserModel();

    const oArguments = oEvent.getParameter("arguments") || {};
    const query = oArguments["?query"] || {};
    this.aveIdInicial = query.aveId || "";
    this.alcanceInicial = this.normalizarAlcance(query.alcance);

    const oModel = this.getView()?.getModel("estadisticas") as JSONModel;
    oModel.setProperty("/alcance", this.alcanceInicial);

    this.actualizarVistaCompacta();
    void this.cargarDatos();
  };

  private normalizarAlcance(value?: string): AlcanceEstadisticas {
    const alcances: AlcanceEstadisticas[] = [
      "INDIVIDUO",
      "ASCENDIENTES",
      "DESCENDIENTES",
      "HERMANOS_PRIMOS",
    ];

    return alcances.includes(value as AlcanceEstadisticas)
      ? (value as AlcanceEstadisticas)
      : "DESCENDIENTES";
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json",
    };
  }

  private async cargarDatos(): Promise<void> {
    const oModel = this.getView()?.getModel("estadisticas") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      await this.genealogiaService.cargarDatos(this.baseUrl, this.getHeaders());

      const aves = this.genealogiaService.getAves();
      const aveSeleccionadaId = this.genealogiaService
        .getAvesPorId()
        .has(this.aveIdInicial)
        ? this.aveIdInicial
        : aves[0]?.ID;

      if (aveSeleccionadaId) {
        this.seleccionarAve(aveSeleccionadaId);
      } else {
        this.actualizarTabla();
      }
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudieron cargar las estadisticas");
      this.actualizarTabla();
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private seleccionarAve(aveId: string): void {
    const ave = this.genealogiaService.getAvesPorId().get(aveId);
    const oModel = this.getView()?.getModel("estadisticas") as JSONModel;

    if (!ave) {
      oModel.setProperty("/aveSeleccionadaId", "");
      oModel.setProperty("/aveSeleccionada", null);
      this.actualizarTabla();
      return;
    }

    oModel.setProperty("/aveSeleccionadaId", aveId);
    oModel.setProperty("/aveSeleccionada", {
      ...ave,
      fechaNacimientoFmt: this.genealogiaService.formatearFecha(ave.fechaNacimiento),
      sexoFmt: this.genealogiaService.formatearSexo(ave.sexo),
    });

    const oInput = this.byId("inputAve") as Input;
    if (oInput) {
      oInput.setValue(ave.placa || "");
      oInput.setDescription(ave.nombre || "");
    }

    this.actualizarTabla();
  }

  private actualizarTabla(): void {
    const oModel = this.getView()?.getModel("estadisticas") as JSONModel;
    const aveId = oModel.getProperty("/aveSeleccionadaId") as string;
    const alcance = this.normalizarAlcance(oModel.getProperty("/alcance"));
    const maxGeneraciones = this.genealogiaService.normalizarMaxGeneraciones(
      Number(oModel.getProperty("/maxGeneraciones") || 5),
    );

    const filas = aveId
      ? this.genealogiaService.obtenerFilas(aveId, alcance, maxGeneraciones)
      : [];
    const resumen = this.genealogiaService.calcularResumen(filas);
    const graph = aveId
      ? this.genealogiaService.obtenerGrafo(aveId, alcance, maxGeneraciones)
      : { nodes: [], lines: [] };

    oModel.setProperty("/filas", filas);
    oModel.setProperty("/resumen", resumen);
    oModel.setProperty("/graph", graph);
    oModel.setProperty(
      "/tituloPanel",
      `Estadisticas de peleas - ${this.genealogiaService.obtenerTituloAlcance(alcance)}`,
    );
    oModel.setProperty(
      "/noDataText",
      this.genealogiaService.obtenerNoDataText(alcance),
    );
  }

  public onRefrescar(): void {
    void this.cargarDatos();
  }

  public onCambiarAlcance(): void {
    this.actualizarTabla();
  }

  public onCambiarMaxGeneraciones(oEvent: any): void {
    const oModel = this.getView()?.getModel("estadisticas") as JSONModel;
    const selectedKey = oEvent.getSource()?.getSelectedKey?.()
      || oEvent.getParameter("selectedItem")?.getKey();

    oModel.setProperty(
      "/maxGeneraciones",
      String(this.genealogiaService.normalizarMaxGeneraciones(Number(selectedKey))),
    );
    this.actualizarTabla();
  }

  public onCambiarAveManual(): void {
    const placa = (this.byId("inputAve") as Input)?.getValue()?.trim();
    if (!placa) return;

    const ave = this.genealogiaService.getAves().find((item) => item.placa === placa);
    if (ave) {
      this.seleccionarAve(ave.ID);
    }
  }

  public onValueHelpAve = (): void => {
    void this.onAbrirPopupAves("Seleccionar ave");
  };

  public async onAbrirPopupAves(sTitulo: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/AvesActivas`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      const aves: IAve = await response.json();

      this.getView()?.setModel(new JSONModel(aves.value), "avesPadres");

      if (!this._oPadresDialog) {
        this._oPadresDialog = (await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.PadresDialog",
          controller: this,
        })) as Dialog;

        this.getView()?.addDependent(this._oPadresDialog);
      }

      this._oPadresDialog.setTitle(sTitulo);
      this._oPadresDialog.open();

      this.getView()?.byId("idSearchPadres")?.setValue("");
    } catch (error) {
      console.error("Error abriendo selector de aves:", error);
    }
  }

  public onSeleccionarPadre(oEvent: Event): void {
    const oSelectedItem = oEvent.getParameter("listItem");
    const oContext = oSelectedItem?.getBindingContext("avesPadres");
    if (!oContext) return;

    const oAve = oContext.getObject() as IAveGenealogia;
    this.seleccionarAve(oAve.ID);
    this._oPadresDialog?.close();
  }

  public onCerrarPopupPadres(): void {
    this._oPadresDialog?.close();
  }

  public onSearchPadres(oEvent: Event): void {
    const sValue = oEvent.getParameter("newValue") || "";
    const oList = this.byId("listaPadres") as List;
    const oBinding = oList?.getBinding("items");
    if (!oBinding) return;

    if (sValue) {
      oBinding.filter([
        new Filter({
          filters: [
            new Filter("nombre", FilterOperator.Contains, sValue),
            new Filter("placa", FilterOperator.Contains, sValue),
          ],
          and: false,
        }),
      ]);
    } else {
      oBinding.filter([]);
    }
  }

  public onSeleccionarFila(oEvent: any): void {
    const fila = oEvent.getSource()?.getBindingContext("estadisticas")?.getObject();
    if (!fila?.ID) return;

    if (fila.esAve) {
      this.seleccionarAve(fila.ID);
      return;
    }

    (this.getOwnerComponent() as UIComponent)
      ?.getRouter()
      ?.navTo("RoutePollitoDetail", { pollitoId: fila.ID });
  }

  public onSeleccionarNodoGrafo(oEvent: any): void {
    const nodo = oEvent.getSource()?.getBindingContext("estadisticas")?.getObject();
    if (nodo?.aveId) {
      this.seleccionarAve(nodo.aveId);
    }
  }

  public onNavBack(): void {
    window.history.go(-1);
  }

  public onNavWelcome(): void {
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
  }

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = oEvent.getSource() as Control;
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

    if (this._oUserMenuPopover.isOpen()) {
      this._oUserMenuPopover.close();
    } else {
      this._oUserMenuPopover.openBy(oSource);
    }
  }
}
