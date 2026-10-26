import Link from 'next/link';
import RiskForm from '@/components/RiskForm';
import { improvementThreshold } from '@/lib/db';
import { listCodes, listProcesses } from '@/lib/risk';
import { currentYear, isClosed } from '@/lib/year';
import { createRisk } from '../actions';

export default async function NewRisk({ searchParams }) {
  const sp = await searchParams;
  const year = await currentYear();
  return (
    <main>
      <p><Link href="/risk">← 대장으로</Link></p>
      <h1>위험요인 추가</h1>
      <p className="sub">{year}년 · 항목ID는 공정에 맞춰 자동으로 붙고, 작업구분은 "신규"가 됩니다.</p>
      <RiskForm
        action={createRisk}
        item={sp.process ? { process_code: sp.process } : null}
        year={year}
        processes={listProcesses(year)}
        causes={listCodes('cause')}
        likelihoods={listCodes('likelihood')}
        severities={listCodes('severity')}
        threshold={improvementThreshold()}
        readOnly={isClosed(year)}
      />
    </main>
  );
}
