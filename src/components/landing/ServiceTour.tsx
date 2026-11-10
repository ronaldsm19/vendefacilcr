"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Check, Send } from "lucide-react";

const AUTO_MS = 6500;

function Apertura() {
  return (
    <div className="lp-card lp-ui">
      <div className="lp-ui-bar">
        <div>
          <div className="lp-ui-title">Caja</div>
          <div className="lp-ui-sub">Viernes 14 de noviembre</div>
        </div>
        <span className="lp-chip lp-chip-ok"><Check aria-hidden="true" />Abierta</span>
      </div>
      <div className="lp-ui-body">
        <div className="lp-ui-label">Fondo con el que arranca el día</div>
        <div className="lp-ui-value">₡40&nbsp;000</div>
        <ul className="lp-ui-rows" style={{ marginTop: 12 }}>
          <li><span className="lp-muted">Abierta desde</span><b>10:02 a. m.</b></li>
          <li><span className="lp-muted">Retiro para proveedor</span><b className="lp-num">−₡15&nbsp;000</b></li>
          <li><span className="lp-muted">Ventas en efectivo</span><b className="lp-num lp-ok-text">₡146&nbsp;400</b></li>
        </ul>
      </div>
    </div>
  );
}

function Orden() {
  const items = [
    { q: 2, n: "Casado con pollo", nota: "sin ensalada" },
    { q: 1, n: "Olla de carne" },
    { q: 1, n: "Chifrijo" },
    { q: 3, n: "Fresco de cas" },
  ];
  return (
    <div className="lp-phone lp-ui">
      <div className="lp-ui-bar">
        <div>
          <div className="lp-ui-title">Mesa 4</div>
          <div className="lp-ui-sub">Luis · 4 personas</div>
        </div>
        <span className="lp-chip lp-chip-blue">Comanda nueva</span>
      </div>
      <div className="lp-ui-body">
        <ul className="lp-ui-rows">
          {items.map((i) => (
            <li key={i.n}>
              <span>
                <b>{i.q} × {i.n}</b>
                {i.nota && <span className="lp-warm-text" style={{ display: "block", fontWeight: 600 }}>{i.nota}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="lp-ui-btn" style={{ marginTop: 12 }}><Send aria-hidden="true" />Enviar a cocina</div>
      </div>
    </div>
  );
}

function Tiquetes() {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-center gap-5" style={{ filter: "drop-shadow(0 12px 16px rgba(14, 26, 60, 0.16))" }}>
        <div className="lp-ticket lp-ticket--flat">
          <div className="lp-ticket-head"><span>COCINA</span><span>#128</span></div>
          <div>Mesa 4 · Luis</div>
          <hr />
          <ul>
            <li><span>2</span><span>Casado con pollo</span><span className="lp-ticket-note">sin ensalada</span></li>
            <li><span>1</span><span>Olla de carne</span></li>
            <li><span>1</span><span>Chifrijo</span></li>
          </ul>
        </div>
        <div className="lp-ticket lp-ticket--flat">
          <div className="lp-ticket-head"><span>BEBIDAS</span><span>#128</span></div>
          <div>Mesa 4 · Luis</div>
          <hr />
          <ul>
            <li><span>3</span><span>Fresco de cas</span><span className="lp-ticket-note">uno sin hielo</span></li>
          </ul>
        </div>
      </div>
      <p className="lp-ui" style={{ marginTop: 22, textAlign: "center" }}>
        <span className="lp-chip lp-chip-warn">Mesa 7 · lleva 16 min esperando</span>
      </p>
    </div>
  );
}

function Cobro() {
  return (
    <div className="lp-card lp-ui">
      <div className="lp-ui-bar">
        <div>
          <div className="lp-ui-title">Cobrar mesa 4</div>
          <div className="lp-ui-sub">Comanda #128</div>
        </div>
      </div>
      <div className="lp-ui-body">
        <ul className="lp-ui-rows">
          <li><span className="lp-muted">Subtotal</span><b className="lp-num">₡21&nbsp;500</b></li>
          <li><span className="lp-muted">Servicio 10%</span><b className="lp-num">₡2&nbsp;150</b></li>
          <li><span className="lp-muted">IVA 13%</span><b className="lp-num">₡2&nbsp;795</b></li>
          <li><b>Total</b><span className="lp-ui-value">₡26&nbsp;445</span></li>
        </ul>
        <div className="grid grid-cols-4 gap-2" style={{ marginTop: 12 }}>
          <div className="lp-ui-option">Efectivo</div>
          <div className="lp-ui-option" data-on="">SINPE</div>
          <div className="lp-ui-option">Tarjeta</div>
          <div className="lp-ui-option">Mixto</div>
        </div>
        <div className="lp-ui-btn" style={{ marginTop: 10 }}>Cobrar e imprimir tiquete</div>
      </div>
    </div>
  );
}

function Cierre() {
  return (
    <div className="lp-card lp-ui">
      <div className="lp-ui-bar">
        <div>
          <div className="lp-ui-title">Cierre de caja</div>
          <div className="lp-ui-sub">Viernes · 10:48 p. m.</div>
        </div>
        <span className="lp-chip lp-chip-ok"><Check aria-hidden="true" />Cuadra</span>
      </div>
      <div className="lp-ui-body">
        <ul className="lp-ui-rows">
          <li><span className="lp-muted">Efectivo esperado</span><b className="lp-num">₡171&nbsp;400</b></li>
          <li><span className="lp-muted">Efectivo contado</span><b className="lp-num">₡171&nbsp;400</b></li>
          <li><span className="lp-muted">Diferencia</span><b className="lp-num lp-ok-text">₡0</b></li>
          <li><span className="lp-muted">SINPE</span><b className="lp-num">₡142&nbsp;300</b></li>
          <li><span className="lp-muted">Tarjeta</span><b className="lp-num">₡95&nbsp;800</b></li>
          <li><b>Vendido en el día</b><span className="lp-ui-value">₡384&nbsp;500</span></li>
        </ul>
      </div>
    </div>
  );
}

const PASOS: { titulo: string; texto: string; plan: string; vista: ReactNode }[] = [
  {
    titulo: "Abrís caja",
    texto: "Anotás con cuánto arranca el día. Desde ahí, cada venta en efectivo y cada retiro de la caja quedan registrados.",
    plan: "Planes Pro y Premium",
    vista: <Apertura />,
  },
  {
    titulo: "El mesero toma la orden en la mesa",
    texto: "Desde el celular elige la mesa, marca los platos y escribe lo que pidió el cliente. Nadie tiene que correr a la cocina con un papel.",
    plan: "Plan Premium",
    vista: <Orden />,
  },
  {
    titulo: "Cocina y barra reciben lo suyo",
    texto: "La comanda se imprime sola: los platos en cocina y las bebidas en la barra. Si una mesa lleva mucho rato esperando, el sistema lo avisa.",
    plan: "Plan Premium",
    vista: <Tiquetes />,
  },
  {
    titulo: "Cobrás como te paguen",
    texto: "Efectivo, SINPE, tarjeta o una parte con cada uno. La cuenta sale de lo que se pidió, con el servicio y el impuesto ya sumados.",
    plan: "Planes Pro y Premium",
    vista: <Cobro />,
  },
  {
    titulo: "Cerrás caja y cuadra",
    texto: "Contás los billetes y las monedas, y el sistema lo compara con lo vendido. Si falta o sobra plata, lo ves esa misma noche.",
    plan: "Planes Pro y Premium",
    vista: <Cierre />,
  },
];

export default function ServiceTour() {
  const [active, setActive] = useState(0);
  // Avanza solo mientras la persona no haya elegido un paso; un clic o una flecha lo detiene. En
  // pantallas angostas el escenario no se muestra, así que ahí nunca avanza solo (movería la lectura).
  const [auto, setAuto] = useState(false);
  const stopped = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = stage.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!stopped.current) setAuto(entry.isIntersecting);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % PASOS.length), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [auto, active]);

  function choose(i: number) {
    stopped.current = true;
    setAuto(false);
    setActive(i);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + PASOS.length) % PASOS.length;
    choose(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="lp-tour" style={{ "--lp-tour-ms": `${AUTO_MS}ms` } as CSSProperties}>
      <div className="lp-tour-list" role="tablist" aria-label="Un día de servicio" aria-orientation="vertical">
        {PASOS.map((p, i) => {
          const selected = i === active;
          return (
            <Fragment key={p.titulo}>
            <button
              ref={(el) => { tabs.current[i] = el; }}
              type="button"
              role="tab"
              id={`lp-paso-${i}`}
              className="lp-tour-tab"
              aria-selected={selected}
              aria-controls="lp-paso-vista"
              tabIndex={selected ? 0 : -1}
              data-auto={auto}
              onClick={() => choose(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="lp-tour-n" aria-hidden="true">{i + 1}</span>
              <span>
                <strong>{p.titulo}</strong>
                {selected && (
                  <>
                    <span className="lp-tour-desc">{p.texto}</span>
                    <span className="lp-tour-plan">{p.plan}</span>
                  </>
                )}
              </span>
              <span className="lp-tour-progress" aria-hidden="true" />
            </button>
            {/* En pantallas angostas la vista va acá, debajo del paso; en las anchas, en el escenario fijo. */}
            {selected && <div className="lp-tour-inline" aria-hidden="true">{p.vista}</div>}
            </Fragment>
          );
        })}
      </div>

      <div ref={stage} className="lp-tour-stage" role="tabpanel" id="lp-paso-vista" aria-labelledby={`lp-paso-${active}`}>
        {/* La clave hace que cada vista entre con su propia animación al cambiar de paso. */}
        <div key={active} aria-hidden="true">{PASOS[active].vista}</div>
      </div>
    </div>
  );
}
