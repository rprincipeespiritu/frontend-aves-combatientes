import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import UIComponent from "sap/ui/core/UIComponent";
import IncubacionService from "../services/IncubacionService";

export default class IncubacionList extends Controller {
  service: IncubacionService;  

  public onInit(): void {
    this.service = IncubacionService.getInstance();

    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter
      ?.getRoute("RouteIncubacionList")
      ?.attachPatternMatched(this.onRouteMatched, this);
  }

  private onRouteMatched = (oEvent: any): void => {
    const oModel = new JSONModel({
      busy: false,
      incubaciones: [],
    });

    this.getView()?.setModel(oModel, "view");
    void this._loadData();
  };

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
    const oItem = oContext.getObject() as IIncubacion;
    this.getOwnerComponent()?.getRouter().navTo("RouteIncubacionEdit", {
      id: oItem.ID,
    });
  }

  public onDelete(oEvent: any): void {
    const oContext = oEvent.getSource().getBindingContext("view");
    const oItem = oContext.getObject() as IIncubacion;

    MessageBox.confirm(`¿Eliminar la incubación ${oItem.codigo}?`, {
      onClose: async (sAction: string) => {
        if (sAction !== MessageBox.Action.OK) {
          return;
        }

        try {
          await this.service.remove(oItem.ID!);
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

  public onRefresh(): void {
    void this._loadData();
  }

  public onNavBack(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteWelcome");
  }
}
