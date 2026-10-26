// 위험성 점수에 따른 셀 색 (12점 이상 진한 빨강, 개선기준 이상 연한 빨강)
export function riskClass(score, th) {
  if (!score) return '';
  if (score >= 12) return 'risk-top';
  if (score >= th) return 'risk-high';
  return '';
}
