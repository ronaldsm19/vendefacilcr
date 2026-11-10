import { Plus } from "lucide-react";
import { Brand, DemoButton, WA_DEMO, WhatsAppIcon, waDisplayNumber } from "./shared";

const PREGUNTAS = [
  {
    q: "¿Tengo que comprar equipo?",
    a: "Para empezar, no. VendeFácil funciona en el navegador del celular, la tablet o la computadora que ya tenés. Si querés imprimir tiquetes y comandas hace falta una impresora térmica y una computadora en el local, y te ayudamos a dejarla funcionando.",
  },
  {
    q: "¿En cuánto tiempo puedo empezar?",
    a: "Normalmente en menos de 24 horas después de confirmar el pago. En ese tiempo cargamos tus productos, configuramos tu negocio y te lo entregamos listo para usar.",
  },
  {
    q: "¿Mi equipo necesita saber de tecnología?",
    a: "No. Cada persona ve solo lo que usa: el mesero las mesas y las comandas, la caja el cobro y el cierre. La capacitación toma cerca de 30 minutos y después tenés soporte por WhatsApp.",
  },
  {
    q: "¿Sirve si no tengo salón ni meseros?",
    a: "Sí. Los planes Emprende y Pro están pensados para quien vende por encargo, para llevar o en mostrador.",
  },
  {
    q: "¿Hay contrato o permanencia?",
    a: "No. Los planes son mensuales y podés cancelar cuando querás, sin penalidades.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí. Podés subir de plan en cualquier momento y el cambio aplica desde el siguiente mes.",
  },
  {
    q: "¿Funciona sin internet?",
    a: "Necesita conexión. Con el wifi del local o con los datos del celular es suficiente.",
  },
  {
    q: "¿Emite factura electrónica?",
    a: "Todavía no. VendeFácil lleva tu operación (órdenes, caja, inventario y números) e imprime el tiquete de la venta. La factura electrónica de Hacienda la seguís emitiendo con el sistema que ya usás.",
  },
  {
    q: "¿Qué pasa con mis datos si cancelo?",
    a: "Son tuyos. Los conservamos 30 días después de cancelar y te los entregamos si nos los pedís.",
  },
];

export function Faq() {
  return (
    <section id="preguntas" className="lp-section" aria-labelledby="lp-preguntas">
      <div className="lp-wrap lp-split">
        <div className="lp-split-sticky" data-reveal>
          <h2 id="lp-preguntas" className="lp-h2">Preguntas que nos hacen antes de empezar.</h2>
          <p className="lp-lead">
            Si la tuya no está acá, <a className="lp-link" href={WA_DEMO} target="_blank" rel="noopener noreferrer">escribinos por WhatsApp</a>.
          </p>
        </div>
        <div className="lp-faq" data-reveal>
          {PREGUNTAS.map((p, i) => (
            <details key={p.q} open={i === 0}>
              <summary>{p.q}<Plus aria-hidden="true" /></summary>
              <p>{p.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="lp-section lp-section--navy" aria-labelledby="lp-cierre">
      <div className="lp-wrap lp-final" data-reveal>
        <div>
          <h2 id="lp-cierre" className="lp-h2">Este mes puede cerrar como lo planeaste.</h2>
          <p className="lp-lead">Escribinos y te mostramos VendeFácil funcionando con el menú de un negocio como el tuyo.</p>
        </div>
        <div className="lp-final-actions">
          <DemoButton variant="warm" />
          <a className="lp-btn lp-btn-ghost-light" href="#planes">Ver planes</a>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-row">
          <div style={{ maxWidth: 360 }}>
            <Brand />
            <p style={{ margin: "12px 0 0" }}>El sistema para restaurantes, sodas y cafeterías de Costa Rica.</p>
          </div>
          <nav className="lp-footer-links" aria-label="Pie de página">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#numeros">Tus números</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
            <a href={WA_DEMO} target="_blank" rel="noopener noreferrer">WhatsApp {waDisplayNumber()}</a>
          </nav>
        </div>
        <div className="lp-footer-base">
          <span>© {new Date().getFullYear()} VendeFácil</span>
          <span>Hecho en Costa Rica</span>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFab() {
  return (
    <a className="lp-fab" href={WA_DEMO} target="_blank" rel="noopener noreferrer" aria-label="Escribirnos por WhatsApp">
      <WhatsAppIcon />
    </a>
  );
}
