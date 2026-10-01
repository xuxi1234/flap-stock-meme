import {Children,cloneElement,createContext,isValidElement,useContext,useEffect,useState,type ReactNode} from 'react';
import type {NFT} from './model';
import words from './translations.json';
export type Lang='zh'|'en';
const dynamic=new Map<string,string>();
const fragments=new Map<string,string>();
export function registerCatalogLanguage(catalog:NFT[]){for(const nft of catalog){if(nft.nameEn)dynamic.set(nft.name,nft.nameEn);if(nft.familyEn){dynamic.set(nft.family,nft.familyEn);fragments.set(nft.family,nft.familyEn)}if(nft.theme?.nameEn){dynamic.set(nft.theme.name,nft.theme.nameEn);fragments.set(nft.theme.name,nft.theme.nameEn)}}}
const entries=Object.entries(words).sort((a,b)=>b[0].length-a[0].length);
export function translate(text:string,lang:Lang){
 if(lang==='zh')return text;
 if(dynamic.has(text))return dynamic.get(text)!;
 let result=text;
 for(const [zh,en]of entries)result=result.split(zh).join(en);
 for(const [zh,en]of fragments)if(/[\u3400-\u9fff]/.test(zh))result=result.split(zh).join(en);
 return result;
}
// Translate React render output, not DOM nodes. Form values, refs, keys and event handlers stay intact.
export function translateTree(node:ReactNode,lang:Lang):ReactNode{
 if(lang==='zh')return node;
 if(typeof node==='string')return translate(node,lang);
 if(Array.isArray(node))return Children.map(node,child=>translateTree(child,lang));
 if(!isValidElement<Record<string,unknown>>(node))return node;
 const props:Record<string,unknown>={};
 for(const key of ['aria-label','placeholder','alt','title'])if(typeof node.props[key]==='string')props[key]=translate(node.props[key] as string,lang);
 if(node.type==='option'&&node.props.value===undefined&&typeof node.props.children==='string')props.value=node.props.children;
 if(node.props.children!==undefined)props.children=translateTree(node.props.children as ReactNode,lang);
 return cloneElement(node,props);
}
const Context=createContext<{lang:Lang;setLang:(lang:Lang)=>void}>({lang:'zh',setLang:()=>{}});
export function LanguageProvider({children}:{children:ReactNode}){
 const [lang,update]=useState<Lang>(()=>{try{const q=new URLSearchParams(location.search).get('lang');return (q==='en'||q==='zh'?q:localStorage.getItem('butterfly-nft-language'))==='en'?'en':'zh'}catch{return 'zh'}});
 const setLang=(next:Lang)=>{update(next);try{localStorage.setItem('butterfly-nft-language',next);const url=new URL(location.href);url.searchParams.set('lang',next);history.replaceState(null,'',url)}catch{/* language remains usable without storage */}};
 useEffect(()=>{document.documentElement.lang=lang==='en'?'en':'zh-CN';document.title=lang==='en'?'Butterfly Stock NFT · BUTTERFLY 7777':'蝴蝶股票 NFT · BUTTERFLY 7777'},[lang]);
 useEffect(()=>{const listener=(event:StorageEvent)=>{if(event.key==='butterfly-nft-language')update(event.newValue==='en'?'en':'zh')};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener)},[]);
 return <Context.Provider value={{lang,setLang}}>{children}</Context.Provider>;
}
export function useLanguage(){const {lang,setLang}=useContext(Context);return{lang,setLang,t:(text:string)=>translate(text,lang),render:(node:ReactNode)=>translateTree(node,lang)}}
