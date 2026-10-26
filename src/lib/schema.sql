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
