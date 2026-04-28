import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";

export default class PlanesCruce extends Controller {

    public onInit(): void {
        const oModel = new JSONModel({
            data: []
        });

        this.getView()?.setModel(oModel, "planes");

        this.cargarPlanes();
    }

    private async cargarPlanes(): Promise<void> {
        const oModel = this.getView()?.getModel("planes") as JSONModel;

        try {
            const token = localStorage.getItem("token");

            const response = await fetch(
                "/api/avecombatiente/PlanesCruce?$expand=macho,hembra",
                {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            oModel.setProperty("/data", data.value || []);

        } catch (error) {
            MessageBox.error("Error al cargar planes de cruce.");
        }
    }

    public onSelectPlan(oEvent: any): void {
        const oItem = oEvent.getParameter("listItem");
        const oContext = oItem.getBindingContext("planes");

        const oPlan = oContext.getObject();

        MessageBox.information(
            `Detalle del cruce:
            
Macho: ${oPlan.macho?.placa}
Hembra: ${oPlan.hembra?.placa}

Parentesco: ${oPlan.tipoParentesco}
Riesgo: ${oPlan.nivelRiesgo}

Recomendación:
${oPlan.recomendacion}`
        );
    }

    public onNuevoPlan(): void {
        this.getOwnerComponent().getRouter().navTo("lineaGallos");
    }

    public onNavBack(): void {
        history.back();
    }
}