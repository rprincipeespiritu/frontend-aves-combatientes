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
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Table from "sap/m/Table";
import SearchField from "sap/m/SearchField";
import ComboBox from "sap/m/ComboBox";
import DatePicker from "sap/m/DatePicker";

export default class IncubacionList extends Controller {
  public formatter = formatter;
  service: IncubacionService;
  authService: AuthService;
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";

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

    this.bindUserModel();

    const oModel = new JSONModel({
      busy: false,
      incubaciones: [],
      filteredCount: 0,
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
      const incubaciones = (await this.service.list()).sort((a: any, b: any) => {
        const diferenciaEstado = this.obtenerPrioridadEstado(a.estado) - this.obtenerPrioridadEstado(b.estado);
        if (diferenciaEstado !== 0) return diferenciaEstado;

        return this.obtenerTiempo(a.fechaEclosion) - this.obtenerTiempo(b.fechaEclosion);
      });
      oModel.setProperty("/incubaciones", incubaciones);
      oModel.setProperty("/filteredCount", incubaciones.length);
      this.aplicarFiltros();
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

  public onBuscar(): void {
    this.aplicarFiltros();
  }

  public onFiltrarEstado(): void {
    this.aplicarFiltros();
  }

  public onFiltrarFecha(): void {
    this.aplicarFiltros();
  }

  public onLimpiarFiltros(): void {
    (this.byId("searchField") as SearchField)?.setValue("");
    (this.byId("estadoFilter") as ComboBox)?.setSelectedKey("");
    (this.byId("fechaDesdeFilter") as DatePicker)?.setDateValue(null);
    (this.byId("fechaHastaFilter") as DatePicker)?.setDateValue(null);
    this.aplicarFiltros();
  }

  private aplicarFiltros(): void {
    const oTable = this.byId("tblIncubaciones") as Table;
    const oBinding = oTable?.getBinding("items") as any;
    const aFilters: Filter[] = [];
    const sBusqueda = ((this.byId("searchField") as SearchField)?.getValue() || "").trim();
    const sEstado = (this.byId("estadoFilter") as ComboBox)?.getSelectedKey();
    const dDesde = (this.byId("fechaDesdeFilter") as DatePicker)?.getDateValue();
    const dHasta = (this.byId("fechaHastaFilter") as DatePicker)?.getDateValue();

    if (sBusqueda) {
      aFilters.push(
        new Filter({
          filters: [
            new Filter("codigo", FilterOperator.Contains, sBusqueda),
            new Filter("estado", FilterOperator.Contains, sBusqueda.toUpperCase()),
          ],
          and: false,
        }),
      );
    }

    if (sEstado) {
      aFilters.push(new Filter("estado", FilterOperator.EQ, sEstado));
    }

    if (dDesde || dHasta) {
      const inicio = dDesde ? this.inicioDelDia(dDesde).getTime() : Number.NEGATIVE_INFINITY;
      const fin = dHasta ? this.finDelDia(dHasta).getTime() : Number.POSITIVE_INFINITY;

      aFilters.push(
        new Filter({
          path: "fechaIncubacion",
          test: (value: string | Date) => {
            const tiempo = this.obtenerTiempo(value);
            return tiempo >= inicio && tiempo <= fin;
          },
        }),
      );
    }

    oBinding?.filter(aFilters);
    this.actualizarContadorFiltrado();
  }

  private actualizarContadorFiltrado(): void {
    const oBinding = (this.byId("tblIncubaciones") as Table)?.getBinding("items") as any;
    const oModel = this.getView()?.getModel("view") as JSONModel;

    if (!oModel) return;

    const count = oBinding?.getLength?.() ?? (oModel.getProperty("/incubaciones") || []).length;
    oModel.setProperty("/filteredCount", count);
  }

  private obtenerTiempo(fecha: string | Date): number {
    if (!fecha) return 0;
    const date = fecha instanceof Date ? fecha : new Date(fecha);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private inicioDelDia(fecha: Date): Date {
    const date = new Date(fecha);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private finDelDia(fecha: Date): Date {
    const date = new Date(fecha);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private obtenerPrioridadEstado(estado?: string): number {
    const prioridades: Record<string, number> = {
      EN_PROCESO: 0,
      PROGRAMADA: 1,
      COMPLETADA: 2,
      FINALIZADA: 2,
      CANCELADA: 3,
    };

    return prioridades[String(estado || "").toUpperCase()] ?? 4;
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
    this.bindUserModel();

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
