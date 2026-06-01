import BaseComponent from "sap/ui/core/UIComponent";
import Controller from "sap/ui/core/mvc/Controller";
import { createDeviceModel } from "./model/models";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";

type PlanIndicatorData = {
  visible: boolean;
  plan: string;
  text: string;
  state: string;
  type: string;
  icon: string;
  tieneSuscripcion?: boolean;
  estado?: string;
  diasRestantes?: number;
};

/**
 * @namespace com.rprincipees.registroavescombate
 */
export default class Component extends BaseComponent {
  private baseUrl = window.APP_CONFIG?.API_BASE_URL || "";
  private readonly publicRoutes = new Set([
    "RouteLogin",
    "RouteRegister",
    "RouteForgotPassword",
    "RouteResetPassword",
  ]);
  private readonly unrestrictedRoutes = new Set([
    "RouteWelcome",
    "RouteSuscripcion",
    "RouteAccountSettings",
  ]);
  private readonly routeModuleMap: Record<string, string> = {
    RouteList: "Aves",
    RouteAveCreate: "Aves",
    RouteAveDetail: "Aves",
    RouteAveUpdate: "Aves",
    RoutePollitos: "Crias",
    RoutePollitoCreate: "Crias",
    RoutePollitoDetail: "Crias",
    RoutePollitoEdit: "Crias",
    RouteIncubacionList: "Incubaciones",
    RouteIncubacionCreate: "Incubaciones",
    RouteIncubacionEdit: "Incubaciones",
    RouteIncubacionDetail: "Incubaciones",
    RouteLineaGallos: "LineasAves",
    RouteLineaGalloCreate: "LineasAves",
    RouteLineaGalloEdit: "LineasAves",
    RouteLineaGalloDetail: "LineasAves",
    RouteGenealogia: "LineasAves",
    RoutePlanesCruce: "PlanesCruces",
    RoutelineaGallosCruceCreate: "PlanesCruces",
    RouteReportes: "Historial",
    RouteCombates: "Peleas",
    RouteCombateCreate: "Peleas",
    RouteCombateEdit: "Peleas",
    RouteCombateDetail: "Peleas",
  };
  private readonly modulesByPlan: Record<string, string[]> = {
    PRUEBA: ["*"],
    BASICO: [
      "Aves",
      "Crias",
      "Incubaciones",
      "IncubacionDetalles",
      "FotosAve",
      "VideosAve",
      "DocumentosAve",
      "Suscripciones",
    ],
    PRO: [
      "Aves",
      "Crias",
      "Incubaciones",
      "IncubacionDetalles",
      "FotosAve",
      "VideosAve",
      "DocumentosAve",
      "LineasAves",
      "PlanesCruces",
      "EvaluacionesAves",
      "Suscripciones",
      "Historial",
    ],
    PREMIUM: ["*"],
  };

  public static metadata = {
    manifest: "json",
    interfaces: ["sap.ui.core.IAsyncContentCreation"],
  };

  public init(): void {
    // call the base component's init function
    super.init();
    this.installGlobalAccountSettingsHandler();

    // set the device model
    this.setModel(createDeviceModel(), "device");
    this.setModel(new JSONModel({
      visible: false,
      plan: "",
      text: "",
      state: "None",
      type: "Transparent",
      icon: "sap-icon://locked",
    }), "planIndicator");

    // enable routing
    this.getRouter().attachRouteMatched((event: any) => {
      void this.onRouteMatched(event);
    });
    this.getRouter().initialize();
  }

  private installGlobalAccountSettingsHandler(): void {
    const controllerPrototype = Controller.prototype as any;

    if (controllerPrototype.onAccountSettings) {
      return;
    }

    controllerPrototype.onAccountSettings = function (): void {
      this._oUserMenuPopover?.close?.();
      this._oUserMenuSheet?.close?.();
      this.getOwnerComponent?.()?.getRouter?.()?.navTo("RouteAccountSettings");
    };
  }

  private async onRouteMatched(event: any): Promise<void> {
    const routeName = String(event.getParameter("name") || "");
    const subscription = await this.loadPlanIndicator();
    this.validateRouteAccess(routeName, subscription);
  }

  public async loadPlanIndicator(): Promise<PlanIndicatorData> {
    const token = localStorage.getItem("auth_token");
    const oModel = this.getModel("planIndicator") as JSONModel;

    if (!token) {
      const indicator = {
        ...this.getPlanIndicatorData("", false),
        tieneSuscripcion: false,
      };
      oModel.setData(indicator);
      return indicator;
    }

    try {
      const response = await fetch(`${this.baseUrl}/obtenerSuscripcionActual`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok || data.tieneSuscripcion === false) {
        const indicator = {
          ...this.getPlanIndicatorData(""),
          tieneSuscripcion: false,
          estado: data.estado,
          diasRestantes: data.diasRestantes,
        };
        oModel.setData(indicator);
        return indicator;
      }

      const plan = String(data.plan || "").toUpperCase();
      const indicator = {
        ...this.getPlanIndicatorData(plan),
        tieneSuscripcion: true,
        estado: data.estado,
        diasRestantes: data.diasRestantes,
      };
      oModel.setData(indicator);
      return indicator;
    } catch (error) {
      const indicator = {
        ...this.getPlanIndicatorData("", false),
        tieneSuscripcion: false,
      };
      oModel.setData(indicator);
      return indicator;
    }
  }

  private getPlanIndicatorData(plan: string, visible = true): PlanIndicatorData {
    const planKey = String(plan || "").toUpperCase();
    const config: Record<string, Record<string, string>> = {
      PRUEBA: {
        text: "Prueba",
        state: "Warning",
        type: "Transparent",
        icon: "sap-icon://unlocked",
      },
      BASICO: {
        text: "Basico",
        state: "Information",
        type: "Transparent",
        icon: "sap-icon://initiative",
      },
      PRO: {
        text: "Pro",
        state: "Information",
        type: "Transparent",
        icon: "sap-icon://favorite",
      },
      PREMIUM: {
        text: "Premium",
        state: "Success",
        type: "Transparent",
        icon: "sap-icon://badge",
      },
    };
    const selected = config[planKey] || {
      text: "Sin plan",
      state: "Warning",
      type: "Transparent",
      icon: "sap-icon://locked",
    };

    return {
      visible,
      plan: planKey,
      ...selected,
    };
  }

  private validateRouteAccess(routeName: string, subscription: PlanIndicatorData): void {
    if (!routeName || this.publicRoutes.has(routeName) || this.unrestrictedRoutes.has(routeName)) {
      return;
    }

    const moduleName = this.routeModuleMap[routeName];
    if (!moduleName) {
      return;
    }

    if (!localStorage.getItem("auth_token")) {
      return;
    }

    const plan = String(subscription.plan || "").toUpperCase();
    const estado = String(subscription.estado || "").toUpperCase();
    const diasRestantes = Number(subscription.diasRestantes ?? 0);
    const hasActiveSubscription =
      subscription.tieneSuscripcion === true &&
      Boolean(plan) &&
      ["ACTIVA", "CANCELADA"].includes(estado) &&
      diasRestantes >= 0;

    if (!hasActiveSubscription) {
      MessageToast.show("Tu suscripcion no esta activa. Revisa o elige un plan.");
      this.getRouter().navTo("RouteSuscripcion", {}, true);
      return;
    }

    if (!this.isModuleAllowed(plan, moduleName)) {
      MessageToast.show(`El modulo requiere un plan superior al ${this.formatPlan(plan)}.`);
      this.getRouter().navTo("RouteSuscripcion", {}, true);
    }
  }

  private isModuleAllowed(plan: string, moduleName: string): boolean {
    const modules = this.modulesByPlan[plan] || [];
    return modules.includes("*") || modules.includes(moduleName);
  }

  private formatPlan(plan: string): string {
    const labels: Record<string, string> = {
      PRUEBA: "Prueba",
      BASICO: "Basico",
      PRO: "Pro",
      PREMIUM: "Premium",
    };

    return labels[plan] || plan;
  }

  // Component.ts
  public updateUserModel(): void {
    const oModel = this.getModel("user") as JSONModel;
    if (oModel) {
      oModel.setData({
        username: "",
        email: "",
        rol: "",
        isLoggedIn: false,
      });
    }

    const oPlanModel = this.getModel("planIndicator") as JSONModel;
    oPlanModel?.setData(this.getPlanIndicatorData("", false));
  }
}
