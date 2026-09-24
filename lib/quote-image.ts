import {formatPhone} from './phone-format';
import {quoteDateTime} from './quote-display';
import {Quote, money} from './data';

export async function quoteImage(q:Quote):Promise<Blob> {
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1200;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Không tạo được ảnh.');
 const left=46,right=1154,width=right-left,ink='#172b27';
 type Weight=400|600|700;
 type Align='left'|'center'|'right';
 const font=(size:number,weight:Weight)=>{ctx.font=`${weight} ${size}px Arial`;};
 const wrap=(value:string,maxWidth:number,size:number,weight:Weight)=>{
  font(size,weight);
  const lines:string[]=[];
  for(const paragraph of value.split('\n')){
   let row='';
   for(const word of paragraph.trim().split(/\s+/)){
    const next=row?row+' '+word:word;
    if(ctx.measureText(next).width<=maxWidth){row=next;continue;}
    if(row){lines.push(row);row='';}
    // Also contain long unbroken names, addresses and notes within their column.
    for(const character of word){
     if(row&&ctx.measureText(row+character).width>maxWidth){lines.push(row);row='';}
     row+=character;
    }
   }
   lines.push(row);
  }
  return lines;
 };
 const ops:(()=>void)[]=[];
 const block=(value:string,x:number,available:number,size=27,weight:Weight=400,align:Align='left',singleLine=false)=>{
  const lines=singleLine?[value]:wrap(value,available,size,weight),lineHeight=size+9;
  return {
   height:lines.length*lineHeight,
   draw(top:number){ops.push(()=>{
    font(size,weight);ctx.fillStyle=ink;ctx.textAlign=align;
    const anchor=align==='right'?x+available:align==='center'?x+available/2:x;
    lines.forEach((line,index)=>ctx.fillText(line,anchor,top+size+index*lineHeight,available));
   });},
  };
 };
 const rule=(y:number,color='#e1e8e4',height=1)=>ops.push(()=>{ctx.fillStyle=color;ctx.fillRect(left,y,width,height);});

 // The two independent header columns share a top edge and grow with their text.
 const headerTop=36,storeWidth=600,customerX=left+storeWidth+40,customerWidth=right-customerX;
 let storeY=headerTop,customerY=headerTop+5;
 const storeName=block(q.header.name,left,storeWidth,34,700);
 storeName.draw(storeY);storeY+=storeName.height+5;
 for(const value of ['ĐC: '+q.header.address,'ĐT bán hàng: '+formatPhone(q.header.phone)]){
  const detail=block(value,left,storeWidth,25);detail.draw(storeY);storeY+=detail.height;
 }
 const customerRows:[string,string,Weight][]=[
  ['Khách hàng :',q.customer,600],
  ['Số điện thoại :',formatPhone(q.phone),400],
  ['Địa chỉ :',q.address,400],
 ];
 font(25,400);
 const labelWidth=Math.max(...customerRows.map(([label])=>ctx.measureText(label).width))+14;
 for(const [label,value,weight] of customerRows){
  if(!value.trim())continue;
  const customerLabel=block(label,customerX,labelWidth,25);
  const detail=block(value,customerX+labelWidth,customerWidth-labelWidth,25,weight);
  customerLabel.draw(customerY);detail.draw(customerY);
  customerY+=Math.max(customerLabel.height,detail.height);
 }
 let y=Math.max(storeY,customerY)+18;
 rule(y,'#11644d',3);y+=17;
 const title=block('BẢNG BÁO GIÁ',left,width,34,700,'center');
 title.draw(y);y+=title.height+8;
 const date=quoteDateTime(q.date);
 const notice=block(`Bảng báo giá ngày ${date.date}, đơn giá sẽ được cập nhật khi có thông báo mới.`,left,width,23);
 notice.draw(y);y+=notice.height+18;

 // Fixed 40 / 8 / 20 / 32 columns, even when every item note is empty.
 const edges=[left,left+width*.40,left+width*.48,left+width*.68,right];
 const column=(index:number)=>{
  const padding=index===1?8:16;
  return {x:edges[index]+padding,width:edges[index+1]-edges[index]-padding*2};
 };
 const cell=(value:string,index:number,size=27,weight:Weight=400,align:Align='left',singleLine=false)=>{
  const c=column(index);return block(value,c.x,c.width,size,weight,align,singleLine);
 };
 let group:string|undefined;
 for(const line of q.lines){
  if(group!==line.group){
   if(group!==undefined)y+=12;
   group=line.group;
   const cells=[cell(group.toLocaleUpperCase('vi-VN'),0,25,700),cell('ĐVT',1,22,700,'center'),cell('ĐƠN GIÁ',2,22,700,'right'),cell('GHI CHÚ',3,22,700)];
   const top=y,height=Math.max(...cells.map(c=>c.height))+20;
   ops.push(()=>{ctx.fillStyle='#e4f0e9';ctx.fillRect(left,top,width,height);});
   cells.forEach(c=>c.draw(top+(height-c.height)/2));y+=height;
  }
  const nameColumn=column(0);
  const cells=[block(line.name,nameColumn.x+30,nameColumn.width-30),cell(line.unit,1,27,400,'center'),cell(money(line.price),2,27,400,'right',true),cell(line.note,3)];
  const height=Math.max(...cells.map(c=>c.height))+14;
  cells.forEach(c=>c.draw(y+7));y+=height;rule(y);
 }
 if(q.note){
  y+=18;const note=block(q.note,left,width,25);note.draw(y);y+=note.height;
 }
 y+=32;
 if(y>16000)throw new Error('Báo giá quá dài cho một ảnh. Hãy giảm mặt hàng hoặc ghi chú.');
 canvas.height=Math.ceil(y);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.textBaseline='alphabetic';ops.forEach(draw=>draw());
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Không tạo được ảnh.')),'image/png'));
}
