import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import Fragment from "sap/ui/core/Fragment";
import { AuthService } from "../services/AuthService";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import NavigationListItem from "sap/tnt/NavigationListItem";
import Control from "sap/ui/mdc/Control";
import Popover from "sap/m/Popover";
import Dialog from "sap/m/Dialog";
import {
  EstadoAve,
  EstadoSuscripcion,
  IAve,
  PlanSuscripcion,
} from "com/rprincipees/registroavescombate/types/Models";
import { MetaPixelService } from "../services/MetaPixelService";

export default class Welcome extends Controller {
  private baseUrl: string = "http://localhost:4004/api/avecombatiente";
  private authService: AuthService;
  private _carouselInterval: any;
  private _bPhone: boolean;
  private _oMobileMenu?: ActionSheet;
  private _oUserMenuPopover: any;
  private _oUserMenuSheet: any;
  private _oTrialDialog?: Dialog;
  private _trialPromptOpen: boolean = false;

  public onAfterRendering(): void {
    /*const oCarousel = this.byId("imageCarousel") as any;

        if (oCarousel) {
            this._carouselInterval = setInterval(() => {
                oCarousel.next();
            }, 5000); // cada 3 segundos
        }*/
  }

  public onInit(): void {
    this.authService = AuthService.getInstance();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteWelcome")
      ?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched = (oEvent: any): void => {
    if (!this.authService.isAuthenticated()) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteLanding");
      return;
    }

    const sUserData = localStorage.getItem("auth_user");

    if (sUserData) {
      this.bindUserModel();
    }

    const oDashboardModel = new JSONModel({
      totalAves: 0,
      totalIncubaciones: 0,
      incubacionesActivas: 0,
      incubacionesProgramadas: 0,
      totalAvesActivas: 0,
      totalNacidos: 0,
      alertaIncubaciones: "",
      alertaEclosion: "",
      incubacionesRecientes: [],
      totalCruces: 0,
      totalCombates: 0,
      suscripcionTexto: "",
      suscripcionDias: 0,
      plan: "",
      estadoSuscripcion: "",
      accesoSuscripcion: false,
      multimediaPremium: false
    });

    this.getOwnerComponent()?.setModel(oDashboardModel, "dashboard");
    this._cargarDashboard();
  };

  private async _cargarDashboard(): Promise<void> {
    try {
      const oResponse = await fetch(`${this.baseUrl}/obtenerDashboard`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const oData = await oResponse.json();

      if (!oResponse.ok) {
        throw new Error(
          oData?.error?.message || "No se pudo cargar el dashboard",
        );
      }

      const oModel = this.getOwnerComponent()?.getModel("dashboard") as JSONModel;

      const aIncubacionesRecientes = (oData.incubacionesRecientes || []).map(
        (item: any) => {
          return {
            ...item,
            estadoTexto: this._mapEstadoTexto(item.estado),
            estadoState: this._mapEstadoState(item.estado),
            fechaIncubacionFmt: this._formatearFecha(item.fechaIncubacion),
          };
        },
      );

      oModel.setData({
        totalAves: oData.totalAves || 0,
        totalIncubaciones: oData.totalIncubaciones || 0,
        incubacionesActivas: oData.incubacionesActivas || 0,
        incubacionesProgramadas: oData.incubacionesProgramadas || 0,
        totalAvesActivas: oData.totalAvesActivas || 0,
        totalNacidos: oData.totalNacidos || 0,
        alertaIncubaciones: oData.alertaIncubaciones || "",
        alertaEclosion: oData.alertaEclosion || "",
        incubacionesRecientes: aIncubacionesRecientes,
        totalLineas: oData.totalLineas,
        totalPlanes: oData.totalPlanes || 0,
        totalPollitos: oData.totalPollitos || 0,
        totalCombates: oData.totalCombates || 0,
        suscripcionTexto: oModel.getProperty("/suscripcionTexto") || "",
        suscripcionDias: oModel.getProperty("/suscripcionDias") || 0,
        plan: oData.plan,
        estadoSuscripcion: oData.estado,
        accesoSuscripcion: this.tieneAccesoSuscripcion(oData.estado, oData.diasRestantes),
        multimediaPremium: this.tieneMultimediaPremium(oData.plan, oData.estado, oData.diasRestantes)
      });
      void this._cargarSuscripcionResumen();
    } catch (error: any) {
      MessageToast.show(error.message || "Error al cargar dashboard");
    }
  }

  private async _cargarSuscripcionResumen(): Promise<void> {
    try {
      const oModel = this.getOwnerComponent()?.getModel("dashboard") as JSONModel;
      const planIndicator = this.getOwnerComponent()?.getModel("planIndicator") as JSONModel;
      const cachedPlan = String(planIndicator?.getProperty("/plan") || "");
      const cachedTiene = planIndicator?.getProperty("/tieneSuscripcion");
      const cachedEstado = String(planIndicator?.getProperty("/estado") || "");
      const cachedDias = Number(planIndicator?.getProperty("/diasRestantes") ?? NaN);

      // Reutilizar cache del Component si ya se cargó la suscripción.
      if (cachedTiene === true && cachedPlan) {
        oModel.setProperty(
          "/suscripcionTexto",
          `${this.formatearPlanSucripcion(cachedPlan as PlanSuscripcion) || ""} - ${this.formatearEstadoSuscripcion(cachedEstado as EstadoSuscripcion) || ""}`,
        );
        oModel.setProperty("/suscripcionDias", Number.isFinite(cachedDias) ? cachedDias : 0);
        oModel.setProperty("/plan", cachedPlan);
        oModel.setProperty("/estadoSuscripcion", cachedEstado);
        oModel.setProperty(
          "/accesoSuscripcion",
          this.tieneAccesoSuscripcion(cachedEstado, cachedDias),
        );
        oModel.setProperty(
          "/multimediaPremium",
          this.tieneMultimediaPremium(cachedPlan, cachedEstado, cachedDias),
        );
        oModel.refresh();
        return;
      }

      if (cachedTiene === false) {
        oModel.setProperty("/suscripcionTexto", "Sin suscripción");
        oModel.setProperty("/suscripcionDias", Number.isFinite(cachedDias) ? cachedDias : 0);
        oModel.setProperty("/plan", "");
        oModel.setProperty("/estadoSuscripcion", cachedEstado);
        oModel.setProperty("/accesoSuscripcion", false);
        oModel.setProperty("/multimediaPremium", false);
        oModel.refresh();
        void this.mostrarPopupTrialObligatorio();
        return;
      }

      const oComponent = this.getOwnerComponent() as any;
      const indicator = await oComponent?.loadPlanIndicator?.(false);
      if (!indicator) return;

      oModel.setProperty(
        "/suscripcionTexto",
        indicator.tieneSuscripcion === false
          ? "Sin suscripción"
          : `${this.formatearPlanSucripcion(indicator.plan) || ""} - ${this.formatearEstadoSuscripcion(indicator.estado) || ""}`,
      );
      oModel.setProperty("/suscripcionDias", indicator.diasRestantes || 0);
      oModel.setProperty("/plan", indicator.plan || "");
      oModel.setProperty("/estadoSuscripcion", indicator.estado || "");
      oModel.setProperty(
        "/accesoSuscripcion",
        indicator.tieneSuscripcion !== false &&
          this.tieneAccesoSuscripcion(indicator.estado, indicator.diasRestantes),
      );
      oModel.setProperty(
        "/multimediaPremium",
        indicator.tieneSuscripcion !== false &&
          this.tieneMultimediaPremium(indicator.plan, indicator.estado, indicator.diasRestantes),
      );

      if (indicator.tieneSuscripcion === false) {
        void this.mostrarPopupTrialObligatorio();
      }

      oModel.refresh();
    } catch (error) {
      // El dashboard puede mostrarse aunque falle este resumen.
    }
  }

  public onNavNewLine(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter.navTo("RouteLineaGalloCreate");
  }

  private mostrarPopupTrialObligatorioLegacy(): void {
    if (this._trialPromptOpen) {
      return;
    }

    this._trialPromptOpen = true;
    MessageBox.warning(
      "Para continuar usando el sistema debes activar tu plan de prueba gratuito por 60 dias.\n\nIncluye los mismos privilegios del plan Premium.",
      {
        title: "Activa tu prueba",
        actions: ["Activar prueba", "Cerrar sesión"],
        emphasizedAction: "Activar prueba",
        onClose: (sAction?: string) => {
          this._trialPromptOpen = false;
          if (sAction === "Activar prueba") {
            void this.activarPlanPrueba();
            return;
          }

          void this.onLogout();
        },
        dependentOn: this.getView(),
      },
    );
  }

  private async mostrarPopupTrialObligatorio(): Promise<void> {
    if (this._trialPromptOpen) {
      return;
    }

    this._trialPromptOpen = true;

    if (!this._oTrialDialog) {
      const oDialog = await Fragment.load({
        id: this.getView()?.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.TrialSubscriptionDialog",
        controller: this,
      });

      this._oTrialDialog = oDialog as Dialog;
      this.getView()?.addDependent(this._oTrialDialog);
    }

    this._oTrialDialog.open();
  }

  public onActivarTrialDesdeDialog(): void {
    this._oTrialDialog?.close();
    this._trialPromptOpen = false;
    void this.activarPlanPrueba();
  }

  public onCerrarTrialDialog(): void {
    this._oTrialDialog?.close();
    this._trialPromptOpen = false;
    void this.onLogout();
  }

  private async activarPlanPrueba(): Promise<void> {
    try {
      const oResponse = await fetch(`${this.baseUrl}/activarSuscripcion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "PRUEBA", meses: 1 }),
      });

      const oData = await oResponse.json();
      if (!oResponse.ok) {
        throw new Error(oData?.error?.message || oData?.message || "No se pudo activar la prueba");
      }

      MetaPixelService.trackStartTrial();
      MessageToast.show(oData.message || "Plan de prueba activado");
      await this._cargarDashboard();
      await (this.getOwnerComponent() as any)?.loadPlanIndicator?.();
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo activar el plan de prueba", {
        onClose: () => void this.mostrarPopupTrialObligatorio(),
        dependentOn: this.getView(),
      });
    }
  }

  private tieneAccesoSuscripcion(estado: string, diasRestantes: number): boolean {
    return ["ACTIVA", "CANCELADA"].includes(estado) && Number(diasRestantes || 0) >= 0;
  }

  private tieneMultimediaPremium(plan: string, estado: string, diasRestantes: number): boolean {
    return (
      this.tieneAccesoSuscripcion(estado, diasRestantes) &&
      ["PRUEBA", "PREMIUM"].includes(String(plan || "").toUpperCase())
    );
  }

  private _mapEstadoTexto(sEstado: string): string {
    switch (sEstado) {
      case "PROGRAMADA":
        return "Programada";
      case "EN_PROCESO":
        return "En proceso";
      case "COMPLETADA":
        return "Completada";
      case "CANCELADA":
        return "Cancelada";
      default:
        return sEstado || "";
    }
  }

  private _mapEstadoState(sEstado: string): string {
    switch (sEstado) {
      case "PROGRAMADA":
        return "Information";
      case "EN_PROCESO":
        return "Warning";
      case "COMPLETADA":
        return "Success";
      case "CANCELADA":
        return "Error";
      default:
        return "None";
    }
  }

  private _formatearFecha(sFecha: string): string {
    if (!sFecha) {
      return "";
    }

    const oDate = new Date(sFecha);

    if (isNaN(oDate.getTime())) {
      return sFecha;
    }

    const dd = String(oDate.getDate()).padStart(2, "0");
    const mm = String(oDate.getMonth() + 1).padStart(2, "0");
    const yyyy = oDate.getFullYear();

    return `${dd}/${mm}/${yyyy}`;
  }

  public onNuevaAve(): void {
    this.getOwnerComponent()?.getRouter().navTo("aveCreate");
  }

  public onNuevaIncubacion(): void {
    this.getOwnerComponent()?.getRouter().navTo("incubacionCreate");
  }

  public onVerIncubaciones(): void {
    this.getOwnerComponent()?.getRouter().navTo("incubacionList");
  }

  public onIrAves(): void {
    this.getOwnerComponent()?.getRouter().navTo("list");
  }

  public onAbrirIncubacionDetalle(oEvent: any): void {
    const oItem = oEvent.getSource();
    const oContext = oItem.getBindingContext("dashboard");
    const oInc = oContext?.getObject() as any;
    if (oInc?.ID) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteIncubacionDetail", { id: oInc.ID });
    }
  }

  public async onToggleSideContent(oEvent: Event): Promise<void> {
    if (Device.system.phone) {
      if (!this._oMobileMenu) {
        const oFragment = await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.MobileMenu",
          controller: this,
        });

        this._oMobileMenu = oFragment as ActionSheet;
        this.getView()?.addDependent(this._oMobileMenu);
      }

      const oSource = oEvent.getSource() as Control;
      this._oMobileMenu.openBy(oSource);
      return;
    }

    const oSideNavigation = this.byId("sideNavigation") as any;
    if (oSideNavigation) {
      oSideNavigation.setExpanded(!oSideNavigation.getExpanded());
    }
  }

  public onMenuSelect(oEvent: Event): void {
    const oItem = oEvent.getParameter("item") as NavigationListItem;
    const sKey = oItem.getKey();

    this._navigateByKey(sKey);

    if (Device.system.phone && this._oMobileMenu) {
      this._oMobileMenu.close();
    }
  }

  private _navigateByKey(sKey: string): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();

    switch (sKey) {
      case "aves":
        oRouter?.navTo("RouteList");
        break;

      case "incubaciones":
        oRouter?.navTo("RouteIncubacionList");
        break;

      case "peleas":
        oRouter?.navTo("RoutePeleas");
        break;

      case "vacunacion":
        oRouter?.navTo("RouteVacunacion");
        break;

      default:
        break;
    }
  }

  public onMobileMenuPress(oEvent: Event): void {
    const oSource = oEvent.getSource() as Control;
    const sKey = oSource.data("key") as string;

    this._navigateByKey(sKey);

    if (this._oMobileMenu) {
      this._oMobileMenu.close();
    }
  }

  public onCambiarCuenta(): void {
    // aquí puedes redirigir al login o mostrar selector de cuentas
    const oRouter = (this.getOwnerComponent() as UIComponent).getRouter();
    oRouter.navTo("RouteLogin");
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

  public onNavToRegistro(): void {
    console.log("Navegando a registro...");
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteAveCreate");
  }

  public onNavToLista(): void {
    console.log("Navegando a lista...");
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteList");
  }

  public onLogout = async (): Promise<void> => {
    try {
      await this.authService.logout();
      MessageToast.show("Sesión cerrada exitosamente");

      const oRouter = (
        this.getOwnerComponent() as UIComponent
      )?.getRouter() as Router;
      oRouter?.navTo("RouteLanding");

      // Verificar que el método existe antes de llamarlo
      const oOwner = this.getOwnerComponent() as any;
      if (oOwner && typeof oOwner.updateUserModel === "function") {
        oOwner.updateUserModel();
      }
    } catch (error) {
      console.error("Error en logout:", error);
      MessageToast.show("Error cerrando sesión");
    }
  };

  public onNavNewBird(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteAveCreate");
  }

  public onNavNewPollito(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RoutePollitoCreate");
  }

  public onNavPollitos(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RoutePollitos");
  }

  public onNavNewIncubation(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteIncubacionCreate");
  }

  public onNavIncubationList(): void {
    localStorage.setItem("filterIncProceso", "");
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteIncubacionList");
  }

  public onNavBirdList(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteList");
  }

  public onNavIncubationListProcess(): void {
    localStorage.setItem("filterIncProceso", "EN_PROCESO");
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteIncubacionList");
  }

  public onNavLineasGallosList(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteLineaGallos");
  }

  public onVerPlanesCruce(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RoutePlanesCruce");
  }

  public onVerReportes(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteReportes");
  }

  public onVerCombates(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteCombates");
  }

  public onVerGenealogia(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteGenealogia");
  }

  public onVerEstadisticasPeleas(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteEstadisticasPeleas");
  }

  public onVerSuscripcion(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteSuscripcion");
  }

  public formatearEstadoSuscripcion(estado: EstadoSuscripcion): string {
    const estados = {
      [EstadoSuscripcion.Activa]: "Activa",
      [EstadoSuscripcion.Vencida]: "Vencida",
      [EstadoSuscripcion.Cancelada]: "Cancelada",
    };

    return estados[estado] || estado;
  }

  public formatearPlanSucripcion(plan: PlanSuscripcion): string {
    const planes = {
      [PlanSuscripcion.Prueba]: "Prueba",
      [PlanSuscripcion.Basico]: "Basico",
      [PlanSuscripcion.Pro]: "Pro",
      [PlanSuscripcion.Premium]: "Premium"
    };

    return planes[plan] || plan;
  }

}
