import { useEffect, useState } from 'react';
import {
  offerDefinitions,
  offerPriceCents,
  offerSelectionError,
  selectionCount,
  formatMoney,
} from '@impresion3d/shared';
import { api } from './api.js';
import './OfferDetails.css';

export function OfferDetails({
  id,
  initial,
  onDraft,
  onAdd,
  onContinue,
  authReady,
  inCart,
}) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [mode, setMode] = useState(
    initial?.mode || offerDefinitions[id]?.mode || 'pack',
  );
  const [selections, setSelections] = useState(initial?.selections || []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    api('/offers/' + encodeURIComponent(id), { signal: controller.signal })
      .then((data) => {
        if (active) setState({ loading: false, data, error: '' });
      })
      .catch((error) => {
        if (active)
          setState({ loading: false, data: null, error: error.message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);
  useEffect(() => {
    onDraft({ id, mode, selections });
  }, [id, mode, selections]);
  if (state.loading)
    return (
      <section className="offer-details">
        <p role="status">Cargando oferta…</p>
      </section>
    );
  if (!state.data)
    return (
      <section className="offer-details">
        <h1>Oferta no disponible</h1>
        <p role="alert">{state.error}</p>
        <button className="outline" onClick={onContinue}>
          Continuar comprando
        </button>
      </section>
    );
  const offer = { id, mode, selections };
  const data = state.data;
  const count = selectionCount(selections);
  const limit =
    id === 'navidad-combo'
      ? 4
      : id === 'navidad-bolas'
        ? mode === 'single'
          ? 1
          : 6
        : 20;
  const error = offerSelectionError(offer);
  const stale = selections.some(
    (s) => !data.options.some((o) => o.id === s.id),
  );
  const valid = !error && !stale;
  const toggle = (option) =>
    setSelections((current) =>
      current.some((s) => s.id === option.id)
        ? current.filter((s) => s.id !== option.id)
        : [...current, { id: option.id, quantity: 1 }],
    );
  const changeQuantity = (optionId, quantity) =>
    setSelections((current) =>
      current.map((s) => (s.id === optionId ? { ...s, quantity } : s)),
    );
  return (
    <section className="offer-details" aria-labelledby="offer-detail-title">
      <div className="offer-details-intro">
        <div>
          <p className="eyebrow">OFERTA MUNDO 3D</p>
          <h1 id="offer-detail-title">{data.name}</h1>
          <p>{data.description}</p>
          <p className="offer-selection-rule">
            {id === 'navidad-combo'
              ? 'La oferta incluye la bandeja y solo 4 adornos diferentes. Seleccioná exactamente 4 para habilitar el carrito.'
              : id === 'navidad-bolas'
                ? 'Elegí una unidad o completá las 6 bolas del pack, con los colores que prefieras.'
                : 'Seleccioná los diseños y ajustá sus cantidades. Desde 5 unidades, cada llavero cuesta $2.000.'}
          </p>
        </div>
        <img
          className="offer-detail-photo"
          src={data.image}
          width="1200"
          height="800"
          alt={data.name}
        />
      </div>
      {id === 'navidad-bolas' && (
        <fieldset className="offer-mode">
          <legend>Elegí la presentación</legend>
          <label>
            <input
              type="radio"
              name="presentation"
              checked={mode === 'single'}
              onChange={() => {
                setMode('single');
                setSelections([]);
              }}
            />
            1 bola · $3.000
          </label>
          <label>
            <input
              type="radio"
              name="presentation"
              checked={mode === 'pack'}
              onChange={() => {
                setMode('pack');
                setSelections([]);
              }}
            />
            6 bolas · $15.000
          </label>
        </fieldset>
      )}
      <div className="offer-selection-heading">
        <h2>
          {id === 'navidad-combo'
            ? 'Elegí tus 4 adornos tejidos'
            : id === 'navidad-bolas'
              ? 'Elegí los colores'
              : 'Elegí tus llaveros'}
        </h2>
        <p role="status">
          Seleccionados:{' '}
          <strong>
            {count} / {limit}
          </strong>
          {id === 'llaveros' ? ' unidades' : ''}
        </p>
      </div>
      <button
        className="outline"
        type="button"
        onClick={() => setSelections([])}
      >
        Limpiar selección
      </button>
      <div className="offer-options">
        {data.options.map((option) => {
          const selected = selections.find((s) => s.id === option.id);
          const disabled = !selected && count >= limit;
          return (
            <div
              className={'offer-option' + (selected ? ' is-selected' : '')}
              key={option.id}
            >
              <label className="offer-option-check">
                {option.spriteIndex !== undefined ? (
                  <span
                    className="ball-option-photo"
                    role="img"
                    aria-label={'Bola tejida ' + option.name}
                    style={{
                      backgroundPosition: `${(option.spriteIndex % 3) * 50}% ${Math.floor(option.spriteIndex / 3) * 100}%`,
                    }}
                  />
                ) : option.image ? (
                  <img
                    src={option.image}
                    alt={option.name}
                    width="300"
                    height="300"
                    loading="lazy"
                  />
                ) : (
                  <span className="offer-option-placeholder">
                    Imagen no disponible
                  </span>
                )}
                <span className="offer-option-label">
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    disabled={disabled}
                    onChange={() => toggle(option)}
                    aria-label={'Elegir ' + option.name}
                  />
                  <span>{option.name}</span>
                </span>
              </label>
              {selected && id !== 'navidad-combo' && (
                <label className="offer-option-quantity">
                  Cantidad de {option.name}
                  <select
                    aria-label={'Cantidad de ' + option.name}
                    value={selected.quantity}
                    onChange={(event) =>
                      changeQuantity(option.id, Number(event.target.value))
                    }
                  >
                    {Array.from(
                      { length: limit - count + selected.quantity },
                      (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>
      <div className="offer-selection-summary">
        {stale && (
          <p role="alert">
            Una opción anterior ya no está disponible. Actualizá tu selección.
          </p>
        )}
        <p className="offer-selection-progress">
          {valid ? 'Tu selección está completa.' : error}
        </p>
        <p className="offer-detail-total">
          Total de esta oferta:{' '}
          <strong>{formatMoney(offerPriceCents(offer), 'ARS')}</strong>
        </p>
        {id === 'llaveros' && count > 0 && (
          <p>
            {count} llavero{count === 1 ? '' : 's'} ·{' '}
            {formatMoney(count >= 5 ? 200000 : 300000, 'ARS')} por unidad.
          </p>
        )}
        <div className="offer-detail-actions">
          <button
            className="primary"
            disabled={!authReady || !valid}
            onClick={() =>
              onAdd(
                { productId: data.productId, quantity: 1, offer },
                data.name,
              )
            }
          >
            {inCart ? 'Actualizar selección del carrito' : 'Agregar al carrito'}
          </button>
          <button className="outline" onClick={onContinue}>
            Continuar comprando
          </button>
        </div>
        <p className="small">
          El pago y la entrega se coordinan después de revisar el pedido.{' '}
          {inCart
            ? 'Ya tenés esta oferta en el carrito; podés actualizar sus opciones antes de enviar.'
            : 'La selección se guarda en tu carrito al agregar la oferta.'}
        </p>
      </div>
    </section>
  );
}
