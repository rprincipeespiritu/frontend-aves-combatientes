import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import IncubacionService, {
  IAveOption,
  IIncubacion,
} from "../services/IncubacionService";
import Dialog from "sap/m/Dialog";
import Fragment from "sap/ui/core/Fragment";
import { AuthService } from "../services/AuthService";
import UIComponent from "sap/ui/core/UIComponent";
import DatePicker from "sap/m/DatePicker";
import DateTimePicker from "sap/m/DateTimePicker";
import Input from "sap/m/Input";
import { EstadoAve, EstadoIncubacion, IAve } from "../types/Models";
import formatter from "../model/formatter";
import Router from "sap/ui/core/routing/Router";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/mdc/Control";
import Device from "sap/ui/Device";
import ActionSheet from "sap/m/ActionSheet";
import Popover from "sap/m/Popover";
import List from "sap/m/List";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

export default class IncubacionForm extends Controller {
  public formatter = formatter;
  private service = new IncubacionService();
  private incubacionId: string | null = null;
  private _oPadresDialog: Dialog;
  private _oPlanesCruceDialog: Dialog;
  private helpSelected: any;
  private baseUrl: string = "http://localhost:4004/api/avecombatiente";
  authService: AuthService;
  private _sDetallePath: string | null = null;
  private _oUserMenuPopover: any;
  private _oUserMenuSheet: any;

  public onInit(): void {
    this.authService = AuthService.getInstance();

    const oViewModel = new JSONModel();

    let form = {
      fechaIncubacion: null,
      fechaPreNacimiento: null,
      fechaEclosion: null,
      estado: "Programada",
      observacion: "",
      canUsePlanesCruce: true,
      detalles: [],
    };

    oViewModel.setProperty("/form", form);
    oViewModel.setProperty("/canUsePlanesCruce", true);
    this.getView()?.setModel(oViewModel, "view");

    const oPicker = this.byId("DTP1") as DateTimePicker | undefined;

    oPicker?.addEventDelegate({
      onAfterRendering: () => {
        const sInnerId = `${oPicker.getId()}-inner`;
        const oInner = document.getElementById(
          sInnerId,
        ) as HTMLInputElement | null;

        if (oInner) {
          oInner.readOnly = true;
          oInner.setAttribute("readonly", "readonly");
        }
      },
    });

    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteIncubacionCreate")
      ?.attachPatternMatched(this._onCreateMatched, this);
    oRouter
      ?.getRoute("RouteIncubacionEdit")
      ?.attachPatternMatched(this._onEditMatched, this);
    oRouter
      ?.getRoute("RouteIncubacionReprogramar")
      ?.attachPatternMatched(this._onReprogramarMatched, this);
  }

  public onSeleccionarPadre(oEvent: Event): void {
    const oThat = this;
    const oSelectedItem = oEvent.getParameter("listItem");

    if (oSelectedItem) {
      const sNombre = oSelectedItem.getTitle();
      const sPlaca = oSelectedItem.getDescription();

      const oContext = oSelectedItem.getBindingContext("avesPadres");
      if (!oContext) {
        return;
      }

      const oAve = oContext.getObject();
      const oModel = this.getView()?.getModel("view");
      const sNombreAve = oAve.nombre || oAve.apodo || "";

      if (!oModel) {
        return;
      }

      let oInput: Input | undefined;
      if (oThat.helpSelected === "valueHelpPadre") {
        oModel.setProperty(`${this._sDetallePath}/padre_ID`, oAve.ID);
        oModel.setProperty(`${this._sDetallePath}/placaPadre`, oAve.placa);
        oModel.setProperty(`${this._sDetallePath}/nombrePadre`, sNombreAve);
      } else if (oThat.helpSelected === "valueHelpMadre") {
        oModel.setProperty(`${this._sDetallePath}/madre_ID`, oAve.ID);
        oModel.setProperty(`${this._sDetallePath}/placaMadre`, oAve.placa);
        oModel.setProperty(`${this._sDetallePath}/nombreMadre`, sNombreAve);
      }
      this._sDetallePath = null;
      oModel.refresh();
    }

    this._oPadresDialog?.close();
  }

  public onfechaIncubacionChange = (oEvent: any): void => {
    const oModel = this.getView()?.getModel("view") as JSONModel;

    const fechaIncubacion: Date = oEvent.getSource().getDateValue();

    if (!fechaIncubacion) {
      return;
    }

    // Pre-nacimiento = +18 días
    const fechaPreNacimiento = new Date(fechaIncubacion);
    fechaPreNacimiento.setDate(fechaPreNacimiento.getDate() + 18);

    // Eclosión = +21 días
    const fechaEclosion = new Date(fechaIncubacion);
    fechaEclosion.setDate(fechaEclosion.getDate() + 21);

    // Formatear a yyyy-MM-dd
    const format = (d: Date) => d.toISOString().split("T")[0];

    oModel.setProperty("/form/fechaPreNacimiento", fechaPreNacimiento);
    oModel.setProperty("/form/fechaEclosion", fechaEclosion);
  };

  private onValueHelpPadre = (oEvent: Event): void => {
    const oThat = this;
    const oSource = oEvent.getSource();
    const oContext = oSource.getBindingContext("view");
    if (!oContext) {
      return;
    }

    this._sDetallePath = oContext.getPath();

    oThat.helpSelected = "valueHelpPadre";
    oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Padre");
  };

  private onValueHelpMadre = (oEvent: Event): void => {
    const oThat = this;
    const oSource = oEvent.getSource();
    const oContext = oSource.getBindingContext("view");
    if (!oContext) {
      return;
    }

    this._sDetallePath = oContext.getPath();
    oThat.helpSelected = "valueHelpMadre";
    oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Madre");
  };

  public async onAbrirPopupPadres(
    helpSelected: string,
    sTitulo: string,
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/AvesActivas`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "Content-Type": "application/json",
        },
      });

      const aves: IAve[] = await response.json();
      let padres: any[] = [];
      if (helpSelected === "valueHelpPadre") {
        padres = (aves.value || []).filter(
          (a: any) => a.sexo === "M" && a.padrote === true,
        );
      } else if (helpSelected === "valueHelpMadre") {
        padres = (aves.value || []).filter(
          (a: any) => a.sexo === "H" && a.padrote === true,
        );
      }
      this.getView()?.setModel(new JSONModel(padres), "avesPadres");

      if (!this._oPadresDialog) {
        this._oPadresDialog = (await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.PadresDialog",
          controller: this,
        })) as Dialog;

        this.getView()?.addDependent(this._oPadresDialog);
      }

      this._oPadresDialog.setTitle(sTitulo);
      this._oPadresDialog.open();
    } catch (error) {
      console.error("Error :", error);
    }
  }

  public onCerrarPopupPadres(): void {
    this._oPadresDialog?.close();
  }

  private async _loadAvesPadrotes(): Promise<void> {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    const aves = await this.service.listAves();

    const machos = (aves || []).filter(
      (a: any) => a.sexo === "M" && a.padrote === true,
    );
    const hembras = (aves || []).filter(
      (a: any) => a.sexo === "H" && a.padrote === true,
    );
    this.getView()?.setModel(new JSONModel(machos), "avesMachos");
    this.getView()?.setModel(new JSONModel(hembras), "avesHembras");
  }

  private async _loadPlanesCruce(): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/PlanesCruces?$expand=macho,hembra,linea&$orderby=createdAt desc`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 403) {
        this.getView()?.setModel(new JSONModel([]), "planesCruce");
        const oModel = this.getView()?.getModel("view") as JSONModel;
        oModel?.setProperty("/canUsePlanesCruce", false);
        return;
      }

      throw new Error(
        data?.error?.message ||
          data?.message ||
          "No se pudo cargar planes de cruce",
      );
    }

    const planes = this.normalizarPlanesCruceDisponibles(data.value || []);

    this.getView()?.setModel(new JSONModel(planes), "planesCruce");
    const oModel = this.getView()?.getModel("view") as JSONModel;
    oModel?.setProperty("/canUsePlanesCruce", true);
  }

  private obtenerPlanesCruceCargados(): any[] {
    const planesModel = this.getView()?.getModel("planesCruce") as JSONModel;
    const data = planesModel?.getData();

    return Array.isArray(data) ? data : [];
  }

  private async obtenerPlanCrucePorId(planId: string): Promise<any | null> {
    if (!planId) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/PlanesCruces(ID='${planId}')?$expand=macho,hembra,linea`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = await response.json();

      if (!response.ok) {
        return null;
      }

      return this.mapPlanCruceVisual(data);
    } catch {
      return null;
    }
  }

  private aplicarPlanAlDetalle(detalle: any, plan: any): void {
    if (!plan) {
      return;
    }

    detalle.planCruce_ID = detalle.planCruce_ID || plan.ID || "";
    detalle.codigo = plan.codigoVisual || plan.codigo || detalle.codigo || "";
    detalle.tipoParentesco =
      detalle.tipoParentesco || plan.tipoParentesco || "";
    detalle.nivelRiesgo = detalle.nivelRiesgo || plan.nivelRiesgo || "";
    if (detalle.porcentaje === undefined || detalle.porcentaje === null) {
      detalle.porcentaje = plan.porcentaje ?? null;
    }
    detalle.decision = detalle.decision || plan.decision || "";
  }

  private async resolverPlanDeDetalle(
    detalle: any,
    planes: any[],
  ): Promise<void> {
    detalle.planCruce_ID =
      detalle.planCruce_ID || detalle.planCruce?.ID || "";

    if (detalle.planCruce?.codigo) {
      this.aplicarPlanAlDetalle(
        detalle,
        this.mapPlanCruceVisual(detalle.planCruce),
      );
      return;
    }

    let plan =
      planes.find((item) => item.ID === detalle.planCruce_ID) || null;

    if (!plan && detalle.planCruce_ID) {
      plan = await this.obtenerPlanCrucePorId(detalle.planCruce_ID);
    }

    if (!plan && detalle.padre_ID && detalle.madre_ID) {
      plan =
        planes.find(
          (item) =>
            (item.macho_ID || item.macho?.ID) === detalle.padre_ID &&
            (item.hembra_ID || item.hembra?.ID) === detalle.madre_ID,
        ) || null;
    }

    if (plan) {
      this.aplicarPlanAlDetalle(detalle, plan);
      return;
    }

    if (detalle.padre_ID && detalle.madre_ID) {
      detalle.codigo = "Detalle manual";
    }
  }

  private async prepararDetallesParaFormulario(
    detalles: any[],
    opciones?: { reiniciarConteoNacimiento?: boolean },
  ): Promise<any[]> {
    const planes = this.obtenerPlanesCruceCargados();
    const preparados: any[] = [];

    for (const element of detalles || []) {
      const detalle = { ...element };

      detalle.placaPadre = detalle.padre?.placa || detalle.placaPadre || "";
      detalle.nombrePadre =
        detalle.padre?.nombre ||
        detalle.padre?.apodo ||
        detalle.nombrePadre ||
        "";
      detalle.placaMadre = detalle.madre?.placa || detalle.placaMadre || "";
      detalle.nombreMadre =
        detalle.madre?.nombre ||
        detalle.madre?.apodo ||
        detalle.nombreMadre ||
        "";
      detalle.padre_ID = detalle.padre_ID || detalle.padre?.ID || "";
      detalle.madre_ID = detalle.madre_ID || detalle.madre?.ID || "";

      await this.resolverPlanDeDetalle(detalle, planes);

      if (opciones?.reiniciarConteoNacimiento) {
        detalle.huevosFertiles = 0;
        detalle.huevosEclosionados = 0;
        detalle.huevosNoEclosionados = 0;
      } else {
        detalle.huevosNoEclosionados = this.calcularNoEclosionados(
          detalle.huevosFertiles,
          detalle.huevosEclosionados,
        );
      }

      preparados.push(detalle);
    }

    return preparados;
  }

  private normalizarPlanesCruceDisponibles(planes: any[]): any[] {
    const planesPorPareja = new Map<string, any>();

    (planes || [])
      .filter((plan: any) =>
        ["PROPUESTO", "APROBADO", "EJECUTADO"].includes(plan.estado),
      )
      .forEach((plan: any) => {
        const planVisual = this.mapPlanCruceVisual(plan);
        const machoId = planVisual.macho_ID || planVisual.macho?.ID || "";
        const hembraId = planVisual.hembra_ID || planVisual.hembra?.ID || "";
        const clave =
          machoId && hembraId
            ? `${machoId}|${hembraId}`
            : planVisual.ID || planVisual.codigoVisual;
        const planActual = planesPorPareja.get(clave);

        if (
          !planActual ||
          this.debeReemplazarPlanCruceDuplicado(planActual, planVisual)
        ) {
          planesPorPareja.set(clave, planVisual);
        }
      });

    return Array.from(planesPorPareja.values());
  }

  private mapPlanCruceVisual(plan: any): any {
    const decisionTexto = this.formatter.formatDecisionTexto(plan.decision);
    const nivelRiesgoTexto = this.formatter.formatNivelRiesgoTexto(
      plan.nivelRiesgo,
    );
    const parentescoTexto = this.formatParentescoPlanCruce(plan.tipoParentesco);
    const tipoCruceTexto = this.formatter.formatTipoFormacionCruceTexto(
      plan.tipoCruce,
      plan.linea?.nombre,
    );
    const descripcionVisual = this.formatParejaPlanCruce(plan);

    return {
      ...plan,
      codigoVisual: plan.codigo || "Plan sin código",
      decisionTexto,
      decisionState: this.formatter.formatDecisionState(plan.decision),
      nivelRiesgoTexto,
      nivelRiesgoState: this.formatter.formatNivelRiesgoState(plan.nivelRiesgo),
      tipoCruceTexto,
      parentescoTexto,
      parentescoVisual: `Parentesco: ${parentescoTexto || "Sin dato"}`,
      porcentajeVisual: this.formatPorcentajePlanCruce(plan.porcentaje),
      descripcionVisual,
      busquedaVisual: [
        plan.codigo,
        plan.macho?.placa,
        plan.macho?.nombre,
        plan.hembra?.placa,
        plan.hembra?.nombre,
        plan.tipoParentesco,
        parentescoTexto,
        plan.tipoCruce,
        tipoCruceTexto,
        plan.decision,
        decisionTexto,
        plan.nivelRiesgo,
        nivelRiesgoTexto,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  private formatParejaPlanCruce(plan: any): string {
    const macho = [plan.macho?.placa, plan.macho?.nombre]
      .map((valor) => String(valor || "").trim())
      .filter(Boolean)
      .join(" ");
    const hembra = [plan.hembra?.placa, plan.hembra?.nombre]
      .map((valor) => String(valor || "").trim())
      .filter(Boolean)
      .join(" ");

    if (macho && hembra) {
      return `${macho} x ${hembra}`;
    }

    return macho || hembra || "Reproductores sin dato";
  }

  private formatParentescoPlanCruce(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      SIN_PARENTESCO: "Sin parentesco",
      PADRE_HIJA: "Padre con hija",
      MADRE_HIJO: "Madre con hijo",
      HERMANOS_COMPLETOS: "Hermanos completos",
      MEDIOS_HERMANOS: "Medios hermanos",
      ABUELO_NIETA: "Abuelo con nieta",
      ABUELA_NIETO: "Abuela con nieto",
      TIO_SOBRINA: "Tío con sobrina",
      TIA_SOBRINO: "Tía con sobrino",
      PRIMOS: "Primos",
      LINEA_COMUN: "Línea común",
    };
    const key = String(value || "").toUpperCase();

    if (labels[key]) {
      return labels[key];
    }

    return this.formatter.formatDecisionTexto(value);
  }

  private formatPorcentajePlanCruce(
    value: number | string | null | undefined,
  ): string {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    const porcentaje = Number(value);

    if (!Number.isFinite(porcentaje)) {
      return "";
    }

    return `Consang. ${porcentaje.toLocaleString("es-PE", {
      maximumFractionDigits: 2,
    })}%`;
  }

  private debeReemplazarPlanCruceDuplicado(
    actual: any,
    candidato: any,
  ): boolean {
    const candidatoCoincide = this.codigoCoincideConTipoPlan(candidato);
    const actualCoincide = this.codigoCoincideConTipoPlan(actual);

    if (candidatoCoincide !== actualCoincide) {
      return candidatoCoincide;
    }

    const fechaCandidato = new Date(
      candidato.fechaPropuesta || candidato.createdAt || 0,
    ).getTime();
    const fechaActual = new Date(
      actual.fechaPropuesta || actual.createdAt || 0,
    ).getTime();

    return fechaCandidato > fechaActual;
  }

  private codigoCoincideConTipoPlan(plan: any): boolean {
    const codigo = String(plan.codigoVisual || plan.codigo || "").toUpperCase();
    const esCruceAbierto = plan.linea?.nombre === "Cruce abierto";

    if (esCruceAbierto) {
      return codigo.startsWith("PCA_") || codigo.startsWith("PCA-");
    }

    return codigo.startsWith("PC_") || codigo.startsWith("PC-");
  }

  private async _onCreateMatched(): Promise<void> {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    try {
      if (!this.authService.isAuthenticated()) {
        const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
        oRouter?.navTo("RouteLogin");
        return;
      }

    this.bindUserModel();

      oModel.setProperty("/busy", true);
      oModel.setProperty("/editMode", false);
      oModel.setProperty("/reprogramarMode", false);
      oModel.setProperty("/modoProgramada", true);
      oModel.setProperty("/canUsePlanesCruce", true);
      this.incubacionId = null;

      oModel.setProperty("/form", {
        fechaIncubacion: null,
        fechaPreNacimiento: null,
        fechaEclosion: null,
        estado: "PROGRAMADA",
        observacion: "",
        eInputNacNoEcl: false,
        canUsePlanesCruce: true,
        detalles: [],
      });

      await this._loadAvesPadrotes();
      await this._loadPlanesCruce();
      void this.cargarSuscripcionResumen();
    } catch (error) {
      MessageBox.error(
        error instanceof Error ? error.message : "No se pudo cargar aves",
      );
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private async _onEditMatched(oEvent: any): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteLogin");
      return;
    }

    this.bindUserModel();

    const oModel = this.getView()?.getModel("view") as JSONModel;
    this.incubacionId = oEvent.getParameter("arguments").id;

    oModel.setProperty("/busy", true);
    oModel.setProperty("/editMode", true);
    oModel.setProperty("/reprogramarMode", false);

    try {
      await this._loadAvesPadrotes();
      await this._loadPlanesCruce();
      const incubacion = await this.service.getById(this.incubacionId!);
      incubacion.eInputNacNoEcl = false;

      const oFechaEclosion = new Date(incubacion.fechaEclosion || 0);
      const oFechaActual = new Date();

      if (oFechaActual >= oFechaEclosion) {
        incubacion.eInputNacNoEcl = true;
      }

      let detalles = await this.prepararDetallesParaFormulario(
        incubacion.detalles || [],
      );

      oModel.setProperty("/modoProgramada", incubacion.estado === "PROGRAMADA");
      oModel.setProperty("/form", {
        codigo: incubacion.codigo,
        fechaIncubacion: new Date(incubacion.fechaIncubacion) || "",
        fechaPreNacimiento: new Date(incubacion.fechaPreNacimiento) || "",
        fechaEclosion: new Date(incubacion.fechaEclosion) || "",
        estado: incubacion.estado || "PROGRAMADA",
        observaciones: incubacion.observaciones || "",
        eInputNacNoEcl: incubacion.eInputNacNoEcl,
        detalles: detalles,
      });

      void this.cargarSuscripcionResumen();
    } catch (error) {
      MessageBox.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la incubación",
      );
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private async _onReprogramarMatched(oEvent: any): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteLogin");
      return;
    }

    this.bindUserModel();

    const oModel = this.getView()?.getModel("view") as JSONModel;
    this.incubacionId = oEvent.getParameter("arguments").id;

    oModel.setProperty("/busy", true);
    oModel.setProperty("/editMode", true);
    oModel.setProperty("/reprogramarMode", true);
    oModel.setProperty("/modoProgramada", true);

    try {
      await this._loadAvesPadrotes();
      await this._loadPlanesCruce();
      const incubacion = await this.service.getById(this.incubacionId!);

      if (incubacion.estado !== "CANCELADA") {
        MessageBox.error(
          "Solo se puede reprogramar una incubación cancelada",
          {
            onClose: () => {
              this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionDetail", {
                id: this.incubacionId,
              });
            },
          },
        );
        return;
      }

      const detalles = await this.prepararDetallesParaFormulario(
        incubacion.detalles || [],
        { reiniciarConteoNacimiento: true },
      );

      if (detalles.length === 0) {
        MessageBox.warning(
          "La incubación no tiene detalles. Agregue al menos una pareja antes de reprogramar.",
        );
      }

      oModel.setProperty("/form", {
        codigo: incubacion.codigo,
        fechaIncubacion: new Date(incubacion.fechaIncubacion) || "",
        fechaPreNacimiento: new Date(incubacion.fechaPreNacimiento) || "",
        fechaEclosion: new Date(incubacion.fechaEclosion) || "",
        estado: incubacion.estado || "CANCELADA",
        observaciones: incubacion.observaciones || "",
        eInputNacNoEcl: false,
        detalles: detalles,
      });

      void this.cargarSuscripcionResumen();
    } catch (error) {
      MessageBox.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la incubación",
      );
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  private async cargarSuscripcionResumen(): Promise<void> {
    const oModel = this.getDashboardModel();
    oModel.setProperty("/accesoSuscripcion", false);

    try {
      const response = await fetch(`${this.baseUrl}/obtenerSuscripcionActual`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok) return;

      const tieneAcceso =
        data.tieneSuscripcion !== false &&
        ["ACTIVA", "CANCELADA"].includes(data.estado) &&
        Number(data.diasRestantes || 0) >= 0;
      const multimediaPremium =
        tieneAcceso && ["PRUEBA", "PREMIUM"].includes(String(data.plan || "").toUpperCase());

      oModel.setProperty("/plan", data.plan || "");
      oModel.setProperty("/estadoSuscripcion", data.estado || "");
      oModel.setProperty("/accesoSuscripcion", tieneAcceso);
      oModel.setProperty("/multimediaPremium", multimediaPremium);
      oModel.refresh(true);
    } catch (error) {
      // El detalle del ave puede mostrarse aunque falle el resumen de suscripcion.
    }
  }

  private getDashboardModel(): JSONModel {
    let oModel = this.getOwnerComponent()?.getModel("dashboard") as JSONModel;

    if (!oModel) {
      oModel = new JSONModel({
        plan: "",
        estadoSuscripcion: "",
        accesoSuscripcion: false
      });
      this.getOwnerComponent()?.setModel(oModel, "dashboard");
    }

    return oModel;
  }

  public onNavBack(): void {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    if (oModel?.getProperty("/reprogramarMode") && this.incubacionId) {
      this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionDetail", {
        id: this.incubacionId,
      });
      return;
    }

    this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
  }

  private _validarDetalles(aDetalles: any[]): boolean {
    for (let i = 0; i < aDetalles.length; i++) {
      const d = aDetalles[i];

      const totalHuevos = Number(d.totalHuevos || 0);
      const fertiles = Number(d.huevosFertiles || 0);
      const nacidos = Number(d.huevosEclosionados || 0);
      const noEclosionados = Number(d.huevosNoEclosionados || 0);

      if (!d.padre_ID && !d.padre?.ID) {
        MessageBox.error(`Debe seleccionar padre y madre en la fila ${i + 1}`);
        return false;
      }

      if (!d.madre_ID && !d.madre?.ID) {
        MessageBox.error(`Debe seleccionar padre y madre en la fila ${i + 1}`);
        return false;
      }

      const padreId = d.padre_ID || d.padre?.ID;
      const madreId = d.madre_ID || d.madre?.ID;

      if (!padreId || !madreId) {
        MessageBox.error(`Debe seleccionar padre y madre en la fila ${i + 1}`);
        return false;
      }

      if (padreId === madreId) {
        MessageBox.error(
          `Padre y madre no pueden ser iguales en la fila ${i + 1}`,
        );
        return false;
      }

      if (fertiles > totalHuevos) {
        MessageBox.error(
          `Fértiles no puede ser mayor a Total Huevos en la fila ${i + 1}`,
        );
        return false;
      }

      if (nacidos > fertiles) {
        MessageBox.error(
          `Nacidos no puede ser mayor a Fértiles en la fila ${i + 1}`,
        );
        return false;
      }

      if (nacidos + noEclosionados > fertiles) {
        MessageBox.error(
          `Nacidos + No eclosionados no puede ser mayor a Fértiles en la fila ${i + 1}`,
        );
        return false;
      }
    }

    return true;
  }

  public async onSave(): Promise<void> {
    const oThat = this;
    const oView = this.getView();
    const oModelLocal = oView?.getModel("view");
    const oODataModel = oView?.getModel(); // OData principal

    try {
      const oData = oModelLocal?.getProperty("/form");

      if (!oData.fechaIncubacion) {
        MessageBox.warning("La fecha de inicio es obligatoria");
        return;
      }

      if (!this.incubacionId) {
        oData.codigo = `INC-${Date.now()}`;
      }

      (oData.detalles || []).forEach((detalle: any) => {
        detalle.huevosNoEclosionados = this.calcularNoEclosionados(
          detalle.huevosFertiles,
          detalle.huevosEclosionados,
        );
      });
      oModelLocal?.setProperty("/form/detalles", oData.detalles || []);

      if (!this._validarDetalles(oData.detalles || [])) {
        return;
      }

      if (!oData.detalles || oData.detalles.length === 0) {
        MessageBox.error("Debe incluir al menos un detalle de incubación");
        return;
      }

      const authUser = localStorage.getItem("auth_user");
      if (!authUser) {
        MessageToast.show("No se encontró la sesión del usuario");
        return;
      }
      const usuario = JSON.parse(authUser);
      const userId = usuario._id;

      const oPayload = {
        codigo: oData.codigo,
        fechaIncubacion: oData.fechaIncubacion
          ? new Date(oData.fechaIncubacion).toISOString()
          : null,
        fechaPreNacimiento: oData.fechaPreNacimiento
          ? new Date(oData.fechaPreNacimiento).toISOString()
          : null,
        fechaEclosion: oData.fechaEclosion
          ? new Date(oData.fechaEclosion).toISOString()
          : null,
        estado: oData.estado,
        observaciones: oData.observaciones,
        usuario_ID: userId,
        detalles: (oData.detalles || []).map(function (d) {
          const huevosFertiles = Number(d.huevosFertiles || 0);
          const huevosEclosionados = Number(d.huevosEclosionados || 0);
          const huevosNoEclosionados = oThat.calcularNoEclosionados(
            huevosFertiles,
            huevosEclosionados,
          );

          return {
            padre_ID: d.padre_ID || null,
            madre_ID: d.madre_ID || null,
            planCruce_ID: d.planCruce_ID || null,
            tipoParentesco: d.tipoParentesco || null,
            nivelRiesgo: d.nivelRiesgo || null,
            porcentaje:
              d.porcentaje === undefined || d.porcentaje === null
                ? null
                : Number(d.porcentaje),
            totalHuevos: Number(d.totalHuevos || 0),
            huevosFertiles,
            huevosEclosionados,
            huevosNoEclosionados,
            usuario_ID: d.usuario_ID || userId,
          };
        }),
      };

      if (oModelLocal?.getProperty("/reprogramarMode") && this.incubacionId) {
        MessageBox.confirm(
          "¿Desea reprogramar esta incubación con los datos indicados?",
          {
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            emphasizedAction: MessageBox.Action.YES,
            onClose: async function (sAction) {
              if (sAction !== MessageBox.Action.YES) {
                return;
              }

              const bResult = await oThat.service.reprogramarConActualizacion(
                oThat.incubacionId!,
                {
                  fechaIncubacion: oPayload.fechaIncubacion!,
                  fechaPreNacimiento: oPayload.fechaPreNacimiento!,
                  fechaEclosion: oPayload.fechaEclosion!,
                  observaciones: oPayload.observaciones,
                  usuario_ID: userId,
                  detalles: (oData.detalles || []).map((d: any) =>
                    oThat.mapDetalleParaReprogramar(d, userId),
                  ),
                },
              );

              if (bResult.success) {
                MessageBox.success("Incubación reprogramada exitosamente", {
                  actions: [MessageBox.Action.OK],
                  emphasizedAction: MessageBox.Action.OK,
                  onClose: function () {
                    oThat
                      .getOwnerComponent()
                      ?.getRouter()
                      .navTo("RouteIncubacionDetail", {
                        id: oThat.incubacionId,
                      });
                  },
                  dependentOn: oThat.getView(),
                });
              } else {
                MessageBox.error(oThat.obtenerMensajeError(bResult));
              }
            },
            dependentOn: this.getView(),
          },
        );
        return;
      }

      if (this.incubacionId) {
        MessageBox.information(
          "¿Está seguro que desea actualizar el registro?",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: async function (sAction) {
              if (sAction === "OK") {
                const bResult = await oThat.service.update(
                  oThat.incubacionId,
                  oPayload,
                );
                if (bResult.success) {
                  MessageBox.success("Incubacion actualizada exitosamente", {
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                      oThat
                        .getOwnerComponent()
                        ?.getRouter()
                        .navTo("RouteIncubacionList");
                    },
                    dependentOn: oThat.getView(),
                  });
                } else {
                  MessageBox.error(oThat.obtenerMensajeError(bResult));
                }
              }
            },
            dependentOn: this.getView(),
          },
        );
      } else {
        MessageBox.information("¿Está seguro que desea crear el registro?", {
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          emphasizedAction: MessageBox.Action.OK,
          onClose: async function (sAction: any) {
            if (sAction === "OK") {
              const bResult = await oThat.service.create(oPayload);
              if (bResult.success) {
                MessageBox.success("¡Incubación creada exitosamente!", {
                  actions: [MessageBox.Action.OK],
                  emphasizedAction: MessageBox.Action.OK,
                  onClose: function (sAction) {
                    oThat
                      .getOwnerComponent()
                      ?.getRouter()
                      .navTo("RouteIncubacionList");
                  },
                  dependentOn: oThat.getView(),
                });
              } else {
                MessageBox.error(oThat.obtenerMensajeError(bResult));
              }
            }
          },
          dependentOn: this.getView(),
        });
      }
    } catch (oError) {
      MessageBox.error("Error al guardar la incubación");
      console.error(oError);
    }
  }

  private mapDetalleParaReprogramar(detalle: any, userId: string): Record<string, any> {
    const item: Record<string, any> = {
      padre_ID: detalle.padre_ID || detalle.padre?.ID || null,
      madre_ID: detalle.madre_ID || detalle.madre?.ID || null,
      totalHuevos: Number(detalle.totalHuevos || 0),
      huevosFertiles: 0,
      huevosEclosionados: 0,
      huevosNoEclosionados: 0,
      usuario_ID: detalle.usuario_ID || userId,
    };

    if (detalle.ID) {
      item.ID = detalle.ID;
    }

    const planCruceId = detalle.planCruce_ID || detalle.planCruce?.ID || "";
    if (planCruceId) {
      item.planCruce_ID = planCruceId;
    }

    if (detalle.tipoParentesco) {
      item.tipoParentesco = detalle.tipoParentesco;
    }

    if (detalle.nivelRiesgo) {
      item.nivelRiesgo = detalle.nivelRiesgo;
    }

    if (detalle.porcentaje !== undefined && detalle.porcentaje !== null) {
      item.porcentaje = Number(detalle.porcentaje);
    }

    return item;
  }

  private obtenerMensajeError(result: any): string {
    const details = result?.error?.details;

    if (Array.isArray(details) && details.length > 0) {
      const mensajes = details
        .map((item: any) => item?.message || item?.rawMessage)
        .filter(Boolean);

      if (mensajes.length > 0) {
        return mensajes.join("\n");
      }
    }

    if (typeof result?.error?.message === "string") {
      return result.error.message;
    }

    if (typeof result?.error === "string") {
      return result.error;
    }

    if (typeof result?.message === "string") {
      return result.message;
    }

    return "No se pudo guardar la incubacion";
  }

  public onAddDetalle(): void {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    const aDetalles = oModel.getProperty("/form/detalles") || [];

    aDetalles.unshift({
      padre_ID: "",
      placaPadre: "",
      nombrePadre: "",
      madre_ID: "",
      placaMadre: "",
      nombreMadre: "",
      planCruce_ID: "",
      planCruceCodigo: "",
      tipoParentesco: "",
      nivelRiesgo: "",
      porcentaje: null,
      decision: "",
      totalHuevos: 0,
      huevosFertiles: 0,
      huevosEclosionados: 0,
      huevosNoEclosionados: 0,
    });

    oModel.setProperty("/form/detalles", aDetalles);
  }

  public onDetalleHuevosChange(oEvent: Event): void {
    const oSource = oEvent.getSource() as Input;
    const oContext = oSource?.getBindingContext("view");

    if (!oContext) {
      return;
    }

    this.recalcularNoEclosionadosEnDetalle(oContext.getPath());
  }

  private recalcularNoEclosionadosEnDetalle(sDetallePath: string): void {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    const huevosFertiles = Number(
      oModel.getProperty(`${sDetallePath}/huevosFertiles`) || 0,
    );
    const huevosEclosionados = Number(
      oModel.getProperty(`${sDetallePath}/huevosEclosionados`) || 0,
    );

    oModel.setProperty(
      `${sDetallePath}/huevosNoEclosionados`,
      this.calcularNoEclosionados(huevosFertiles, huevosEclosionados),
    );
  }

  private calcularNoEclosionados(
    huevosFertiles: number | string,
    huevosEclosionados: number | string,
  ): number {
    const fertiles = Number(huevosFertiles || 0);
    const eclosionados = Number(huevosEclosionados || 0);

    return Math.max(fertiles - eclosionados, 0);
  }

  private aplicarPlanCruceEnDetalle(sPath: string, plan: any): void {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    const nombrePadre = plan.macho?.nombre || plan.macho?.apodo || "";
    const nombreMadre = plan.hembra?.nombre || plan.hembra?.apodo || "";

    oModel.setProperty(`${sPath}/planCruce_ID`, plan.ID);
    oModel.setProperty(
      `${sPath}/codigo`,
      plan.codigoVisual || plan.codigo || "",
    );
    oModel.setProperty(
      `${sPath}/padre_ID`,
      plan.macho_ID || plan.macho?.ID || "",
    );
    oModel.setProperty(`${sPath}/placaPadre`, plan.macho?.placa || "");
    oModel.setProperty(`${sPath}/nombrePadre`, nombrePadre);
    oModel.setProperty(
      `${sPath}/madre_ID`,
      plan.hembra_ID || plan.hembra?.ID || "",
    );
    oModel.setProperty(`${sPath}/placaMadre`, plan.hembra?.placa || "");
    oModel.setProperty(`${sPath}/nombreMadre`, nombreMadre);
    oModel.setProperty(`${sPath}/tipoParentesco`, plan.tipoParentesco || "");
    oModel.setProperty(`${sPath}/nivelRiesgo`, plan.nivelRiesgo || "");
    oModel.setProperty(`${sPath}/porcentaje`, plan.porcentaje ?? null);
    oModel.setProperty(`${sPath}/decision`, plan.decision || "");
    oModel.refresh();
  }

  public formatAveResumen(placa?: string, nombre?: string): string {
    const sPlaca = String(placa || "").trim();
    const sNombre = String(nombre || "").trim();

    if (sPlaca && sNombre) {
      return `${sPlaca} - ${sNombre}`;
    }

    return sPlaca || sNombre || "";
  }

  public async onValueHelpPlanCruce(oEvent: Event): Promise<void> {
    const oSource = oEvent.getSource();
    const oContext = oSource.getBindingContext("view");
    if (!oContext) {
      return;
    }

    this._sDetallePath = oContext.getPath();

    try {
      await this._loadPlanesCruce();

      if (!this._oPlanesCruceDialog) {
        this._oPlanesCruceDialog = (await Fragment.load({
          id: this.getView()?.getId(),
          name: "com.rprincipees.registroavescombate.view.fragments.PlanesCruceDialog",
          controller: this,
        })) as Dialog;

        this.getView()?.addDependent(this._oPlanesCruceDialog);
      }

      this._oPlanesCruceDialog.open();
    } catch (error) {
      MessageBox.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar planes de cruce",
      );
    }
  }

  public onSeleccionarPlanCruceDialog(oEvent: Event): void {
    const oSelectedItem = oEvent.getParameter("listItem");
    const oContext = oSelectedItem?.getBindingContext("planesCruce");

    if (!oContext || !this._sDetallePath) {
      return;
    }

    this.aplicarPlanCruceEnDetalle(this._sDetallePath, oContext.getObject());
    this._sDetallePath = null;
    this._oPlanesCruceDialog?.close();
  }

  public onCerrarPopupPlanesCruce(): void {
    this._oPlanesCruceDialog?.close();
  }

  public onSearchPlanesCruce(oEvent: Event): void {
    const sValue = oEvent.getParameter("newValue") || "";
    const oList = this.byId("listaPlanesCruce") as List;
    const oBinding = oList.getBinding("items");

    if (!oBinding) return;

    if (sValue) {
      oBinding.filter([
        new Filter({
          filters: [
            new Filter("codigoVisual", FilterOperator.Contains, sValue),
            new Filter("descripcionVisual", FilterOperator.Contains, sValue),
            new Filter("busquedaVisual", FilterOperator.Contains, sValue),
            new Filter("tipoParentesco", FilterOperator.Contains, sValue),
            new Filter("nivelRiesgo", FilterOperator.Contains, sValue),
            new Filter("nivelRiesgoTexto", FilterOperator.Contains, sValue),
            new Filter("decision", FilterOperator.Contains, sValue),
            new Filter("decisionTexto", FilterOperator.Contains, sValue),
          ],
          and: false,
        }),
      ]);
    } else {
      oBinding.filter([]);
    }
  }

  public onSeleccionarPlanCruce(oEvent: Event): void {
    const oSelectedItem = oEvent.getParameter("selectedItem");
    const oSource = oEvent.getSource();
    const oDetalleContext = oSource.getBindingContext("view");
    const oPlanContext = oSelectedItem?.getBindingContext("planesCruce");

    if (!oDetalleContext || !oPlanContext) {
      return;
    }

    const sPath = oDetalleContext.getPath();
    const plan = oPlanContext.getObject();
    this.aplicarPlanCruceEnDetalle(sPath, plan);
  }

  public onDeleteDetalle(oEvent: Event): void {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    const aDetalles = oModel.getProperty("/form/detalles") || [];

    const oContext = oEvent.getSource().getBindingContext("view");
    const sPath = oContext.getPath(); // /detalles/0
    const iIndex = parseInt(sPath.split("/")[3], 10);

    aDetalles.splice(iIndex, 1);
    oModel.setProperty("/form/detalles", aDetalles);
  }

  public onNavWelcome(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
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

  public formatearEstado(estado: EstadoIncubacion): string {
    const estados = {
      [EstadoIncubacion.Proceso]: "En proceso",
      [EstadoIncubacion.Programada]: "Programada",
      [EstadoIncubacion.Completada]: "Completada",
      [EstadoIncubacion.Cancelada]: "Cancelada",
    };

    return estados[estado] || estado;
  }
}
