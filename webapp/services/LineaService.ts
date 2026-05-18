import {AuthResponse} from "com/rprincipees/registroavescombate/services/AuthService";
import { IIncubacion } from "./IncubacionService";

export interface Linea {
  ID: string;
  nombre: string;
  descripcion: string;
  objetivo: string;
  estado: string;
}

export default class LineaService {
  private static instance: LineaService;
  private baseUrl = "http://localhost:4004/api/avecombatiente";
  // Reemplaza por la misma estrategia que ya usas en AuthService

  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  public static getInstance(): LineaService {
    if (!LineaService.instance) {
      LineaService.instance = new LineaService();
    }
    return LineaService.instance;
  }

  private buildHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      "Content-Type": "application/json",
    };
  }

  private buildEntityUrl(id: string): string {
    return `${this.baseUrl}/LineasAves(ID='${id}')`;
  }

  public async list(): Promise<Linea[]> {

    let url = `${this.baseUrl}/IncubacionesActivas?$orderby=createdAt desc`;
    let proceso = localStorage.getItem('filterIncProceso');
    if(proceso){
      url = `${this.baseUrl}/IncubacionesActivas?$filter=estado eq '${proceso}'&$orderby=createdAt desc`;
    }
    const response = await fetch( url,
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
          "No se pudo listar incubaciones",
      );
    }

    return data.value || [];
  }

  public async getById(id: string): Promise<IIncubacion> {
    const response = await fetch(
      `${this.buildEntityUrl(id)}?$expand=detalles($expand=padre,madre)`,
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
    const response = await fetch(`${this.baseUrl}/Incubaciones`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "No se pudo crear la incubación",
      );
    }

    return data;
  }

  public async update(id: string, payload: Linea): Promise<Linea> {

    let url = this.buildEntityUrl(id);
    const response = await fetch(url, {
      method: "PATCH",
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
          data?.error?.message ||
          data?.message ||
          "No se pudo actualizar la línea",
      );
    }

    return data;

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
    const response = await fetch(
      `${this.baseUrl}/AvesActivas`,
      {
        method: "GET",
        headers: this.buildHeaders(),
      },
    );

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message || data?.message || "No se pudo listar aves",
      );
    }

    return data.value || [];
  }
}
