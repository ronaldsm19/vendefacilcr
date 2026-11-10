import { Camera, Check, HandCoins, Link2, Scale, TrendingUp } from "lucide-react";
import ServiceTour from "./ServiceTour";
import GoalCalculator from "./GoalCalculator";

// ── El problema ────────────────────────────────────────────────────────────────

const CADENA = [
  { titulo: "La orden va en un papel", texto: "Llega tarde a cocina, o llega sin el «sin cebolla»." },
  { titulo: "Se cobra de memoria", texto: "Un fresco que nadie anotó, una cuenta mal sumada." },
  { titulo: "La caja no cuadra al cierre", texto: "Y no hay forma de saber si faltó un billete o sobró un vuelto." },
  { titulo: "Las facturas quedan en una gaveta", texto: "Lo que se le pagó a los proveedores nunca se termina de sumar." },
  { titulo: "Llega fin de mes y no hay un número", texto: "No se sabe si se ganó, cuánto, ni qué cambiar el mes que viene." },
];

export function Problem() {
  return (
    <section className="lp-section" aria-labelledby="lp-problema">
      <div className="lp-wrap lp-split">
        <div className="lp-split-sticky" data-reveal>
          <span className="lp-eyebrow">Por qué cuesta llegar</span>
          <h2 id="lp-problema" className="lp-h2">Vender mucho no siempre es ganar bien.</h2>
          <p className="lp-lead">
            Un restaurante puede tener las mesas llenas y cerrar el mes sin saber adónde se fue la plata. Casi nunca
            es una sola cosa. Es una cadena de cosas chicas que nadie alcanza a anotar.
          </p>
        </div>
        <div data-reveal>
          <ol className="lp-chain">
            {CADENA.map((c, i) => (
              <li key={c.titulo} data-end={i === CADENA.length - 1 ? "" : undefined}>
                <div>
                  <strong>{c.titulo}</strong>
                  <p>{c.texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="lp-callout">
            <Link2 aria-hidden="true" />
            <span>VendeFácil deja anotado cada uno de esos pasos mientras trabajás, sin pedirte trabajo aparte.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Un día de servicio ─────────────────────────────────────────────────────────

export function Service() {
  return (
    <section id="como-funciona" className="lp-section lp-section--blue" aria-labelledby="lp-servicio">
      <div className="lp-wrap">
        <div className="lp-head" data-reveal>
          <span className="lp-eyebrow">En el salón, la cocina y la caja</span>
          <h2 id="lp-servicio" className="lp-h2">Un día de servicio, de la primera mesa al cierre.</h2>
          <p className="lp-lead">Así se ve un turno cuando cada orden, cada cobro y cada colón quedan en el mismo lugar.</p>
        </div>
        <div data-reveal>
          <ServiceTour />
        </div>
      </div>
    </section>
  );
}

// ── Tus números ────────────────────────────────────────────────────────────────

const SEMANAS = [
  { ingresos: 80, gastos: 61 },
  { ingresos: 90, gastos: 66 },
  { ingresos: 88, gastos: 60 },
  { ingresos: 100, gastos: 63 },
];

const PUNTOS = [
  {
    icon: TrendingUp,
    titulo: "La ganancia, no solo las ventas",
    texto: "Ingresos, gastos, ganancia y margen del mes en una pantalla, con los productos que más plata dejaron.",
  },
  {
    icon: Camera,
    titulo: "Gastos sin digitar",
    texto: "Le tomás una foto a la factura del proveedor y el sistema llena el proveedor, la fecha y los montos.",
  },
  {
    icon: Scale,
    titulo: "Cuánto te deja cada plato",
    texto: "Con tus recetas y el precio de los ingredientes ves el costo y la ganancia de cada unidad.",
  },
  {
    icon: HandCoins,
    titulo: "El 10% de servicio, repartido con cuentas claras",
    texto: "Se calcula según las horas que trabajó cada persona. Disponible en el plan Premium.",
  },
];

function Finanzas() {
  return (
    <div aria-hidden="true">
      <div className="lp-card lp-ui">
        <div className="lp-ui-bar">
          <div>
            <div className="lp-ui-title">Finanzas</div>
            <div className="lp-ui-sub">Noviembre</div>
          </div>
          <span className="lp-chip">Por semana</span>
        </div>
        <div className="lp-ui-body" style={{ padding: 20 }}>
          <div className="lp-stats">
            <div><div className="lp-ui-label">Ingresos</div><div className="lp-ui-value">₡4&nbsp;120&nbsp;000</div></div>
            <div><div className="lp-ui-label">Gastos</div><div className="lp-ui-value">₡2&nbsp;870&nbsp;000</div></div>
            <div><div className="lp-ui-label">Ganancia</div><div className="lp-ui-value lp-ok-text">₡1&nbsp;250&nbsp;000</div></div>
            <div><div className="lp-ui-label">Margen</div><div className="lp-ui-value">30%</div></div>
          </div>
          <div className="lp-bars" style={{ marginTop: 22 }}>
            {SEMANAS.map((s, i) => (
              <div key={i}>
                <i style={{ height: `${s.ingresos}%` }} />
                <i style={{ height: `${s.gastos}%` }} />
              </div>
            ))}
          </div>
          <div className="lp-legend" style={{ marginTop: 12 }}>
            <span><i />Ingresos</span>
            <span><i />Gastos</span>
          </div>
        </div>
      </div>

      <div className="lp-card lp-ui" style={{ marginTop: 16 }}>
        <div className="lp-ui-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <span className="lp-chip lp-chip-ok"><Check aria-hidden="true" />Leída de la foto</span>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Distribuidora La Central</div>
            <div className="lp-ui-sub">12 de noviembre · Materia prima</div>
          </div>
          <div className="lp-ui-value" style={{ fontSize: 20 }}>₡84&nbsp;300</div>
        </div>
      </div>
    </div>
  );
}

export function Numbers() {
  return (
    <section id="numeros" className="lp-section" aria-labelledby="lp-numeros">
      <div className="lp-wrap lp-split lp-split--wide">
        <div data-reveal>
          <span className="lp-eyebrow">En tus números</span>
          <h2 id="lp-numeros" className="lp-h2">Sabé cómo va el mes antes de que termine.</h2>
          <p className="lp-lead">
            La meta no se cumple el día 30. Se cumple revisando los números cada semana, cuando todavía hay tiempo de
            corregir.
          </p>
          <ul className="lp-points">
            {PUNTOS.map((p) => (
              <li key={p.titulo}>
                <p.icon aria-hidden="true" />
                <div>
                  <strong>{p.titulo}</strong>
                  <p>{p.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div data-reveal>
          <Finanzas />
        </div>
      </div>
    </section>
  );
}

// ── La meta, por día ───────────────────────────────────────────────────────────

export function Goal() {
  return (
    <section className="lp-section lp-section--navy" aria-labelledby="lp-meta-titulo">
      <div className="lp-wrap">
        <div className="lp-head" data-reveal>
          <span className="lp-eyebrow">Tu meta, en números de todos los días</span>
          <h2 id="lp-meta-titulo" className="lp-h2">Ponele número a tu meta del mes.</h2>
          <p className="lp-lead">
            Una meta mensual se ve lejos. Partida por día se vuelve algo que podés revisar cada noche al cerrar caja.
            Mové los valores y hacé la cuenta con tu negocio.
          </p>
        </div>
        <div data-reveal>
          <GoalCalculator />
        </div>
      </div>
    </section>
  );
}

// ── Antes y después ────────────────────────────────────────────────────────────

const CAMBIOS = [
  { que: "La orden", antes: "Un papel que va y viene de la cocina.", despues: "Sale impresa en cocina y en barra, con las notas del cliente." },
  { que: "La cuenta", antes: "Sumada a mano, con lo que el mesero se acordó.", despues: "Sale de lo que se pidió, con servicio e impuesto." },
  { que: "La caja", antes: "Se cuenta al final y «más o menos da».", despues: "Lo contado contra lo vendido, con la diferencia a la vista." },
  { que: "Los gastos", antes: "Facturas guardadas para cuando haya tiempo.", despues: "Una foto por factura y queda registrada." },
  { que: "El inventario", antes: "Te das cuenta cuando ya se acabó.", despues: "Las existencias bajan con cada venta." },
  { que: "Fin de mes", antes: "Una sensación.", despues: "Un número: cuánto entró, cuánto salió y cuánto quedó." },
];

export function Compare() {
  return (
    <section className="lp-section" aria-labelledby="lp-cambios">
      <div className="lp-wrap">
        <div className="lp-head" data-reveal>
          <h2 id="lp-cambios" className="lp-h2">Lo que cambia cuando todo queda anotado.</h2>
        </div>
        <div className="lp-compare" data-reveal role="table" aria-label="Cómo se trabaja hoy y cómo se trabaja con VendeFácil">
          <div className="lp-compare-row lp-compare-head" role="row">
            <span role="columnheader"><span className="sr-only">Qué</span></span>
            <span role="columnheader">Hoy</span>
            <span role="columnheader">Con VendeFácil</span>
          </div>
          {CAMBIOS.map((c) => (
            <div key={c.que} className="lp-compare-row" role="row">
              <span className="lp-compare-what" role="rowheader">{c.que}</span>
              <span className="lp-compare-before" role="cell">{c.antes}</span>
              <span className="lp-compare-after" role="cell"><Check aria-hidden="true" /><span>{c.despues}</span></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Cómo se empieza ────────────────────────────────────────────────────────────

const PRIMER_MES = [
  { dia: "Día 1", texto: "Abrís caja con tu menú y tus precios ya cargados." },
  { dia: "Día 3", texto: "Las órdenes ya salen impresas en cocina." },
  { dia: "Día 7", texto: "Primera semana: ves cuánto entró y qué se vendió más." },
  { dia: "Día 15", texto: "A mitad de mes sabés cuánto llevás y cuánto falta." },
  { dia: "Día 30", texto: "Cerrás el mes con la ganancia en pantalla." },
];

export function Start() {
  return (
    <section className="lp-section lp-section--warm" aria-labelledby="lp-empezar">
      <div className="lp-wrap">
        <div className="lp-head" data-reveal>
          <span className="lp-eyebrow">Para empezar</span>
          <h2 id="lp-empezar" className="lp-h2">Empezás esta semana, con tu menú ya cargado.</h2>
          <p className="lp-lead">No tenés que instalar nada ni aprender un sistema por tu cuenta. Lo dejamos listo con vos.</p>
        </div>
        <ol className="lp-steps" data-reveal>
          <li>
            <h3 className="lp-h3">Nos escribís por WhatsApp</h3>
            <p>Nos contás cómo trabaja tu negocio y te mostramos el sistema funcionando, con ejemplos parecidos al tuyo.</p>
          </li>
          <li>
            <h3 className="lp-h3">Lo dejamos configurado</h3>
            <p>Cargamos tus productos y tus precios, y dejamos listo lo que incluya tu plan: la caja, las mesas, la impresión.</p>
          </li>
          <li>
            <h3 className="lp-h3">Capacitamos a tu equipo</h3>
            <p>En una sesión corta cada quien aprende lo suyo: mesero, caja y dueño. Después seguimos por WhatsApp.</p>
          </li>
        </ol>
        <div className="lp-month" data-reveal>
          <h3 className="lp-h3">Tu primer mes</h3>
          <ol className="lp-month-list">
            {PRIMER_MES.map((m) => (
              <li key={m.dia}><b>{m.dia}</b><span>{m.texto}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
