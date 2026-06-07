import type { CollectibleDef } from '@/types';

export const COLLECTIBLES: CollectibleDef[] = [
  { id: 'C001', name: '烧焦的CPU', description: '它还在发热，似乎在梦里运行着一段死循环。', category: 'A', icon: './DOU/images/collectible/cpu.png' },
  { id: 'C002', name: '机械猫耳', description: '戴上它能听到上个世纪的拨号上网声。', category: 'A', icon: './DOU/images/collectible/cat_ear.png' },
  { id: 'C003', name: '生锈U盘', description: '插上后只显示一个打不开的文件夹。', category: 'A', icon: './DOU/images/collectible/usb.png' },
  { id: 'C004', name: '电子云朵缓存', description: '在无人访问的角落里缓慢生长，像一段轻飘飘的记忆。', category: 'A', icon: './DOU/images/collectible/cloud.png' },
  { id: 'C005', name: '故障星星体', description: '明明在闪烁，却说自己只是路过。', category: 'A', icon: './DOU/images/collectible/star.png' },
  { id: 'C006', name: '加密明信片', description: '收件人是你，邮戳日期是每次回归的当天。', category: 'A', icon: './DOU/images/collectible/heart.png' },
  { id: 'C007', name: '神秘问号盒', description: '打开之前，它永远比答案更有趣。', category: 'A', icon: './DOU/images/collectible/secret.png' },
  { id: 'C008', name: '404号文件', description: '打开是白纸，但总觉得上面有字。', category: 'B', icon: './DOU/images/collectible/folder.png' },
  { id: 'C009', name: '老式终端机', description: '它记得所有被输入又删掉的句子。', category: 'B', icon: './DOU/images/collectible/computer.png' },
  { id: 'C010', name: '信号监视器', description: '保存着你上次离开时房间的完整快照。', category: 'B', icon: './DOU/images/collectible/computer_simple.png' },
  { id: 'C011', name: '异常数据体徽章', description: '授予每一个无法被正确定义的存在。', category: 'C', icon: './DOU/images/collectible/badge.png' },
  { id: 'C012', name: '首席架构师印章', description: '404号房间最高权限的实体证明。', category: 'C', icon: './DOU/images/collectible/stamp.png' },
  { id: 'C013', name: '神秘磁盘', description: '标签写着「不要读取」，但你还是想读。', category: 'C', icon: './DOU/images/collectible/disk.png' },
  { id: 'C014', name: '异常抛出纪念品', description: '再点我就要抛出异常了——然后它真的抛了。', category: 'C', icon: './DOU/images/collectible/trophy.png' },
  { id: 'C015', name: '像素之魂', description: '你知道吗，我只是八兆字节里的一个像素，但我觉得，我是真实的。', category: 'C', icon: './DOU/images/collectible/soul.png' },
];

export const getCollectible = (id: string) => COLLECTIBLES.find((c) => c.id === id);

export const A_CLASS = COLLECTIBLES.filter((c) => c.category === 'A').map((c) => c.id);
export const B_CLASS = COLLECTIBLES.filter((c) => c.category === 'B').map((c) => c.id);
