import { ArrowRight } from "lucide-react";
import { DemoButton } from "./shared";

type Mesa = { n: number; estado: "libre" | "ocupada" | "limpiar" | "reservada"; texto: string; nueva?: boolean };

// Un viernes a las 7:42 p. m.: los mismos cuatro estados que maneja el salón.
const MESAS: Mesa[] = [
  { n: 1, estado: "ocupada", texto: "48 min" },
  { n: 2, estado: "libre", texto: "Libre" },
  { n: 3, estado: "ocupada", texto: "12 min" },
  { n: 4, estado: "ocupada", texto: "Recién pidió", nueva: true },
  { n: 5, estado: "limpiar", texto: "Por limpiar" },
  { n: 6, estado: "libre", texto: "Libre" },
  { n: 7, estado: "ocupada", texto: "1 h 05" },
  { n: 8, estado: "reservada", texto: "Reserva 8:00" },
  { n: 9, estado: "libre", texto: "Libre" },
  { n: 10, estado: "ocupada", texto: "25 min" },
  { n: 11, estado: "libre", texto: "Libre" },
  { n: 12, estado: "ocupada", texto: "36 min" },
];

function Escena() {
  return (
    <div className="lp-scene" aria-hidden="true">
      <div className="lp-tablet">
        <div className="lp-ui">
          <div className="lp-ui-bar">
            <div>
              <div className="lp-ui-title">Salón</div>
              <div className="lp-ui-sub">Viernes · 7:42 p. m.</div>
            </div>
          </div>
          <div className="lp-ui-body">
            <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 10 }}>
              <span className="lp-chip lp-chip-blue">6 ocupadas</span>
              <span className="lp-chip lp-chip-warn">1 por limpiar</span>
              <span className="lp-chip">1 reservada</span>
            </div>
            <div className="lp-tables">
              {MESAS.map((m) => (
                <div key={m.n} className="lp-table" data-state={m.estado} data-new={m.nueva ? "" : undefined}>
                  <b>Mesa {m.n}</b>
                  <span>{m.texto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lp-today lp-ui">
        <div className="lp-ui-label">Ingresos de hoy</div>
        <div className="lp-ui-value">₡384&nbsp;500</div>
        <div className="lp-ui-sub" style={{ marginTop: 6 }}>Este mes: <b className="lp-ok-text">₡4&nbsp;120&nbsp;000</b></div>
      </div>

      <div className="lp-ticket-wrap">
        <div className="lp-ticket">
          <div className="lp-ticket-head"><span>COCINA</span><span>#128</span></div>
          <div>Mesa 4 · Luis</div>
          <div>Vie 7:41 p. m.</div>
          <hr />
          <ul>
            <li><span>2</span><span>Casado con pollo</span><span className="lp-ticket-note">sin ensalada</span></li>
            <li><span>1</span><span>Olla de carne</span></li>
            <li><span>1</span><span>Chifrijo</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="inicio" className="lp-hero">
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">Para restaurantes, sodas y cafeterías de Costa Rica</span>
          <h1 className="lp-h1">
            Que tu restaurante llegue a la <span className="lp-mark-word">meta del mes</span>.
          </h1>
          <p className="lp-lead">
            VendeFácil ordena las comandas, la caja, el inventario y los gastos en un solo lugar. Cada noche sabés
            cuánto vendiste, cuánto llevás en el mes y cuánto te está quedando.
          </p>
          <div className="lp-hero-actions">
            <DemoButton />
            <a className="lp-link" href="#como-funciona">Ver cómo funciona <ArrowRight aria-hidden="true" /></a>
          </div>
          <p className="lp-hero-note">Te lo mostramos por WhatsApp o videollamada. Sin contratos.</p>
        </div>
        <Escena />
      </div>
    </section>
  );
}
