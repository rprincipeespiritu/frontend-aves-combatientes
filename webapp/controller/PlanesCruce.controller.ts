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
import Spreadsheet from "sap/ui/export/Spreadsheet";
import { AuthService } from "../services/AuthService";
import formatter from "../model/formatter";
import { ParentescoAve } from "../types/Models";

export default class PlanesCruce extends Controller {
  private _oUserMenuSheet: any;
  private _oUserMenuPopover: any;
  private _oLineageGuideDialog: any;
  private authService: AuthService;
  public formatter = formatter;
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";

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

    this.bindUserModel();

    this.getView()?.setModel(
      new JSONModel({
        data: [],
        todosPlanes: [],
        filtros: {
          codigo: "",
          padres: "",
        },
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
        `${this.baseUrl}/PlanesCruces?$expand=macho,hembra,linea`,
        {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem('auth_token')}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();
      const planes = this.normalizarPlanesDuplicados(data.value || []);

      oModel.setProperty("/todosPlanes", planes);
      this.aplicarFiltrosPlanes();
    } catch (error) {
      MessageBox.error("Error al cargar planes de cruce.");
    }
  }

  public async onSelectPlan(oEvent: any): Promise<void> {
    const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
    const oContext = oItem?.getBindingContext("planes");

    if (!oContext) {
      MessageBox.warning(
        "No se pudo obtener el detalle del plan seleccionado.",
      );
      return;
    }

    const oPlan = oContext.getObject();
    if (!oPlan?.ID) {
      MessageBox.warning("No se pudo identificar el plan seleccionado.");
      return;
    }

    const lineaId = oPlan.linea_ID || oPlan.linea?.ID;
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;

    try {
      const perteneceALinaje = lineaId
        ? await this.perteneceAModuloLinaje(lineaId, oPlan.linea)
        : false;

      if (perteneceALinaje && lineaId) {
        oRouter?.navTo("RouteLineaGallosCruceDetail", {
          lineaId,
          planId: oPlan.ID,
        });
        return;
      }

      const parentesco = this.formatearParentesco(oPlan.tipoParentesco as ParentescoAve);
      const tipoCruce = formatter.formatTipoFormacionCruceTexto(oPlan.tipoCruce, oPlan.linea?.nombre);
      const riesgo = formatter.formatNivelRiesgoTexto(oPlan.nivelRiesgo);
      MessageBox.information(
        `Codigo: ${oPlan.codigo || ""}

Detalle del cruce:
                    
        Macho: ${oPlan.macho?.placa}
        Hembra: ${oPlan.hembra?.placa}

        Tipo de formacion: ${tipoCruce}
        Parentesco: ${parentesco}
        Riesgo: ${riesgo}

        Recomendación:
        ${oPlan.recomendacion}`,
      );
    } catch (error: any) {
      MessageBox.error(
        error?.message || "No se pudo abrir el detalle del plan seleccionado.",
      );
    }
  }

  private async perteneceAModuloLinaje(lineaId: string, lineaExpandida?: any): Promise<boolean> {
    if (!lineaId) return false;

    if (lineaExpandida?.nombre === "Cruce abierto" || lineaExpandida?.estado === "ELIMINADO") {
      return false;
    }

    const response = await fetch(
      `http://localhost:4004/api/avecombatiente/LineasAvesActivas?$select=ID,nombre&$filter=ID eq '${lineaId}'`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const lineas = data.value || [];
    return lineas.some((linea: any) => linea.ID === lineaId && linea.nombre !== "Cruce abierto");
  }

  public onNuevoPlan(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteLineaGallos");
  }

  public onFiltrarPlanes(): void {
    this.aplicarFiltrosPlanes();
  }

  public onLimpiarFiltros(): void {
    const oModel = this.getView()?.getModel("planes") as JSONModel;
    oModel.setProperty("/filtros", {
      codigo: "",
      padres: "",
    });
    this.aplicarFiltrosPlanes();
  }

  private aplicarFiltrosPlanes(): void {
    const oModel = this.getView()?.getModel("planes") as JSONModel;
    const todosPlanes = oModel.getProperty("/todosPlanes") || [];
    const filtros = oModel.getProperty("/filtros") || {};
    const codigoFiltro = this.normalizarTexto(filtros.codigo);
    const padresFiltro = this.normalizarTexto(filtros.padres);

    const planesFiltrados = todosPlanes.filter((plan: any) => {
      const coincideCodigo =
        !codigoFiltro || this.normalizarTexto(plan.codigo || "").includes(codigoFiltro);

      if (!coincideCodigo) {
        return false;
      }

      if (!padresFiltro) {
        return true;
      }

      const textoPadres = this.normalizarTexto([
        plan.macho?.placa,
        plan.macho?.nombre,
        plan.macho?.apodo,
        plan.hembra?.placa,
        plan.hembra?.nombre,
        plan.hembra?.apodo,
      ].filter(Boolean).join(" "));

      return textoPadres.includes(padresFiltro);
    });

    oModel.setProperty("/data", planesFiltrados);
  }

  private normalizarTexto(valor?: string): string {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  public onExportarExcel(): void {
    const oModel = this.getView()?.getModel("planes") as JSONModel;
    const planes = oModel?.getProperty("/data") || [];

    if (!planes.length) {
      MessageToast.show("No hay planes de cruce para exportar");
      return;
    }

    const data = planes.map((plan: any) => ({
      codigo: plan.codigo || "Sin codigo",
      tipo: formatter.formatTipoFormacionCruceTexto(plan.tipoCruce, plan.linea?.nombre),
      machoPlaca: plan.macho?.placa || "",
      machoNombre: formatter.formatAveNombre(plan.macho?.nombre, plan.macho?.apodo),
      hembraPlaca: plan.hembra?.placa || "",
      hembraNombre: formatter.formatAveNombre(plan.hembra?.nombre, plan.hembra?.apodo),
      parentesco: this.formatearParentesco(plan.tipoParentesco as ParentescoAve),
      riesgo: formatter.formatNivelRiesgoTexto(plan.nivelRiesgo),
      decision: formatter.formatDecisionTexto(plan.decision),
      fecha: plan.fechaPropuesta || "",
      recomendacion: plan.recomendacion || "",
    }));

    const sheet = new Spreadsheet({
      workbook: {
        columns: [
          { label: "Codigo", property: "codigo" },
          { label: "Tipo", property: "tipo" },
          { label: "Macho (placa)", property: "machoPlaca" },
          { label: "Macho (nombre)", property: "machoNombre" },
          { label: "Hembra (placa)", property: "hembraPlaca" },
          { label: "Hembra (nombre)", property: "hembraNombre" },
          { label: "Parentesco", property: "parentesco" },
          { label: "Riesgo", property: "riesgo" },
          { label: "Decision", property: "decision" },
          { label: "Fecha", property: "fecha" },
          { label: "Recomendacion", property: "recomendacion" },
        ],
      },
      dataSource: data,
      fileName: "Planes_de_Cruce.xlsx",
    });

    sheet
      .build()
      .catch(() => MessageBox.error("No se pudo generar el archivo Excel"))
      .finally(() => sheet.destroy());
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
            `${this.baseUrl}/PlanesCruces('${oPlan.ID}')`,
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
        `${this.baseUrl}/obtenerLineaCruceAbierto`,
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

  public async onOpenLineageGuide(): Promise<void> {
    if (!this._oLineageGuideDialog) {
      const oFragment = await Fragment.load({
        id: this.getView()?.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.LineageGuideDialog",
        controller: this,
      });

      this._oLineageGuideDialog = oFragment;
      this.getView()?.addDependent(this._oLineageGuideDialog);
    }

    this._oLineageGuideDialog.open();
  }

  public onCloseLineageGuide(): void {
    this._oLineageGuideDialog?.close();
  }

  public async onUserMenuPress(oEvent: Event): Promise<void> {
    const oSource = (oEvent as any)?.getSource() as Control;
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
      [ParentescoAve.AbuelaNieto]: "Abuela × nieto",
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
