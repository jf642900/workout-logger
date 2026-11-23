// settingsEquipment.js — Equipment and Block sections of Settings (WP4a).
import { h, replace } from '../ui.js';
import { section, stepperRow } from './settingsParts.js';

export const PALETTE = [
  ['Blue', '#2563eb'], ['Yellow', '#eab308'], ['Red', '#dc2626'], ['Green', '#16a34a'],
  ['Black', '#1f2937'], ['Orange', '#ea580c'], ['Purple', '#9333ea'], ['Pink', '#db2777'],
  ['Teal', '#0d9488'], ['Grey', '#6b7280'],
];

function normaliseBands(bands) {
  return bands.map((b, i) => ({ ...b, order: i + 1 }));
}

function slug(name, taken) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'band';
  let id = base; let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

/**
 * Equipment section: dumbbell range and bands.
 * @param {{get:()=>object, save:(patch:object)=>Promise<void>, bandUsage:()=>Promise<Map<string,number>>}} api
 */
export function equipmentSection(api) {
  const box = h('div');
  let openPalette = null;

  async function draw() {
    const st = api.get();
    const usage = await api.bandUsage();
    const step = st.dumbbellStep || 5;
    const patch = async (p) => { await api.save(p); draw(); };
    const dumbbells = h('div', { class: 'list' },
      stepperRow({ label: 'Lightest dumbbell', value: st.dumbbellMin, display: `${st.dumbbellMin} lb`,
        onMinus: () => patch({ dumbbellMin: Math.max(step, st.dumbbellMin - step) }), minusDisabled: st.dumbbellMin <= step,
        onPlus: () => patch({ dumbbellMin: st.dumbbellMin + step }), plusDisabled: st.dumbbellMin + step > st.dumbbellMax }),
      stepperRow({ label: 'Heaviest dumbbell', value: st.dumbbellMax, display: `${st.dumbbellMax} lb`,
        onMinus: () => patch({ dumbbellMax: st.dumbbellMax - step }), minusDisabled: st.dumbbellMax - step < st.dumbbellMin,
        onPlus: () => patch({ dumbbellMax: st.dumbbellMax + step }) }),
      stepperRow({ label: 'Step', sub: 'Jump between weights', value: step, display: `${step} lb`,
        onMinus: () => patch({ dumbbellStep: Math.max(1, step - 1) }), minusDisabled: step <= 1,
        onPlus: () => patch({ dumbbellStep: step + 1 }) }));

    const bands = [...st.bands].sort((a, b) => a.order - b.order);
    const setBands = (next) => patch({ bands: normaliseBands(next) });
    const move = (i, d) => { const next = [...bands]; [next[i], next[i + d]] = [next[i + d], next[i]]; return setBands(next); };
    const bandRows = bands.map((b, i) => {
      const used = usage.get(b.id) || 0;
      const nameInput = h('input', { class: 'input settings-band__name', value: b.name, 'aria-label': `Name of ${b.name} band`, maxlength: '24' });
      nameInput.addEventListener('change', () => {
        const name = nameInput.value.trim();
        if (name) setBands(bands.map((x) => (x.id === b.id ? { ...x, name } : x)));
        else nameInput.value = b.name;
      });
      const palette = openPalette === b.id ? h('div', { class: 'settings-palette' }, PALETTE.map(([label, colour]) =>
        h('button', { class: ['settings-palette__dot', colour === b.colour && 'is-selected'], style: { background: colour },
          'aria-label': label, onClick: () => { openPalette = null; setBands(bands.map((x) => (x.id === b.id ? { ...x, colour } : x))); } }))) : null;
      return h('div', { class: 'settings-band' },
        h('div', { class: 'settings-band__line' },
          h('button', { class: 'settings-band__swatch', style: { background: b.colour }, 'aria-label': `Change colour of ${b.name}`,
            onClick: () => { openPalette = openPalette === b.id ? null : b.id; draw(); } }),
          nameInput,
          h('button', { class: 'btn-icon', 'aria-label': `Move ${b.name} lighter`, disabled: i === 0, onClick: () => move(i, -1) }, '↑'),
          h('button', { class: 'btn-icon', 'aria-label': `Move ${b.name} heavier`, disabled: i === bands.length - 1, onClick: () => move(i, 1) }, '↓'),
          h('button', { class: 'btn-icon settings-band__remove', 'aria-label': `Remove ${b.name}`, disabled: used > 0 || bands.length <= 1,
            onClick: () => { setBands(bands.filter((x) => x.id !== b.id)); } }, '×')),
        used > 0 ? h('div', { class: 'settings-band__note muted' }, `Used by ${used} logged ${used === 1 ? 'set' : 'sets'}, so it cannot be removed`) : null,
        palette);
    });
    const add = h('button', { class: 'btn btn-secondary btn-block settings-add', onClick: () => {
      const taken = new Set(bands.map((b) => b.id));
      const unused = PALETTE.find(([, c]) => !bands.some((b) => b.colour === c)) || PALETTE[0];
      const name = 'New band';
      setBands([...bands, { id: slug(`${name} ${bands.length + 1}`, taken), name, colour: unused[1], order: bands.length + 1 }]);
    } }, 'Add a band');

    replace(box,
      h('h3', { class: 'settings-subtitle' }, 'Dumbbells'), dumbbells,
      h('h3', { class: 'settings-subtitle' }, 'Bands, lightest to heaviest'),
      h('div', { class: 'card card--tight settings-bands' }, bandRows), add);
  }
  draw();
  return section('Equipment', box);
}

/** Block section: start date, length and deload weeks. */
export function blockSection(api) {
  const box = h('div');
  function draw() {
    const st = api.get();
    const patch = async (p) => { await api.save(p); draw(); };
    const date = h('input', { type: 'date', class: 'input settings-date', value: st.blockStartDate, 'aria-label': 'Block start date' });
    date.addEventListener('change', () => { if (date.value) patch({ blockStartDate: date.value }); });
    const weeks = Array.from({ length: st.blockWeeks }, (_, i) => i + 1);
    replace(box,
      h('div', { class: 'list' },
        h('div', { class: 'list-row settings-row' }, h('div', { class: 'list-row__main list-row__title' }, 'Start date'), date),
        stepperRow({ label: 'Length', display: `${st.blockWeeks} weeks`, value: st.blockWeeks,
          onMinus: () => patch({ blockWeeks: st.blockWeeks - 1, deloadWeeks: st.deloadWeeks.filter((w) => w < st.blockWeeks) }), minusDisabled: st.blockWeeks <= 1,
          onPlus: () => patch({ blockWeeks: st.blockWeeks + 1 }), plusDisabled: st.blockWeeks >= 26 })),
      h('div', { class: 'card' },
        h('div', { class: 'list-row__title' }, 'Deload weeks'),
        h('div', { class: 'list-row__sub' }, 'Weeks to aim for half your normal sets'),
        h('div', { class: 'settings-chips' }, weeks.map((w) => {
          const on = st.deloadWeeks.includes(w);
          return h('button', { class: ['chip', 'settings-chip', on && 'is-selected'], 'aria-pressed': String(on), onClick: () =>
            patch({ deloadWeeks: (on ? st.deloadWeeks.filter((x) => x !== w) : [...st.deloadWeeks, w]).sort((a, b) => a - b) }) }, String(w));
        }))));
  }
  draw();
  return section('Block', box);
}
