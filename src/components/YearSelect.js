'use client';

import { setYear } from '@/app/years/actions';

export default function YearSelect({ years, current }) {
  return (
    <form action={setYear} className="year">
      <label htmlFor="year-select">평가연도</label>
      <select id="year-select" name="year" defaultValue={current} onChange={(e) => e.target.form.requestSubmit()}>
        {years.map((y) => (
          <option key={y.year} value={y.year}>
            {y.year}{y.closed ? ' (마감)' : ''}
          </option>
        ))}
      </select>
    </form>
  );
}
