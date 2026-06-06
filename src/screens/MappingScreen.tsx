import { useState, useRef } from 'react';
import { useGameStore, createProfileFromMapping, createDefaultVisitorProfile } from '@/store/gameStore';
import { analyzeImage, mapAppearance, getSkinFilter, getHairFilter } from '@/utils/colorMapping';

type Step = 'upload' | 'card';

export function MappingScreen() {
  const completeMapping = useGameStore((s) => s.completeMapping);
  const [step, setStep] = useState<Step>('upload');
  const [nickname, setNickname] = useState('');
  const [appearance, setAppearance] = useState(createDefaultVisitorProfile().appearance);
  const [isAbnormal, setIsAbnormal] = useState(false);
  const [abnormalMessage, setAbnormalMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    try {
      const analysis = await analyzeImage(file);
      setAppearance(mapAppearance(analysis));
      setIsAbnormal(analysis.isAbnormal);
      if (analysis.isAbnormal) {
        setAbnormalMessage('特征解析受到严重干扰……强制进入异常映射协议。已为您生成【面目模糊的异常数据体】');
      }
      setStep('card');
      setFailCount(0);
    } catch {
      const next = failCount + 1;
      setFailCount(next);
      if (next >= 3) completeMapping(createDefaultVisitorProfile());
      else alert('视觉特征读取失败，请重新选择');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'upload') {
    return (
      <div className="mapping-screen">
        <div className="scan-frame">
          <h1 className="mapping-title pixel-font">请上传视觉特征以建立数字档案</h1>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 20, lineHeight: 1.6 }}>
            上传一张照片，系统会生成你的像素分身并入住 404 号房间
          </p>
          <div className="mapping-actions">
            <button className="btn-primary" disabled={loading} onClick={() => fileRef.current?.click()}>
              {loading ? '扫描中...' : '从相册选择'}
            </button>
            <button className="btn-secondary" onClick={() => {
              if (fileRef.current) {
                fileRef.current.setAttribute('capture', 'environment');
                fileRef.current.click();
                fileRef.current.removeAttribute('capture');
              }
            }}>拍照</button>
            <button className="btn-secondary" onClick={() => completeMapping(createDefaultVisitorProfile())}>跳过（默认访客）</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden-input" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.target.value = '';
          }} />
        </div>
      </div>
    );
  }

  const previewProfile = createProfileFromMapping(nickname, appearance, isAbnormal);
  const isArchitect = nickname.trim().toLowerCase() === 'wang yu';

  return (
    <div className="mapping-screen">
      {abnormalMessage && <p style={{ color: '#ff6666', marginBottom: 16, fontSize: 12, maxWidth: 360 }}>{abnormalMessage}</p>}
      <div className={`character-card glitch-in ${isArchitect ? 'holographic' : ''}`}>
        <img src="/DOU/images/role/default.png" alt="avatar" className="card-avatar"
          style={{ filter: `${getSkinFilter(appearance.skinTone)} ${getHairFilter(appearance.hairColor)}` }} />
        <div className="card-title">{previewProfile.fullTitle}</div>
        <div className="card-explanation">{previewProfile.titleExplanation}</div>
        <input className="card-input" placeholder="输入数字签章（昵称）" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
        <button className="btn-primary" style={{ width: '100%' }} onClick={() => completeMapping(createProfileFromMapping(nickname, appearance, isAbnormal))}>
          确认入住
        </button>
      </div>
    </div>
  );
}
