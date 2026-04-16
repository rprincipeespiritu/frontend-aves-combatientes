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

export default class IncubacionForm extends Controller {
  private service = new IncubacionService();
  private incubacionId: string | null = null;
  private _oPadresDialog: Dialog;
  private helpSelected: any;
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";

  public onInit(): void {
    const oModel = new JSONModel({
      busy: false,
      editMode: false,
      aves: [],
      form: {
        fechaInicio: "",
        fechaFinEstimada: "",
        cantidadHuevos: 0,
        cantidadFertiles: 0,
        cantidadNacidos: 0,
        cantidadNoEclosion: 0,
        estado: "PROGRAMADA",
        observacion: "",
        padre_ID: "",
        madre_ID: "",
      },
    });

    this.getView()?.setModel(oModel, "view");

    const oRouter = this.getOwnerComponent()?.getRouter();
    oRouter
      ?.getRoute("RouteIncubacionCreate")
      ?.attachPatternMatched(this._onCreateMatched, this);
    oRouter
      ?.getRoute("RouteIncubacionEdit")
      ?.attachPatternMatched(this._onEditMatched, this);
  }

  private onValueHelpPadre = (): void => {
    const oThat = this;
    oThat.helpSelected = "valueHelpPadre";
    oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Padre");
  };

  private onValueHelpMadre = (): void => {
    const oThat = this;
    oThat.helpSelected = "valueHelpMadre";
    oThat.onAbrirPopupPadres(oThat.helpSelected, "Seleccionar Madre");
  }

  public async onAbrirPopupPadres(
    helpSelected: string,
    sTitulo: string,
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/AvesActivas`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
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

  private async _loadAves(): Promise<void> {
    const oModel = this.getView().getModel("view") as JSONModel;
    const aves = await this.service.listAves();
    oModel.setProperty("/aves", aves);
  }

  private async _onCreateMatched(): Promise<void> {
    const oModel = this.getView().getModel("view") as JSONModel;
    this.incubacionId = null;

    oModel.setProperty("/editMode", false);
    oModel.setProperty("/form", {
      fechaInicio: "",
      fechaFinEstimada: "",
      cantidadHuevos: 0,
      cantidadFertiles: 0,
      cantidadNacidos: 0,
      cantidadNoEclosion: 0,
      estado: "PROGRAMADA",
      observacion: "",
      padre_ID: "",
      madre_ID: "",
    });

    try {
      await this._loadAves();
    } catch (error) {
      MessageBox.error(
        error instanceof Error ? error.message : "No se pudo cargar aves",
      );
    }
  }

  private async _onEditMatched(oEvent: any): Promise<void> {
    const oModel = this.getView().getModel("view") as JSONModel;
    this.incubacionId = oEvent.getParameter("arguments").id;

    oModel.setProperty("/busy", true);
    oModel.setProperty("/editMode", true);

    try {
      await this._loadAves();
      const incubacion = await this.service.getById(this.incubacionId!);

      oModel.setProperty("/form", {
        fechaInicio: incubacion.fechaInicio || "",
        fechaFinEstimada: incubacion.fechaFinEstimada || "",
        cantidadHuevos: incubacion.cantidadHuevos || 0,
        cantidadFertiles: incubacion.cantidadFertiles || 0,
        cantidadNacidos: incubacion.cantidadNacidos || 0,
        cantidadNoEclosion: incubacion.cantidadNoEclosion || 0,
        estado: incubacion.estado || "PROGRAMADA",
        observacion: incubacion.observacion || "",
        padre_ID: incubacion.padre_ID || incubacion.padre?.ID || "",
        madre_ID: incubacion.madre_ID || incubacion.madre?.ID || "",
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

  public async onSave(): Promise<void> {
    const oModel = this.getView().getModel("view") as JSONModel;
    const form = oModel.getProperty("/form") as IIncubacion;

    if (!form.fechaInicio) {
      MessageBox.warning("La fecha de inicio es obligatoria");
      return;
    }

    if (!form.padre_ID) {
      MessageBox.warning("Selecciona el padre");
      return;
    }

    if (!form.madre_ID) {
      MessageBox.warning("Selecciona la madre");
      return;
    }

    if (form.padre_ID === form.madre_ID) {
      MessageBox.warning("El padre y la madre no pueden ser el mismo registro");
      return;
    }

    try {
      oModel.setProperty("/busy", true);

      if (this.incubacionId) {
        await this.service.update(this.incubacionId, form);
        MessageToast.show("Incubación actualizada");
      } else {
        await this.service.create(form);
        MessageToast.show("Incubación creada");
      }

      this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
    } catch (error) {
      MessageBox.error(
        error instanceof Error ? error.message : "No se pudo guardar",
      );
    } finally {
      oModel.setProperty("/busy", false);
    }
  }
}
