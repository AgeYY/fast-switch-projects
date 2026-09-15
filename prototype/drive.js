// Command client for the disposable live-test harness only.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'results','extensions');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function ready(project) {
    const candidates=fs.readdirSync(root).filter(n=>n.startsWith('local.fsp-prototype-harness-'))
        .map(n=>path.join(root,n,'requests',project+'-ready.json')).filter(n=>fs.existsSync(n))
        .sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
    if(!candidates.length)throw new Error('Fixture '+project+' has not activated');
    return {directory:path.dirname(candidates[0]),...JSON.parse(fs.readFileSync(candidates[0],'utf8'))};
}
async function request(project,message,timeout=45000) {
    const fixture=ready(project),id=Date.now()+'-'+Math.random(),file=path.join(fixture.directory,project+'.json');
    const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify({id,targetPid:fixture.pid,...message}));fs.renameSync(temp,file);
    const start=Date.now();
    while(Date.now()-start<timeout) {
        await delay(50);
        try { const result=JSON.parse(fs.readFileSync(path.join(fixture.directory,project+'-result.json'),'utf8'));
            if(result.id===id){if(!result.ok)throw new Error(result.error);return result;}
        } catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
    }
    throw new Error('Timed out waiting for fixture '+project);
}
async function main() {
    const [project,op,arg]=process.argv.slice(2);
    let message={op};
    if(op==='register'||op==='enable'||op==='showAll'||op==='unregister'||op==='diagnostics')message={op:'command',command:'fastSwitchProjects.windows.'+op};
    if(op==='switch')message={op:'command',command:'fastSwitchProjects.action.workspace.open',args:[{project:{path:ready(arg).uri}}]};
    if(op==='command')message={op:'command',command:arg};
    if(op==='disable')message={op:'setting',key:'fastSwitchProjects.singleWindow.enabled',value:false};
    console.log(JSON.stringify(await request(project,message),null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={ready,request};
