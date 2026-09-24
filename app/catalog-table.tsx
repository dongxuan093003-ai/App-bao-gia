'use client';
import {Fragment,useEffect,useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent} from 'react';
import {ArrowUp,ArrowDown,GripVertical,ChevronRight,Pencil,Check} from 'lucide-react';
import {Table,TableBody,TableRow,TableCell} from '@/components/ui/table';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';
import type {Product} from '@/lib/data';
import {catalogGroups,reorderProduct,reorderGroup,renameGroup} from '@/lib/catalog-order';

type Props={products:Product[];sorting:boolean;onDone:()=>void;groupsOpen:boolean;onGroupsOpen:(open:boolean)=>void;onProducts:(products:Product[])=>void;onEdit:(p:Product)=>void;pricePicker:ReactNode;renderPrice:(p:Product)=>ReactNode};
export default function CatalogTable({products,sorting,onDone,groupsOpen,onGroupsOpen,onProducts,onEdit,pricePicker,renderPrice}:Props){
 const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [renaming,setRenaming]=useState<string|null>(null),[name,setName]=useState('');
 const groups=catalogGroups(products);
 const latest=useRef(products);latest.current=products;
 const move=(id:string,target:string)=>onProducts(reorderProduct(latest.current,id,target));
 const moveGroup=(group:string,target:string)=>onProducts(reorderGroup(latest.current,group,target));
 return <>
  {sorting&&<div className="catalog-sort-bar"><span>Kéo để sắp xếp</span><button onClick={onDone}><Check size={16}/>Xong</button></div>}
  <section className={'panel price-panel catalog-panel '+(sorting?'is-sorting':'')}>
   <div className="catalog-price-picker">{pricePicker}</div>
   <div className="catalog-scroll" role="region" aria-label="Danh sách mặt hàng" tabIndex={0}>
   <Table className="catalog-table" aria-label="Mặt hàng và đơn giá"><colgroup><col/><col className="catalog-unit-col"/>{!sorting&&<col className="catalog-price-col"/>}</colgroup>
    <TableBody>{groups.map(group=>{const members=products.filter(p=>p.group===group);return <Fragment key={group}>
     <TableRow className="catalog-group"><TableCell colSpan={2}><button className="catalog-group-button" aria-expanded={!collapsed[group]} onClick={()=>setCollapsed({...collapsed,[group]:!collapsed[group]})}><ChevronRight/><span>{group}</span></button></TableCell>{!sorting&&<TableCell className="catalog-price-label">Đơn giá</TableCell>}</TableRow>
     {!collapsed[group]&&members.map((p,index)=><TableRow className="catalog-product" key={p.id} data-order-kind="product" data-order-id={p.id} data-order-scope={group}>
      <TableCell><div className="catalog-product-name">{sorting&&<DragHandle kind="product" id={p.id} scope={group} label={'Kéo '+p.name+' để sắp xếp'} onDrop={target=>move(p.id,target)} onStep={direction=>{const target=members[index+direction];if(target)move(p.id,target.id);}}/>}<button title={p.name} aria-label={'Sửa '+p.name} onClick={()=>onEdit({...p,prices:[...p.prices]})}>{p.name}</button></div></TableCell>
      <TableCell className="catalog-unit">{p.unit}</TableCell>
      {!sorting&&<TableCell className="catalog-price">{renderPrice(p)}</TableCell>}
     </TableRow>)}
    </Fragment>;})}</TableBody>
   </Table>
   </div>
  </section>
  <Dialog open={groupsOpen} onOpenChange={onGroupsOpen}><DialogContent className="catalog-groups-dialog" onOpenAutoFocus={e=>e.preventDefault()}><DialogTitle>Nhóm hàng</DialogTitle><DialogDescription>Kéo để sắp xếp. Bấm bút để đổi tên nhóm.</DialogDescription><div className="catalog-groups-list">{groups.map((group,index)=><div className="catalog-group-item" key={group} data-order-kind="group" data-order-id={group} data-order-scope="groups"><DragHandle kind="group" id={group} scope="groups" label={'Kéo nhóm '+group} onDrop={target=>moveGroup(group,target)}/><span>{group}</span><div className="order-buttons"><button aria-label={'Đổi tên nhóm '+group} onClick={()=>{setRenaming(group);setName(group);}}><Pencil/></button><button aria-label={'Đưa nhóm '+group+' lên'} disabled={index===0} onClick={()=>moveGroup(group,groups[index-1])}><ArrowUp/></button><button aria-label={'Đưa nhóm '+group+' xuống'} disabled={index===groups.length-1} onClick={()=>moveGroup(group,groups[index+1])}><ArrowDown/></button></div></div>)}</div><button className="primary" onClick={()=>onGroupsOpen(false)}><Check/>Xong</button></DialogContent></Dialog>
  <Dialog open={renaming!==null} onOpenChange={open=>{if(!open)setRenaming(null);}}><DialogContent className="catalog-rename-dialog"><DialogTitle>Đổi tên nhóm</DialogTitle><DialogDescription>Áp dụng cho danh mục hàng và báo giá mới.</DialogDescription><input aria-label="Tên nhóm hàng" value={name} onChange={e=>setName(e.target.value)} placeholder="Tên nhóm hàng" maxLength={120}/><button className="primary" onClick={()=>{try{onProducts(renameGroup(latest.current,renaming!,name));setRenaming(null);}catch(e){toast.error((e as Error).message);}}}>Áp dụng</button></DialogContent></Dialog>
 </>;
}

function DragHandle({kind,id,scope,label,onDrop,onStep}:{kind:string;id:string;scope:string;label:string;onDrop:(target:string)=>void;onStep?:(direction:number)=>void}){
 const drag=useRef<{pointer:number;target:string|null;row:HTMLElement|null;mark:HTMLElement|null;frame:number;clientY:number;clientX:number;startY:number;active:boolean}|null>(null);
 const cancel=()=>{const d=drag.current;if(!d)return;cancelAnimationFrame(d.frame);d.row?.removeAttribute('data-dragging');d.mark?.removeAttribute('data-drop-target');drag.current=null;};
 useEffect(()=>()=>cancel(),[]);
 const locate=(x:number,y:number)=>{
  const d=drag.current;if(!d)return;
  const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-order-kind]');
  d.mark?.removeAttribute('data-drop-target');d.target=null;d.mark=null;
  if(el?.dataset.orderKind===kind&&el.dataset.orderScope===scope&&el.dataset.orderId!==id){d.target=el.dataset.orderId||null;d.mark=el;el.dataset.dropTarget='true';}
 };
 const start=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  const row=e.currentTarget.closest<HTMLElement>('[data-order-kind]');
  drag.current={pointer:e.pointerId,target:null,row,mark:null,frame:0,clientX:e.clientX,clientY:e.clientY,startY:e.clientY,active:false};
  const scroll=()=>{const d=drag.current;if(!d)return;
   if(d.active){const list=row?.closest<HTMLElement>('.catalog-groups-list,.catalog-scroll'),rect=list?.getBoundingClientRect();const top=rect?.top??60,bottom=rect?.bottom??window.innerHeight-90;
    const delta=d.clientY<top+40?-8:d.clientY>bottom-40?8:0;
    if(delta){if(list)list.scrollTop+=delta;else window.scrollBy(0,delta);locate(d.clientX,d.clientY);}
   }
   d.frame=requestAnimationFrame(scroll);
  };drag.current.frame=requestAnimationFrame(scroll);
 };
 return <button className="catalog-drag-handle" aria-label={label} title={label} aria-keyshortcuts={onStep?'ArrowUp ArrowDown':undefined} onKeyDown={e=>{if(onStep&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();onStep(e.key==='ArrowUp'?-1:1);}}} onPointerDown={start} onPointerMove={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;d.clientX=e.clientX;d.clientY=e.clientY;if(Math.abs(e.clientY-d.startY)>5){d.active=true;if(d.row)d.row.dataset.dragging='true';}if(d.active)locate(e.clientX,e.clientY);}} onPointerUp={e=>{const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const target=d.target;cancel();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(target)onDrop(target);}} onPointerCancel={cancel} onLostPointerCapture={cancel}><GripVertical/></button>;
}
