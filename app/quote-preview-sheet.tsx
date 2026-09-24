'use client';

import {useRef, useState} from 'react';
import {Download, Printer, Share2, X} from 'lucide-react';
import {Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle} from '@/components/ui/drawer';
import type {Quote} from '@/lib/data';
import './quote-preview-sheet.css';

type Preview = {url: string; blob: Blob; quote: Quote};
type Props = {
  preview: Preview;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onShare: () => void;
};

export default function QuotePreviewSheet({preview, onClose, onDownload, onPrint, onShare}: Props) {
  const [open, setOpen] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);

  return <Drawer open={open} onOpenChange={setOpen} direction="bottom"
    closeThreshold={0.18} scrollLockTimeout={500} repositionInputs={false}
    onAnimationEnd={isOpen => { if (!isOpen) onClose(); }}>
    <DrawerContent className="quote-preview-sheet" data-vaul-no-drag={atTop ? undefined : ''}
      onOpenAutoFocus={event => { event.preventDefault(); closeButton.current?.focus({preventScroll: true}); }}>
      <header className="quote-preview-heading">
        <DrawerTitle>Ảnh báo giá{preview.quote.customer ? ' · ' + preview.quote.customer : ''}</DrawerTitle>
        <DrawerClose asChild>
          <button ref={closeButton} type="button" className="quote-preview-close" aria-label="Đóng ảnh báo giá" data-vaul-no-drag><X/></button>
        </DrawerClose>
        <DrawerDescription>Một ảnh đầy đủ. Chọn Zalo trong menu chia sẻ của điện thoại.</DrawerDescription>
      </header>
      <div className="quote-preview-scroll" tabIndex={0} role="region" aria-label="Nội dung ảnh báo giá"
        style={{touchAction: atTop ? 'pan-up' : 'pan-y'}}
        onScroll={event => setAtTop(event.currentTarget.scrollTop <= 0)}>
        <div className="quote-preview-paper">
          <img src={preview.url} draggable={false} alt={preview.quote.customer ? 'Báo giá cho ' + preview.quote.customer : 'Bảng báo giá'}/>
        </div>
      </div>
      <footer className="quote-preview-actions" data-vaul-no-drag>
        <button type="button" onClick={onDownload}><Download/>Tải ảnh</button>
        <button type="button" onClick={onPrint}><Printer/>In A5</button>
        <button type="button" className="primary" onClick={onShare}><Share2/>Gửi Zalo</button>
      </footer>
    </DrawerContent>
  </Drawer>;
}
