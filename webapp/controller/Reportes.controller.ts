import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import UIComponent from "sap/ui/core/UIComponent";
import Spreadsheet from "sap/ui/export/Spreadsheet";
import { AuthService } from "../services/AuthService";
import Popover from "sap/m/Popover";
import Fragment from "sap/ui/core/Fragment";
import ActionSheet from "sap/m/ActionSheet";
import Control from "sap/ui/core/Control";
import Device from "sap/ui/Device";
import Router from "sap/m/routing/Router";

export default class Reportes extends Controller {
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
  private authService: AuthService;
  private _oUserMenuPopover: any;
  private _oUserMenuSheet: any;

  public onInit(): void {
    this.authService = AuthService.getInstance();
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteReportes")
      ?.attachPatternMatched(this.onRouteMatched, this);

    this.getView()?.setModel(
      new JSONModel({
        tipoReporte: "CRUCES_INCUBACION",
        fechaDesde: null,
        fechaHasta: null,
        busy: false,
        rows: [],
        titulo: "Reporte de cruces e incubaciones",
        totalRegistros: 0,
        columnasVista: this.getColumnasVista("CRUCES_INCUBACION"),
      }),
      "reportes",
    );
  }

  private onRouteMatched = (): void => {
    if (!this.authService.isAuthenticated()) {
      (this.getOwnerComponent() as UIComponent)
        ?.getRouter()
        ?.navTo("RouteLogin");
      return;
    }

    const sUserData = localStorage.getItem("auth_user");

    if (sUserData) {
      const oUser = JSON.parse(sUserData);
      const oUserModel = new JSONModel(oUser);
      this.getView()?.setModel(oUserModel, "user");
    }

    void this.onGenerarReporte();
  };

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json",
    };
  }

  private async fetchOData(path: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      headers: this.getHeaders(),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message || data?.message || "No se pudo cargar el reporte",
      );
    }

    return data.value || [];
  }

  private getDateValue(value: any): number {
    if (!value) return 0;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private filtrarPorFecha(rows: any[], campoFecha: string): any[] {
    const oModel = this.getView()?.getModel("reportes") as JSONModel;
    const desde = this.getDateValue(oModel.getProperty("/fechaDesde"));
    const hastaValue = oModel.getProperty("/fechaHasta");
    const hasta = hastaValue ? this.getDateValue(hastaValue) + 86399999 : 0;

    return rows.filter((row) => {
      const fecha = this.getDateValue(row[campoFecha]);
      if (!fecha) return true;
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      return true;
    });
  }

  public formatearFecha(fecha: string | Date): string {
    if (!fecha) {
      return "";
    }

    if (typeof fecha === "string") {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
      }
    }

    const date = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(date.getTime())) {
      return "";
    }

    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  }

  private calcularPorcentaje(parte: number, total: number): number {
    if (!total) return 0;
    return Number(((parte / total) * 100).toFixed(2));
  }

  private async generarCrucesIncubacion(): Promise<any[]> {
    const incubaciones = await this.fetchOData(
      "Incubaciones?$expand=detalles($expand=padre,madre,planCruce)&$orderby=fechaIncubacion desc",
    );
    const filtradas = this.filtrarPorFecha(incubaciones, "fechaIncubacion");
    const rows: any[] = [];

    filtradas.forEach((inc: any) => {
      (inc.detalles || []).forEach((detalle: any) => {
        rows.push({
          codigoIncubacion: inc.codigo,
          fechaIncubacion: this.formatearFecha(inc.fechaIncubacion),
          estadoIncubacion: inc.estado,
          planCruce: detalle.planCruce?.codigo || "",
          macho: detalle.padre?.placa || "",
          hembra: detalle.madre?.placa || "",
          parentesco:
            detalle.tipoParentesco || detalle.planCruce?.tipoParentesco || "",
          riesgo: detalle.nivelRiesgo || detalle.planCruce?.nivelRiesgo || "",
          porcentajeConsanguinidad:
            detalle.porcentaje ?? detalle.planCruce?.porcentaje ?? 0,
          totalHuevos: detalle.totalHuevos || 0,
          huevosFertiles: detalle.huevosFertiles || 0,
          huevosEclosionados: detalle.huevosEclosionados || 0,
          huevosNoEclosionados: detalle.huevosNoEclosionados || 0,
          fertilidadPorc: this.calcularPorcentaje(
            detalle.huevosFertiles || 0,
            detalle.totalHuevos || 0,
          ),
          eclosionPorc: this.calcularPorcentaje(
            detalle.huevosEclosionados || 0,
            detalle.huevosFertiles || 0,
          ),
        });
      });
    });

    return rows;
  }

  private async generarAves(): Promise<any[]> {
    const aves = await this.fetchOData(
      "Aves?$expand=padre,madre&$orderby=placa asc",
    );
    return aves.map((ave: any) => ({
      placa: ave.placa,
      nombre: ave.nombre,
      sexo: ave.sexo,
      estado: ave.estado,
      raza: ave.raza,
      color: ave.color,
      fechaNacimiento: this.formatearFecha(ave.fechaNacimiento),
      padre: ave.padre?.placa || "",
      madre: ave.madre?.placa || "",
      aptoReproduccion: ave.aptoReproduccion ? "Si" : "No",
      coeficienteConsanguinidad: ave.coeficienteConsanguinidad || 0,
    }));
  }

  private async generarPlanes(): Promise<any[]> {
    const planes = await this.fetchOData(
      "PlanesCruces?$expand=macho,hembra,linea&$orderby=fechaPropuesta desc",
    );
    const filtrados = this.filtrarPorFecha(planes, "fechaPropuesta");
    return filtrados.map((plan: any) => ({
      codigo: plan.codigo,
      fechaPropuesta: this.formatearFecha(plan.fechaPropuesta),
      linea: plan.linea?.nombre || "",
      macho: plan.macho?.placa || "",
      hembra: plan.hembra?.placa || "",
      parentesco: plan.tipoParentesco,
      riesgo: plan.nivelRiesgo,
      porcentajeConsanguinidad: plan.porcentaje || 0,
      decision: plan.decision,
      estado: plan.estado,
      recomendacion: plan.recomendacion,
    }));
  }

  public async onGenerarReporte(): Promise<void> {
    const oModel = this.getView()?.getModel("reportes") as JSONModel;
    const tipo = oModel.getProperty("/tipoReporte");

    oModel.setProperty("/busy", true);

    try {
      let rows: any[] = [];
      let titulo = "";

      if (tipo === "AVES") {
        rows = await this.generarAves();
        titulo = "Reporte de aves";
      } else if (tipo === "PLANES") {
        rows = await this.generarPlanes();
        titulo = "Reporte de planes de cruce";
      } else {
        rows = await this.generarCrucesIncubacion();
        titulo = "Reporte de cruces e incubaciones";
      }

      oModel.setProperty("/rows", rows);
      oModel.setProperty("/titulo", titulo);
      oModel.setProperty("/totalRegistros", rows.length);
      oModel.setProperty("/columnasVista", this.getColumnasVista(tipo));
    } catch (error: any) {
      MessageBox.error(error.message || "No se pudo generar el reporte");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private getColumnas(tipo: string): any[] {
    const columnas: Record<string, any[]> = {
      AVES: [
        { label: "Placa", property: "placa" },
        { label: "Nombre", property: "nombre" },
        { label: "Sexo", property: "sexo" },
        { label: "Estado", property: "estado" },
        { label: "Raza", property: "raza" },
        { label: "Color", property: "color" },
        { label: "Fecha nacimiento", property: "fechaNacimiento" },
        { label: "Padre", property: "padre" },
        { label: "Madre", property: "madre" },
        { label: "Apto reproduccion", property: "aptoReproduccion" },
        {
          label: "% consanguinidad",
          property: "coeficienteConsanguinidad",
          type: "number",
        },
      ],
      PLANES: [
        { label: "Codigo", property: "codigo" },
        { label: "Fecha", property: "fechaPropuesta" },
        { label: "Linea", property: "linea" },
        { label: "Macho", property: "macho" },
        { label: "Hembra", property: "hembra" },
        { label: "Parentesco", property: "parentesco" },
        { label: "Riesgo", property: "riesgo" },
        {
          label: "% consanguinidad",
          property: "porcentajeConsanguinidad",
          type: "number",
        },
        { label: "Decision", property: "decision" },
        { label: "Estado", property: "estado" },
        { label: "Recomendacion", property: "recomendacion" },
      ],
      CRUCES_INCUBACION: [
        { label: "Incubacion", property: "codigoIncubacion" },
        { label: "Fecha incubacion", property: "fechaIncubacion" },
        { label: "Estado", property: "estadoIncubacion" },
        { label: "Plan cruce", property: "planCruce" },
        { label: "Macho", property: "macho" },
        { label: "Hembra", property: "hembra" },
        { label: "Parentesco", property: "parentesco" },
        { label: "Riesgo", property: "riesgo" },
        {
          label: "% consanguinidad",
          property: "porcentajeConsanguinidad",
          type: "number",
        },
        { label: "Total huevos", property: "totalHuevos", type: "number" },
        { label: "Fertiles", property: "huevosFertiles", type: "number" },
        { label: "Nacidos", property: "huevosEclosionados", type: "number" },
        {
          label: "No eclosionados",
          property: "huevosNoEclosionados",
          type: "number",
        },
        { label: "% fertilidad", property: "fertilidadPorc", type: "number" },
        { label: "% eclosion", property: "eclosionPorc", type: "number" },
      ],
    };

    return columnas[tipo] || columnas.CRUCES_INCUBACION;
  }

  private getColumnasVista(tipo: string): any {
    if (tipo === "AVES") {
      return {
        fecha: "Fecha nac.",
        referencia: "Placa",
        machoPlaca: "Nombre",
        hembraNombre: "Sexo",
        riesgoEstado: "Estado",
        huevosPorcentaje: "Apto rep.",
        nacidos: "% Consang.",
      };
    }

    return {
      fecha: "Fecha",
      referencia: "Referencia",
      machoPlaca: "Macho/Placa",
      hembraNombre: "Hembra/Placa",
      riesgoEstado: "Riesgo/Estado",
      huevosPorcentaje: "Huevos/%",
      nacidos: "Nacidos",
    };
  }

  public async onExportarExcel(): Promise<void> {
    const oModel = this.getView()?.getModel("reportes") as JSONModel;
    const rows = oModel.getProperty("/rows") || [];

    if (!rows.length) {
      MessageToast.show("Genera un reporte antes de exportar.");
      return;
    }

    const tipo = oModel.getProperty("/tipoReporte");
    const spreadsheet = new Spreadsheet({
      workbook: {
        columns: this.getColumnas(tipo),
      },
      dataSource: rows,
      fileName: `${oModel.getProperty("/titulo")}.xlsx`,
    });

    await spreadsheet.build();
    spreadsheet.destroy();
  }

  public onNavBack(): void {
    (this.getOwnerComponent() as UIComponent)
      ?.getRouter()
      ?.navTo("RouteWelcome");
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
}
