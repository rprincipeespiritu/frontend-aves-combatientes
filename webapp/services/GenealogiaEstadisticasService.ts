export interface IAveGenealogia {
  ID: string;
  placa?: string;
  nombre?: string;
  sexo?: string;
  estado?: string;
  fechaNacimiento?: string;
  padre_ID?: string;
  madre_ID?: string;
  padrote?: boolean;
  fotoPrincipalUrl?: string;
}

export interface ICriaGenealogia {
  ID: string;
  cintillo?: string;
  nombre?: string;
  sexo?: string;
  estado?: string;
  padre_ID?: string;
  madre_ID?: string;
  aveGenerada_ID?: string;
}

export interface IEstadisticasPeleas {
  totalPeleas: number;
  victorias: number;
  derrotas: number;
  empates: number;
  porcentajeVictorias: string;
}

export interface IFilaEstadisticasPeleas {
  ID: string;
  placa: string;
  nombre: string;
  sexo: string;
  sexoFmt: string;
  parentesco: string;
  generacion: number;
  estado: string;
  victorias: number | null;
  derrotas: number | null;
  totalPeleas: number | null;
  porcentajeVictorias: string;
  muestraPeleas: boolean;
  esAve: boolean;
}

export interface IResumenEstadisticasPeleas {
  total: number;
  machos: number;
  hembras: number;
  conPeleas: number;
  totalVictorias: number;
  totalDerrotas: number;
  promedioVictorias: string;
}

export type AlcanceEstadisticas =
  | "INDIVIDUO"
  | "ASCENDIENTES"
  | "DESCENDIENTES"
  | "HERMANOS_PRIMOS";

export interface IGraphNode {
  key: string;
  aveId?: string;
  title: string;
  description: string;
  icon: string;
  image: string;
  status: string;
  shape: string;
  width: number;
  nombre: string;
  rol: string;
  generacion: string;
  sexo: string;
  estado: string;
  peleasFmt: string;
  hijosFmt: string;
}

export interface IGraphModel {
  nodes: IGraphNode[];
  lines: Array<{ from: string; to: string; status: string }>;
}

interface INodoGrafo {
  id: string;
  aveId?: string;
  placa: string;
  nombre: string;
  sexo: string;
  rol: string;
  rama: string;
  parentId?: string;
  estado: string;
  fechaNacimiento: string;
  fotoUrl: string;
  generacion: number;
  faltante: boolean;
  totalPeleas: number;
  victorias: number;
  derrotas: number;
  totalHijos: number;
  hijosMachos: number;
  hijosHembras: number;
}

const PELEAS_VACIAS: IEstadisticasPeleas = {
  totalPeleas: 0,
  victorias: 0,
  derrotas: 0,
  empates: 0,
  porcentajeVictorias: "0%",
};

export class GenealogiaEstadisticasService {
  private avesPorId = new Map<string, IAveGenealogia>();
  private crias: ICriaGenealogia[] = [];
  private estadisticasPorAveId = new Map<string, IEstadisticasPeleas>();
  private baseUrl = "";
  private headers: HeadersInit = {};

  public getAvesPorId(): Map<string, IAveGenealogia> {
    return this.avesPorId;
  }

  public getAves(): IAveGenealogia[] {
    return Array.from(this.avesPorId.values()).sort((a, b) =>
      (a.placa || "").localeCompare(b.placa || ""),
    );
  }

  public async cargarDatos(
    baseUrl: string,
    headers: HeadersInit,
  ): Promise<void> {
    this.baseUrl = baseUrl;
    this.headers = headers;

    const [avesResponse, criasResponse, peleasResponse] = await Promise.all([
      fetch(
        `${baseUrl}/Aves?$select=ID,placa,nombre,sexo,estado,fechaNacimiento,padre_ID,madre_ID,padrote&$expand=fotos($filter=esPrincipal eq true;$select=esPrincipal,thumbnailUrl,urlSharepoint)&$orderby=placa asc`,
        { headers },
      ),
      fetch(
        `${baseUrl}/Crias?$select=ID,cintillo,nombre,sexo,estado,padre_ID,madre_ID,aveGenerada_ID&$filter=estado ne 'ELIMINADO'`,
        { headers },
      ),
      fetch(`${baseUrl}/Peleas?$select=ave_ID,resultado`, { headers }),
    ]);

    const avesData = await avesResponse.json();
    const criasData = await criasResponse.json();
    const peleasData = await peleasResponse.json();

    if (!avesResponse.ok) {
      throw new Error(
        avesData?.error?.message || avesData?.message || "No se pudo cargar aves",
      );
    }

    if (!criasResponse.ok) {
      throw new Error(
        criasData?.error?.message || criasData?.message || "No se pudo cargar crias",
      );
    }

    if (!peleasResponse.ok) {
      throw new Error(
        peleasData?.error?.message || peleasData?.message || "No se pudo cargar peleas",
      );
    }

    const aves = await Promise.all(
      (avesData.value || []).map(async (ave: IAveGenealogia & { fotos?: Array<{ thumbnailUrl?: string; urlSharepoint?: string; esPrincipal?: boolean }> }) => {
        const fotoPrincipal = (ave.fotos || []).find((foto) => foto.esPrincipal) || ave.fotos?.[0];
        const fotoPrincipalRawUrl =
          fotoPrincipal?.thumbnailUrl ||
          fotoPrincipal?.urlSharepoint ||
          "";
        const fotoPrincipalUrl = await this.obtenerUrlFotoNodo(fotoPrincipalRawUrl);

        return {
          ...ave,
          fotoPrincipalUrl,
        };
      }),
    );

    this.avesPorId = new Map(aves.map((ave) => [ave.ID, ave]));
    this.crias = criasData.value || [];
    this.estadisticasPorAveId = this.construirMapaPeleas(peleasData.value || []);
  }

  public normalizarMaxGeneraciones(value: number): number {
    if (!Number.isFinite(value)) {
      return 5;
    }

    return Math.min(10, Math.max(1, Math.round(value)));
  }

  public obtenerFilas(
    aveId: string,
    alcance: AlcanceEstadisticas,
    maxGeneraciones = 5,
  ): IFilaEstadisticasPeleas[] {
    const ave = this.avesPorId.get(aveId);
    if (!ave) {
      return [];
    }

    const generaciones = this.normalizarMaxGeneraciones(maxGeneraciones);

    switch (alcance) {
      case "INDIVIDUO":
        return [this.crearFilaAve(ave, "Individuo seleccionado", 0)];
      case "ASCENDIENTES":
        return this.obtenerAscendientes(aveId, generaciones);
      case "DESCENDIENTES":
        return this.obtenerDescendientes(aveId, generaciones);
      case "HERMANOS_PRIMOS":
        return this.obtenerHermanosYPrimos(ave);
      default:
        return [];
    }
  }

  public calcularResumen(filas: IFilaEstadisticasPeleas[]): IResumenEstadisticasPeleas {
    const machos = filas.filter((fila) => fila.sexo === "M");
    const hembras = filas.filter((fila) => fila.sexo === "H");
    const conPeleas = machos.filter((fila) => (fila.totalPeleas || 0) > 0);
    const totalVictorias = machos.reduce((sum, fila) => sum + (fila.victorias || 0), 0);
    const totalDerrotas = machos.reduce((sum, fila) => sum + (fila.derrotas || 0), 0);
    const totalPeleas = machos.reduce((sum, fila) => sum + (fila.totalPeleas || 0), 0);

    return {
      total: filas.length,
      machos: machos.length,
      hembras: hembras.length,
      conPeleas: conPeleas.length,
      totalVictorias,
      totalDerrotas,
      promedioVictorias:
        totalPeleas > 0
          ? `${((totalVictorias / totalPeleas) * 100).toFixed(1)}%`
          : "0%",
    };
  }

  public formatearSexo(sexo?: string): string {
    if (sexo === "M") return "Macho";
    if (sexo === "H") return "Hembra";
    return "";
  }

  public formatearFecha(fecha?: string): string {
    if (!fecha) return "";

    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "";

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  public obtenerTituloAlcance(alcance: AlcanceEstadisticas): string {
    const titulos: Record<AlcanceEstadisticas, string> = {
      INDIVIDUO: "Individuo seleccionado",
      ASCENDIENTES: "Ascendientes",
      DESCENDIENTES: "Descendientes",
      HERMANOS_PRIMOS: "Hermanos y primos",
    };

    return titulos[alcance] || "Estadisticas de peleas";
  }

  public obtenerNoDataText(alcance: AlcanceEstadisticas): string {
    const textos: Record<AlcanceEstadisticas, string> = {
      INDIVIDUO: "Seleccione una ave para ver sus estadisticas.",
      ASCENDIENTES: "No hay ascendientes registrados para esta ave.",
      DESCENDIENTES: "No hay descendientes adultos registrados para esta ave.",
      HERMANOS_PRIMOS: "No hay hermanos ni primos registrados para esta ave.",
    };

    return textos[alcance] || "No hay registros para mostrar.";
  }

  public obtenerGrafo(
    aveId: string,
    alcance: AlcanceEstadisticas,
    maxGeneraciones = 5,
  ): IGraphModel {
    const ave = this.avesPorId.get(aveId);
    if (!ave) {
      return { nodes: [], lines: [] };
    }

    const generaciones = this.normalizarMaxGeneraciones(maxGeneraciones);

    switch (alcance) {
      case "INDIVIDUO":
        return this.crearModeloGraphIndividuo(ave);
      case "ASCENDIENTES":
        return this.crearModeloGraph(
          this.construirGeneracionesAscendentesGrafo(ave, generaciones),
          "ASCENDENCIA",
        );
      case "DESCENDIENTES":
        return this.crearModeloGraph(
          this.construirGeneracionesDescendentesGrafo(ave, generaciones),
          "DESCENDENCIA",
        );
      case "HERMANOS_PRIMOS":
        return this.crearModeloGraphHermanosPrimos(ave);
      default:
        return { nodes: [], lines: [] };
    }
  }

  private construirGeneracionesAscendentesGrafo(
    ave: IAveGenealogia,
    maxGeneraciones: number,
  ): Array<{ nodos: INodoGrafo[] }> {
    const generaciones: Array<{ nodos: INodoGrafo[] }> = [];
    let nivelActual = [this.crearNodoGrafo(ave, 0, "Ave seleccionada", "Base")];

    generaciones.push({ nodos: nivelActual });

    for (let generacion = 1; generacion <= maxGeneraciones; generacion += 1) {
      const siguienteNivel: INodoGrafo[] = [];

      nivelActual.forEach((nodo) => {
        const aveActual = nodo.aveId ? this.avesPorId.get(nodo.aveId) : undefined;
        const padre = aveActual?.padre_ID
          ? this.avesPorId.get(aveActual.padre_ID)
          : undefined;
        const madre = aveActual?.madre_ID
          ? this.avesPorId.get(aveActual.madre_ID)
          : undefined;

        if (padre) {
          siguienteNivel.push(
            this.crearNodoGrafo(padre, generacion, "Padre", `${nodo.rama} > Padre`, nodo.id),
          );
        }

        if (madre) {
          siguienteNivel.push(
            this.crearNodoGrafo(madre, generacion, "Madre", `${nodo.rama} > Madre`, nodo.id),
          );
        }
      });

      if (!siguienteNivel.length) break;

      generaciones.push({ nodos: siguienteNivel });
      nivelActual = siguienteNivel;
    }

    return generaciones;
  }

  private construirGeneracionesDescendentesGrafo(
    ave: IAveGenealogia,
    maxGeneraciones: number,
  ): Array<{ nodos: INodoGrafo[] }> {
    const generaciones: Array<{ nodos: INodoGrafo[] }> = [];
    let nivelActual = [this.crearNodoGrafo(ave, 0, "Ave seleccionada", "Base")];

    generaciones.push({ nodos: nivelActual });

    for (let generacion = 1; generacion <= maxGeneraciones; generacion += 1) {
      const siguienteNivel: INodoGrafo[] = [];

      nivelActual.forEach((nodo) => {
        if (!nodo.aveId) return;

        this.obtenerHijosDirectos(nodo.aveId).forEach((hijo) => {
          const rol = hijo.sexo === "H" ? "Hija" : "Hijo";
          siguienteNivel.push(
            this.crearNodoGrafo(hijo, generacion, rol, `${nodo.rama} > ${rol}`, nodo.id),
          );
        });
      });

      if (!siguienteNivel.length) break;

      generaciones.push({ nodos: siguienteNivel });
      nivelActual = siguienteNivel;
    }

    return generaciones;
  }

  private crearModeloGraphIndividuo(ave: IAveGenealogia): IGraphModel {
    const nodo = this.crearNodoGrafo(ave, 0, "Ave seleccionada", "Base");
    return this.crearModeloGraph([{ nodos: [nodo] }], "ASCENDENCIA");
  }

  private crearModeloGraphHermanosPrimos(ave: IAveGenealogia): IGraphModel {
    const filas = this.obtenerHermanosYPrimos(ave);
    const centerKey = this.normalizarGraphKey(`0-base-${ave.ID}`);
    const centerNode = this.crearNodoGrafo(ave, 0, "Ave seleccionada", "Base");
    const nodes = [this.mapNodoToGraphNode(centerNode, centerKey)];
    const lines: IGraphModel["lines"] = [];

    filas.forEach((fila) => {
      if (!fila.esAve) return;

      const aveRelacionada = this.avesPorId.get(fila.ID);
      if (!aveRelacionada) return;

      const rol = fila.parentesco.startsWith("Primo")
        ? "Primo"
        : fila.parentesco.startsWith("Hermano")
          ? "Hermano"
          : "Relacionado";
      const nodo = this.crearNodoGrafo(aveRelacionada, 1, rol, fila.parentesco);
      const key = this.normalizarGraphKey(`1-${fila.parentesco}-${fila.ID}`);

      nodes.push(this.mapNodoToGraphNode(nodo, key, rol));
      lines.push({
        from: centerKey,
        to: key,
        status: "Linea",
      });
    });

    return { nodes, lines };
  }

  private crearModeloGraph(
    generaciones: Array<{ nodos: INodoGrafo[] }>,
    direccionArbol: "ASCENDENCIA" | "DESCENDENCIA",
  ): IGraphModel {
    const nodes: IGraphNode[] = [];
    const lines: IGraphModel["lines"] = [];
    const esDescendencia = direccionArbol === "DESCENDENCIA";

    generaciones.forEach((generacion) => {
      generacion.nodos.forEach((nodo) => {
        const key = this.normalizarGraphKey(nodo.id);
        nodes.push(this.mapNodoToGraphNode(nodo, key));

        if (nodo.parentId) {
          lines.push({
            from: esDescendencia
              ? this.normalizarGraphKey(nodo.parentId)
              : key,
            to: esDescendencia
              ? key
              : this.normalizarGraphKey(nodo.parentId),
            status: "Linea",
          });
        }
      });
    });

    return { nodes, lines };
  }

  private mapNodoToGraphNode(nodo: INodoGrafo, key: string, statusOverride?: string): IGraphNode {
    const descendencia = this.obtenerEstadisticasDescendencia(nodo.aveId);
    const hijosFmt = this.formatearHijos(descendencia);
    const descripcion = [
      nodo.nombre,
      nodo.fechaNacimiento ? `Nac. ${nodo.fechaNacimiento}` : "",
      nodo.rol,
      nodo.totalPeleas > 0 ? `${nodo.victorias}V/${nodo.derrotas}D` : "",
      descendencia.totalHijos > 0 ? hijosFmt : "",
    ].filter(Boolean).join(" | ");

    const status = statusOverride
      || (nodo.rol === "Madre"
        ? "Madre"
        : nodo.rol === "Padre"
          ? "Padre"
          : nodo.rol === "Hijo" || nodo.rol === "Hija"
            ? "Descendiente"
            : nodo.rol === "Hermano"
              ? "Hermano"
              : nodo.rol === "Primo"
                ? "Primo"
                : "Base");

    return {
      key,
      aveId: nodo.aveId,
      title: nodo.placa,
      description: descripcion,
      icon: "sap-icon://customer",
      image: nodo.fotoUrl || "",
      status,
      shape: "Box",
      width: 260,
      nombre: nodo.nombre || "Sin nombre",
      rol: nodo.rol,
      generacion: `G${nodo.generacion}`,
      sexo: nodo.sexo || "-",
      estado: this.formatearEstado(nodo.estado),
      peleasFmt: nodo.totalPeleas > 0
        ? `${nodo.victorias}V / ${nodo.derrotas}D (${nodo.totalPeleas})`
        : "Sin peleas",
      hijosFmt: descendencia.totalHijos > 0 ? hijosFmt : "0 hijos e hijas",
    };
  }

  private crearNodoGrafo(
    ave: IAveGenealogia,
    generacion: number,
    rol: string,
    rama: string,
    parentId?: string,
  ): INodoGrafo {
    const peleas = this.obtenerEstadisticasPeleas(ave.ID);
    const descendencia = this.obtenerEstadisticasDescendencia(ave.ID);

    return {
      id: `${generacion}-${rama}-${ave.ID}`,
      aveId: ave.ID,
      placa: ave.placa || "Sin placa",
      nombre: ave.nombre || "Sin nombre",
      sexo: this.formatearSexo(ave.sexo),
      rol,
      rama,
      parentId,
      estado: ave.estado || "",
      fechaNacimiento: this.formatearFecha(ave.fechaNacimiento),
      fotoUrl: ave.fotoPrincipalUrl || "",
      generacion,
      faltante: false,
      totalPeleas: peleas.totalPeleas,
      victorias: peleas.victorias,
      derrotas: peleas.derrotas,
      totalHijos: descendencia.totalHijos,
      hijosMachos: descendencia.hijosMachos,
      hijosHembras: descendencia.hijosHembras,
    };
  }

  private obtenerHijosDirectos(aveId: string): IAveGenealogia[] {
    const map = new Map<string, IAveGenealogia>();

    Array.from(this.avesPorId.values())
      .filter((candidato) => candidato.padre_ID === aveId || candidato.madre_ID === aveId)
      .forEach((hijo) => map.set(hijo.ID, hijo));

    return Array.from(map.values()).sort((a, b) =>
      (a.placa || "").localeCompare(b.placa || ""),
    );
  }

  private obtenerEstadisticasDescendencia(aveId?: string): {
    totalHijos: number;
    hijosMachos: number;
    hijosHembras: number;
  } {
    if (!aveId) {
      return { totalHijos: 0, hijosMachos: 0, hijosHembras: 0 };
    }

    const hijos = this.obtenerHijosDirectos(aveId);

    return {
      totalHijos: hijos.length,
      hijosMachos: hijos.filter((hijo) => hijo.sexo === "M").length,
      hijosHembras: hijos.filter((hijo) => hijo.sexo === "H").length,
    };
  }

  private formatearHijos(descendencia: {
    totalHijos: number;
    hijosMachos: number;
    hijosHembras: number;
  }): string {
    if (descendencia.totalHijos === 0) return "0 hijos e hijas";

    const partes: string[] = [];
    if (descendencia.hijosMachos > 0) {
      partes.push(`${descendencia.hijosMachos} hijo${descendencia.hijosMachos !== 1 ? "s" : ""}`);
    }
    if (descendencia.hijosHembras > 0) {
      partes.push(`${descendencia.hijosHembras} hija${descendencia.hijosHembras !== 1 ? "s" : ""}`);
    }

    if (!partes.length) {
      return `${descendencia.totalHijos} descendiente${descendencia.totalHijos !== 1 ? "s" : ""}`;
    }

    return partes.join(", ");
  }

  private formatearEstado(estado?: string): string {
    if (!estado) return "-";

    return estado
      .trim()
      .toLowerCase()
      .split(/[\s_-]+/)
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(" ");
  }

  private normalizarGraphKey(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, "_");
  }

  private async obtenerUrlVisualizacionArchivo(url: string): Promise<string> {
    if (!url || !String(url).includes(".s3.")) {
      return url;
    }

    const response = await fetch(`${this.baseUrl}/obtenerUrlLecturaS3`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ fileUrl: url }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "No se pudo preparar la imagen.");
    }

    return data.downloadUrl || url;
  }

  private async obtenerUrlFotoNodo(url: string): Promise<string> {
    if (!url) {
      return "";
    }

    try {
      return await this.obtenerUrlVisualizacionArchivo(url);
    } catch {
      return "";
    }
  }

  private construirMapaPeleas(
    peleas: Array<{ ave_ID?: string; resultado?: string }>,
  ): Map<string, IEstadisticasPeleas> {
    const statsMap = new Map<string, IEstadisticasPeleas>();

    peleas.forEach((pelea) => {
      if (!pelea.ave_ID) return;

      const stats = statsMap.get(pelea.ave_ID) || { ...PELEAS_VACIAS };

      stats.totalPeleas += 1;
      if (pelea.resultado === "VICTORIA") stats.victorias += 1;
      else if (pelea.resultado === "DERROTA") stats.derrotas += 1;
      else if (pelea.resultado === "EMPATE") stats.empates += 1;

      statsMap.set(pelea.ave_ID, stats);
    });

    statsMap.forEach((stats) => {
      if (stats.totalPeleas > 0) {
        stats.porcentajeVictorias = `${((stats.victorias / stats.totalPeleas) * 100).toFixed(1)}%`;
      }
    });

    return statsMap;
  }

  private obtenerEstadisticasPeleas(aveId?: string): IEstadisticasPeleas {
    if (!aveId) {
      return { ...PELEAS_VACIAS };
    }

    return this.estadisticasPorAveId.get(aveId) || { ...PELEAS_VACIAS };
  }

  private crearFilaAve(
    ave: IAveGenealogia,
    parentesco: string,
    generacion: number,
  ): IFilaEstadisticasPeleas {
    const peleas = this.obtenerEstadisticasPeleas(ave.ID);
    const esHembra = ave.sexo === "H";

    return {
      ID: ave.ID,
      placa: ave.placa || "Sin placa",
      nombre: ave.nombre || "Sin nombre",
      sexo: ave.sexo || "",
      sexoFmt: this.formatearSexo(ave.sexo),
      parentesco,
      generacion,
      estado: ave.estado || "",
      victorias: esHembra ? null : peleas.victorias,
      derrotas: esHembra ? null : peleas.derrotas,
      totalPeleas: esHembra ? null : peleas.totalPeleas,
      porcentajeVictorias: esHembra ? "" : peleas.porcentajeVictorias,
      muestraPeleas: !esHembra,
      esAve: true,
    };
  }

  private obtenerAscendientes(
    aveId: string,
    maxGeneraciones: number,
  ): IFilaEstadisticasPeleas[] {
    const map = new Map<string, IFilaEstadisticasPeleas>();
    let nivelActual = [aveId];

    for (let generacion = 1; generacion <= maxGeneraciones; generacion += 1) {
      const siguienteNivel: string[] = [];

      nivelActual.forEach((idNodo) => {
        const ave = this.avesPorId.get(idNodo);
        if (!ave) return;

        const padre = ave.padre_ID ? this.avesPorId.get(ave.padre_ID) : undefined;
        const madre = ave.madre_ID ? this.avesPorId.get(ave.madre_ID) : undefined;

        if (padre && !map.has(padre.ID)) {
          map.set(
            padre.ID,
            this.crearFilaAve(
              padre,
              this.getTituloAscendiente(generacion, "M"),
              generacion,
            ),
          );
          siguienteNivel.push(padre.ID);
        }

        if (madre && !map.has(madre.ID)) {
          map.set(
            madre.ID,
            this.crearFilaAve(
              madre,
              this.getTituloAscendiente(generacion, "H"),
              generacion,
            ),
          );
          siguienteNivel.push(madre.ID);
        }
      });

      nivelActual = siguienteNivel;
      if (!nivelActual.length) break;
    }

    return this.ordenarFilas(Array.from(map.values()));
  }

  private obtenerDescendientes(
    aveId: string,
    maxGeneraciones: number,
  ): IFilaEstadisticasPeleas[] {
    const map = new Map<string, IFilaEstadisticasPeleas>();
    let nivelActual = [aveId];

    for (let generacion = 1; generacion <= maxGeneraciones; generacion += 1) {
      const siguienteNivel: string[] = [];

      nivelActual.forEach((idNodo) => {
        const hijosAves = Array.from(this.avesPorId.values()).filter(
          (candidato) => candidato.padre_ID === idNodo || candidato.madre_ID === idNodo,
        );

        hijosAves.forEach((hijo) => {
          if (map.has(hijo.ID)) return;

          map.set(
            hijo.ID,
            this.crearFilaAve(
              hijo,
              this.getTituloDescendiente(generacion, hijo.sexo),
              generacion,
            ),
          );
          siguienteNivel.push(hijo.ID);
        });
      });

      nivelActual = siguienteNivel;
      if (!nivelActual.length) break;
    }

    return this.ordenarFilas(Array.from(map.values()));
  }

  private obtenerHermanosYPrimos(ave: IAveGenealogia): IFilaEstadisticasPeleas[] {
    const map = new Map<string, IFilaEstadisticasPeleas>();
    const idsExcluidos = new Set<string>([ave.ID]);

    const registrarHermano = (hermano: IAveGenealogia, parentesco: string) => {
      if (map.has(hermano.ID)) return;
      idsExcluidos.add(hermano.ID);
      map.set(hermano.ID, this.crearFilaAve(hermano, parentesco, 0));
    };

    if (ave.padre_ID && ave.madre_ID) {
      Array.from(this.avesPorId.values())
        .filter(
          (candidato) =>
            candidato.ID !== ave.ID &&
            candidato.padre_ID === ave.padre_ID &&
            candidato.madre_ID === ave.madre_ID,
        )
        .forEach((hermano) => registrarHermano(hermano, "Hermano completo"));
    }

    if (ave.padre_ID) {
      Array.from(this.avesPorId.values())
        .filter(
          (candidato) =>
            candidato.ID !== ave.ID &&
            candidato.padre_ID === ave.padre_ID &&
            candidato.madre_ID !== ave.madre_ID,
        )
        .forEach((hermano) => registrarHermano(hermano, "Medio hermano por padre"));
    }

    if (ave.madre_ID) {
      Array.from(this.avesPorId.values())
        .filter(
          (candidato) =>
            candidato.ID !== ave.ID &&
            candidato.madre_ID === ave.madre_ID &&
            candidato.padre_ID !== ave.padre_ID,
        )
        .forEach((hermano) => registrarHermano(hermano, "Medio hermano por madre"));
    }

    const abuelos = this.obtenerAbuelosIds(ave);
    if (abuelos.length) {
      Array.from(this.avesPorId.values())
        .filter((candidato) => {
          if (idsExcluidos.has(candidato.ID)) return false;
          const abuelosCandidato = this.obtenerAbuelosIds(candidato);
          return abuelosCandidato.some((abueloId) => abuelos.includes(abueloId));
        })
        .forEach((primo) => registrarHermano(primo, "Primo"));
    }

    return this.ordenarFilas(Array.from(map.values()));
  }

  private obtenerAbuelosIds(ave: IAveGenealogia): string[] {
    const abuelos = new Set<string>();
    const padre = ave.padre_ID ? this.avesPorId.get(ave.padre_ID) : undefined;
    const madre = ave.madre_ID ? this.avesPorId.get(ave.madre_ID) : undefined;

    if (padre?.padre_ID) abuelos.add(padre.padre_ID);
    if (padre?.madre_ID) abuelos.add(padre.madre_ID);
    if (madre?.padre_ID) abuelos.add(madre.padre_ID);
    if (madre?.madre_ID) abuelos.add(madre.madre_ID);

    return Array.from(abuelos);
  }

  private getTituloAscendiente(generacion: number, sexo?: string): string {
    const titulos: Record<number, { M: string; H: string }> = {
      1: { M: "Padre", H: "Madre" },
      2: { M: "Abuelo", H: "Abuela" },
      3: { M: "Bisabuelo", H: "Bisabuela" },
      4: { M: "Tatarabuelo", H: "Tatarabuela" },
      5: { M: "5to ascendiente (m)", H: "5to ascendiente (h)" },
    };

    const titulo = titulos[generacion];
    if (titulo) {
      return sexo === "H" ? titulo.H : titulo.M;
    }

    return `Ascendiente gen. ${generacion}`;
  }

  private getTituloDescendiente(generacion: number, sexo?: string): string {
    const titulos: Record<number, { M: string; H: string }> = {
      1: { M: "Hijo", H: "Hija" },
      2: { M: "Nieto", H: "Nieta" },
      3: { M: "Bisnieto", H: "Bisnieta" },
      4: { M: "Tataranieto", H: "Tataranieta" },
      5: { M: "5to descendiente (m)", H: "5to descendiente (h)" },
    };

    const titulo = titulos[generacion];
    if (titulo) {
      return sexo === "H" ? titulo.H : titulo.M;
    }

    return `Descendiente gen. ${generacion}`;
  }

  private ordenarFilas(filas: IFilaEstadisticasPeleas[]): IFilaEstadisticasPeleas[] {
    return filas.sort((a, b) => {
      if (a.generacion !== b.generacion) {
        return a.generacion - b.generacion;
      }

      return (a.placa || "").localeCompare(b.placa || "");
    });
  }
}
