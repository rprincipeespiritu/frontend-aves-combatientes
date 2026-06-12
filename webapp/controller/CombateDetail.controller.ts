import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import Router from "sap/ui/core/routing/Router";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import Event from "sap/ui/base/Event";
import { AuthService } from "../services/AuthService";

export default class CombateDetail extends Controller {
  private baseUrl = window.APP_CONFIG?.API_BASE_URL || "";
  private authService: AuthService;
  private combateId = "";
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;

  public onInit(): void {
    this.authService = AuthService.getInstance();
    const router = (this.getOwnerComponent() as UIComponent)?.getRouter();
    router?.getRoute("RouteCombateDetail")?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched = async (oEvent: any): Promise<void> => {
    if (!this.authService.isAuthenticated()) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteLogin");
      return;
    }

    const userData = localStorage.getItem("auth_user");
    if (userData) {
      this.getView()?.setModel(new JSONModel(JSON.parse(userData)), "user");
    }

    this.combateId = oEvent.getParameter("arguments").id;
    this.getView()?.setModel(new JSONModel({
      busy: false,
      combate: {},
    }), "detalle");

    await this.cargarSuscripcionResumen();
    await this.cargarCombate();
  };

  private getDashboardModel(): JSONModel {
    let model = this.getOwnerComponent()?.getModel("dashboard") as JSONModel;

    if (!model) {
      model = new JSONModel({
        plan: "",
        estadoSuscripcion: "",
        accesoSuscripcion: false,
        multimediaPremium: false,
      });
      this.getOwnerComponent()?.setModel(model, "dashboard");
    }

    return model;
  }

  private async cargarSuscripcionResumen(): Promise<void> {
    const model = this.getDashboardModel();
    model.setProperty("/multimediaPremium", false);

    try {
      const response = await fetch(`${this.baseUrl}/obtenerSuscripcionActual`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) return;

      const tieneAcceso =
        data.tieneSuscripcion !== false &&
        ["ACTIVA", "CANCELADA"].includes(data.estado) &&
        Number(data.diasRestantes || 0) >= 0;

      model.setProperty("/plan", data.plan || "");
      model.setProperty("/estadoSuscripcion", data.estado || "");
      model.setProperty("/accesoSuscripcion", tieneAcceso);
      model.setProperty("/multimediaPremium", tieneAcceso && ["PRUEBA", "PREMIUM"].includes(data.plan));
      model.refresh(true);
    } catch (error) {
      // El detalle puede mostrarse aunque falle el resumen de suscripcion.
    }
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json",
    };
  }

  private async cargarCombate(): Promise<void> {
    const model = this.getView()?.getModel("detalle") as JSONModel;
    model.setProperty("/busy", true);

    try {
      const response = await fetch(
        `${this.baseUrl}/Peleas('${this.combateId}')?$expand=ave,combatienteB`,
        { headers: this.getHeaders() },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "No se pudo cargar el detalle del combate.");
      }

      if (data.videoUrl && String(data.videoUrl).includes(".s3.") && this.getDashboardModel().getProperty("/multimediaPremium")) {
        data.videoUrl = await this.obtenerUrlVisualizacionS3(data.videoUrl);
      } else if (!this.getDashboardModel().getProperty("/multimediaPremium")) {
        data.videoUrl = "";
        data.videoNombreArchivo = "";
        data.videoEstadoCarga = "";
      }

      model.setProperty("/combate", data);
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo cargar el detalle del combate.");
    } finally {
      model.setProperty("/busy", false);
    }
  }

  public onEditar(): void {
    this.detenerVideoCombate();

    if (this.combateId) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteCombateEdit", { id: this.combateId });
    }
  }

  public onVerCombatienteA(): void {
    const combate = ((this.getView()?.getModel("detalle") as JSONModel)?.getProperty("/combate")) || {};
    const aveId = combate.ave_ID || combate.ave?.ID;
    if (aveId) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteAveDetail", { aveId });
    }
  }

  public onVerCombatienteB(): void {
    const combate = ((this.getView()?.getModel("detalle") as JSONModel)?.getProperty("/combate")) || {};
    const aveId = combate.combatienteB_ID || combate.combatienteB?.ID;
    if (aveId) {
      (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteAveDetail", { aveId });
    }
  }

  public formatearFecha(fecha?: string): string {
    if (!fecha) return "";
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;
    return date.toLocaleDateString("es-PE");
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
      SUBIDO: "Video registrado",
      ERROR: "Error video",
    };
    return estados[estado] || "Video registrado";
  }

  public renderVideoPlayer(combate?: any): string {
    if (!combate?.videoUrl) return "";

    const url = this.escapeHtml(String(combate.videoUrl));
    const mimeType = combate.videoMimeType ? ` type="${this.escapeHtml(String(combate.videoMimeType))}"` : "";
    const fileName = this.escapeHtml(String(combate.videoNombreArchivo || "Video del combate"));

    return `
      <div class="combatVideoPlayer">
        <video controls preload="metadata" playsinline title="${fileName}">
          <source src="${url}"${mimeType}>
          Tu navegador no puede reproducir este video.
        </video>
      </div>
    `;
  }

  private async obtenerUrlVisualizacionS3(fileUrl: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/obtenerUrlLecturaS3`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ fileUrl }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "No se pudo preparar la visualizacion del video.");
    }

    return data.downloadUrl || fileUrl;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  public formatearRival(combate: any): string {
    if (!combate) return "";
    if (combate.ambosPropios !== false) {
      const ave = combate.combatienteB;
      return ave ? `${ave.placa || "Sin placa"} - ${ave.nombre || "Sin nombre"}` : combate.combatienteBTexto || combate.nombreOponente || "";
    }
    return combate.nombreOponente || "";
  }

  public formatearCombatienteA(combate: any): string {
    if (!combate) return "";
    const ave = combate.ave;
    if (ave) return `${ave.placa || "Sin placa"} - ${ave.nombre || "Sin nombre"}`;
    return combate.combatienteATexto || "Sin datos";
  }

  public formatearCombatienteB(combate: any): string {
    if (!combate) return "";
    const ave = combate.combatienteB;
    if (ave) return `${ave.placa || "Sin placa"} - ${ave.nombre || "Sin nombre"}`;
    return combate.combatienteBTexto || "Sin datos";
  }

  public formatearPropietarioRival(combate: any): string {
    if (!combate) return "";
    return combate.ambosPropios !== false ? "Propio" : combate.propietarioOponente || "";
  }

  public onNavBack(): void {
    this.detenerVideoCombate();
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteCombates");
  }

  public onNavWelcome(): void {
    this.detenerVideoCombate();
    (this.getOwnerComponent() as UIComponent)?.getRouter()?.navTo("RouteWelcome");
  }

  private detenerVideoCombate(): void {
    const viewDom = this.getView()?.getDomRef?.();
    const mediaElements = viewDom?.querySelectorAll?.(".combatVideoPlayer video, .combatVideoPlayer audio") || [];

    mediaElements.forEach((media: HTMLMediaElement) => {
      media.pause();
      media.removeAttribute("src");
      media.querySelectorAll("source").forEach((source) => source.removeAttribute("src"));
      media.load();
    });

    const model = this.getView()?.getModel("detalle") as JSONModel;
    const combate = model?.getProperty("/combate");
    if (combate) {
      model.setProperty("/combate", { ...combate, videoUrl: "" });
    }
  }

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const source = oEvent.getSource() as Control;

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

      this._oUserMenuSheet.isOpen() ? this._oUserMenuSheet.close() : this._oUserMenuSheet.openBy(source);
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

    this._oUserMenuPopover.isOpen() ? this._oUserMenuPopover.close() : this._oUserMenuPopover.openBy(source);
  }

  public async onLogout(): Promise<void> {
    await this.authService.logout();
    const router = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
    router?.navTo("RouteLogin");
  }
}
