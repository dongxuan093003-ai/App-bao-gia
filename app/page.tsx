import Workspace from './workspace';
import { currentAccount } from '@/lib/account';
import Login from './login';
export const dynamic = 'force-dynamic';
export default async function Page() {
 const account=await currentAccount();
 return account?<Workspace phone={account.phone}/>:<Login/>;
}
