-- 에이푸드 위험성평가 관리 DB 스키마 (SQLite)
-- 모든 업무 데이터는 평가연도(year)로 구분한다.

CREATE TABLE IF NOT EXISTS years (
  year        INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  closed      INTEGER NOT NULL DEFAULT 0,   -- 1이면 마감(읽기 전용)
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  dept1   TEXT NOT NULL,                    -- 부서1 (예: 생산지원팀)
  dept2   TEXT,                             -- 부서2 (예: 입출고장)
  name    TEXT NOT NULL,
  title   TEXT,                             -- 직급
  phone   TEXT,
  active  INTEGER NOT NULL DEFAULT 1,
  UNIQUE (dept1, name)
);

CREATE TABLE IF NOT EXISTS processes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year        INTEGER NOT NULL REFERENCES years(year),
  code        TEXT NOT NULL,                -- 공정ID (P01)
  seq         INTEGER NOT NULL,             -- 공정순서
  space       TEXT,                         -- 공간명 (생산지원팀 > 입출고장)
  dept        TEXT,                         -- 공간명 앞부분에서 추출한 부서
  name        TEXT NOT NULL,                -- 공정명
  sub_task    TEXT,                         -- 세부작업명
  equipment   TEXT,                         -- 설비
  material    TEXT,                         -- 물질
  owner       TEXT,                         -- 실행책임자
  promoter    TEXT,                         -- 추진자
  note        TEXT,
  work_status TEXT NOT NULL DEFAULT '기존', -- 기존/신규/수정/삭제
  extra       TEXT,                         -- 공정 체크항목(재해건수, 도급, 교대 등) JSON
  UNIQUE (year, code)
);

CREATE TABLE IF NOT EXISTS risk_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  year             INTEGER NOT NULL REFERENCES years(year),
  item_code        TEXT NOT NULL,           -- 항목ID (P01-1)
  process_code     TEXT,                    -- 공정ID (P01)
  space            TEXT,
  dept             TEXT,
  process_name     TEXT,
  sub_task         TEXT,
  category         TEXT,                    -- 분류 (1.기계(설비)적 요인)
  cause            TEXT,                    -- 원인 (1.1. 협착위험 부분)
  hazard           TEXT NOT NULL,           -- 유해위험요인
  legal_basis      TEXT,                    -- 관련근거
  pre_owner        TEXT,                    -- 위평전 사전조치담당
  current_measure  TEXT,                    -- 현재 안전보건조치
  likelihood       INTEGER,                 -- 가능성 1~5
  severity         INTEGER,                 -- 중대성 1~4
  risk             INTEGER,                 -- 위험성 = 가능성 x 중대성
  reduction        TEXT,                    -- 감소대책
  post_likelihood  INTEGER,
  post_severity    INTEGER,
  post_risk        INTEGER,
  action_owner     TEXT,                    -- 조치담당자
  due_date         TEXT,                    -- 조치예정일 (YYYY-MM-DD)
  done_date        TEXT,                    -- 완료일
  prev_action_no   TEXT,                    -- 기존 조치번호
  note             TEXT,                    -- 비고
  note2            TEXT,                    -- 비고1
  photo_link_id    TEXT,                    -- 사진연결ID
  work_status      TEXT NOT NULL DEFAULT '기존', -- 기존/신규/수정
  visibility       TEXT NOT NULL DEFAULT '공개', -- 공개/미공개
  deleted          INTEGER NOT NULL DEFAULT 0,   -- 1이면 삭제(숨김, 복구 가능)
  created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (year, item_code)
);
CREATE INDEX IF NOT EXISTS idx_risk_year ON risk_items(year, deleted);

CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year        INTEGER NOT NULL REFERENCES years(year),
  link_id     TEXT NOT NULL,                -- 사진연결ID (= 항목ID 또는 N-001)
  kind        TEXT,                         -- 사진구분 (현장/개선전/개선후)
  filename    TEXT NOT NULL,
  description TEXT,
  taken_at    TEXT,
  note        TEXT
);
CREATE INDEX IF NOT EXISTS idx_photo_link ON photos(year, link_id);

CREATE TABLE IF NOT EXISTS codes (
  kind        TEXT NOT NULL,                -- likelihood / severity / cause
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, code)
);

CREATE TABLE IF NOT EXISTS history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,
  row_id      INTEGER NOT NULL,
  action      TEXT NOT NULL,                -- 추가/수정/미공개/공개/삭제/복구
  changes     TEXT,                         -- 바뀐 필드 JSON {필드: [이전, 이후]}
  at          TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_history_row ON history(table_name, row_id);

-- ===== 2단계: 사용자 · TBM · 재해사례 =====

CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  role      TEXT NOT NULL DEFAULT 'supervisor',  -- admin(안전보건담당자) / supervisor(관리감독자)
  dept      TEXT,                                -- 관리감독자의 TBM 부서
  pin_hash  TEXT NOT NULL,
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- TBM 부서 설정 (물류파트, 품질관리팀, 생산1팀, 생산2팀, 공무팀)
CREATE TABLE IF NOT EXISTS tbm_depts (
  code          TEXT PRIMARY KEY,
  sort          INTEGER NOT NULL DEFAULT 0,
  place         TEXT,                          -- TBM 장소
  work_name     TEXT,                          -- 작업명 기본값
  leader_affil  TEXT,                          -- TBM 리더 소속
  leader_title  TEXT,                          -- 직책
  leader_name   TEXT,                          -- 성명
  weekdays      TEXT NOT NULL DEFAULT '1,2,3,4,5', -- 실시 요일 (월=1 … 일=7)
  active        INTEGER NOT NULL DEFAULT 1
);

-- TBM 참석 대상자 (부서별 팀원)
CREATE TABLE IF NOT EXISTS tbm_members (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  dept    TEXT NOT NULL REFERENCES tbm_depts(code),
  name    TEXT NOT NULL,
  lang    TEXT NOT NULL DEFAULT 'ko',          -- ko / zh / vi / ru / en
  sort    INTEGER NOT NULL DEFAULT 0,
  active  INTEGER NOT NULL DEFAULT 1,
  UNIQUE (dept, name)
);

CREATE TABLE IF NOT EXISTS tbm_meetings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  year          INTEGER NOT NULL,
  dept          TEXT NOT NULL REFERENCES tbm_depts(code),
  date          TEXT NOT NULL,                 -- YYYY-MM-DD
  seq           INTEGER NOT NULL,              -- 그 해 그 부서의 몇 번째 TBM (위험요인 순환 위치)
  time_text     TEXT,
  work_name     TEXT,
  work_content  TEXT,
  place         TEXT,
  ra_done       INTEGER NOT NULL DEFAULT 1,    -- 위험성평가 실시여부
  near_miss     TEXT,                          -- 아차사고 및 근로자 의견 청취
  case_text     TEXT,                          -- 사고사례 공유 (비우면 재해사례에서 자동)
  special_note  TEXT,                          -- 특기사항
  status        TEXT NOT NULL DEFAULT '작성중', -- 작성중 / 완료
  completed_at  TEXT,
  completed_by  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (dept, date)
);

CREATE TABLE IF NOT EXISTS tbm_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id    INTEGER NOT NULL REFERENCES tbm_meetings(id) ON DELETE CASCADE,
  slot          INTEGER NOT NULL,              -- 1~4
  risk_item_id  INTEGER REFERENCES risk_items(id),
  hazard        TEXT NOT NULL,
  measure       TEXT,
  UNIQUE (meeting_id, slot)
);

CREATE TABLE IF NOT EXISTS tbm_attendance (
  meeting_id  INTEGER NOT NULL REFERENCES tbm_meetings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT '참석',    -- 참석 / 연차 / 반차 / 교육 / 공가 / 출장 / 기타
  sort        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meeting_id, name)
);

CREATE TABLE IF NOT EXISTS tbm_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id  INTEGER NOT NULL REFERENCES tbm_meetings(id) ON DELETE CASCADE,
  user_name   TEXT,
  action      TEXT NOT NULL,
  detail      TEXT,
  at          TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 산업재해사례. share_from부터 share_days일 동안 해당 부서 TBM "사고사례 공유"에 자동 포함
CREATE TABLE IF NOT EXISTS accident_cases (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category     TEXT,                           -- 식품업계 / 물류 / 실험실 / 설비 / 화재 …
  title        TEXT NOT NULL,                  -- 한 줄 요약 (TBM에 들어가는 문장)
  occurred_on  TEXT,
  share_from   TEXT,                           -- TBM 공유 시작일
  share_days   INTEGER NOT NULL DEFAULT 7,
  depts        TEXT NOT NULL DEFAULT '전체',   -- 쉼표 구분 TBM 부서, 또는 전체
  summary      TEXT,                           -- 사고 개요
  cause        TEXT,                           -- 원인
  prevention   TEXT,                           -- 예방대책 (우리 사업장 적용)
  source       TEXT,
  url          TEXT,
  status       TEXT NOT NULL DEFAULT '채택',   -- 검토대기 / 채택 / 제외
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS case_seen (
  user_id  INTEGER NOT NULL,
  case_id  INTEGER NOT NULL,
  PRIMARY KEY (user_id, case_id)
);

-- ===== 3단계: 순회점검 · 근로자 참여 =====

-- 순회점검 (한 번 돌 때마다 하나)
CREATE TABLE IF NOT EXISTS patrols (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year        INTEGER NOT NULL,
  date        TEXT NOT NULL,
  area        TEXT,                            -- 점검 구역
  inspector   TEXT,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 사진 한 장 = 지적사항 하나. 위험성평가에 등록하면 risk_item_id가 생긴다
CREATE TABLE IF NOT EXISTS patrol_findings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patrol_id     INTEGER NOT NULL REFERENCES patrols(id) ON DELETE CASCADE,
  photo         TEXT,                          -- data/photos 안의 파일명
  process_code  TEXT,
  location      TEXT,
  finding       TEXT,                          -- 지적 내용 (유해위험요인)
  measure       TEXT,                          -- 개선 대책
  owner         TEXT,
  due_date      TEXT,
  done_date     TEXT,
  after_photo   TEXT,
  decision      TEXT NOT NULL DEFAULT '미정',  -- 미정 / 등록 / 미등록
  risk_item_id  INTEGER REFERENCES risk_items(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 근로자 위험성평가 참여: 근로자별 담당 공정과 근로자가 매긴 점수·의견
CREATE TABLE IF NOT EXISTS participants (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  year    INTEGER NOT NULL,
  name    TEXT NOT NULL,
  lang    TEXT NOT NULL DEFAULT 'ko',
  dept    TEXT,
  sort    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (year, name)
);

CREATE TABLE IF NOT EXISTS participant_processes (
  participant_id  INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  process_code    TEXT NOT NULL,
  PRIMARY KEY (participant_id, process_code)
);

CREATE TABLE IF NOT EXISTS participation_scores (
  participant_id  INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  risk_item_id    INTEGER NOT NULL REFERENCES risk_items(id),
  likelihood      INTEGER,
  severity        INTEGER,
  opinion         TEXT,
  reflected       INTEGER NOT NULL DEFAULT 0,  -- 위험성평가에 반영함
  updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (participant_id, risk_item_id)
);

-- 위험성평가 항목 번역 (근로자 참여 엑셀의 외국어 시트에서 가져옴)
CREATE TABLE IF NOT EXISTS risk_translations (
  year          INTEGER NOT NULL,
  item_code     TEXT NOT NULL,
  lang          TEXT NOT NULL,
  space         TEXT,
  process_name  TEXT,
  sub_task      TEXT,
  hazard        TEXT,
  PRIMARY KEY (year, item_code, lang)
);

-- ===== 4단계: 설비·안전인증 · MSDS · 문서 =====

-- 설비 (안전인증 / 자율안전확인 / 안전검사 대상 포함). 점검주기마다 다음 점검일을 계산한다
CREATE TABLE IF NOT EXISTS equipment (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,                 -- 설비명
  location        TEXT,                          -- 장소 (커트밋, HMR …)
  maker           TEXT,                          -- 업체
  model           TEXT,
  serial_no       TEXT,
  cert_type       TEXT NOT NULL DEFAULT '해당없음', -- 안전인증 / 자율안전확인 / 안전검사 / 해당없음
  cert_no         TEXT,                          -- 인증·신고번호
  install_date    TEXT,
  cycle_months    INTEGER,                       -- 점검주기 (개월)
  owner           TEXT,                          -- 담당자 (기본: 공무파트)
  process_code    TEXT,
  photo           TEXT,
  note            TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS equipment_inspections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id  INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT '정기점검',  -- 정기점검 / 안전검사 / 수리 / 기타
  inspector     TEXT,
  result        TEXT NOT NULL DEFAULT '양호',      -- 양호 / 보완필요 / 불량
  note          TEXT,
  photo         TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- MSDS 대장
CREATE TABLE IF NOT EXISTS msds (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  no            INTEGER,
  name          TEXT NOT NULL,                 -- 화학물질명(제품명)
  msds_no       TEXT,
  purpose       TEXT,                          -- 사용목적
  supplier      TEXT,                          -- 제조사 또는 공급사
  mixture       TEXT,                          -- 순수물질 / 혼합물
  components    TEXT,                          -- 구성성분 (한 줄에 "성분명 | CAS | 함유량")
  place         TEXT,                          -- 사용공정(구역명)
  monthly_use   TEXT,
  measure_note  TEXT,                          -- 작업환경측정 특이사항
  revised_on    TEXT,                          -- MSDS 개정일
  posted        INTEGER NOT NULL DEFAULT 0,    -- 현장 게시 여부
  active        INTEGER NOT NULL DEFAULT 1,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 첨부 문서 (MSDS 원본, 인증서, 실시규정 등). owner_kind + owner_id 로 어디에 붙었는지 표시
CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_kind    TEXT NOT NULL,                 -- equipment / msds / regulation
  owner_id      INTEGER,
  title         TEXT NOT NULL,
  filename      TEXT NOT NULL,                 -- data/files 안의 파일명
  original_name TEXT,
  version       TEXT,
  effective_on  TEXT,
  note          TEXT,
  uploaded_by   TEXT,
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
