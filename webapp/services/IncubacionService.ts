export interface IAveOption {
  ID: string;
  nombre: string;
  placa?: string;
}

export interface IIncubacion {
  ID?: string;
  codigo?: string;
  fechaInicio: string;
  fechaFinEstimada?: string;
  fechaFinReal?: string;
  cantidadHuevos: number;
  cantidadFertiles?: number;
  cantidadNacidos?: number;
  cantidadNoEclosion?: number;
  estado?: string;
  observacion?: string;
  padre_ID: string;
  madre_ID: string;
  padre?: IAveOption;
  madre?: IAveOption;
}

export default class IncubacionService {
  private static instance: IncubacionService;
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

  public static getInstance(): IncubacionService {
    if (!IncubacionService.instance) {
      IncubacionService.instance = new IncubacionService();
    }
    return IncubacionService.instance;
  }

  private buildHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      "Content-Type": "application/json",
    };
  }

  private buildEntityUrl(id: string): string {
    return `${this.baseUrl}/Incubaciones(ID=guid'${id}')`;
  }

  public async list(): Promise<IIncubacion[]> {
    const response = await fetch(
      `${this.baseUrl}/Incubaciones?$expand=padre($select=ID,nombre,placa),madre($select=ID,nombre,placa)&$orderby=createdAt desc`,
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
      `${this.buildEntityUrl(id)}?$expand=padre($select=ID,nombre,placa),madre($select=ID,nombre,placa)`,
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

  public async update(id: string, payload: IIncubacion): Promise<void> {
    const response = await fetch(this.buildEntityUrl(id), {
      method: "PATCH",
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await this.parseResponse(response);

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "No se pudo actualizar la incubación",
      );
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
    const response = await fetch(
      `${this.baseUrl}/Aves?$select=ID,nombre,placa&$orderby=nombre asc`,
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
