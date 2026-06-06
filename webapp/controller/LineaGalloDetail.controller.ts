import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import { AuthService } from "com/rprincipees/registroavescombate/services/AuthService";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/ui/core/routing/Router";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import formatter from "../model/formatter";
import {
  EstadoLinea,
  ParentescoAve,
} from "com/rprincipees/registroavescombate/types/Models";
import MessageToast from "sap/m/MessageToast";

export default class LineaGalloDetail extends Controller {
  private lineaId: string = "";
  private baseUrl: string = "http://localhost:4004/api/avecombatiente";
  private authService: AuthService;
  private _oUserMenuPopover: any;
  private _oUserMenuSheet: any;
  public formatter = formatter;

  public onInit(): void {
    this.authService = AuthService.getInstance();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteLineaGalloDetail")
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
        linea: {},
        planes: [],
      }),
      "detalle",
    );

    this.lineaId = oEvent.getParameter("arguments").id;
    await this.cargarDetalle();
  }

  public onVerPadre(): void {
    const oModel = this.getView()?.getModel("detalle") as JSONModel;
    let sNombreAve = oModel.getProperty("/linea/aveFundador/nombre");
    MessageBox.confirm(
      `¿Estás seguro que deseas navegar a los detalles del Padre Fundador '${sNombreAve}'?`,
      {
        title: "Navegar detalle Padre Fundador",
        onClose: (oAction: string) => {
          if (oAction === MessageBox.Action.OK) {
            const padreId: any = oModel.getProperty("/linea/aveFundador/ID");

            if (padreId) {
              const oRouter = (
                this.getOwnerComponent() as UIComponent
              ).getRouter();

              const sHash = oRouter.getURL("RouteAveDetail", {
                aveId: padreId,
              });

              window.open("#" + sHash, "_blank"); //abre en nueva pestaña
            }
          }
        },
      },
    );
  }

  public onVerMadre(): void {
    const oModel = this.getView()?.getModel("detalle") as JSONModel;
    let sNombreAve = oModel.getProperty("/linea/aveFundadora/nombre");
    MessageBox.confirm(
      `¿Estás seguro que deseas navegar a los detalles de la Madre Fundadora '${sNombreAve}'?`,
      {
        title: "Navegar detalle Madre Fundadora",
        onClose: (oAction: string) => {
          if (oAction === MessageBox.Action.OK) {
            const madreId: any = oModel.getProperty("/linea/aveFundadora/ID");

            if (madreId) {
              const oRouter = (
                this.getOwnerComponent() as UIComponent
              ).getRouter();

              const sHash = oRouter.getURL("RouteAveDetail", {
                aveId: madreId,
              });

              window.open("#" + sHash, "_blank"); //abre en nueva pestaña
            }
          }
        },
      },
    );
  }

  private async cargarDetalle(): Promise<void> {
    const oModel = this.getView()?.getModel("detalle") as JSONModel;
    const token = localStorage.getItem("token");

    try {
      const lineaResponse = await fetch(
        `${this.baseUrl}/LineasAves('${this.lineaId}')?$expand=aveFundador,aveFundadora`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            "Content-Type": "application/json",
          },
        },
      );

      const linea = await lineaResponse.json();

      const planesResponse = await fetch(
        `${this.baseUrl}/PlanesCruces?$filter=linea_ID eq '${this.lineaId}'&$expand=macho,hembra,linea`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            "Content-Type": "application/json",
          },
        },
      );

      const planesData = await planesResponse.json();

      oModel.setProperty("/linea", linea);
      oModel.setProperty("/planes", planesData.value || []);
    } catch (error) {
      MessageBox.error("No se pudo cargar el detalle de la línea.");
    }
  }

  public onNuevoCruce(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RoutelineaGallosCruceCreate", {
      lineaId: this.lineaId,
    });
  }

  public onEditarPlan(oEvent: any): void {
    const plan = oEvent.getSource()?.getBindingContext("detalle")?.getObject();
    if (!plan?.ID) return;

    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteLineaGallosCruceEdit", {
      lineaId: this.lineaId,
      planId: plan.ID,
    });
  }

  public onEliminarPlan(oEvent: any): void {
    const plan = oEvent.getSource()?.getBindingContext("detalle")?.getObject();
    if (!plan?.ID) return;

    MessageBox.confirm(`Se eliminara el plan ${plan.codigo || plan.ID}.`, {
      actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
      emphasizedAction: MessageBox.Action.OK,
      onClose: async (action: string) => {
        if (action !== MessageBox.Action.OK) return;

        try {
          const response = await fetch(`${this.baseUrl}/PlanesCruces('${plan.ID}')`, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ estado: "ELIMINADO" }),
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(data?.error?.message || "No se pudo eliminar el plan.");
          }

          MessageToast.show("Plan de cruce eliminado.");
          await this.cargarDetalle();
        } catch (error: any) {
          MessageBox.error(error.message || "No se pudo eliminar el plan de cruce.");
        }
      },
    });
  }

  public async onRefresh(): Promise<void> {
    //localStorage.setItem('filterIncProceso', "");
    await this.cargarDetalle();
    MessageToast.show("Datos actualizados");
  }

  public onNavBack(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteLineaGallos");
  }

  public onNavWelcome(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteWelcome");
  }

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = oEvent.getSource() as Control;

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

  public formatearEstado(estado: EstadoLinea): string {
    const estados = {
      [EstadoLinea.Activa]: "Activa",
      [EstadoLinea.Inactiva]: "Inactiva",
    };

    return estados[estado] || estado;
  }

  public async onLogout(): Promise<void> {
    try {
      await this.authService.logout();
      MessageToast.show("Sesión cerrada exitosamente");

      const oRouter = (
        this.getOwnerComponent() as UIComponent
      )?.getRouter() as Router;
      oRouter?.navTo("RouteLogin");

      // Verificar que el método existe antes de llamarlo
      const oOwner = this.getOwnerComponent() as any;
      if (oOwner && typeof oOwner.updateUserModel === "function") {
        oOwner.updateUserModel();
      }
    } catch (error) {
      console.error("Error en logout:", error);
      MessageToast.show("Error cerrando sesión");
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
