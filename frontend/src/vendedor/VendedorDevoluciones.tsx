import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FaArrowLeft, FaUndoAlt, FaComments, FaCheckCircle,
  FaTimesCircle, FaClipboardList, FaBalanceScale,
} from "react-icons/fa";
import VendedorNavbar from "./VendedorNavbar";
import AdminFooter from "../admin/AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import ChatHilo from "../components/ChatHilo";
import "../css/adminDashboard.css";
import "../css/chats.css";
import "../css/vendedor.css";

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const claseEstado = (e: string) => {
  const map: Record<string, string> = {
    SOLICITADA: "ven-badge-dev-solicitada",
    MAS_PRUEBAS: "ven-badge-dev-pruebas",
    ESCALADA: "ven-badge-dev-escalada",
    APROBADA: "ven-badge-dev-aprobada",
    RECHAZADA: "ven-badge-dev-rechazada",
  };
  return map[e] || "ven-badge-dev-solicitada";
};

const VendedorDevoluciones = () => {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [chatAbierto, setChatAbierto] = useState<number | null>(null);

  const cargar = useCallback(() => {
    fetch("/api/vendedor/devoluciones", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setSolicitudes)
      .catch(() => setSolicitudes([]))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const decidir = async (sol: any, decision: string) => {
    const pideObs = decision === "rechazar" || decision === "mas_pruebas";
    let observacion: any = null;
    if (pideObs) {
      const r = await Swal.fire({
        title: decision === "rechazar" ? "Motivo del rechazo" : "¿Qué necesitas que aclare?",
        input: "textarea",
        inputPlaceholder: decision === "rechazar"
          ? "Explica por qué no puedes aceptar la solicitud…"
          : "Indica qué evidencias o información necesitas…",
        inputValidator: (v: string) => (!v || !v.trim() ? "Debes escribir el motivo" : null),
        showCancelButton: true,
        confirmButtonText: "Enviar",
        cancelButtonText: "Cancelar",
        reverseButtons: true,
      });
      if (!r.isConfirmed) return;
      observacion = r.value;
    } else if (decision === "devolver") {
      const r = await Swal.fire({
        icon: "question",
        title: "¿Aceptar la devolución?",
        text: "Las unidades volverán a tu inventario y el reembolso se coordina con JADDA.",
        showCancelButton: true,
        confirmButtonText: "Sí, aceptar",
        cancelButtonText: "Volver",
        reverseButtons: true,
      });
      if (!r.isConfirmed) return;
    }

    const res = await fetch(`/api/vendedor/devoluciones/${sol.ID_DEVOLUCION}/procesar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision, observacion }),
    });
    const data = await res.json().catch(() => ({}));
    Swal.fire({
      icon: data.ok ? "success" : "warning",
      title: data.ok ? "Solicitud actualizada" : "No se pudo procesar",
      text: data.msg || "",
    });
    if (data.ok) cargar();
  };

  const toggleChat = (s: any) => {
    setChatAbierto((prev) => (prev === s.ID_CHAT ? null : s.ID_CHAT));
  };

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <button className="admin-volver" onClick={() => navigate("/vendedor")}>
            <FaArrowLeft /> Volver al Dashboard
          </button>
          <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Devoluciones" }]} />
          <div className="au-titulos">
            <h1>Devoluciones y reembolsos</h1>
            <p>{solicitudes.length} solicitud(es) sobre tus productos · acuerda la solución con el cliente en su chat</p>
          </div>
        </div>

        {cargando ? (
          <div className="ven-vacio">Cargando solicitudes…</div>
        ) : solicitudes.length === 0 ? (
          <div className="ven-vacio">
            <FaUndoAlt />
            <div>No hay solicitudes de devolución sobre tus productos.</div>
          </div>
        ) : (
          solicitudes.map((s) => (
            <div key={s.ID_DEVOLUCION} className={`ven-venta-card ${["ESCALADA", "APROBADA", "RECHAZADA"].includes(s.ESTADO) ? "" : "ven-pendiente"}`}>
              <div className="ven-venta-head">
                <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                  <img src={s.IMAGEN || PLACEHOLDER_IMG} alt="" className="ven-dev-img" />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{s.PRODUCTO_NOMBRE}</strong>
                    <span className="ven-venta-meta" style={{ marginTop: 4 }}>
                      <span>Solicitud #{s.ID_DEVOLUCION}</span>
                      <span>Pedido #{s.ID_VENTA}</span>
                      <span>x{s.CANTIDAD} · {s.TIPO}</span>
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`ven-badge-venta ${claseEstado(s.ESTADO)}`}>{s.ESTADO}</span>
                </div>
              </div>

              <div className="ven-venta-item">
                <FaClipboardList style={{ color: "#64748b", flexShrink: 0 }} />
                <span><strong>{s.NOMBRE_USUARIO} {s.APELLIDO_USUARIO || ""}</strong></span>
                <span className="ven-chip">{s.EMAIL}</span>
              </div>
              {s.MOTIVO && (
                <p className="ven-dev-texto"><strong>Motivo:</strong> {s.MOTIVO}</p>
              )}
              {s.DESCRIPCION && (
                <p className="ven-dev-texto"><strong>Descripción:</strong> {s.DESCRIPCION}</p>
              )}
              {s.EVIDENCIAS && (
                <p className="ven-dev-texto">
                  <strong>Evidencias:</strong>{" "}
                  {s.EVIDENCIAS.split("|").map((e: string, i: number) => (
                    <a key={i} href={e} target="_blank" rel="noreferrer" className="ven-dev-evid">ver {i + 1}</a>
                  ))}
                </p>
              )}
              {s.OBSERVACION && (
                <p className="ven-dev-texto ven-dev-obs"><strong>Tu respuesta:</strong> {s.OBSERVACION}</p>
              )}

              <div className="ven-dev-acciones">
                {["SOLICITADA", "MAS_PRUEBAS"].includes(s.ESTADO) && (
                  <>
                    <button className="ven-btn-decision aprobar" onClick={() => decidir(s, "devolver")}>
                      <FaCheckCircle /> Aceptar devolución
                    </button>
                    <button className="ven-btn-decision reembolsar" onClick={() => decidir(s, "reembolsar")}>
                      Aceptar solo reembolso
                    </button>
                    <button className="ven-btn-decision pruebas" onClick={() => decidir(s, "mas_pruebas")}>
                      Pedir más pruebas
                    </button>
                    <button className="ven-btn-decision rechazar" onClick={() => decidir(s, "rechazar")}>
                      <FaTimesCircle /> Rechazar
                    </button>
                  </>
                )}
                {s.ESTADO === "ESCALADA" && (
                  <span className="ven-dev-escalada-aviso">
                    <FaBalanceScale /> Escalada al equipo JADDA: ellos deciden el resultado
                  </span>
                )}
                {s.ID_CHAT && (
                  <button className="ven-btn-chat" onClick={() => toggleChat(s)}>
                    <FaComments /> {s.ESTADO === "ESCALADA"
                      ? (chatAbierto === s.ID_CHAT ? "Ocultar chat con soporte JADDA" : "Chat con soporte JADDA")
                      : ["APROBADA", "RECHAZADA"].includes(s.ESTADO)
                        ? (chatAbierto === s.ID_CHAT ? "Ocultar conversación" : "Ver la conversación")
                        : (chatAbierto === s.ID_CHAT ? "Ocultar chat de la solicitud" : "Abrir chat de la solicitud")}
                  </button>
                )}
              </div>

              {s.ID_CHAT && chatAbierto === s.ID_CHAT && (
                <ChatHilo idChat={s.ID_CHAT} altura={280} />
              )}
            </div>
          ))
        )}
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorDevoluciones;
