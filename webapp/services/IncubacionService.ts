export interface IAveOption {
  ID: string;
  nombre: string;
  placa?: string;
}

export interface IIncubacionDetalle {
  ID?: string;
  incubacion_ID?: string;
  padre_ID: string;
  madre_ID: string;
  totalHuevos: number;
  huevosFertiles: number;
  huevosEclosionados: number;
  huevosNoEclosionados: number;
  planCruce_ID?: string;
  tipoParentesco?: string;
  nivelRiesgo?: string;
  porcentaje?: number;
  padre?: any;
  madre?: any;
  planCruce?: any;
}

export interface IIncubacion {
  eInputNacNoEcl: boolean;
  ID?: string;
  codigo?: string;
  fechaIncubacion: string;
  fechaEclosion: string;
  fechaPreNacimiento: string;
  fechaFinIncubacion: string;
  fechaFinReal?: string;
  totalHuevos: number;
  huevosFertiles?: number;
  huevosEclosionados?: number;
  huevosNoFertiles?: number;
  estado?: string;
  observaciones?: string;
  motivoCancelacion?: string;
  padre_ID: string;
  placaPadre?: string;
  madre_ID: string;
  placaMadre?: string;
  detalles?: IIncubacionDetalle[];
  success: boolean;
  message?: string;
  error?: string | {
    message?: string;
  };
}

export default class IncubacionService {
  private static instance: IncubacionService;
  private baseUrl: string = window.APP_CONFIG?.API_BASE_URL || "";
  // Reemplaza por la misma estrategia que ya usas en AuthService

  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  private getErrorMessage(data: any, fallback: string): string {
    const errorMessage = data?.error?.message;

    if (typeof errorMessage === "string") {
      return errorMessage;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data?.error === "string") {
      return data.error;
    }

    return fallback;
  }

  public static getInstance(): IncubacionService {
    if (!IncubacionService.instance) {
      IncubacionService.instance = new IncubacionService();
    }
    return IncubacionService.instance;
  }

  private buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      "Content-Type": "application/json",
    };
  }

  private buildEntityUrl(id: string): string {
    return `${this.baseUrl}/Incubaciones(ID='${id}')`;
  }

  public async list(): Promise<IIncubacion[]> {
    let url = `${this.baseUrl}/IncubacionesActivas?$orderby=createdAt desc`;
    let proceso = localStorage.getItem("filterIncProceso");
    if (proceso) {
      url = `${this.baseUrl}/IncubacionesActivas?$filter=estado eq '${proceso}'&$orderby=createdAt desc`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders(),
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "No se pudo listar incubaciones",
      );
    }

    return data.value || [];
  }

  public async getById(id: string): Promise<IIncubacion> {
    const response = await fetch(
      `${this.buildEntityUrl(id)}?$expand=detalles($expand=padre,madre,planCruce)`,
      {
        method: "GET",
        headers: this.buildHeaders(),
      },
    );

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "No se pudo obtener la incubación",
      );
    }

    return data;
  }

  public async create(payload: IIncubacion): Promise<IIncubacion> {
    try {
      const response = await fetch(`${this.baseUrl}/Incubaciones`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await this.parseResponse(response);

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: this.getErrorMessage(result, "No se pudo crear la incubacion"),
          },
        } as IIncubacion;
      }

      return {
        ...result,
        success: true,
      };
      
    } catch (error) {
      console.error("Error creando incubacion:", error);
      return {
        success: false,
        error: "Error de conexión",
      };
    }
  }

  public async update(id: string, payload: IIncubacion): Promise<IIncubacion> {
    try {
      const response = await fetch(this.buildEntityUrl(id), {
        method: "PATCH",
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      const result = await this.parseResponse(response);

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: this.getErrorMessage(result, "No se pudo actualizar la incubacion"),
          },
        } as IIncubacion;
      }

      return {
        ...result,
        success: true,
      };
    } catch (error) {
      console.error("Error actualizando incubacion:", error);
      return {
        success: false,
        error: {
          message: "Error de conexion",
        },
      } as IIncubacion;
    }
  }

  public async remove(id: string): Promise<void> {
    const response = await fetch(this.buildEntityUrl(id), {
      method: "DELETE",
      headers: this.buildHeaders(),
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "No se pudo eliminar la incubación",
      );
    }
  }

  public async listAves(): Promise<IAveOption[]> {
    const response = await fetch(`${this.baseUrl}/AvesActivas`, {
      method: "GET",
      headers: this.buildHeaders(),
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message || data?.message || "No se pudo listar aves",
      );
    }

    return data.value || [];
  }
}
