/** 办公区左工位桌面上的留声机 */
export const MUSIC_BOX = {
  image: './DOU/images/element/music_box.png',
  costShards: 5,
  audioSrc: '/audio/for-river.mp3',
  /** 对齐 W03 左工位桌面 */
  markerX: 20,
  markerY: 55,
  markerHeight: 28,
  copy: {
    overlayTitle: '旧世纪留声机',
    tagline: '桌面缓存 · 曲目 #404',
    intro: '工位角落落着一台被数据海冲刷过的留声机。投入碎片后，它会循环写入一首只存在于记忆扇区里的曲子。',
    payHint: '关闭面板不会中断播放；再次点击留声机可切断信号。',
    playing: '信号已接入，曲目在房间底层循环写入中…',
    stopToast: '留声机信号已切断，404 号房间恢复静默。',
    unlockButton: '投入碎片，解锁曲目',
    playButton: '开始播放',
    closePanel: '收起面板',
    cancel: '先不听了',
    playError: '播放失败，请再试一次。',
    unlockSuccess: '曲目已解锁，留声机开始循环写入。',
    unlockedNote: '曲目已写入缓存，可随时播放或再次点击留声机切断信号。',
  },
} as const;
