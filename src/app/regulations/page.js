import { requireUser } from '@/lib/auth';
import { listDocuments } from '@/lib/equipment';
import DocList from '@/components/DocList';

// 위험성평가 실시규정: 판마다 PDF를 올려 두고, 가장 최근 시행일 것이 현행
export default async function RegulationsPage() {
  const user = await requireUser();
  const docs = listDocuments('regulation', null);
  return (
    <main>
      <h1>위험성평가 실시규정</h1>
      <p className="sub">개정할 때마다 새 판을 올리세요. 시행일이 가장 늦은 판이 "현행"으로 표시되고, 이전 판은 개정 이력으로 남습니다.</p>
      <div className="card">
        <DocList kind="regulation" docs={docs} back="/regulations" canUpload={user.role === 'admin'} canDelete={user.role === 'admin'} versioned
          titleHint="예: 위험성평가 실시규정 (서명본)" />
      </div>
    </main>
  );
}
