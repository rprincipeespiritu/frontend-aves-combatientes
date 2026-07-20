/**
 * Resuelve el Plan de Cruce de origen de un ave/cría (uno solo).
 * Se basa en la pareja padre/madre, no en planes donde el ave participa como reproductor.
 */
export async function resolverPlanesCruceTexto(params: {
  baseUrl: string;
  token: string | null;
  padreId?: string;
  madreId?: string;
}): Promise<string> {
  const { baseUrl, token, padreId, madreId } = params;
  if (!token || !padreId || !madreId) {
    return "";
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  type PlanCandidato = {
    codigo?: string;
    estado?: string;
    fechaPropuesta?: string;
    modifiedAt?: string;
  };

  const candidatos: PlanCandidato[] = [];

  try {
    const response = await fetch(
      `${baseUrl}/IncubacionDetalles?$select=ID,modifiedAt&$expand=planCruce($select=ID,codigo,estado,fechaPropuesta,modifiedAt)&$filter=padre_ID eq '${padreId}' and madre_ID eq '${madreId}' and planCruce_ID ne null`,
      { headers },
    );
    if (response.ok) {
      const data = await response.json();
      (data.value || []).forEach((detalle: { planCruce?: PlanCandidato }) => {
        if (detalle.planCruce?.codigo && detalle.planCruce.estado !== "ELIMINADO") {
          candidatos.push(detalle.planCruce);
        }
      });
    }
  } catch {
    // ignore
  }

  if (!candidatos.length) {
    try {
      const response = await fetch(
        `${baseUrl}/PlanesCruces?$select=ID,codigo,estado,fechaPropuesta,modifiedAt&$filter=estado ne 'ELIMINADO' and ((macho_ID eq '${padreId}' and hembra_ID eq '${madreId}') or (macho_ID eq '${madreId}' and hembra_ID eq '${padreId}'))`,
        { headers },
      );
      if (response.ok) {
        const data = await response.json();
        (data.value || []).forEach((plan: PlanCandidato) => {
          if (plan.codigo) {
            candidatos.push(plan);
          }
        });
      }
    } catch {
      // ignore
    }
  }

  const plan = seleccionarPlanOrigen(candidatos);
  return plan?.codigo || "";
}

function seleccionarPlanOrigen(
  planes: Array<{
    codigo?: string;
    estado?: string;
    fechaPropuesta?: string;
    modifiedAt?: string;
  }>,
): { codigo?: string } | null {
  if (!planes.length) return null;

  const prioridadEstado: Record<string, number> = {
    EJECUTADO: 0,
    EVALUADO: 1,
    APROBADO: 2,
    PROPUESTO: 3,
    RECHAZADO: 4,
  };

  return [...planes].sort((a, b) => {
    const estadoA = prioridadEstado[String(a.estado || "").toUpperCase()] ?? 9;
    const estadoB = prioridadEstado[String(b.estado || "").toUpperCase()] ?? 9;
    if (estadoA !== estadoB) return estadoA - estadoB;

    const fechaA = String(a.fechaPropuesta || a.modifiedAt || "");
    const fechaB = String(b.fechaPropuesta || b.modifiedAt || "");
    return fechaB.localeCompare(fechaA);
  })[0];
}
