import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";
import Router from "sap/m/routing/Router";

export default class PlanesCruce extends Controller {
  public onInit(): void {
    const oModel = new JSONModel({
      data: [],
    });

    this.getView()?.setModel(oModel, "planes");

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

      oModel.setProperty("/data", (data.value || []).map((plan: any) => ({
        ...plan,
        codigo: plan.codigo || `PC-${plan.macho?.placa || "M"}-${plan.hembra?.placa || "H"}`
      })));
    } catch (error) {
      MessageBox.error("Error al cargar planes de cruce.");
    }
  }

  public onSelectPlan(oEvent: any): void {
    const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
    const oContext = oItem?.getBindingContext("planes");

    if (!oContext) {
      MessageBox.warning("No se pudo obtener el detalle del plan seleccionado.");
      return;
    }

    const oPlan = oContext.getObject();

    MessageBox.information(
      `Codigo: ${oPlan.codigo || ""}

Detalle del cruce:
                    
        Macho: ${oPlan.macho?.placa}
        Hembra: ${oPlan.hembra?.placa}

        Parentesco: ${oPlan.tipoParentesco}
        Riesgo: ${oPlan.nivelRiesgo}

        Recomendación:
        ${oPlan.recomendacion}`
    );
  }

  public onNuevoPlan(): void {
    const oRouter = (
      this.getOwnerComponent() as UIComponent
    )?.getRouter() as Router;
    oRouter?.navTo("RouteLineaGallos");
  }

  public onNavBack(): void {
    history.back();
  }
}
