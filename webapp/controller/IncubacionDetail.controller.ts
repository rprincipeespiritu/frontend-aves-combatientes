import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import IncubacionService from "../services/IncubacionService";
import formatter from "../model/formatter";
import { EstadoIncubacion } from "../types/Models";
import Input from "sap/m/Input";
import BusyIndicator from "sap/ui/core/BusyIndicator";
import Button from "sap/m/Button";
import Label from "sap/m/Label";
import VBox from "sap/m/VBox";
import Dialog from "sap/m/Dialog";
import MessageToast from "sap/m/MessageToast";
import TextArea from "sap/m/TextArea";

export default class IncubacionDetail extends Controller {
  public formatter = formatter;
  private service = new IncubacionService();
  private incubacionId: string = "";
  private baseUrl: string = "http://localhost:4004/api/avecombatiente";

  public onInit(): void {
    const oModel = new JSONModel({
      busy: false,
      incubacion: {}
    });

    this.getView()?.setModel(oModel, "view");

    this.getOwnerComponent()
      ?.getRouter()
      .getRoute("RouteIncubacionDetail")
      ?.attachPatternMatched(this._onRouteMatched, this);
  }

  private _onRouteMatched = async (oEvent: sap.ui.base.Event): Promise<void> => {
    const args = oEvent.getParameter("arguments") as { id?: string };
    this.incubacionId = args.id || "";

    if (!this.incubacionId) {
      MessageBox.error("No se recibió el ID de la incubación");
      return;
    }

    await this._loadIncubacion();
  };

  private async _loadIncubacion(): Promise<void> {
    const oModel = this.getView()?.getModel("view") as JSONModel;
    oModel.setProperty("/busy", true);

    try {
      const incubacion = await this.service.getById(this.incubacionId);

      let detalles = incubacion.detalles;
      for (let index = 0; index < detalles.length; index++) {
        const element = detalles[index];
        element.placaPadre = element.padre.placa;
        element.nombrePadre = element.padre.nombre;
        element.placaMadre = element.madre.placa;
        element.nombreMadre = element.madre.nombre;

      }

      oModel.setProperty("/incubacion", {
        ID: incubacion.ID,
        codigo: incubacion.codigo || "",
        fechaIncubacion: new Date(incubacion.fechaIncubacion) || "",
        fechaPreNacimiento: new Date(incubacion.fechaPreNacimiento) || "",
        fechaEclosion: new Date(incubacion.fechaEclosion) || "",
        fechaFinIncubacion: new Date(incubacion.fechaFinIncubacion) || "",
        estado: incubacion.estado || "PROGRAMADA",
        observaciones: incubacion.observaciones || "",
        motivoCancelacion: incubacion.motivoCancelacion || "",
        detalles: incubacion.detalles
      });

    } catch (error) {
      MessageBox.error(error instanceof Error ? error.message : "No se pudo cargar la incubación");
    } finally {
      oModel.setProperty("/busy", false);
    }
  }

  public onNavBack = (): void => {
    this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
  };

  public onEdit = (): void => {
    this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionEdit", {
      id: this.incubacionId
    });
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

  public onConfirmarIniciar(oEvent: any): void {
    const oThat = this;
    const oData = oThat.getView()?.getModel("view").getProperty("/incubacion");

    if (!oData?.ID) {
      MessageBox.error("No se encontró el ID de la incubación");
      return;
    }

    if (oData.estado !== "PROGRAMADA") {
      MessageBox.error("Solo se puede iniciar una incubación en estado PROGRAMADA");
      return;
    }

    if (!oData.fechaIncubacion) {
      MessageBox.error("La incubación no tiene fecha de incubación");
      return;
    }

    const oFechaIncubacion = new Date(oData.fechaIncubacion);
    const oFechaActual = new Date();

    if (isNaN(oFechaIncubacion.getTime())) {
      MessageBox.error("La fecha de incubación no es válida");
      return;
    }

    if (oFechaIncubacion > oFechaActual) {
      MessageBox.error("La fecha de incubación no debe ser mayor a la fecha actual");
      return;
    }

    MessageBox.confirm("¿Desea iniciar esta incubación?", {
      actions: [MessageBox.Action.YES, MessageBox.Action.NO],
      onClose: async (sAction: string) => {
        if (sAction === MessageBox.Action.YES) {
          await oThat.onIniciarIncubacion(oEvent);
        }
      }
    });
  }

  private async onIniciarIncubacion(oEvent: any): Promise<void> {

    BusyIndicator.show(0);

    try {
      const oThat = this;
      const oData = oThat.getView()?.getModel("view").getProperty("/incubacion");

      const sId = oData.ID;

      const sUrl = `${this.baseUrl}/Incubaciones(${sId})/iniciar`;

      const response = await fetch(sUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({})
      });

      BusyIndicator.hide();
      if(!response.ok){
        let result = await response.json();
        MessageBox.error(result?.error?.message);
        return;
      }

      MessageBox.success("¡Incubación iniciada correctamente!", {
        actions: [MessageBox.Action.OK],
        emphasizedAction: MessageBox.Action.OK,
        onClose: function (sAction: string) {
          oThat.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
        },
        dependentOn: oThat.getView()
      });

    } catch (error: any) {
      BusyIndicator.hide();
      MessageBox.error(error.message || "No se pudo iniciar la incubación");
      console.error("Error al iniciar incubación:", error);
    }
  }

  public onConfirmarFinalizar(oEvent: Event): void {
    const oThat = this;

    const oTextAreaObservacion = new TextArea({
      width: "100%",
      rows: 4,
      growing: false,
      placeholder: "Observación(Opcional)"
    });

    const oDialog = new Dialog({
      title: "Finalizar incubación",
      type: "Message",
      contentWidth: "auto",
      contentHeight: "auto",
      horizontalScrolling: false,
      verticalScrolling: true,
      content: [
        new VBox({
          width: "100%",
          renderType: "Bare",
          items: [

            new Label({ text: "¿Seguro que desea Finalizar la Incubación; sino revise la opción de Edición?" }).addStyleClass("sapUiSmallMarginTop"),

            new Label({ text: "Observación" }).addStyleClass("sapUiSmallMarginTop"),
            oTextAreaObservacion
          ]
        })
      ],
      beginButton: new Button({
        text: "Aceptar",
        type: "Emphasized",
        press: async function () {

          const sObservacion = oTextAreaObservacion.getValue().trim();



          oDialog.close();
          await oThat._finalizarIncubacion(
              oEvent,
              sObservacion
          );
        }
      }),
      endButton: new Button({
        text: "Cerrar",
        press: function () {
          oDialog.close();
        }
      }),
      afterClose: function () {
        oDialog.destroy();
      }
    });

    oDialog.open();
  }

  private async _finalizarIncubacion(
      oEvent: Event,
      observacion: string
  ): Promise<void> {
    try {

      const oThat = this;
      const oData = oThat.getView()?.getModel("view").getProperty("/incubacion");
      const sId = oData?.ID;

      if (!sId) {
        MessageBox.error("No se encontró el ID de la incubación");
        return;
      }

      if (oData.estado !== "EN_PROCESO") {
        MessageBox.error("Solo se puede finalizar una incubación en estado \"En proceso\"");
        return;
      }

      BusyIndicator.show(0);

      const sToken = localStorage.getItem("token");

      const response = await fetch(`${oThat.baseUrl}/Incubaciones('${sId}')/finalizar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          observacion
        })
      });

      BusyIndicator.hide();

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.error?.message || "No se pudo cancelar la incubación");
      }

      MessageBox.success("¡Incubación finalizada correctamente!", {
        actions: [MessageBox.Action.OK],
        emphasizedAction: MessageBox.Action.OK,
        onClose: function (sAction: string) {
          oThat.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
        },
        dependentOn: oThat.getView()
      });

      //this._recargarDetalleIncubacion();
    } catch (error: any) {
      BusyIndicator.hide();
      MessageBox.error(error.message || "Error al finalizar la incubación");
    }
  }

  public onConfirmarCancelar(oEvent: Event): void {
    const oThat = this;

    const oInput = new Input({
      width: "100%",
      placeholder: "Ingrese el motivo de cancelación"
    });

    const oDialog = new Dialog({
      title: "Cancelar incubación",
      type: "Message",
      contentWidth: "25rem",
      content: [
        new VBox({
          items: [
            new Label({
              text: "Motivo de cancelación",
              labelFor: oInput
            }),
            oInput
          ]
        }).addStyleClass("sapUiSmallMargin")
      ],
      beginButton: new Button({
        text: "Aceptar",
        type: "Emphasized",
        press: async function () {
          const sMotivo = oInput.getValue().trim();

          if (!sMotivo) {
            MessageBox.error("Debe ingresar un motivo de cancelación");
            return;
          }

          oDialog.close();
          await oThat._cancelarIncubacion(oEvent, sMotivo);
        }
      }),
      endButton: new Button({
        text: "Cerrar",
        press: function () {
          oDialog.close();
        }
      }),
      afterClose: function () {
        oDialog.destroy();
      }
    });

    oDialog.open();
  }

  private async _cancelarIncubacion(oEvent: any, sMotivo: string): Promise<void> {
    try {
      const oThat = this;
      const oData = oThat.getView()?.getModel("view").getProperty("/incubacion");

      const sId = oData.ID;

      const response = await fetch(`${oThat.baseUrl}/Incubaciones('${sId}')/cancelar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          observacion: sMotivo
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.error?.message || "No se pudo cancelar la incubación");
      }

      MessageBox.success("¡Incubación cancelada correctamente!", {
        actions: [MessageBox.Action.OK],
        emphasizedAction: MessageBox.Action.OK,
        onClose: function (sAction: string) {
          oThat.getOwnerComponent()?.getRouter().navTo("RouteIncubacionList");
        },
        dependentOn: oThat.getView()
      });
      
    } catch (error: any) {
      MessageBox.error(error.message || "Error al cancelar la incubación");
    }
  }

}