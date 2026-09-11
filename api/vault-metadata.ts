// Fixed-destination metadata upload. No signing key, wallet signature or arbitrary URL.
type Request = {method?:string;body:unknown}
type Response = {status:(n:number)=>Response;json:(v:unknown)=>void;setHeader:(k:string,v:string)=>void}
export default async function handler(req:Request,res:Response){
  res.setHeader('Cache-Control','no-store')
  if(req.method!=='POST'){res.status(405).json({error:'POST required'});return}
  try{
    const b=typeof req.body==='string'?JSON.parse(req.body):req.body
    if(!b||typeof b.image!=='string'||b.image.length>2_900_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.image)||!['image/png','image/jpeg','image/webp'].includes(b.mime)||typeof b.description!=='string'||b.description.length>3000||!/^0x[0-9a-fA-F]{40}$/.test(b.creator))throw Error('封面或资料格式不正确（图片最大 2 MB）')
    const bytes=Buffer.from(b.image,'base64');if(bytes.length>2_000_000)throw Error('图片最大 2 MB')
    const signature=b.mime==='image/png'?bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a':b.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'
    if(!signature)throw Error('图片格式与内容不匹配')
    const form=new FormData()
    form.append('operations',JSON.stringify({query:'mutation Create($file: Upload!, $meta: MetadataInput!) { create(file: $file, meta: $meta) }',variables:{file:null,meta:{description:b.description,creator:b.creator,twitter:null,telegram:null,website:null}}}))
    form.append('map',JSON.stringify({'0':['variables.file']}));form.append('0',new Blob([bytes],{type:b.mime}),'cover.'+(b.mime==='image/png'?'png':b.mime==='image/jpeg'?'jpg':'webp'))
    const response=await fetch('https://funcs.flap.sh/api/upload',{method:'POST',body:form,signal:AbortSignal.timeout(20000)})
    if(!response.ok)throw Error('Flap 资料上传服务暂不可用')
    const result=await response.json();const cid=result?.data?.create
    if(typeof cid!=='string'||!(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/).test(cid))throw Error('上传服务没有返回有效 CID')
    res.status(200).json({cid})
  }catch(e){res.status(400).json({error:e instanceof Error?e.message:'资料上传失败'})}
}
