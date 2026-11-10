import { Check, ChevronDown, Minus } from "lucide-react";
import { PLAN_KEYS, PLAN_LABELS, type PlanKey } from "@/lib/billing";
import { PLAN_CARDS, PLAN_MATRIX, type PlanCell } from "@/lib/planes";
import { colones, waLink } from "./shared";

function Celda({ value }: { value: PlanCell }) {
  if (value === true) return <><Check aria-hidden="true" /><span className="sr-only">Incluido</span></>;
  if (value === false) return <><Minus className="lp-no" aria-hidden="true" /><span className="sr-only">No incluido</span></>;
  return <b>{value}</b>;
}

export default function Pricing({ prices }: { prices: Record<PlanKey, number> }) {
  return (
    <section id="planes" className="lp-section lp-section--blue" aria-labelledby="lp-planes">
      <div className="lp-wrap">
        <div className="lp-head lp-head--center" data-reveal>
          <span className="lp-eyebrow">Planes</span>
          <h2 id="lp-planes" className="lp-h2">Un plan según cómo trabaja tu negocio.</h2>
          <p className="lp-lead">Sin contratos: pagás mes a mes y cambiás de plan cuando tu negocio lo pida.</p>
        </div>

        <div className="lp-plans" data-reveal>
          {PLAN_CARDS.map((plan) => {
            const name = PLAN_LABELS[plan.key];
            return (
              <article key={plan.key} className="lp-plan" data-featured={plan.destacado ? "" : undefined}>
                {plan.destacado && <span className="lp-plan-tag">Recomendado para restaurantes</span>}
                <h3 className="lp-plan-name">{name}</h3>
                <p className="lp-plan-for">{plan.para}</p>
                <p className="lp-plan-price">
                  <b>{colones(prices[plan.key])}</b>
                  <span>al mes</span>
                </p>
                <a
                  className={`lp-btn lp-btn-block ${plan.destacado ? "lp-btn-primary" : "lp-btn-secondary"}`}
                  href={waLink(`Hola, me interesa el plan ${name} de VendeFácil.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quiero el plan {name}
                </a>
                <p className="lp-plan-more">{plan.parteDe ? `Todo lo de ${PLAN_LABELS[plan.parteDe]}, más:` : "Incluye:"}</p>
                <ul className="lp-plan-list">
                  {plan.incluye.map((item) => (
                    <li key={item}><Check aria-hidden="true" /><span>{item}</span></li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <details className="lp-details" data-reveal>
          <summary>
            Comparar los planes punto por punto
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className="lp-matrix-wrap">
            <table className="lp-matrix">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Función</span></th>
                  {PLAN_KEYS.map((k) => <th key={k} scope="col">{PLAN_LABELS[k]}</th>)}
                </tr>
              </thead>
              <tbody>
                {PLAN_MATRIX.flatMap((g) => [
                  <tr key={g.grupo} className="lp-matrix-group"><th scope="colgroup" colSpan={4}>{g.grupo}</th></tr>,
                  ...g.filas.map((f) => (
                    <tr key={`${g.grupo}-${f.que}`}>
                      <th scope="row">{f.que}</th>
                      {f.planes.map((v, i) => <td key={PLAN_KEYS[i]}><Celda value={v} /></td>)}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </details>

        <p className="lp-plans-note">
          Configuración inicial única desde {colones(19900)}: cargamos tus productos y capacitamos a tu equipo.
        </p>
      </div>
    </section>
  );
}
