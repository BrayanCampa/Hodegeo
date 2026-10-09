import { useEffect, useRef, useState } from 'react';
import { isValidPhone } from '../services/sos';
import { store } from '../state/store';
import { useStore } from '../state/useStore';
import type { Contact } from '../state/appTypes';

const MAX_CONTACTS = 5;
const HOLD_MS = 1500;

function newContact(): Contact {
  return { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), name: '', phone: '+502' };
}

/** Pantalla S.O.S: contactos de confianza + botón gigante con pulsación sostenida. */
export function Sos() {
  const contacts = useStore((s) => s.contacts);
  const [draft, setDraft] = useState<Contact | null>(null);
  const [error, setError] = useState('');
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
  }, []);

  function startHold(): void {
    if (holding) return;
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      setHolding(false);
      holdTimer.current = null;
      store.sosStart('pantalla');
    }, HOLD_MS);
  }

  function cancelHold(): void {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  }

  function saveDraft(): void {
    if (!draft) return;
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    if (name.length < 2) {
      setError('Escribe un nombre válido.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Teléfono inválido. Usa código de país, por ejemplo +502 5555 5555.');
      return;
    }
    const exists = contacts.some((c) => c.id === draft.id);
    if (!exists && contacts.length >= MAX_CONTACTS) {
      setError(`Puedes guardar hasta ${MAX_CONTACTS} contactos.`);
      return;
    }
    store.saveContact({ ...draft, name, phone });
    setDraft(null);
    setError('');
  }

  function editContact(c: Contact): void {
    setDraft({ ...c });
    setError('');
  }

  return (
    <>
      <section className="card" aria-label="Botón de emergencia">
        <h2 className="card__title">Emergencia</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Mantén presionado 1.5 s para activar el S.O.S. También se activa con la pulsación larga del
          bastón.
        </p>
        <button
          type="button"
          className={`sos-btn${holding ? ' sos-btn--holding' : ''}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            startHold();
          }}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') startHold();
          }}
          onKeyUp={(e) => {
            if (e.key === 'Enter' || e.key === ' ') cancelHold();
          }}
          disabled={contacts.length === 0}
          aria-label="Mantén presionado para activar el S.O.S"
        >
          <span className="sos-btn__icon" aria-hidden="true">
            🆘
          </span>
          <span className="sos-btn__label">{holding ? 'Suelta para cancelar…' : 'S.O.S'}</span>
          <span className="sos-btn__ring" aria-hidden="true" />
        </button>
        {contacts.length === 0 && (
          <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
            Agrega al menos un contacto de confianza para habilitar el S.O.S.
          </p>
        )}
      </section>

      <section className="card" aria-label="Contactos de confianza">
        <div className="row">
          <h2 className="card__title" style={{ margin: 0 }}>
            Contactos ({contacts.length}/{MAX_CONTACTS})
          </h2>
          <button
            type="button"
            className="btn btn--navy"
            style={{ minHeight: 44 }}
            disabled={contacts.length >= MAX_CONTACTS || draft !== null}
            onClick={() => {
              setDraft(newContact());
              setError('');
            }}
          >
            + Agregar
          </button>
        </div>

        <ul className="contact-list">
          {contacts.map((c) => (
            <li key={c.id} className="contact-item">
              <div>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div className="muted">{c.phone}</div>
              </div>
              <div className="contact-item__actions">
                <button type="button" className="btn btn--ghost" style={{ minHeight: 44 }} onClick={() => editContact(c)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ minHeight: 44 }}
                  onClick={() => store.removeContact(c.id)}
                  aria-label={`Eliminar contacto ${c.name}`}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
          {contacts.length === 0 && <li className="muted" style={{ padding: 8 }}>Aún no hay contactos.</li>}
        </ul>

        {draft && (
          <form
            className="contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveDraft();
            }}
          >
            <label>
              Nombre
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej. Mamá"
                autoComplete="name"
              />
            </label>
            <label>
              Teléfono (con código de país)
              <input
                className="input"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="+502 5555 5555"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            {error && (
              <p className="notice notice--warn" role="alert">
                {error}
              </p>
            )}
            <div className="btn-row">
              <button type="submit" className="btn btn--primary">
                Guardar
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
