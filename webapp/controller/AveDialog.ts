import BaseObject from "sap/ui/base/Object";
import Fragment from "sap/ui/core/Fragment";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import Dialog from "sap/m/Dialog";
import Controller from "sap/ui/core/mvc/Controller";
import Context from "sap/ui/model/Context";

import { IAve, IRegistroDialogData, EstadoAve, DialogMode, ValidationMessages } from "../types/Models";

export default class AveDialog extends BaseObject {
    private oParentController: Controller;
    private oView: any;
    private oDialog: Dialog | null = null;
    private oContext: Context | null = null;

    constructor(parentController: Controller) {
        super();
        this.oParentController = parentController;
        this.oView = parentController.getView();
    }

    public async open(context?: Context): Promise<void> {
        this.oContext = context || null;
        
        if (!this.oDialog) {
            try {
                const oFragment = await Fragment.load({
                    name: "com.rprincipees.registroavescombate.fragment.AveDialog",
                    controller: this
                });
                
                this.oDialog = oFragment as Dialog;
                this.oView.addDependent(this.oDialog);
                this.initializeDialog();
                this.oDialog.open();
            } catch (error) {
                console.error("Error loading dialog fragment:", error);
                MessageBox.error("Error al cargar el diálogo");
            }
        } else {
            this.initializeDialog();
            this.oDialog.open();
        }
    }

    private initializeDialog(): void {
        if (!this.oDialog) return;

        const oDialogData: IRegistroDialogData = this.createDialogData();
        const oDialogModel = new JSONModel(oDialogData);
        
        this.oDialog.setModel(oDialogModel, "dialog");
        
        // Obtener modelos de referencia del controlador padre
        const oRazasModel = this.oView.getModel("razas");
        const oCategoriasModel = this.oView.getModel("categorias");
        const oPropietariosModel = this.oView.getModel("propietarios");
        
        if (oRazasModel) this.oDialog.setModel(oRazasModel, "razas");
        if (oCategoriasModel) this.oDialog.setModel(oCategoriasModel, "categorias");
        if (oPropietariosModel) this.oDialog.setModel(oPropietariosModel, "propietarios");
        
        // Crear modelo de estados
        const aEstados = Object.values(EstadoAve).map(estado => ({
            key: estado,
            text: this.formatearEstado(estado)
        }));
        
        this.oDialog.setModel(new JSONModel(aEstados), "estados");
    }

    private createDialogData(): IRegistroDialogData {
        if (this.oContext) {
            // Modo edición
            const oData = this.oContext.getObject() as IAve;
            return {
                mode: DialogMode.Edit,
                title: "Editar Ave",
                ave: { ...oData }
            };
        } else {
            // Modo creación
            return {
                mode: DialogMode.Create,
                title: "Agregar Nueva Ave",
                ave: this.createEmptyAve()
            };
        }
    }

    private createEmptyAve(): IAve {
        return {
            nombre: "",
            raza: "",
            fechaNacimiento: new Date(),
            peso: 0,
            color: "",
            propietario: "",
            categoria: "",
            estado: EstadoAve.Activo,
            observaciones: ""
        };
    }

    public onGuardar(): void {
        if (!this.oDialog) return;

        const oDialogModel = this.oDialog.getModel("dialog") as JSONModel;
        const oData = oDialogModel.getData() as IRegistroDialogData;
        
        if (!this.validarEntrada(oData.ave)) {
            return;
        }
        
        try {
            if (oData.mode === DialogMode.Create) {
                this.crearAve(oData.ave);
            } else {
                this.actualizarAve(oData.ave);
            }
        } catch (error) {
            console.error("Error guardando ave:", error);
            MessageBox.error(`Error al guardar el ave: ${(error as Error).message}`);
        }
    }

    private validarEntrada(ave: IAve): boolean {
        // Validar nombre
        if (!ave.nombre || ave.nombre.trim() === "") {
            MessageBox.error(ValidationMessages.NOMBRE_REQUERIDO);
            return false;
        }
        
        // Validar raza
        if (!ave.raza || ave.raza.trim() === "") {
            MessageBox.error(ValidationMessages.RAZA_REQUERIDA);
            return false;
        }
        
        // Validar peso
        if (!ave.peso || ave.peso <= 0) {
            MessageBox.error(ValidationMessages.PESO_INVALIDO);
            return false;
        }
    }    
}