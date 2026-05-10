// Interfaces para registro de aves de combate

export interface IAve {
    id?: string;
    placa?: string;
    nombre: string;
    raza: string;
    fechaNacimiento: Date;
    peso: number;
    color: string;
    propietario: string;
    categoria: string;
    estado: EstadoAve;
    observaciones?: string;
    fotoUrl?: string;
    created?: Date;
    modified?: Date;
}

export interface IRaza {
    id: string;
    nombre: string;
    origen: string;
    descripcion?: string;
    caracteristicas: string[];
}

export interface IPropietario {
    id: string;
    nombre: string;
    apellidos: string;
    documento: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    activo: boolean;
}

export interface ICategoria {
    id: string;
    nombre: string;
    pesoMinimo: number;
    pesoMaximo: number;
    descripcion?: string;
}

export interface IRegistroDialogData {
    mode: "create" | "edit";
    title: string;
    ave: IAve;
}

export interface ITableModel {
    selectedIndex: number;
    busy: boolean;
    count: number;
}

export interface IFiltros {
    busqueda: string;
    raza?: string;
    categoria?: string;
    propietario?: string;
    estado?: EstadoAve;
}

// Enums
export enum CategoriaAve {
    Bueno = "BUENO",
    Excelente = "EXCELENTE",
    Extraordinario = "EXTRAORDINARIO"
}

export enum SexoAve {
    Hembra = "H",
    Macho = "M"
}

export enum EstadoAve {
    Activo = "ACTIVO",
    Inactivo = "INACTIVO",
    Entrenamiento = "ENTRENAMIENTO",
    Competencia = "COMPETENCIA",
    Retirado = "RETIRADO"
}

export enum EstadoLinea {
    Activa = "ACTIVA",
    Inactiva = "INACTIVA"
}

export enum EstadoIncubacion {
    Proceso = "EN_PROCESO",
    Programada = "PROGRAMADA",
    Completada = "COMPLETADA",
    Cancelada = "CANCELADA"
}

export enum TipoValidacion {
    Requerido = "REQUERIDO",
    FormatoInvalido = "FORMATO_INVALIDO",
    RangoInvalido = "RANGO_INVALIDO"
}

export enum DialogMode {
    Create = "create",
    Edit = "edit"
}

export enum ParentescoAve {
    PadreHija = "PADRE_HIJA",
    MadreHijo = "MADRE_HIJO",
    AbueloNieta = "ABUELO_NIETA",
    AbuelaNieto = "ABUELA_NIETO",
    TioSobrina = "TIO_SOBRINA",
    TiaSobrina = "TIA_SOBRINO",
    MedioHermanos = "MEDIO_HERMANOS",
    Primos = "PRIMOS",
    SinParentesco = "SIN_PARENTESCO"
}

// Mensajes de validación
export const ValidationMessages = {
    NOMBRE_REQUERIDO: "El nombre del ave es requerido",
    RAZA_REQUERIDA: "La raza es requerida",
    PESO_REQUERIDO: "El peso es requerido",
    PESO_INVALIDO: "El peso debe ser un número positivo",
    FECHA_REQUERIDA: "La fecha de nacimiento es requerida",
    FECHA_FUTURA: "La fecha de nacimiento no puede ser futura",
    PROPIETARIO_REQUERIDO: "El propietario es requerido",
    CATEGORIA_REQUERIDA: "La categoría es requerida"
} as const;