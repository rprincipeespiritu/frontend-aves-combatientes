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
    const error = data?.error;
    const details = error?.details;

    if (Array.isArray(details) && details.length > 0) {
      const mensajes = details
        .map((item: any) => item?.message || item?.rawMessage)
        .filter(Boolean);

      if (mensajes.length > 0) {
        return mensajes.join("\n");
      }
    }

    const errorMessage = error?.message;

    if (typeof errorMessage === "string") {
      return errorMessage;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return fallback;
  }

  private buildReprogramarDetallePayload(
    detalle: any,
    userId: string,
  ): Record<string, any> {
    const payload: Record<string, any> = {
      padre_ID: detalle.padre_ID || detalle.padre?.ID,
      madre_ID: detalle.madre_ID || detalle.madre?.ID,
      totalHuevos: Number(detalle.totalHuevos || 0),
      huevosFertiles: 0,
      huevosEclosionados: 0,
      huevosNoEclosionados: 0,
      usuario_ID: detalle.usuario_ID || userId,
    };

    if (detalle.ID) {
      payload.ID = detalle.ID;
    }

    if (detalle.planCruce_ID) {
      payload.planCruce_ID = detalle.planCruce_ID;
    }

    if (detalle.tipoParentesco) {
      payload.tipoParentesco = detalle.tipoParentesco;
    }

    if (detalle.nivelRiesgo) {
      payload.nivelRiesgo = detalle.nivelRiesgo;
    }

    if (detalle.porcentaje !== undefined && detalle.porcentaje !== null) {
      payload.porcentaje = Number(detalle.porcentaje);
    }

    return payload;
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
    let url = `${this.baseUrl}/IncubacionesActivas?$orderby=fechaIncubacion desc`;
    let proceso = localStorage.getItem("filterIncProceso");
    if (proceso) {
      url = `${this.baseUrl}/IncubacionesActivas?$filter=estado eq '${proceso}'&$orderby=fechaIncubacion desc`;
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

  public async reprogramar(
    id: string,
    payload: {
      fechaIncubacion: string;
      fechaPreNacimiento: string;
      fechaEclosion: string;
      observaciones?: string;
      detalles: any[];
    },
  ): Promise<IIncubacion> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Incubaciones('${id}')/reprogramar`,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify({
            fechaIncubacion: payload.fechaIncubacion,
            fechaPreNacimiento: payload.fechaPreNacimiento,
            fechaEclosion: payload.fechaEclosion,
            observaciones: payload.observaciones || "",
            detalles: (payload.detalles || []).map((detalle) =>
              this.buildReprogramarDetallePayload(
                detalle,
                detalle.usuario_ID || "",
              ),
            ),
          }),
        },
      );

      const result = await this.parseResponse(response);

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: this.getErrorMessage(
              result,
              "No se pudo reprogramar la incubacion",
            ),
          },
        } as IIncubacion;
      }

      return {
        success: true,
        message: typeof result?.value === "string" ? result.value : result,
      } as IIncubacion;
    } catch (error) {
      console.error("Error reprogramando incubacion:", error);
      return {
        success: false,
        error: {
          message: "Error de conexion",
        },
      };
    }
  }

  public async reprogramarConActualizacion(
    id: string,
    payload: {
      fechaIncubacion: string;
      fechaPreNacimiento: string;
      fechaEclosion: string;
      observaciones?: string;
      detalles: any[];
      usuario_ID: string;
    },
  ): Promise<IIncubacion> {
    try {
      const response = await fetch(this.buildEntityUrl(id), {
        method: "PATCH",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          fechaIncubacion: payload.fechaIncubacion,
          fechaPreNacimiento: payload.fechaPreNacimiento,
          fechaEclosion: payload.fechaEclosion,
          observaciones: payload.observaciones || "",
          estado: "PROGRAMADA",
          motivoCancelacion: "",
          fechaFinIncubacion: null,
          detalles: (payload.detalles || []).map((detalle) =>
            this.buildReprogramarDetallePayload(detalle, payload.usuario_ID),
          ),
        }),
      });

      const result = await this.parseResponse(response);

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: this.getErrorMessage(
              result,
              "No se pudo reprogramar la incubacion",
            ),
          },
        } as IIncubacion;
      }

      return {
        ...result,
        success: true,
      };
    } catch (error) {
      console.error("Error reprogramando incubacion:", error);
      return {
        success: false,
        error: {
          message: "Error de conexion",
        },
      };
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
