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

import {
  IAve,
  ITableModel,
  EstadoAve,
  ValidationMessages,
} from "../types/Models";

/**
 * @namespace com.rprincipees.registroavescombate.controller
 */
export default class Main extends Controller {
  public onInit(): void {
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

  private initializeMockData(): void {
    const mockAves: IAve[] = [
      {
        id: "1",
        nombre: "El Campeón",
        raza: "Asil",
        fechaNacimiento: new Date("2022-01-15"),
        peso: 2.5,
        color: "Colorado",
        propietario: "Juan Pérez",
        categoria: "Peso Gallo",
        estado: EstadoAve.Activo,
        observaciones: "Ave en excelente condición",
      },
      {
        id: "2",
        nombre: "Relampago",
        raza: "Shamo",
        fechaNacimiento: new Date("2021-12-10"),
        peso: 2.8,
        color: "Negro",
        propietario: "Carlos López",
        categoria: "Peso Gallo",
        estado: EstadoAve.Entrenamiento,
        observaciones: "En preparación para competencia",
      },
      {
        id: "3",
        nombre: "El Guerrero",
        raza: "Kelso",
        fechaNacimiento: new Date("2022-03-20"),
        peso: 2.3,
        color: "Blanco",
        propietario: "María González",
        categoria: "Peso Pluma",
        estado: EstadoAve.Competencia,
        observaciones: "Participando en torneo regional",
      },
    ];

    const oAvesModel = new JSONModel(mockAves);
    this.getView()?.setModel(oAvesModel, "aves");
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

  public onAgregarAve(): void {
    this.openAveDialog();
  }

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
    // Implementar dialog de ave (próximo paso)
    console.log("Opening ave dialog...");
    MessageToast.show("Dialog de ave - Por implementar");
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

  public onAvePress(oEvent: Event): void {
    const oItem = oEvent.getSource();
    const oContext = (oItem as any)?.getBindingContext("aves");
    const oAve = oContext?.getObject() as IAve;

    if (oAve.id) {
      const oRouter = (this.getOwnerComponent() as UIComponent)?.getRouter();
      oRouter?.navTo("aveDetail", {
        aveId: oAve.id,
      });
    }
  }

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
}
