import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
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

      oModel.setProperty("/data", data.value || []);
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
