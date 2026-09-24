import {money, type Quote} from './data';
import {formatPhone} from './phone-format';
import {quoteDateTime} from './quote-display';

// This document is independent of the app's fixed dialogs and PNG renderer.
// Quote text is escaped before insertion; no account or internal care data is included.
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,character=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
}[character]!));

export const quotePrintStyles=`
 @page { size: A5 portrait; margin: 8mm; }
 * { box-sizing: border-box; }
 html { color: #172b27; background: #edf2ef; font-family: Arial, sans-serif; }
 body { margin: 0; font-size: 9pt; line-height: 1.35; }
 .print-tools { position: sticky; top: 0; padding: 12px 16px; background: #fff;
  border-bottom: 1px solid #cfdad4; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
 .print-tools button { font: 600 15px Arial, sans-serif; border: 1px solid #bdd0c6;
  border-radius: 8px; padding: 10px 16px; background: #fff; color: #185c46; cursor: pointer; }
 .print-tools #print { background: #11644d; border-color: #11644d; color: #fff; }
 .print-tools p { flex: 1 1 240px; margin: 0; font-size: 14px; color: #52675c; }
 main { width: 148mm; min-height: 210mm; padding: 8mm; margin: 16px auto; background: #fff;
  box-shadow: 0 2px 14px #17362718; }
 .quote-heading { break-inside: avoid; page-break-inside: avoid; }
 .parties { display: grid; grid-template-columns: 54% 43%; gap: 3%; padding-bottom: 3mm;
  border-bottom: .35mm solid #11644d; font-size: 8.5pt; }
 .store-name { font-size: 12pt; font-weight: 700; margin-bottom: 1.3mm; }
 .parties p { margin: 0; }
 .store, .customer, .customer dd { min-width: 0; }
 .parties, .item-name, .item-note, .quote-note { overflow-wrap: anywhere; white-space: pre-wrap; }
 .customer { display: grid; grid-template-columns: max-content minmax(0, 1fr); align-content: start;
  column-gap: 1.5mm; margin: 0; }
 .customer dt, .customer dd { margin: 0; font-weight: 400; }
 .customer .customer-name { font-weight: 600; }
 h1 { font-size: 13pt; text-align: center; margin: 3mm 0 1.5mm; }
 .notice { font-size: 8pt; margin: 0 0 3mm; }
 table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 2mm;
  break-inside: auto; page-break-inside: auto; }
 col.name { width: 40%; } col.unit { width: 8%; } col.price { width: 20%; } col.note { width: 32%; }
 thead { display: table-header-group; }
 thead tr { break-after: avoid; page-break-after: avoid; }
 tr { break-inside: avoid; page-break-inside: avoid; }
 th { background: #e4f0e9; border-top: .2mm solid #d3e1d8; border-bottom: .2mm solid #d3e1d8;
  font-size: 8pt; font-weight: 700; text-align: left; padding: 1.7mm 1.5mm; overflow-wrap: anywhere; }
 td { padding: 1.2mm 1.5mm; border-bottom: .15mm solid #dce4df; vertical-align: top; }
 .item-name { padding-left: 5mm; }
 .unit-cell { text-align: center; overflow-wrap: anywhere; padding-left: 1mm; padding-right: 1mm; }
 .price-cell { text-align: right; font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; }
 th.price-cell { font-weight: 700; white-space: normal; }
 .large-price { font-size: 7pt; }
 .quote-note { font-size: 8.5pt; margin: 3mm 0 0; orphans: 2; widows: 2; }
 @media screen and (max-width: 580px) { main { margin: 0; } }
 @media print {
  html, body { background: #fff; }
  .print-tools { display: none !important; }
  main { width: auto; min-height: 0; padding: 0; margin: 0; box-shadow: none; }
  th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
 }
`;

export function quotePrintHtml(q:Quote):string {
 if(!q.lines.length)throw new Error('Tích ít nhất một mặt hàng trước khi in.');
 if(q.lines.some(line=>line.price===null))throw new Error('Còn mặt hàng chưa nhập giá.');
 const customerRows=[['Khách hàng :',q.customer],['Số điện thoại :',formatPhone(q.phone)],['Địa chỉ :',q.address]];
 const customer=customerRows.filter(([,value])=>value.trim()).map(([label,value])=>
  `<dt>${label}</dt><dd${label==='Khách hàng :'?' class="customer-name"':''}>${escapeHtml(value)}</dd>`).join('');
 // Preserve the snapshot's order, including non-contiguous groups in older quotes.
 const groups:{name:string;rows:string[]}[]=[];
 for(const line of q.lines){
  if(groups.at(-1)?.name!==line.group)groups.push({name:line.group,rows:[]});
  const price=money(line.price);
  groups.at(-1)!.rows.push(`<tr><td class="item-name">${escapeHtml(line.name)}</td><td class="unit-cell">${escapeHtml(line.unit)}</td><td class="price-cell${price.length>11?' large-price':''}">${price}</td><td class="item-note">${escapeHtml(line.note)}</td></tr>`);
 }
 const tables=groups.map(group=>`<table aria-label="${escapeHtml(group.name)}"><colgroup><col class="name"><col class="unit"><col class="price"><col class="note"></colgroup><thead><tr><th scope="col">${escapeHtml(group.name.toLocaleUpperCase('vi-VN'))}</th><th scope="col" class="unit-cell">ĐVT</th><th scope="col" class="price-cell">ĐƠN GIÁ</th><th scope="col">GHI CHÚ</th></tr></thead><tbody>${group.rows.join('')}</tbody></table>`).join('');
 const date=quoteDateTime(q.date).date;
 return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeHtml('Báo giá'+(q.customer?' - '+q.customer:'')+' - '+date)}</title><style>${quotePrintStyles}</style></head><body><nav class="print-tools" aria-label="In báo giá"><button id="print" type="button">In A5</button><button id="close" type="button">Đóng</button><p id="print-status" role="status">Chọn giấy A5, tỉ lệ 100%. Tắt đầu trang và chân trang của trình duyệt.</p></nav><main><header class="quote-heading"><div class="parties"><div class="store"><p class="store-name">${escapeHtml(q.header.name)}</p><p>ĐC: ${escapeHtml(q.header.address)}</p><p>ĐT bán hàng: ${escapeHtml(formatPhone(q.header.phone))}</p></div><dl class="customer">${customer}</dl></div><h1>BẢNG BÁO GIÁ</h1><p class="notice">Bảng báo giá ngày ${date}, đơn giá sẽ được cập nhật khi có thông báo mới.</p></header>${tables}${q.note?`<p class="quote-note">${escapeHtml(q.note)}</p>`:''}</main></body></html>`;
}

export function openQuotePrint(q:Quote):void {
 const html=quotePrintHtml(q);
 // Open during the click event, before any asynchronous work, for popup blockers.
 const popup=window.open('about:blank','_blank');
 if(!popup)throw new Error('Trình duyệt đang chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm In A5 lại.');
 try{
  popup.opener=null;
  popup.document.open();popup.document.write(html);popup.document.close();
  const print=()=>{
   if(popup.closed)return;
   try{popup.focus();popup.print();}
   catch{const status=popup.document.getElementById('print-status');if(status)status.textContent='Chưa mở được hộp thoại in. Bấm In A5 để thử lại hoặc dùng Ctrl+P.';}
  };
  popup.document.getElementById('print')?.addEventListener('click',print);
  popup.document.getElementById('close')?.addEventListener('click',()=>popup.close());
  // System fonts only. Wait for layout before opening the native print preview.
  void popup.document.fonts.ready.then(()=>{
   if(!popup.closed)popup.requestAnimationFrame(()=>popup.requestAnimationFrame(print));
  }).catch(()=>{/* The visible In A5 button remains available. */});
 }catch{popup.close();throw new Error('Chưa mở được bản in. Hãy thử lại.');}
}
