const {test}=require('node:test'), assert=require('node:assert/strict');
const {identity,targetUri}=require('../identity');
class Uri {
    constructor(text) { const u=new URL(text); this.scheme=u.protocol.slice(0,-1); this.authority=u.host; this.path=decodeURI(u.pathname); }
    static parse(text) { return new Uri(text); }
    with(update) { return new Uri(`${update.scheme||this.scheme}://${update.authority||this.authority}${encodeURI(this.path)}`); }
    toString() { return `${this.scheme}://${this.authority}${encodeURI(this.path)}`; }
}
test('duplicate workspaces retain separate identities; rename labels are irrelevant',()=>{
    assert.notEqual(identity(Uri.parse('file:///C:/projects/a/Project.code-workspace')),identity(Uri.parse('file:///C:/projects/b/Project.code-workspace')));
});
test('remote path acquires local window SSH authority without losing workspace path',()=>{
    const vscode={Uri,workspace:{workspaceFile:Uri.parse('vscode-remote://ssh-remote+host/home/user/A.code-workspace')}};
    assert.equal(targetUri(vscode,'file:///home/user/B.code-workspace').toString(),'vscode-remote://ssh-remote+host/home/user/B.code-workspace');
});
test('different SSH hosts and case-sensitive remote paths stay distinct',()=>{
    const a=Uri.parse('vscode-remote://ssh-remote+one/home/A');
    assert.notEqual(identity(a),identity(Uri.parse('vscode-remote://ssh-remote+two/home/A')));
    assert.notEqual(identity(a),identity(Uri.parse('vscode-remote://ssh-remote+one/home/a')));
});
test('explicit remote authority is not rewritten',()=>{
    const vscode={Uri,workspace:{workspaceFile:Uri.parse('vscode-remote://ssh-remote+one/home/A')}};
    assert.equal(targetUri(vscode,'vscode-remote://ssh-remote+two/home/B').authority,'ssh-remote+two');
});
