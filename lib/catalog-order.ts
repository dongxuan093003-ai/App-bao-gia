import type {Product} from './data';

export const catalogGroups=(products:Product[])=>[...new Set(products.map(p=>p.group))];
export function groupProducts(products:Product[],order=catalogGroups(products)){
 const groups=[...new Set([...order,...catalogGroups(products)])];
 return groups.flatMap(group=>products.filter(p=>p.group===group));
}
export function reorderProduct(products:Product[],id:string,targetId:string){
 const item=products.find(p=>p.id===id),target=products.find(p=>p.id===targetId);
 if(!item||!target||item.group!==target.group||id===targetId)return products;
 const members=products.filter(p=>p.group===item.group);
 const from=members.findIndex(p=>p.id===id),to=members.findIndex(p=>p.id===targetId);
 members.splice(from,1);members.splice(to,0,item);
 return catalogGroups(products).flatMap(g=>g===item.group?members:products.filter(p=>p.group===g));
}
export function reorderGroup(products:Product[],group:string,target:string){
 const order=catalogGroups(products),from=order.indexOf(group),to=order.indexOf(target);
 if(from<0||to<0||from===to)return products;
 order.splice(from,1);order.splice(to,0,group);
 return groupProducts(products,order);
}
export function renameGroup(products:Product[],oldName:string,newName:string){
 const name=newName.trim();
 if(!name)throw new Error('Nhập tên nhóm hàng.');
 if(catalogGroups(products).some(g=>g!==oldName&&g.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')))throw new Error('Tên nhóm đã có. Hãy chọn tên khác.');
 return groupProducts(products.map(p=>p.group===oldName?{...p,group:name}:p),catalogGroups(products).map(g=>g===oldName?name:g));
}
export function upsertProduct(products:Product[],product:Product){
 const next={...product,name:product.name.trim(),group:product.group.trim(),unit:product.unit.trim()};
 const old=products.find(p=>p.id===next.id);
 if(old)next.prices=old.prices;
 const remaining=products.filter(p=>p.id!==next.id);
 if(old?.group===next.group)return groupProducts(products.map(p=>p.id===next.id?next:p));
 return groupProducts([...remaining,next],catalogGroups(products));
}
