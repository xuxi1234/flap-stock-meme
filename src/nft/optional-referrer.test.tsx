import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {zeroAddress} from 'viem';
import {effectiveReferrer,mintQuote,validateReferrer} from './model';
import {MintForm} from './components/MintForm';
const payer='0x1111111111111111111111111111111111111111',inviter='0x2222222222222222222222222222222222222222',collection='0x3333333333333333333333333333333333333333';
describe('optional inviter',()=>{
 it('requires verified optional mode and retains immutable bindings',()=>{expect(()=>validateReferrer('',payer,collection)).toThrow();expect(validateReferrer('',payer,collection,true)).toBe(zeroAddress);expect(effectiveReferrer(inviter,'',payer,collection,true)).toBe(inviter);for(const bad of [payer,collection,'broken','0x000000000000000000000000000000000000dEaD'])expect(()=>validateReferrer(bad,payer,collection,true)).toThrow();expect(mintQuote(20,false)).toMatchObject({reward:0n,treasury:200000000000000000n});});
 it('allows empty draft without acknowledgment and does not select a default inviter',()=>{const onMint=vi.fn();render(<MintForm quantity="1" setQuantity={()=>{}} draft="" setDraft={()=>{}} wallet={payer} referral={{bound:null,invited:0n,minted:0n,earned:0n,rewards:0n}} collection={collection} live busy={false} reserved={1} optionalReferrer onConnect={()=>{}} onMint={onMint}/>);const button=screen.getByRole('button',{name:/支付 0.01/});expect(button).not.toBeDisabled();expect(screen.queryByRole('checkbox')).toBeNull();fireEvent.click(button);expect(onMint).toHaveBeenCalledWith(1,zeroAddress);cleanup();});
});
