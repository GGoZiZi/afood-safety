// TBM 회의록 인쇄용 고정 문구 번역. 위험요인·대책 본문은 한국어 원문 그대로 인쇄된다(자동 번역은 4단계).
export const LANGS = [
  ['ko', '한국어'],
  ['zh', '中文 (중국어)'],
  ['vi', 'Tiếng Việt (베트남어)'],
  ['ru', 'Русский (러시아어)'],
  ['en', 'English (영어)'],
];

const T = {
  title: { ko: 'TBM(Tool Box Meeting) 회의록', zh: 'TBM（班前会）会议记录', vi: 'Biên bản họp TBM (Tool Box Meeting)', ru: 'Протокол TBM (Tool Box Meeting)', en: 'TBM (Tool Box Meeting) Minutes' },
  date: { ko: 'TBM 일시', zh: '日期时间', vi: 'Ngày giờ', ru: 'Дата и время', en: 'Date / Time' },
  sameDay: { ko: '작업날짜와 동일함', zh: '与作业日期相同', vi: 'Trùng ngày làm việc', ru: 'Совпадает с днём работ', en: 'Same as work date' },
  yes: { ko: '예', zh: '是', vi: 'Có', ru: 'Да', en: 'Yes' },
  no: { ko: '아니오', zh: '否', vi: 'Không', ru: 'Нет', en: 'No' },
  workName: { ko: '작 업 명', zh: '作业名称', vi: 'Tên công việc', ru: 'Наименование работ', en: 'Work' },
  workContent: { ko: '작업내용', zh: '作业内容', vi: 'Nội dung công việc', ru: 'Содержание работ', en: 'Work content' },
  place: { ko: 'TBM 장소', zh: '地点', vi: 'Địa điểm', ru: 'Место', en: 'Place' },
  raDone: { ko: '위험성평가 실시여부', zh: '是否进行风险评估', vi: 'Đã đánh giá rủi ro', ru: 'Оценка рисков проведена', en: 'Risk assessment done' },
  hazards: { ko: '잠재위험요인', zh: '潜在危险因素', vi: 'Yếu tố nguy hiểm tiềm ẩn', ru: 'Потенциальные опасности', en: 'Potential hazards' },
  measures: { ko: '대책 (※ 제거 → 대체 → 통제 순서 고려)', zh: '对策（※ 按消除→替代→控制的顺序考虑）', vi: 'Biện pháp (※ Loại bỏ → Thay thế → Kiểm soát)', ru: 'Меры (※ устранение → замена → контроль)', en: 'Measures (※ eliminate → substitute → control)' },
  nearMiss: { ko: '아차사고 및 근로자 의견 청취', zh: '险肇事故及员工意见', vi: 'Sự cố suýt xảy ra và ý kiến người lao động', ru: 'Почти-несчастные случаи и мнения работников', en: 'Near misses & worker opinions' },
  cases: { ko: '사고사례 공유', zh: '事故案例分享', vi: 'Chia sẻ trường hợp tai nạn', ru: 'Разбор несчастных случаев', en: 'Accident case sharing' },
  leader: { ko: 'TBM 리더 확인', zh: 'TBM负责人确认', vi: 'Xác nhận trưởng TBM', ru: 'Подтверждение руководителя TBM', en: 'TBM leader' },
  affil: { ko: '소속', zh: '所属', vi: 'Bộ phận', ru: 'Отдел', en: 'Dept.' },
  position: { ko: '직책', zh: '职务', vi: 'Chức vụ', ru: 'Должность', en: 'Title' },
  name: { ko: '성명', zh: '姓名', vi: 'Họ tên', ru: 'Ф.И.О.', en: 'Name' },
  sign: { ko: '서명', zh: '签名', vi: 'Chữ ký', ru: 'Подпись', en: 'Signature' },
  rules: { ko: '안전보건 5계명', zh: '安全卫生五大守则', vi: '5 nguyên tắc an toàn vệ sinh', ru: '5 правил охраны труда', en: '5 Safety & Health Rules' },
  special: { ko: '특기사항', zh: '特别事项', vi: 'Ghi chú đặc biệt', ru: 'Особые отметки', en: 'Remarks' },
  attendees: { ko: '참석자 확인 ※ TBM에 참여하지 않은 작업자를 확인하여 미팅 참석 유도', zh: '参会人员确认 ※ 确认未参加TBM的作业人员并引导其参会', vi: 'Xác nhận người tham dự ※ Kiểm tra người chưa tham dự và hướng dẫn tham gia', ru: 'Участники ※ проверьте отсутствующих и пригласите их', en: 'Attendance ※ check absent workers and bring them to the meeting' },
  attName: { ko: '이 름', zh: '姓名', vi: 'Họ tên', ru: 'Ф.И.О.', en: 'Name' },
};

const RULES = {
  zh: ['设备维修保养时，停机后再作业', '遵守管理监督者的指示和安全作业程序', '作业时必须佩戴防护用品', '随时整理整顿，营造舒适的作业环境', '不靠近运转中的刀片、螺杆、链条等，不得擅自解除防护装置'],
  vi: ['Dừng máy trước khi bảo trì, sửa chữa thiết bị', 'Tuân thủ quy trình làm việc an toàn theo chỉ dẫn của người quản lý', 'Luôn đeo đồ bảo hộ khi làm việc', 'Thường xuyên sắp xếp, dọn dẹp để môi trường làm việc sạch sẽ', 'Không đến gần lưỡi dao, trục vít, xích đang chạy; không tự ý tháo thiết bị bảo vệ'],
  ru: ['При ремонте и обслуживании останавливайте оборудование', 'Соблюдайте безопасные процедуры по указанию руководителя', 'Всегда работайте в средствах индивидуальной защиты', 'Регулярно наводите порядок на рабочем месте', 'Не приближайтесь к работающим ножам, шнекам, цепям; не снимайте защитные устройства'],
  en: ['Stop the machine before maintenance or repair', "Follow safe work procedures as instructed by your supervisor", 'Always wear protective equipment while working', 'Keep the workplace clean and tidy at all times', 'Stay away from moving blades, screws and chains; never remove guards'],
};

// 한국어가 아니면 "번역 / 한국어" 두 줄로 보여준다
export function label(key, lang) {
  const t = T[key];
  if (!t) return key;
  return lang && lang !== 'ko' ? `${t[lang]} / ${t.ko}` : t.ko;
}

export function translatedRules(rules, lang) {
  if (!lang || lang === 'ko' || !RULES[lang]) return rules;
  return rules.map((r, i) => (RULES[lang][i] ? `${RULES[lang][i]} (${r})` : r));
}
