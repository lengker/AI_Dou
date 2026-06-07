import { useEffect, useState } from 'react';
import { useGameStore, createProfileFromMapping, createDefaultVisitorProfile } from '@/store/gameStore';
import { analyzeImage, mapAppearance, getSkinFilter, getHairFilter } from '@/utils/colorMapping';
import { Overlay } from '@/components/Overlay';

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
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    if (step !== 'upload') return;
    const logLayout = () => {
      const viewport = document.querySelector('.game-viewport') as HTMLElement | null;
      const frame = document.querySelector('.scan-frame') as HTMLElement | null;
      const primaryButton = document.querySelector('.mapping-actions .btn-primary') as HTMLElement | null;
      const vv = window.visualViewport;
      const viewportRect = viewport?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      const buttonRect = primaryButton?.getBoundingClientRect();
      // #region debug-point A:mapping-layout
      fetch('http://10.139.186.240:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'upload-webview-bug',
          runId: 'pre-fix',
          hypothesisId: 'A',
          location: 'src/screens/MappingScreen.tsx:19',
          msg: '[DEBUG] mapping upload layout snapshot',
          data: {
            screen: step,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            clientWidth: document.documentElement.clientWidth,
            clientHeight: document.documentElement.clientHeight,
            visualViewportWidth: vv?.width ?? null,
            visualViewportHeight: vv?.height ?? null,
            viewportRect: viewportRect ? { width: viewportRect.width, height: viewportRect.height, top: viewportRect.top, left: viewportRect.left } : null,
            frameRect: frameRect ? { width: frameRect.width, height: frameRect.height, top: frameRect.top, bottom: frameRect.bottom } : null,
            buttonRect: buttonRect ? { width: buttonRect.width, height: buttonRect.height, top: buttonRect.top, bottom: buttonRect.bottom } : null,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };

    const rafId = window.requestAnimationFrame(logLayout);
    window.addEventListener('resize', logLayout);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', logLayout);
    };
  }, [step]);

  const handleFileChange = (source: 'album' | 'camera') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // #region debug-point C:file-input-change
    fetch('http://10.139.186.240:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'upload-webview-bug',
        runId: 'post-fix',
        hypothesisId: 'C',
        location: 'src/screens/MappingScreen.tsx:66',
        msg: '[DEBUG] file input change fired',
        data: {
          source,
          hasFile: !!file,
          fileName: file?.name ?? null,
          fileType: file?.type ?? null,
          fileSize: file?.size ?? null,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (file) processFile(file);
    e.target.value = '';
  };

  const processFile = async (file: File) => {
    setLoading(true);
    // #region debug-point C:process-file-start
    fetch('http://10.139.186.240:7777/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'upload-webview-bug',
        runId: 'pre-fix',
        hypothesisId: 'C',
        location: 'src/screens/MappingScreen.tsx:41',
        msg: '[DEBUG] process file start',
        data: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
        ts: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    try {
      const analysis = await analyzeImage(file);
      setAppearance(mapAppearance(analysis));
      setIsAbnormal(analysis.isAbnormal);
      if (analysis.isAbnormal) {
        setAbnormalMessage('特征解析受到严重干扰……强制进入异常映射协议。已为您生成【面目模糊的异常数据体】');
      }
      setStep('card');
      setFailCount(0);
      // #region debug-point D:process-file-success
      fetch('http://10.139.186.240:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'upload-webview-bug',
          runId: 'pre-fix',
          hypothesisId: 'D',
          location: 'src/screens/MappingScreen.tsx:66',
          msg: '[DEBUG] process file success',
          data: {
            isAbnormal: analysis.isAbnormal,
            nextStep: 'card',
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch {
      const next = failCount + 1;
      setFailCount(next);
      // #region debug-point D:process-file-failed
      fetch('http://10.139.186.240:7777/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'upload-webview-bug',
          runId: 'pre-fix',
          hypothesisId: 'D',
          location: 'src/screens/MappingScreen.tsx:81',
          msg: '[DEBUG] process file failed',
          data: {
            failCountBeforeIncrement: failCount,
            failCountAfterIncrement: next,
          },
          ts: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (next >= 3) completeMapping(createDefaultVisitorProfile());
      else setErrorMessage('视觉特征读取失败，请重新选择一张清晰图片后再试。');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'upload') {
    return (
      <div className="mapping-screen">
        <div className="scan-frame">
          <h1 className="mapping-title pixel-font">请上传视觉特征以建立数字档案</h1>
          <p className="mapping-subtitle">
            上传一张照片，系统会生成你的像素分身并入住 404 号房间
          </p>
          <div className="mapping-actions">
            <label className={`btn-primary file-trigger ${loading ? 'is-disabled' : ''}`} aria-disabled={loading}>
              <span>{loading ? '扫描中...' : '从相册选择'}</span>
              <input
                type="file"
                accept="image/*"
                className="file-trigger-input"
                disabled={loading}
                onClick={(e) => {
                  // #region debug-point B:album-button-click
                  fetch('http://10.139.186.240:7777/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId: 'upload-webview-bug',
                      runId: 'post-fix',
                      hypothesisId: 'B',
                      location: 'src/screens/MappingScreen.tsx:118',
                      msg: '[DEBUG] album input click',
                      data: {
                        loading,
                        disabled: loading,
                      },
                      ts: Date.now(),
                    }),
                  }).catch(() => {});
                  // #endregion
                  e.stopPropagation();
                }}
                onChange={handleFileChange('album')}
              />
            </label>
            <label className={`btn-secondary file-trigger ${loading ? 'is-disabled' : ''}`} aria-disabled={loading}>
              <span>拍照</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="file-trigger-input"
                disabled={loading}
                onClick={(e) => {
                  // #region debug-point B:camera-button-click
                  fetch('http://10.139.186.240:7777/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId: 'upload-webview-bug',
                      runId: 'post-fix',
                      hypothesisId: 'B',
                      location: 'src/screens/MappingScreen.tsx:147',
                      msg: '[DEBUG] camera input click',
                      data: {
                        loading,
                      },
                      ts: Date.now(),
                    }),
                  }).catch(() => {});
                  // #endregion
                  e.stopPropagation();
                }}
                onChange={handleFileChange('camera')}
              />
            </label>
            <button className="btn-secondary" onClick={() => completeMapping(createDefaultVisitorProfile())}>跳过（默认访客）</button>
          </div>
        </div>
        <Overlay open={!!errorMessage} onClose={() => setErrorMessage('')}>
          <h3 className="panel-title">读取失败</h3>
          <p style={{ textAlign: 'center', lineHeight: 1.7, marginBottom: 16 }}>{errorMessage}</p>
          <div className="panel-actions">
            <button className="btn-primary" type="button" onClick={() => setErrorMessage('')}>
              重新选择
            </button>
          </div>
        </Overlay>
      </div>
    );
  }

  const previewProfile = createProfileFromMapping(nickname, appearance, isAbnormal);
  const isArchitect = nickname.trim().toLowerCase() === 'lxz';

  return (
    <div className="mapping-screen">
      {abnormalMessage && <p className="mapping-alert">{abnormalMessage}</p>}
      <div className={`character-card glitch-in ${isArchitect ? 'holographic' : ''}`}>
        <img src="./DOU/images/role/default.png" alt="avatar" className="card-avatar"
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
