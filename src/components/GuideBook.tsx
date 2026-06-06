import { GUIDE_SECTIONS } from '@/data/tutorial';
import { Overlay } from '@/components/Overlay';

export function GuideBook({ open, onClose, onRestartTutorial }: {
  open: boolean; onClose: () => void; onRestartTutorial: () => void;
}) {
  return (
    <Overlay open={open} onClose={onClose} className="guide-book-panel">
      <h2 className="panel-title">探索手册</h2>
      <p style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 }}>房间功能速查 · 随时查阅</p>
      <div className="guide-sections">
        {GUIDE_SECTIONS.map((section) => (
          <section key={section.title} className="guide-section">
            <h3 className="guide-section-title">{section.title}</h3>
            <ul className="guide-list">
              {section.items.map((item) => (
                <li key={item.name}><strong>{item.name}</strong><span>{item.desc}</span></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="panel-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>关闭</button>
        <button type="button" className="btn-primary" onClick={() => { onClose(); onRestartTutorial(); }}>重看分步指引</button>
      </div>
    </Overlay>
  );
}
