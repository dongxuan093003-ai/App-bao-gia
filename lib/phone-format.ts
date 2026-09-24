/** Format complete Vietnamese phone numbers; preserve labels and multiple numbers. */
export function formatPhone(value:string):string {
 return value.replace(/(?<!\d)(?:0|\+?84)(?:[\s().-]*\d){9}(?!\d)/g,match=>{
  let digits=match.replace(/\D/g,'');
  if(digits.startsWith('84'))digits='0'+digits.slice(2);
  return digits.slice(0,4)+' '+digits.slice(4,7)+' '+digits.slice(7);
 });
}
