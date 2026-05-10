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
      detalles: [],
    };

    oViewModel.setProperty("/form", form);
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

      if (!oModel) {
        return;
      }

      let oInput: Input | undefined;
      if (oThat.helpSelected === "valueHelpPadre") {
        oModel.setProperty(`${this._sDetallePath}/padre_ID`, oAve.ID);
        oModel.setProperty(`${this._sDetallePath}/placaPadre`, oAve.placa);
        oModel.setProperty(`${this._sDetallePath}/nombrePadre`, oAve.nombre);
      } else if (oThat.helpSelected === "valueHelpMadre") {
        oModel.setProperty(`${this._sDetallePath}/madre_ID`, oAve.ID);
        oModel.setProperty(`${this._sDetallePath}/placaMadre`, oAve.placa);
        oModel.setProperty(`${this._sDetallePath}/nombreMadre`, oAve.nombre);
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
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "No se pudo cargar planes de cruce",
      );
    }

    const planes = (data.value || [])
      .filter((plan: any) =>
        ["PROPUESTO", "APROBADO", "EJECUTADO"].includes(plan.estado),
      )
      .map((plan: any) => ({
        ...plan,
        codigoVisual:
          plan.codigo,
        descripcionVisual: `${plan.macho?.placa || ""} ${plan.macho?.nombre || ""} x ${plan.hembra?.placa || ""} ${plan.hembra?.nombre || ""} | ${plan.decision || ""} | ${plan.nivelRiesgo || ""}`,
      }));

    this.getView()?.setModel(new JSONModel(planes), "planesCruce");
  }

  private async _onCreateMatched(): Promise<void> {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    try {
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

      oModel.setProperty("/busy", true);
      oModel.setProperty("/editMode", false);
      this.incubacionId = null;

      oModel.setProperty("/form", {
        fechaIncubacion: null,
        fechaPreNacimiento: null,
        fechaEclosion: null,
        estado: "PROGRAMADA",
        observacion: "",
        eInputNacNoEcl: false,
        detalles: [],
      });

      await this._loadAvesPadrotes();
      await this._loadPlanesCruce();
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

    const sUserData = localStorage.getItem("auth_user");
    if (sUserData) {
      const oUser = JSON.parse(sUserData);
      const oUserModel = new JSONModel(oUser);
      this.getView()?.setModel(oUserModel, "user");
    }

    const oModel = this.getView()?.getModel("view") as JSONModel;
    this.incubacionId = oEvent.getParameter("arguments").id;

    oModel.setProperty("/busy", true);
    oModel.setProperty("/editMode", true);

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

      let detalles = incubacion.detalles;
      for (let index = 0; index < detalles.length; index++) {
        const element = detalles[index];
        element.placaPadre = element.padre.placa;
        element.nombrePadre = element.padre.nombre;
        element.placaMadre = element.madre.placa;
        element.nombreMadre = element.madre.nombre;
        element.planCruce_ID =
          element.planCruce_ID || element.planCruce?.ID || "";
        element.codigo = element.planCruce?.codigo || "";
        element.decision =
          element.decision || element.planCruce?.decision || "";
      }

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

  public onNavBack(): void {
    this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
  }

  private _validarDetalles(aDetalles: any[]): boolean {
    for (let i = 0; i < aDetalles.length; i++) {
      const d = aDetalles[i];

      const totalHuevos = Number(d.totalHuevos || 0);
      const fertiles = Number(d.fertiles || 0);
      const nacidos = Number(d.nacidos || 0);
      const noEclosionados = Number(d.noEclosionados || 0);

      if (!d.padre_ID || !d.madre_ID) {
        MessageBox.error(
          `Debe seleccionar un plan de cruce en la fila ${i + 1}`,
        );
        return false;
      }

      if (d.padre_ID === d.madre_ID) {
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

      oData.codigo = `INC-${Date.now()}`;

      if (!this._validarDetalles(oData.detalles || [])) {
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
            huevosFertiles: Number(d.huevosFertiles || 0),
            huevosEclosionados: Number(d.huevosEclosionados || 0),
            huevosNoEclosionados: Number(d.huevosNoEclosionados || 0),
            usuario_ID: d.usuario_ID || userId,
          };
        }),
      };

      if (this.incubacionId) {
        MessageBox.information(
          "¿Está seguro que desea actualizar el registro?",
          {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: async function (sAction) {
              if (sAction === "OK") {
                const bResult = await oThat.service.update(oThat.incubacionId, oPayload);
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

  private obtenerMensajeError(result: any): string {
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

    aDetalles.push({
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

  private aplicarPlanCruceEnDetalle(sPath: string, plan: any): void {
    const oModel = this.getView()?.getModel("view") as JSONModel;

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
    oModel.setProperty(`${sPath}/nombrePadre`, plan.macho?.nombre || "");
    oModel.setProperty(
      `${sPath}/madre_ID`,
      plan.hembra_ID || plan.hembra?.ID || "",
    );
    oModel.setProperty(`${sPath}/placaMadre`, plan.hembra?.placa || "");
    oModel.setProperty(`${sPath}/nombreMadre`, plan.hembra?.nombre || "");
    oModel.setProperty(`${sPath}/tipoParentesco`, plan.tipoParentesco || "");
    oModel.setProperty(`${sPath}/nivelRiesgo`, plan.nivelRiesgo || "");
    oModel.setProperty(`${sPath}/porcentaje`, plan.porcentaje ?? null);
    oModel.setProperty(`${sPath}/decision`, plan.decision || "");
    oModel.refresh();
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
            new Filter("tipoParentesco", FilterOperator.Contains, sValue),
            new Filter("nivelRiesgo", FilterOperator.Contains, sValue),
            new Filter("decision", FilterOperator.Contains, sValue),
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
    const iIndex = parseInt(sPath.split("/")[2], 10);

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
