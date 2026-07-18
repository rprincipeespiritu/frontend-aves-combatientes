import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Router from "sap/ui/core/routing/Router";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import Event from "sap/ui/base/Event";
import { AuthService } from "../services/AuthService";

export default class Combates extends Controller {
  private baseUrl = window.APP_CONFIG?.API_BASE_URL || "";
  private readonly limiteTemporalCombates = 10;
  private authService: AuthService;
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;

  public onInit(): void {
    this.authService = AuthService.getInstance();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.getRoute("RouteCombates")?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched = (): void => {
    if (!this.authService.isAuthenticated()) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
      return;
    }

    this.bindUserModel();

    this.getView()?.setModel(new JSONModel({
      busy: false,
      todosCombates: [],
      combates: [],
      filtros: {
        busqueda: "",
        tipo: "",
        resultado: "",
        video: "",
      },
      limiteAlcanzado: false,
      limiteMensaje: "",
    }), "combates");

    void this.cargarCombates();
  };

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json",
    };
  }

  private async cargarCombates(): Promise<void> {
    const oModel = this.getView()?.getModel("combates") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      const response = await fetch(
        `${this.baseUrl}/Peleas?$expand=ave,combatienteB&$orderby=fecha desc`,
        { headers: this.getHeaders() },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "No se pudo cargar el historial de combates.");
      }

      const combates = (data.value || []).sort((a: any, b: any) =>
        this.obtenerTiempoFecha(b.fecha) - this.obtenerTiempoFecha(a.fecha)
      );
      oModel.setProperty("/todosCombates", combates);
      this.aplicarFiltrosCombates();
      this.actualizarLimiteCombates(combates.length);
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo cargar combates.");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private obtenerTiempoFecha(fecha: string | Date): number {
    if (!fecha) return 0;
    const date = fecha instanceof Date ? fecha : new Date(fecha);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private actualizarLimiteCombates(total: number): void {
    const oModel = this.getView()?.getModel("combates") as JSONModel;
    const limiteAlcanzado = total >= this.limiteTemporalCombates;
    const limiteMensaje = limiteAlcanzado
      ? `Limite temporal alcanzado: maximo ${this.limiteTemporalCombates} combates.`
      : "";

    oModel.setProperty("/limiteAlcanzado", limiteAlcanzado);
    oModel.setProperty("/limiteMensaje", limiteMensaje);
  }

  public onFiltrarCombates(): void {
    this.aplicarFiltrosCombates();
  }

  public onLimpiarFiltros(): void {
    const oModel = this.getView()?.getModel("combates") as JSONModel;
    oModel.setProperty("/filtros", {
      busqueda: "",
      tipo: "",
      resultado: "",
      video: "",
    });
    this.aplicarFiltrosCombates();
  }

  private aplicarFiltrosCombates(): void {
    const oModel = this.getView()?.getModel("combates") as JSONModel;
    const todosCombates = oModel.getProperty("/todosCombates") || [];
    const filtros = oModel.getProperty("/filtros") || {};
    const busqueda = this.normalizarTexto(filtros.busqueda);
    const tipo = filtros.tipo || "";
    const resultado = filtros.resultado || "";
    const video = filtros.video || "";

    const combatesFiltrados = todosCombates.filter((combate: any) => {
      const coincideBusqueda = !busqueda || this.obtenerTextoBusquedaCombate(combate).includes(busqueda);
      const coincideTipo = !tipo || combate.tipoCombate === tipo;
      const coincideResultado = this.coincideResultadoFiltro(combate, resultado);
      const coincideVideo = this.coincideVideoFiltro(combate, video);

      return coincideBusqueda && coincideTipo && coincideResultado && coincideVideo;
    });

    oModel.setProperty("/combates", combatesFiltrados);
  }

  private obtenerTextoBusquedaCombate(combate: any): string {
    return this.normalizarTexto([
      combate?.codigo,
      combate?.tipoCombate,
      combate?.resultado,
      combate?.evento,
      combate?.ave?.placa,
      combate?.ave?.nombre,
      combate?.combatienteATexto,
      combate?.combatienteB?.placa,
      combate?.combatienteB?.nombre,
      combate?.combatienteBTexto,
      combate?.nombreOponente,
      combate?.propietarioOponente,
      combate?.procedenciaOponente,
    ].filter(Boolean).join(" "));
  }

  private coincideResultadoFiltro(combate: any, resultado: string): boolean {
    if (!resultado) return true;
    if (resultado === "SIN_RESULTADO") {
      return !combate?.resultado || combate.resultado === "SIN_RESULTADO";
    }
    return combate?.resultado === resultado;
  }

  private coincideVideoFiltro(combate: any, video: string): boolean {
    if (!video) return true;

    const estado = combate?.videoEstadoCarga || "";
    const tieneVideo = Boolean(combate?.videoUrl) || estado === "SUBIDO";

    if (video === "CON_VIDEO") return tieneVideo;
    if (video === "SIN_VIDEO") return !tieneVideo && !estado.startsWith("PENDIENTE");
    if (video === "PENDIENTE") return estado.startsWith("PENDIENTE");

    return true;
  }

  private normalizarTexto(valor?: string): string {
    return (valor || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  public onCrearCombate(): void {
    const oModel = this.getView()?.getModel("combates") as JSONModel;
    if (oModel?.getProperty("/limiteAlcanzado")) {
      MessageBox.warning(
        oModel.getProperty("/limiteMensaje") ||
          `Por ahora solo puedes registrar hasta ${this.limiteTemporalCombates} combates.`,
      );
      return;
    }

    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteCombateCreate");
  }

  public onEditarCombate(oEvent: Event): void {
    const context = (oEvent.getSource() as any)?.getBindingContext("combates");
    const combate = context?.getObject();

    if (combate?.ID) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteCombateEdit", { id: combate.ID });
    }
  }

  public onVerDetalleCombate(oEvent: Event): void {
    const context = (oEvent.getSource() as any)?.getBindingContext("combates");
    const combate = context?.getObject();

    if (combate?.ID) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteCombateDetail", { id: combate.ID });
    }
  }

  public onEliminarCombate(oEvent: Event): void {
    const context = (oEvent.getSource() as any)?.getBindingContext("combates");
    const combate = context?.getObject();

    if (!combate?.ID) return;

    MessageBox.confirm("Deseas eliminar este combate?", {
      title: "Eliminar combate",
      actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
      emphasizedAction: MessageBox.Action.OK,
      onClose: async (action: string) => {
        if (action !== MessageBox.Action.OK) return;

        try {
          const response = await fetch(`${this.baseUrl}/Peleas('${combate.ID}')`, {
            method: "DELETE",
            headers: this.getHeaders(),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error?.message || "No se pudo eliminar el combate.");
          }

          MessageToast.show("Combate eliminado");
          await this.cargarCombates();
        } catch (error: any) {
          MessageBox.error(error.message || "No se pudo eliminar el combate.");
        }
      },
    });
  }

  public async onRefrescar(): Promise<void> {
    await this.cargarCombates();
    MessageToast.show("Combates actualizados");
  }

  public formatearFecha(fecha?: string): string {
    if (!fecha) return "";
    const fechaLocal = this.extraerFechaLocal(fecha);
    if (fechaLocal) return fechaLocal;

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;
    return date.toLocaleDateString("es-PE");
  }

  private extraerFechaLocal(fecha: string): string {
    const match = String(fecha || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
  }

  public formatearTipo(tipo?: string): string {
    return tipo === "OFICIAL" ? "Oficial" : "Entrenamiento";
  }

  public formatearResultado(resultado?: string): string {
    const resultados: Record<string, string> = {
      VICTORIA: "Victoria",
      DERROTA: "Derrota",
      EMPATE: "Empate",
      DESCALIFICADO: "Descalificado",
    };
    return resultado ? resultados[resultado] || resultado : "Sin resultado";
  }

  public estadoResultado(resultado?: string): string {
    if (resultado === "VICTORIA") return "Success";
    if (resultado === "DERROTA" || resultado === "DESCALIFICADO") return "Error";
    if (resultado === "EMPATE") return "Warning";
    return "None";
  }

  public formatearVideo(estado?: string): string {
    if (!estado) return "Sin video";
    const estados: Record<string, string> = {
      PENDIENTE_CONFIGURACION: "Pendiente",
      PENDIENTE_SUBIDA: "Pendiente subida",
      SUBIDO: "Con video",
      ERROR: "Error video",
    };
    return estados[estado] || "Con video";
  }

  public formatearRival(combate: any): string {
    if (!combate) return "";
    if (combate.ambosPropios !== false) {
      return combate.combatienteB?.placa || combate.combatienteBTexto || combate.nombreOponente || "";
    }
    return combate.nombreOponente || "";
  }

  public formatearCombatienteATitulo(combate: any): string {
    if (!combate) return "";
    return combate.ave?.placa || combate.combatienteATexto || "Sin placa";
  }

  public formatearCombatienteATexto(combate: any): string {
    if (!combate) return "";
    return combate.ave?.nombre || (!combate.ave?.placa ? "" : combate.combatienteATexto || "");
  }

  public formatearCombatienteBTitulo(combate: any): string {
    if (!combate) return "";
    if (combate.ambosPropios !== false) {
      return combate.combatienteB?.placa || combate.combatienteBTexto || "Sin placa";
    }
    return combate.nombreOponente || "";
  }

  public formatearCombatienteBTexto(combate: any): string {
    if (!combate || combate.ambosPropios === false) return "";
    return combate.combatienteB?.nombre || "";
  }

  public formatearPropietarioRival(combate: any): string {
    if (!combate) return "";
    if (combate.ambosPropios !== false) {
      return "Propio";
    }
    return combate.propietarioOponente || "";
  }

  public onNavBack(): void {
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
  }

  public onNavWelcome(): void {
    this.onNavBack();
  }

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = oEvent.getSource() as Control;
    this.bindUserModel();

    if (Device.system.phone) {
      if (!this._oUserMenuSheet) {
        const fragment = await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.UserMenuMobile",
          controller: this,
        });
        this._oUserMenuSheet = fragment as ActionSheet;
        this.getView()?.addDependent(this._oUserMenuSheet);
      }

      this._oUserMenuSheet.isOpen() ? this._oUserMenuSheet.close() : this._oUserMenuSheet.openBy(oSource);
      return;
    }

    if (!this._oUserMenuPopover) {
      const fragment = await Fragment.load({
        id: this.getView()?.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.UserMenu",
        controller: this,
      });
      this._oUserMenuPopover = fragment as Popover;
      this.getView()?.addDependent(this._oUserMenuPopover);
    }

    this._oUserMenuPopover.isOpen() ? this._oUserMenuPopover.close() : this._oUserMenuPopover.openBy(oSource);
  }

  public async onLogout(): Promise<void> {
    await this.authService.logout();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
    oRouter?.navTo("RouteLogin");
  }
}
