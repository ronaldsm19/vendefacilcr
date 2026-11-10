"use client";

import { useState, type CSSProperties } from "react";
import { colones } from "./shared";

interface Campo { id: string; label: string; min: number; max: number; step: number; minLabel: string; maxLabel: string }

const META: Campo = { id: "lp-meta", label: "¿Cuánto querés vender este mes?", min: 500_000, max: 20_000_000, step: 100_000, minLabel: "₡500 mil", maxLabel: "₡20 millones" };
const DIAS: Campo = { id: "lp-dias", label: "¿Cuántos días abrís al mes?", min: 12, max: 31, step: 1, minLabel: "12", maxLabel: "31" };
const TIQUETE: Campo = { id: "lp-tiquete", label: "¿Cuánto gasta un cliente, en promedio?", min: 2_000, max: 25_000, step: 500, minLabel: "₡2 000", maxLabel: "₡25 000" };

function Deslizador({ campo, value, texto, onChange }: { campo: Campo; value: number; texto: string; onChange: (v: number) => void }) {
  const fill = ((value - campo.min) / (campo.max - campo.min)) * 100;
  return (
    <div className="lp-calc-field">
      <label htmlFor={campo.id}>
        <span>{campo.label}</span>
        <output htmlFor={campo.id}>{texto}</output>
      </label>
      <input
        id={campo.id}
        className="lp-range"
        type="range"
        min={campo.min}
        max={campo.max}
        step={campo.step}
        value={value}
        aria-valuetext={texto}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="lp-calc-scale" aria-hidden="true"><span>{campo.minLabel}</span><span>{campo.maxLabel}</span></div>
    </div>
  );
}

/** Parte una meta mensual en lo que hay que vender cada día. Es una cuenta, no una promesa de resultado. */
export default function GoalCalculator() {
  const [meta, setMeta] = useState(4_000_000);
  const [dias, setDias] = useState(26);
  const [tiquete, setTiquete] = useState(6_500);

  const porDia = Math.ceil(meta / dias / 100) * 100;
  const clientesDia = Math.ceil(porDia / tiquete);
  const tresMas = 3 * tiquete * dias;
  const quinientosMas = 500 * clientesDia * dias;

  return (
    <div className="lp-calc">
      <div className="lp-calc-fields">
        <Deslizador campo={META} value={meta} texto={colones(meta)} onChange={setMeta} />
        <Deslizador campo={DIAS} value={dias} texto={`${dias} días`} onChange={setDias} />
        <Deslizador campo={TIQUETE} value={tiquete} texto={colones(tiquete)} onChange={setTiquete} />
      </div>

      <div className="lp-calc-result" aria-live="polite">
        <span className="lp-ui-label" style={{ fontSize: "0.95rem" }}>Para llegar, cada día tenés que vender</span>
        <p className="lp-calc-big">{colones(porDia)}</p>
        <ul className="lp-calc-list">
          <li><span>Eso es atender, cada día, a</span><b>{clientesDia} clientes</b></li>
          <li><span>Con 3 clientes más por día sumás</span><b className="lp-ok-text">+{colones(tresMas)} al mes</b></li>
          <li><span>Si cada cliente gasta ₡500 más, sumás</span><b className="lp-ok-text">+{colones(quinientosMas)} al mes</b></li>
        </ul>
        <p className="lp-calc-foot">
          VendeFácil te muestra cada noche cuánto vendiste hoy y cuánto llevás en el mes. Así sabés si vas a tiempo
          cuando todavía se puede hacer algo.
        </p>
      </div>
    </div>
  );
}
