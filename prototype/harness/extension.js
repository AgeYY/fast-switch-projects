// Test-only fixture, excluded from both VSIX packages. Only responds in FSP-A/B/C.
const vscode = require('vscode'), fs = require('fs'), path = require('path');
exports.activate = async context => {
    const uri = vscode.workspace.workspaceFile;
    const match = uri?.path.match(/\/FSP-([ABC])\.code-workspace$/);
    if (!match) return;
    const id = match[1], root = path.join(__dirname, 'requests');
    fs.mkdirSync(root, {recursive:true});
    let busy = false, last;
    const state = async () => ({ pid:process.pid, uri:uri.toString(), focused:vscode.window.state.focused, trusted:vscode.workspace.isTrusted,
        remote:vscode.env.remoteName, tabs:vscode.window.tabGroups.all.flatMap(g=>g.tabs.map(t=>({label:t.label,dirty:t.isDirty}))),
        terminals:await Promise.all(vscode.window.terminals.map(async t=>({name:t.name,pid:await t.processId}))),
        extensions:vscode.extensions.all.filter(e=>/fast-switch/.test(e.id)).map(e=>({id:e.id,kind:e.extensionKind,active:e.isActive})) });
    fs.writeFileSync(path.join(root,id+'-ready.json'),JSON.stringify(await state(),null,2));
    const timer=setInterval(async()=>{
        if(busy) return;
        const file=path.join(root,id+'.json');
        if(!fs.existsSync(file)) return;
        let request;
        try { request=JSON.parse(fs.readFileSync(file,'utf8')); } catch { return; }
        if(request.targetPid!==process.pid) return;
        if(request.id===last) return;
        last=request.id; busy=true;
        const started=performance.now();
        try {
            let result;
            if (request.op !== 'state' && !vscode.workspace.isTrusted) throw new Error('Trust the disposable workspace before running its tests');
            if(request.op==='state') result=await state();
            else if(request.op==='command') result=await vscode.commands.executeCommand(request.command,...(request.args||[]));
            else if(request.op==='setting') result=await vscode.workspace.getConfiguration().update(request.key,request.value,vscode.ConfigurationTarget.Global);
            else if(request.op==='session') {
                const document=await vscode.workspace.openTextDocument({content:'Independent unsaved editor '+id,language:'plaintext'});
                await vscode.window.showTextDocument(document,{preview:false});
                const terminal=vscode.window.createTerminal({name:'FSP-running-'+id});
                if(vscode.env.remoteName) terminal.sendText("python3 -u -c 'import time; print(\"FSP heartbeat started\", flush=True); time.sleep(1800)'");
                else terminal.sendText('python -u -c "import time; print(\'FSP heartbeat started\', flush=True); time.sleep(1800)"');
                result=await state();
            } else throw new Error('Unknown fixture operation');
            fs.writeFileSync(path.join(root,id+'-result.json'),JSON.stringify({id:request.id,ok:true,ms:performance.now()-started,result},null,2));
        } catch(error) { fs.writeFileSync(path.join(root,id+'-result.json'),JSON.stringify({id:request.id,ok:false,error:error.stack})); }
        finally {busy=false;}
    },100);
    context.subscriptions.push({dispose:()=>clearInterval(timer)});
};
