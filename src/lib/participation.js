import * as XLSX from 'xlsx';
import { getDb } from './db';

const LANG_OF = { 중국: 'zh', 베트남: 'vi', 러시아: 'ru', 영어: 'en' };
const ITEM = /^P\d+-\d+$/;

// "근로자 위험성평가 참여" 엑셀: 근로자마다 시트 하나. 왼쪽은 평가 점수, 오른쪽은 (번역된) 근로자 기입란.
// 시트 이름 "동영(중국)" → 이름 동영, 언어 zh. 항목ID로 담당 공정을 알아내고, 외국어 시트는 번역문을 저장한다.
export function importParticipationWorkbook(buffer, year) {
  const db = getDb();
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const deptOf = new Map(db.prepare('SELECT name, dept FROM tbm_members WHERE active = 1').all().map((m) => [m.name, m.dept]));
  const itemId = new Map(db.prepare('SELECT item_code, id FROM risk_items WHERE year = ? AND deleted = 0').all(year).map((r) => [r.item_code, r.id]));
  const upP = db.prepare(`INSERT INTO participants (year, name, lang, dept, sort) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (year, name) DO UPDATE SET lang = excluded.lang, dept = COALESCE(participants.dept, excluded.dept)
    RETURNING id`);
  const addProc = db.prepare('INSERT OR IGNORE INTO participant_processes (participant_id, process_code) VALUES (?, ?)');
  const upT = db.prepare(`INSERT INTO risk_translations (year, item_code, lang, space, process_name, sub_task, hazard) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (year, item_code, lang) DO UPDATE SET space = excluded.space, process_name = excluded.process_name, sub_task = excluded.sub_task, hazard = excluded.hazard`);
  const upS = db.prepare(`INSERT INTO participation_scores (participant_id, risk_item_id, likelihood, severity) VALUES (?, ?, ?, ?)
    ON CONFLICT (participant_id, risk_item_id) DO UPDATE SET likelihood = excluded.likelihood, severity = excluded.severity`);
  const out = { workers: 0, processes: 0, translations: 0, scores: 0 };
  db.transaction(() => {
    wb.SheetNames.forEach((sheet, idx) => {
      if (sheet.includes('위험성평가표')) return;
      const m = sheet.trim().match(/^(.+?)\s*\((.+)\)$/);
      const name = (m ? m[1] : sheet).trim();
      const lang = (m && LANG_OF[m[2]]) || 'ko';
      const pid = upP.get(year, name, lang, deptOf.get(name) ?? null, idx).id;
      out.workers++;
      const procs = new Set();
      for (const r of XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null, raw: true })) {
        const code = typeof r[0] === 'string' ? r[0].trim() : null;
        if (!code || !ITEM.test(code)) continue;
        procs.add(code.split('-')[0]);
        if (lang !== 'ko' && r[13]) { upT.run(year, code, lang, r[10], r[11], r[12], String(r[13]).trim()); out.translations++; }
        const L = Number(r[14]) || null;
        const S = Number(r[15]) || null;
        if ((L || S) && itemId.has(code)) { upS.run(pid, itemId.get(code), L, S); out.scores++; }
      }
      for (const p of procs) addProc.run(pid, p);
      out.processes += procs.size;
    });
  })();
  return out;
}

export function listParticipants(year) {
  return getDb()
    .prepare(`SELECT p.*,
        (SELECT COUNT(*) FROM participant_processes pp WHERE pp.participant_id = p.id) AS procs,
        (SELECT COUNT(*) FROM participant_processes pp JOIN risk_items r ON r.year = p.year AND r.process_code = pp.process_code AND r.deleted = 0 AND r.visibility = '공개'
          WHERE pp.participant_id = p.id) AS items,
        (SELECT COUNT(*) FROM participation_scores s WHERE s.participant_id = p.id AND (s.likelihood IS NOT NULL OR s.opinion IS NOT NULL)) AS scored,
        (SELECT COUNT(*) FROM participation_scores s JOIN risk_items r ON r.id = s.risk_item_id
          WHERE s.participant_id = p.id AND s.reflected = 0 AND s.likelihood IS NOT NULL AND s.severity IS NOT NULL
            AND s.likelihood * s.severity != IFNULL(r.risk, 0)) AS differ,
        (SELECT COUNT(*) FROM participation_scores s WHERE s.participant_id = p.id AND s.reflected = 1) AS reflected
      FROM participants p WHERE p.year = ? ORDER BY p.dept, p.sort, p.name`)
    .all(year);
}

// 근로자 담당 공정의 위험요인 (공개만) + 그 근로자의 점수·의견 + 번역
export function participantItems(p) {
  return getDb()
    .prepare(`SELECT r.id, r.item_code, r.process_code, r.space, r.process_name, r.sub_task, r.hazard, r.likelihood, r.severity, r.risk,
        s.likelihood AS w_l, s.severity AS w_s, s.opinion, s.reflected,
        t.space AS t_space, t.process_name AS t_process, t.sub_task AS t_sub, t.hazard AS t_hazard
      FROM participant_processes pp
      JOIN processes pr ON pr.year = ? AND pr.code = pp.process_code
      JOIN risk_items r ON r.year = pr.year AND r.process_code = pp.process_code AND r.deleted = 0 AND r.visibility = '공개'
      LEFT JOIN participation_scores s ON s.participant_id = pp.participant_id AND s.risk_item_id = r.id
      LEFT JOIN risk_translations t ON t.year = r.year AND t.item_code = r.item_code AND t.lang = ?
      WHERE pp.participant_id = ?
      ORDER BY pr.seq, CAST(SUBSTR(r.item_code, INSTR(r.item_code, '-') + 1) AS INTEGER)`)
    .all(p.year, p.lang, p.id);
}

// 인쇄 머리글 번역 (엑셀 중국어 시트와 같은 문구)
export const PT = {
  title: { ko: '위험성평가표', zh: '风险评估表', vi: 'Bảng đánh giá rủi ro', ru: 'Карта оценки рисков', en: 'Risk Assessment' },
  space: { ko: '공간명', zh: '作业区域', vi: 'Khu vực', ru: 'Участок', en: 'Area' },
  process: { ko: '공정명', zh: '工序名称', vi: 'Công đoạn', ru: 'Процесс', en: 'Process' },
  itemId: { ko: '항목ID', zh: '项目ID', vi: 'Mã mục', ru: 'ID', en: 'Item ID' },
  subTask: { ko: '세부작업명', zh: '具体作业名称', vi: 'Công việc cụ thể', ru: 'Операция', en: 'Task' },
  hazard: { ko: '유해위험요인', zh: '危险有害因素', vi: 'Yếu tố nguy hiểm', ru: 'Опасный фактор', en: 'Hazard' },
  likelihood: { ko: '가능성', zh: '可能性', vi: 'Khả năng', ru: 'Вероятность', en: 'Likelihood' },
  severity: { ko: '중대성', zh: '严重性', vi: 'Mức độ', ru: 'Тяжесть', en: 'Severity' },
  risk: { ko: '위험성', zh: '风险值', vi: 'Rủi ro', ru: 'Риск', en: 'Risk' },
  opinion: { ko: '근로자 의견', zh: '员工意见', vi: 'Ý kiến người lao động', ru: 'Мнение работника', en: 'Worker opinion' },
  sign: { ko: '서명', zh: '签名', vi: 'Chữ ký', ru: 'Подпись', en: 'Signature' },
};
