import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

/** Lo que guarda el sitio: nada (seguir el sistema) o un esquema fijado por el usuario. */
type Esquema = 'light dark' | 'light' | 'dark';

const CLAVE = 'color-scheme';

/**
 * Tema claro/oscuro. Por defecto sigue la preferencia del sistema; el usuario puede invertirla.
 * El valor se refleja en <meta name="color-scheme"> (index.html lo aplica antes de pintar para evitar
 * el destello) y styles.scss traduce ese meta a la propiedad CSS color-scheme.
 * Los gráficos ECharts no leen CSS, por eso exponemos `oscuro` como señal.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private doc = inject(DOCUMENT);
  private meta = this.doc.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  private consulta = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  private readonly esquema = signal<Esquema>(leer(this.meta?.content));
  private readonly sistemaOscuro = signal(this.consulta?.matches ?? false);

  /** Esquema que se está viendo ahora. */
  readonly oscuro = computed(() => {
    const e = this.esquema();
    return e === 'light dark' ? this.sistemaOscuro() : e === 'dark';
  });

  constructor() {
    this.consulta?.addEventListener('change', e => this.sistemaOscuro.set(e.matches));
    // Otra pestaña cambió el tema.
    this.doc.defaultView?.addEventListener('storage', e => {
      if (e.key === CLAVE || e.key === null) this.aplicar(leer(e.newValue));
    });
  }

  /** Pasa al esquema contrario del que se ve. Si coincide con el del sistema, deja de fijarlo. */
  alternar() {
    const objetivo = this.oscuro() ? 'light' : 'dark';
    const delSistema = this.sistemaOscuro() ? 'dark' : 'light';
    const nuevo: Esquema = objetivo === delSistema ? 'light dark' : objetivo;
    try {
      if (nuevo === 'light dark') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Sin almacenamiento el cambio igual se aplica en esta visita.
    }
    this.aplicar(nuevo);
  }

  private aplicar(e: Esquema) {
    if (this.meta) this.meta.content = e;
    this.esquema.set(e);
  }
}

function leer(v: string | null | undefined): Esquema {
  return v === 'light' || v === 'dark' ? v : 'light dark';
}
