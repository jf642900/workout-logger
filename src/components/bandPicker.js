// bandPicker.js — band colour chips, light → heavy (WP1).
import { h } from '../ui.js';

/**
 * @param {{bands:{id:string,name:string,colour:string,order:number}[], selected:string|null,
 *   onSelect:(bandId:string)=>void, large?:boolean}} opts
 * @returns {HTMLElement}
 */
export function BandPicker({ bands, selected, onSelect, large = false }) {
  const sorted = [...bands].sort((a, b) => a.order - b.order);
  const chips = sorted.map((b) => h('button', {
    class: ['ex-band', b.id === selected && 'is-selected'], type: 'button',
    'aria-pressed': b.id === selected ? 'true' : 'false', dataset: { band: b.id },
    onClick: () => {
      for (const c of chips) {
        const on = c.dataset.band === b.id;
        c.classList.toggle('is-selected', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      onSelect(b.id);
    },
  }, h('span', { class: 'band-swatch', style: { background: b.colour } }), h('span', null, b.name)));
  return h('div', { class: ['ex-bands', large && 'ex-bands--large'], role: 'group', 'aria-label': 'Band' }, chips);
}
