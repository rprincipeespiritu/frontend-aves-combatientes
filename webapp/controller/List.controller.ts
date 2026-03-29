import UIComponent from "sap/ui/core/UIComponent";
import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Table from "sap/m/Table";
import SearchField from "sap/m/SearchField";
import ComboBox from "sap/m/ComboBox";
import Event from "sap/ui/base/Event";
import ColumnListItem from "sap/m/ColumnListItem";
import View from "sap/ui/core/mvc/View";
import Fragment from "sap/ui/core/Fragment";
import Dialog from "sap/m/Dialog";
import Router from "sap/ui/core/routing/Router";
import { AuthService } from "../services/AuthService";

import {
  IAve,
  ITableModel,
  EstadoAve,
  ValidationMessages,
  SexoAve,
  CategoriaAve,
} from "../types/Models";


/**
 * @namespace com.rprincipees.registroavescombate.controller
 */
export default class List extends Controller {
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
  private authService: AuthService;
  public onInit(): void {
    this.authService = AuthService.getInstance();
    console.log("Main Controller initialized with TypeScript");

    // Crear modelo para el estado de la tabla
    const oTableModel = new JSONModel({
      selectedIndex: -1,
      busy: false,
      count: 0,
    } as ITableModel);

    this.getView()?.setModel(oTableModel, "table");

    // Crear modelo de datos mock (reemplazar con OData)
    this.initializeMockData();

    // Cargar datos de referencia
    this.loadReferenceData();
  }

  private async initializeMockData(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/Aves`, {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          "Content-Type": "application/json",
        },
      });

      const mockAves: IAve[] = await response.json();
      const oAvesModel = new JSONModel(mockAves)
      this.getView()?.setModel(oAvesModel, "aves");
    } catch (error) { }
  }

  private loadReferenceData(): void {
    // Datos de referencia para combos
    const razas = [
      { id: "asil", nombre: "Asil" },
      { id: "shamo", nombre: "Shamo" },
      { id: "kelso", nombre: "Kelso" },
      { id: "hatch", nombre: "Hatch" },
      { id: "sweater", nombre: "Sweater" },
    ];

    const categorias = [
      { id: "pluma", nombre: "Peso Pluma", pesoMin: 2.0, pesoMax: 2.4 },
      { id: "gallo", nombre: "Peso Gallo", pesoMin: 2.5, pesoMax: 2.9 },
      { id: "pesado", nombre: "Peso Pesado", pesoMin: 3.0, pesoMax: 3.5 },
    ];

    const propietarios = [
      { id: "1", nombre: "Juan Pérez" },
      { id: "2", nombre: "Carlos López" },
      { id: "3", nombre: "María González" },
      { id: "4", nombre: "Pedro Rodríguez" },
    ];

    this.getView()?.setModel(new JSONModel(razas), "razas");
    this.getView()?.setModel(new JSONModel(categorias), "categorias");
    this.getView()?.setModel(new JSONModel(propietarios), "propietarios");
  }

  // === OPERACIONES CRUD ===

  // public async onAgregarAve(): Promise<void> {
  //   //this.openAveDialog();
  //   const oView = this.getView() as View;

  //   if (!this._oAddBirdDialog) {
  //     try {
  //       const oDialog = (await Fragment.load({
  //         id: oView.getId(),
  //         name: "com.rprincipees.registroavescombate.view.fragments.AddBirdDialog",
  //         controller: this,
  //       })) as Dialog;

  //       this._oAddBirdDialog = oDialog;
  //       oView.addDependent(this._oAddBirdDialog);
  //       //this._resetForm();
  //       this._oAddBirdDialog.open();
  //     } catch (error) {
  //       MessageBox.error(
  //         "Error al cargar el diálogo: " + (error as Error).message
  //       );
  //     }
  //   } else {
  //     //this._resetForm();
  //     this._oAddBirdDialog.open();
  //   }
  // }

  public onEditarAve(): void {
    const oTable = this.byId("avesTable") as Table;
    const oSelectedItem = oTable.getSelectedItem();

    if (oSelectedItem) {
      const oContext = oSelectedItem.getBindingContext("aves");
      this.openAveDialog(oContext);
    } else {
      MessageToast.show("Por favor selecciona un ave para editar");
    }
  }

  public onEditarAveInline(oEvent: Event): void {
    const oSource = oEvent.getSource();
    const oContext = (oSource as any).getBindingContext("aves");
    this.openAveDialog(oContext);
  }

  public onEliminarAve(): void {
    const oTable = this.byId("avesTable") as Table;
    const oSelectedItem = oTable.getSelectedItem();

    if (oSelectedItem) {
      const oContext = oSelectedItem.getBindingContext("aves");
      this.eliminarAve(oContext);
    } else {
      MessageToast.show("Por favor selecciona un ave para eliminar");
    }
  }

  public onEliminarAveInline(oEvent: Event): void {
    const oSource = oEvent.getSource();
    const oContext = (oSource as any).getBindingContext("aves");
    this.eliminarAve(oContext);
  }

  private eliminarAve(oContext: any): void {
    const oAve = oContext.getObject() as IAve;
    const sNombreAve = oAve.nombre;

    MessageBox.confirm(
      `¿Estás seguro de que quieres eliminar el ave '${sNombreAve}'?`,
      {
        title: "Eliminar Ave",
        onClose: (oAction: string) => {
          if (oAction === MessageBox.Action.OK) {
            this.performEliminar(oAve);
          }
        },
      }
    );
  }

  private performEliminar(ave: IAve): void {
    try {
      const oAvesModel = this.getView()?.getModel("aves") as JSONModel;
      const aAves = oAvesModel.getData() as IAve[];

      const updatedAves = aAves.filter((a) => a.id !== ave.id);
      oAvesModel.setData(updatedAves);

      MessageToast.show("Ave eliminada exitosamente");
    } catch (error) {
      console.error("Error eliminando ave:", error);
      MessageBox.error("Error al eliminar el ave");
    }
  }

  private openAveDialog(oContext?: any): void {
    var oView = this.getView();

    // Crear el diálogo si no existe
    if (!this._oAddBirdDialog) {
      Fragment.load({
        id: oView.getId(),
        name: "com.rprincipees.registroavescombate.view.fragments.AddBirdDialog",
        controller: this,
      }).then(
        function (oDialog) {
          this._oAddBirdDialog = oDialog;
          oView.addDependent(this._oAddBirdDialog);
          //this._resetForm();
          this._oAddBirdDialog.open();
        }.bind(this)
      );
    } else {
      //this._resetForm();
      this._oAddBirdDialog.open();
    }
  }

  // === BÚSQUEDA Y FILTROS ===

  public onBuscar(oEvent: Event): void {
    const oSearchField = oEvent.getSource() as SearchField;
    const sQuery = oSearchField?.getValue() || "";
    this.filtrarTabla(sQuery);
  }

  public onFiltrarRaza(oEvent: Event): void {
    const oComboBox = oEvent.getSource() as ComboBox;
    const sSelectedKey = oComboBox?.getSelectedKey() || "";
    this.filtrarTablaPorRaza(sSelectedKey);
  }

  public onFiltrarCategoria(oEvent: Event): void {
    const oComboBox = oEvent.getSource() as ComboBox;
    const sSelectedKey = oComboBox?.getSelectedKey() || "";

    this.filtrarTablaPorCategoria(sSelectedKey);
  }

  private filtrarTabla(terminoBusqueda: string): void {
    const oTable = this.byId("avesTable") as Table;
    const oBinding = oTable.getBinding("items");

    const aFilters: Filter[] = [];
    if (terminoBusqueda) {
      const oFilter = new Filter({
        filters: [
          new Filter("nombre", FilterOperator.Contains, terminoBusqueda),
          new Filter("propietario", FilterOperator.Contains, terminoBusqueda),
          new Filter("raza", FilterOperator.Contains, terminoBusqueda),
        ],
        and: false,
      });
      aFilters.push(oFilter);
    }

    (oBinding as any)?.filter(aFilters);
  }

  private filtrarTablaPorRaza(razaId: string): void {
    const oTable = this.byId("avesTable") as Table;
    const oBinding = oTable.getBinding("items");

    const aFilters: Filter[] = [];
    if (razaId) {
      aFilters.push(new Filter("raza", FilterOperator.EQ, razaId));
    }

    (oBinding as any)?.filter(aFilters);
  }

  private filtrarTablaPorCategoria(categoriaId: string): void {
    const oTable = this.byId("avesTable") as Table;
    const oBinding = oTable.getBinding("items");

    const aFilters: Filter[] = [];
    if (categoriaId) {
      aFilters.push(new Filter("categoria", FilterOperator.EQ, categoriaId));
    }

    (oBinding as any)?.filter(aFilters);
  }

  public onLimpiarFiltros(): void {
    const oSearchField = this.byId("searchField") as SearchField;
    const oRazaFilter = this.byId("razaFilter") as ComboBox;
    const oCategoriaFilter = this.byId("categoriaFilter") as ComboBox;

    oSearchField?.setValue("");
    oRazaFilter?.setSelectedKey("");
    oCategoriaFilter?.setSelectedKey("");

    const oTable = this.byId("avesTable") as Table;
    const oBinding = oTable.getBinding("items");
    (oBinding as any)?.filter([]);
  }

  // === NAVEGACIÓN ===

  // public onAvePress(oEvent: Event): void {
  //   const oItem = oEvent.getSource();
  //   const oContext = (oItem as any)?.getBindingContext("aves");
  //   const oAve = oContext?.getObject() as IAve;

  //   if (oAve.id) {
  //     const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
  //     oRouter?.navTo("aveDetail", {
  //       aveId: oAve.id,
  //     });
  //   }
  // }

  // === UTILIDADES ===

  public onRefrescar(): void {
    // Recargar datos
    this.initializeMockData();
    MessageToast.show("Datos actualizados");
  }

  public onSelectionChange(): void {
    const oTable = this.byId("avesTable") as Table;
    const oTableModel = this.getView()?.getModel("table") as JSONModel;
    const iSelectedIndex = oTable.getSelectedItems().length > 0 ? 0 : -1;

    oTableModel.setProperty("/selectedIndex", iSelectedIndex);
  }

  public formatearCategoria(categoria: CategoriaAve): string {
    const categorias = {
      [CategoriaAve.Bueno]: "Bueno",
      [CategoriaAve.Excelente]: "Excelente",
      [CategoriaAve.Extraordinario]: "Extraordinario",
    };

    return categorias[categoria] || categoria;
  }

  public formatearSexo(sexo: SexoAve): string {
    const estados = {
      [SexoAve.Hembra]: "Gallina",
      [SexoAve.Macho]: "Gallo",
    };

    return estados[sexo] || sexo;
  }

  public formatearEstado(estado: EstadoAve): string {
    const estados = {
      [EstadoAve.Activo]: "Activo",
      [EstadoAve.Inactivo]: "Inactivo",
      [EstadoAve.Entrenamiento]: "En Entrenamiento",
      [EstadoAve.Competencia]: "En Competencia",
      [EstadoAve.Retirado]: "Retirado",
    };

    return estados[estado] || estado;
  }

  public formatearFecha(fecha: Date): string {
    if (!fecha) {
      return "";
    }

    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(fecha));
  }

  public formatearPeso(peso: number): string {
    if (!peso) {
      return "";
    }
    return `${peso} kg`;
  }

  public onNavBack(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteWelcome");
  }

  public async onLogout(): Promise<void> {
    try {
      await this.authService.logout();
      MessageToast.show("Sesión cerrada exitosamente");

      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter() as Router;
      oRouter?.navTo("RouteLogin");

      // Verificar que el método existe antes de llamarlo
      const oOwner = this.getOwnerComponent() as any;
      if (oOwner && typeof oOwner.updateUserModel === 'function') {
        oOwner.updateUserModel();
      }

    } catch (error) {
      console.error("Error en logout:", error);
      MessageToast.show("Error cerrando sesión");
    }
  }
  // Cambia onAgregarAve para navegar a la vista
  public onAgregarAve(): void {
    const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
    oRouter?.navTo("RouteAveCreate");
  }

  // Cambia onAvePress para navegar al detalle
  public onAvePress(oEvent: Event): void {
    const oItem = oEvent.getSource();
    const oContext = (oItem as any)?.getBindingContext("aves");
    const oAve = oContext?.getObject() as any;
    if (oAve?.ID) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("RouteAveDetail", { aveId: oAve.ID });
    }
  }

}
