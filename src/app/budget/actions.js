'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_CATEGORIES, REVIEW_CATEGORY, classify, ensureBudgetDefaults, listRules, parseErp, parsePlanSheet } from '@/lib/budget';

const clean = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
};
const money = (v) => {
  const s = String(v ?? '').replace(/[^0-9-]/g, '');
  return s ? Number(s) : null;
};
const key = (s) => s.replace(/\s/g, '').replace(/\(.*$/, '');

// 비고 낱말 → (구분, 상태). 낱말이 없고 수선비 계정이면 검토 후보, 아니면 null(안전보건 관련 아님)
function decide(e, rules) {
  const r = classify(e.memo, rules);
  if (r) return r.category === '제외' ? { category: null, status: '제외', rule: r.keyword } : { category: r.category, status: '자동', rule: r.keyword };
  if (/수선비/.test(e.accounts ?? '')) return { category: REVIEW_CATEGORY, status: '검토', rule: '수선비 계정' };
  return null;
}

// 기존 예산 엑셀(편성 시트 + 계정내역) 또는 ERP 계정내역 엑셀 가져오기
export async function importBudget(formData) {
  await requireAdmin();
  const year = Number(formData.get('year'));
  const file = formData.get('file');
  if (!file || typeof file === 'string' || !file.size) throw new Error('엑셀 파일을 골라 주세요.');
  ensureBudgetDefaults(year);
  const buf = Buffer.from(await file.arrayBuffer());
  const db = getDb();
  const out = { plans: 0, added: 0, updated: 0, review: 0, skipped: 0 };

  // 편성 시트가 있으면 편성액·편성내역을 넣는다 (기본 구분 이름에 맞춘다)
  const plans = parsePlanSheet(buf);
  if (plans.length) {
    const existing = db.prepare('SELECT category FROM budget_plans WHERE year = ?').all(year).map((r) => r.category);
    const up = db.prepare(`INSERT INTO budget_plans (year, category, sort, planned, detail) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (year, category) DO UPDATE SET planned = COALESCE(excluded.planned, planned), detail = COALESCE(excluded.detail, detail)`);
    db.transaction(() => plans.forEach((p, i) => {
      const name = [...existing, ...DEFAULT_CATEGORIES].find((c) => key(c) === key(p.category)) ?? p.category;
      up.run(year, name, i, p.planned, p.detail);
      out.plans++;
    }))();
  }

  let parsed = null;
  try { parsed = parseErp(buf); } catch (e) { if (!plans.length) throw e; }
  if (parsed) {
    const rules = listRules();
    const find = db.prepare('SELECT * FROM budget_entries WHERE voucher IS ? AND memo = ?');
    const ins = db.prepare(`INSERT INTO budget_entries (year, date, voucher, memo, vendor, dept, accounts, amount, vat, category, status, rule)
      VALUES (@year, @date, @voucher, @memo, @vendor, @dept, @accounts, @amount, @vat, @category, @status, @rule)`);
    const upd = db.prepare(`UPDATE budget_entries SET date = @date, vendor = @vendor, dept = @dept, accounts = @accounts, amount = @amount, vat = @vat,
      category = CASE WHEN status IN ('확인', '제외') THEN category ELSE @category END,
      status = CASE WHEN status IN ('확인', '제외') THEN status ELSE @status END,
      rule = CASE WHEN status IN ('확인', '제외') THEN rule ELSE @rule END WHERE id = @id`);
    db.transaction(() => {
      for (const e of parsed.entries) {
        const y = Number(e.date.slice(0, 4));
        if (y !== year) { out.skipped++; continue; }
        const d = decide(e, rules);
        const ex = find.get(e.voucher, e.memo);
        if (!d && !ex) continue;
        const row = { ...e, year, ...(d ?? { category: ex?.category, status: ex?.status, rule: ex?.rule }) };
        if (ex) { upd.run({ ...row, id: ex.id }); out.updated++; } else { ins.run(row); out.added++; }
        if (row.status === '검토') out.review++;
      }
    })();
  }
  revalidatePath('/budget');
  redirect(`/budget?imported=${out.plans}-${out.added}-${out.updated}-${out.review}-${out.skipped}`);
}

// 낱말을 고친 뒤 확인·제외하지 않은 건을 다시 분류
export async function reclassify(formData) {
  await requireAdmin();
  const year = Number(formData.get('year'));
  const db = getDb();
  const rules = listRules();
  const rows = db.prepare("SELECT * FROM budget_entries WHERE year = ? AND status IN ('자동', '검토') AND source = 'erp'").all(year);
  const up = db.prepare('UPDATE budget_entries SET category = ?, status = ?, rule = ? WHERE id = ?');
  const del = db.prepare('DELETE FROM budget_entries WHERE id = ?');
  db.transaction(() => {
    for (const e of rows) {
      const d = decide(e, rules);
      if (d) up.run(d.category, d.status, d.rule, e.id); else del.run(e.id);
    }
  })();
  revalidatePath('/budget');
}

// 버튼마다 bind로 상태를 넘긴다: setEntry.bind(null, '확인')
export async function setEntry(status, formData) {
  await requireAdmin();
  const id = Number(formData.get('id'));
  getDb().prepare('UPDATE budget_entries SET category = ?, status = ? WHERE id = ?')
    .run(clean(formData.get('category')), ['자동', '검토', '확인', '제외'].includes(status) ? status : '확인', id);
  revalidatePath('/budget');
}

export async function confirmAll(formData) {
  await requireAdmin();
  const year = Number(formData.get('year'));
  const cat = clean(formData.get('category'));
  getDb().prepare(`UPDATE budget_entries SET status = '확인' WHERE year = ? AND status = '자동' ${cat ? 'AND category = ?' : ''}`).run(...(cat ? [year, cat] : [year]));
  revalidatePath('/budget');
}

export async function addEntry(formData) {
  await requireAdmin();
  const date = clean(formData.get('date'));
  const memo = clean(formData.get('memo'));
  const amount = money(formData.get('amount'));
  if (!date || !memo || !amount) throw new Error('날짜, 내용, 금액을 입력해 주세요.');
  getDb().prepare(`INSERT INTO budget_entries (year, date, voucher, memo, vendor, amount, vat, category, status, source)
      VALUES (?, ?, NULL, ?, ?, ?, 0, ?, '확인', '직접')`)
    .run(Number(date.slice(0, 4)), date, memo, clean(formData.get('vendor')), amount, clean(formData.get('category')));
  revalidatePath('/budget');
}

export async function deleteEntry(formData) {
  await requireAdmin();
  getDb().prepare("DELETE FROM budget_entries WHERE id = ? AND source = '직접'").run(Number(formData.get('id')));
  revalidatePath('/budget');
}

export async function savePlans(formData) {
  await requireAdmin();
  const year = Number(formData.get('year'));
  const db = getDb();
  const up = db.prepare('UPDATE budget_plans SET planned = ?, detail = ? WHERE year = ? AND category = ?');
  db.transaction(() => {
    for (const c of formData.getAll('category').map(String)) up.run(money(formData.get(`planned:${c}`)), clean(formData.get(`detail:${c}`)), year, c);
    const nc = clean(formData.get('new_category'));
    if (nc) {
      const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM budget_plans WHERE year = ?').get(year).s;
      db.prepare('INSERT OR IGNORE INTO budget_plans (year, category, sort, planned) VALUES (?, ?, ?, ?)').run(year, nc, sort, money(formData.get('new_planned')));
    }
  })();
  revalidatePath('/budget');
}

export async function saveRule(formData) {
  await requireAdmin();
  const kw = clean(formData.get('keyword'));
  const cat = clean(formData.get('category'));
  if (!kw || !cat) throw new Error('낱말과 구분을 입력해 주세요.');
  getDb().prepare(`INSERT INTO budget_rules (keyword, category, priority) VALUES (?, ?, ?)
    ON CONFLICT (keyword) DO UPDATE SET category = excluded.category, priority = excluded.priority`)
    .run(kw, cat, Number(formData.get('priority')) || 5);
  revalidatePath('/budget');
}

export async function deleteRule(formData) {
  await requireAdmin();
  getDb().prepare('DELETE FROM budget_rules WHERE id = ?').run(Number(formData.get('id')));
  revalidatePath('/budget');
}

export async function setVat(formData) {
  await requireAdmin();
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('budget_include_vat', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
    .run(formData.get('vat') === '1' ? '1' : '0');
  revalidatePath('/budget');
}
