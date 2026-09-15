const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {Registrations}=require('../registrations');
test('shared per-workspace decisions survive another host and explicit revocation',t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'fsp-approvals-'));
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const a=new Registrations(root),b=new Registrations(root);
    const one='vscode-remote://ssh-remote+host/p/A.code-workspace',two='vscode-remote://ssh-remote+host/p/B.code-workspace';
    assert.equal(a.get(one),undefined);a.set(one,true);b.set(two,true);
    assert.equal(b.get(one),true);assert.equal(a.get(two),true);
    b.set(one,false);assert.equal(new Registrations(root).get(one),false);assert.equal(a.get(two),true);
    assert.equal(a.get(one.replace('+host/','+other/')),undefined);
    assert.equal(fs.readdirSync(a.root).length,2);
});
test('malformed registration data fails closed',t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'fsp-approvals-'));
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const store=new Registrations(root),key='file:///C:/A.code-workspace';store.set(key,true);
    fs.writeFileSync(store.file(key),JSON.stringify({key:'another-workspace',approved:true}));
    assert.throws(()=>store.get(key),/Invalid project registration/);
});
