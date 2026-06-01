import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/m/routing/Router";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import { AuthService } from "../services/AuthService";
import formatter from "../model/formatter";
import { ParentescoAve } from "../types/Models";

export default class PlanesCruce extends Controller {
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;
  private authService: AuthService;
  public formatter = formatter;

  public onInit(): void {
    this.authService = AuthService.getInstance();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RoutePlanesCruce")
      ?.attachPatternMatched(this.onRouteMatched, this);
  }

  private async onRouteMatched(oEvent: any): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteLogin");
      return;
    }

    const sUserData = localStorage.getItem("auth_user");
    if (sUserData) {
      const oUser = JSON.parse(sUserData);
      const oUserModel = new JSONModel(oUser);
      this.getView()?.setModel(oUserModel, "user");
    }

    this.getView()?.setModel(
      new JSONModel({
        data: [],
      }),
      "planes",
    );

    this.cargarPlanes();
  }

  private async cargarPlanes(): Promise<void> {
    const oModel = this.getView()?.getModel("planes") as JSONModel;

    try {
      const token = localStorage.getItem("auth_token");

      const response = await fetch(
        "http://localhost:4004/api/avecombatiente/PlanesCruces?$expand=macho,hembra,linea",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      oModel.setProperty("/data", this.normalizarPlanesDuplicados(data.value || []));
    } catch (error) {
      MessageBox.error("Error al cargar planes de cruce.");
    }
  }

  public onSelectPlan(oEvent: any): void {
    const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
    const oContext = oItem?.getBindingContext("planes");

    if (!oContext) {
      MessageBox.warning(
        "No se pudo obtener el detalle del plan seleccionado.",
      );
      return;
    }

    const oPlan = oContext.getObject();
    
    const parentesco = this.formatearParentesco(oPlan.tipoParentesco as ParentescoAve);
    MessageBox.information(
      `Codigo: ${oPlan.codigo || ""}

Detalle del cruce:
                    
        Macho: ${oPlan.macho?.placa}
        Hembra: ${oPlan.hembra?.placa}

        Parentesco: ${parentesco}
        Riesgo: ${oPlan.nivelRiesgo}

        Recomendación:
        ${oPlan.recomendacion}`,
    );
  }

  public onNuevoPlan(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteLineaGallos");
  }

  private normalizarPlanesDuplicados(planes: any[]): any[] {
    const planesPorPareja = new Map<string, any>();

    for (const plan of planes) {
      const machoId = plan.macho_ID || plan.macho?.ID || "";
      const hembraId = plan.hembra_ID || plan.hembra?.ID || "";
      const clave = `${machoId}|${hembraId}`;

      if (!machoId || !hembraId) {
        planesPorPareja.set(plan.ID || plan.codigo || clave, plan);
        continue;
      }

      const actual = planesPorPareja.get(clave);
      if (!actual || this.debeReemplazarPlanDuplicado(actual, plan)) {
        planesPorPareja.set(clave, plan);
      }
    }

    return Array.from(planesPorPareja.values());
  }

  private debeReemplazarPlanDuplicado(actual: any, candidato: any): boolean {
    const actualCorrecto = this.codigoCoincideConTipo(actual);
    const candidatoCorrecto = this.codigoCoincideConTipo(candidato);

    if (actualCorrecto !== candidatoCorrecto) {
      return candidatoCorrecto;
    }

    return String(candidato.fechaPropuesta || "") > String(actual.fechaPropuesta || "");
  }

  private codigoCoincideConTipo(plan: any): boolean {
    const codigo = String(plan.codigo || "").toUpperCase();
    const esCruceAbierto = plan.linea?.nombre === "Cruce abierto";

    return esCruceAbierto ? codigo.startsWith("PCA") : codigo.startsWith("PC_") || codigo.startsWith("PC-");
  }

  public onEditarPlan(oEvent: any): void {
    const oPlan = oEvent.getSource()?.getBindingContext("planes")?.getObject();
    if (!oPlan?.ID || !oPlan?.linea_ID) return;

    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteLineaGallosCruceEdit", {
      lineaId: oPlan.linea_ID,
      planId: oPlan.ID,
    });
  }

  public onEliminarPlan(oEvent: any): void {
    const oPlan = oEvent.getSource()?.getBindingContext("planes")?.getObject();
    if (!oPlan?.ID) return;

    MessageBox.confirm(`Se eliminara el plan ${oPlan.codigo || oPlan.ID}.`, {
      actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
      emphasizedAction: MessageBox.Action.OK,
      onClose: async (action: string) => {
        if (action !== MessageBox.Action.OK) return;

        try {
          const response = await fetch(
            `http://localhost:4004/api/avecombatiente/PlanesCruces('${oPlan.ID}')`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ estado: "ELIMINADO" }),
            },
          );
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(data?.error?.message || "No se pudo eliminar el plan.");
          }

          MessageToast.show("Plan de cruce eliminado.");
          await this.cargarPlanes();
        } catch (error: any) {
          MessageBox.error(error.message || "No se pudo eliminar el plan de cruce.");
        }
      },
    });
  }

  public async onNuevoCruceAbierto(): Promise<void> {
    try {
      const response = await fetch(
        "http://localhost:4004/api/avecombatiente/obtenerLineaCruceAbierto",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const data = await response.json();

      if (!response.ok || !data?.lineaId) {
        throw new Error(data?.error?.message || "No se pudo preparar el cruce abierto.");
      }

      const oRouter = (
        this.getOwnerComponent() as UIComponent
      )?.getRouter() as Router;
      oRouter?.navTo("RoutelineaGallosCruceCreate", {
        lineaId: data.lineaId,
      });
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo iniciar el cruce abierto.");
    }
  }

  public onNavBack(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteWelcome");
  }

  public onNavWelcome(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteWelcome");
  }

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = (oEvent as any)?.getSource() as Control;

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

  public formatearParentesco(parentesco: ParentescoAve): string {
    const parentescos = {
      [ParentescoAve.AbuelaNieto]: "Abuela Niet0",
      [ParentescoAve.AbueloNieta]: "Abuelo Nieta",
      [ParentescoAve.MadreHijo]: "Madre Hijo",
      [ParentescoAve.MedioHermanos]: "Medio Hermanos",
      [ParentescoAve.PadreHija]: "Padre Hija",
      [ParentescoAve.Primos]: "Primos",
      [ParentescoAve.SinParentesco]: "Sin Parentesco",
      [ParentescoAve.TiaSobrina]: "Tia Sobrina",
      [ParentescoAve.TioSobrina]: "Tio Sobrina",
    };

    return parentescos[parentesco] || parentesco;
  }
}
