import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import UIComponent from "sap/ui/core/UIComponent";
import IncubacionService from "../services/IncubacionService";
import { AuthService } from "../services/AuthService";
import { EstadoIncubacion } from "../types/Models";
import formatter from "../model/formatter";
import Router from "sap/ui/core/routing/Router";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import {IIncubacion} from "../services/IncubacionService";

export default class IncubacionList extends Controller {
  public formatter = formatter;
  service: IncubacionService;
  authService: AuthService;
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;
  private baseUrl: string = "http://localhost:4004/api/avecombatiente";

  public onInit(): void {
    this.authService = AuthService.getInstance();
    this.service = IncubacionService.getInstance();

    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteIncubacionList")
      ?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched = (oEvent: any): void => {
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

    const oModel = new JSONModel({
      busy: false,
      incubaciones: [],
    });

    this.getView()?.setModel(oModel, "view");
    void this._loadData();
  };

  public onDetail(oEvent: Event): void {
    const oItem = oEvent.getSource();
    const oContext = (oItem as any)?.getBindingContext("view");
    const oInc = oContext?.getObject() as any;
    if (oInc?.ID) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteIncubacionDetail", { id: oInc.ID });
    }
  }
 
  private async _loadData(): Promise<void> {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      const incubaciones = await this.service.list();
      oModel.setProperty("/incubaciones", incubaciones);
    } catch (error) {
      MessageBox.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar incubaciones",
      );
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  public onCreate(): void {
    this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionCreate");
  }

  public onEdit(oEvent: any): void {
    const oContext = oEvent.getSource().getBindingContext("view");
    const oItem = oContext.getObject();
    this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionEdit", {
      id: oItem.ID,
    });
  }

  public onDelete(oEvent: any): void {
    const oContext = oEvent.getSource().getBindingContext("view");
    const oItem = oContext.getObject() as IIncubacion;

    if(oItem.estado !== 'CANCELADA'){
      MessageBox.error("Solo se puede eliminar el registro en estado 'Cancelada'" );
      return
    }

    MessageBox.confirm(`¿Eliminar la incubación ${oItem.codigo}?`, {
      onClose: async (sAction: string) => {
        if (sAction !== MessageBox.Action.OK) {
          return;
        }

        try {

          delete oItem.padre;
          delete oItem.madre;

          const response = await fetch(`${this.baseUrl}/eliminarIncubacion`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.authService.getToken()}`
            },
            body: JSON.stringify({
              incubacionId: oItem.ID
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const oResult = await response.json();
          MessageToast.show("Incubación eliminada");

          await this._loadData();
        } catch (error) {
          MessageBox.error(
            error instanceof Error ? error.message : "No se pudo eliminar",
          );
        }
      },
    });
  }

  public async onRefresh(): Promise<void> {
    //localStorage.setItem('filterIncProceso', "");
    await this._loadData();
    MessageToast.show("Datos actualizados");
  }

  public onNavBack(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteWelcome");
  }

  public formatearEstado(estado: EstadoIncubacion): string {
    const estados = {
      [EstadoIncubacion.Proceso]: "En proceso",
      [EstadoIncubacion.Programada]: "Programada",
      [EstadoIncubacion.Completada]: "Completada",
      [EstadoIncubacion.Cancelada]: "Cancelada"
    };

    return estados[estado] || estado;
  }

  public onNavWelcome(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
    oRouter?.navTo("RouteWelcome");
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

}
